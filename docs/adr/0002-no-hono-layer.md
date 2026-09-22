# Hono を入れず、React Router 単体で Worker を構成する

本開発想定のスタックには Hono が含まれ、当初の計画でも `workers/app.ts` で Hono が React Router をラップし、
将来の `/api/*` と Cloudflare バインディングへの入口を担う予定だった。
しかし 2026-09 時点で調べた結果、その役割は React Router v8 と Cloudflare の公式テンプレートがすでに担っている。

- バインディングは `import { env } from "cloudflare:workers"` でどのファイルからも取れる（公式テンプレートの方式。TanStack Start でも同じ）
- 認証・レスポンスヘッダ・ルート単位のコンテキストは v8 で常時有効になった middleware と `RouterContextProvider` で書ける
- `/play/:id` のような生 `Response` を返すエンドポイントは resource route でヘッダがそのまま届く

一方、Hono で RR をラップする既存手段は v8 に追随していない。`hono-react-router-adapter` は 2025-03 で更新が止まり作者自身が非推奨と発言、
Cloudflare 公式の `react-router-hono-fullstack-template` も RR 7 のままで、v8 では load context の型が変わり動かない。
v8 対応は個人メンテの `react-router-hono-server` のみで、POC で依存するには薄い。

TanStack Start への将来の載せ替えについても、Hono の殻は書き直し量を減らさない。
載せ替えで残るのはフレームワーク非依存の `app/lib/*.server.ts` であり、そこに生成・保存・削除のロジックを置くことが唯一の備えになる。

## Consequences

- `workers/app.ts` は React Router の `createRequestHandler` を呼ぶだけの数行に留める
- ルーティングは React Router の 1 系統のみ。HTTP API として外部に公開したい要件が出た時点で Hono の導入を再検討する
- Hono の `secureHeaders()` のような CSP ヘルパーは使えないので、`/play/:id` の CSP は文字列で明示する
