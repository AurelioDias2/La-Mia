// Ordem de exibição preferida dos 3 setores principais da La Mia — qualquer
// outro setor que a Direção crie no futuro aparece depois, em ordem alfabética.
const ORDEM_SETORES = ["Pronta Entrega", "Produção", "Serviços Gerais"];

// Rótulo do campo de função interna, que muda de nome conforme o setor
// (seção "Organização dos setores no cadastro"): Cargo na Pronta Entrega,
// Praça na Produção, Função em Serviços Gerais (e em qualquer setor novo).
const LABEL_POR_SETOR: Record<string, string> = {
  "Pronta Entrega": "Cargo",
  Produção: "Praça",
  "Serviços Gerais": "Função",
};

export function ordenarSetores(setores: string[]): string[] {
  return [...setores].sort((a, b) => {
    const ia = ORDEM_SETORES.indexOf(a);
    const ib = ORDEM_SETORES.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function labelCargoPorSetor(setor: string): string {
  return LABEL_POR_SETOR[setor] ?? "Função";
}
