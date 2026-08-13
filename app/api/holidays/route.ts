import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { holidaySchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const holidays = await prisma.holiday.findMany({
    where: { active: true },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(holidays);
}

// Criar feriado. IMPORTANTE: isto nunca gera crédito automaticamente
// (seção 26 — decisão trabalhista continua sendo do Diretor).
export async function POST(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json();
  const parsed = holidaySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const holiday = await prisma.$transaction(async (tx) => {
    const h = await tx.holiday.create({
      data: {
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        name: parsed.data.name,
        type: parsed.data.type,
        storeOpen: parsed.data.storeOpen,
      },
    });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "HOLIDAY_CREATED",
      targetType: "Holiday",
      targetId: h.id,
      metadata: parsed.data,
    });
    return h;
  });

  return NextResponse.json(holiday, { status: 201 });
}
