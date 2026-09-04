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
  //
  // Produção trabalha todos os dias, inclusive na segunda-feira de
  // fechamento fixo da loja (só a Pronta Entrega não trabalha nesse dia) —
  // por isso followsStoreClosure: false só pra ela.
  const initialFunctions: { name: string; sector: string; followsStoreClosure: boolean }[] = [
    { name: "Atendimento", sector: "Pronta Entrega", followsStoreClosure: true },
    { name: "Cafeteria", sector: "Pronta Entrega", followsStoreClosure: true },
    { name: "Delivery", sector: "Pronta Entrega", followsStoreClosure: true },
    { name: "Ensacamento", sector: "Pronta Entrega", followsStoreClosure: true },
    { name: "Forno/Assamento", sector: "Pronta Entrega", followsStoreClosure: true },
    { name: "Montagem de pedidos/Nota", sector: "Pronta Entrega", followsStoreClosure: true },
    { name: "Produção", sector: "Produção", followsStoreClosure: false },
    { name: "Serviços Gerais", sector: "Serviços Gerais", followsStoreClosure: true },
  ];
  for (const { name, sector, followsStoreClosure } of initialFunctions) {
    await prisma.jobFunction.upsert({
      where: { name },
      update: {},
      create: { name, sector, active: true, dailyLeaveLimit: 1, followsStoreClosure },
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
