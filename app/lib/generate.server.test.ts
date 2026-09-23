import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateGameHtml } from "./generate.server";

const HTML = "<!DOCTYPE html><title>generated</title>";

type FakeOutput = { content: string; finish_reason?: "stop" | "length" };

function fakeAi(...outputs: FakeOutput[]) {
	const run = vi.fn();
	for (const { content, finish_reason = "stop" } of outputs) {
		run.mockResolvedValueOnce({
			choices: [
				{
					index: 0,
					message: { role: "assistant", content, refusal: null },
					finish_reason,
					logprobs: null,
				},
			],
		});
	}
	return { AI: { run } as unknown as Ai, run };
}

beforeEach(() => {
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("generateGameHtml", () => {
	it("stub では Workers AI を呼ばずに固定 HTML を返す", async () => {
		const { AI, run } = fakeAi();

		const html = await generateGameHtml({ AI, GENERATOR: "stub" }, "星");

		expect(html).toMatch(/^<!DOCTYPE html>/);
		expect(run).not.toHaveBeenCalled();
	});

	it("未知の GENERATOR はエラーになる", async () => {
		const { AI, run } = fakeAi();

		await expect(
			generateGameHtml({ AI, GENERATOR: "unknown" }, "星"),
		).rejects.toThrow('Generator "unknown" is not implemented');
		expect(run).not.toHaveBeenCalled();
	});

	it("workers-ai では思考を抑制し AI Gateway 経由で呼び、後処理した HTML を返す", async () => {
		const { AI, run } = fakeAi({ content: `\`\`\`html\n${HTML}\n\`\`\`` });

		const html = await generateGameHtml(
			{ AI, GENERATOR: "workers-ai" },
			"星を集めるゲーム",
		);

		expect(html).toBe(HTML);
		expect(run).toHaveBeenCalledOnce();
		const [model, input, options] = run.mock.calls[0];
		expect(model).toBe("@cf/zai-org/glm-4.7-flash");
		expect(input.messages).toEqual([
			{ role: "system", content: expect.stringContaining("<!DOCTYPE html>") },
			{ role: "user", content: "星を集めるゲーム" },
		]);
		expect(input.chat_template_kwargs).toEqual({ enable_thinking: false });
		expect(input.max_completion_tokens).toBeGreaterThan(0);
		expect(options).toEqual({ gateway: { id: "default" } });
	});

	it("1 回目の出力が不正なら 1 回だけリトライする", async () => {
		const { AI, run } = fakeAi(
			{ content: `こちらがゲームです。\n${HTML}` },
			{ content: HTML },
		);

		await expect(
			generateGameHtml({ AI, GENERATOR: "workers-ai" }, "星"),
		).resolves.toBe(HTML);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("1 回目の出力が途中で切れていたらリトライする", async () => {
		const { AI, run } = fakeAi(
			{ content: "<!DOCTYPE html><title>trunc", finish_reason: "length" },
			{ content: HTML },
		);

		await expect(
			generateGameHtml({ AI, GENERATOR: "workers-ai" }, "星"),
		).resolves.toBe(HTML);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("2 回とも不正ならエラーになる", async () => {
		const { AI, run } = fakeAi(
			{ content: "ゲームを作れませんでした。" },
			{ content: HTML, finish_reason: "length" },
		);

		await expect(
			generateGameHtml({ AI, GENERATOR: "workers-ai" }, "星"),
		).rejects.toThrow("Generation failed after 2 attempts");
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("Workers AI 呼び出しの例外はリトライせずそのまま投げる", async () => {
		const run = vi.fn().mockRejectedValue(new Error("Neurons limit"));
		const AI = { run } as unknown as Ai;

		await expect(
			generateGameHtml({ AI, GENERATOR: "workers-ai" }, "星"),
		).rejects.toThrow("Neurons limit");
		expect(run).toHaveBeenCalledOnce();
	});
});
