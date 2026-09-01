import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";

// GET /api/admin/leave-requests?month=YYYY-MM
// GET /api/admin/leave-requests (sem 'month': todas as folgas, de qualquer época)
// Todas as folgas (qualquer status), pra Direção enxergar quem tirou folga em
// qual dia — a tela de Solicitações só mostra o que ainda precisa de decisão,
// e o que já foi aprovado "some" da visão da Direção.
export async function GET(req: Request) {
  const { error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // "YYYY-MM"

  let dateFilter: { gte: Date; lt: Date } | undefined;
  if (month) {
    const [year, m] = month.split("-").map(Number);
    dateFilter = { gte: new Date(Date.UTC(year, m - 1, 1)), lt: new Date(Date.UTC(year, m, 1)) };
  }

  const requests = await prisma.leaveRequest.findMany({
    where: dateFilter ? { date: dateFilter } : undefined,
    include: { employee: true, jobFunction: true },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(
    requests.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      type: r.type,
      status: r.status,
      employeeName: r.employee.fullName,
      jobFunctionName: r.jobFunction.name,
    }))
  );
}
