import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import migration from "../../migrations/0001_create_games.sql?raw";
import { listGames, saveGame } from "./games.server";

const objectIds: string[] = [];

beforeAll(async () => {
	await env.DB.prepare(migration).run();
});

afterEach(async () => {
	await env.DB.exec("DELETE FROM games");
	await Promise.all(
		objectIds.splice(0).map((id) => env.GAMES.delete(`games/${id}.html`)),
	);
});

describe("saveGame", () => {
	it("R2 と D1 にゲームを保存し、新しい順に一覧を返す", async () => {
		const olderId = crypto.randomUUID();
		const newerId = crypto.randomUUID();
		const latestId = crypto.randomUUID();
		objectIds.push(olderId, newerId, latestId);
		await saveGame(env, {
			id: olderId,
			title: "古いゲーム",
			prompt: "左右に動く",
			created_at: 1000,
			html: "<!DOCTYPE html><title>old</title>",
		});
		await saveGame(env, {
			id: newerId,
			title: "新しいゲーム",
			prompt: "星を集める",
			created_at: 2000,
			html: "<!DOCTYPE html><title>new</title>",
		});
		await saveGame(env, {
			id: latestId,
			title: "同じミリ秒のゲーム",
			prompt: "星を集める",
			created_at: 2000,
			html: "<!DOCTYPE html><title>latest</title>",
		});

		expect((await listGames(env.DB)).map((game) => game.id)).toEqual([
			latestId,
			newerId,
			olderId,
		]);
		expect(await (await env.GAMES.get(`games/${newerId}.html`))?.text()).toBe(
			"<!DOCTYPE html><title>new</title>",
		);
	});

	it("ID が既存ゲームと衝突しても、その HTML を上書きしない", async () => {
		const id = crypto.randomUUID();
		const key = `games/${id}.html`;
		objectIds.push(id);
		await env.DB.prepare(
			"INSERT INTO games (id, title, prompt, created_at) VALUES (?, ?, ?, ?)",
		)
			.bind(id, "既存", "既存のプロンプト", 1000)
			.run();
		await env.GAMES.put(key, "<!DOCTYPE html><title>existing</title>");

		await expect(
			saveGame(env, {
				id,
				title: "重複",
				prompt: "新しいプロンプト",
				created_at: 2000,
				html: "<!DOCTYPE html><title>duplicate</title>",
			}),
		).rejects.toThrow("Game object already exists");

		expect(await (await env.GAMES.get(key))?.text()).toBe(
			"<!DOCTYPE html><title>existing</title>",
		);
		expect(await listGames(env.DB)).toEqual([
			{
				id,
				title: "既存",
				prompt: "既存のプロンプト",
				created_at: 1000,
			},
		]);
	});

	it("D1 の ID 重複で失敗したら R2 の書き込みを取り消す", async () => {
		const id = crypto.randomUUID();
		objectIds.push(id);
		await env.DB.prepare(
			"INSERT INTO games (id, title, prompt, created_at) VALUES (?, ?, ?, ?)",
		)
			.bind(id, "既存", "既存のプロンプト", 1000)
			.run();

		await expect(
			saveGame(env, {
				id,
				title: "重複",
				prompt: "新しいプロンプト",
				created_at: 2000,
				html: "<!DOCTYPE html><title>duplicate</title>",
			}),
		).rejects.toThrow();

		expect(await env.GAMES.get(`games/${id}.html`)).toBeNull();
		expect(await listGames(env.DB)).toEqual([
			{
				id,
				title: "既存",
				prompt: "既存のプロンプト",
				created_at: 1000,
			},
		]);
	});
});
