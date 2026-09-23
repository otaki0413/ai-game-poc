import { applyD1Migrations, env } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, inject, it } from "vitest";
import { getGame, saveGame } from "../lib/games.server";
import type { Route } from "./+types/games.$id";
import { action } from "./games.$id";

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

function remove(id: string, origin: string | null) {
	const headers = new Headers();
	if (origin !== null) headers.set("Origin", origin);
	return action({
		request: new Request(`https://app.example/games/${id}`, {
			method: "POST",
			headers,
		}),
		params: { id },
	} as Route.ActionArgs);
}

describe("/games/:id action", () => {
	it("同一オリジンからの POST で削除してホームに戻る", async () => {
		const id = await saveFixture();

		const response = (await remove(id, "https://app.example")) as Response;

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/");
		expect(await getGame(env.DB, id)).toBeNull();
		expect(await env.GAMES.get(`games/${id}.html`)).toBeNull();
	});

	it("別オリジンからの POST は 403 で何も消さない", async () => {
		const id = await saveFixture();

		await expect(remove(id, "https://evil.example")).rejects.toMatchObject({
			init: { status: 403 },
		});

		expect(await getGame(env.DB, id)).not.toBeNull();
		expect(await env.GAMES.get(`games/${id}.html`)).not.toBeNull();
	});

	it("Origin ヘッダがない POST は 403 で何も消さない", async () => {
		const id = await saveFixture();

		await expect(remove(id, null)).rejects.toMatchObject({
			init: { status: 403 },
		});

		expect(await getGame(env.DB, id)).not.toBeNull();
	});
});
