import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";

export async function GET() {
  const { error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const today = new Date();
  const todayOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const in7days = new Date(todayOnly);
  in7days.setUTCDate(in7days.getUTCDate() + 7);

  const [
    activeEmployees,
    pendingRegistrations,
    pendingRequests,
    leavesToday,
    leavesNext7Days,
    pendingCancellations,
    compTransactions,
    extraTransactions,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "ATIVO" } }),
    prisma.employee.count({ where: { status: "PENDENTE" } }),
    prisma.leaveRequest.count({ where: { status: "PENDENTE" } }),
    prisma.leaveRequest.count({ where: { status: "APROVADA", date: todayOnly } }),
    prisma.leaveRequest.count({
      where: { status: "APROVADA", date: { gte: todayOnly, lte: in7days } },
    }),
    prisma.leaveRequest.count({ where: { status: "CANCELAMENTO_SOLICITADO" } }),
    prisma.leaveCreditTransaction.groupBy({
      by: ["employeeId"],
      where: { creditType: "COMPENSATORIA" },
      _sum: { amount: true },
    }),
    prisma.leaveCreditTransaction.groupBy({
      by: ["employeeId"],
      where: { creditType: "EXTRA" },
      _sum: { amount: true },
    }),
  ]);

  const compensatoriasDisponiveis = compTransactions.reduce(
    (sum, t) => sum + Math.max(t._sum.amount ?? 0, 0),
    0
  );
  const extrasDisponiveis = extraTransactions.reduce(
    (sum, t) => sum + Math.max(t._sum.amount ?? 0, 0),
    0
  );

  return NextResponse.json({
    activeEmployees,
    pendingRegistrations,
    pendingRequests,
    leavesToday,
    leavesNext7Days,
    pendingCancellations,
    compensatoriasDisponiveis,
    extrasDisponiveis,
  });
}
