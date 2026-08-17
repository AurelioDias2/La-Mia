import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";

// GET /api/admin/leave-requests?month=YYYY-MM
// Todas as folgas do mês (qualquer status), pra Direção enxergar quem tirou
// folga em qual dia — hoje a tela de Solicitações só mostra o que ainda
// precisa de decisão, e o que já foi aprovado "some" da visão da Direção.
export async function GET(req: Request) {
  const { error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // "YYYY-MM"
  if (!month) {
    return NextResponse.json({ error: "Parâmetro 'month' é obrigatório." }, { status: 400 });
  }
  const [year, m] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, m - 1, 1));
  const monthEnd = new Date(Date.UTC(year, m, 1));

  const requests = await prisma.leaveRequest.findMany({
    where: { date: { gte: monthStart, lt: monthEnd } },
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
