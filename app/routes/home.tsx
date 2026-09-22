import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [{ title: "AI Game POC" }];

export default function Home() {
	return <main />;
}
