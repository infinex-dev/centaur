import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-eval/**",
      "**/out/**",
      "**/.next/**",
      "**/.claude/**",
      "**/coverage/**",
    ],
  },
});
