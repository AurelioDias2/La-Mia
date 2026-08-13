import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";

export async function GET(req: Request) {
  const { error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get("targetType") ?? undefined;
  const targetId = searchParams.get("targetId") ?? undefined;

  const entries = await prisma.auditLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(entries);
}
