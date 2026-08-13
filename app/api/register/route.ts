import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { fullName, whatsapp, jobFunctionId, password } = parsed.data;

  const jobFunction = await prisma.jobFunction.findUnique({ where: { id: jobFunctionId } });
  if (!jobFunction || !jobFunction.active) {
    return NextResponse.json({ error: "Função inválida." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: whatsapp } });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um cadastro com este WhatsApp." },
      { status: 409 }
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

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
        functions: {
          create: { jobFunctionId, role: "PRINCIPAL" },
        },
      },
    });

    await logAudit(tx, {
      actorId: null,
      action: "EMPLOYEE_REGISTERED",
      targetType: "Employee",
      targetId: employee.id,
      metadata: { fullName, whatsapp, jobFunctionId },
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
