import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { distribuirBalanceado } from "@/lib/sorteio";

// Segunda a sábado — domingo fica de fora porque é o domingo do mês, um
// direito à parte de cada um (seção 13.3), não a folga semanal recorrente.
const DIAS_DISPONIVEIS = [1, 2, 3, 4, 5, 6];

type Body = {
  sector?: string;
  // Quando true, sorteia de novo pra TODO MUNDO do setor (não só quem
  // ainda não tem dia definido) — pensado pro caso da Pronta Entrega,
  // que vai sortear a folga semanal de novo todo mês quando passar a
  // abrir todos os dias. Produção normalmente não precisa disso: o dia
  // de cada um é fixo e raramente muda.
  sobrescrever?: boolean;
};

// POST /api/admin/employees/sortear-folga-semanal
// Sorteia o dia fixo de folga semanal (Employee.weeklyDayOff). Sem
// "sector"/"sobrescrever", sorteia só quem ainda não tem um dia definido,
// em qualquer setor — não mexe em quem a Direção já configurou
// manualmente. Distribuição balanceada (lib/sorteio): nunca concentra uma
// função/praça inteira no mesmo dia da semana, considerando quem já tem
// um dia fixo definido pra manter a escala toda equilibrada.
export async function POST(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;

  const employees = await prisma.employee.findMany({
    where: { status: "ATIVO" },
    include: { functions: { where: { role: "PRINCIPAL" }, include: { jobFunction: true } } },
  });

  const doSetor = body.sector
    ? employees.filter((e) => e.functions[0]?.jobFunction.sector === body.sector)
    : employees;

  const candidatos = doSetor
    .filter((e) => e.functions[0]?.jobFunctionId && (body.sobrescrever || e.weeklyDayOff === null))
    .map((e) => ({ id: e.id, jobFunctionId: e.functions[0].jobFunctionId }));
  const idsCandidatos = new Set(candidatos.map((c) => c.id));

  const slots = DIAS_DISPONIVEIS.map(String);
  const contagemPorSlot = new Map<string, number>();
  const contagemPorSlotFuncao = new Map<string, number>();
  for (const emp of employees) {
    const jobFunctionId = emp.functions[0]?.jobFunctionId;
    if (emp.weeklyDayOff === null || !jobFunctionId || idsCandidatos.has(emp.id)) continue;
    const slot = String(emp.weeklyDayOff);
    contagemPorSlot.set(slot, (contagemPorSlot.get(slot) ?? 0) + 1);
    const chave = `${slot}|${jobFunctionId}`;
    contagemPorSlotFuncao.set(chave, (contagemPorSlotFuncao.get(chave) ?? 0) + 1);
  }

  const escolhas = distribuirBalanceado(candidatos, slots, contagemPorSlotFuncao, contagemPorSlot);

  let atribuidos = 0;
  const erros: { employeeId: string; nome: string; message: string }[] = [];

  for (const pessoa of candidatos) {
    const weeklyDayOff = Number(escolhas.get(pessoa.id)!);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.employee.update({ where: { id: pessoa.id }, data: { weeklyDayOff } });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_WEEKLY_DAY_OFF_CHANGED",
          targetType: "Employee",
          targetId: pessoa.id,
          metadata: { weeklyDayOff, sorteio: true, sector: body.sector ?? null },
        });
      });
      atribuidos++;
    } catch (e) {
      const employee = await prisma.employee.findUnique({ where: { id: pessoa.id } });
      erros.push({
        employeeId: pessoa.id,
        nome: employee?.fullName ?? pessoa.id,
        message: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  return NextResponse.json({ atribuidos, erros, semFolgaAntes: candidatos.length });
}
