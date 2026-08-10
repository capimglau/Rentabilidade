# Preferências do projeto

## Fluxo de entrega
- **Sempre abrir um Pull Request** para a `main` após enviar (push) as alterações de uma branch — sem precisar pedir a cada vez.
- **Sempre fazer o merge** do PR na `main` (squash) em seguida, sem precisar pedir.

## Consistência dos lançamentos
- **Toda alteração em lançamento (criar, editar, excluir, baixar, reverter, importar) tem que terminar alimentando todos os painéis, gráficos, listas e modais que dependam dele** — Resumo, Boletos do mês, Fluxo de Caixa, Lançamentos, Baixas, Proprietários, Faturamento por categoria, busca global e qualquer coisa nova que vier a depender de `DATA`/`NOVOS`. Nenhuma tela pode ficar mostrando dado velho depois de uma mutação, local ou vinda da sincronização automática de outro aparelho.
- Na prática: toda função que grava/edita/apaga um lançamento **precisa terminar chamando `renderAll()`** (que já repinta a página atual e, se o modal de busca/dia/categoria estiver aberto, também o atualiza via `refreshMSearch()`). Se a alteração mexeu em **placa, cliente, proprietário, tipo ou forma**, também precisa chamar **`popSel()`** (reindexação de placas, datalist de clientes e as listas/filtros de dono, tipo e forma) — sem isso o autocomplete e os filtros ficam um passo atrás do que acabou de mudar.
- Ao adicionar um novo painel, gráfico, lista ou modal que leia lançamentos: ou ele lê `allD()`/`DATA`/`NOVOS` direto a cada render (preferível — sem estado próprio pra ficar desatualizado), ou, se guardar alguma seleção/estado (como o modal de busca reaproveitado por várias origens), registra como se atualizar sozinho em `renderAll()`, no mesmo espírito de `ULTIMO_MSEARCH`/`refreshMSearch()`.
- Nunca remover um lançamento só da memória/da tela (ex.: só um `.splice()` num array local) se ele já foi gravado no banco — isso deixa um registro fantasma que some da interface mas continua contando nos totais. Remoção sempre passa pela função de exclusão real (que apaga no banco e só depois atualiza a tela).
