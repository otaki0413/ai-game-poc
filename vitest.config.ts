import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		passWithNoTests: true,
	},
});
