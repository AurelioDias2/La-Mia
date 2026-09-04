"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  fullName: string;
  functions: { role: "PRINCIPAL" | "SECUNDARIA"; jobFunction: { name: string; sector: string } }[];
};

export function AssignLeaveTool() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/employees?status=ATIVO")
      .then((r) => r.json())
      .then(setEmployees);
  }, []);

  const porSetor = new Map<string, Employee[]>();
  for (const emp of employees) {
    const setor = emp.functions.find((f) => f.role === "PRINCIPAL")?.jobFunction.sector ?? "Sem setor";
    const lista = porSetor.get(setor) ?? [];
    lista.push(emp);
    porSetor.set(setor, lista);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSetor(setor: string) {
    const idsDoSetor = (porSetor.get(setor) ?? []).map((e) => e.id);
    const todosSelecionados = idsDoSetor.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of idsDoSetor) {
        if (todosSelecionados) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function confirmar() {
    if (selected.size === 0 || !date) return;
    setSubmitting(true);
    setResultado(null);
    const res = await fetch("/api/admin/leave-requests/atribuir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: Array.from(selected), type: "DOMINGO_MES", date }),
    });
    setSubmitting(false);
    const data = await res.json();
    if (!res.ok) {
      setResultado(data.error ?? "Não foi possível atribuir a folga.");
      return;
    }
    const partes: string[] = [];
    if (data.criados > 0) partes.push(`${data.criados} atribuída${data.criados > 1 ? "s" : ""}`);
    if (data.trocados > 0) partes.push(`${data.trocados} trocada${data.trocados > 1 ? "s" : ""}`);
    if (data.erros?.length > 0) {
      partes.push(`${data.erros.length} com erro (${data.erros.map((e: any) => e.nome).join(", ")})`);
    }
    setResultado(partes.length > 0 ? partes.join(", ") + "." : "Nada foi feito.");
    setSelected(new Set());
  }

  return (
    <div className="card">
      <p className="mb-1 font-display text-lg font-semibold text-vinho-500">Atribuir domingo do mês</p>
      <p className="mb-3 text-xs text-carvao-500">
        Pra quando é a Direção quem decide a escala — como Produção e Serviços Gerais. A data pode
        ser qualquer dia da semana, não precisa ser domingo. Se a pessoa já tiver um domingo do mês
        ativo nesse mês, troca automaticamente pro novo dia.
      </p>

      <div className="mb-3">
        <label className="field-label" htmlFor="atribuir-data">
          Data
        </label>
        <input
          id="atribuir-data"
          type="date"
          className="field-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="mb-3 max-h-72 space-y-3 overflow-y-auto">
        {Array.from(porSetor.entries()).map(([setor, emps]) => {
          const idsDoSetor = emps.map((e) => e.id);
          const todosSelecionados = idsDoSetor.every((id) => selected.has(id));
          return (
            <div key={setor}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">{setor}</p>
                <button
                  type="button"
                  onClick={() => toggleSetor(setor)}
                  className="text-xs font-semibold text-vinho-500 hover:underline"
                >
                  {todosSelecionados ? "Desmarcar setor" : "Marcar setor inteiro"}
                </button>
              </div>
              <div className="space-y-1">
                {emps.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm text-carvao-700">
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={() => toggle(emp.id)}
                      className="h-4 w-4 accent-vinho-500"
                    />
                    {emp.fullName}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {employees.length === 0 && <p className="text-sm text-carvao-500">Nenhum funcionário ativo.</p>}
      </div>

      {resultado && <p className="mb-3 text-sm text-carvao-700">{resultado}</p>}

      <button
        disabled={submitting || selected.size === 0 || !date}
        onClick={confirmar}
        className="btn-primary w-full"
      >
        {submitting ? "Atribuindo…" : `Atribuir a ${selected.size} pessoa${selected.size === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
