import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		// AI バインディングはリモート専用。テストはフェイクを注入するので接続しない
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			remoteBindings: false,
		}),
	],
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
