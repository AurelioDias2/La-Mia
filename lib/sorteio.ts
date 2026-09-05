export function embaralhar<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Distribui pessoas entre slots (domingos do mês, dias da semana etc.) de
 * forma balanceada: pra cada pessoa, escolhe o slot com menos gente da
 * MESMA função já alocada ali (contagem existente + já sorteada nesta
 * rodada) e, em caso de empate, o slot com menos gente no total — pra
 * nunca deixar uma função concentrada num slot só e manter a distribuição
 * geral proporcional entre os slots.
 *
 * As contagens de entrada já devem incluir o que existir antes do sorteio
 * (pedidos e atribuições anteriores), pra o resultado ficar equilibrado em
 * relação ao mês/escala inteira, não só entre quem está sendo sorteado agora.
 */
export function distribuirBalanceado(
  pessoas: { id: string; jobFunctionId: string }[],
  slots: string[],
  contagemPorSlotFuncao: Map<string, number>,
  contagemPorSlot: Map<string, number>
): Map<string, string> {
  const resultado = new Map<string, string>();
  for (const pessoa of embaralhar(pessoas)) {
    let melhorSlot = slots[0];
    let melhorScore: [number, number] | null = null;
    for (const slot of embaralhar(slots)) {
      const chaveFuncao = `${slot}|${pessoa.jobFunctionId}`;
      const porFuncao = contagemPorSlotFuncao.get(chaveFuncao) ?? 0;
      const total = contagemPorSlot.get(slot) ?? 0;
      if (!melhorScore || porFuncao < melhorScore[0] || (porFuncao === melhorScore[0] && total < melhorScore[1])) {
        melhorScore = [porFuncao, total];
        melhorSlot = slot;
      }
    }
    resultado.set(pessoa.id, melhorSlot);
    const chaveFuncao = `${melhorSlot}|${pessoa.jobFunctionId}`;
    contagemPorSlotFuncao.set(chaveFuncao, (contagemPorSlotFuncao.get(chaveFuncao) ?? 0) + 1);
    contagemPorSlot.set(melhorSlot, (contagemPorSlot.get(melhorSlot) ?? 0) + 1);
  }
  return resultado;
}
