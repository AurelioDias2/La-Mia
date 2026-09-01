"use client";

import { useEffect, useState } from "react";

type LeaveEntry = {
  id: string;
  date: string;
  type: "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA";
  status: string;
  employeeName: string;
  jobFunctionName: string;
};

const typeLabel: Record<LeaveEntry["type"], string> = {
  DOMINGO_MES: "Domingo do mês",
  COMPENSATORIA: "Compensatória",
  EXTRA: "Folga extra",
};

const statusLabel: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  CANCELAMENTO_SOLICITADO: "Cancelamento pedido",
  CANCELADA: "Cancelada",
  UTILIZADA: "Utilizada",
};

const statusColor: Record<string, string> = {
  PENDENTE: "bg-crosta-100 text-crosta-600",
  APROVADA: "bg-oliva-50 text-oliva-500",
  RECUSADA: "bg-carvao-100 text-carvao-500",
  CANCELAMENTO_SOLICITADO: "bg-vinho-50 text-vinho-500",
  CANCELADA: "bg-carvao-100 text-carvao-500",
  UTILIZADA: "bg-oliva-50 text-oliva-500",
};

const filtros = ["Ativas", "Todas"] as const;

export default function ListaFolgasPage() {
  const [entries, setEntries] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<(typeof filtros)[number]>("Ativas");

  useEffect(() => {
    fetch("/api/admin/leave-requests")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      });
  }, []);

  const visiveis = entries
    .filter((e) => filtro === "Todas" || (e.status !== "CANCELADA" && e.status !== "RECUSADA"))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">Lista de folgas</h1>
      <p className="mb-4 text-sm text-carvao-500">
        Todo mundo que já pediu folga, com data, função e status — em ordem cronológica.
      </p>

      <div className="mb-5 flex gap-2">
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${
              filtro === f ? "bg-vinho-500 text-crosta-50" : "bg-white text-carvao-600 border border-carvao-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-carvao-500">Carregando…</p>}
      {!loading && visiveis.length === 0 && (
        <p className="text-carvao-500">Nenhuma folga registrada ainda.</p>
      )}

      <div className="space-y-2">
        {visiveis.map((e) => (
          <div key={e.id} className="card flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-carvao-900">{e.employeeName}</p>
              <p className="text-sm text-carvao-500">
                {new Date(e.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {e.jobFunctionName} ·{" "}
                {typeLabel[e.type]}
              </p>
            </div>
            <span className={`pill shrink-0 ${statusColor[e.status] ?? "bg-carvao-100 text-carvao-500"}`}>
              {statusLabel[e.status] ?? e.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
