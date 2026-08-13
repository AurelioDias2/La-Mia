import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "./db";
import { criarDiretor } from "./helpers";
import { logAudit } from "../lib/audit";

// Histórico imutável (spec seção 34): toda alteração relevante grava uma
// entrada em AuditLog com quem fez, o quê, e em cima de qual registro.
describe("logAudit", () => {
  beforeEach(resetDb);

  it("grava uma entrada com actor, ação, alvo e metadados", async () => {
    const diretor = await criarDiretor();

    await logAudit(prisma, {
      actorId: diretor.id,
      action: "CREDIT_GRANTED",
      targetType: "Employee",
      targetId: "algum-id-de-funcionario",
      metadata: { creditType: "EXTRA", amount: 2, reason: "Cobertura de turno" },
    });

    const entries = await prisma.auditLog.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorId: diretor.id,
      action: "CREDIT_GRANTED",
      targetType: "Employee",
      targetId: "algum-id-de-funcionario",
      metadata: { creditType: "EXTRA", amount: 2, reason: "Cobertura de turno" },
    });
  });
});
