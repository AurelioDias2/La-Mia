import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json() as {
    active?: boolean;
    dailyLeaveLimit?: number;
    name?: string;
    closedWeekday?: number | null;
    followsStoreClosure?: boolean;
  };

  const updated = await prisma.$transaction(async (tx) => {
    const f = await tx.jobFunction.update({
      where: { id: params.id },
      data: {
        active: body.active,
        dailyLeaveLimit: body.dailyLeaveLimit,
        name: body.name,
        closedWeekday: body.closedWeekday,
        followsStoreClosure: body.followsStoreClosure,
      },
    });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "JOB_FUNCTION_UPDATED",
      targetType: "JobFunction",
      targetId: f.id,
      metadata: body,
    });
    return f;
  });

  return NextResponse.json(updated);
}
