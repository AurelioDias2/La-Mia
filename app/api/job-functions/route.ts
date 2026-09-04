import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { jobFunctionSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

// Público (sem auth) por padrão: a tela de cadastro precisa listar as funções
// ativas. Com ?all=1 (só Diretor), lista todas — inclusive inativas, pra tela
// "Funções" conseguir mostrar o botão "Reativar".
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("all")) {
    const { error } = await requireDirector();
    if (error) return NextResponse.json({ error }, { status: 401 });
    const all = await prisma.jobFunction.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(all);
  }

  const functions = await prisma.jobFunction.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(functions);
}

// Só o Diretor cria novas funções (seção 8: "Funcionários não poderão fazer isso").
export async function POST(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json();
  const parsed = jobFunctionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const jobFunction = await prisma.$transaction(async (tx) => {
    const f = await tx.jobFunction.create({ data: parsed.data });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "JOB_FUNCTION_CREATED",
      targetType: "JobFunction",
      targetId: f.id,
      metadata: parsed.data,
    });
    return f;
  });

  return NextResponse.json(jobFunction, { status: 201 });
}
