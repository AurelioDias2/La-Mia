"use client";

import { useEffect, useState } from "react";

type LeaveRequest = {
  id: string;
  type: "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA";
  date: string;
  status: string;
  requestedAt: string;
  employee: { fullName: string };
  jobFunction: { name: string };
};

const typeLabel: Record<LeaveRequest["type"], string> = {
  DOMINGO_MES: "Domingo do mês",
  COMPENSATORIA: "Compensatória",
  EXTRA: "Folga extra",
};

export default function SolicitacoesPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/leave-requests");
    setRequests(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: string) {
    setBusyId(id);
    await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    load();
  }

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">
        Solicitações pendentes
      </h1>

      <div className="space-y-3">
        {requests.length === 0 && <p className="text-carvao-500">Nenhuma solicitação pendente.</p>}
        {requests.map((r) => (
          <div key={r.id} className="card">
            <p className="font-semibold text-carvao-900">{r.employee.fullName}</p>
            <p className="text-sm text-carvao-500">Função: {r.jobFunction.name}</p>
            <p className="text-sm text-carvao-500">Tipo: {typeLabel[r.type]}</p>
            <p className="text-sm text-carvao-500">
              Data solicitada: {new Date(r.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            </p>
            <p className="text-xs text-carvao-300">
              Solicitado em: {new Date(r.requestedAt).toLocaleString("pt-BR")}
            </p>

            <div className="mt-3 flex gap-2">
              {r.status === "PENDENTE" && (
                <>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "APROVAR")}
                    className="btn-primary flex-1 text-sm"
                  >
                    Aprovar
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "RECUSAR")}
                    className="btn-secondary flex-1 text-sm"
                  >
                    Recusar
                  </button>
                </>
              )}
              {r.status === "CANCELAMENTO_SOLICITADO" && (
                <>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "APROVAR_CANCELAMENTO")}
                    className="btn-primary flex-1 text-sm"
                  >
                    Aprovar cancelamento
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "RECUSAR_CANCELAMENTO")}
                    className="btn-secondary flex-1 text-sm"
                  >
                    Recusar cancelamento
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
