import { env } from "cloudflare:workers";
import { data, Form, redirect, useNavigation } from "react-router";
import * as v from "valibot";
import { listGames, saveGame } from "../lib/games.server";
import { generateGameHtml } from "../lib/generate.server";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [{ title: "AI Game POC" }];

const generateSchema = v.object({
	prompt: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("プロンプトを入力してください。"),
	),
	title: v.pipe(v.string(), v.trim()),
});

export async function loader() {
	return { games: await listGames(env.DB) };
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const rawPrompt = formData.get("prompt");
	const rawTitle = formData.get("title") ?? "";
	const values = {
		prompt: typeof rawPrompt === "string" ? rawPrompt : "",
		title: typeof rawTitle === "string" ? rawTitle : "",
	};
	const parsed = v.safeParse(generateSchema, {
		prompt: rawPrompt,
		title: rawTitle,
	});
	if (!parsed.success) {
		return data({ error: parsed.issues[0].message, values }, { status: 400 });
	}

	const { prompt } = parsed.output;
	const title = parsed.output.title || Array.from(prompt).slice(0, 30).join("");
	try {
		const html = generateGameHtml(env.GENERATOR);
		await saveGame(env, {
			id: crypto.randomUUID(),
			title,
			prompt,
			created_at: Date.now(),
			html,
		});
	} catch (error) {
		console.error("Game generation failed", error);
		return data(
			{
				error: "ゲームを生成できませんでした。もう一度お試しください。",
				values,
			},
			{ status: 500 },
		);
	}

	return redirect("/");
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const isGenerating = navigation.state === "submitting";

	return (
		<main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900 sm:px-8">
			<div className="mx-auto max-w-5xl">
				<header className="mb-10">
					<p className="mb-3 text-sm font-semibold tracking-widest text-indigo-600 uppercase">
						AI Game POC
					</p>
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
						ゲームをつくる
					</h1>
					<p className="mt-4 max-w-2xl text-slate-600">
						つくりたいゲームを言葉で入力してください。生成したゲームは一覧に追加されます。
					</p>
				</header>

				<section
					aria-labelledby="generate-heading"
					className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
				>
					<h2 id="generate-heading" className="mb-6 text-xl font-semibold">
						新しいゲーム
					</h2>
					<Form method="post" className="space-y-5">
						<div>
							<label htmlFor="prompt" className="mb-2 block font-medium">
								プロンプト <span className="text-rose-600">*</span>
							</label>
							<textarea
								id="prompt"
								name="prompt"
								rows={4}
								defaultValue={actionData?.values.prompt}
								placeholder="例: 星を集めるシンプルなアーケードゲーム"
								aria-invalid={actionData?.error ? true : undefined}
								aria-describedby={actionData?.error ? "form-error" : undefined}
								className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
							/>
						</div>
						<div>
							<label htmlFor="title" className="mb-2 block font-medium">
								タイトル{" "}
								<span className="text-sm font-normal text-slate-500">任意</span>
							</label>
							<input
								id="title"
								name="title"
								type="text"
								defaultValue={actionData?.values.title}
								placeholder="未入力ならプロンプトから自動設定"
								className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
							/>
						</div>
						{actionData?.error && (
							<p id="form-error" role="alert" className="text-sm text-rose-700">
								{actionData.error}
							</p>
						)}
						<button
							type="submit"
							disabled={isGenerating}
							className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
						>
							{isGenerating ? "生成中…" : "ゲームを生成"}
						</button>
					</Form>
				</section>

				<section aria-labelledby="games-heading" className="mt-12">
					<div className="mb-5 flex items-baseline justify-between gap-4">
						<h2 id="games-heading" className="text-2xl font-bold">
							ゲーム一覧
						</h2>
						<span className="text-sm text-slate-500">
							{loaderData.games.length} 件
						</span>
					</div>
					{loaderData.games.length === 0 ? (
						<p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-500">
							まだゲームはありません。最初のゲームを生成してください。
						</p>
					) : (
						<ul className="grid gap-4 sm:grid-cols-2">
							{loaderData.games.map((game) => (
								<li
									key={game.id}
									className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
								>
									<h3 className="text-lg font-semibold wrap-break-word">
										{game.title}
									</h3>
									<p className="mt-2 line-clamp-3 text-sm text-slate-600 wrap-break-word">
										{game.prompt}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</main>
	);
}
