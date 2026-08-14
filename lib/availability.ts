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
  | "FUNCAO_FECHADA_NO_DIA";

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

  // 2. Dia válido (não é a segunda-feira de fechamento fixo — seção 10)?
  // Só vale para funções que realmente não trabalham nesse dia
  // (jobFunction.followsStoreClosure) — algumas, como Produção, seguem
  // trabalhando mesmo com a loja fechada pro público.
  const settings = await tx.settings.findUnique({ where: { id: 1 } });
  const closedWeekday = settings?.fixedClosedWeekday ?? 1; // 1 = segunda-feira
  if (jobFunction.followsStoreClosure && data.getUTCDay() === closedWeekday) {
    return fail("LOJA_FECHADA", "A loja não abre nesse dia da semana (fechamento semanal).");
  }

  // 2.1. Fechamento adicional específico da função (setores diferentes podem
  // ter dias de fechamento diferentes — ex: Produção x Pronta Entrega).
  if (jobFunction.closedWeekday !== null && data.getUTCDay() === jobFunction.closedWeekday) {
    return fail("FUNCAO_FECHADA_NO_DIA", "Sua função não abre folgas nesse dia da semana.");
  }

  // Para DOMINGO_MES, a data escolhida precisa realmente ser domingo.
  if (params.type === LeaveType.DOMINGO_MES && data.getUTCDay() !== 0) {
    return fail("DIA_INVALIDO", "A data escolhida não é um domingo.");
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

  // 6. Regra do domingo do mês: só um domingo por mês por funcionário
  //    (pendente ou aprovado já conta) — seção 13.3.
  if (params.type === LeaveType.DOMINGO_MES) {
    const monthStart = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 1));
    const alreadyUsedThisMonth = await tx.leaveRequest.findFirst({
      where: {
        employeeId: params.employeeId,
        type: LeaveType.DOMINGO_MES,
        date: { gte: monthStart, lt: monthEnd },
        status: { in: ["PENDENTE", "APROVADA"] },
      },
    });
    if (alreadyUsedThisMonth) {
      return fail("DOMINGO_JA_UTILIZADO", "Você já possui um domingo solicitado ou aprovado neste mês.");
    }
  }

  // 7. Conflito de função: limite de folgas simultâneas por dia por função
  //    (seção 14 e 49 — configurável, padrão 1).
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
