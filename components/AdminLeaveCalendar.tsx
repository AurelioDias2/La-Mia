"use client";

import { useEffect, useState } from "react";

type LeaveEntry = {
  id: string;
  date: string;
  type: "DOMINGO_MES" | "COMPENSATORIA" | "EXTRA" | "FOLGA_SEMANAL";
  status: string;
  employeeName: string;
  jobFunctionName: string;
  sector: string;
};

type EmployeeComFolga = {
  id: string;
  fullName: string;
  weeklyDayOff: number | null;
  jobFunctionName: string;
  sector: string;
};

const typeLabel: Record<LeaveEntry["type"], string> = {
  DOMINGO_MES: "Domingo do mês",
  COMPENSATORIA: "Compensatória",
  EXTRA: "Folga extra",
  FOLGA_SEMANAL: "Folga semanal",
};

const TIPOS_FILTRO = ["Todos", "DOMINGO_MES", "FOLGA_SEMANAL", "COMPENSATORIA"] as const;
const LABEL_TIPO_FILTRO: Record<(typeof TIPOS_FILTRO)[number], string> = {
  Todos: "Todos",
  DOMINGO_MES: "Domingo do mês",
  FOLGA_SEMANAL: "Folga semanal",
  COMPENSATORIA: "Compensatória",
};

function entriesFolgaSemanal(employees: EmployeeComFolga[], year: number, m: number, daysInMonth: number): LeaveEntry[] {
  const resultado: LeaveEntry[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year, m - 1, day)).getUTCDay();
    for (const emp of employees) {
      if (emp.weeklyDayOff === weekday) {
        resultado.push({
          id: `folga-semanal-${emp.id}-${iso}`,
          date: iso,
          type: "FOLGA_SEMANAL",
          status: "APROVADA",
          employeeName: emp.fullName,
          jobFunctionName: emp.jobFunctionName,
          sector: emp.sector,
        });
      }
    }
  }
  return resultado;
}

const statusLabel: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  CANCELAMENTO_SOLICITADO: "Cancelamento pedido",
  CANCELADA: "Cancelada",
  UTILIZADA: "Utilizada",
};

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TITULO_RELATORIO: Record<LeaveEntry["type"], string> = {
  COMPENSATORIA: "FOLGAS COMPENSATÓRIAS",
  EXTRA: "FOLGAS EXTRAS",
  DOMINGO_MES: "DOMINGO DO MÊS",
  FOLGA_SEMANAL: "FOLGA SEMANAL",
};
const ORDEM_RELATORIO: LeaveEntry["type"][] = ["COMPENSATORIA", "EXTRA", "FOLGA_SEMANAL", "DOMINGO_MES"];

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0];
}

function juntarNomes(nomes: string[]): string {
  if (nomes.length === 1) return nomes[0];
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function AdminLeaveCalendar() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [entries, setEntries] = useState<LeaveEntry[]>([]);
  const [employees, setEmployees] = useState<EmployeeComFolga[]>([]);
  const [setoresAtivos, setSetoresAtivos] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [changingDateId, setChangingDateId] = useState<string | null>(null);
  const [newDateValue, setNewDateValue] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>("Todos");
  const [typeFilter, setTypeFilter] = useState<(typeof TIPOS_FILTRO)[number]>("Todos");
  const [relatorio, setRelatorio] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [sorteando, setSorteando] = useState(false);
  const [resultadoSorteio, setResultadoSorteio] = useState<string | null>(null);
  const [sorteandoSemanal, setSorteandoSemanal] = useState(false);
  const [resultadoSorteioSemanal, setResultadoSorteioSemanal] = useState<string | null>(null);
  const [sorteandoComp, setSorteandoComp] = useState(false);
  const [resultadoSorteioComp, setResultadoSorteioComp] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/leave-requests?month=${month}`);
    setEntries(await res.json());
  }

  type EmployeeApi = {
    id: string;
    fullName: string;
    weeklyDayOff: number | null;
    functions: { role: "PRINCIPAL" | "SECUNDARIA"; jobFunction: { name: string; sector: string } }[];
  };

  async function loadEmployees() {
    const res = await fetch("/api/employees?status=ATIVO");
    const data = (await res.json()) as EmployeeApi[];
    setEmployees(
      data.flatMap((e) => {
        const principal = e.functions.find((f) => f.role === "PRINCIPAL");
        if (!principal) return [];
        return [
          {
            id: e.id,
            fullName: e.fullName,
            weeklyDayOff: e.weeklyDayOff,
            jobFunctionName: principal.jobFunction.name,
            sector: principal.jobFunction.sector,
          },
        ];
      })
    );
  }

  useEffect(() => {
    // Lista de setores independente do mês — senão um setor sem nenhuma
    // folga aprovada/pendente ainda esse mês (ex: Serviços Gerais recém
    // criado) nunca aparece como aba.
    fetch("/api/job-functions")
      .then((r) => r.json())
      .then((fns: { sector: string }[]) => setSetoresAtivos(Array.from(new Set(fns.map((f) => f.sector)))));
    loadEmployees();
  }, []);

  useEffect(() => {
    load();
    setSelectedDate(null);
    setRelatorio(null);
    setResultadoSorteio(null);
    setResultadoSorteioSemanal(null);
    setResultadoSorteioComp(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function sortearCompensatoria() {
    if (
      !confirm(
        "Sortear a compensatória de todo mundo que já tem crédito disponível e ainda não usou nenhum esse mês? Nunca cai em sexta, sábado ou domingo, e não concentra uma função no mesmo dia."
      )
    ) {
      return;
    }
    setSorteandoComp(true);
    setResultadoSorteioComp(null);
    const res = await fetch("/api/admin/leave-requests/sortear-compensatoria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    setSorteandoComp(false);
    const data = await res.json();
    if (!res.ok) {
      setResultadoSorteioComp(data.error ?? "Não foi possível sortear a compensatória.");
      return;
    }
    setResultadoSorteioComp(
      data.comCreditoAntes === 0
        ? "Ninguém tem crédito de compensatória disponível sem usar ainda esse mês."
        : `${data.criados} de ${data.comCreditoAntes} sorteados.${
            data.erros?.length > 0 ? ` ${data.erros.length} com erro (${data.erros.map((e: any) => e.nome).join(", ")}).` : ""
          }`
    );
    load();
  }

  async function sortearFolgaSemanal() {
    if (
      !confirm(
        "Sortear a folga semanal de todo mundo que ainda não tem uma definida? Distribui entre segunda e sábado, sem concentrar uma função inteira no mesmo dia. Quem já tem um dia definido não é afetado."
      )
    ) {
      return;
    }
    setSorteandoSemanal(true);
    setResultadoSorteioSemanal(null);
    const res = await fetch("/api/admin/employees/sortear-folga-semanal", { method: "POST" });
    setSorteandoSemanal(false);
    const data = await res.json();
    if (!res.ok) {
      setResultadoSorteioSemanal(data.error ?? "Não foi possível sortear a folga semanal.");
      return;
    }
    setResultadoSorteioSemanal(
      data.semFolgaAntes === 0
        ? "Todo mundo já tinha uma folga semanal definida."
        : `${data.atribuidos} de ${data.semFolgaAntes} sorteados.${
            data.erros?.length > 0 ? ` ${data.erros.length} com erro (${data.erros.map((e: any) => e.nome).join(", ")}).` : ""
          }`
    );
    loadEmployees();
  }

  async function sortearDomingos() {
    if (
      !confirm(
        "Sortear o domingo do mês de todo mundo que ainda não tem um esse mês? Distribui aleatoriamente entre os domingos, sem tirar todo mundo de uma função no mesmo dia. Quem já tem um domingo pedido ou atribuído não é afetado."
      )
    ) {
      return;
    }
    setSorteando(true);
    setResultadoSorteio(null);
    const res = await fetch("/api/admin/leave-requests/sortear-domingos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    setSorteando(false);
    const data = await res.json();
    if (!res.ok) {
      setResultadoSorteio(data.error ?? "Não foi possível sortear os domingos.");
      return;
    }
    setResultadoSorteio(
      data.semDomingoAntes === 0
        ? "Todo mundo já tinha um domingo do mês definido."
        : `${data.criados} de ${data.semDomingoAntes} sorteados.${
            data.erros?.length > 0 ? ` ${data.erros.length} com erro (${data.erros.map((e: any) => e.nome).join(", ")}).` : ""
          }`
    );
    load();
  }

  async function cancelarDireto(id: string) {
    if (!confirm("Cancelar essa folga direto? A pessoa fica livre pra escolher outra data.")) return;
    setBusyId(id);
    await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCELAR_DIRETO" }),
    });
    setBusyId(null);
    load();
  }

  function abrirMudarData(id: string, dataAtual: string) {
    setChangingDateId(id);
    setNewDateValue(dataAtual);
    setChangeError(null);
  }

  async function confirmarMudarData(id: string) {
    if (!newDateValue) return;
    setBusyId(id);
    setChangeError(null);
    const res = await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ALTERAR_DATA", date: newDateValue }),
    });
    setBusyId(null);
    if (res.ok) {
      setChangingDateId(null);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setChangeError(data?.error ?? "Não foi possível mudar a data.");
    }
  }

  function gerarRelatorio() {
    const aprovadas = entriesDoSetor.filter((e) => e.status === "APROVADA");
    const porTipo = new Map<LeaveEntry["type"], Map<string, string[]>>();
    for (const e of aprovadas) {
      if (!porTipo.has(e.type)) porTipo.set(e.type, new Map());
      const porData = porTipo.get(e.type)!;
      const nomes = porData.get(e.date) ?? [];
      nomes.push(primeiroNome(e.employeeName));
      porData.set(e.date, nomes);
    }

    let texto = `Então, ficaram assim as folgas de ${MESES[m - 1].toLowerCase()}${sectorFilter !== "Todos" ? ` (${sectorFilter})` : ""}:\n\n`;
    let temAlgumaFolga = false;
    for (const tipo of ORDEM_RELATORIO) {
      const porData = porTipo.get(tipo);
      if (!porData || porData.size === 0) continue;
      temAlgumaFolga = true;
      texto += `${TITULO_RELATORIO[tipo]}\n`;
      for (const data of Array.from(porData.keys()).sort()) {
        const [, mes, dia] = data.split("-");
        texto += `${dia}/${mes} – ${juntarNomes(porData.get(data)!)}\n`;
      }
      texto += "\n";
    }
    setRelatorio(temAlgumaFolga ? texto.trim() : "Nenhuma folga aprovada neste mês ainda.");
    setCopiado(false);
  }

  async function copiarRelatorio() {
    if (!relatorio) return;
    await navigator.clipboard.writeText(relatorio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const [year, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const monthLabel = `${MESES[m - 1]} de ${year}`;
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const entriesCombinadas = [...entries, ...entriesFolgaSemanal(employees, year, m, daysInMonth)];

  const setores = [
    "Todos",
    ...Array.from(new Set([...setoresAtivos, ...entriesCombinadas.map((e) => e.sector)])).sort(),
  ];
  const entriesDoSetor =
    sectorFilter === "Todos" ? entriesCombinadas : entriesCombinadas.filter((e) => e.sector === sectorFilter);
  const entriesDoSetorETipo =
    typeFilter === "Todos" ? entriesDoSetor : entriesDoSetor.filter((e) => e.type === typeFilter);

  const entriesByDate = new Map<string, LeaveEntry[]>();
  for (const e of entriesDoSetorETipo) {
    const ativas = e.status !== "CANCELADA" && e.status !== "RECUSADA";
    if (!ativas) continue;
    const list = entriesByDate.get(e.date) ?? [];
    list.push(e);
    entriesByDate.set(e.date, list);
  }

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  const selectedEntries = selectedDate ? (entriesByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => {
            const prev = new Date(Date.UTC(year, m - 2, 1));
            setMonth(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`);
          }}
        >
          ← Anterior
        </button>
        <p className="font-display font-semibold text-carvao-900">{monthLabel}</p>
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => {
            const next = new Date(Date.UTC(year, m, 1));
            setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
          }}
        >
          Próximo →
        </button>
      </div>

      {setores.length > 2 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {setores.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSectorFilter(s);
                setSelectedDate(null);
                setRelatorio(null);
              }}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                sectorFilter === s
                  ? "bg-vinho-500 text-crosta-50"
                  : "border border-carvao-100 bg-white text-carvao-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {TIPOS_FILTRO.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTypeFilter(t);
              setSelectedDate(null);
              setRelatorio(null);
            }}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
              typeFilter === t
                ? "bg-crosta-500 text-white"
                : "border border-carvao-100 bg-white text-carvao-600"
            }`}
          >
            {LABEL_TIPO_FILTRO[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="py-1 text-xs font-semibold uppercase text-carvao-500">
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const dayNum = Number(iso.slice(-2));
          const dayEntries = entriesByDate.get(iso) ?? [];
          const temAprovada = dayEntries.some((e) => e.status === "APROVADA");
          const isSelected = selectedDate === iso;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(isSelected ? null : iso)}
              className={`relative aspect-square rounded-card border text-sm font-semibold transition ${
                isSelected
                  ? "border-vinho-500 bg-vinho-500 text-white"
                  : temAprovada
                    ? "border-vinho-400 bg-vinho-50 text-carvao-900 hover:bg-vinho-100"
                    : dayEntries.length > 0
                      ? "border-crosta-500 bg-crosta-50 text-carvao-900 hover:bg-crosta-100"
                      : "border-carvao-100 bg-white text-carvao-500 hover:bg-crosta-50"
              }`}
            >
              {dayNum}
              {dayEntries.length > 0 && (
                <span
                  className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-bold ${
                    isSelected ? "bg-white text-vinho-500" : temAprovada ? "bg-vinho-500 text-white" : "bg-crosta-500 text-white"
                  }`}
                >
                  {dayEntries.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-carvao-500">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-vinho-400 align-middle" /> aprovada ·{" "}
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-crosta-500 align-middle" /> pendente. Toque num dia
        pra ver quem folgou.
      </p>

      <button onClick={gerarRelatorio} className="btn-secondary mt-3 w-full text-sm">
        Gerar relatório do mês
      </button>

      <button
        onClick={sortearDomingos}
        disabled={sorteando}
        className="btn-secondary mt-2 w-full text-sm"
      >
        {sorteando ? "Sorteando…" : "Sortear domingos do mês (quem falta)"}
      </button>
      {resultadoSorteio && <p className="mt-2 text-sm text-carvao-700">{resultadoSorteio}</p>}

      <button
        onClick={sortearFolgaSemanal}
        disabled={sorteandoSemanal}
        className="btn-secondary mt-2 w-full text-sm"
      >
        {sorteandoSemanal ? "Sorteando…" : "Sortear folga semanal (quem falta)"}
      </button>
      {resultadoSorteioSemanal && <p className="mt-2 text-sm text-carvao-700">{resultadoSorteioSemanal}</p>}

      <button
        onClick={sortearCompensatoria}
        disabled={sorteandoComp}
        className="btn-secondary mt-2 w-full text-sm"
      >
        {sorteandoComp ? "Sorteando…" : "Sortear compensatória (quem tem crédito)"}
      </button>
      {resultadoSorteioComp && <p className="mt-2 text-sm text-carvao-700">{resultadoSorteioComp}</p>}

      {relatorio && (
        <div className="mt-3 rounded-card border border-carvao-100 bg-crosta-50 p-3">
          <pre className="whitespace-pre-wrap font-sans text-sm text-carvao-900">{relatorio}</pre>
          <button onClick={copiarRelatorio} className="btn-primary mt-3 w-full text-sm">
            {copiado ? "Copiado!" : "Copiar pra enviar no WhatsApp"}
          </button>
        </div>
      )}

      {selectedDate && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-carvao-900">
            {Number(selectedDate.slice(-2))} de {MESES[m - 1]}
          </p>
          {selectedEntries.length === 0 && (
            <p className="text-sm text-carvao-500">Ninguém folgando nesse dia.</p>
          )}
          {selectedEntries.map((e) => (
            <div key={e.id} className="rounded-card border border-carvao-100 bg-crosta-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-carvao-900">{e.employeeName}</p>
                  <p className="text-xs text-carvao-500">
                    {e.jobFunctionName} · {typeLabel[e.type]} ·{" "}
                    <span
                      className={
                        e.status === "APROVADA"
                          ? "text-oliva-500"
                          : e.status === "CANCELAMENTO_SOLICITADO"
                            ? "text-vinho-500"
                            : "text-crosta-500"
                      }
                    >
                      {statusLabel[e.status] ?? e.status}
                    </span>
                  </p>
                </div>
                {e.type !== "FOLGA_SEMANAL" &&
                  (e.status === "PENDENTE" || e.status === "APROVADA") &&
                  changingDateId !== e.id && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      onClick={() => abrirMudarData(e.id, e.date)}
                      className="text-xs font-semibold text-carvao-700 hover:underline"
                    >
                      Mudar data
                    </button>
                    <button
                      disabled={busyId === e.id}
                      onClick={() => cancelarDireto(e.id)}
                      className="text-xs font-semibold text-vinho-500 hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {changingDateId === e.id && (
                <div className="mt-3 space-y-2">
                  <input
                    type="date"
                    className="field-input"
                    value={newDateValue}
                    onChange={(ev) => setNewDateValue(ev.target.value)}
                  />
                  {changeError && <p className="text-xs text-vinho-500">{changeError}</p>}
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === e.id || !newDateValue}
                      onClick={() => confirmarMudarData(e.id)}
                      className="btn-primary flex-1 text-xs"
                    >
                      Confirmar nova data
                    </button>
                    <button
                      disabled={busyId === e.id}
                      onClick={() => setChangingDateId(null)}
                      className="btn-secondary flex-1 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
