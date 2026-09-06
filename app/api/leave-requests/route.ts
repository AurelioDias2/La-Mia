import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireEmployee, requireAnyUser } from "@/lib/session";
import { createLeaveRequestSchema } from "@/lib/validations";
import { verificarDisponibilidade } from "@/lib/availability";
import { logAudit } from "@/lib/audit";

// GET: lista as próprias solicitações (funcionário) — usada em "Minhas solicitações".
export async function GET() {
  const { session, error } = await requireAnyUser();
  if (error) return NextResponse.json({ error }, { status: 401 });

  if (session!.user.role === "FUNCIONARIO") {
    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId: session!.user.employeeId! },
      include: { jobFunction: true },
      orderBy: { requestedAt: "desc" },
    });
    return NextResponse.json(requests);
  }

  // Diretor: lista tudo pendente por padrão (seção 16).
  const requests = await prisma.leaveRequest.findMany({
    where: { status: "PENDENTE" },
    include: { jobFunction: true, employee: true },
    orderBy: { requestedAt: "asc" },
  });
  return NextResponse.json(requests);
}

// POST: funcionário solicita uma folga.
export async function POST(req: Request) {
  const { session, error } = await requireEmployee();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json();
  const parsed = createLeaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { type, date } = parsed.data;
  const employeeId = session!.user.employeeId!;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { functions: { where: { role: "PRINCIPAL" } } },
  });
  const principal = employee?.functions[0];
  if (!principal) {
    return NextResponse.json(
      { error: "Funcionário sem função principal cadastrada." },
      { status: 400 }
    );
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  // Quem já folga toda semana no domingo pede "DOMINGO_MES" igual todo mundo
  // (a tela não muda) — o backend que troca sozinho pro tipo substituto, que
  // usa um dia de semana no lugar de um domingo de verdade.
  const effectiveType =
    type === "DOMINGO_MES" && employee?.weeklyDayOff === 0 ? "DOMINGO_MES_SUBSTITUTO" : type;

  try {
    // A verificação roda DE NOVO dentro da transação, com isolamento
    // Serializable, para tratar corretamente duas pessoas solicitando a
    // mesma vaga quase ao mesmo tempo (seção 41). O índice único parcial
    // sugerido no README complementa esta trava a nível de aplicação.
    const result = await prisma.$transaction(
      async (tx) => {
        const check = await verificarDisponibilidade(tx, {
          employeeId,
          jobFunctionId: principal.jobFunctionId,
          date: parsedDate,
          type: effectiveType,
        });
        if (!check.disponivel) {
          throw new AvailabilityError(check.motivo, check.mensagem);
        }

        const leaveRequest = await tx.leaveRequest.create({
          data: {
            employeeId,
            jobFunctionId: principal.jobFunctionId,
            type: effectiveType,
            date: parsedDate,
            status: "PENDENTE",
          },
        });

        await logAudit(tx, {
          actorId: session!.user.id,
          action: "LEAVE_REQUESTED",
          targetType: "LeaveRequest",
          targetId: leaveRequest.id,
          metadata: { type: effectiveType, date },
        });

        return leaveRequest;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AvailabilityError) {
      return NextResponse.json({ error: e.motivo, message: e.message }, { status: 409 });
    }
    // Conflito de serialização do Postgres: outra solicitação venceu a corrida.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return NextResponse.json(
        {
          error: "SOLICITACAO_EXISTENTE",
          message: "Esta data acabou de ficar indisponível para sua função. Escolha outra data.",
        },
        { status: 409 }
      );
    }
    throw e;
  }
}

class AvailabilityError extends Error {
  motivo: string;
  constructor(motivo: string, mensagem: string) {
    super(mensagem);
    this.motivo = motivo;
  }
}
