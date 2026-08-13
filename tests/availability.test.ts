import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "./db";
import {
  criarFuncao,
  criarFuncionario,
  garantirSettings,
  DOMINGO,
  PROXIMO_DOMINGO,
  SEGUNDA_FEIRA,
  TERCA_FEIRA,
} from "./helpers";
import { verificarDisponibilidade } from "../lib/availability";

// verificarDisponibilidade é a função central única (spec seção 39) — todas
// as rotas passam por ela antes de aceitar uma solicitação. Estes testes
// cobrem cada código de motivo que ela pode devolver.
describe("verificarDisponibilidade", () => {
  beforeEach(async () => {
    await resetDb();
    await garantirSettings();
  });

  it("retorna DISPONIVEL quando tudo está em ordem", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: DOMINGO,
      type: "DOMINGO_MES",
    });

    expect(result).toEqual({ disponivel: true, motivo: "DISPONIVEL", mensagem: "Disponível." });
  });

  it("retorna LOJA_FECHADA no dia de fechamento semanal fixo", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: SEGUNDA_FEIRA, // fixedClosedWeekday padrão = 1 (segunda)
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("LOJA_FECHADA");
  });

  it("retorna DIA_INVALIDO quando o tipo é DOMINGO_MES mas a data não é domingo", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: TERCA_FEIRA,
      type: "DOMINGO_MES",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("DIA_INVALIDO");
  });

  it("retorna DATA_BLOQUEADA quando a data foi bloqueada administrativamente", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });
    const diretor = await prisma.user.create({
      data: { username: `d-${Date.now()}`, passwordHash: "x", role: "DIRETOR_ADMIN" },
    });
    await prisma.blockedDate.create({
      data: { date: TERCA_FEIRA, reason: "Reforma na loja", createdById: diretor.id },
    });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: TERCA_FEIRA,
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("DATA_BLOQUEADA");
  });

  it("retorna SOLICITACAO_EXISTENTE quando o funcionário já tem pedido na mesma data", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });
    await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        jobFunctionId: funcao.id,
        type: "DOMINGO_MES",
        date: DOMINGO,
        status: "PENDENTE",
      },
    });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: DOMINGO,
      type: "DOMINGO_MES",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("SOLICITACAO_EXISTENTE");
  });

  it("retorna DOMINGO_JA_UTILIZADO quando já há um domingo pedido no mesmo mês", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });
    await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        jobFunctionId: funcao.id,
        type: "DOMINGO_MES",
        date: DOMINGO,
        status: "APROVADA",
      },
    });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: PROXIMO_DOMINGO, // mesmo mês, outro domingo
      type: "DOMINGO_MES",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("DOMINGO_JA_UTILIZADO");
  });

  it("retorna CONFLITO_FUNCAO quando o limite diário da função já foi atingido", async () => {
    const funcao = await criarFuncao({ dailyLeaveLimit: 1 });
    const { employee: ocupante } = await criarFuncionario({ jobFunctionId: funcao.id });
    const { employee: segundo } = await criarFuncionario({ jobFunctionId: funcao.id });
    await prisma.leaveRequest.create({
      data: {
        employeeId: ocupante.id,
        jobFunctionId: funcao.id,
        type: "COMPENSATORIA",
        date: TERCA_FEIRA,
        status: "PENDENTE",
      },
    });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: segundo.id,
      jobFunctionId: funcao.id,
      date: TERCA_FEIRA,
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("CONFLITO_FUNCAO");
  });

  it("retorna SEM_CREDITO quando o saldo disponível de compensatória é zero", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: TERCA_FEIRA,
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("SEM_CREDITO");
  });

  it("retorna FUNCIONARIO_INATIVO quando o funcionário não está ativo", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id, status: "INATIVO" });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: TERCA_FEIRA,
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("FUNCIONARIO_INATIVO");
  });
});
