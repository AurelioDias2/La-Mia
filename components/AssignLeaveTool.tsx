"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  fullName: string;
  functions: { role: "PRINCIPAL" | "SECUNDARIA"; jobFunction: { name: string; sector: string } }[];
};

type LeaveType = "DOMINGO_MES" | "COMPENSATORIA";

const typeLabel: Record<LeaveType, string> = {
  DOMINGO_MES: "Domingo do mês",
  COMPENSATORIA: "Compensatória",
};

export function AssignLeaveTool() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [type, setType] = useState<LeaveType>("DOMINGO_MES");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/employees?status=ATIVO")
      .then((r) => r.json())
      .then(setEmployees);
  }, []);

  const porSetor = new Map<string, Map<string, Employee[]>>();
  for (const emp of employees) {
    const principal = emp.functions.find((f) => f.role === "PRINCIPAL")?.jobFunction;
    const setor = principal?.sector ?? "Sem setor";
    const praca = principal?.name ?? "Sem praça";
    const porPraca = porSetor.get(setor) ?? new Map<string, Employee[]>();
    const lista = porPraca.get(praca) ?? [];
    lista.push(emp);
    porPraca.set(praca, lista);
    porSetor.set(setor, porPraca);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function idsDoGrupo(porPraca: Map<string, Employee[]>): string[] {
    return Array.from(porPraca.values()).flat().map((e) => e.id);
  }

  function toggleIds(ids: string[]) {
    const todosSelecionados = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
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
      body: JSON.stringify({ employeeIds: Array.from(selected), type, date }),
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
      <p className="mb-1 font-display text-lg font-semibold text-vinho-500">Atribuir folga</p>
      <p className="mb-3 text-xs text-carvao-500">
        Pra quando é a Direção quem decide a data — como a escala de Produção e Serviços Gerais, ou
        pra definir direto a compensatória de alguém. Domingo do mês pode ser qualquer dia da
        semana; se a pessoa já tiver um ativo nesse mês, troca automaticamente. Compensatória
        concede e usa 1 crédito na hora, sem precisar de saldo acumulado.
      </p>

      <div className="mb-3">
        <p className="field-label">Tipo</p>
        <div className="flex gap-2">
          {(["DOMINGO_MES", "COMPENSATORIA"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-card border px-3 py-2 text-xs font-semibold ${
                type === t ? "border-vinho-500 bg-vinho-50 text-vinho-500" : "border-carvao-100 text-carvao-600"
              }`}
            >
              {typeLabel[t]}
            </button>
          ))}
        </div>
      </div>

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

      <div className="mb-3 max-h-96 space-y-4 overflow-y-auto">
        {Array.from(porSetor.entries()).map(([setor, porPraca]) => {
          const idsSetor = idsDoGrupo(porPraca);
          const setorTodoSelecionado = idsSetor.every((id) => selected.has(id));
          return (
            <div key={setor}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">{setor}</p>
                <button
                  type="button"
                  onClick={() => toggleIds(idsSetor)}
                  className="text-xs font-semibold text-vinho-500 hover:underline"
                >
                  {setorTodoSelecionado ? "Desmarcar setor" : "Marcar setor inteiro"}
                </button>
              </div>
              <div className="space-y-2 border-l-2 border-crosta-100 pl-2">
                {Array.from(porPraca.entries()).map(([praca, emps]) => {
                  const idsPraca = emps.map((e) => e.id);
                  const pracaTodaSelecionada = idsPraca.every((id) => selected.has(id));
                  return (
                    <div key={praca}>
                      <div className="mb-0.5 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-carvao-500">{praca}</p>
                        <button
                          type="button"
                          onClick={() => toggleIds(idsPraca)}
                          className="text-[11px] font-semibold text-vinho-500 hover:underline"
                        >
                          {pracaTodaSelecionada ? "Desmarcar praça" : "Marcar praça inteira"}
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
