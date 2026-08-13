import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { grantCreditSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

// POST: conceder crédito (compensatória ou extra) a um funcionário.
// FUNCIONÁRIO NÃO CRIA COMPENSATÓRIA — só o Diretor (seção 19).
export async function POST(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json();
  const parsed = grantCreditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { employeeId, creditType, amount, originDate, reason, note } = parsed.data;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  const transaction = await prisma.$transaction(async (tx) => {
    const t = await tx.leaveCreditTransaction.create({
      data: {
        employeeId,
        creditType,
        kind: "CONCESSAO",
        amount,
        reason,
        note,
        originDate: originDate ? new Date(`${originDate}T00:00:00.000Z`) : undefined,
        createdById: session!.user.id,
      },
    });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "CREDIT_GRANTED",
      targetType: "Employee",
      targetId: employeeId,
      metadata: { creditType, amount, reason },
    });
    return t;
  });

  return NextResponse.json(transaction, { status: 201 });
}
