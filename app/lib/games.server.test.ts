import { applyD1Migrations, env } from "cloudflare:test";
import type { D1Migration } from "@cloudflare/vitest-plugin";
import { afterEach, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { deleteGame, getGame, listGames, saveGame } from "./games.server";

declare module "vitest" {
	interface ProvidedContext {
		migrations: D1Migration[];
	}
}

const objectIds: string[] = [];

beforeAll(async () => {
	await applyD1Migrations(env.DB, inject("migrations"));
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

describe("deleteGame", () => {
	async function saveFixture(): Promise<string> {
		const id = crypto.randomUUID();
		objectIds.push(id);
		await saveGame(env, {
			id,
			title: "消すゲーム",
			prompt: "星を集める",
			created_at: 1000,
			html: "<!DOCTYPE html><title>doomed</title>",
		});
		return id;
	}

	it("D1 と R2 の両方から消す", async () => {
		const id = await saveFixture();

		await deleteGame(env, id);

		expect(await getGame(env.DB, id)).toBeNull();
		expect(await env.GAMES.get(`games/${id}.html`)).toBeNull();
	});

	it("存在しない ID でも成功する", async () => {
		await expect(deleteGame(env, crypto.randomUUID())).resolves.toBeUndefined();
	});

	it("R2 の delete が失敗しても D1 から消えて成功扱いになる", async () => {
		const id = await saveFixture();
		const GAMES = {
			delete: vi.fn().mockRejectedValue(new Error("R2 down")),
		} as unknown as R2Bucket;
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		await expect(
			deleteGame({ DB: env.DB, GAMES }, id),
		).resolves.toBeUndefined();

		expect(GAMES.delete).toHaveBeenCalledWith(`games/${id}.html`);
		expect(consoleError).toHaveBeenCalledOnce();
		expect(await getGame(env.DB, id)).toBeNull();
		expect(await (await env.GAMES.get(`games/${id}.html`))?.text()).toBe(
			"<!DOCTYPE html><title>doomed</title>",
		);
		consoleError.mockRestore();
	});

	it("D1 の delete が失敗したら R2 には触れずエラーになる", async () => {
		const id = await saveFixture();
		const DB = {
			prepare: () => ({
				bind: () => ({
					run: vi.fn().mockRejectedValue(new Error("D1 down")),
				}),
			}),
		} as unknown as D1Database;
		const GAMES = { delete: vi.fn() } as unknown as R2Bucket;

		await expect(deleteGame({ DB, GAMES }, id)).rejects.toThrow("D1 down");

		expect(GAMES.delete).not.toHaveBeenCalled();
		expect(await getGame(env.DB, id)).not.toBeNull();
		expect(await env.GAMES.get(`games/${id}.html`)).not.toBeNull();
	});
});
