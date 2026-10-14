import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      "server/test/**/*.test.js",
      "client/src/**/*.test.jsx",
      "shared/**/*.test.js",
    ],
    testTimeout: 20000,
    hookTimeout: 20000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "lifeline-test-secret-with-more-than-thirty-two-characters",
      DEMO_MODE: "true",
    },
    fileParallelism: false,
  },
});
