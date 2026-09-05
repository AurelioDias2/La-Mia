-- Corrige inconsistência de dados: alguns cargos de Pronta Entrega tinham o
-- próprio nome cadastrado como "setor" (ex: Cafeteria com sector="Cafeteria")
-- em vez de todos compartilharem o setor "Pronta Entrega" — o que fazia o
-- sistema tratar cada cargo como um setor isolado nos sorteios/abas do
-- calendário, misturando exatamente o que a Direção não quer. Só corrige o
-- campo "sector"; não mexe em funcionário nenhum.
UPDATE job_functions
SET sector = 'Pronta Entrega'
WHERE name IN ('Atendimento', 'Cafeteria', 'Delivery', 'Ensacamento', 'Forno/Assamento');
