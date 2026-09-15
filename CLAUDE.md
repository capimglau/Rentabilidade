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

### Os dois ícones do cartão ficam EMPILHADOS — `[agenda-acoes-empilhadas]`

O cartão tem duas ações no canto direito: **editar** (lapiseira, só em cartão
de 1 lançamento) e **baixar tudo** (o tick). Na primeira versão o tick de 36px
tomou o canto e empurrou a lapiseira para dentro do cartão — bem **em cima do
valor** (`R$ 550,00` com o lápis por cima). Relato do usuário: *"a edição e o
pagamento ficaram em conflito"*.

Eles moram numa **coluna** (`.agb-card-acts`), um sobre o outro, nunca lado a
lado:

- **24px cada** — dois de 36px não cabem na altura de 64px do cartão, e foi por
  isso que o tick encolheu.
- **A faixa reservada é uma só** (`.agb-card-check-on { padding-right:40px }`).
  A regra antiga que reservava faixa só para a lapiseira foi removida: duas
  regras de `padding-right` competindo é como o conflito nasceu.
- **`.agb-card-edit` é `position:static`** — quem posiciona é a coluna. Um
  `position:absolute` ali o tira da pilha e o lápis volta a flutuar sobre o
  valor.
- **A caixa dos dois é a mesma** (borda + fundo do cartão, raio 8px).
  Empilhados eles viram um par; um cheio e um vazado pareciam controles de
  sistemas diferentes.
- Com **um ícone só** (cartão agrupado, sem lapiseira) a coluna centraliza
  sozinha — nada a fazer.
- Os dois continuam com **`event.stopPropagation()`**: sem isso o clique sobe
  para o cartão e abre o detalhe por baixo da ação.

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

## Toda confirmação de lançamento ou baixa abre banner de Desfazer — `[desfazer-sistema]`

Pedido do usuário: *"para todo o sistema, a opção de desfazer. Ao efetivar
qualquer tipo de lançamento, baixa ou afins, na confirmação, abra um banner
de desfazer durante 5 segundos."*

O app já tinha esse padrão em alguns lugares (`showToast(msg, 'Desfazer',
fn)`, banner de 5s — `toastTimer` já era 5000ms, não precisou mudar). O que
faltava era **cobertura**: metade das telas que criam/editam/baixam um
lançamento não ofereciam Desfazer nenhum. Hoje cobrem:

| ação | função | o que o Desfazer devolve |
|---|---|---|
| Novo Lançamento | `addN` → `gravarComDesfazer` | apaga o(s) registro(s) criado(s) |
| Acrescentar ao contrato (edição) | `addItensContrato` → `gravarComDesfazer` | idem |
| Câmera/OCR | `confirmAI` → `gravarComDesfazer` | idem |
| Baixar (dentro da edição) | `confirmarBaixa` | `valor_pago`/`saldo`/`obs`/`data_pagamento` de volta |
| Baixa em lote (tela de Baixas) | `confirmarLote` → `_baixarLoteConfirmado` | idem, um por lançamento |
| Recebimento parcial/total (swipe) | `confirmarParcial` | idem *(já existia)* |
| Reverter pagamento (swipe) | `reverterPagamento` | idem *(já existia)* |
| Baixa em lote pela Agenda | `baixarTudoCliente`/`baixarTudoDia`/`confirmarAgbGrupo` → `_baixarLoteConfirmado` | idem *(já existia)* |
| Editar lançamento (sem reparcelar) | `saveEdit` (branch sem `redivide`) | TODOS os campos de `r` + os cadastrais das irmãs |
| Substituir veículo | `confirmarSubstituicao` | campos do original de volta + apaga o registro novo |

**`gravarComDesfazer(recs,label)`** é a função única para as TRÊS telas que
criam lançamento do zero (Novo Lançamento, OCR, Acrescentar ao contrato) —
grava, registra em `NOVOS` e mostra o banner; o Desfazer chama
`removerLancamento` em cada um. Sem isso seriam três cópias da mesma regra
divergindo com o tempo — mesmo raciocínio de `_baixarLoteConfirmado` já ser
a fonte única da baixa em lote.

**`confirmarLote`** (tela de Baixas) reescrevia a conta na mão
(`valor_pago`/`saldo`/`data_pagamento`) em vez de chamar
`_baixarLoteConfirmado`, que já existia com exatamente essa lógica pra
Agenda. Passou a chamar ela — ganhou o Desfazer de graça e parou de ser uma
segunda cópia da mesma regra. `_baixarLoteConfirmado` ganhou um 4º parâmetro
opcional (`nota`, só usado por essa tela) pra caber o caso do "obs
acrescentado ao lote" sem duplicar a função.

**`saveEdit` guarda o objeto `r` inteiro antes de mudar** (`const
prevR={...r}`), não uma lista de campos — assim o Desfazer sempre devolve
exatamente como estava, mesmo que a função ganhe um campo novo no futuro e
alguém esqueça de incluir na lista manual.

### O que continua SEM Desfazer, de propósito

- **`excluirLancamento`** — já não tinha (comentário original: *"não tem
  como reinserir do jeito que estava com segurança"*), continua sem.
- **`saveEdit` com reparcelamento** (`redivide`, ou quando `outrosPag`
  também redivide) — `sincronizarParcelas` cria e apaga parcela de
  verdade; reconstruir "como estava" com segurança não dá, mesmo motivo do
  item acima. O aviso continua aparecendo (o usuário vê o total/parcelas
  novas), só não oferece um desfazer que não teria volta garantida.

Qualquer confirmação nova de lançamento/baixa que este princípio alcançar
segue o mesmo molde: captura o estado de ANTES (o registro inteiro, quando
der — `{...r}` — ou os poucos campos que a ação muda, quando o registro
inteiro não fizer sentido), grava, e só então chama
`showToast(msg,'Desfazer',fn)` com `fn` restaurando esse estado + `dbUpdate`
+ `renderAll()`. Reservar a ausência de Desfazer só pro caso em que
restaurar não é seguro — e documentar o porquê, como acima.

## Ritmo do trabalho
- **Calibrar a verificação pelo tamanho da mudança.** Trocar um texto, um número (tempo de exibição, tamanho de fonte, cor) ou coisa igualmente pontual: edita e sobe direto, sem abrir navegador/playwright pra testar. Guardar teste visual (screenshot, simulação, etc.) pra mudança de layout, efeito novo ou correção de bug visual — onde não dá pra confirmar só lendo o código.
