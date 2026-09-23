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

export function generateGameHtml(generator: string): string {
	if (generator === "stub") return STUB_GAME_HTML;
	throw new Error(`Generator "${generator}" is not implemented`);
}
