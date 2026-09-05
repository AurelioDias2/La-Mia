"use client";

import { useEffect, useState } from "react";
import { DIAS_SEMANA_LABEL } from "@/lib/dias-semana";

type Employee = {
  id: string;
  fullName: string;
  weeklyDayOff: number | null;
  functions: { role: "PRINCIPAL" | "SECUNDARIA"; jobFunction: { name: string; sector: string } }[];
};

export default function FolgaSemanalPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [resultadoSorteio, setResultadoSorteio] = useState<string | null>(null);
  const [sorteandoSetor, setSorteandoSetor] = useState<string | null>(null);
  const [resultadoSorteioSetor, setResultadoSorteioSetor] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/employees?status=ATIVO");
    setEmployees(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function alterar(employeeId: string, value: string) {
    setSalvandoId(employeeId);
    setSalvoId(null);
    await fetch(`/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ALTERAR_FOLGA_SEMANAL",
        weeklyDayOff: value === "" ? null : Number(value),
      }),
    });
    setSalvandoId(null);
    setSalvoId(employeeId);
    setTimeout(() => setSalvoId(null), 1500);
    load();
  }

  async function sortear() {
    if (
      !confirm(
        "Sortear a folga semanal de todo mundo que ainda não tem uma definida? Distribui entre segunda e sábado, sem concentrar uma função inteira no mesmo dia. Quem já tem um dia definido não é afetado."
      )
    ) {
      return;
    }
    setSorteando(true);
    setResultadoSorteio(null);
    const res = await fetch("/api/admin/employees/sortear-folga-semanal", { method: "POST" });
    setSorteando(false);
    const data = await res.json();
    if (!res.ok) {
      setResultadoSorteio(data.error ?? "Não foi possível sortear a folga semanal.");
      return;
    }
    setResultadoSorteio(
      data.semFolgaAntes === 0
        ? "Todo mundo já tinha uma folga semanal definida."
        : `${data.atribuidos} de ${data.semFolgaAntes} sorteados.${
            data.erros?.length > 0 ? ` ${data.erros.length} com erro (${data.erros.map((e: any) => e.nome).join(", ")}).` : ""
          }`
    );
    load();
  }

  async function sortearNovamenteSetor(setor: string) {
    if (
      !confirm(
        `Sortear a folga semanal de TODO MUNDO da ${setor} de novo esse mês? Isso substitui o dia de quem já tem um definido nesse setor — pensado pro sorteio mensal depois que abrirem todos os dias.`
      )
    ) {
      return;
    }
    setSorteandoSetor(setor);
    setResultadoSorteioSetor((prev) => ({ ...prev, [setor]: "" }));
    const res = await fetch("/api/admin/employees/sortear-folga-semanal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector: setor, sobrescrever: true }),
    });
    setSorteandoSetor(null);
    const data = await res.json();
    if (!res.ok) {
      setResultadoSorteioSetor((prev) => ({ ...prev, [setor]: data.error ?? "Não foi possível sortear." }));
      return;
    }
    setResultadoSorteioSetor((prev) => ({
      ...prev,
      [setor]: `${data.atribuidos} sorteados.${
        data.erros?.length > 0 ? ` ${data.erros.length} com erro (${data.erros.map((e: any) => e.nome).join(", ")}).` : ""
      }`,
    }));
    load();
  }

  const porSetor = new Map<string, Employee[]>();
  for (const emp of employees) {
    const setor = emp.functions.find((f) => f.role === "PRINCIPAL")?.jobFunction.sector ?? "Sem setor";
    const lista = porSetor.get(setor) ?? [];
    lista.push(emp);
    porSetor.set(setor, lista);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-vinho-500">Folga semanal</h1>
      <p className="mb-4 text-sm text-carvao-500">
        O dia fixo de folga semanal de cada funcionário — separado do domingo do mês. Só a Direção
        define ou muda isso.
      </p>

      <div className="card mb-4">
        <button onClick={sortear} disabled={sorteando} className="btn-secondary w-full text-sm">
          {sorteando ? "Sorteando…" : "Sortear folga semanal (quem falta)"}
        </button>
        {resultadoSorteio && <p className="mt-2 text-sm text-carvao-700">{resultadoSorteio}</p>}
      </div>

      <div className="space-y-4">
        {Array.from(porSetor.entries()).map(([setor, emps]) => (
          <div key={setor} className="card">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-carvao-500">{setor}</p>
              <button
                type="button"
                onClick={() => sortearNovamenteSetor(setor)}
                disabled={sorteandoSetor === setor}
                className="text-xs font-semibold text-vinho-500 hover:underline"
              >
                {sorteandoSetor === setor ? "Sorteando…" : "Sortear de novo esse mês"}
              </button>
            </div>
            {resultadoSorteioSetor[setor] && (
              <p className="mb-2 text-xs text-carvao-700">{resultadoSorteioSetor[setor]}</p>
            )}
            <div className="space-y-2">
              {emps.map((emp) => (
                <div key={emp.id} className="flex items-center gap-2">
                  <p className="flex-1 text-sm text-carvao-900">{emp.fullName}</p>
                  <select
                    className="field-input w-40 py-1.5 text-sm"
                    value={emp.weeklyDayOff ?? ""}
                    disabled={salvandoId === emp.id}
                    onChange={(e) => alterar(emp.id, e.target.value)}
                  >
                    <option value="">Nenhuma</option>
                    {DIAS_SEMANA_LABEL.map((label, i) => (
                      <option key={i} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {salvoId === emp.id && <span className="text-xs font-semibold text-oliva-500">Salvo!</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {employees.length === 0 && <p className="text-sm text-carvao-500">Nenhum funcionário ativo.</p>}
      </div>
    </div>
  );
}
