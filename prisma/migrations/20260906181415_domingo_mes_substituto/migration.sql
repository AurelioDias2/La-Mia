-- Novo valor do enum LeaveType: DOMINGO_MES_SUBSTITUTO
-- Usado por quem já folga toda semana no domingo — pra essa turma, o
-- direito ao "domingo do mês" vira 1 dia de semana no mês, tipo à parte
-- pra não se confundir com folga semanal nem compensatória.
ALTER TYPE "LeaveType" ADD VALUE 'DOMINGO_MES_SUBSTITUTO';
