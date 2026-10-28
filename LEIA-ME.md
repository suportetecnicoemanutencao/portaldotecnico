# 2 · GitHub

Esta pasta **já é o repositório pronto**. Não reorganize nada: a estrutura importa.

```
site/
├── index.html      a página do portal
└── config.js       endereços do seu Supabase  ← PREENCHER ANTES
supabase/           cópia dos arquivos do Supabase, para versionar
netlify.toml        diz ao Netlify para publicar a pasta site
README.md           documentação completa do projeto
.gitignore
```

---

## Antes de subir: preencher o config.js

Abra `site/config.js` e troque os três valores do topo.

Os dois primeiros estão no Supabase, em **Project Settings > API**:

- `SUPABASE_URL` → o campo *Project URL*
- `SUPABASE_ANON_KEY` → a chave *anon public*
- `NEBULECO_URL` → é a URL do projeto + `/functions/v1/nebuleco`

A chave `anon` é pública por definição. Quem protege os dados é o RLS do banco, não o sigilo dela, então pode ficar no repositório sem problema.

**A chave `service_role` nunca entra aqui.** Ela só vive nos secrets da Edge Function. Se ela aparecer no `config.js`, qualquer visitante ganha acesso total ao seu banco.

---

## Subindo pela primeira vez

```bash
cd caminho/para/esta/pasta
git init
git add .
git commit -m "Portal do Técnico"
git branch -M main
git remote add origin git@github.com:SUA-CONTA/portal-tecnico.git
git push -u origin main
```

Se preferir sem terminal: crie o repositório no site do GitHub e arraste os arquivos pela opção **Add file > Upload files**. Arraste as pastas inteiras, para a estrutura se manter.

---

## Atualizando depois

```bash
git add .
git commit -m "o que mudou"
git push
```

O Netlify publica sozinho em um ou dois minutos.

Se preferir pelo site do GitHub: abra o arquivo, clique no lápis, edite e salve. Dá no mesmo.

---

## Qual arquivo mexer para cada coisa

| Quero mudar | Arquivo |
|---|---|
| Textos, telas, botões do portal | `site/index.html` |
| Endereços do Supabase | `site/config.js` |
| Comportamento do Nebuleco | `supabase/functions/nebuleco/conhecimento.ts` * |
| Cabeçalhos de segurança | `netlify.toml` |

\* esse não basta dar push: precisa rodar `supabase functions deploy nebuleco` no terminal. O GitHub só guarda a cópia.
