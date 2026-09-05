import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const { error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const { session, error } = await requireDirector();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json() as {
    fixedClosedWeekday?: number;
    requestsRequireApproval?: boolean;
    pendingRequestHoldsSlot?: boolean;
    allowSelfServiceCompensatoria?: boolean;
  };

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.settings.update({ where: { id: 1 }, data: body });
    await logAudit(tx, {
      actorId: session!.user.id,
      action: "SETTINGS_UPDATED",
      targetType: "Settings",
      targetId: "1",
      metadata: body,
    });
    return s;
  });

  return NextResponse.json(updated);
}
