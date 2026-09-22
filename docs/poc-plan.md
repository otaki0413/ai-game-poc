# AI ゲーム生成 CtoC プラットフォーム POC 計画

作成日: 2026-09-22

## 背景

「AI でゲームを生成し、世界中のユーザーが作ったゲームを遊べる CtoC プラットフォーム」の 0→1 を、
個人用・無料枠のみでミニマルに再現する POC。

参考にした本開発想定のプロトタイプ構成:
TypeScript / React 19 / Vite / React Router / Tailwind / Hono / Cloudflare Workers / D1 / R2 / KV /
Durable Objects / WebSocket / Workers AI / AI Gateway / Vectorize / Workflows / Queues / Analytics Engine /
Stripe / Web Components / Zod / pnpm workspaces / Vitest / Wrangler。

## POC スコープ

| 本開発の要件 | POC |
|---|---|
| ゲーム生成・編集・公開 | 生成・公開のみ。編集は「再生成」で代用 |
| フィード・検索（Vectorize） | D1 の一覧表示のみ |
| 生成ゲームを安全に実行する仕組み | iframe sandbox + CSP。Dynamic Workers は使わない |
| ゲーム⇔プラットフォーム SDK | v1 で postMessage の `submitScore` 1 関数だけ |
| リアルタイム・マルチプレイ | 対象外 |
| 課金・還元（Stripe） | 対象外 |
| Workflows / Queues / Analytics Engine | 対象外（生成は同期リクエスト 1 本） |
| 認証・ユーザー | 対象外（個人用。公開 URL に置くなら簡易トークン） |

最小の 4 機能: **プロンプト入力 → AI が単一 HTML ゲームを生成 → R2 に保存 → 一覧から sandboxed iframe で遊ぶ**。

## 技術スタック（無料枠のみ）

| 層 | 選定 | 無料枠 | 見込み消費 |
|---|---|---|---|
| ランタイム | Cloudflare Workers Free | 10 万 req/日、CPU 10ms/req | 余裕 |
| フロント + SSR | React Router (framework mode) + `@cloudflare/vite-plugin` + Tailwind | Workers に同梱 | — |
| API | Hono（`workers/app.ts` で RR をラップ、将来の `/api/*` 用） | — | — |
| メタデータ | D1 (`games` テーブル) | 500 万行読み/日、10 万行書き/日、5GB | 余裕 |
| ゲーム本体 | R2 (`games/{id}.html`) | 10GB、Class A 100 万/月、Class B 1,000 万/月 | 1 ゲーム 20〜50KB |
| LLM | Workers AI `@cf/zai-org/glm-4.7-flash` | 10,000 Neurons/日 | 1 ゲーム ≈ 400〜900 Neurons → 10〜20 ゲーム/日 |
| AI Gateway（任意） | 生成ログ・キャッシュ | 無料 | — |
| 開発 | pnpm, Wrangler（D1/R2/AI をローカルエミュレート） | — | — |

### 選定理由

- **React Router を TanStack Start より優先**: 本開発想定のスタックに含まれる、Cloudflare 公式テンプレが最も枯れている、Hono と `workers/app.ts` で自然に共存できる。
- **Claude API ではなく Workers AI**: 無料に閉じるため。`generate.server.ts` の呼び出し部分だけ差し替えれば Claude (`claude-opus-5`) に移行できる構造にする。
- **Dynamic Workers を使わない**: Paid 専用（Open Beta）。POC のゲームはクライアント完結なので不要。サーバー側ロジック（スコア検証・マルチプレイ）が必要になった段階で導入する。
- **Durable Objects を使わない**: Free でも SQLite バックエンドなら使えるが、POC の要件にない。

### Workers AI モデルの注意

- Free で利用可: `@cf/zai-org/glm-4.7-flash`, `@cf/google/gemma-4-26b-a4b-it`, `@cf/nvidia/nemotron-3-120b-a12b`
- Paid 必須（Free だと 403）: `kimi-k2.6`, `kimi-k2.7-code`, `glm-5.2`
- `glm-5.3-flash` は Free 可否を実機で確認
- reasoning トークンも出力として Neurons 課金される。プロンプトで思考を抑制すると消費が半減する

## データフロー

```
[React UI] --action (prompt)--> [Worker]
                                  ├─ env.AI.run(glm-4.7-flash) → 単一 HTML
                                  ├─ R2.put(games/{id}.html)
                                  └─ D1 insert → {id}
[React UI] --loader--> D1 から一覧
[iframe sandbox="allow-scripts allow-pointer-lock"] --GET /play/{id}--> R2 から HTML 配信 (CSP 付き)
```

## ルート設計

```
app/
  routes.ts
  routes/
    home.tsx          # 一覧 + 生成フォーム（loader: D1、action: 生成）
    games.$id.tsx     # 詳細ページ、iframe で /play/:id を埋め込む
    play.$id.tsx      # resource route: R2 から HTML を返す（loader が Response を返す）
  lib/
    generate.server.ts  # LLM 呼び出し + 後処理 + 保存。プロバイダ差し替え可能にする
workers/
  app.ts              # Worker エントリ。Hono で /api/* を持ち、それ以外を RR に渡す
```

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
- 後処理で `<think>…</think>` とコードフェンスを除去し、`<!DOCTYPE` で始まらなければ 1 回だけリトライ

### 安全性（POC 段階）

- iframe は `sandbox="allow-scripts allow-pointer-lock"`（`allow-same-origin` を付けない → opaque origin）
- `/play/:id` の CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'`
- 生成コードが外部通信・アプリ側の Cookie/storage に触れない状態を保つ
- 公開 URL に置く場合は生成エンドポイントに `Authorization: Bearer <token>` か Cloudflare Access を前段に

## 無料運用での注意

1. CPU 10ms/req: LLM 待ちは I/O なので消費しない。後処理は正規表現程度に留める
2. 生成は 30〜90 秒かかる。UI でローディング表示必須
3. Free でも subrequest 50 回/req。Workers AI binding は subrequest 扱い
4. R2 は有効化時にカード登録が必要だが、無料枠内なら請求なし
5. D1 は 2026-09-01 から Free の日次上限超過でクエリが失敗する（データは残る）

## 拡張パス

| 段階 | 追加するもの |
|---|---|
| v1 | `window.GameSDK.submitScore()`（postMessage）+ D1 `scores`、SSE で生成過程をストリーム表示、手動アップロード（Claude 等で生成した HTML との品質比較用） |
| v2 | `*.play.example.com` ワイルドカードでゲームごとにオリジン分離、認証 |
| v3 (Paid) | サーバー側ロジックが必要なゲーム → Dynamic Workers / DO Facets |
| v4 | Vectorize でセマンティック検索、Workflows で生成の非同期化、AI Gateway でコスト可視化、Stripe |

## Paid プランに移行した場合に変わること

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
- React Router on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
