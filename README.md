# AutoGest Pro

Sistema de gestão de locação de veículos (controle de lançamentos, baixas,
proprietários, resumos e premissas de taxas). App web de página única, com os
dados persistidos no **Supabase** e publicado no **GitHub Pages**.

Na aba **Proprietários**, ao clicar em um dono abre-se o **extrato financeiro**:
receitas previstas do mês (automáticas, a partir dos lançamentos) e despesas
operacionais lado a lado — com seletor de categorias (lavagem, óleo, pneus,
manutenção, etc., e "Outros" com texto livre) — além de um gráfico comparativo
mês a mês de receitas × despesas. As despesas ficam na tabela `despesas` do
Supabase (ou em `localStorage`, no modo demo / sem a tabela criada).

## Como está montado

| Camada     | Tecnologia                                            |
|------------|-------------------------------------------------------|
| Front-end  | `index.html` (HTML/CSS/JS puro + Chart.js)            |
| Banco      | Supabase (Postgres) — tabela `lancamentos`            |
| Deploy     | GitHub Pages (workflow em `.github/workflows`)        |
| IA (opc.)  | Edge Function `supabase/functions/ai-contrato`        |

Sem configurar o Supabase, o app abre em **modo demo** (dados de exemplo
embutidos, em memória, sem salvar). Configurando o `config.js`, ele passa a
ler e gravar de verdade.

---

## Passo 1 — Criar o banco no Supabase

1. Crie um projeto em https://supabase.com. Guarde a senha do banco.
2. Abra **SQL Editor → New query**, cole o conteúdo de **`supabase/setup.sql`**
   e clique em **Run**. É um script único: cria as 4 tabelas com as políticas,
   carrega a frota (185 veículos) e os 753 lançamentos da planilha.
3. Em **Project Settings → API**, copie:
   - **Project URL**
   - chave **anon public**

> Os scripts avulsos (`schema.sql`, `seed.sql`, `veiculos.sql`,
> `boleto_feito.sql`) continuam no repositório para rodar uma parte de cada
> vez. O `setup.sql` é a soma deles, na ordem certa.
>
> Cuidado: a PARTE 5 do `setup.sql` começa com `truncate` nos lançamentos.
> Em banco novo é o desejado; em banco já em uso, pule essa parte.
>
> O que a planilha vira no banco (normalizações de placa, forma de pagamento,
> donos em branco e datas com erro de digitação) está detalhado em
> `supabase/README-import.md`.

## Passo 2 — Conectar o app

Edite o arquivo `config.js` na raiz do repositório:

```js
window.AUTOGEST_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  key: "SUA_CHAVE_ANON_PUBLIC",
  aiProxy: ""   // opcional, ver Passo 5
};
```

> A chave `anon` é pública por natureza — pode ficar no repositório. A proteção
> dos dados vem da Row Level Security (RLS) do Supabase, não do segredo da chave.

## Passo 3 — Publicar no GitHub Pages

O workflow `.github/workflows/deploy.yml` publica automaticamente a cada push.
Basta habilitar o Pages uma vez:

1. No GitHub: **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. O site sai em `https://<usuario>.github.io/agi/` após o workflow concluir.

(Alternativa sem Actions: em **Settings → Pages → Source**, escolher
"Deploy from a branch" e apontar para a branch/raiz que contém o `index.html`.)

## Passo 4 — Atualização automática (opcional, recomendado)

Rode **`supabase/realtime.sql`** uma vez no SQL Editor. Ele publica a tabela
`lancamentos` no canal de tempo real, e aí qualquer inclusão, alteração ou
exclusão — feita neste aparelho, em outro, ou por outra pessoa — aparece no
app aberto na hora, sem recarregar a página.

Sem rodar, o app continua funcionando: ele se atualiza sozinho toda vez que
você volta para a aba/janela. O que muda é a atualização ser imediata.

Para conferir se pegou, abra o console do navegador: com o canal no ar sai
`AGI · atualização automática ativa`.

## Passo 5 — Leitura de contrato por foto (opcional)

A função "📷 Ler contrato com IA" usa a API da Anthropic. Para funcionar no
navegador sem expor a chave, faça deploy da Edge Function:

```bash
supabase functions deploy ai-contrato
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

E aponte o `config.js`:

```js
aiProxy: "https://SEU-PROJETO.supabase.co/functions/v1/ai-contrato"
```

---

## Segurança

A política RLS incluída libera leitura/escrita para a chave **anônima** — ótimo
para colocar no ar rápido, mas significa que qualquer um com a URL do site pode
ver/editar os dados. Para uso real, ative o **Supabase Auth** e restrinja as
políticas em `schema.sql` para usuários autenticados.

## Estrutura

```
index.html                          App (front-end)
config.js                           Credenciais do Supabase (edite aqui)
supabase/setup.sql                  INSTALAÇÃO COMPLETA (rode este em banco novo)
supabase/schema.sql                 Cria as 4 tabelas e as políticas
supabase/seed.sql                   Carrega os 753 lançamentos iniciais
supabase/veiculos.sql               Carrega a frota (185 veículos)
supabase/boleto_feito.sql           Coluna boleto_feito nos lançamentos
supabase/realtime.sql               Publica lancamentos no Realtime (atualização automática)
supabase/README-import.md           Como a planilha vira SQL (o que foi tratado)
supabase/functions/ai-contrato/     Edge Function opcional (IA por foto)
.github/workflows/deploy.yml        Publicação automática no GitHub Pages
```
