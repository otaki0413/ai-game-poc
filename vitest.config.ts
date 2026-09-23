import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		passWithNoTests: true,
		provide: {
			migrations: await readD1Migrations("./migrations"),
		},
	},
});
