# Cloudflare Free プランの範囲に閉じる

この POC の目的は「Cloudflare だけで CtoC ゲームプラットフォームの 0→1 が成立するか」を費用ゼロで確かめること。
生成ゲームの品質は副次的で、LLM の選定材料を集めることは目的に含めない。
そのため LLM は Workers AI の Free で使えるモデル（`@cf/zai-org/glm-4.7-flash`）に固定し、
Claude API 等の外部 API、Paid 専用機能（Dynamic Workers, Queues, Paid 限定モデル）はいずれも候補から外す。
モデル精度を理由に Paid へ上げることもしない。

## Consequences

- LLM 呼び出しは `app/lib/generate.server.ts` に閉じ込め、本開発で Claude に切り替える判断が出たときの差し替え点を 1 箇所に保つ
- モデル比較や生成物の評価を記録する機能は持たない
