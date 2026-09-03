"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  fullName: string;
  whatsapp: string;
  status: "PENDENTE" | "ATIVO" | "INATIVO" | "RECUSADO";
  createdAt: string;
  functions: { role: "PRINCIPAL" | "SECUNDARIA"; jobFunction: { name: string } }[];
};

const statusFilters = ["Todos", "Ativos", "Pendentes", "Inativos"] as const;
const statusMap: Record<(typeof statusFilters)[number], string | undefined> = {
  Todos: undefined,
  Ativos: "ATIVO",
  Pendentes: "PENDENTE",
  Inativos: "INATIVO",
};

export default function FuncionariosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState<(typeof statusFilters)[number]>("Pendentes");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});

  async function load() {
    const status = statusMap[filter];
    const res = await fetch(`/api/employees${status ? `?status=${status}` : ""}`);
    setEmployees(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function act(id: string, action: "APROVAR" | "RECUSAR" | "DESATIVAR" | "REATIVAR") {
    setBusyId(id);
    await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    load();
  }

  async function redefinirSenha(id: string, fullName: string) {
    if (!confirm(`Gerar uma nova senha temporária para ${fullName}? A senha atual dela deixará de funcionar.`)) {
      return;
    }
    setBusyId(id);
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REDEFINIR_SENHA" }),
    });
    setBusyId(null);
    if (res.ok) {
      const data = await res.json();
      setTempPasswords((prev) => ({ ...prev, [id]: data.tempPassword }));
    }
  }

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-semibold text-vinho-500">Funcionários</h1>

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${
              filter === f ? "bg-vinho-500 text-crosta-50" : "bg-white text-carvao-600 border border-carvao-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {employees.length === 0 && <p className="text-carvao-500">Nenhum funcionário nesta lista.</p>}
        {employees.map((emp) => {
          const principal = emp.functions.find((f) => f.role === "PRINCIPAL")?.jobFunction.name;
          return (
            <div key={emp.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <a href={`/admin/funcionarios/${emp.id}`} className="block">
                  <p className="font-semibold text-carvao-900 hover:underline">{emp.fullName}</p>
                  <p className="text-sm text-carvao-500">WhatsApp: {emp.whatsapp}</p>
                  <p className="text-sm text-carvao-500">Função escolhida: {principal ?? "—"}</p>
                  <p className="text-xs text-carvao-300">
                    Cadastro: {new Date(emp.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </a>
                <span
                  className={`pill ${
                    emp.status === "ATIVO"
                      ? "bg-oliva-50 text-oliva-500"
                      : emp.status === "PENDENTE"
                        ? "bg-crosta-100 text-crosta-600"
                        : "bg-carvao-100 text-carvao-500"
                  }`}
                >
                  {emp.status}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                {emp.status === "PENDENTE" && (
                  <>
                    <button
                      disabled={busyId === emp.id}
                      onClick={() => act(emp.id, "APROVAR")}
                      className="btn-primary flex-1 text-sm"
                    >
                      Aprovar
                    </button>
                    <button
                      disabled={busyId === emp.id}
                      onClick={() => act(emp.id, "RECUSAR")}
                      className="btn-secondary flex-1 text-sm"
                    >
                      Recusar
                    </button>
                  </>
                )}
                {emp.status === "ATIVO" && (
                  <>
                    <button
                      disabled={busyId === emp.id}
                      onClick={() => redefinirSenha(emp.id, emp.fullName)}
                      className="btn-secondary flex-1 text-sm"
                    >
                      Redefinir senha
                    </button>
                    <button
                      disabled={busyId === emp.id}
                      onClick={() => act(emp.id, "DESATIVAR")}
                      className="btn-secondary flex-1 text-sm"
                    >
                      Desativar
                    </button>
                  </>
                )}
                {emp.status === "INATIVO" && (
                  <button
                    disabled={busyId === emp.id}
                    onClick={() => act(emp.id, "REATIVAR")}
                    className="btn-primary flex-1 text-sm"
                  >
                    Reativar
                  </button>
                )}
              </div>

              {tempPasswords[emp.id] && (
                <div className="mt-3 rounded-card bg-oliva-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-oliva-500">Senha temporária gerada</p>
                  <p className="font-mono text-lg text-carvao-900">{tempPasswords[emp.id]}</p>
                  <p className="mt-1 text-xs text-carvao-500">
                    Repasse por WhatsApp — ela substitui a senha anterior e não fica salva em nenhum
                    outro lugar.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
