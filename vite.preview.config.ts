// Design preview: renders the real UI in a normal browser with sample notes,
// by swapping the Electrobun RPC module for a mock. Run: bunx vite -c vite.preview.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
	plugins: [react()],
	root: "src/mainview",
	resolve: {
		alias: [{ find: /^\.\/rpc$/, replacement: fileURLToPath(new URL("./src/preview/rpc.mock.ts", import.meta.url)) }],
	},
	server: { port: 5174, strictPort: true },
});
