"use client";

import { useEffect, useState } from "react";

type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

// Traduz os códigos internos de ação para o texto que a seção 34 descreve.
const actionText: Record<string, string> = {
  EMPLOYEE_REGISTERED: "Funcionário se cadastrou",
  EMPLOYEE_APPROVED: "Diretor aprovou o cadastro",
  EMPLOYEE_REFUSED: "Diretor recusou o cadastro",
  EMPLOYEE_DEACTIVATED: "Diretor desativou o funcionário",
  EMPLOYEE_PRIMARY_FUNCTION_CHANGED: "Diretor alterou a função principal",
  EMPLOYEE_SECONDARY_FUNCTION_SET: "Diretor definiu a função secundária",
  LEAVE_REQUESTED: "Funcionário solicitou folga",
  LEAVE_APPROVED: "Diretor aprovou a folga",
  LEAVE_REJECTED: "Diretor recusou a folga",
  LEAVE_CANCEL_REQUESTED: "Funcionário solicitou cancelamento",
  LEAVE_CANCEL_APPROVED: "Diretor aprovou o cancelamento",
  LEAVE_CANCEL_REJECTED: "Diretor recusou o cancelamento",
  CREDIT_GRANTED: "Diretor adicionou crédito",
  CREDIT_CORRECTED: "Diretor corrigiu um crédito",
  HOLIDAY_CREATED: "Diretor cadastrou um feriado",
  DATE_BLOQUEADA: "Diretor bloqueou uma data",
  DATE_BLOCKED: "Diretor bloqueou uma data",
  JOB_FUNCTION_CREATED: "Diretor criou uma função",
  JOB_FUNCTION_UPDATED: "Diretor alterou uma função",
  SETTINGS_UPDATED: "Diretor alterou as configurações",
};

export default function HistoricoPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    fetch("/api/admin/audit-log")
      .then((r) => r.json())
      .then(setEntries);
  }, []);

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">Histórico</h1>
      <div className="space-y-3">
        {entries.length === 0 && <p className="text-carvao-500">Nenhum registro ainda.</p>}
        {entries.map((e) => (
          <div key={e.id} className="card">
            <p className="text-xs text-carvao-300">
              {new Date(e.createdAt).toLocaleString("pt-BR")}
            </p>
            <p className="font-semibold text-carvao-900">{actionText[e.action] ?? e.action}</p>
            {e.metadata && (
              <p className="mt-1 break-words text-sm text-carvao-500">
                {Object.entries(e.metadata)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
