import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { calcularSaldoCredito } from "@/lib/availability";
import { hashPassword } from "@/lib/password";

// Ficha completa do funcionário (spec seção 31).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      functions: { include: { jobFunction: true } },
      user: { select: { username: true } },
    },
  });
  if (!employee) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const [comp, extra, nextLeave, creditTransactions] = await Promise.all([
    calcularSaldoCredito(prisma, params.id, "COMPENSATORIA"),
    calcularSaldoCredito(prisma, params.id, "EXTRA"),
    prisma.leaveRequest.findFirst({
      where: { employeeId: params.id, status: "APROVADA", date: { gte: new Date() } },
      orderBy: { date: "asc" },
    }),
    prisma.leaveCreditTransaction.findMany({
      where: { employeeId: params.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ ...employee, comp, extra, nextLeave, creditTransactions });
}

type Action =
  | { action: "APROVAR" }
  | { action: "RECUSAR" }
  | { action: "DESATIVAR" }
  | { action: "REATIVAR" }
  | { action: "ALTERAR_FUNCAO_PRINCIPAL"; jobFunctionId: string }
  | { action: "ADICIONAR_FUNCAO_SECUNDARIA"; jobFunctionId: string }
  | { action: "REMOVER_FUNCAO_SECUNDARIA" }
  | { action: "ALTERAR_FOLGA_SEMANAL"; weeklyDayOff: number | null }
  | { action: "REDEFINIR_SENHA" };

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = (await req.json()) as Action;
  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    switch (body.action) {
      case "APROVAR": {
        if (employee.status !== "PENDENTE") throw new Error("Só é possível aprovar cadastros pendentes.");
        await tx.user.update({ where: { id: employee.userId }, data: { status: "ATIVO" } });
        const updated = await tx.employee.update({
          where: { id: params.id },
          data: { status: "ATIVO", approvedAt: new Date(), approvedById: session!.user.id },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_APPROVED",
          targetType: "Employee",
          targetId: params.id,
        });
        return updated;
      }
      case "RECUSAR": {
        if (employee.status !== "PENDENTE") throw new Error("Só é possível recusar cadastros pendentes.");
        await tx.user.update({ where: { id: employee.userId }, data: { status: "INATIVO" } });
        const updated = await tx.employee.update({
          where: { id: params.id },
          data: { status: "RECUSADO" },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_REFUSED",
          targetType: "Employee",
          targetId: params.id,
        });
        return updated;
      }
      case "DESATIVAR": {
        // Demissão: DESATIVAR, nunca excluir (seção 32-33). Histórico preservado.
        await tx.user.update({ where: { id: employee.userId }, data: { status: "INATIVO" } });
        const updated = await tx.employee.update({
          where: { id: params.id },
          data: { status: "INATIVO", deactivatedAt: new Date() },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_DEACTIVATED",
          targetType: "Employee",
          targetId: params.id,
        });
        return updated;
      }
      case "REATIVAR": {
        if (employee.status !== "INATIVO") throw new Error("Só é possível reativar quem está inativo.");
        await tx.user.update({ where: { id: employee.userId }, data: { status: "ATIVO" } });
        const updated = await tx.employee.update({
          where: { id: params.id },
          data: { status: "ATIVO", deactivatedAt: null },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_REACTIVATED",
          targetType: "Employee",
          targetId: params.id,
        });
        return updated;
      }
      case "ALTERAR_FUNCAO_PRINCIPAL": {
        await tx.employeeFunction.upsert({
          where: { employeeId_role: { employeeId: params.id, role: "PRINCIPAL" } },
          update: { jobFunctionId: body.jobFunctionId },
          create: { employeeId: params.id, role: "PRINCIPAL", jobFunctionId: body.jobFunctionId },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_PRIMARY_FUNCTION_CHANGED",
          targetType: "Employee",
          targetId: params.id,
          metadata: { jobFunctionId: body.jobFunctionId },
        });
        return tx.employee.findUnique({ where: { id: params.id }, include: { functions: true } });
      }
      case "ALTERAR_FOLGA_SEMANAL": {
        if (body.weeklyDayOff !== null && (body.weeklyDayOff < 0 || body.weeklyDayOff > 6)) {
          throw new Error("Dia da semana inválido.");
        }
        const updated = await tx.employee.update({
          where: { id: params.id },
          data: { weeklyDayOff: body.weeklyDayOff },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_WEEKLY_DAY_OFF_CHANGED",
          targetType: "Employee",
          targetId: params.id,
          metadata: { weeklyDayOff: body.weeklyDayOff },
        });
        return updated;
      }
      case "ADICIONAR_FUNCAO_SECUNDARIA": {
        // Só o Diretor pode fazer isso (seção 9).
        await tx.employeeFunction.upsert({
          where: { employeeId_role: { employeeId: params.id, role: "SECUNDARIA" } },
          update: { jobFunctionId: body.jobFunctionId },
          create: { employeeId: params.id, role: "SECUNDARIA", jobFunctionId: body.jobFunctionId },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_SECONDARY_FUNCTION_SET",
          targetType: "Employee",
          targetId: params.id,
          metadata: { jobFunctionId: body.jobFunctionId },
        });
        return tx.employee.findUnique({ where: { id: params.id }, include: { functions: true } });
      }
      case "REMOVER_FUNCAO_SECUNDARIA": {
        await tx.employeeFunction.deleteMany({
          where: { employeeId: params.id, role: "SECUNDARIA" },
        });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_SECONDARY_FUNCTION_REMOVED",
          targetType: "Employee",
          targetId: params.id,
        });
        return tx.employee.findUnique({ where: { id: params.id }, include: { functions: true } });
      }
      case "REDEFINIR_SENHA": {
        // Não há e-mail/WhatsApp Business API configurado (seção 3 da pendência
        // do README): a Direção gera uma senha temporária aqui e repassa
        // manualmente para a pessoa (WhatsApp, presencial). Só aparece uma vez
        // nesta resposta — nunca é salva em texto puro.
        const tempPassword = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(tempPassword);
        await tx.user.update({ where: { id: employee.userId }, data: { passwordHash } });
        await logAudit(tx, {
          actorId: session!.user.id,
          action: "EMPLOYEE_PASSWORD_RESET",
          targetType: "Employee",
          targetId: params.id,
        });
        return { tempPassword };
      }
      default:
        throw new Error("Ação inválida.");
    }
  });

  return NextResponse.json(result);
}

// DELETE /api/employees/[id]
// Exclusão de verdade (apaga o registro), diferente de DESATIVAR — pensada
// pra corrigir cadastro feito errado (ex: duplicado sem querer), não pra
// demissão. Só é permitida quando o funcionário nunca teve nenhuma folga
// nem crédito lançado: as tabelas de folgas/créditos têm ON DELETE RESTRICT
// pra Employee de propósito, então qualquer histórico real bloqueia a
// exclusão automaticamente (Postgres recusa e a transação é desfeita) —
// nesse caso a Direção usa "Desativar" pra manter o histórico.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        actorId: session!.user.id,
        action: "EMPLOYEE_DELETED",
        targetType: "Employee",
        targetId: params.id,
        metadata: { fullName: employee.fullName, whatsapp: employee.whatsapp },
      });
      // Apaga o User: por cascata (onDelete: Cascade no schema), o próprio
      // Employee e suas EmployeeFunction somem junto.
      await tx.user.delete({ where: { id: employee.userId } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        {
          error: "Esse funcionário já tem folgas ou créditos registrados — excluir apagaria esse histórico. Use \"Desativar\" pra manter o histórico e tirar o acesso dela.",
        },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({ deleted: true });
}
