import { applyD1Migrations, env } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, inject, it } from "vitest";
import { saveGame } from "../lib/games.server";
import type { Route } from "./+types/play.$id";
import { loader } from "./play.$id";

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

function play(id: string): Promise<Response> {
	return loader({ params: { id } } as Route.LoaderArgs);
}

describe("/play/:id", () => {
	it("D1 と R2 の両方にあるゲームを安全性のヘッダ付きで返す", async () => {
		const id = crypto.randomUUID();
		objectIds.push(id);
		await saveGame(env, {
			id,
			title: "ゲーム",
			prompt: "星を集める",
			created_at: 1000,
			html: "<!DOCTYPE html><title>game</title>",
		});

		const response = await play(id);

		expect(response.status).toBe(200);
		expect(Object.fromEntries(response.headers)).toMatchObject({
			"content-security-policy":
				"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; sandbox allow-scripts allow-pointer-lock; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
			"content-type": "text/html; charset=utf-8",
			"x-content-type-options": "nosniff",
			"cache-control": "no-store",
		});
		expect(await response.text()).toBe("<!DOCTYPE html><title>game</title>");
	});

	it("D1 に行がなければ R2 にオブジェクトがあっても 404", async () => {
		const id = crypto.randomUUID();
		objectIds.push(id);
		await env.GAMES.put(
			`games/${id}.html`,
			"<!DOCTYPE html><title>orphan</title>",
		);

		const response = await play(id);

		expect(response.status).toBe(404);
		expect(await response.text()).not.toContain("orphan");
	});

	it("R2 にオブジェクトがなければ D1 に行があっても 404", async () => {
		const id = crypto.randomUUID();
		await env.DB.prepare(
			"INSERT INTO games (id, title, prompt, created_at) VALUES (?, ?, ?, ?)",
		)
			.bind(id, "HTML なし", "プロンプト", 1000)
			.run();

		expect((await play(id)).status).toBe(404);
	});
});
