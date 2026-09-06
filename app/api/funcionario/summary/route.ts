import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/session";
import { calcularSaldoCredito } from "@/lib/availability";

export async function GET() {
  const { session, error } = await requireEmployee();
  if (error) return NextResponse.json({ error }, { status: 401 });
  const employeeId = session!.user.employeeId!;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { functions: { include: { jobFunction: true } } },
  });

  const [comp, extra, nextLeave, thisMonthSunday, settings] = await Promise.all([
    calcularSaldoCredito(prisma, employeeId, "COMPENSATORIA"),
    calcularSaldoCredito(prisma, employeeId, "EXTRA"),
    prisma.leaveRequest.findFirst({
      where: { employeeId, status: "APROVADA", date: { gte: new Date() } },
      orderBy: { date: "asc" },
    }),
    prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        type: { in: ["DOMINGO_MES", "DOMINGO_MES_SUBSTITUTO"] },
        status: { in: ["PENDENTE", "APROVADA"] },
        date: {
          gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
          lt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)),
        },
      },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  return NextResponse.json({
    fullName: employee?.fullName,
    principalFunction: employee?.functions.find((f) => f.role === "PRINCIPAL")?.jobFunction.name,
    compensatoria: comp,
    extra,
    domingoDisponivel: !thisMonthSunday,
    // Pra saber se essa pessoa vai ver "domingo do mês" de verdade ou o
    // substituto (1 dia de semana), já que já folga toda semana no domingo.
    domingoSubstituto: employee?.weeklyDayOff === 0,
    nextLeave,
    allowSelfServiceCompensatoria: settings?.allowSelfServiceCompensatoria ?? true,
  });
}
