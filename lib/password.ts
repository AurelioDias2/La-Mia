import { randomBytes } from "crypto";
import { argon2id, argon2Verify } from "hash-wasm";

// Argon2id via WebAssembly (hash-wasm), sem dependência de binário nativo —
// o pacote `argon2` (native) não tinha build disponível no runtime serverless
// da Vercel, independente da versão do Node configurada. Parâmetros seguem a
// recomendação mínima da OWASP para argon2id.
const ITERATIONS = 3;
const PARALLELISM = 1;
const MEMORY_SIZE_KIB = 19456;
const HASH_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return argon2id({
    password,
    salt,
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    memorySize: MEMORY_SIZE_KIB,
    hashLength: HASH_LENGTH,
    outputType: "encoded",
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2Verify({ password, hash });
}
