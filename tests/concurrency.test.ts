import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma, resetDb } from "./db";
import { criarFuncao, criarFuncionario, garantirSettings, TERCA_FEIRA } from "./helpers";
import { verificarDisponibilidade } from "../lib/availability";

/**
 * Reproduz a mesma transação de app/api/leave-requests/route.ts: verifica
 * disponibilidade DE NOVO dentro de uma transação Serializable e só então
 * cria a solicitação (spec seção 41).
 */
async function solicitar(employeeId: string, jobFunctionId: string, date: Date) {
  return prisma.$transaction(
    async (tx) => {
      const check = await verificarDisponibilidade(tx, {
        employeeId,
        jobFunctionId,
        date,
        type: "COMPENSATORIA",
      });
      if (!check.disponivel) {
        throw new Error(check.motivo);
      }
      return tx.leaveRequest.create({
        data: { employeeId, jobFunctionId, date, type: "COMPENSATORIA", status: "PENDENTE" },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

async function darCredito(employeeId: string) {
  await prisma.leaveCreditTransaction.create({
    data: {
      employeeId,
      creditType: "COMPENSATORIA",
      kind: "CONCESSAO",
      amount: 1,
      reason: "Setup de teste",
      createdById: "sistema-teste",
    },
  });
}

// Duas pessoas da mesma função pedindo a mesma data ao mesmo tempo: só uma
// pode vencer, mesmo que ambas tenham passado pela checagem de disponibilidade
// no mesmo instante (spec seção 41 — trava de concorrência via Serializable).
describe("concorrência entre solicitações", () => {
  beforeEach(async () => {
    await resetDb();
    await garantirSettings();
  });

  it("aceita só uma solicitação quando duas chegam simultaneamente para a mesma vaga", async () => {
    const funcao = await criarFuncao({ dailyLeaveLimit: 1 });
    const { employee: funcionarioA } = await criarFuncionario({ jobFunctionId: funcao.id });
    const { employee: funcionarioB } = await criarFuncionario({ jobFunctionId: funcao.id });
    await darCredito(funcionarioA.id);
    await darCredito(funcionarioB.id);

    const resultados = await Promise.allSettled([
      solicitar(funcionarioA.id, funcao.id, TERCA_FEIRA),
      solicitar(funcionarioB.id, funcao.id, TERCA_FEIRA),
    ]);

    const sucesso = resultados.filter((r) => r.status === "fulfilled");
    const falha = resultados.filter((r) => r.status === "rejected");
    expect(sucesso).toHaveLength(1);
    expect(falha).toHaveLength(1);

    const solicitacoesNaData = await prisma.leaveRequest.findMany({
      where: { jobFunctionId: funcao.id, date: TERCA_FEIRA, status: { in: ["PENDENTE", "APROVADA"] } },
    });
    expect(solicitacoesNaData).toHaveLength(1);
  });
});
