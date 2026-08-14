import { prisma } from "./db";
import { hashPassword } from "../lib/password";

export async function criarDiretor() {
  return prisma.user.create({
    data: {
      username: `diretor-${Date.now()}-${Math.random()}`,
      passwordHash: await hashPassword("senha-diretor"),
      role: "DIRETOR_ADMIN",
      status: "ATIVO",
    },
  });
}

export async function criarFuncao(
  overrides: Partial<{ name: string; dailyLeaveLimit: number; closedWeekday: number | null }> = {}
) {
  return prisma.jobFunction.create({
    data: {
      name: overrides.name ?? `Funcao-${Date.now()}-${Math.random()}`,
      dailyLeaveLimit: overrides.dailyLeaveLimit ?? 1,
      closedWeekday: overrides.closedWeekday ?? null,
    },
  });
}

export async function criarFuncionario(params: {
  jobFunctionId: string;
  status?: "PENDENTE" | "ATIVO" | "INATIVO" | "RECUSADO";
}) {
  const user = await prisma.user.create({
    data: {
      username: `func-${Date.now()}-${Math.random()}`,
      passwordHash: await hashPassword("senha-funcionario"),
      role: "FUNCIONARIO",
      status: params.status ?? "ATIVO",
    },
  });
  const employee = await prisma.employee.create({
    data: {
      userId: user.id,
      fullName: "Funcionária de Teste",
      whatsapp: "(98) 90000-0000",
      status: params.status ?? "ATIVO",
      functions: {
        create: { jobFunctionId: params.jobFunctionId, role: "PRINCIPAL" },
      },
    },
  });
  return { user, employee };
}

export async function garantirSettings(overrides: Partial<{
  fixedClosedWeekday: number;
  requestsRequireApproval: boolean;
  pendingRequestHoldsSlot: boolean;
}> = {}) {
  return prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...overrides },
    update: overrides,
  });
}

/** Uma data de segunda-feira fixa e distante, só para os testes terem uma referência estável. */
export const SEGUNDA_FEIRA = new Date(Date.UTC(2026, 7, 17)); // 17/08/2026 é segunda
export const TERCA_FEIRA = new Date(Date.UTC(2026, 7, 18));
export const QUARTA_FEIRA = new Date(Date.UTC(2026, 7, 19));
export const DOMINGO = new Date(Date.UTC(2026, 7, 16)); // 16/08/2026 é domingo
export const PROXIMO_DOMINGO = new Date(Date.UTC(2026, 7, 23));
