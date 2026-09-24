-- AutoGest Pro · achar Comissões duplicadas (SÓ LISTA — não apaga nada)
-- ─────────────────────────────────────────────────────────────────────
-- Antes da correção de duplicação (editar um lançamento com a caixinha
-- "Comissão a abater" ticada criava uma Comissão NOVA a cada salvar, em vez
-- de reaproveitar a que já existia), lançamentos tipo 'Comissão' podem ter
-- se acumulado repetidos: mesma placa+cliente+vencimento+valor, um por
-- edição salva.
--
-- Este script só CONSULTA — não apaga nenhum registro. Rode no SQL Editor
-- do Supabase, revise a lista e decida à mão o que excluir (pelo app, em
-- Lançamentos, ou por um DELETE separado depois de conferir os ids).
--
-- PASSO 1 — grupos duplicados: mesma placa, cliente, vencimento e valor,
-- tipo Comissão, mais de um registro.
select
  placa, cliente, prev_pgto, valor,
  count(*)                                as qtd,
  array_agg(id order by created_at)       as ids,               -- o 1º da lista é o mais antigo
  array_agg(valor_pago order by created_at) as valores_pagos,    -- diz quais já foram baixados
  array_agg(data_pagamento order by created_at) as datas_pagamento,
  array_agg(obs order by created_at)      as obs
from public.lancamentos
where tipo = 'Comissão'
group by placa, cliente, prev_pgto, valor
having count(*) > 1
order by prev_pgto desc;

-- PASSO 2 (opcional) — mesmo grupo, mas com uma linha por registro (mais
-- fácil de ler/exportar que os array_agg do passo 1). Roda separado.
-- select l.*
-- from public.lancamentos l
-- join (
--   select placa, cliente, prev_pgto, valor
--   from public.lancamentos
--   where tipo = 'Comissão'
--   group by placa, cliente, prev_pgto, valor
--   having count(*) > 1
-- ) dup using (placa, cliente, prev_pgto, valor)
-- where l.tipo = 'Comissão'
-- order by l.placa, l.cliente, l.prev_pgto, l.created_at;

-- PASSO 3 (só depois de revisar à mão) — MODELO de exclusão, NÃO rode sem
-- confirmar cada id: mantém o mais antigo de cada grupo (o 1º do array_agg
-- acima) e apaga os demais. Comente/descomente e troque a lista de ids
-- pelos que você decidiu apagar.
-- delete from public.lancamentos
-- where id in (/* cole aqui só os ids a apagar, ex: 123, 456, 789 */)
--   and tipo = 'Comissão';
