import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "./db";
import { criarDiretor, criarFuncao, criarFuncionario, TERCA_FEIRA } from "./helpers";
import { calcularSaldoCredito } from "../lib/availability";

// Saldo total / reservado / disponível (spec seção 22) e a regra de correção
// de crédito como um novo lançamento, nunca um UPDATE destrutivo (seção 35).
describe("saldo de crédito", () => {
  beforeEach(resetDb);

  it("calcula total, reservado e disponível corretamente", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });
    const diretor = await criarDiretor();

    await prisma.leaveCreditTransaction.create({
      data: {
        employeeId: employee.id,
        creditType: "COMPENSATORIA",
        kind: "CONCESSAO",
        amount: 3,
        reason: "Feriado trabalhado",
        createdById: diretor.id,
      },
    });
    // Uma solicitação pendente reserva 1 crédito, mas ainda não é debitada do total.
    await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        jobFunctionId: funcao.id,
        type: "COMPENSATORIA",
        date: TERCA_FEIRA,
        status: "PENDENTE",
      },
    });

    const saldo = await calcularSaldoCredito(prisma, employee.id, "COMPENSATORIA");

    expect(saldo).toEqual({ total: 3, reservado: 1, disponivel: 2 });
  });

  it("uma correção cria um novo lançamento e não sobrescreve o original", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });
    const diretor = await criarDiretor();

    const original = await prisma.leaveCreditTransaction.create({
      data: {
        employeeId: employee.id,
        creditType: "COMPENSATORIA",
        kind: "CONCESSAO",
        amount: 1,
        reason: "Feriado trabalhado",
        createdById: diretor.id,
      },
    });

    // Mesma lógica de POST /api/credits/[id]/correct: cria um ajuste com o
    // delta, referenciando o lançamento original via correctsTransactionId.
    const correctedAmount = 2;
    const delta = correctedAmount - original.amount;
    await prisma.leaveCreditTransaction.create({
      data: {
        employeeId: original.employeeId,
        creditType: original.creditType,
        kind: "CORRECAO",
        amount: delta,
        reason: "Valor lançado errado",
        correctsTransactionId: original.id,
        createdById: diretor.id,
      },
    });

    const originalAposCorrecao = await prisma.leaveCreditTransaction.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(originalAposCorrecao.amount).toBe(1); // nunca é sobrescrito

    const saldo = await calcularSaldoCredito(prisma, employee.id, "COMPENSATORIA");
    expect(saldo.total).toBe(2); // 1 (original) + 1 (delta da correção)

    const lancamentos = await prisma.leaveCreditTransaction.findMany({
      where: { employeeId: employee.id },
    });
    expect(lancamentos).toHaveLength(2); // original preservado + novo ajuste
  });
});
