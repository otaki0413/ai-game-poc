import { env } from "cloudflare:workers";
import { getGameHtml } from "../lib/games.server";
import type { Route } from "./+types/play.$id";

// 値の正本は docs/poc-plan.md「安全性」節
export const PLAY_HEADERS = {
	"Content-Security-Policy":
		"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; sandbox allow-scripts allow-pointer-lock; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
	"Content-Type": "text/html; charset=utf-8",
	"X-Content-Type-Options": "nosniff",
	"Cache-Control": "no-store",
};

export async function loader({ params }: Route.LoaderArgs) {
	const html = await getGameHtml(env, params.id);
	if (!html) return new Response("Not Found", { status: 404 });
	return new Response(html, { headers: PLAY_HEADERS });
}
