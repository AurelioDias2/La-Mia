-- Fechamento fixo passa de único (loja inteira) para um dia por setor.

-- CreateTable
CREATE TABLE "sector_closed_weekday" (
    "sector" TEXT NOT NULL,
    "closedWeekday" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sector_closed_weekday_pkey" PRIMARY KEY ("sector")
);

-- Migra o valor atual (Settings.fixedClosedWeekday, sempre existiu = 1 =
-- segunda) para os setores que hoje seguem o fechamento geral da loja
-- (followsStoreClosure = true em pelo menos uma função) — preserva o
-- comportamento exato de antes da migração.
INSERT INTO sector_closed_weekday (sector, "closedWeekday", "updatedAt")
SELECT DISTINCT jf.sector, s."fixedClosedWeekday", CURRENT_TIMESTAMP
FROM job_functions jf
CROSS JOIN "Settings" s
WHERE jf."followsStoreClosure" = true
ON CONFLICT (sector) DO NOTHING;

-- Setores sem nenhuma função com fechamento geral (ex: Produção) ficam sem
-- dia fixo (NULL) — mesmo efeito que já tinham antes.
INSERT INTO sector_closed_weekday (sector, "closedWeekday", "updatedAt")
SELECT DISTINCT jf.sector, NULL::INTEGER, CURRENT_TIMESTAMP
FROM job_functions jf
ON CONFLICT (sector) DO NOTHING;

-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "fixedClosedWeekday";
