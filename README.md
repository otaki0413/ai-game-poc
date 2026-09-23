# AI Game POC

プロンプトからブラウザゲームを生成し、一覧から遊べる個人用 POC。構成と実装予定は [docs/poc-plan.md](docs/poc-plan.md) を参照してください。

## ローカルで動かす

Node.js と pnpm が必要です。

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm exec wrangler d1 migrations apply ai-game-poc-db --local
pnpm dev
```

`http://localhost:5173` を開きます。`.dev.vars` の `GENERATOR=stub` により、現在は固定 HTML のゲームを生成します。`.dev.vars` は Git 管理の対象外です。ローカルの D1 と R2 は Wrangler がエミュレートします。

## 確認

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
```
