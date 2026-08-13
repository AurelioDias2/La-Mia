import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector, requireEmployee } from "@/lib/session";
import { logAudit } from "@/lib/audit";

type Action = "APROVAR" | "RECUSAR" | "SOLICITAR_CANCELAMENTO" | "APROVAR_CANCELAMENTO" | "RECUSAR_CANCELAMENTO";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const action = body.action as Action;

  if (action === "SOLICITAR_CANCELAMENTO") {
    return handleEmployeeCancelRequest(params.id);
  }
  return handleDirectorDecision(params.id, action);
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
