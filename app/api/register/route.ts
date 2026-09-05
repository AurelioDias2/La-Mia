import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { fullName, whatsapp, jobFunctionId, secondaryJobFunctionId, weeklyDayOff, password } = parsed.data;

  const jobFunction = await prisma.jobFunction.findUnique({ where: { id: jobFunctionId } });
  if (!jobFunction || !jobFunction.active) {
    return NextResponse.json({ error: "Função inválida." }, { status: 400 });
  }

  if (secondaryJobFunctionId) {
    const secondary = await prisma.jobFunction.findUnique({ where: { id: secondaryJobFunctionId } });
    if (!secondary || !secondary.active) {
      return NextResponse.json({ error: "Função secundária inválida." }, { status: 400 });
    }
  }

  const existing = await prisma.user.findUnique({ where: { username: whatsapp } });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um cadastro com este WhatsApp." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  const employee = await prisma.$transaction(async (tx) => {
    // O perfil é sempre FUNCIONARIO — nunca vem do formulário (seção 2:
    // "Um funcionário jamais poderá escolher 'Administrador' no cadastro").
    const user = await tx.user.create({
      data: {
        username: whatsapp,
        passwordHash,
        role: "FUNCIONARIO",
        status: "PENDENTE",
      },
    });

    const employee = await tx.employee.create({
      data: {
        userId: user.id,
        fullName,
        whatsapp,
        status: "PENDENTE",
        weeklyDayOff: weeklyDayOff ?? null,
        functions: {
          create: [
            { jobFunctionId, role: "PRINCIPAL" },
            ...(secondaryJobFunctionId
              ? [{ jobFunctionId: secondaryJobFunctionId, role: "SECUNDARIA" as const }]
              : []),
          ],
        },
      },
    });

    await logAudit(tx, {
      actorId: null,
      action: "EMPLOYEE_REGISTERED",
      targetType: "Employee",
      targetId: employee.id,
      metadata: { fullName, whatsapp, jobFunctionId, secondaryJobFunctionId },
    });

    return employee;
  });

  return NextResponse.json(
    {
      message:
        "Cadastro realizado com sucesso. Aguarde a aprovação da Direção da La Mia Dolce Vita.",
      employeeId: employee.id,
    },
    { status: 201 }
  );
}
