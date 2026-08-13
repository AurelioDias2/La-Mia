import Link from "next/link";

export default function EsqueciSenhaPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-crosta-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="card space-y-4 text-center">
          <h1 className="font-display text-2xl font-semibold text-vinho-500">Esqueci minha senha</h1>
          <p className="text-sm text-carvao-700">
            Ainda não temos um jeito automático de recuperar a senha por aqui. Chame a Direção da La
            Mia Dolce Vita pelo WhatsApp (ou pessoalmente) e peça uma senha temporária — ela consegue
            gerar uma nova para você na ficha do seu cadastro.
          </p>
          <p className="text-sm text-carvao-500">
            Depois de entrar com a senha temporária, recomendamos trocá-la assim que possível.
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <Link href="/" className="text-sm font-semibold text-vinho-500 hover:underline">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </main>
  );
}
