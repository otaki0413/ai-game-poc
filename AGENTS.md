# ai-game-poc

AI でブラウザゲームを生成し、一覧から遊べる CtoC プラットフォームの個人用 POC。
計画・スタック・ルート設計の正本は [docs/poc-plan.md](docs/poc-plan.md)。判断を変えたらそちらを更新する。

## 前提

- Cloudflare Free プランの範囲に閉じる。Paid 専用機能（Dynamic Workers, Queues, Paid 限定の Workers AI モデル）は候補から外す
- LLM は Workers AI（`@cf/zai-org/glm-4.7-flash`）。呼び出しは `app/lib/generate.server.ts` に閉じ込め、Claude API への差し替えがそのファイルの変更だけで済む構造を保つ
- 生成ゲームはクライアント完結の単一 HTML。サーバー側ロジックは持たせない
- 個人用。ユーザーアカウント・課金・マルチプレイは対象外。公開 URL は Cloudflare Access で本人だけに限定する

## 規約

- 生成ゲームの配信 (`/play/:id`) は CSP 付き、埋め込み iframe は `sandbox="allow-scripts allow-pointer-lock"` のみ（`allow-same-origin` は付けない）。ヘッダ値は poc-plan.md の「安全性」節が正本
- 用語は `CONTEXT.md` に従う。戻しにくい設計判断は `docs/adr/` に ADR を残す（基準は domain-modeling スキルの 3 条件）。どちらも最初の項目が出た時点で作る

## Agent skills

### Issue tracker

GitHub Issues（`gh` CLI）。See `docs/agents/issue-tracker.md`.

### Domain docs

single-context（ルートの `CONTEXT.md` + `docs/adr/`）。See `docs/agents/domain.md`.
