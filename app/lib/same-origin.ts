// Access の CF_Authorization Cookie はクロスサイト POST にも付くので、
// 状態を変える action は Origin がリクエスト URL のオリジンと一致するときだけ受け付ける
// （docs/poc-plan.md「安全性」節）
export function isSameOriginRequest(request: Request): boolean {
	return request.headers.get("Origin") === new URL(request.url).origin;
}
