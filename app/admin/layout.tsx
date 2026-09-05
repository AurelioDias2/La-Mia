import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

const navItems = [
  { href: "/admin", label: "Início" },
  { href: "/admin/funcionarios", label: "Funcionários" },
  { href: "/admin/solicitacoes", label: "Solicitações" },
  { href: "/admin/calendario", label: "Calendário" },
  { href: "/admin/creditos", label: "Créditos" },
  { href: "/admin/folga-semanal", label: "Folga semanal" },
  { href: "/admin/lista-folgas", label: "Lista de folgas" },
  { href: "/admin/feriados", label: "Feriados" },
  { href: "/admin/funcoes", label: "Funções" },
  { href: "/admin/historico", label: "Histórico" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-crosta-50 pb-20 md:flex md:pb-0">
      <aside className="hidden w-56 shrink-0 border-r border-carvao-100 bg-white md:block">
        <div className="p-5">
          <p className="font-display text-sm italic text-crosta-500">Painel do Diretor</p>
          <h2 className="font-display text-lg font-semibold text-vinho-500">La Mia Dolce Vita</h2>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-card px-3 py-2 text-sm font-medium text-carvao-700 hover:bg-crosta-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>

      {/* Navegação inferior no celular (seção 29). */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-carvao-100 bg-white py-2 md:hidden">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-2 py-1 text-center text-[11px] font-medium text-carvao-700"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
