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

export async function saveGame(
	{ DB, GAMES }: GameBindings,
	game: Game & { html: string },
): Promise<void> {
	const key = `games/${game.id}.html`;
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
