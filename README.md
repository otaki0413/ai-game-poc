# AI Game POC

プロンプトからブラウザゲームを生成し、一覧から遊べる個人用 POC。構成と実装予定は [docs/poc-plan.md](docs/poc-plan.md) を参照してください。

## ローカルで動かす

Node.js と pnpm が必要です。Workers AI のバインディングはローカルでも Cloudflare に接続するため、`pnpm dev` の前に `wrangler login` が必要です（`GENERATOR=stub` のときも同じ）。

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm exec wrangler login
pnpm exec wrangler d1 migrations apply ai-game-poc-db --local
pnpm dev
```

`http://localhost:5173` を開きます。`.dev.vars` の `GENERATOR` で生成方法を切り替えます。`.dev.vars` は Git 管理の対象外です。ローカルの D1 と R2 は Wrangler がエミュレートします。

- `GENERATOR=stub`: 固定 HTML のゲームを返す。Workers AI は呼ばない
- `GENERATOR=workers-ai`: Workers AI（`@cf/zai-org/glm-4.7-flash`）で生成する。ローカルでも Neurons（Free 枠 10,000/日）を消費し、呼び出しは AI Gateway（`default`）に記録される。1 回の生成で最大 2 回呼ぶ

テスト（`pnpm test`）は AI バインディングにフェイクを使い、Cloudflare に接続しません。

## デプロイ

workers.dev（`https://ai-game-poc.otaki0413-it.workers.dev`）にデプロイします。本番の D1（`ai-game-poc-db`）と R2（`ai-game-poc-games`）は作成済みです。`pnpm run deploy` はコードだけを再デプロイするので、マイグレーションを足したときは先に `db:migrate:remote` を実行します。`pnpm deploy` は pnpm の組み込みコマンドなので使いません。

```sh
pnpm run db:migrate:remote
pnpm run deploy
```

本番の `GENERATOR` は wrangler 設定の `vars` にある `workers-ai` です。公開 URL は Cloudflare Access で本人だけに限定します。

## 確認

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
```
