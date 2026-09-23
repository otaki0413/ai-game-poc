import { env } from "cloudflare:workers";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { deleteGame, getGame } from "../lib/games.server";
import { isSameOriginRequest } from "../lib/same-origin";
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

// 存在チェックはしない。削除済み・存在しない ID でも削除を実行してホームに戻る
export async function action({ request, params }: Route.ActionArgs) {
	if (!isSameOriginRequest(request)) {
		throw data(null, { status: 403, statusText: "Forbidden" });
	}

	try {
		await deleteGame(env, params.id);
	} catch (error) {
		console.error("Game deletion failed", error);
		return data(
			{ error: "ゲームを削除できませんでした。もう一度お試しください。" },
			{ status: 500 },
		);
	}
	return redirect("/");
}

export default function GameDetail({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { game } = loaderData;
	const navigation = useNavigation();
	const isDeleting = navigation.state !== "idle";

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
					<div className="flex items-start justify-between gap-4">
						<h1 className="text-3xl font-bold tracking-tight wrap-break-word sm:text-4xl">
							{game.title}
						</h1>
						<Form method="post" className="shrink-0">
							<button
								type="submit"
								disabled={isDeleting}
								aria-describedby={
									actionData?.error ? "delete-error" : undefined
								}
								className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
							>
								{isDeleting ? "削除中…" : "削除"}
							</button>
						</Form>
					</div>
					<p className="mt-4 whitespace-pre-wrap text-slate-600 wrap-break-word">
						{game.prompt}
					</p>
					{actionData?.error && (
						<p
							id="delete-error"
							role="alert"
							className="mt-4 text-sm text-rose-700"
						>
							{actionData.error}
						</p>
					)}
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
