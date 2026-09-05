import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { distribuirBalanceado } from "@/lib/sorteio";

type Body = {
  month: string; // "YYYY-MM"
};

function domingosDoMes(year: number, month: number): Date[] {
  const domingos: Date[] = [];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCDay() === 0) domingos.push(d);
  }
  return domingos;
}

// POST /api/admin/leave-requests/sortear-domingos
// Sorteia o domingo do mês pra todo mundo que ainda não tem um domingo
// ativo (pendente/aprovado) nesse mês — não mexe em quem já escolheu ou já
// foi atribuído manualmente. A distribuição é balanceada (lib/sorteio):
// nunca concentra uma função inteira no mesmo domingo, e conta os domingos
// já ocupados por qualquer pessoa (inclusive de antes do sorteio) pra
// deixar o total bem dividido entre os domingos do mês.
export async function POST(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.month) {
    return NextResponse.json({ error: "Informe o mês." }, { status: 400 });
  }

  const [year, month] = body.month.split("-").map(Number);
  const domingos = domingosDoMes(year, month);
  if (domingos.length === 0) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }
  const slots = domingos.map((d) => d.toISOString().slice(0, 10));

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const employees = await prisma.employee.findMany({
    where: { status: "ATIVO" },
    include: { functions: { where: { role: "PRINCIPAL" } } },
  });

  const existentes = await prisma.leaveRequest.findMany({
    where: {
      type: "DOMINGO_MES",
      date: { gte: monthStart, lt: monthEnd },
      status: { in: ["PENDENTE", "APROVADA"] },
    },
  });
  const employeeIdsComDomingo = new Set(existentes.map((e) => e.employeeId));

  // Semeia as contagens com o que já existe no mês (pedidos e atribuições
  // anteriores), pra o sorteio equilibrar em relação ao mês inteiro.
  const contagemPorSlot = new Map<string, number>();
  const contagemPorSlotFuncao = new Map<string, number>();
  for (const existente of existentes) {
    const slot = existente.date.toISOString().slice(0, 10);
    contagemPorSlot.set(slot, (contagemPorSlot.get(slot) ?? 0) + 1);
    const chave = `${slot}|${existente.jobFunctionId}`;
    contagemPorSlotFuncao.set(chave, (contagemPorSlotFuncao.get(chave) ?? 0) + 1);
  }

  const pendentes = employees
    .filter((e) => e.functions[0]?.jobFunctionId && !employeeIdsComDomingo.has(e.id))
    .map((e) => ({ id: e.id, jobFunctionId: e.functions[0].jobFunctionId }));

  const escolhas = distribuirBalanceado(pendentes, slots, contagemPorSlotFuncao, contagemPorSlot);

  let criados = 0;
  const erros: { employeeId: string; nome: string; message: string }[] = [];

  for (const pessoa of pendentes) {
    const slot = escolhas.get(pessoa.id)!;
    const date = new Date(`${slot}T00:00:00.000Z`);
    try {
      await prisma.$transaction(async (tx) => {
        const novo = await tx.leaveRequest.create({
          data: {
            employeeId: pessoa.id,
            jobFunctionId: pessoa.jobFunctionId,
            type: "DOMINGO_MES",
            date,
            status: "APROVADA",
            decidedAt: new Date(),
            decidedById: session!.user.id,
          },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "LEAVE_ASSIGNED_BY_DIRECTOR",
          targetType: "LeaveRequest",
          targetId: novo.id,
          metadata: { type: "DOMINGO_MES", date: slot, sorteio: true },
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

  return NextResponse.json({ criados, erros, semDomingoAntes: pendentes.length });
}
