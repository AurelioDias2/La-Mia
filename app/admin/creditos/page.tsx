"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage } from "@/lib/errors";

type Employee = { id: string; fullName: string };

export default function CreditosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [creditType, setCreditType] = useState<"COMPENSATORIA" | "EXTRA">("COMPENSATORIA");
  const [amount, setAmount] = useState(1);
  const [originDate, setOriginDate] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/employees?status=ATIVO")
      .then((r) => r.json())
      .then(setEmployees);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        creditType,
        amount,
        originDate: originDate || undefined,
        reason,
        note: note || undefined,
      }),
    });
    setLoading(false);

    if (res.ok) {
      setMessage("Crédito confirmado.");
      setReason("");
      setNote("");
      setAmount(1);
    } else {
      const data = await res.json().catch(() => null);
      setMessage(extractErrorMessage(data, "Não foi possível registrar o crédito."));
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">Adicionar crédito</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="field-label">Funcionário</label>
          <select
            className="field-input"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecionar
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Tipo</label>
          <div className="flex gap-2">
            {(["COMPENSATORIA", "EXTRA"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setCreditType(t)}
                className={`flex-1 rounded-card border px-4 py-2.5 text-sm font-semibold ${
                  creditType === t
                    ? "border-vinho-500 bg-vinho-50 text-vinho-500"
                    : "border-carvao-100 text-carvao-600"
                }`}
              >
                {t === "COMPENSATORIA" ? "Compensatória" : "Extra"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">Quantidade</label>
          <input
            type="number"
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
            required
          />
        </div>

        <div>
          <label className="field-label">Data que originou o crédito (opcional)</label>
          <input
            type="date"
            className="field-input"
            value={originDate}
            onChange={(e) => setOriginDate(e.target.value)}
          />
        </div>

        <div>
          <label className="field-label">Motivo</label>
          <input
            className="field-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Feriado trabalhado"
            required
          />
        </div>

        <div>
          <label className="field-label">Observação (opcional)</label>
          <textarea className="field-input" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>

        {message && <p className="text-sm text-carvao-700">{message}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Confirmando…" : "Confirmar crédito"}
        </button>
      </form>
    </div>
  );
}
