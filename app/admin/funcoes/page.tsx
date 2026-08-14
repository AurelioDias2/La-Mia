"use client";

import { useEffect, useState } from "react";

type JobFunction = {
  id: string;
  name: string;
  active: boolean;
  dailyLeaveLimit: number;
  closedWeekday: number | null;
};

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default function FuncoesPage() {
  const [functions, setFunctions] = useState<JobFunction[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/job-functions");
    setFunctions(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    await fetch("/api/job-functions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, dailyLeaveLimit: 1 }),
    });
    setCreating(false);
    setNewName("");
    load();
  }

  async function atualizarLimite(id: string, dailyLeaveLimit: number) {
    await fetch(`/api/job-functions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyLeaveLimit }),
    });
    load();
  }

  async function alternarAtiva(id: string, active: boolean) {
    await fetch(`/api/job-functions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    load();
  }

  async function atualizarFechamento(id: string, value: string) {
    await fetch(`/api/job-functions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closedWeekday: value === "" ? null : parseInt(value, 10) }),
    });
    load();
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">Funções</h1>

      <div className="mb-6 space-y-3">
        {functions.map((f) => (
          <div key={f.id} className="card">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-carvao-900">{f.name}</p>
              <span className={`pill ${f.active ? "bg-oliva-50 text-oliva-500" : "bg-carvao-100 text-carvao-500"}`}>
                {f.active ? "ATIVA" : "INATIVA"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-carvao-600">
                Limite de folgas simultâneas por dia
                <input
                  type="number"
                  min={1}
                  className="field-input w-16 py-1.5"
                  defaultValue={f.dailyLeaveLimit}
                  onBlur={(e) => atualizarLimite(f.id, parseInt(e.target.value, 10) || 1)}
                />
              </label>
              <button className="btn-secondary text-xs" onClick={() => alternarAtiva(f.id, f.active)}>
                {f.active ? "Desativar" : "Reativar"}
              </button>
            </div>
            <div className="mt-3">
              <label className="field-label" htmlFor={`fechamento-${f.id}`}>
                Dia de fechamento só desta função (além do fechamento geral da loja)
              </label>
              <select
                id={`fechamento-${f.id}`}
                className="field-input"
                defaultValue={f.closedWeekday ?? ""}
                onChange={(e) => atualizarFechamento(f.id, e.target.value)}
              >
                <option value="">Nenhum — segue só o fechamento geral da loja</option>
                {DIAS_SEMANA.map((nome, idx) => (
                  <option key={idx} value={idx}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-vinho-500">+ Nova função</h2>
      <form onSubmit={criar} className="card flex gap-2">
        <input
          className="field-input"
          placeholder="Ex: Atendimento"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <button disabled={creating} className="btn-primary shrink-0">
          {creating ? "Criando…" : "Criar"}
        </button>
      </form>
    </div>
  );
}
