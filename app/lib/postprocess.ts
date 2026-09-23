// 推論ブロックとフェンスは出力の先頭・全体を囲む位置だけを対象にする。
// HTML の本文や JS 文字列に <think> や ``` が含まれても壊さないため
const LEADING_THINK = /^<think>[\s\S]*?<\/think>/i;
const WRAPPING_FENCE = /^```[^\n`]*\n([\s\S]*)```$/;
const DOCTYPE = /^<!DOCTYPE/i;

// LLM の出力から単一 HTML を取り出す。取り出せなければ null。
// 前置きの説明文は切り落とさず失敗にする（CPU 10ms 制約のため正規表現だけで処理する）
export function extractGameHtml(output: string): string | null {
	let html = output.trim().replace(LEADING_THINK, "").trim();
	const fenced = WRAPPING_FENCE.exec(html);
	if (fenced) html = fenced[1].trim();
	return DOCTYPE.test(html) ? html : null;
}
