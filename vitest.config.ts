import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Todos os arquivos de teste compartilham o mesmo banco de teste, então
    // rodá-los em paralelo causaria corrida entre eles.
    fileParallelism: false,
  },
});
