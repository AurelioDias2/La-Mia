"use client";

import { useEffect, useState } from "react";

type BlockedDate = { id: string; date: string; reason: string };

export default function CalendarioPage() {
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/blocked-dates");
    setBlocked(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/blocked-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason }),
    });
    setLoading(false);
    setDate("");
    setReason("");
    load();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">
          Datas bloqueadas
        </h1>
        <div className="space-y-3">
          {blocked.length === 0 && <p className="text-carvao-500">Nenhuma data bloqueada.</p>}
          {blocked.map((b) => (
            <div key={b.id} className="card">
              <p className="font-semibold text-carvao-900">
                🔒 {new Date(b.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </p>
              <p className="text-sm text-carvao-500">Motivo: {b.reason}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-vinho-500">
          Bloquear uma data
        </h2>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="field-label">Data</label>
            <input
              type="date"
              className="field-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label">Motivo</label>
            <input
              className="field-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Grande movimento de Natal"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Bloqueando…" : "Confirmar bloqueio"}
          </button>
        </form>
      </div>
    </div>
  );
}
