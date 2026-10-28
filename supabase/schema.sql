-- ════════════════════════════════════════════════════════════════
-- NEBULIZE · PORTAL DO TÉCNICO
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
-- ════════════════════════════════════════════════════════════════

-- ─────────────── Tabela de técnicos ───────────────

create table if not exists public.tecnicos (
  id            uuid primary key references auth.users on delete cascade,
  nome          text not null,
  email         text not null,
  celular       text,
  empresa       text,
  status        text not null default 'pendente'
                check (status in ('pendente','aprovado','bloqueado')),
  perfil        text not null default 'tecnico'
                check (perfil in ('tecnico','admin')),
  criado_em     timestamptz not null default now(),
  aprovado_em   timestamptz,
  ultimo_acesso timestamptz
);

-- ─────────────── Recursos protegidos (os links) ───────────────

create table if not exists public.recursos (
  chave     text primary key,
  titulo    text not null,
  descricao text,
  url       text not null,
  ordem     int not null default 0,
  ativo     boolean not null default true
);

insert into public.recursos (chave, titulo, descricao, url, ordem) values
  ('nota',  'Nota de serviço',  'Registro do atendimento concluído, com anexo da nota',
   'https://script.google.com/macros/s/AKfycbzO1MO3EIcWWFiAyOaDM7R6FxlWmkqiluT0rrUbms5uALFPs3BW-aupCMl8-w5DMcLS/exec', 1),
  ('pecas', 'Pedido de peças',  'Solicitação de peças e componentes para reposição',
   'https://script.google.com/macros/s/AKfycbxgDmgdha1l96JWE6SNbeAtMEHN86ckUAzNN7LsQghrA3eO_5JTuOCVvIKKLOwFYh648g/exec', 2)
on conflict (chave) do update
  set titulo = excluded.titulo, descricao = excluded.descricao, url = excluded.url;

-- ─────────────── Registros ───────────────

create table if not exists public.acessos (
  id        bigserial primary key,
  tecnico   uuid references public.tecnicos(id) on delete set null,
  email     text,
  acao      text not null,
  detalhe   text,
  criado_em timestamptz not null default now()
);

create table if not exists public.nebuleco_log (
  id        bigserial primary key,
  tecnico   uuid references public.tecnicos(id) on delete set null,
  pergunta  text not null,
  resposta  text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_acessos_data  on public.acessos (criado_em desc);
create index if not exists idx_nebuleco_data on public.nebuleco_log (criado_em desc);

-- ─────────────── Funções auxiliares ───────────────

-- security definer evita recursão infinita nas políticas de RLS
create or replace function public.eh_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.tecnicos
    where id = auth.uid() and perfil = 'admin' and status = 'aprovado'
  );
$$;

create or replace function public.eh_aprovado()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.tecnicos
    where id = auth.uid() and status = 'aprovado'
  );
$$;

-- Cria o registro do técnico assim que a conta nasce, sempre como pendente.
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tecnicos (id, nome, email, celular, empresa)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', 'Sem nome'),
    new.email,
    nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'celular',''), '\D', '', 'g'), ''),
    nullif(new.raw_user_meta_data->>'empresa', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_novo_usuario on auth.users;
create trigger trg_novo_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Marca o último acesso. Chamada pelo portal após o login.
create or replace function public.marcar_acesso()
returns void language sql security definer set search_path = public as $$
  update public.tecnicos set ultimo_acesso = now() where id = auth.uid();
$$;

-- ─────────────── RLS ───────────────

alter table public.tecnicos     enable row level security;
alter table public.recursos     enable row level security;
alter table public.acessos      enable row level security;
alter table public.nebuleco_log enable row level security;

-- técnicos: cada um vê o próprio registro; admin vê e edita todos
drop policy if exists "proprio registro" on public.tecnicos;
create policy "proprio registro" on public.tecnicos
  for select to authenticated using (id = auth.uid() or public.eh_admin());

drop policy if exists "admin edita" on public.tecnicos;
create policy "admin edita" on public.tecnicos
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- recursos: só quem está aprovado enxerga os links
drop policy if exists "links para aprovados" on public.recursos;
create policy "links para aprovados" on public.recursos
  for select to authenticated using (ativo and public.eh_aprovado());

-- acessos: o técnico registra o próprio; o admin lê tudo
drop policy if exists "registra proprio acesso" on public.acessos;
create policy "registra proprio acesso" on public.acessos
  for insert to authenticated with check (tecnico = auth.uid());

drop policy if exists "admin le acessos" on public.acessos;
create policy "admin le acessos" on public.acessos
  for select to authenticated using (public.eh_admin());

-- nebuleco: só o admin lê; a gravação é feita pela Edge Function
drop policy if exists "admin le nebuleco" on public.nebuleco_log;
create policy "admin le nebuleco" on public.nebuleco_log
  for select to authenticated using (public.eh_admin());

-- ════════════════════════════════════════════════════════════════
-- DEPOIS de criar sua conta pelo portal, rode a linha abaixo
-- trocando o e-mail, para virar administrador aprovado:
--
--   update public.tecnicos
--      set perfil = 'admin', status = 'aprovado', aprovado_em = now()
--    where email = 'seu.email@nebulize.com.br';
-- ════════════════════════════════════════════════════════════════
