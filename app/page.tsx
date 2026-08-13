"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setErrorMsg(
        "Usuário/WhatsApp ou senha incorretos, ou seu cadastro ainda não foi aprovado."
      );
      return;
    }

    // O papel do usuário decide o destino (seção 3). O middleware garante
    // isso de novo no servidor a cada navegação subsequente.
    router.refresh();
    const target = username === "Lamia" ? "/admin" : "/funcionario";
    router.push(target);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-crosta-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="mb-1 font-display text-sm italic text-crosta-500">Gestão de Folgas</p>
          <h1 className="font-display text-4xl font-semibold leading-tight text-vinho-500">
            La Mia
            <br />
            Dolce Vita
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {searchParams.get("erro") === "ACESSO_NAO_AUTORIZADO" && (
            <p className="pill bg-vinho-50 text-vinho-500">Acesso não autorizado à área anterior.</p>
          )}
          <div>
            <label className="field-label" htmlFor="username">
              Usuário/WhatsApp
            </label>
            <input
              id="username"
              className="field-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
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
              autoComplete="current-password"
              required
            />
          </div>

          {errorMsg && <p className="text-sm text-vinho-500">{errorMsg}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <Link href="/cadastro" className="font-semibold text-vinho-500 hover:underline">
            Criar meu cadastro
          </Link>
          <Link href="/esqueci-senha" className="text-carvao-500 hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </main>
  );
}
