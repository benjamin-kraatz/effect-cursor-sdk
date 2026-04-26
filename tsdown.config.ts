import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  dts: true,
  sourcemap: true,
  clean: true,
  // Emit `.js` to match `package.json` exports (`"type": "module"`).
  fixedExtension: false,
});
