-- AutoGest Pro · coluna "lanc_num" na tabela de lançamentos
-- ─────────────────────────────────────────────────────────────
-- Número do LANÇAMENTO PRINCIPAL. Cada item lançado (a locação, a lavagem,
-- a avaria...) ganha um número próprio na hora de gravar, e todas as
-- parcelas que ele gerar (Crédito 2x/3x) nascem com esse MESMO número —
-- é por ele que o app acha as parcelas irmãs pra:
--   • redividir o valor total quando ele é editado (450 → 300 vira 3×100);
--   • criar/excluir parcela quando a forma muda (3x → 2x apaga a 3ª);
--   • propagar placa/cliente/tipo/forma pro lançamento inteiro;
--   • perguntar, na exclusão, se é o lançamento todo ou só uma parcela.
--
-- Lançamentos do mesmo CONTRATO (mesma placa/cliente/período) continuam
-- com números DIFERENTES entre si: cada um é um lançamento principal, com
-- as suas próprias parcelas.
--
-- Sem esta coluna o app continua funcionando (agrupa as parcelas pelo texto
-- "Parcela X/N" do obs, como antes) — só não numera. Os lançamentos
-- antigos ganham número sozinhos na primeira vez que forem salvos pela
-- edição, sem precisar migrar nada à mão.
--
-- Rode no SQL Editor do Supabase.
-- ─────────────────────────────────────────────────────────────

alter table public.lancamentos
  add column if not exists lanc_num text;

create index if not exists idx_lancamentos_lanc_num on public.lancamentos (lanc_num);
