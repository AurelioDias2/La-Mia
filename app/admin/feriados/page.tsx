"use client";

import { useEffect, useState } from "react";

type Holiday = {
  id: string;
  date: string;
  name: string;
  type: "NACIONAL" | "ESTADUAL" | "MUNICIPAL";
  storeOpen: "ABERTA" | "FECHADA" | "NAO_DEFINIDO";
};

export default function FeriadosPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<Holiday["type"]>("MUNICIPAL");
  const [storeOpen, setStoreOpen] = useState<Holiday["storeOpen"]>("NAO_DEFINIDO");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/holidays");
    setHolidays(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, name, type, storeOpen }),
    });
    setLoading(false);
    setDate("");
    setName("");
    load();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">Feriados</h1>
        <div className="space-y-3">
          {holidays.map((h) => (
            <div key={h.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-carvao-900">
                  {new Date(h.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })} — {h.name}
                </p>
                <p className="text-sm text-carvao-500">{h.type}</p>
              </div>
              <span
                className={`pill ${
                  h.storeOpen === "ABERTA"
                    ? "bg-oliva-50 text-oliva-500"
                    : h.storeOpen === "FECHADA"
                      ? "bg-vinho-50 text-vinho-500"
                      : "bg-carvao-100 text-carvao-500"
                }`}
              >
                {h.storeOpen === "ABERTA"
                  ? "LOJA ABERTA"
                  : h.storeOpen === "FECHADA"
                    ? "LOJA FECHADA"
                    : "A DEFINIR"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-vinho-500">+ Novo feriado</h2>
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
            <label className="field-label">Nome</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Tipo</label>
            <select className="field-input" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="NACIONAL">Nacional</option>
              <option value="ESTADUAL">Estadual</option>
              <option value="MUNICIPAL">Municipal</option>
            </select>
          </div>
          <div>
            <label className="field-label">Situação da loja</label>
            <select
              className="field-input"
              value={storeOpen}
              onChange={(e) => setStoreOpen(e.target.value as any)}
            >
              <option value="NAO_DEFINIDO">Ainda não definido</option>
              <option value="ABERTA">Aberta</option>
              <option value="FECHADA">Fechada</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Salvando…" : "Salvar feriado"}
          </button>
        </form>
      </div>
    </div>
  );
}
