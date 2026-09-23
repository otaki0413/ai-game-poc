import { extractGameHtml } from "./postprocess";

const STUB_GAME_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Catch the Star</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-content: center; gap: 12px; background: #0f172a; color: #f8fafc; font: 16px system-ui; text-align: center; }
    canvas { width: min(92vw, 480px); height: auto; border: 2px solid #64748b; border-radius: 12px; touch-action: none; }
    p { margin: 0; }
  </style>
</head>
<body>
  <canvas id="game" width="480" height="320" tabindex="0" aria-label="星を集めるゲーム"></canvas>
  <p>画面をタップ、またはクリックして左右キーで移動</p>
  <script>
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    let playerX = 240;
    let starX = 120;
    let score = 0;

    function move(x) {
      playerX = Math.max(20, Math.min(460, x));
      if (Math.abs(playerX - starX) < 28) {
        score += 1;
        starX = 20 + Math.random() * 440;
      }
    }

    canvas.addEventListener("pointerdown", (event) => {
      canvas.focus();
      const bounds = canvas.getBoundingClientRect();
      move((event.clientX - bounds.left) * canvas.width / bounds.width);
    });
    canvas.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "a") move(playerX - 24);
      else if (event.key === "ArrowRight" || event.key === "d") move(playerX + 24);
      else return;
      event.preventDefault();
    });

    function frame() {
      ctx.fillStyle = "#172554";
      ctx.fillRect(0, 0, 480, 320);
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(starX, 264, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(playerX - 18, 280, 36, 18);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "20px system-ui";
      ctx.fillText("Score: " + score, 16, 30);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  </script>
</body>
</html>`;

const MODEL = "@cf/zai-org/glm-4.7-flash";
// 300 行の HTML は 4,000〜6,000 トークン程度。倍の余裕を取り、1 回あたり最大 ≈ 300 Neurons に抑える
const MAX_COMPLETION_TOKENS = 8192;
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT = `あなたはブラウザゲームを作るプログラマーです。利用者の指示から、ブラウザでそのまま遊べるゲームを 1 つ作ってください。

# 出力形式
- 完成した HTML 文書だけを出力する。1 文字目は <!DOCTYPE html> にする
- Markdown のコードフェンス、前置き、説明文、補足は一切書かない
- 考える過程や思考は出力しない。すぐに HTML を書き始める

# 技術的な制約
- 単一の HTML ファイルで完結させる。CSS は <style>、JavaScript は <script> にインラインで書く
- 外部 URL を一切参照しない（CDN、画像、フォント、スクリプトを含む）。画像や音が必要なら Canvas で描く
- fetch、XMLHttpRequest、WebSocket など通信する API を使わない
- localStorage、sessionStorage、IndexedDB、Cookie を使わない
- alert、confirm、prompt、フォーム送信を使わない
- 描画は <canvas> に行い、ゲームループは requestAnimationFrame で回す
- キーボードとタッチ（またはポインター）の両方で操作できるようにする

# ゲームの範囲
- 1 画面で完結するシンプルなアーケードゲームにする
- 画面にスコアを表示する
- ゲームオーバー後にリスタートできるようにする
- HTML 全体で 300 行以内に収める
- 画面の文言は利用者の指示と同じ言語で書く`;

// wrangler types は GENERATOR を本番値のリテラル "workers-ai" で生成するが、
// ローカルは .dev.vars で "stub" に上書きするので実行時の値は string として扱う
type GenerateBindings = Pick<Env, "AI"> & { GENERATOR: string };

// LLM 呼び出しはこのモジュールに閉じ込める。Claude API に差し替えるときはここだけを変える
export async function generateGameHtml(
	{ AI, GENERATOR }: GenerateBindings,
	prompt: string,
): Promise<string> {
	if (GENERATOR === "stub") return STUB_GAME_HTML;
	if (GENERATOR !== "workers-ai") {
		throw new Error(`Generator "${GENERATOR}" is not implemented`);
	}

	// Workers AI 呼び出しの例外（Neurons 上限、5xx など）はリトライせずそのまま投げる
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const result = await AI.run(
			MODEL,
			{
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: prompt },
				],
				max_completion_tokens: MAX_COMPLETION_TOKENS,
				chat_template_kwargs: { enable_thinking: false },
			},
			{ gateway: { id: "default" } },
		);
		const choice = result.choices[0];
		const html =
			choice?.finish_reason === "length"
				? null
				: extractGameHtml(choice?.message.content ?? "");
		if (html) return html;
		console.warn("Generated output was rejected", {
			attempt,
			finishReason: choice?.finish_reason,
		});
	}
	throw new Error(`Generation failed after ${MAX_ATTEMPTS} attempts`);
}
