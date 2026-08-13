import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";

export async function GET(req: Request) {
  const { error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // PENDENTE | ATIVO | INATIVO | null=todos
  const jobFunctionId = searchParams.get("jobFunctionId");

  const employees = await prisma.employee.findMany({
    where: {
      status: status ? (status as any) : undefined,
      functions: jobFunctionId ? { some: { jobFunctionId } } : undefined,
    },
    include: { functions: { include: { jobFunction: true } }, user: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(employees);
}
