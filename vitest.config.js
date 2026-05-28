import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{js,jsx}", "packages/**/*.test.{js,jsx}"],
    environment: "node",
  },
});
