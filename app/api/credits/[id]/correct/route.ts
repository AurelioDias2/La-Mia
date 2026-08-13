import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { correctCreditSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

// "Se você errar um crédito... você poderá corrigir. Mas o banco registra:
//  Crédito anterior / Corrigido para / Responsável / Data-hora." (seção 35)
// Implementado como uma NOVA transação de ajuste, nunca um UPDATE destrutivo
// sobre o lançamento original.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json();
  const parsed = correctCreditSchema.safeParse({ ...body, transactionId: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { transactionId, correctedAmount, reason } = parsed.data;

  const original = await prisma.leaveCreditTransaction.findUnique({ where: { id: transactionId } });
  if (!original) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });

  const delta = correctedAmount - original.amount;

  const correction = await prisma.$transaction(async (tx) => {
    const t = await tx.leaveCreditTransaction.create({
      data: {
        employeeId: original.employeeId,
        creditType: original.creditType,
        kind: "CORRECAO",
        amount: delta,
        reason,
        note: `Crédito anterior: ${original.amount >= 0 ? "+" : ""}${original.amount}. Corrigido para: ${
          correctedAmount >= 0 ? "+" : ""
        }${correctedAmount}.`,
        correctsTransactionId: original.id,
        createdById: session!.user.id,
      },
    });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "CREDIT_CORRECTED",
      targetType: "LeaveCreditTransaction",
      targetId: original.id,
      metadata: { before: original.amount, after: correctedAmount, reason },
    });
    return t;
  });

  return NextResponse.json(correction, { status: 201 });
}
