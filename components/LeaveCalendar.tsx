"use client";

import { useEffect, useState } from "react";

type DayStatus = {
  date: string;
  disponivel: boolean;
  motivo: string;
  mensagem: string;
};

const motivoEmoji: Record<string, string> = {
  DISPONIVEL: "🟢",
  LOJA_FECHADA: "🏠",
  DATA_BLOQUEADA: "🔒",
  CONFLITO_FUNCAO: "🔒",
  SEM_CREDITO: "🔒",
  DOMINGO_JA_UTILIZADO: "🔒",
  DIA_INVALIDO: "🔒",
  FUNCIONARIO_INATIVO: "🔒",
  SOLICITACAO_EXISTENTE: "⏳",
};

export function LeaveCalendar({
  type,
  onRequested,
}: {
  type: "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA";
  onRequested: () => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [days, setDays] = useState<DayStatus[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/leave-requests/availability?type=${type}&month=${month}`);
    setDays(await res.json());
  }

  useEffect(() => {
    load();
    setSelected(null);
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, type]);

  async function confirmar() {
    if (!selected) return;
    setSubmitting(true);
    setFeedback(null);
    const res = await fetch("/api/leave-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, date: selected }),
    });
    setSubmitting(false);
    if (res.ok) {
      setFeedback("Solicitação enviada. Aguardando aprovação da Direção.");
      setSelected(null);
      load();
      onRequested();
    } else {
      const data = await res.json();
      setFeedback(data.message ?? "Não foi possível concluir a solicitação.");
      load();
    }
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => {
            const [y, m] = month.split("-").map(Number);
            const prev = new Date(Date.UTC(y, m - 2, 1));
            setMonth(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`);
          }}
        >
          ← Anterior
        </button>
        <p className="font-display font-semibold text-carvao-900">{month}</p>
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => {
            const [y, m] = month.split("-").map(Number);
            const next = new Date(Date.UTC(y, m, 1));
            setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
          }}
        >
          Próximo →
        </button>
      </div>

      <ul className="max-h-72 space-y-1.5 overflow-y-auto">
        {days.map((d) => {
          const dayNum = Number(d.date.slice(-2));
          const isSelected = selected === d.date;
          return (
            <li key={d.date}>
              <button
                disabled={!d.disponivel}
                onClick={() => setSelected(d.date)}
                className={`flex w-full items-center justify-between rounded-card border px-3 py-2 text-left text-sm ${
                  isSelected
                    ? "border-vinho-500 bg-vinho-50"
                    : d.disponivel
                      ? "border-carvao-100 bg-white hover:bg-crosta-50"
                      : "border-carvao-100 bg-carvao-50 text-carvao-300"
                }`}
              >
                <span>
                  {motivoEmoji[d.motivo] ?? "🟢"} Dia {dayNum}
                </span>
                <span className="text-xs">{d.disponivel ? "Disponível" : d.mensagem}</span>
              </button>
            </li>
          );
        })}
        {days.length === 0 && <p className="text-sm text-carvao-500">Nenhuma data aplicável neste mês.</p>}
      </ul>

      {feedback && <p className="mt-3 text-sm text-carvao-700">{feedback}</p>}

      <button
        disabled={!selected || submitting}
        onClick={confirmar}
        className="btn-primary mt-4 w-full"
      >
        {submitting ? "Enviando…" : "Solicitar"}
      </button>
    </div>
  );
}
