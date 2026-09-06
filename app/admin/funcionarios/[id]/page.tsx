"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage } from "@/lib/errors";
import { DIAS_SEMANA_LABEL } from "@/lib/dias-semana";

type CreditTransaction = {
  id: string;
  creditType: "COMPENSATORIA" | "EXTRA";
  kind: "CONCESSAO" | "RESERVA" | "CONSUMO" | "ESTORNO" | "CORRECAO";
  amount: number;
  reason: string | null;
  note: string | null;
  correctsTransactionId: string | null;
  createdAt: string;
};

type Detail = {
  id: string;
  fullName: string;
  whatsapp: string;
  status: string;
  functions: { role: "PRINCIPAL" | "SECUNDARIA"; jobFunction: { id: string; name: string } }[];
  comp: { total: number; reservado: number; disponivel: number };
  extra: { total: number; reservado: number; disponivel: number };
  nextLeave: { date: string } | null;
  creditTransactions: CreditTransaction[];
  weeklyDayOff: number | null;
};

type JobFunction = { id: string; name: string };

export default function FichaFuncionarioPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [secondaryId, setSecondaryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState(0);
  const [correctReason, setCorrectReason] = useState("");
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [editingPrincipal, setEditingPrincipal] = useState(false);
  const [principalId, setPrincipalId] = useState("");
  const [editingWeeklyDayOff, setEditingWeeklyDayOff] = useState(false);
  const [weeklyDayOffValue, setWeeklyDayOffValue] = useState("");

  async function load() {
    const [d, fns] = await Promise.all([
      fetch(`/api/employees/${params.id}`).then((r) => r.json()),
      fetch("/api/job-functions").then((r) => r.json()),
    ]);
    setDetail(d);
    setJobFunctions(fns);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alterarPrincipal() {
    if (!principalId) return;
    setBusy(true);
    await fetch(`/api/employees/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ALTERAR_FUNCAO_PRINCIPAL", jobFunctionId: principalId }),
    });
    setBusy(false);
    setEditingPrincipal(false);
    load();
  }

  async function alterarFolgaSemanal() {
    setBusy(true);
    await fetch(`/api/employees/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ALTERAR_FOLGA_SEMANAL",
        weeklyDayOff: weeklyDayOffValue === "" ? null : Number(weeklyDayOffValue),
      }),
    });
    setBusy(false);
    setEditingWeeklyDayOff(false);
    load();
  }

  async function adicionarSecundaria() {
    if (!secondaryId) return;
    setBusy(true);
    await fetch(`/api/employees/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADICIONAR_FUNCAO_SECUNDARIA", jobFunctionId: secondaryId }),
    });
    setBusy(false);
    load();
  }

  function abrirCorrecao(t: CreditTransaction) {
    setCorrectingId(t.id);
    setCorrectedAmount(t.amount);
    setCorrectReason("");
    setCorrectError(null);
  }

  async function confirmarCorrecao(transactionId: string) {
    setBusy(true);
    setCorrectError(null);
    const res = await fetch(`/api/credits/${transactionId}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctedAmount, reason: correctReason }),
    });
    setBusy(false);
    if (res.ok) {
      setCorrectingId(null);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setCorrectError(extractErrorMessage(data, "Não foi possível corrigir o crédito."));
    }
  }

  async function redefinirSenha() {
    if (!confirm(`Gerar uma nova senha temporária para ${detail?.fullName}? A senha atual dela deixará de funcionar.`)) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/employees/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REDEFINIR_SENHA" }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setTempPassword(data.tempPassword);
    }
  }

  async function desativar() {
    if (!confirm(`Deseja desativar ${detail?.fullName}? Ela perderá o acesso; o histórico será preservado.`)) {
      return;
    }
    setBusy(true);
    await fetch(`/api/employees/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DESATIVAR" }),
    });
    setBusy(false);
    load();
  }

  async function reativar() {
    if (!confirm(`Reativar ${detail?.fullName}? Ela volta a ter acesso ao sistema.`)) {
      return;
    }
    setBusy(true);
    await fetch(`/api/employees/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REATIVAR" }),
    });
    setBusy(false);
    load();
  }

  async function excluir() {
    if (
      !confirm(
        `Excluir ${detail?.fullName} de vez? Isso apaga o cadastro (não dá pra desfazer) — só funciona se ela nunca teve nenhuma folga ou crédito lançado. Pra quem já trabalhou de verdade, use "Desativar" em vez disso.`
      )
    ) {
      return;
    }
    setBusy(true);
    setDeleteError(null);
    const res = await fetch(`/api/employees/${params.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setDeleted(true);
    } else {
      const data = await res.json().catch(() => null);
      setDeleteError(extractErrorMessage(data, "Não foi possível excluir."));
    }
  }

  if (deleted) {
    return (
      <div className="max-w-lg">
        <p className="card text-sm text-carvao-700">Cadastro excluído.</p>
        <a href="/admin/funcionarios" className="mt-4 inline-block text-sm text-vinho-500 hover:underline">
          ← Voltar pra lista de funcionários
        </a>
      </div>
    );
  }

  if (!detail) return <p className="text-carvao-500">Carregando…</p>;

  const principal = detail.functions.find((f) => f.role === "PRINCIPAL")?.jobFunction.name;
  const secundaria = detail.functions.find((f) => f.role === "SECUNDARIA")?.jobFunction.name;

  return (
    <div className="max-w-lg">
      <a href="/admin/funcionarios" className="mb-4 inline-block text-sm text-carvao-500 hover:underline">
        ← Voltar
      </a>

      <h1 className="mb-1 font-display text-2xl font-semibold text-vinho-500">{detail.fullName}</h1>
      <span
        className={`pill mb-4 inline-flex ${
          detail.status === "ATIVO" ? "bg-oliva-50 text-oliva-500" : "bg-carvao-100 text-carvao-500"
        }`}
      >
        {detail.status}
      </span>

      <div className="card mb-4 space-y-1 text-sm">
        <p className="text-carvao-500">WhatsApp: {detail.whatsapp}</p>
        {!editingPrincipal ? (
          <p className="text-carvao-500">
            Função principal: {principal ?? "—"}{" "}
            <button
              onClick={() => {
                setPrincipalId("");
                setEditingPrincipal(true);
              }}
              className="text-xs font-semibold text-vinho-500 hover:underline"
            >
              Alterar
            </button>
          </p>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <select
              className="field-input py-1.5 text-sm"
              value={principalId}
              onChange={(e) => setPrincipalId(e.target.value)}
            >
              <option value="">Selecionar</option>
              {jobFunctions
                .filter((f) => f.name !== principal)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
            <button
              disabled={busy || !principalId}
              onClick={alterarPrincipal}
              className="btn-primary shrink-0 px-3 py-1.5 text-xs"
            >
              Confirmar
            </button>
            <button
              disabled={busy}
              onClick={() => setEditingPrincipal(false)}
              className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        )}
        <p className="text-carvao-500">Função secundária: {secundaria ?? "Nenhuma"}</p>
        {!editingWeeklyDayOff ? (
          <p className="text-carvao-500">
            Folga semanal fixa:{" "}
            {detail.weeklyDayOff !== null ? DIAS_SEMANA_LABEL[detail.weeklyDayOff] : "Nenhuma"}{" "}
            <button
              onClick={() => {
                setWeeklyDayOffValue(detail.weeklyDayOff !== null ? String(detail.weeklyDayOff) : "");
                setEditingWeeklyDayOff(true);
              }}
              className="text-xs font-semibold text-vinho-500 hover:underline"
            >
              Alterar
            </button>
          </p>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <select
              className="field-input py-1.5 text-sm"
              value={weeklyDayOffValue}
              onChange={(e) => setWeeklyDayOffValue(e.target.value)}
            >
              <option value="">Nenhuma</option>
              {DIAS_SEMANA_LABEL.map((label, i) => (
                <option key={i} value={i}>
                  {label}
                </option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={alterarFolgaSemanal}
              className="btn-primary shrink-0 px-3 py-1.5 text-xs"
            >
              Confirmar
            </button>
            <button
              disabled={busy}
              onClick={() => setEditingWeeklyDayOff(false)}
              className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        )}
        {detail.nextLeave && (
          <p className="text-carvao-500">
            Próxima folga:{" "}
            {new Date(detail.nextLeave.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </p>
        )}
      </div>

      <div className="card mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-carvao-500">Saldos</p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="font-display text-2xl font-semibold text-vinho-500">{detail.comp.disponivel}</p>
            <p className="text-xs text-carvao-500">Compensatória</p>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-vinho-500">{detail.extra.disponivel}</p>
            <p className="text-xs text-carvao-500">Extra</p>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-carvao-500">
          Lançamentos de crédito
        </p>
        {detail.creditTransactions.filter((t) => t.kind === "CONCESSAO").length === 0 && (
          <p className="text-sm text-carvao-500">Nenhum crédito concedido ainda.</p>
        )}
        <ul className="space-y-3">
          {detail.creditTransactions
            .filter((t) => t.kind === "CONCESSAO")
            .map((t) => {
              const corrections = detail.creditTransactions.filter(
                (c) => c.correctsTransactionId === t.id
              );
              return (
                <li key={t.id} className="border-b border-carvao-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm">
                      <p className="text-carvao-900">
                        {t.creditType === "COMPENSATORIA" ? "Compensatória" : "Extra"}:{" "}
                        <span className="font-semibold">
                          {t.amount >= 0 ? "+" : ""}
                          {t.amount}
                        </span>
                      </p>
                      <p className="text-carvao-500">
                        {t.reason} ·{" "}
                        {new Date(t.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </p>
                      {corrections.map((c) => (
                        <p key={c.id} className="mt-1 text-xs text-vinho-500">
                          Corrigido em {new Date(c.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}:{" "}
                          {c.note} {c.reason ? `(${c.reason})` : ""}
                        </p>
                      ))}
                    </div>
                    {correctingId !== t.id && (
                      <button
                        onClick={() => abrirCorrecao(t)}
                        className="shrink-0 text-xs font-semibold text-vinho-500 hover:underline"
                      >
                        Corrigir
                      </button>
                    )}
                  </div>

                  {correctingId === t.id && (
                    <div className="mt-3 space-y-2 rounded-card bg-crosta-50 p-3">
                      <div>
                        <label className="field-label">Quantidade corrigida</label>
                        <input
                          type="number"
                          className="field-input"
                          value={correctedAmount}
                          onChange={(e) => setCorrectedAmount(parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                      <div>
                        <label className="field-label">Motivo da correção</label>
                        <input
                          className="field-input"
                          value={correctReason}
                          onChange={(e) => setCorrectReason(e.target.value)}
                          placeholder="Ex: valor lançado errado"
                        />
                      </div>
                      {correctError && <p className="text-sm text-vinho-500">{correctError}</p>}
                      <div className="flex gap-2">
                        <button
                          disabled={busy || !correctReason.trim()}
                          onClick={() => confirmarCorrecao(t.id)}
                          className="btn-primary flex-1"
                        >
                          Confirmar correção
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setCorrectingId(null)}
                          className="btn-secondary flex-1"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      </div>

      {!secundaria && (
        <div className="card mb-4">
          <p className="field-label">Adicionar função secundária</p>
          <div className="flex gap-2">
            <select
              className="field-input"
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
            >
              <option value="">Selecionar</option>
              {jobFunctions
                .filter((f) => f.name !== principal)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
            <button disabled={busy || !secondaryId} onClick={adicionarSecundaria} className="btn-primary shrink-0">
              Adicionar
            </button>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="card mb-4 bg-oliva-50">
          <p className="mb-1 text-sm font-semibold text-oliva-500">Senha temporária gerada</p>
          <p className="mb-2 font-mono text-lg text-carvao-900">{tempPassword}</p>
          <p className="text-xs text-carvao-500">
            Repasse essa senha para {detail.fullName} por WhatsApp ou pessoalmente — ela substitui a
            senha anterior e não ficará salva em nenhum outro lugar. Recomende trocar a senha após o
            próximo login.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <a href="/admin/creditos" className="btn-secondary block w-full text-center">
          Adicionar crédito
        </a>
        <a href={`/admin/historico?targetType=Employee&targetId=${detail.id}`} className="btn-secondary block w-full text-center">
          Ver histórico
        </a>
        {detail.status === "ATIVO" && (
          <button disabled={busy} onClick={redefinirSenha} className="btn-secondary block w-full">
            Redefinir senha
          </button>
        )}
        {detail.status === "ATIVO" && (
          <button disabled={busy} onClick={desativar} className="btn-secondary block w-full text-vinho-500">
            Desativar funcionário
          </button>
        )}
        {detail.status === "INATIVO" && (
          <button disabled={busy} onClick={reativar} className="btn-primary block w-full">
            Reativar funcionário
          </button>
        )}
        <button disabled={busy} onClick={excluir} className="btn-secondary block w-full text-vinho-500">
          Excluir funcionário
        </button>
        <p className="-mt-1 text-xs text-carvao-500">
          Apaga o cadastro de vez — só funciona se nunca teve folga nem crédito lançado (ex: cadastro
          duplicado por engano). Pra quem já trabalhou, use "Desativar" pra manter o histórico.
        </p>
        {deleteError && <p className="text-sm text-vinho-500">{deleteError}</p>}
      </div>
    </div>
  );
}
