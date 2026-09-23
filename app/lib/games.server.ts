export type Game = {
	id: string;
	title: string;
	prompt: string;
	created_at: number;
};

type GameBindings = Pick<Env, "DB" | "GAMES">;

export async function listGames(db: D1Database): Promise<Game[]> {
	const result = await db
		.prepare(
			"SELECT id, title, prompt, created_at FROM games ORDER BY created_at DESC, rowid DESC",
		)
		.all<Game>();
	return result.results;
}

export async function getGame(
	db: D1Database,
	id: string,
): Promise<Game | null> {
	return db
		.prepare("SELECT id, title, prompt, created_at FROM games WHERE id = ?")
		.bind(id)
		.first<Game>();
}

// D1 に行がないゲームは R2 に HTML が残っていても返さない（R2 の孤児を配信しない）
export async function getGameHtml(
	{ DB, GAMES }: GameBindings,
	id: string,
): Promise<ReadableStream | null> {
	if (!(await getGame(DB, id))) return null;
	const object = await GAMES.get(gameKey(id));
	return object?.body ?? null;
}

function gameKey(id: string): string {
	return `games/${id}.html`;
}

export async function saveGame(
	{ DB, GAMES }: GameBindings,
	game: Game & { html: string },
): Promise<void> {
	const key = gameKey(game.id);
	await GAMES.put(key, game.html);

	try {
		await DB.prepare(
			"INSERT INTO games (id, title, prompt, created_at) VALUES (?, ?, ?, ?)",
		)
			.bind(game.id, game.title, game.prompt, game.created_at)
			.run();
	} catch (error) {
		try {
			await GAMES.delete(key);
		} catch (cleanupError) {
			console.error("R2 cleanup failed after D1 insert failure", cleanupError);
		}
		throw error;
	}
}
