"use client";

import { useEffect, useState } from "react";
import { ordenarSetores, labelCargoPorSetor } from "@/lib/setores";

type Employee = {
  id: string;
  fullName: string;
  functions: { role: "PRINCIPAL" | "SECUNDARIA"; jobFunction: { id: string; name: string; sector: string } }[];
};

type JobFunction = { id: string; name: string; sector: string };

export default function CargosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  // Setor sendo escolhido na hora (por funcionário), separado do que já está
  // salvo — só serve pra filtrar a lista de cargo/praça/função embaixo.
  const [setorPrincipal, setSetorPrincipal] = useState<Record<string, string>>({});
  const [setorSecundaria, setSetorSecundaria] = useState<Record<string, string>>({});

  async function load() {
    const [emps, fns] = (await Promise.all([
      fetch("/api/employees?status=ATIVO").then((r) => r.json()),
      fetch("/api/job-functions").then((r) => r.json()),
    ])) as [Employee[], JobFunction[]];
    setEmployees(emps);
    setJobFunctions(fns);
    setSetorPrincipal((prev) => {
      const next = { ...prev };
      for (const emp of emps) {
        if (next[emp.id]) continue;
        next[emp.id] = emp.functions.find((f) => f.role === "PRINCIPAL")?.jobFunction.sector ?? "";
      }
      return next;
    });
    setSetorSecundaria((prev) => {
      const next = { ...prev };
      for (const emp of emps) {
        if (next[emp.id]) continue;
        next[emp.id] = emp.functions.find((f) => f.role === "SECUNDARIA")?.jobFunction.sector ?? "";
      }
      return next;
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function alterarPrincipal(employeeId: string, jobFunctionId: string) {
    if (!jobFunctionId) return;
    setSalvandoId(employeeId);
    setSalvoId(null);
    await fetch(`/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ALTERAR_FUNCAO_PRINCIPAL", jobFunctionId }),
    });
    setSalvandoId(null);
    setSalvoId(employeeId);
    setTimeout(() => setSalvoId(null), 1500);
    load();
  }

  async function alterarSecundaria(employeeId: string, jobFunctionId: string) {
    setSalvandoId(employeeId);
    setSalvoId(null);
    if (jobFunctionId === "") {
      await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REMOVER_FUNCAO_SECUNDARIA" }),
      });
    } else {
      await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADICIONAR_FUNCAO_SECUNDARIA", jobFunctionId }),
      });
    }
    setSalvandoId(null);
    setSalvoId(employeeId);
    setTimeout(() => setSalvoId(null), 1500);
    load();
  }

  const setoresDisponiveis = ordenarSetores(Array.from(new Set(jobFunctions.map((f) => f.sector))));

  const porSetor = new Map<string, Employee[]>();
  for (const emp of employees) {
    const setor = emp.functions.find((f) => f.role === "PRINCIPAL")?.jobFunction.sector ?? "Sem setor";
    const lista = porSetor.get(setor) ?? [];
    lista.push(emp);
    porSetor.set(setor, lista);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-vinho-500">Cargos</h1>
      <p className="mb-4 text-sm text-carvao-500">
        Setor, cargo/praça/função principal e secundária de cada funcionário ativo, numa tela só.
        Pra criar ou editar os cargos em si (nome, setor, limites), use a tela{" "}
        <a href="/admin/funcoes" className="font-semibold text-vinho-500 hover:underline">
          Funções
        </a>
        .
      </p>

      <div className="space-y-4">
        {Array.from(porSetor.entries()).map(([setor, emps]) => (
          <div key={setor} className="card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">{setor}</p>
            <div className="space-y-3">
              {emps.map((emp) => {
                const principal = emp.functions.find((f) => f.role === "PRINCIPAL");
                const secundaria = emp.functions.find((f) => f.role === "SECUNDARIA");
                const setorPSelecionado = setorPrincipal[emp.id] ?? "";
                const setorSSelecionado = setorSecundaria[emp.id] ?? "";
                return (
                  <div
                    key={emp.id}
                    className="flex flex-wrap items-end gap-2 border-b border-carvao-100 pb-3 last:border-0 last:pb-0"
                  >
                    <p className="w-full text-sm font-semibold text-carvao-900">{emp.fullName}</p>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-carvao-500">
                        Setor (principal)
                      </label>
                      <select
                        className="field-input w-36 py-1.5 text-sm"
                        value={setorPSelecionado}
                        disabled={salvandoId === emp.id}
                        onChange={(e) => setSetorPrincipal((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                      >
                        {setoresDisponiveis.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-carvao-500">
                        {labelCargoPorSetor(setorPSelecionado)}
                      </label>
                      <select
                        className="field-input w-44 py-1.5 text-sm"
                        value={principal?.jobFunction.id ?? ""}
                        disabled={salvandoId === emp.id}
                        onChange={(e) => alterarPrincipal(emp.id, e.target.value)}
                      >
                        {jobFunctions
                          .filter((f) => f.sector === setorPSelecionado)
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-carvao-500">
                        Setor (secundária)
                      </label>
                      <select
                        className="field-input w-36 py-1.5 text-sm"
                        value={setorSSelecionado}
                        disabled={salvandoId === emp.id}
                        onChange={(e) => {
                          const novoSetor = e.target.value;
                          setSetorSecundaria((prev) => ({ ...prev, [emp.id]: novoSetor }));
                          if (novoSetor === "" && secundaria) alterarSecundaria(emp.id, "");
                        }}
                      >
                        <option value="">Nenhuma</option>
                        {setoresDisponiveis.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    {setorSSelecionado && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-carvao-500">
                          {labelCargoPorSetor(setorSSelecionado)}
                        </label>
                        <select
                          className="field-input w-44 py-1.5 text-sm"
                          value={secundaria?.jobFunction.id ?? ""}
                          disabled={salvandoId === emp.id}
                          onChange={(e) => alterarSecundaria(emp.id, e.target.value)}
                        >
                          <option value="" disabled>
                            Toque para selecionar
                          </option>
                          {jobFunctions
                            .filter((f) => f.sector === setorSSelecionado && f.id !== principal?.jobFunction.id)
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    {salvoId === emp.id && <span className="text-xs font-semibold text-oliva-500">Salvo!</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {employees.length === 0 && <p className="text-sm text-carvao-500">Nenhum funcionário ativo.</p>}
      </div>
    </div>
  );
}
