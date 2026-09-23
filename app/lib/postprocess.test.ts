import { describe, expect, it } from "vitest";
import { extractGameHtml } from "./postprocess";

const HTML = "<!DOCTYPE html>\n<html><body><canvas></canvas></body></html>";

describe("extractGameHtml", () => {
	it("DOCTYPE で始まる出力はそのまま返す", () => {
		expect(extractGameHtml(HTML)).toBe(HTML);
	});

	it("前後の空白を取り除く", () => {
		expect(extractGameHtml(`\n\n  ${HTML}\n  `)).toBe(HTML);
	});

	it("DOCTYPE の大文字小文字を問わない", () => {
		const html = "<!doctype html><title>lower</title>";
		expect(extractGameHtml(html)).toBe(html);
	});

	it("<think> ブロックを取り除く", () => {
		expect(
			extractGameHtml(`<think>\nまず設計を考える…\n</think>\n\n${HTML}`),
		).toBe(HTML);
	});

	it("コードフェンスの中身だけを取り出す", () => {
		expect(extractGameHtml(`\`\`\`html\n${HTML}\n\`\`\``)).toBe(HTML);
	});

	it("言語指定のないコードフェンスも取り出す", () => {
		expect(extractGameHtml(`\`\`\`\n${HTML}\n\`\`\``)).toBe(HTML);
	});

	it("<think> とコードフェンスが両方あっても取り出す", () => {
		expect(
			extractGameHtml(`<think>考え中</think>\n\`\`\`html\n${HTML}\n\`\`\`\n`),
		).toBe(HTML);
	});

	it("HTML の中にある <think> は取り除かない", () => {
		const html =
			"<!DOCTYPE html><script>const tag = '<think>x</think>';</script>";
		expect(extractGameHtml(html)).toBe(html);
	});

	it("HTML の中にある ``` をフェンスとして扱わない", () => {
		const html = "<!DOCTYPE html><pre>```js\nlet a = 1;\n```</pre>";
		expect(extractGameHtml(html)).toBe(html);
	});

	it("全体を囲むフェンスの中に ``` があっても最後のフェンスまでを取り出す", () => {
		const html = "<!DOCTYPE html><pre>```js\nlet a = 1;\n```</pre>";
		expect(extractGameHtml(`\`\`\`html\n${html}\n\`\`\``)).toBe(html);
	});

	it("フェンスの前に説明文があれば失敗にする", () => {
		expect(
			extractGameHtml(
				`こちらが生成したゲームです。\n\`\`\`html\n${HTML}\n\`\`\``,
			),
		).toBeNull();
	});

	it("フェンスの後に説明文があれば失敗にする", () => {
		expect(
			extractGameHtml(`\`\`\`html\n${HTML}\n\`\`\`\n楽しんでください。`),
		).toBeNull();
	});

	it("フェンスのない前置きの説明文があれば切り落とさず失敗にする", () => {
		expect(
			extractGameHtml(`こちらが生成したゲームです。\n\n${HTML}`),
		).toBeNull();
	});

	it("DOCTYPE がなければ失敗にする", () => {
		expect(
			extractGameHtml("<html><body><canvas></canvas></body></html>"),
		).toBeNull();
	});

	it("閉じていないコードフェンスは失敗にする", () => {
		expect(extractGameHtml(`\`\`\`html\n${HTML}`)).toBeNull();
	});

	it("空の出力は失敗にする", () => {
		expect(extractGameHtml("")).toBeNull();
	});
});
