"use client";

import { useEffect, useState } from "react";
import { LeaveCalendar } from "@/components/LeaveCalendar";

type Summary = {
  fullName: string;
  principalFunction: string;
  compensatoria: { total: number; reservado: number; disponivel: number };
  extra: { total: number; reservado: number; disponivel: number };
  domingoDisponivel: boolean;
  nextLeave: { date: string; type: string } | null;
};

type LeaveType = "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA" | null;

export default function FuncionarioHome() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeAction, setActiveAction] = useState<LeaveType>(null);

  async function load() {
    const res = await fetch("/api/funcionario/summary");
    setSummary(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  if (!summary) return <p className="text-carvao-500">Carregando…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-carvao-900">Olá, {summary.fullName}!</h2>
        <p className="text-carvao-500">{summary.principalFunction}</p>
      </div>

      <div className="card">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-carvao-500">Meus saldos</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-display text-2xl font-semibold text-vinho-500">
              {summary.domingoDisponivel ? "✓" : "—"}
            </p>
            <p className="text-xs text-carvao-500">Domingo</p>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-vinho-500">
              {summary.compensatoria.disponivel}
            </p>
            <p className="text-xs text-carvao-500">Compensatória</p>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-vinho-500">{summary.extra.disponivel}</p>
            <p className="text-xs text-carvao-500">Extra</p>
          </div>
        </div>
      </div>

      {summary.nextLeave && (
        <div className="card border-oliva-400 bg-oliva-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-oliva-500">Próxima folga</p>
          <p className="font-display text-lg font-semibold text-carvao-900">
            {new Date(summary.nextLeave.date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              timeZone: "UTC",
            })}
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-carvao-500">Ações</p>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => setActiveAction(activeAction === "DOMINGO_MES" ? null : "DOMINGO_MES")}
            className="btn-secondary justify-start"
          >
            Escolher domingo
          </button>
          <button
            onClick={() => setActiveAction(activeAction === "COMPENSATORIA" ? null : "COMPENSATORIA")}
            disabled={summary.compensatoria.disponivel <= 0}
            className="btn-secondary justify-start"
          >
            Usar compensatória
          </button>
          <button
            onClick={() => setActiveAction(activeAction === "EXTRA" ? null : "EXTRA")}
            disabled={summary.extra.disponivel <= 0}
            className="btn-secondary justify-start"
          >
            Usar extra
          </button>
          <a href="/funcionario/solicitacoes" className="btn-secondary justify-start">
            Minhas solicitações
          </a>
        </div>
      </div>

      {activeAction && <LeaveCalendar type={activeAction} onRequested={load} />}
    </div>
  );
}
