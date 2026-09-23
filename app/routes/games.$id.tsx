import { env } from "cloudflare:workers";
import { data, Link } from "react-router";
import { getGame } from "../lib/games.server";
import type { Route } from "./+types/games.$id";

export const meta: Route.MetaFunction = ({ loaderData }) => [
	{
		title: loaderData
			? `${loaderData.game.title} | AI Game POC`
			: "AI Game POC",
	},
];

export async function loader({ params }: Route.LoaderArgs) {
	const game = await getGame(env.DB, params.id);
	if (!game) throw data(null, { status: 404 });
	return { game };
}

export default function GameDetail({ loaderData }: Route.ComponentProps) {
	const { game } = loaderData;

	return (
		<main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900 sm:px-8">
			<div className="mx-auto max-w-5xl">
				<Link
					to="/"
					className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
				>
					← ゲーム一覧
				</Link>
				<header className="mt-6 mb-8">
					<h1 className="text-3xl font-bold tracking-tight wrap-break-word sm:text-4xl">
						{game.title}
					</h1>
					<p className="mt-4 whitespace-pre-wrap text-slate-600 wrap-break-word">
						{game.prompt}
					</p>
				</header>
				<iframe
					title={game.title}
					src={`/play/${game.id}`}
					sandbox="allow-scripts allow-pointer-lock"
					className="h-[70vh] min-h-96 w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
				/>
			</div>
		</main>
	);
}
