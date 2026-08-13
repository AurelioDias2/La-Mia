import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector, requireAnyUser } from "@/lib/session";
import { blockDateSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const { session, error } = await requireAnyUser();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const dates = await prisma.blockedDate.findMany({ where: { removedAt: null } });

  // Funcionário não vê o motivo (seção 27: "Ele não verá o motivo.").
  if (session!.user.role === "FUNCIONARIO") {
    return NextResponse.json(dates.map((d) => ({ date: d.date })));
  }
  return NextResponse.json(dates);
}

export async function POST(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json();
  const parsed = blockDateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const blocked = await prisma.$transaction(async (tx) => {
    const b = await tx.blockedDate.create({
      data: {
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        reason: parsed.data.reason,
        createdById: session!.user.id,
      },
    });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "DATE_BLOCKED",
      targetType: "BlockedDate",
      targetId: b.id,
      metadata: { reason: parsed.data.reason },
    });
    return b;
  });

  return NextResponse.json(blocked, { status: 201 });
}
