"use client";

import { useEffect, useState } from "react";

type Summary = {
  activeEmployees: number;
  pendingRegistrations: number;
  pendingRequests: number;
  leavesToday: number;
  leavesNext7Days: number;
  pendingCancellations: number;
  compensatoriasDisponiveis: number;
  extrasDisponiveis: number;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-vinho-500">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/admin/summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-vinho-500">La Mia Dolce Vita</h1>
      <p className="mb-6 text-carvao-500">Painel do Diretor</p>

      {!summary ? (
        <p className="text-carvao-500">Carregando…</p>
      ) : (
        <>
          {(summary.pendingRegistrations > 0 ||
            summary.pendingRequests > 0 ||
            summary.pendingCancellations > 0) && (
            <div className="card mb-6 space-y-1 border-crosta-400 bg-crosta-50">
              <p className="text-sm font-semibold text-carvao-700">Avisos</p>
              {summary.pendingRegistrations > 0 && (
                <p className="text-sm text-carvao-600">
                  {summary.pendingRegistrations} novo(s) cadastro(s) aguardando aprovação
                </p>
              )}
              {summary.pendingRequests > 0 && (
                <p className="text-sm text-carvao-600">
                  {summary.pendingRequests} solicitação(ões) aguardando aprovação
                </p>
              )}
              {summary.pendingCancellations > 0 && (
                <p className="text-sm text-carvao-600">
                  {summary.pendingCancellations} solicitação(ões) de cancelamento
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Funcionários ativos" value={summary.activeEmployees} />
            <StatCard label="Cadastros pendentes" value={summary.pendingRegistrations} />
            <StatCard label="Solicitações pendentes" value={summary.pendingRequests} />
            <StatCard label="Folgas hoje" value={summary.leavesToday} />
            <StatCard label="Folgas próximos 7 dias" value={summary.leavesNext7Days} />
            <StatCard label="Cancelamentos pendentes" value={summary.pendingCancellations} />
            <StatCard label="Compensatórias disponíveis" value={summary.compensatoriasDisponiveis} />
            <StatCard label="Extras disponíveis" value={summary.extrasDisponiveis} />
          </div>
        </>
      )}
    </div>
  );
}
