import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("games/:id", "routes/games.$id.tsx"),
	route("play/:id", "routes/play.$id.tsx"),
] satisfies RouteConfig;
