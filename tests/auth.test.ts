import { describe, expect, it } from "vitest";
import argon2 from "argon2";

// Senhas nunca ficam em texto puro (spec seção 43) — usamos Argon2id em todo
// o app (registro, seed do Diretor, redefinição de senha).
describe("hash de senha (Argon2id)", () => {
  it("aceita a senha correta depois do hash", async () => {
    const hash = await argon2.hash("minha-senha-forte", { type: argon2.argon2id });
    await expect(argon2.verify(hash, "minha-senha-forte")).resolves.toBe(true);
  });

  it("rejeita uma senha incorreta", async () => {
    const hash = await argon2.hash("minha-senha-forte", { type: argon2.argon2id });
    await expect(argon2.verify(hash, "senha-errada")).resolves.toBe(false);
  });
});
