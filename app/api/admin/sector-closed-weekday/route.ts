import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// GET /api/admin/sector-closed-weekday
// Lista o dia fixo de fechamento de cada setor que existe hoje (a partir
// das funções cadastradas) — setores sem registro ainda aparecem com
// closedWeekday: null (nenhum dia fixo).
export async function GET() {
  const { error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const [setores, existentes] = await Promise.all([
    prisma.jobFunction.findMany({ select: { sector: true }, distinct: ["sector"] }),
    prisma.sectorClosedWeekday.findMany(),
  ]);

  const porSetor = new Map(existentes.map((e) => [e.sector, e.closedWeekday]));
  const resultado = setores
    .map((s) => s.sector)
    .sort()
    .map((sector) => ({ sector, closedWeekday: porSetor.get(sector) ?? null }));

  return NextResponse.json(resultado);
}

// PATCH /api/admin/sector-closed-weekday
// Body: { sector: string, closedWeekday: number | null }
export async function PATCH(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = (await req.json()) as { sector?: string; closedWeekday?: number | null };
  if (!body.sector) {
    return NextResponse.json({ error: "Informe o setor." }, { status: 400 });
  }
  if (body.closedWeekday !== null && body.closedWeekday !== undefined && (body.closedWeekday < 0 || body.closedWeekday > 6)) {
    return NextResponse.json({ error: "Dia da semana inválido." }, { status: 400 });
  }

  const closedWeekday = body.closedWeekday ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.sectorClosedWeekday.upsert({
      where: { sector: body.sector! },
      update: { closedWeekday },
      create: { sector: body.sector!, closedWeekday },
    });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "SECTOR_CLOSED_WEEKDAY_CHANGED",
      targetType: "SectorClosedWeekday",
      targetId: body.sector!,
      metadata: { sector: body.sector, closedWeekday },
    });
    return s;
  });

  return NextResponse.json(updated);
}
