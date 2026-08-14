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
  FUNCAO_FECHADA_NO_DIA: "🏠",
};

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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
  const [selected, setSelected] = useState<DayStatus | null>(null);
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
      body: JSON.stringify({ type, date: selected.date }),
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

  const [year, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const monthLabel = `${MESES[m - 1]} de ${year}`;
  const daysByDate = new Map(days.map((d) => [d.date, d]));
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const cells: (DayStatus | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(daysByDate.get(iso) ?? null);
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => {
            const prev = new Date(Date.UTC(year, m - 2, 1));
            setMonth(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`);
          }}
        >
          ← Anterior
        </button>
        <p className="font-display font-semibold text-carvao-900">{monthLabel}</p>
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => {
            const next = new Date(Date.UTC(year, m, 1));
            setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
          }}
        >
          Próximo →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="py-1 text-xs font-semibold uppercase text-carvao-500">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dayNum = Number(d.date.slice(-2));
          const isSelected = selected?.date === d.date;
          return (
            <button
              key={i}
              disabled={!d.disponivel}
              onClick={() => setSelected(d)}
              title={d.disponivel ? "Disponível" : d.mensagem}
              className={`aspect-square rounded-card border text-sm font-semibold transition ${
                isSelected
                  ? "border-vinho-500 bg-vinho-500 text-white"
                  : d.disponivel
                    ? "border-oliva-400 bg-oliva-50 text-carvao-900 hover:bg-oliva-100"
                    : "border-carvao-100 bg-carvao-50 text-carvao-300"
              }`}
            >
              {dayNum}
            </button>
          );
        })}
        {days.length === 0 && (
          <p className="col-span-7 py-4 text-sm text-carvao-500">Nenhuma data aplicável neste mês.</p>
        )}
      </div>

      {selected && (
        <p className="mt-3 text-sm text-carvao-700">
          {motivoEmoji[selected.motivo] ?? "🟢"} Dia {Number(selected.date.slice(-2))} de {MESES[m - 1]}{" "}
          selecionado.
        </p>
      )}
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
