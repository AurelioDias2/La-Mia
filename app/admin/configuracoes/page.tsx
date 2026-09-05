"use client";

import { useEffect, useState } from "react";

const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Settings = {
  requestsRequireApproval: boolean;
  pendingRequestHoldsSlot: boolean;
  allowSelfServiceCompensatoria: boolean;
};

type SectorClosedWeekday = { sector: string; closedWeekday: number | null };

export default function ConfiguracoesPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [setores, setSetores] = useState<SectorClosedWeekday[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSector, setSavingSector] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
    fetch("/api/admin/sector-closed-weekday")
      .then((r) => r.json())
      .then(setSetores);
  }, []);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSettings(await res.json());
    setSaving(false);
  }

  async function salvarFechamentoSetor(sector: string, closedWeekday: number | null) {
    setSavingSector(sector);
    await fetch("/api/admin/sector-closed-weekday", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector, closedWeekday }),
    });
    setSetores((prev) => prev?.map((s) => (s.sector === sector ? { ...s, closedWeekday } : s)) ?? null);
    setSavingSector(null);
  }

  if (!settings || !setores) return <p className="text-carvao-500">Carregando…</p>;

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">Configurações</h1>

      <div className="card mb-4 space-y-4">
        <p className="field-label">Dia fixo de fechamento por setor</p>
        <p className="-mt-2 text-xs text-carvao-500">
          Deixe "Nenhum" quando o setor passar a abrir todos os dias — aí a folga vira semanal
          sorteada em vez de um dia fixo pra todo mundo.
        </p>
        {setores.map((s) => (
          <div key={s.sector} className="flex items-center justify-between gap-2">
            <span className="text-sm text-carvao-700">{s.sector}</span>
            <select
              className="field-input w-40 py-1.5 text-sm"
              value={s.closedWeekday ?? ""}
              disabled={savingSector === s.sector}
              onChange={(e) =>
                salvarFechamentoSetor(s.sector, e.target.value === "" ? null : parseInt(e.target.value, 10))
              }
            >
              <option value="">Nenhum</option>
              {weekdays.map((w, i) => (
                <option key={w} value={i}>
                  {w}-feira
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="card space-y-5">
        <label className="flex items-center justify-between">
          <span className="text-sm text-carvao-700">Solicitações exigem aprovação</span>
          <input
            type="checkbox"
            checked={settings.requestsRequireApproval}
            onChange={(e) => save({ requestsRequireApproval: e.target.checked })}
            disabled={saving}
            className="h-5 w-5 accent-vinho-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-carvao-700">Solicitação pendente reserva a vaga</span>
          <input
            type="checkbox"
            checked={settings.pendingRequestHoldsSlot}
            onChange={(e) => save({ pendingRequestHoldsSlot: e.target.checked })}
            disabled={saving}
            className="h-5 w-5 accent-vinho-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-carvao-700">
            Funcionários podem escolher o dia da compensatória sozinhos
          </span>
          <input
            type="checkbox"
            checked={settings.allowSelfServiceCompensatoria}
            onChange={(e) => save({ allowSelfServiceCompensatoria: e.target.checked })}
            disabled={saving}
            className="h-5 w-5 accent-vinho-500"
          />
        </label>
        {!settings.allowSelfServiceCompensatoria && (
          <p className="text-xs text-carvao-500">
            Desligado: só a Direção define o dia da compensatória, manualmente ou pelo sorteio, no
            Calendário. Não afeta domingo do mês nem extra.
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-carvao-500">
        O limite de folgas simultâneas por função fica na tela <strong>Funções</strong>, pois é
        específico de cada função (seção 49 da especificação).
      </p>
    </div>
  );
}
