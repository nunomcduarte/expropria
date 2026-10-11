-- Expropria PCP: esquema Supabase (Postgres)
-- Correr no SQL Editor do Supabase. Login/registo usa o Supabase Auth (auth.users).

-- ---------- Tipos ----------
create type tipo_imovel as enum (
  'sede', 'centro_trabalho', 'edificio', 'terreno', 'quinta', 'loja', 'armazem', 'outro'
);
create type estado_moderacao as enum ('pendente', 'aprovado', 'rejeitado');
create type tipo_fonte as enum (
  'contas_partido',      -- relatório de contas na Entidade das Contas
  'registo_predial',     -- certidão permanente / caderneta
  'noticia',             -- artigo de imprensa
  'site_partido',        -- morada publicada pelo próprio partido
  'outro'
);

-- ---------- Perfis ----------
create table perfis (
  id uuid primary key references auth.users on delete cascade,
  nome_publico text not null check (char_length(nome_publico) between 2 and 40),
  moderador boolean not null default false,
  criado_em timestamptz not null default now()
);

-- cria perfil automaticamente no registo
create function criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome_publico)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome_publico', 'camarada_' || left(new.id::text, 6)));
  return new;
end $$;
create trigger ao_registar after insert on auth.users
  for each row execute function criar_perfil();

create function e_moderador() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select moderador from perfis where id = auth.uid()), false)
$$;

-- ---------- Imóveis ----------
create table imoveis (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique, -- "Ficha nº 0012"
  titulo text not null check (char_length(titulo) between 3 and 120),
  tipo tipo_imovel not null,
  descricao text check (char_length(descricao) <= 2000),
  entidade_proprietaria text not null default 'PCP',  -- PCP ou entidade do partido
  distrito text not null,
  concelho text not null,
  morada text,
  lat double precision not null check (lat between 32 and 42.2),   -- Continente, Açores e Madeira
  lng double precision not null check (lng between -31.5 and -6.1),
  fonte_tipo tipo_fonte not null,
  fonte_url text,
  fonte_nota text not null check (char_length(fonte_nota) >= 10), -- como se sabe que é do partido
  estado estado_moderacao not null default 'aprovado', -- publica logo; 'rejeitado' = removido
  motivo_rejeicao text,
  criado_por uuid not null default auth.uid() references perfis on delete set null,
  criado_em timestamptz not null default now(),
  moderado_por uuid references perfis,
  moderado_em timestamptz
);
create index on imoveis (estado);
create index on imoveis (distrito);

-- ---------- Fotos ----------
create table fotos (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references imoveis on delete cascade,
  caminho text not null unique,          -- caminho no bucket 'fotos'
  legenda text check (char_length(legenda) <= 200),
  tirada_da_via_publica boolean not null check (tirada_da_via_publica), -- obrigatório confirmar
  estado estado_moderacao not null default 'aprovado',
  enviada_por uuid not null default auth.uid() references perfis on delete set null,
  criada_em timestamptz not null default now()
);

-- ---------- Denúncias / pedidos de remoção ----------
create table denuncias (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid references imoveis on delete cascade,
  foto_id uuid references fotos on delete cascade,
  motivo text not null check (motivo in ('nao_e_do_partido','dados_pessoais','foto_inadequada','duplicado','outro')),
  detalhe text check (char_length(detalhe) <= 1000),
  contacto text,                          -- opcional, para pedidos de remoção sem conta
  resolvida boolean not null default false,
  criada_em timestamptz not null default now(),
  check (imovel_id is not null or foto_id is not null)
);

-- ---------- Segurança (RLS) ----------
alter table perfis    enable row level security;
alter table imoveis   enable row level security;
alter table fotos     enable row level security;
alter table denuncias enable row level security;

-- perfis: nomes públicos visíveis; cada um edita o seu, sem se promover a moderador
create policy "perfis visiveis" on perfis for select using (true);
create policy "editar proprio perfil" on perfis for update
  using (id = auth.uid())
  with check (id = auth.uid() and moderador = (select moderador from perfis p where p.id = auth.uid()));

-- imóveis: publicados de imediato; público vê os não removidos; autor vê os seus; moderador vê tudo
create policy "ver imoveis" on imoveis for select
  using (estado = 'aprovado' or criado_por = auth.uid() or e_moderador());
create policy "submeter imovel" on imoveis for insert to authenticated
  with check (criado_por = auth.uid() and estado = 'aprovado');
create policy "moderar imovel" on imoveis for update using (e_moderador());
create policy "apagar imovel" on imoveis for delete using (e_moderador());

-- fotos: mesma lógica; só se pode juntar foto a imóvel visível
create policy "ver fotos" on fotos for select
  using (estado = 'aprovado' or enviada_por = auth.uid() or e_moderador());
create policy "enviar foto" on fotos for insert to authenticated
  with check (enviada_por = auth.uid() and estado = 'aprovado'
              and exists (select 1 from imoveis i where i.id = imovel_id));
create policy "moderar foto" on fotos for update using (e_moderador());
create policy "apagar foto" on fotos for delete using (e_moderador());

-- denúncias: qualquer pessoa (mesmo sem conta) pode denunciar; só moderadores leem
create policy "denunciar" on denuncias for insert with check (resolvida = false);
create policy "ler denuncias" on denuncias for select using (e_moderador());
create policy "resolver denuncias" on denuncias for update using (e_moderador());

-- ---------- Storage: bucket 'fotos' ----------
-- Bucket privado; o site mostra fotos aprovadas por URL assinado ou via função.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg','image/png','image/webp']);

create policy "upload na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ler fotos aprovadas" on storage.objects for select
  using (bucket_id = 'fotos' and (
    e_moderador()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from fotos f where f.caminho = name and f.estado = 'aprovado')
  ));
create policy "moderador apaga fotos" on storage.objects for delete
  using (bucket_id = 'fotos' and e_moderador());
