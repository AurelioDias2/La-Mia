import { Prisma, PrismaClient, LeaveType, UserStatus } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

// Códigos de motivo — espelham exatamente a lista da seção 39 da especificação.
export type AvailabilityReasonCode =
  | "DISPONIVEL"
  | "LOJA_FECHADA"
  | "DATA_BLOQUEADA"
  | "CONFLITO_FUNCAO"
  | "SEM_CREDITO"
  | "DOMINGO_JA_UTILIZADO"
  | "DIA_INVALIDO"
  | "FUNCIONARIO_INATIVO"
  | "SOLICITACAO_EXISTENTE"
  | "FUNCAO_FECHADA_NO_DIA"
  | "DIA_ALTA_DEMANDA"
  | "FOLGA_SEMANAL_FIXA"
  | "AUTOATENDIMENTO_DESATIVADO";

// Dias de alta demanda em que compensatória não pode ser usada (0=domingo,
// 5=sexta, 6=sábado). Sextas e fins de semana são os dias de maior movimento
// da padaria — a compensatória concedida pela Direção não pode "esvaziar" a
// equipe justamente nesses dias.
const DIAS_ALTA_DEMANDA_COMPENSATORIA = [0, 5, 6];

export interface AvailabilityResult {
  disponivel: boolean;
  motivo: AvailabilityReasonCode;
  mensagem: string;
}

function ok(): AvailabilityResult {
  return { disponivel: true, motivo: "DISPONIVEL", mensagem: "Disponível." };
}
function fail(motivo: AvailabilityReasonCode, mensagem: string): AvailabilityResult {
  return { disponivel: false, motivo, mensagem };
}

/** Normaliza para meia-noite UTC, pois só a data importa (sem hora). */
function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * verificarDisponibilidade — função central única (spec seção 39).
 *
 * TODAS as telas e endpoints devem passar por aqui. O frontend nunca decide
 * disponibilidade sozinho (seção 40); esta função é chamada de novo, dentro
 * de uma transação com lock, no momento exato do SOLICITAR (seção 41),
 * porque o estado pode ter mudado segundos antes.
 */
export async function verificarDisponibilidade(
  tx: TxClient,
  params: {
    employeeId: string;
    jobFunctionId: string;
    date: Date;
    type: LeaveType;
  }
): Promise<AvailabilityResult> {
  const data = toDateOnly(params.date);

  // 1. Funcionário ativo?
  const employee = await tx.employee.findUnique({ where: { id: params.employeeId } });
  if (!employee || employee.status !== UserStatus.ATIVO) {
    return fail("FUNCIONARIO_INATIVO", "Este funcionário não está ativo no sistema.");
  }

  const jobFunction = await tx.jobFunction.findUnique({ where: { id: params.jobFunctionId } });
  if (!jobFunction || !jobFunction.active) {
    return fail("DIA_INVALIDO", "Função inválida.");
  }

  // 2. Dia válido — fechamento fixo é por SETOR agora (cada setor pode ter
  // seu próprio dia, ou nenhum). Só vale para funções que realmente não
  // trabalham nesse dia (jobFunction.followsStoreClosure) — algumas, como
  // Produção, seguem trabalhando mesmo com o setor fechado pro público.
  const settings = await tx.settings.findUnique({ where: { id: 1 } });
  const sectorClosedWeekday = await tx.sectorClosedWeekday.findUnique({ where: { sector: jobFunction.sector } });
  if (
    jobFunction.followsStoreClosure &&
    sectorClosedWeekday?.closedWeekday !== null &&
    sectorClosedWeekday?.closedWeekday !== undefined &&
    data.getUTCDay() === sectorClosedWeekday.closedWeekday
  ) {
    return fail("LOJA_FECHADA", "Esse setor não abre nesse dia da semana (fechamento fixo).");
  }

  // 2.1. Fechamento adicional específico da função (setores diferentes podem
  // ter dias de fechamento diferentes — ex: Produção x Pronta Entrega).
  if (jobFunction.closedWeekday !== null && data.getUTCDay() === jobFunction.closedWeekday) {
    return fail("FUNCAO_FECHADA_NO_DIA", "Sua função não abre folgas nesse dia da semana.");
  }

  // 2.1.1. Folga semanal fixa da pessoa (definida só pela Direção — ex:
  // escala de Produção/Serviços Gerais). É estrutural, igual ao fechamento
  // de função: nesse dia ela já não trabalha, não faz sentido pedir
  // compensatória/extra nele. NÃO vale pra domingo do mês (nem pro seu
  // substituto) — é um direito à parte, todo funcionário tem direito a ele
  // independente da folga semanal.
  if (
    params.type !== LeaveType.DOMINGO_MES &&
    params.type !== LeaveType.DOMINGO_MES_SUBSTITUTO &&
    employee.weeklyDayOff !== null &&
    data.getUTCDay() === employee.weeklyDayOff
  ) {
    return fail("FOLGA_SEMANAL_FIXA", "Você já folga nesse dia da semana toda semana.");
  }

  // 2.1.2. Autoatendimento de compensatória pode ser desligado pela Direção
  // (Settings.allowSelfServiceCompensatoria) — nesse caso só ela decide o
  // dia (manualmente ou pelo sorteio). Não afeta domingo do mês nem extra.
  if (params.type === LeaveType.COMPENSATORIA && settings?.allowSelfServiceCompensatoria === false) {
    return fail(
      "AUTOATENDIMENTO_DESATIVADO",
      "No momento só a Direção define o dia da compensatória. Fale com ela."
    );
  }

  // 2.2. Compensatória não pode ser usada em sexta/sábado/domingo — são os
  // dias de maior movimento da loja.
  if (params.type === LeaveType.COMPENSATORIA && DIAS_ALTA_DEMANDA_COMPENSATORIA.includes(data.getUTCDay())) {
    return fail(
      "DIA_ALTA_DEMANDA",
      "Compensatória não pode ser usada às sextas, sábados ou domingos (dias de alta demanda)."
    );
  }

  // Para DOMINGO_MES, a data escolhida precisa realmente ser domingo — e só
  // faz sentido pra quem trabalha aos domingos normalmente. Quem já folga
  // toda semana no domingo (weeklyDayOff = 0) usa DOMINGO_MES_SUBSTITUTO no
  // lugar (ver abaixo), então nem entra como opção pra ela.
  if (params.type === LeaveType.DOMINGO_MES) {
    if (employee.weeklyDayOff === 0) {
      return fail(
        "DIA_INVALIDO",
        "Você já folga aos domingos toda semana — seu domingo do mês agora é um dia de semana."
      );
    }
    if (data.getUTCDay() !== 0) {
      return fail("DIA_INVALIDO", "A data escolhida não é um domingo.");
    }
  }

  // DOMINGO_MES_SUBSTITUTO: existe só pra quem já folga toda semana no
  // domingo. Pra esse grupo, o direito ao "domingo do mês" vira 1 dia de
  // semana (segunda a sábado) no mês — nunca um domingo de verdade, porque
  // domingo já é a folga semanal normal dela.
  if (params.type === LeaveType.DOMINGO_MES_SUBSTITUTO) {
    if (employee.weeklyDayOff !== 0) {
      return fail(
        "DIA_INVALIDO",
        "Esse tipo de folga é só pra quem folga aos domingos toda semana."
      );
    }
    if (data.getUTCDay() === 0) {
      return fail(
        "DIA_INVALIDO",
        "Escolha um dia de segunda a sábado — domingo já é sua folga semanal."
      );
    }
  }

  // 3. Feriado com loja fechada conta como dia inválido para solicitar.
  const holiday = await tx.holiday.findFirst({
    where: { date: data, active: true },
  });
  if (holiday && holiday.storeOpen === "FECHADA") {
    return fail("LOJA_FECHADA", `Loja fechada neste dia (${holiday.name}).`);
  }

  // 4. Data bloqueada administrativamente (seção 27)?
  const blocked = await tx.blockedDate.findFirst({
    where: { date: data, removedAt: null },
  });
  if (blocked) {
    return fail("DATA_BLOQUEADA", "Esta data está indisponível.");
  }

  // 5. Já existe solicitação (pendente ou aprovada) do próprio funcionário
  //    para essa mesma data?
  const ownExisting = await tx.leaveRequest.findFirst({
    where: {
      employeeId: params.employeeId,
      date: data,
      status: { in: ["PENDENTE", "APROVADA"] },
    },
  });
  if (ownExisting) {
    return fail("SOLICITACAO_EXISTENTE", "Você já possui uma solicitação para esta data.");
  }

  // 6. Regra do domingo do mês: só um por mês por funcionário (pendente ou
  //    aprovado já conta) — seção 13.3. Vale junto pro substituto: são o
  //    mesmo direito, só entregue de formas diferentes.
  if (params.type === LeaveType.DOMINGO_MES || params.type === LeaveType.DOMINGO_MES_SUBSTITUTO) {
    const monthStart = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 1));
    const alreadyUsedThisMonth = await tx.leaveRequest.findFirst({
      where: {
        employeeId: params.employeeId,
        type: { in: [LeaveType.DOMINGO_MES, LeaveType.DOMINGO_MES_SUBSTITUTO] },
        date: { gte: monthStart, lt: monthEnd },
        status: { in: ["PENDENTE", "APROVADA"] },
      },
    });
    if (alreadyUsedThisMonth) {
      return fail("DOMINGO_JA_UTILIZADO", "Você já possui um domingo do mês solicitado ou aprovado neste mês.");
    }
  }

  // 7. Conflito de função: limite de folgas simultâneas por dia por função
  //    (seção 14 e 49 — configurável, padrão 1). O domingo do mês (e o seu
  //    substituto) não entram nessa trava: várias pessoas podem pedir o
  //    mesmo dia, e quem decide se dá pra aprovar todo mundo (ou só parte) é
  //    sempre a Direção na hora de aprovar — o calendário já mostra pra cada
  //    funcionário quantas pessoas escolheram aquele dia, pra ela poder
  //    preferir outra data.
  if (params.type !== LeaveType.DOMINGO_MES && params.type !== LeaveType.DOMINGO_MES_SUBSTITUTO) {
    const holdsSlot = settings?.pendingRequestHoldsSlot ?? true;
    const concurrentStatuses = holdsSlot ? (["PENDENTE", "APROVADA"] as const) : (["APROVADA"] as const);
    const sameDayFunctionCount = await tx.leaveRequest.count({
      where: {
        jobFunctionId: params.jobFunctionId,
        date: data,
        status: { in: [...concurrentStatuses] },
      },
    });
    if (sameDayFunctionCount >= jobFunction.dailyLeaveLimit) {
      return fail("CONFLITO_FUNCAO", "Indisponível para sua função nesta data.");
    }
  }

  // 8. Para COMPENSATORIA / EXTRA: saldo disponível (não reservado) > 0.
  if (params.type === LeaveType.COMPENSATORIA || params.type === LeaveType.EXTRA) {
    const saldo = await calcularSaldoCredito(tx, params.employeeId, params.type);
    if (saldo.disponivel <= 0) {
      return fail("SEM_CREDITO", "Você não possui saldo disponível para este tipo de folga.");
    }
  }

  return ok();
}

/**
 * Calcula saldo total / reservado / disponível de um tipo de crédito
 * (seção 22 — "Saldo total / Reservado / Disponível").
 */
export async function calcularSaldoCredito(
  tx: TxClient,
  employeeId: string,
  creditType: "COMPENSATORIA" | "EXTRA"
) {
  const transactions = await tx.leaveCreditTransaction.findMany({
    where: { employeeId, creditType },
  });
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  const reservedRequests = await tx.leaveRequest.findMany({
    where: {
      employeeId,
      type: creditType,
      status: "PENDENTE",
    },
  });
  const reservado = reservedRequests.length; // cada solicitação pendente reserva 1 crédito

  return {
    total,
    reservado,
    disponivel: total - reservado,
  };
}
