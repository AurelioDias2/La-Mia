import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/session";
import { verificarDisponibilidade } from "@/lib/availability";

// GET /api/leave-requests/availability?type=DOMINGO_MES&month=2026-08
// Retorna o status de cada dia do mês para a função principal do funcionário
// logado, para alimentar o calendário visual (seção 46). O backend decide
// (seção 40) — isto é só para pintar o calendário; o SOLICITAR real roda a
// verificação de novo, dentro de uma transação.
export async function GET(req: Request) {
  const { session, error } = await requireEmployee();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA" | null;
  const month = searchParams.get("month"); // "YYYY-MM"
  if (!type || !month) {
    return NextResponse.json({ error: "Parâmetros 'type' e 'month' são obrigatórios." }, { status: 400 });
  }

  const employeeId = session!.user.employeeId!;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { functions: { where: { role: "PRINCIPAL" } } },
  });
  const jobFunctionId = employee?.functions[0]?.jobFunctionId;
  if (!jobFunctionId) {
    return NextResponse.json({ error: "Funcionário sem função principal." }, { status: 400 });
  }

  const [year, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const days = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, m - 1, day));
    if (type === "DOMINGO_MES" && date.getUTCDay() !== 0) continue; // só mostra domingos

    const result = await verificarDisponibilidade(prisma, {
      employeeId,
      jobFunctionId,
      date,
      type,
    });
    days.push({ date: date.toISOString().slice(0, 10), ...result });
  }

  return NextResponse.json(days);
}
