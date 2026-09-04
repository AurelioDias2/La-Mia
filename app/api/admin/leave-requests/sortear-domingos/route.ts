import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";

type Body = {
  month: string; // "YYYY-MM"
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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
// foi atribuído manualmente. Sorteia por função (não pelo grupo todo): os
// funcionários de cada função são embaralhados e distribuídos em rodízio
// pelos domingos do mês, pra nunca deixar uma função inteira de folga no
// mesmo domingo (o que comprometeria o setor naquele dia).
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

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const employees = await prisma.employee.findMany({
    where: { status: "ATIVO" },
    include: {
      functions: { where: { role: "PRINCIPAL" } },
      leaveRequests: {
        where: {
          type: "DOMINGO_MES",
          date: { gte: monthStart, lt: monthEnd },
          status: { in: ["PENDENTE", "APROVADA"] },
        },
      },
    },
  });

  const pendentes = employees.filter(
    (e) => e.functions[0]?.jobFunctionId && e.leaveRequests.length === 0
  );

  const porFuncao = new Map<string, typeof pendentes>();
  for (const emp of pendentes) {
    const jobFunctionId = emp.functions[0].jobFunctionId;
    const lista = porFuncao.get(jobFunctionId) ?? [];
    lista.push(emp);
    porFuncao.set(jobFunctionId, lista);
  }

  const atribuicoes: { employeeId: string; jobFunctionId: string; date: Date }[] = [];
  for (const [jobFunctionId, emps] of porFuncao) {
    const embaralhados = shuffle(emps);
    embaralhados.forEach((emp, i) => {
      atribuicoes.push({
        employeeId: emp.id,
        jobFunctionId,
        date: domingos[i % domingos.length],
      });
    });
  }

  let criados = 0;
  const erros: { employeeId: string; nome: string; message: string }[] = [];

  for (const a of atribuicoes) {
    try {
      await prisma.$transaction(async (tx) => {
        const novo = await tx.leaveRequest.create({
          data: {
            employeeId: a.employeeId,
            jobFunctionId: a.jobFunctionId,
            type: "DOMINGO_MES",
            date: a.date,
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
          metadata: { type: "DOMINGO_MES", date: a.date.toISOString(), sorteio: true },
        });
      });
      criados++;
    } catch (e) {
      const employee = await prisma.employee.findUnique({ where: { id: a.employeeId } });
      erros.push({
        employeeId: a.employeeId,
        nome: employee?.fullName ?? a.employeeId,
        message: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  return NextResponse.json({ criados, erros, semDomingoAntes: pendentes.length });
}
