import { applyD1Migrations, env } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, inject, it } from "vitest";
import { listGames } from "../lib/games.server";
import type { Route } from "./+types/home";
import { action } from "./home";

beforeAll(async () => {
	await applyD1Migrations(env.DB, inject("migrations"));
});

afterEach(async () => {
	await env.DB.exec("DELETE FROM games");
});

function generate(prompt: string, origin: string | null) {
	const headers = new Headers();
	if (origin !== null) headers.set("Origin", origin);
	const body = new FormData();
	body.set("prompt", prompt);
	return action({
		request: new Request("https://app.example/", {
			method: "POST",
			headers,
			body,
		}),
	} as Route.ActionArgs);
}

describe("/ action", () => {
	it("別オリジンからの POST は 403 で生成しない", async () => {
		await expect(
			generate("星を集めるゲーム", "https://evil.example"),
		).rejects.toMatchObject({ init: { status: 403 } });

		expect(await listGames(env.DB)).toEqual([]);
	});

	it("Origin ヘッダがない POST は 403 で生成しない", async () => {
		await expect(generate("星を集めるゲーム", null)).rejects.toMatchObject({
			init: { status: 403 },
		});

		expect(await listGames(env.DB)).toEqual([]);
	});

	it("同一オリジンからの POST は Origin の検査を通って入力検証に進む", async () => {
		const result = await generate("", "https://app.example");

		expect(result).toMatchObject({ init: { status: 400 } });
		expect(await listGames(env.DB)).toEqual([]);
	});
});
