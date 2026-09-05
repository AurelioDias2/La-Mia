-- Adiciona os cargos que faltavam em Pronta Entrega e as praças de Produção
-- (seção "organização dos setores no cadastro"), pra separar melhor os
-- funcionários nos sorteios: setor -> cargo/praça/função -> disponibilidade.
-- Aditivo e idempotente (ON CONFLICT DO NOTHING): não mexe em funções ou
-- funcionários já existentes.
INSERT INTO job_functions (id, name, sector, "followsStoreClosure", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text), 'Delivery', 'Pronta Entrega', true, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Gerência de Produção', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Massas', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Recheios', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Boleamento de Cookies', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Boleamento de Brigadeiros', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Potinhos', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Croissants', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Encomendas', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Estoque e Organização', 'Produção', false, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Forno', 'Produção', false, CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;
