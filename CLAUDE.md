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

## O que já foi baixado também aparece no board, dia a dia — `[agenda-dia-a-dia-pago]`

Pedido do usuário: *"eu quero que apareça tudo que já foi baixado também,
dia a dia."* — dito depois de eu explicar que "Atrasados" já mostra TUDO
que está em aberto, sem corte de data: o que faltava não era mais
pendência, era **histórico**. O board (`renderAgendaBoardHtml`) só existia
pra PENDENTE (`isPend`); assim que um lançamento era baixado, ele **sumia**
do board por completo — continuava só no Calendário (`renderRecCalGridHtml`,
que já mistura recebido+pendente por dia, célula a célula).

**Janela: últimos 7 dias** (`addD(hoje,-6)` até `hoje`, escolha do usuário
entre 7/30/sem-limite). Diferente de "Atrasados", que não tem limite —
lá é dívida em aberto que não pode se perder de vista nunca; aqui é
histórico já resolvido, e uma semana já responde "o que entrou nos
últimos dias" sem o board crescer sem parar com o tempo.

**Ordem das colunas**: `[Atrasados] [dias pagos, do mais antigo pro mais
recente] [dias futuros pendentes]`. Atrasados continua **sempre primeiro**
— é o que pede ação, e essa posição já era uma decisão repetida ao longo
deste projeto. Os dias pagos entram DEPOIS dele: lendo da esquerda pra
direita, o board conta *"o que ainda pesa · o que já foi resolvido há
pouco · o que vem por aí"*.

**Coluna paga é uma coluna própria, mesmo quando cai no mesmo dia de uma
coluna pendente.** Se algo foi pago HOJE e também tem algo pendente
vencendo HOJE, aparecem **duas** colunas "hoje" lado a lado — uma verde
(pago), uma azul (`agb-hoje`, pendente) — em vez de misturar as duas numa
só. Juntar as duas exigiria que `agbCardHtml`/`agruparPorCliente` soubessem
que um GRUPO pode ter parte paga e parte pendente ao mesmo tempo, o que não
existe hoje — feito assim de propósito, pra não arriscar o card de baixa
(testado e em produção) por causa de uma feature nova.

### O card pago é outra coisa, não um card pendente cinza

- **Sem tick** — não há nada pra baixar, já foi. `checkBtn=''` quando
  `pago`.
- **Sem grupo de baixa** — cartão de 1 lançamento (`n===1`) abre `openEdit`
  direto (pra corrigir valor/data, ou reverter pelo swipe de lá); grupo de
  vários (`n>1`) não abre nada — não existe (e não faz sentido criar) um
  modal de "ver os pagos".
- **Sem coluna de ícones quando não há ícone nenhum.** `temAcao =
  !!(editBtn||checkBtn)` decide JUNTOS a classe `.agb-card-check-on` (que
  reserva o `padding-right`) e o próprio `<div class="agb-card-acts">` — um
  card pago agrupado (sem tick, sem lápis) não tem NENHUM dos dois, e sem
  essa checagem sobraria um vão morto do lado direito.
- **Valor mostrado é `valor_pago`, nunca `saldo`.** `grp.total`
  (`agruparPorCliente`) soma `saldo` — que é **0 por definição** num
  lançamento pago (é o próprio `isPago`). Card e cabeçalho da coluna paga
  somam `valor_pago` à parte (`valorMostrado` no card; o `total` de
  `agbColHtml` também troca de campo quando `pago`). Sem essa troca, todo
  card/coluna paga mostraria **R$ 0,00** — mesmo padrão que o painel de
  Boletos já usa (`g.totalPago` vs `g.totalSaldo`).
- **Selo verde "✓ Recebido"** no lugar do selo de atraso — mesma classe de
  forma/tamanho (`.agb-ev-pago`, cor de `.cal-ok` do Calendário), nunca o
  vermelho de atraso.
- **Cabeçalho da coluna tinge de verde** (`.agb-col.agb-pago .agb-col-hd`),
  mesmo padrão que "hoje" (azul) e "Atrasados" (vermelho) já usam — é o que
  deixa claro, batendo o olho, que aquele dia é passado **resolvido**.
- **O chip do total no cabeçalho não é clicável** (`.agb-dh-in-pago`) —
  não existe `baixarTudoDia` pra aplicar num dia que já foi todo pago.

Travado pelo comportamento visual, não por teste automatizado (app sem
suíte de testes própria) — conferido no navegador com backend dublê:
card único paga → edita; card agrupado pago → não faz nada; lápis no card
pago → edita; nenhuma mudança no comportamento dos cards PENDENTES (tick
abre confirmar baixa, toque abre parcial, "baixar tudo do dia" continua
funcionando).

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
