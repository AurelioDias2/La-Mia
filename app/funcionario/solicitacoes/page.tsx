"use client";

import { useEffect, useState } from "react";

type LeaveRequest = {
  id: string;
  type: "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA";
  date: string;
  status:
    | "PENDENTE"
    | "APROVADA"
    | "RECUSADA"
    | "CANCELAMENTO_SOLICITADO"
    | "CANCELADA"
    | "UTILIZADA";
  requestedAt: string;
  jobFunction: { name: string };
};

const typeLabel: Record<LeaveRequest["type"], string> = {
  DOMINGO_MES: "Domingo do mês",
  COMPENSATORIA: "Compensatória",
  EXTRA: "Folga extra",
};

const statusLabel: Record<LeaveRequest["status"], { text: string; className: string }> = {
  PENDENTE: { text: "⏳ Aguardando aprovação", className: "bg-crosta-100 text-crosta-600" },
  APROVADA: { text: "✅ Folga confirmada", className: "bg-oliva-50 text-oliva-500" },
  RECUSADA: { text: "Solicitação recusada", className: "bg-vinho-50 text-vinho-500" },
  CANCELAMENTO_SOLICITADO: {
    text: "Cancelamento aguardando aprovação",
    className: "bg-crosta-100 text-crosta-600",
  },
  CANCELADA: { text: "Cancelada", className: "bg-carvao-100 text-carvao-500" },
  UTILIZADA: { text: "Utilizada", className: "bg-carvao-100 text-carvao-500" },
};

export default function MinhasSolicitacoesPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/leave-requests");
    setRequests(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function pedirCancelamento(id: string) {
    setBusyId(id);
    await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SOLICITAR_CANCELAMENTO" }),
    });
    setBusyId(null);
    load();
  }

  return (
    <div>
      <a href="/funcionario" className="mb-4 inline-block text-sm text-carvao-500 hover:underline">
        ← Voltar
      </a>
      <h1 className="mb-4 font-display text-xl font-semibold text-vinho-500">Minhas solicitações</h1>

      <div className="space-y-3">
        {requests.length === 0 && <p className="text-carvao-500">Nenhuma solicitação ainda.</p>}
        {requests.map((r) => {
          const status = statusLabel[r.status];
          return (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-carvao-900">{typeLabel[r.type]}</p>
                  <p className="text-sm text-carvao-500">
                    {new Date(r.date).toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </p>
                </div>
                <span className={`pill ${status.className}`}>{status.text}</span>
              </div>

              {r.status === "APROVADA" && (
                <button
                  disabled={busyId === r.id}
                  onClick={() => pedirCancelamento(r.id)}
                  className="btn-secondary mt-3 w-full text-sm"
                >
                  Solicitar cancelamento
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
