"use client";

import { useEffect, useState } from "react";

type LeaveEntry = {
  id: string;
  date: string;
  type: "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA";
  status: string;
  employeeName: string;
  jobFunctionName: string;
  sector: string;
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

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function AdminLeaveCalendar() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [entries, setEntries] = useState<LeaveEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [changingDateId, setChangingDateId] = useState<string | null>(null);
  const [newDateValue, setNewDateValue] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>("Todos");

  async function load() {
    const res = await fetch(`/api/admin/leave-requests?month=${month}`);
    setEntries(await res.json());
  }

  useEffect(() => {
    load();
    setSelectedDate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function cancelarDireto(id: string) {
    if (!confirm("Cancelar essa folga direto? A pessoa fica livre pra escolher outra data.")) return;
    setBusyId(id);
    await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCELAR_DIRETO" }),
    });
    setBusyId(null);
    load();
  }

  function abrirMudarData(id: string, dataAtual: string) {
    setChangingDateId(id);
    setNewDateValue(dataAtual);
    setChangeError(null);
  }

  async function confirmarMudarData(id: string) {
    if (!newDateValue) return;
    setBusyId(id);
    setChangeError(null);
    const res = await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ALTERAR_DATA", date: newDateValue }),
    });
    setBusyId(null);
    if (res.ok) {
      setChangingDateId(null);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setChangeError(data?.error ?? "Não foi possível mudar a data.");
    }
  }

  const [year, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const monthLabel = `${MESES[m - 1]} de ${year}`;
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const setores = ["Todos", ...Array.from(new Set(entries.map((e) => e.sector))).sort()];
  const entriesDoSetor =
    sectorFilter === "Todos" ? entries : entries.filter((e) => e.sector === sectorFilter);

  const entriesByDate = new Map<string, LeaveEntry[]>();
  for (const e of entriesDoSetor) {
    const ativas = e.status !== "CANCELADA" && e.status !== "RECUSADA";
    if (!ativas) continue;
    const list = entriesByDate.get(e.date) ?? [];
    list.push(e);
    entriesByDate.set(e.date, list);
  }

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  const selectedEntries = selectedDate ? (entriesByDate.get(selectedDate) ?? []) : [];

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

      {setores.length > 2 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {setores.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSectorFilter(s);
                setSelectedDate(null);
              }}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                sectorFilter === s
                  ? "bg-vinho-500 text-crosta-50"
                  : "border border-carvao-100 bg-white text-carvao-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="py-1 text-xs font-semibold uppercase text-carvao-500">
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const dayNum = Number(iso.slice(-2));
          const dayEntries = entriesByDate.get(iso) ?? [];
          const temAprovada = dayEntries.some((e) => e.status === "APROVADA");
          const isSelected = selectedDate === iso;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(isSelected ? null : iso)}
              className={`relative aspect-square rounded-card border text-sm font-semibold transition ${
                isSelected
                  ? "border-vinho-500 bg-vinho-500 text-white"
                  : temAprovada
                    ? "border-vinho-400 bg-vinho-50 text-carvao-900 hover:bg-vinho-100"
                    : dayEntries.length > 0
                      ? "border-crosta-500 bg-crosta-50 text-carvao-900 hover:bg-crosta-100"
                      : "border-carvao-100 bg-white text-carvao-500 hover:bg-crosta-50"
              }`}
            >
              {dayNum}
              {dayEntries.length > 0 && (
                <span
                  className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-bold ${
                    isSelected ? "bg-white text-vinho-500" : temAprovada ? "bg-vinho-500 text-white" : "bg-crosta-500 text-white"
                  }`}
                >
                  {dayEntries.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-carvao-500">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-vinho-400 align-middle" /> aprovada ·{" "}
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-crosta-500 align-middle" /> pendente. Toque num dia
        pra ver quem folgou.
      </p>

      {selectedDate && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-carvao-900">
            {Number(selectedDate.slice(-2))} de {MESES[m - 1]}
          </p>
          {selectedEntries.length === 0 && (
            <p className="text-sm text-carvao-500">Ninguém folgando nesse dia.</p>
          )}
          {selectedEntries.map((e) => (
            <div key={e.id} className="rounded-card border border-carvao-100 bg-crosta-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-carvao-900">{e.employeeName}</p>
                  <p className="text-xs text-carvao-500">
                    {e.jobFunctionName} · {typeLabel[e.type]} ·{" "}
                    <span
                      className={
                        e.status === "APROVADA"
                          ? "text-oliva-500"
                          : e.status === "CANCELAMENTO_SOLICITADO"
                            ? "text-vinho-500"
                            : "text-crosta-500"
                      }
                    >
                      {statusLabel[e.status] ?? e.status}
                    </span>
                  </p>
                </div>
                {(e.status === "PENDENTE" || e.status === "APROVADA") && changingDateId !== e.id && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      onClick={() => abrirMudarData(e.id, e.date)}
                      className="text-xs font-semibold text-carvao-700 hover:underline"
                    >
                      Mudar data
                    </button>
                    <button
                      disabled={busyId === e.id}
                      onClick={() => cancelarDireto(e.id)}
                      className="text-xs font-semibold text-vinho-500 hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {changingDateId === e.id && (
                <div className="mt-3 space-y-2">
                  <input
                    type="date"
                    className="field-input"
                    value={newDateValue}
                    onChange={(ev) => setNewDateValue(ev.target.value)}
                  />
                  {changeError && <p className="text-xs text-vinho-500">{changeError}</p>}
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === e.id || !newDateValue}
                      onClick={() => confirmarMudarData(e.id)}
                      className="btn-primary flex-1 text-xs"
                    >
                      Confirmar nova data
                    </button>
                    <button
                      disabled={busyId === e.id}
                      onClick={() => setChangingDateId(null)}
                      className="btn-secondary flex-1 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
