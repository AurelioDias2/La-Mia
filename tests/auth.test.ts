import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password";

// Senhas nunca ficam em texto puro (spec seção 43) — usamos Argon2id em todo
// o app (registro, seed do Diretor, redefinição de senha), via hash-wasm
// (WebAssembly) para não depender de binário nativo compilado.
describe("hash de senha (Argon2id)", () => {
  it("aceita a senha correta depois do hash", async () => {
    const hash = await hashPassword("minha-senha-forte");
    await expect(verifyPassword(hash, "minha-senha-forte")).resolves.toBe(true);
  });

  it("rejeita uma senha incorreta", async () => {
    const hash = await hashPassword("minha-senha-forte");
    await expect(verifyPassword(hash, "senha-errada")).resolves.toBe(false);
  });
});
