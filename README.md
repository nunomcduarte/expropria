# Expropria PCP

Mapa colaborativo (Next.js + Supabase + Leaflet/OpenStreetMap).

## Pôr a funcionar

1. Cria um projeto gratuito em https://supabase.com.
2. No Supabase, abre **SQL Editor**, cola o conteúdo de `supabase/schema.sql` e corre.
3. Em **Project Settings > API**, copia o URL e a chave `anon`. Copia `.env.example` para `.env.local` e preenche.
4. Instala e arranca:
   ```bash
   npm install
   npm run dev      # http://localhost:3000
   ```
5. Regista-te no site e torna-te administrador no SQL Editor:
   ```sql
   update perfis set moderador = true
   where id = (select id from auth.users where email = 'o-teu@email.pt');
   ```
   Como administrador vês o botão **Remover** em imóveis e fotos e a página **/admin** com as denúncias.

## Estrutura

- `app/page.tsx`: mapa, filtros, botão de adicionar.
- `app/admin/page.tsx`: denúncias por resolver.
- `components/`: mapa, login, formulário, ficha do imóvel, envio de fotos.
- `lib/fotos.ts`: limpa metadados (GPS incluído) das fotos antes do envio.
- `supabase/schema.sql`: tabelas e regras de segurança.
