const THINK_BLOCK = /<think>[\s\S]*?<\/think>/gi;
const CODE_FENCE = /```[^\n`]*\n([\s\S]*?)```/;
const DOCTYPE = /^<!DOCTYPE/i;

// LLM の出力から単一 HTML を取り出す。取り出せなければ null。
// 前置きの説明文は切り落とさず失敗にする（CPU 10ms 制約のため正規表現だけで処理する）
export function extractGameHtml(output: string): string | null {
	let html = output.trim().replace(THINK_BLOCK, "").trim();
	const fenced = CODE_FENCE.exec(html);
	if (fenced) html = fenced[1].trim();
	return DOCTYPE.test(html) ? html : null;
}
