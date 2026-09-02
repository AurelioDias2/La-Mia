import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector, requireEmployee } from "@/lib/session";
import { logAudit } from "@/lib/audit";

type Action =
  | "APROVAR"
  | "RECUSAR"
  | "SOLICITAR_CANCELAMENTO"
  | "APROVAR_CANCELAMENTO"
  | "RECUSAR_CANCELAMENTO"
  | "CANCELAR_DIRETO"
  | "ALTERAR_DATA";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const action = body.action as Action;

  if (action === "SOLICITAR_CANCELAMENTO") {
    return handleEmployeeCancelRequest(params.id);
  }
  if (action === "ALTERAR_DATA") {
    return handleAlterarData(params.id, body.date as string);
  }
  return handleDirectorDecision(params.id, action);
}

// Diretor muda a data de uma folga já pedida (pendente ou aprovada) — ex:
// realocar alguém pra um domingo com menos gente. Ignora de propósito a
// checagem de "conflito de função" (é uma decisão manual da Direção), mas
// mantém a regra de que domingo do mês só pode cair num domingo de verdade.
async function handleAlterarData(id: string, newDateStr: string) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  if (!newDateStr) {
    return NextResponse.json({ error: "Informe a nova data." }, { status: 400 });
  }

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest) return NextResponse.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  if (leaveRequest.status !== "PENDENTE" && leaveRequest.status !== "APROVADA") {
    return NextResponse.json(
      { error: "Só é possível mudar a data de uma folga pendente ou aprovada." },
      { status: 400 }
    );
  }

  const newDate = new Date(`${newDateStr}T00:00:00.000Z`);
  if (leaveRequest.type === "DOMINGO_MES" && newDate.getUTCDay() !== 0) {
    return NextResponse.json({ error: "A nova data precisa ser um domingo." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const oldDate = leaveRequest.date;
    const r = await tx.leaveRequest.update({ where: { id }, data: { date: newDate } });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "LEAVE_DATE_CHANGED_BY_DIRECTOR",
      targetType: "LeaveRequest",
      targetId: id,
      metadata: { oldDate: oldDate.toISOString(), newDate: newDate.toISOString() },
    });
    return r;
  });

  return NextResponse.json(updated);
}

// Funcionário pede cancelamento de uma folga já aprovada (seção 38).
async function handleEmployeeCancelRequest(id: string) {
  const { session, error } = await requireEmployee();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest || leaveRequest.employeeId !== session!.user.employeeId) {
    return NextResponse.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  }
  if (leaveRequest.status !== "APROVADA") {
    return NextResponse.json(
      { error: "Só é possível pedir cancelamento de uma folga aprovada." },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.leaveRequest.update({
      where: { id },
      data: { status: "CANCELAMENTO_SOLICITADO", cancelRequestedAt: new Date() },
    });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "LEAVE_CANCEL_REQUESTED",
      targetType: "LeaveRequest",
      targetId: id,
    });
    return r;
  });

  return NextResponse.json(updated);
}

// Diretor aprova/recusa a solicitação original, ou aprova/recusa o
// cancelamento pedido pelo funcionário (seções 17, 18, 38).
async function handleDirectorDecision(id: string, action: Action) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest) return NextResponse.json({ error: "NAO_ENCONTRADO" }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    let newStatus = leaveRequest.status;
    let auditAction = "";

    if (action === "APROVAR" && leaveRequest.status === "PENDENTE") {
      newStatus = "APROVADA";
      auditAction = "LEAVE_APPROVED";

      // Se for COMPENSATORIA/EXTRA, converte a reserva em consumo real de crédito.
      if (leaveRequest.type === "COMPENSATORIA" || leaveRequest.type === "EXTRA") {
        const consumo = await tx.leaveCreditTransaction.create({
          data: {
            employeeId: leaveRequest.employeeId,
            creditType: leaveRequest.type,
            kind: "CONSUMO",
            amount: -1,
            reason: "Uso de crédito para folga aprovada",
            createdById: session!.user.id,
          },
        });
        await tx.leaveRequest.update({
          where: { id },
          data: { creditTransactionId: consumo.id },
        });
      }
    } else if (action === "RECUSAR" && leaveRequest.status === "PENDENTE") {
      newStatus = "RECUSADA";
      auditAction = "LEAVE_REJECTED";
    } else if (action === "APROVAR_CANCELAMENTO" && leaveRequest.status === "CANCELAMENTO_SOLICITADO") {
      newStatus = "CANCELADA";
      auditAction = "LEAVE_CANCEL_APPROVED";
      // Estorna o crédito, se aplicável.
      if (leaveRequest.creditTransactionId) {
        await tx.leaveCreditTransaction.create({
          data: {
            employeeId: leaveRequest.employeeId,
            creditType: leaveRequest.type as "COMPENSATORIA" | "EXTRA",
            kind: "ESTORNO",
            amount: 1,
            reason: "Estorno por cancelamento de folga aprovado pela Direção",
            createdById: session!.user.id,
          },
        });
      }
    } else if (action === "RECUSAR_CANCELAMENTO" && leaveRequest.status === "CANCELAMENTO_SOLICITADO") {
      newStatus = "APROVADA"; // volta ao estado anterior
      auditAction = "LEAVE_CANCEL_REJECTED";
    } else if (
      action === "CANCELAR_DIRETO" &&
      (leaveRequest.status === "PENDENTE" || leaveRequest.status === "APROVADA")
    ) {
      // Direção cancela direto, sem o funcionário precisar pedir primeiro —
      // ex: liberar o domingo do mês pra a pessoa escolher outra data.
      newStatus = "CANCELADA";
      auditAction = "LEAVE_CANCELLED_BY_DIRECTOR";
      if (leaveRequest.creditTransactionId) {
        await tx.leaveCreditTransaction.create({
          data: {
            employeeId: leaveRequest.employeeId,
            creditType: leaveRequest.type as "COMPENSATORIA" | "EXTRA",
            kind: "ESTORNO",
            amount: 1,
            reason: "Estorno por cancelamento direto da Direção",
            createdById: session!.user.id,
          },
        });
      }
    } else {
      throw new Error("TRANSICAO_INVALIDA");
    }

    const r = await tx.leaveRequest.update({
      where: { id },
      data: { status: newStatus, decidedAt: new Date(), decidedById: session!.user.id },
    });

    await logAudit(tx, {
      actorId: session!.user.id,
      action: auditAction,
      targetType: "LeaveRequest",
      targetId: id,
    });

    return r;
  });

  return NextResponse.json(updated);
}
