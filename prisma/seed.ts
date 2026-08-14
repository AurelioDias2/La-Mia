import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME ?? "Lamia";
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD não definida no .env. A senha do Diretor nunca deve ficar no código (seção 43)."
    );
  }

  const passwordHash = await hashPassword(adminPassword);

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      role: "DIRETOR_ADMIN",
      status: "ATIVO",
    },
  });
  console.log(`Conta do Diretor "${adminUsername}" garantida.`);

  // Funções iniciais (seção 5) + Produção (setor adicionado depois, fora da
  // especificação original — mesmas regras de domingo do mês, sem fechamento
  // extra definido ainda; a Direção pode configurar um dia de fechamento só
  // pra essa função na tela "Funções" quando decidirem).
  const initialFunctions = ["Forno/Assamento", "Ensacamento", "Montagem de pedidos/Nota", "Produção"];
  for (const name of initialFunctions) {
    await prisma.jobFunction.upsert({
      where: { name },
      update: {},
      create: { name, active: true, dailyLeaveLimit: 1 },
    });
  }
  console.log("Funções iniciais garantidas.");

  // Configurações padrão (seção 48).
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      fixedClosedWeekday: 1, // segunda-feira
      requestsRequireApproval: true,
      pendingRequestHoldsSlot: true,
    },
  });
  console.log("Configurações padrão garantidas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
