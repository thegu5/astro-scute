import { defineConfig } from "tsdown";

export default defineConfig({
	fixedExtension: false,
	entry: ["src/index.ts", "src/cli.ts"],
});
