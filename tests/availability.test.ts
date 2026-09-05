import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "./db";
import {
  criarFuncao,
  criarFuncionario,
  garantirSettings,
  garantirFechamentoSetor,
  DOMINGO,
  PROXIMO_DOMINGO,
  SEGUNDA_FEIRA,
  TERCA_FEIRA,
  QUARTA_FEIRA,
} from "./helpers";
import { verificarDisponibilidade } from "../lib/availability";

// verificarDisponibilidade é a função central única (spec seção 39) — todas
// as rotas passam por ela antes de aceitar uma solicitação. Estes testes
// cobrem cada código de motivo que ela pode devolver.
describe("verificarDisponibilidade", () => {
  beforeEach(async () => {
    await resetDb();
    await garantirSettings();
    await garantirFechamentoSetor(); // Pronta Entrega fecha segunda, por padrão
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

  it("fechamento fixo é independente por setor — um setor não bloqueia o dia do outro", async () => {
    await garantirFechamentoSetor("Pronta Entrega", 1); // segunda
    await garantirFechamentoSetor("Serviços Gerais", 3); // quarta

    const funcaoPE = await criarFuncao({ sector: "Pronta Entrega" });
    const funcaoSG = await criarFuncao({ sector: "Serviços Gerais" });
    const { employee: empPE } = await criarFuncionario({ jobFunctionId: funcaoPE.id });
    const { employee: empSG } = await criarFuncionario({ jobFunctionId: funcaoSG.id });

    // Pronta Entrega fecha segunda — Serviços Gerais não é afetado por isso
    // (usa DOMINGO_MES pra não esbarrar na checagem de saldo de crédito).
    const resultSG_segunda = await verificarDisponibilidade(prisma, {
      employeeId: empSG.id,
      jobFunctionId: funcaoSG.id,
      date: SEGUNDA_FEIRA,
      type: "DOMINGO_MES",
    });
    expect(resultSG_segunda.motivo).not.toBe("LOJA_FECHADA");

    // Serviços Gerais fecha quarta — Pronta Entrega não é afetado por isso.
    const resultPE_quarta = await verificarDisponibilidade(prisma, {
      employeeId: empPE.id,
      jobFunctionId: funcaoPE.id,
      date: QUARTA_FEIRA,
      type: "DOMINGO_MES",
    });
    expect(resultPE_quarta.motivo).not.toBe("LOJA_FECHADA");

    // Mas cada um é bloqueado no seu próprio dia.
    const resultPE_segunda = await verificarDisponibilidade(prisma, {
      employeeId: empPE.id,
      jobFunctionId: funcaoPE.id,
      date: SEGUNDA_FEIRA,
      type: "COMPENSATORIA",
    });
    expect(resultPE_segunda.motivo).toBe("LOJA_FECHADA");

    const resultSG_quarta = await verificarDisponibilidade(prisma, {
      employeeId: empSG.id,
      jobFunctionId: funcaoSG.id,
      date: QUARTA_FEIRA,
      type: "COMPENSATORIA",
    });
    expect(resultSG_quarta.motivo).toBe("LOJA_FECHADA");
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

  it("permite mais de uma pessoa da mesma função escolher o mesmo domingo do mês", async () => {
    const funcao = await criarFuncao({ dailyLeaveLimit: 1 });
    const { employee: ocupante } = await criarFuncionario({ jobFunctionId: funcao.id });
    const { employee: segundo } = await criarFuncionario({ jobFunctionId: funcao.id });
    await prisma.leaveRequest.create({
      data: {
        employeeId: ocupante.id,
        jobFunctionId: funcao.id,
        type: "DOMINGO_MES",
        date: DOMINGO,
        status: "APROVADA",
      },
    });

    // A Direção decide na hora de aprovar, não a checagem automática —
    // o limite diário da função não vale para domingo do mês.
    const result = await verificarDisponibilidade(prisma, {
      employeeId: segundo.id,
      jobFunctionId: funcao.id,
      date: DOMINGO,
      type: "DOMINGO_MES",
    });

    expect(result.disponivel).toBe(true);
    expect(result.motivo).toBe("DISPONIVEL");
  });

  it("recusa compensatória em dias de alta demanda (sexta, sábado, domingo)", async () => {
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });
    const sextaFeira = new Date(Date.UTC(2026, 7, 21)); // 21/08/2026 é sexta

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: sextaFeira,
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("DIA_ALTA_DEMANDA");
  });

  it("recusa autoatendimento de compensatória quando a Direção desativa (Settings)", async () => {
    await garantirSettings({ allowSelfServiceCompensatoria: false });
    const funcao = await criarFuncao();
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: TERCA_FEIRA,
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("AUTOATENDIMENTO_DESATIVADO");
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

  it("permite pedir folga no dia de fechamento geral quando a função é isenta (ex: Produção na segunda)", async () => {
    const funcao = await criarFuncao({ followsStoreClosure: false });
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: SEGUNDA_FEIRA, // fechamento geral da loja, mas esta função é isenta
      type: "COMPENSATORIA",
    });

    // Não deve ser recusado por LOJA_FECHADA — outros motivos (ex: sem
    // crédito) ainda podem se aplicar, mas o fechamento geral não conta.
    expect(result.motivo).not.toBe("LOJA_FECHADA");
  });

  it("retorna FUNCAO_FECHADA_NO_DIA quando a função tem fechamento próprio nesse dia da semana", async () => {
    // Setores diferentes podem ter fechamentos diferentes entre si (ex:
    // Produção fechada às terças, sem afetar a Pronta Entrega).
    const funcao = await criarFuncao({ closedWeekday: 2 }); // 2 = terça-feira
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id });

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: TERCA_FEIRA,
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("FUNCAO_FECHADA_NO_DIA");
  });

  it("retorna FOLGA_SEMANAL_FIXA quando a data cai no dia de folga semanal fixo do funcionário", async () => {
    // Ex: escala de Produção/Serviços Gerais definida pela Direção.
    const funcao = await criarFuncao({ followsStoreClosure: false });
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id, weeklyDayOff: 2 }); // terça

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: TERCA_FEIRA,
      type: "COMPENSATORIA",
    });

    expect(result.disponivel).toBe(false);
    expect(result.motivo).toBe("FOLGA_SEMANAL_FIXA");
  });

  it("não bloqueia por folga semanal fixa em dias diferentes do dia definido", async () => {
    const funcao = await criarFuncao({ followsStoreClosure: false });
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id, weeklyDayOff: 2 }); // terça

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: DOMINGO,
      type: "DOMINGO_MES",
    });

    expect(result).toEqual({ disponivel: true, motivo: "DISPONIVEL", mensagem: "Disponível." });
  });

  it("não bloqueia domingo do mês mesmo quando a folga semanal fixa da pessoa é domingo", async () => {
    // Bug real: quem folga toda semana no domingo não conseguia escolher o
    // domingo do mês, porque a folga semanal "engolia" o domingo do mês —
    // são direitos separados, todo funcionário tem direito aos dois.
    const funcao = await criarFuncao({ followsStoreClosure: false });
    const { employee } = await criarFuncionario({ jobFunctionId: funcao.id, weeklyDayOff: 0 }); // domingo

    const result = await verificarDisponibilidade(prisma, {
      employeeId: employee.id,
      jobFunctionId: funcao.id,
      date: DOMINGO,
      type: "DOMINGO_MES",
    });

    expect(result).toEqual({ disponivel: true, motivo: "DISPONIVEL", mensagem: "Disponível." });
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
