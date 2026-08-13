import { SignOutButton } from "@/components/SignOutButton";

export default function FuncionarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-crosta-50">
      <header className="flex items-center justify-between border-b border-carvao-100 bg-white px-5 py-4">
        <div>
          <p className="font-display text-xs italic text-crosta-500">Gestão de Folgas</p>
          <h1 className="font-display text-lg font-semibold text-vinho-500">La Mia Dolce Vita</h1>
        </div>
        <div className="w-28">
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-6">{children}</main>
    </div>
  );
}
