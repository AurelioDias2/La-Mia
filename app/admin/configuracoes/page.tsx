"use client";

import { useEffect, useState } from "react";

const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Settings = {
  fixedClosedWeekday: number;
  requestsRequireApproval: boolean;
  pendingRequestHoldsSlot: boolean;
};

export default function ConfiguracoesPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
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

  if (!settings) return <p className="text-carvao-500">Carregando…</p>;

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">Configurações</h1>

      <div className="card space-y-5">
        <div>
          <label className="field-label">Dia fixo de fechamento</label>
          <select
            className="field-input"
            value={settings.fixedClosedWeekday}
            onChange={(e) => save({ fixedClosedWeekday: parseInt(e.target.value, 10) })}
            disabled={saving}
          >
            {weekdays.map((w, i) => (
              <option key={w} value={i}>
                {w}-feira
              </option>
            ))}
          </select>
        </div>

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
      </div>

      <p className="mt-3 text-xs text-carvao-500">
        O limite de folgas simultâneas por função fica na tela <strong>Funções</strong>, pois é
        específico de cada função (seção 49 da especificação).
      </p>
    </div>
  );
}
