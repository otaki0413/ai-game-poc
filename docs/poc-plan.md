# AI ゲーム生成 CtoC プラットフォーム POC 計画

作成日: 2026-09-22 / 最終更新: 2026-09-23（技術スタックの詰問結果を反映）

設計判断の記録は [docs/adr/](adr/)、用語は [CONTEXT.md](../CONTEXT.md)。

## 背景と目的

「AI でゲームを生成し、世界中のユーザーが作ったゲームを遊べる CtoC プラットフォーム」の 0→1 を、
個人用・Cloudflare Free 枠のみでミニマルに再現する POC。

**主目的は技術検証**: Cloudflare だけで CtoC ゲームプラットフォームの骨格が成立するかを確かめる。
生成ゲームの品質は副次的で、LLM の選定材料を集めることは目的に含めない（[ADR 0001](adr/0001-close-within-cloudflare-free.md)）。

参考にした本開発想定のプロトタイプ構成:
TypeScript / React 19 / Vite / React Router / Tailwind / Hono / Cloudflare Workers / D1 / R2 / KV /
Durable Objects / WebSocket / Workers AI / AI Gateway / Vectorize / Workflows / Queues / Analytics Engine /
Stripe / Web Components / Zod / pnpm workspaces / Vitest / Wrangler。

## 完了条件

公開 URL（Cloudflare Access で本人のみ）で、次が Free 枠内で一通り動くこと。

**プロンプト入力 → Workers AI が単一 HTML ゲームを生成 → R2 に保存 → 一覧に載る → sandboxed iframe で遊ぶ → 不要なら削除**

生成物の出来が悪くてもプロンプト調整は完了条件に含めない。

## POC スコープ

| 本開発の要件 | POC |
|---|---|
| ゲーム生成・編集・公開 | 生成と削除のみ。編集はなく、同じプロンプトで生成し直す（常に新しいゲームになる）。生成成功で即一覧に載り、独立した「公開」操作はない |
| フィード・検索（Vectorize） | D1 の一覧表示のみ |
| 生成ゲームを安全に実行する仕組み | iframe sandbox + CSP。Dynamic Workers は使わない |
| ゲーム⇔プラットフォーム SDK | v1 で postMessage の `submitScore` 1 関数だけ |
| リアルタイム・マルチプレイ | 対象外 |
| 課金・還元（Stripe） | 対象外 |
| Workflows / Queues / Analytics Engine | 対象外（生成は同期リクエスト 1 本） |
| 認証・ユーザー | ユーザー概念なし。Cloudflare Access で本人だけがアクセスできる状態にする |

スコープ外と決めたもの（詰問で却下）:

- 手動アップロード（Claude 等で作った HTML を持ち込んで比較する裏口）: アプリ内で完結させる
- 生成物の評価記録・使用モデルの記録: 品質検証を目的にしないため不要
- 「公開」を独立した操作にすること: 押す人と見る人が同じなので検証できることがない。後から `status` 列 1 つで足せる

## 技術スタック（無料枠のみ）

| 層 | 選定 | 無料枠 | 見込み消費 |
|---|---|---|---|
| ランタイム | Cloudflare Workers Free | 10 万 req/日、CPU 10ms/req | 余裕 |
| フロント + SSR + API | React Router v8 (framework mode) + `@cloudflare/vite-plugin` + Tailwind。Hono は入れない（[ADR 0002](adr/0002-no-hono-layer.md)） | Workers に同梱 | — |
| メタデータ | D1 (`games` テーブル) | 500 万行読み/日、10 万行書き/日、5GB | 余裕 |
| ゲーム本体 | R2 (`games/{id}.html`) | 10GB、Class A 100 万/月、Class B 1,000 万/月 | 1 ゲーム 20〜50KB |
| LLM | Workers AI `@cf/zai-org/glm-4.7-flash` | 10,000 Neurons/日 | 1 ゲーム ≈ 400〜900 Neurons → 10〜20 ゲーム/日 |
| アクセス制限 | Cloudflare Access（Zero Trust Free、Worker 単位の保護） | 無料（Zero Trust 有効化時に支払い方法の登録は必要） | — |
| AI Gateway | Workers AI の呼び出しログと Neurons 消費の可視化。`env.AI.run()` に `gateway: { id }` を渡す | 無料 | — |
| フォーム検証 | valibot（action の入力 2 フィールドのみ） | — | — |
| lint / format | Biome（`biome.json` 1 枚、`pnpm check`）。pre-commit フックは入れない | — | — |
| テスト | Vitest（node 環境）。対象は生成後処理の純関数のみ | — | — |
| 開発 | pnpm, Wrangler（D1/R2 はローカルエミュレート。Workers AI はリモート実行で Neurons を消費するため、環境変数で固定 HTML を返すスタブに切り替える） | — | — |

### 選定理由

- **React Router を TanStack Start より優先**: 本開発想定のスタックに含まれ、Cloudflare 公式テンプレが最も枯れている。TanStack Start は 2026-09 時点でまだ RC。載せ替えに備え、生成・保存・削除のロジックはフレームワーク非依存の `app/lib/*.server.ts` に置く
- **Hono を入れない**: バインディング取得・ミドルウェア・生 Response のいずれも RR v8 単体で書け、Hono で RR をラップする既存手段は v8 に追随していない。詳細は ADR 0002
- **Claude API ではなく Workers AI**: Cloudflare Free で閉じるため。詳細は ADR 0001
- **Dynamic Workers を使わない**: Paid 専用（Open Beta）。POC のゲームはクライアント完結なので不要。サーバー側ロジック（スコア検証・マルチプレイ）が必要になった段階で導入する
- **Durable Objects を使わない**: Free でも SQLite バックエンドなら使えるが、POC の要件にない
- **D1 は生 SQL**: テーブル 1 つ・クエリ 4 種に ORM は不要。マイグレーションは `wrangler d1 migrations`。Drizzle は本開発でテーブルが増えてから
- **Biome を選び Vite+ を見送る**: Vite+ は 2026-09 時点で 1.0 RC 直後。`vite.config.ts` と vitest の依存解決を乗っ取る構造で、`@cloudflare/vite-plugin` との dev サーバーハング（open issue）と `vitest-pool-workers` の Vitest 4 固定に当たる。1.0 安定後に再検討
- **ゲーム ID は `crypto.randomUUID()`**: 依存ゼロで衝突を考えない。R2 キーと URL に共用
- **UI は素の Tailwind**: 画面 2 つにコンポーネントライブラリは不要。見た目は完了条件に含まれない

### Workers AI モデルの注意（2026-09-22 時点、公式ドキュメント確認済み）

- Free で利用可: `@cf/zai-org/glm-4.7-flash`（コンテキスト 131k、`stream: true` 対応）, `@cf/google/gemma-4-26b-a4b-it`, `@cf/nvidia/nemotron-3-120b-a12b`
- Paid 必須（Free だと 403）: `kimi-k2.6`, `kimi-k2.7-code`, `glm-5.2`, `glm-5.3`, `glm-5.3-flash`
- `glm-4.7-flash` の Neurons: 入力 5,500 / M トークン、出力 36,400 / M トークン。Free 枠は 10,000 Neurons/日
- reasoning トークンも出力として Neurons 課金される。プロンプトで思考を抑制すると消費が半減する

## データフロー

```
[React UI] --action (prompt, title?)--> [Worker]
                                          ├─ env.AI.run(glm-4.7-flash) → 単一 HTML
                                          ├─ 後処理に失敗したら何も保存せずエラーを返す
                                          ├─ R2.put(games/{id}.html)
                                          └─ D1 insert → {id}（失敗したら R2.delete で補償）
[React UI] --loader--> D1 から一覧
[iframe sandbox="allow-scripts allow-pointer-lock"] --GET /play/{id}--> R2 から HTML 配信 (CSP 付き)
[React UI] --action (delete)--> D1 delete → R2.delete（どちらも冪等）
```

## ルート設計

```
app/
  routes.ts
  routes/
    home.tsx            # 一覧 + 生成フォーム（loader: D1、action: 生成）
    games.$id.tsx       # 詳細ページ、iframe で /play/:id を埋め込む、削除ボタン（action: 削除）
    play.$id.tsx        # resource route: R2 から HTML を返す（loader が Response を返す）
  lib/
    generate.server.ts  # LLM 呼び出し + 後処理。環境変数で Workers AI / スタブを切り替える
    postprocess.ts      # 純関数: <think> 除去、フェンス除去、DOCTYPE 判定。Vitest の対象
    games.server.ts     # D1 / R2 への保存・取得・削除
workers/
  app.ts                # Worker エントリ。RR の createRequestHandler を呼ぶだけ
```

- バインディングは `import { env } from "cloudflare:workers"` で取る（公式テンプレートの方式）。Cloudflare のドキュメントにある `context.cloudflare.env` は RR 7 時代の書き方で、v8 では load context に plain object を渡せないため動かない
- タイトルは利用者が任意入力し、空ならプロンプトの先頭 N 文字を使う

### D1 と R2 の書き込み順と失敗時の契約

D1 と R2 を跨ぐ原子性はないので、「R2 の孤児は許容、D1 の孤児は許容しない」を原則にする。
一覧に載るゲームは必ず遊べる状態を保つ。

- 生成: `R2.put` → `D1 insert` の順。D1 が失敗したら `R2.delete` で補償し、エラーを返す。補償も失敗した場合は R2 に孤児が残るが、一覧にも `/play/:id` にも現れないので放置する
- 削除: `D1 delete` → `R2 delete` の順。どちらも対象がなくても成功する（冪等）ので、R2 が失敗しても一覧からは消えており、同じ ID で再実行すれば R2 も消える
- 孤児の掃除は POC では行わない（1 ゲーム 50KB、Free 枠 10GB）。v2 以降の課題

### D1 スキーマ

```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### 生成プロンプトの方針

- 単一 HTML、インライン CSS/JS のみ、外部 URL / fetch / WebSocket / localStorage 禁止
- `<canvas>` + `requestAnimationFrame`、キーボードとタッチ両対応
- スコア表示とリスタート、300 行以内、1 画面アーケードにスコープを縛る
- 出力は `<!DOCTYPE html>` から始める。Markdown フェンス・説明文なし
- 後処理で `<think>…</think>` とコードフェンスを除去し、`<!DOCTYPE` で始まらなければ 1 回だけリトライ。リトライも失敗したら何も保存せずエラーを返す

### 安全性（POC 段階）

- iframe は `sandbox="allow-scripts allow-pointer-lock"`（`allow-same-origin` を付けない → opaque origin）
- `/play/:id` の CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'`
- 生成コードが外部通信・アプリ側の Cookie/storage に触れない状態を保つ
- 公開 URL は Cloudflare Access の Worker 単位保護（ダッシュボードの「Protect this Worker behind Access」、All traffic）で本人のみに限定する。workers.dev / routes / preview をまとめて覆う。Worker 内での `Cf-Access-Jwt-Assertion` 検証は公式推奨だが、個人用 POC では行わない。ローカル `wrangler dev` には Access は掛からない

## 無料運用での注意

1. CPU 10ms/req: LLM 待ちは I/O なので消費しない。後処理は正規表現程度に留める
2. 生成は 30〜90 秒かかる。UI でローディング表示必須。HTTP Worker には実行時間の上限がないので、同期リクエスト 1 本で問題ない
3. Free でも subrequest 50 回/req。Workers AI binding は subrequest 扱い
4. R2 は有効化時にカード登録が必要だが、無料枠内なら請求なし
5. D1 は 2026-09-01 から Free の日次上限超過でクエリが失敗する（データは残る）

## 拡張パス

| 段階 | 追加するもの |
|---|---|
| v1 | `window.GameSDK.submitScore()`（postMessage）+ D1 `scores`。ゲームがプラットフォームに何かを伝える最初の経路 |
| v2 | `*.play.example.com` ワイルドカードでゲームごとにオリジン分離、他人に見せる場合の認証 |
| v3 (Paid) | サーバー側ロジックが必要なゲーム → Dynamic Workers / DO Facets |
| v4 | Vectorize でセマンティック検索、Workflows で生成の非同期化、AI Gateway でコスト可視化、Stripe |

## Paid プランに移行した場合に変わること（参考。POC では移行しない）

| 項目 | Free | Paid ($5/月) |
|---|---|---|
| CPU 時間/req | 10ms | 5 分 |
| リクエスト数 | 10 万/日 | 無制限（1,000 万/月込み） |
| Dynamic Workers | 不可 | 可（1,000 ユニーク/月込み、超過 $0.002/日） |
| Queues | 不可 | 可 |
| Workers AI 一部モデル | 不可 | 可 |
| Browser Rendering | 10 分/日 | 10 時間/月 |

## 参考リンク

- Dynamic Workers: https://developers.cloudflare.com/dynamic-workers/
- Dynamic Workers Pricing: https://developers.cloudflare.com/dynamic-workers/pricing/
- Workers Limits: https://developers.cloudflare.com/workers/platform/limits/
- Workers AI Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Workers AI glm-4.7-flash: https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/
- React Router on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- Cloudflare Access for Workers: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- React Router middleware: https://reactrouter.com/how-to/middleware
- React Router resource routes: https://reactrouter.com/how-to/resource-routes
