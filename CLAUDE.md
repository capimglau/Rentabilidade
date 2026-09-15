# Preferências do projeto

## Fluxo de entrega
- **Sempre abrir um Pull Request** para a `main` após enviar (push) as alterações de uma branch — sem precisar pedir a cada vez.
- **Sempre fazer o merge** do PR na `main` (squash) em seguida, sem precisar pedir.

## Consistência dos lançamentos
- **Toda alteração em lançamento (criar, editar, excluir, baixar, reverter, importar) tem que terminar alimentando todos os painéis, gráficos, listas e modais que dependam dele** — Resumo, Boletos do mês, Fluxo de Caixa, Lançamentos, Baixas, Proprietários, Faturamento por categoria, busca global e qualquer coisa nova que vier a depender de `DATA`/`NOVOS`. Nenhuma tela pode ficar mostrando dado velho depois de uma mutação, local ou vinda da sincronização automática de outro aparelho.
- Na prática: toda função que grava/edita/apaga um lançamento **precisa terminar chamando `renderAll()`** (que já repinta a página atual e, se o modal de busca/dia/categoria estiver aberto, também o atualiza via `refreshMSearch()`). Se a alteração mexeu em **placa, cliente, proprietário, tipo ou forma**, também precisa chamar **`popSel()`** (reindexação de placas, datalist de clientes e as listas/filtros de dono, tipo e forma) — sem isso o autocomplete e os filtros ficam um passo atrás do que acabou de mudar.
- Ao adicionar um novo painel, gráfico, lista ou modal que leia lançamentos: ou ele lê `allD()`/`DATA`/`NOVOS` direto a cada render (preferível — sem estado próprio pra ficar desatualizado), ou, se guardar alguma seleção/estado (como o modal de busca reaproveitado por várias origens), registra como se atualizar sozinho em `renderAll()`, no mesmo espírito de `ULTIMO_MSEARCH`/`refreshMSearch()`.
- Nunca remover um lançamento só da memória/da tela (ex.: só um `.splice()` num array local) se ele já foi gravado no banco — isso deixa um registro fantasma que some da interface mas continua contando nos totais. Remoção sempre passa pela função de exclusão real (que apaga no banco e só depois atualiza a tela).

## Agenda: quem baixa é o TICK; o cartão abre o detalhe

O cartão da agenda junta o que um cliente deve num dia — "Kablan · Locação ·
**6 lançamentos** · Boleto". Tocá-lo em qualquer canto chamava
`baixarTudoCliente` e quitava **os seis de uma vez**, sem escolher e sem
mostrar o que estava sendo quitado.

Agora são duas ações com alvos diferentes:

| gesto | cartão agrupado (n>1) | cartão de 1 lançamento |
|---|---|---|
| **tick** (`.agb-card-check`, à direita) | baixa **cheia** de todos (`baixarTudoCliente`, com o confirm de sempre) | `abrirParcial(idx,true)` — valor cheio já preenchido |
| **toque no cartão** | abre o **detalhe** (`abrirAgbGrupo`): a lista dos lançamentos, cada um com seu tique | `abrirParcial(idx,false)` — o modal de parcial, valor em branco |

Regras do detalhe (`#mAgbGrupo`):

- **A lista é recalculada a cada render** a partir de `(dia, cliente)` —
  `_agbAlvosCliente`. Nunca guarde os registros: a lista muda embaixo do modal
  quando uma baixa chega de outro aparelho pela sincronização, e uma cópia
  velha baixaria o que já foi baixado. É o mesmo espírito de
  `ULTIMO_MSEARCH`/`refreshMSearch`, e por isso `renderAll()` chama
  **`refreshAgbGrupo()`**.
- **A seleção é guardada por `agbChaveRec(r)`** (`id` do banco, ou o índice
  quando o registro ainda não foi gravado) — nunca por posição no array, que
  muda a cada sincronização.
- **Abre com tudo marcado**: receber o cliente inteiro é o caso comum, então o
  trabalho vira **desmarcar** o que não entrou.
- **Marcar parte = baixar por inteiro só os marcados.** Recebeu metade de UM
  lançamento? Isso é outra coisa, e continua sendo o modal que já existia —
  o botão **"◐ parcial"** da linha leva até ele. O detalhe **não** duplica
  aquele formulário.
- **O título de cada linha é o VENCIMENTO**, não o nome do cliente: o
  cabeçalho já diz de quem é, e o vencimento é o que distingue uma linha da
  outra.

**Quem grava continua sendo `_baixarLoteConfirmado`** — a mesma função do tick
e do total do dia. O detalhe só escolhe **quais** e **quando**: o parâmetro
`dataPag` foi acrescentado por causa dele (o dinheiro pode ter entrado dias
antes do registro) e é **opcional**, então todos os chamadores antigos
continuam gravando hoje, como antes.

## Ritmo do trabalho
- **Calibrar a verificação pelo tamanho da mudança.** Trocar um texto, um número (tempo de exibição, tamanho de fonte, cor) ou coisa igualmente pontual: edita e sobe direto, sem abrir navegador/playwright pra testar. Guardar teste visual (screenshot, simulação, etc.) pra mudança de layout, efeito novo ou correção de bug visual — onde não dá pra confirmar só lendo o código.
