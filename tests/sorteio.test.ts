import { describe, expect, it } from "vitest";
import { distribuirBalanceado } from "../lib/sorteio";

function pessoas(n: number, jobFunctionId: string, prefixo = "p") {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefixo}-${i}`, jobFunctionId }));
}

function contarPorSlot(escolhas: Map<string, string>) {
  const contagem = new Map<string, number>();
  for (const slot of escolhas.values()) {
    contagem.set(slot, (contagem.get(slot) ?? 0) + 1);
  }
  return contagem;
}

// distribuirBalanceado é o núcleo dos sorteios (domingo do mês, folga
// semanal, compensatória) — a regra de negócio é: nunca deixar duas pessoas
// da mesma função/praça no mesmo slot quando existe opção pra evitar; só
// conflita quando não há slots suficientes pra todo mundo daquela função.
describe("distribuirBalanceado", () => {
  it("nunca repete slot pra mesma função quando há slots suficientes", () => {
    const grupo = pessoas(5, "praca-A");
    const slots = ["1", "2", "3", "4", "5", "6"]; // 6 slots pra 5 pessoas
    const escolhas = distribuirBalanceado(grupo, slots, new Map(), new Map());

    const slotsUsados = Array.from(escolhas.values());
    expect(new Set(slotsUsados).size).toBe(grupo.length); // todos distintos
  });

  it("funciona no limite exato (pessoas = slots)", () => {
    const grupo = pessoas(6, "praca-A");
    const slots = ["1", "2", "3", "4", "5", "6"];
    const escolhas = distribuirBalanceado(grupo, slots, new Map(), new Map());

    expect(new Set(escolhas.values()).size).toBe(6);
  });

  it("respeita contagem já existente (baseline) antes de repetir slot", () => {
    const grupo = pessoas(2, "praca-A");
    const slots = ["1", "2", "3"];
    // Slot "1" já tem alguém da praça-A antes do sorteio.
    const contagemPorSlotFuncao = new Map([["1|praca-A", 1]]);
    const contagemPorSlot = new Map([["1", 1]]);

    const escolhas = distribuirBalanceado(grupo, slots, contagemPorSlotFuncao, contagemPorSlot);
    const slotsUsados = Array.from(escolhas.values());

    // As duas pessoas novas devem ir pros slots ainda vazios (2 e 3), não
    // repetir o slot 1 que já tinha alguém da mesma praça.
    expect(slotsUsados.sort()).toEqual(["2", "3"]);
  });

  it("só repete slot pra mesma função quando não há opção (mais gente que slots)", () => {
    const grupo = pessoas(8, "praca-A"); // 8 pessoas, só 3 slots
    const slots = ["1", "2", "3"];
    const escolhas = distribuirBalanceado(grupo, slots, new Map(), new Map());

    const contagem = contarPorSlot(escolhas);
    const valores = Array.from(contagem.values());
    // Divisão o mais equilibrada possível: 8 pessoas em 3 slots -> 3,3,2.
    expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
    expect(valores.reduce((a, b) => a + b, 0)).toBe(8);
  });

  it("funções diferentes não afetam a distribuição uma da outra", () => {
    const grupoA = pessoas(4, "praca-A", "a");
    const grupoB = pessoas(4, "praca-B", "b");
    const slots = ["1", "2", "3", "4"]; // exatamente 4 slots por função

    const escolhas = distribuirBalanceado([...grupoA, ...grupoB], slots, new Map(), new Map());

    const slotsA = grupoA.map((p) => escolhas.get(p.id)!);
    const slotsB = grupoB.map((p) => escolhas.get(p.id)!);

    // Cada função sozinha nunca repete slot, mesmo que A e B ocupem o
    // mesmo slot entre si (isso não é conflito — são funções diferentes).
    expect(new Set(slotsA).size).toBe(4);
    expect(new Set(slotsB).size).toBe(4);
  });
});
