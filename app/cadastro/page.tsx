"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";
import { ordenarSetores, labelCargoPorSetor } from "@/lib/setores";

type JobFunction = { id: string; name: string; sector: string };

export default function CadastroPage() {
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [setor, setSetor] = useState("");
  const [jobFunctionId, setJobFunctionId] = useState("");
  const [temSecundaria, setTemSecundaria] = useState(false);
  const [setorSecundario, setSetorSecundario] = useState("");
  const [secondaryJobFunctionId, setSecondaryJobFunctionId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/job-functions")
      .then((r) => r.json())
      .then(setJobFunctions)
      .catch(() => setErrorMsg("Não foi possível carregar a lista de funções."));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        whatsapp,
        jobFunctionId,
        secondaryJobFunctionId: temSecundaria ? secondaryJobFunctionId : undefined,
        password,
        confirmPassword,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMsg(extractErrorMessage(data, "Não foi possível concluir o cadastro."));
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-crosta-50 px-6 py-12">
        <div className="card w-full max-w-sm text-center">
          <p className="mb-3 text-3xl">✅</p>
          <h1 className="mb-2 font-display text-xl font-semibold text-vinho-500">
            Cadastro realizado com sucesso.
          </h1>
          <p className="text-carvao-500">
            Aguarde a aprovação da Direção da La Mia Dolce Vita.
          </p>
          <Link href="/" className="btn-secondary mt-6 w-full">
            Voltar ao login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-crosta-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center font-display text-2xl font-semibold text-vinho-500">
          Criar meu cadastro
        </h1>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="field-label" htmlFor="fullName">
              Nome completo
            </label>
            <input
              id="fullName"
              className="field-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="whatsapp">
              WhatsApp
            </label>
            <input
              id="whatsapp"
              className="field-input"
              placeholder="(98) 9XXXX-XXXX"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="setor">
              Setor
            </label>
            <select
              id="setor"
              className="field-input"
              value={setor}
              onChange={(e) => {
                setSetor(e.target.value);
                setJobFunctionId("");
              }}
              required
            >
              <option value="" disabled>
                Toque para selecionar
              </option>
              {ordenarSetores(Array.from(new Set(jobFunctions.map((f) => f.sector)))).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {setor && (
            <div>
              <label className="field-label" htmlFor="jobFunction">
                {labelCargoPorSetor(setor)}
              </label>
              <select
                id="jobFunction"
                className="field-input"
                value={jobFunctionId}
                onChange={(e) => setJobFunctionId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Toque para selecionar
                </option>
                {jobFunctions
                  .filter((f) => f.sector === setor)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          {setor && jobFunctionId && (
            <div>
              <label className="flex items-center gap-2 text-sm text-carvao-700">
                <input
                  type="checkbox"
                  checked={temSecundaria}
                  onChange={(e) => {
                    setTemSecundaria(e.target.checked);
                    if (!e.target.checked) {
                      setSetorSecundario("");
                      setSecondaryJobFunctionId("");
                    }
                  }}
                  className="h-4 w-4 accent-vinho-500"
                />
                Também ajudo em outra praça/função
              </label>
            </div>
          )}
          {temSecundaria && (
            <div>
              <label className="field-label" htmlFor="setorSecundario">
                Setor da praça/função secundária
              </label>
              <select
                id="setorSecundario"
                className="field-input"
                value={setorSecundario}
                onChange={(e) => {
                  setSetorSecundario(e.target.value);
                  setSecondaryJobFunctionId("");
                }}
              >
                <option value="" disabled>
                  Toque para selecionar
                </option>
                {ordenarSetores(Array.from(new Set(jobFunctions.map((f) => f.sector)))).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {temSecundaria && setorSecundario && (
            <div>
              <label className="field-label" htmlFor="secondaryJobFunction">
                {labelCargoPorSetor(setorSecundario)} secundária
              </label>
              <select
                id="secondaryJobFunction"
                className="field-input"
                value={secondaryJobFunctionId}
                onChange={(e) => setSecondaryJobFunctionId(e.target.value)}
              >
                <option value="" disabled>
                  Toque para selecionar
                </option>
                {jobFunctions
                  .filter((f) => f.sector === setorSecundario && f.id !== jobFunctionId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="confirmPassword">
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="field-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {errorMsg && <p className="text-sm text-vinho-500">{errorMsg}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Enviando…" : "Enviar cadastro"}
          </button>
        </form>

        <Link href="/" className="mt-6 block text-center text-sm text-carvao-500 hover:underline">
          Voltar ao login
        </Link>
      </div>
    </main>
  );
}
