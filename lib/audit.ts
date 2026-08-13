import { Prisma, PrismaClient } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

/**
 * Registra uma entrada no histórico (AUDIT_LOG). Deve ser chamado de dentro
 * da MESMA transação da alteração de dados, para que histórico e estado
 * nunca fiquem dessincronizados (seção 34: "Nada disso deverá desaparecer").
 */
export async function logAudit(
  tx: TxClient,
  params: {
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
