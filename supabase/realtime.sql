-- ─────────────────────────────────────────────────────────────
--  Atualização automática (Realtime)
-- ─────────────────────────────────────────────────────────────
--  Publica a tabela 'lancamentos' no canal de tempo real do Supabase.
--  Com isso, qualquer inclusão, alteração ou exclusão — feita neste
--  aparelho, em outro, ou por outra pessoa — chega no app aberto e os
--  números se refazem sozinhos, sem precisar recarregar a página.
--
--  Rode uma vez, no SQL Editor do Supabase.
--
--  Sem rodar isto o app continua funcionando: ele se atualiza sempre que
--  você volta para a aba/janela. O que muda é a atualização ser na hora.
--
--  Observação: o Realtime respeita a RLS da tabela. As políticas de
--  schema.sql liberam leitura para a chave anônima, então nada mais
--  precisa ser ajustado.
-- ─────────────────────────────────────────────────────────────

-- 'add table' dá erro se a tabela já estiver publicada; o bloco abaixo
-- ignora esse caso para o script poder ser rodado mais de uma vez.
do $$
begin
  alter publication supabase_realtime add table public.lancamentos;
exception
  when duplicate_object then
    raise notice 'lancamentos já estava publicada no supabase_realtime.';
end $$;

-- Para os eventos de UPDATE e DELETE chegarem com o registro completo
-- (e não só com a chave primária).
alter table public.lancamentos replica identity full;

-- Conferência: deve listar 'lancamentos'.
select tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public';
