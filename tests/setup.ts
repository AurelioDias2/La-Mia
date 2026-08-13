import { config } from "dotenv";

// Precisa rodar antes de qualquer import de `@prisma/client` (tests/db.ts),
// para que o PrismaClient seja criado apontando para o banco de teste, nunca
// para o banco de desenvolvimento.
config({ path: ".env.test" });

if (!process.env.DATABASE_URL?.includes("lamia_dolce_vita_test")) {
  throw new Error(
    "DATABASE_URL não aponta para o banco de teste (lamia_dolce_vita_test). " +
      "Abortando para não rodar testes destrutivos contra outro banco."
  );
}
