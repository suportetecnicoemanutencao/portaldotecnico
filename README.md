# Portal do Técnico · Nebulize

Site estático no Netlify, autenticação e dados no Supabase, assistente Nebuleco em Edge Function.

```
portal-tecnico/
├── site/
│   ├── index.html          página única (login, portal, Nebuleco, usuários)
│   └── config.js           endereços do seu projeto Supabase
├── supabase/
│   ├── schema.sql          tabelas, RLS, gatilhos
│   └── functions/nebuleco/
│       ├── index.ts        Edge Function do assistente
│       └── conhecimento.ts base do Guia Técnico de Campo
├── netlify.toml            publicação e cabeçalhos de segurança
└── README.md
```

---

## 1. Supabase

### 1.1 Banco

No painel do Supabase, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e execute.

Isso cria as tabelas `tecnicos`, `recursos`, `acessos` e `nebuleco_log`, liga o RLS, cria o gatilho que registra cada novo cadastro como pendente e grava os dois links dos formulários.

### 1.2 Desligar a confirmação de e-mail

**Authentication > Sign In / Providers > Email**, desmarque *Confirm email*.

Quem libera o acesso é você, não o e-mail. Sem isso, o técnico precisaria clicar num link antes mesmo de chegar na fila de aprovação, o que trava quem errou o endereço ou usa e-mail de empresa com filtro.

O cadastro passa a funcionar assim: o técnico preenche, a conta nasce com status `pendente`, ele cai na tela de espera, e só entra depois que você aprovar na aba Usuários.

### 1.3 SMTP próprio

**Project Settings > Authentication > SMTP Settings**, ative *Enable Custom SMTP* e preencha com os dados do seu servidor. Em *Sender email* use um endereço do domínio (manutencao@nebulize.com.br, por exemplo).

Mesmo sem confirmação de cadastro, o SMTP continua necessário para a recuperação de senha. Sem ele, o Supabase limita a poucos e-mails por hora e o link de redefinição falha em silêncio.

### 1.4 URLs de retorno

**Authentication > URL Configuration**:

- Site URL: `https://portaldotecnico.nebulize.com.br`
- Redirect URLs: `https://portaldotecnico.nebulize.com.br/**`

Sem isso, o link de redefinição de senha não volta para o portal.

### 1.5 Edge Function

Pelo terminal, com a CLI do Supabase instalada:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF

supabase secrets set GEMINI_API_KEY=sua_chave_do_aistudio
supabase secrets set ORIGENS_PERMITIDAS=https://portaldotecnico.nebulize.com.br

supabase functions deploy nebuleco
```

A chave do Gemini fica só no servidor. O navegador nunca a recebe.

---

## 2. Site

Em `site/config.js`, preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `NEBULECO_URL`. Os dois primeiros estão em **Project Settings > API**.

A chave `anon` é pública por definição: quem protege os dados é o RLS. Pode ficar no repositório. **A chave `service_role` nunca entra aqui** — ela só vive nos secrets da Edge Function.

---

## 3. GitHub e Netlify

```bash
git init
git add .
git commit -m "Portal do Técnico com Supabase"
git remote add origin git@github.com:SUA-CONTA/portal-tecnico.git
git push -u origin main
```

No Netlify, no site que já serve portaldotecnico.nebulize.com.br: **Site configuration > Build & deploy > Link repository**, escolha o repositório e confirme. O `netlify.toml` já define a pasta `site` como publicação, então não há nada para configurar.

A partir daí, cada `git push` publica sozinho, e o histórico do GitHub permite voltar atrás se algo quebrar.

---

## 4. Sua conta de administrador

1. Abra o portal e use **Solicitar acesso** com seu e-mail.
2. No SQL Editor do Supabase, rode:

```sql
update public.tecnicos
   set perfil = 'admin', status = 'aprovado', aprovado_em = now()
 where email = 'seu.email@nebulize.com.br';
```

3. Volte ao portal e toque em **Verificar novamente**. A aba **Usuários** aparece para você.

Daí em diante tudo é pelo portal: o técnico se cadastra, você aprova na aba Usuários.

---

## Como a segurança funciona

**Os links não estão no HTML.** Ficam na tabela `recursos`, com a política `links para aprovados`. O banco só devolve as URLs se a sessão pertencer a um técnico com status `aprovado`. Abrir o código-fonte da página, deslogado, não revela nada.

**Senha** é responsabilidade do Supabase Auth: hash bcrypt, nunca legível por você nem por mim. Esquecimento se resolve pelo próprio técnico, com o link de redefinição.

**Aprovação é o único portão.** Sem confirmação de e-mail, qualquer pessoa consegue criar uma conta, mas ela nasce `pendente` e não enxerga nada: nem os links, nem o Nebuleco. Só a sua aprovação na aba Usuários libera o acesso. Vale conferir o celular e a empresa antes de aprovar.

**Sessão** é um JWT de hora em hora renovado, guardado pelo navegador e invalidado no logout.

**Aprovação** é obrigatória: contas nascem pendentes por gatilho no banco, não por regra da tela. Mesmo que alguém manipule o JavaScript da página, o banco recusa.

**Nebuleco** valida o token e confere a aprovação no servidor antes de responder, com limite de 40 perguntas por hora por técnico.

**Registro** de login, logout, abertura de formulário e mudança de status fica em `acessos`. As perguntas ficam em `nebuleco_log`.

---

## Manutenção

**Trocar um link de formulário:** tabela `recursos` no Supabase, coluna `url`. Vale na hora, sem publicar nada.

**Acrescentar um terceiro formulário:** insira uma linha em `recursos`. A página monta os botões a partir da tabela.

**Ampliar o Nebuleco:** edite `supabase/functions/nebuleco/conhecimento.ts` mantendo os títulos em `##` e rode `supabase functions deploy nebuleco`.

**Desligar um técnico:** aba Usuários, botão Bloquear. O acesso cai no próximo carregamento e os links param de ser entregues.

**Trocar o modelo de IA:** secret `MODELO_IA` na Edge Function. O padrão é `gemini-2.0-flash`.


---

## Aviso de aprovação

O portal não envia e-mail automático quando você aprova alguém. O técnico vê a liberação ao tocar em **Verificar novamente** na tela de espera, ou ao entrar de novo.

Na prática, o mais rápido é avisar pelo WhatsApp, já que o número está no cadastro. Se quiser o e-mail automático depois, dá para fazer com um gatilho no banco chamando uma segunda Edge Function.
