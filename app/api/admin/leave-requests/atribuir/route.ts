import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";

type Body = {
  employeeIds: string[];
  type: "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA";
  date: string; // "YYYY-MM-DD"
};

// POST /api/admin/leave-requests/atribuir
// A Direção atribui uma folga direto pra uma ou várias pessoas (setor
// inteiro ou seleção), sem passar pelo autoatendimento — pensado pro caso de
// Produção e Serviços Gerais, cuja folga é uma escala definida pela Direção,
// não domingo do mês fixo em domingo nem crédito acumulado. Por isso o
// domingo do mês aqui pode cair em qualquer dia da semana (diferente do
// autoatendimento, que exige domingo de verdade). Ignora de propósito toda a
// checagem de verificarDisponibilidade (conflito de função, crédito etc.):
// é uma decisão manual da Direção, igual ALTERAR_DATA/CANCELAR_DIRETO.
export async function POST(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.employeeIds?.length || !body.type || !body.date) {
    return NextResponse.json({ error: "Informe as pessoas, o tipo e a data." }, { status: 400 });
  }

  const date = new Date(`${body.date}T00:00:00.000Z`);

  let criados = 0;
  let trocados = 0;
  const erros: { employeeId: string; nome: string; message: string }[] = [];

  for (const employeeId of body.employeeIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { id: employeeId },
          include: { functions: { where: { role: "PRINCIPAL" } } },
        });
        const jobFunctionId = employee?.functions[0]?.jobFunctionId;
        if (!employee || !jobFunctionId) {
          throw new Error("Funcionário sem função principal.");
        }

        let trocouEssa = false;

        if (body.type === "DOMINGO_MES") {
          // Troca automática: se já tem um domingo ativo nesse mês, cancela
          // antes de criar o novo (cobre "às vezes trocam o domingo").
          const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
          const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
          const existente = await tx.leaveRequest.findFirst({
            where: {
              employeeId,
              type: "DOMINGO_MES",
              date: { gte: monthStart, lt: monthEnd },
              status: { in: ["PENDENTE", "APROVADA"] },
            },
          });
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
              metadata: { motivo: "Trocado por atribuição em massa" },
            });
            trocouEssa = true;
          }

          const novo = await tx.leaveRequest.create({
            data: {
              employeeId,
              jobFunctionId,
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
            metadata: { type: body.type, date: body.date },
          });
        } else {
          // Compensatória/Extra: concede e já consome 1 crédito na mesma
          // transação, pra pessoa não precisar ter saldo acumulado — é a
          // Direção decidindo a escala dela diretamente.
          const concessao = await tx.leaveCreditTransaction.create({
            data: {
              employeeId,
              creditType: body.type,
              kind: "CONCESSAO",
              amount: 1,
              reason: "Atribuição direta da Direção (escala)",
              createdById: session!.user.id,
            },
          });
          const consumo = await tx.leaveCreditTransaction.create({
            data: {
              employeeId,
              creditType: body.type,
              kind: "CONSUMO",
              amount: -1,
              reason: "Uso de crédito para folga atribuída pela Direção",
              createdById: session!.user.id,
            },
          });
          const novo = await tx.leaveRequest.create({
            data: {
              employeeId,
              jobFunctionId,
              type: body.type,
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
            metadata: { type: body.type, date: body.date, concessaoId: concessao.id },
          });
        }

        if (trocouEssa) trocados++;
        else criados++;
      });
    } catch (e) {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      erros.push({
        employeeId,
        nome: employee?.fullName ?? employeeId,
        message: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  return NextResponse.json({ criados, trocados, erros });
}
