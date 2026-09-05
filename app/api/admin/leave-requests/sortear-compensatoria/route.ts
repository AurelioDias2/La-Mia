import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { calcularSaldoCredito } from "@/lib/availability";
import { distribuirBalanceado } from "@/lib/sorteio";

type Body = {
  month: string; // "YYYY-MM"
};

// Dias de alta demanda (0=domingo, 5=sexta, 6=sábado) — mesma regra do
// autoatendimento (lib/availability.ts): compensatória nunca cai neles.
const DIAS_ALTA_DEMANDA = [0, 5, 6];

function diasValidosDoMes(year: number, month: number): Date[] {
  const dias: Date[] = [];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!DIAS_ALTA_DEMANDA.includes(d.getUTCDay())) dias.push(d);
  }
  return dias;
}

// POST /api/admin/leave-requests/sortear-compensatoria
// Sorteia um dia de compensatória pra quem já tem crédito disponível e
// ainda não usou nenhum esse mês — usa 1 crédito já existente (não concede
// crédito novo, diferente do /atribuir manual). Nunca em dia de alta
// demanda. Distribuição balanceada (lib/sorteio): nunca concentra uma
// função no mesmo dia, considerando o que já existe no mês.
export async function POST(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.month) {
    return NextResponse.json({ error: "Informe o mês." }, { status: 400 });
  }

  const [year, month] = body.month.split("-").map(Number);
  const dias = diasValidosDoMes(year, month);
  if (dias.length === 0) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }
  const slots = dias.map((d) => d.toISOString().slice(0, 10));

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const employees = await prisma.employee.findMany({
    where: { status: "ATIVO" },
    include: { functions: { where: { role: "PRINCIPAL" } } },
  });

  const existentes = await prisma.leaveRequest.findMany({
    where: {
      type: "COMPENSATORIA",
      date: { gte: monthStart, lt: monthEnd },
      status: { in: ["PENDENTE", "APROVADA"] },
    },
  });
  const employeeIdsComCompensatoria = new Set(existentes.map((e) => e.employeeId));

  const contagemPorSlot = new Map<string, number>();
  const contagemPorSlotFuncao = new Map<string, number>();
  for (const existente of existentes) {
    const slot = existente.date.toISOString().slice(0, 10);
    contagemPorSlot.set(slot, (contagemPorSlot.get(slot) ?? 0) + 1);
    const chave = `${slot}|${existente.jobFunctionId}`;
    contagemPorSlotFuncao.set(chave, (contagemPorSlotFuncao.get(chave) ?? 0) + 1);
  }

  const candidatos: { id: string; jobFunctionId: string }[] = [];
  for (const e of employees) {
    const jobFunctionId = e.functions[0]?.jobFunctionId;
    if (!jobFunctionId || employeeIdsComCompensatoria.has(e.id)) continue;
    const saldo = await calcularSaldoCredito(prisma, e.id, "COMPENSATORIA");
    if (saldo.disponivel > 0) candidatos.push({ id: e.id, jobFunctionId });
  }

  const escolhas = distribuirBalanceado(candidatos, slots, contagemPorSlotFuncao, contagemPorSlot);

  let criados = 0;
  const erros: { employeeId: string; nome: string; message: string }[] = [];

  for (const pessoa of candidatos) {
    const slot = escolhas.get(pessoa.id)!;
    const date = new Date(`${slot}T00:00:00.000Z`);
    try {
      await prisma.$transaction(async (tx) => {
        const consumo = await tx.leaveCreditTransaction.create({
          data: {
            employeeId: pessoa.id,
            creditType: "COMPENSATORIA",
            kind: "CONSUMO",
            amount: -1,
            reason: "Uso de crédito para folga sorteada pela Direção",
            createdById: session!.user.id,
          },
        });
        const novo = await tx.leaveRequest.create({
          data: {
            employeeId: pessoa.id,
            jobFunctionId: pessoa.jobFunctionId,
            type: "COMPENSATORIA",
            date,
            status: "APROVADA",
            decidedAt: new Date(),
            decidedById: session!.user.id,
            creditTransactionId: consumo.id,
          },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "LEAVE_ASSIGNED_BY_DIRECTOR",
          targetType: "LeaveRequest",
          targetId: novo.id,
          metadata: { type: "COMPENSATORIA", date: slot, sorteio: true },
        });
      });
      criados++;
    } catch (e) {
      const employee = await prisma.employee.findUnique({ where: { id: pessoa.id } });
      erros.push({
        employeeId: pessoa.id,
        nome: employee?.fullName ?? pessoa.id,
        message: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  return NextResponse.json({ criados, erros, comCreditoAntes: candidatos.length });
}
