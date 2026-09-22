# ai-game-poc

AI でブラウザゲームを生成し、一覧から遊べる CtoC プラットフォームの個人用 POC。
設計の正本は [docs/poc-plan.md](docs/poc-plan.md)。判断を変えたらそちらを更新する。

## 前提

- Cloudflare **Free プランの範囲に閉じる**。Paid 専用機能（Dynamic Workers, Queues 等）は使わない
- LLM は Workers AI（`@cf/zai-org/glm-4.7-flash`）。Claude API への差し替えは `app/lib/generate.server.ts` の呼び出し部分だけで済む構造を保つ
- 生成ゲームはクライアント完結の単一 HTML。サーバー側ロジックは持たせない
- 個人用なので認証・課金・マルチプレイは対象外

## スタック

React Router (framework mode, SSR) + `@cloudflare/vite-plugin` + Tailwind / Hono (`workers/app.ts`) / D1 / R2 / Workers AI / pnpm / Wrangler

## コマンド

- `pnpm dev` — ローカル開発（D1/R2/AI はエミュレート）
- `pnpm typecheck` — `wrangler types` + `react-router typegen` + `tsc -b`
- `pnpm deploy` — build + `wrangler deploy`

## 規約

- 生成ゲームの配信 (`/play/:id`) は必ず CSP 付き、埋め込み iframe は `allow-same-origin` を付けない
- `.dev.vars` / `worker-configuration.d.ts` はコミットしない（.gitignore 済み）
