import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { distribuirBalanceado } from "@/lib/sorteio";

type Body = {
  month: string; // "YYYY-MM"
  // Lista específica de funcionários pra re-sortear (ex: "não gostei desse
  // resultado, sorteia de novo só pra essa pessoa"). Cancela o domingo
  // ativo atual dessas pessoas (se tiver) e sorteia um novo.
  employeeIds?: string[];
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
// Sem "employeeIds", sorteia o domingo do mês pra todo mundo que ainda não
// tem um domingo ativo (pendente/aprovado) nesse mês — não mexe em quem já
// escolheu ou já foi atribuído manualmente. Com "employeeIds", re-sorteia
// só essas pessoas (cancelando o domingo atual delas antes). A distribuição
// é balanceada (lib/sorteio): nunca concentra uma função/praça inteira no
// mesmo domingo — só conflita quando não há domingos suficientes pra todo
// mundo daquela praça — e conta os domingos já ocupados por qualquer
// pessoa (inclusive de antes do sorteio) pra deixar o total bem dividido.
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
  const nomes = new Map(employees.map((e) => [e.id, e.fullName]));

  const existentes = await prisma.leaveRequest.findMany({
    where: {
      type: "DOMINGO_MES",
      date: { gte: monthStart, lt: monthEnd },
      status: { in: ["PENDENTE", "APROVADA"] },
    },
  });

  const idsResorteio = new Set(body.employeeIds ?? []);
  const existentesPorEmployee = new Map(existentes.map((e) => [e.employeeId, e]));

  // Semeia as contagens com o que já existe no mês, exceto quem está sendo
  // re-sorteado agora (senão o próprio domingo antigo dela contaria contra
  // o novo sorteio).
  const contagemPorSlot = new Map<string, number>();
  const contagemPorSlotFuncao = new Map<string, number>();
  for (const existente of existentes) {
    if (idsResorteio.has(existente.employeeId)) continue;
    const slot = existente.date.toISOString().slice(0, 10);
    contagemPorSlot.set(slot, (contagemPorSlot.get(slot) ?? 0) + 1);
    const chave = `${slot}|${existente.jobFunctionId}`;
    contagemPorSlotFuncao.set(chave, (contagemPorSlotFuncao.get(chave) ?? 0) + 1);
  }

  const candidatos = employees
    .filter(
      (e) =>
        e.functions[0]?.jobFunctionId &&
        (idsResorteio.has(e.id) || !existentesPorEmployee.has(e.id))
    )
    .map((e) => ({ id: e.id, jobFunctionId: e.functions[0].jobFunctionId }));

  const escolhas = distribuirBalanceado(candidatos, slots, contagemPorSlotFuncao, contagemPorSlot);

  let criados = 0;
  let trocados = 0;
  const erros: { employeeId: string; nome: string; message: string }[] = [];
  const detalhes: { employeeId: string; nome: string; date: string; leaveRequestId: string }[] = [];

  for (const pessoa of candidatos) {
    const slot = escolhas.get(pessoa.id)!;
    const date = new Date(`${slot}T00:00:00.000Z`);
    const existente = existentesPorEmployee.get(pessoa.id);
    try {
      const novoId = await prisma.$transaction(async (tx) => {
        if (existente) {
          await tx.leaveRequest.update({
            where: { id: existente.id },
            data: { status: "CANCELADA", decidedAt: new Date(), decidedById: session!.user.id },
          });
          await logAudit(tx, {
            actorId: session!.user.id,
            action: "LEAVE_CANCELLED_BY_DIRECTOR",
            targetType: "LeaveRequest",
            targetId: existente.id,
            metadata: { motivo: "Re-sorteado a pedido da Direção" },
          });
        }
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
        return novo.id;
      });
      if (existente) trocados++;
      else criados++;
      detalhes.push({ employeeId: pessoa.id, nome: nomes.get(pessoa.id) ?? pessoa.id, date: slot, leaveRequestId: novoId });
    } catch (e) {
      erros.push({
        employeeId: pessoa.id,
        nome: nomes.get(pessoa.id) ?? pessoa.id,
        message: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  return NextResponse.json({ criados, trocados, erros, semDomingoAntes: candidatos.length, detalhes });
}
