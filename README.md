# Excel Analyzer Starter

Starter zawiera:
- `backend`: NestJS + Supabase
- `frontend`: React 19 + Vite 7 + Tailwind + React Query + Radix UI
- `auth`: signup/login/logout przez Supabase Auth

## 1. Instalacja

W dwoch terminalach:

```powershell
cd c:\Praca\Kasia\backend
npm install
```

```powershell
cd c:\Praca\Kasia\frontend
npm install
```

## 2. Ustawienie Supabase (ENV)

### Backend

Utworz plik:
- `backend/.env`

Uzupelnij:
- `SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY`

Cloudinary (hardcoded) jest w:
- `backend/src/cloudinary/cloudinary.service.ts`

### Frontend

Utworz plik:
- `frontend/.env`

Uzupelnij:
- `VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co` (ten sam co w backendzie)
- `VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY`

## 3. Uruchomienie

Terminal 1:

```powershell
cd c:\Praca\Kasia
npm run dev:backend
```

Terminal 2:

```powershell
cd c:\Praca\Kasia
npm run dev:frontend
```

Frontend:
- `http://localhost:5173`
- `http://localhost:5173/dashboard`
- `http://localhost:5173/analytics`
- `http://localhost:5173/orders`
- `http://localhost:5173/settings`
- `http://localhost:5173/integrations`

Backend:
- `http://localhost:4000/api/health`
- `http://localhost:4000/api/excel/ping`
- `http://localhost:4000/api/auth/me` (wymaga `Authorization: Bearer <access_token>`)
- `http://localhost:4000/api/excel/analyze-demo` (wymaga `Authorization: Bearer <access_token>`)
- `http://localhost:4000/api/excel/upload` (POST multipart/form-data, pole `file`, wymaga `Authorization: Bearer <access_token>`, zapis do Supabase Storage)
- `http://localhost:4000/api/users/avatar` (POST multipart/form-data, pole `file`, wymaga `Authorization: Bearer <access_token>`)
- `http://localhost:4000/api/users/accounts` (GET, lista kont, wymaga `Authorization: Bearer <access_token>`)
- `http://localhost:4000/api/users/profile` (PATCH JSON `{ "name"?: string, "position"?: string }`, wymaga `Authorization: Bearer <access_token>`)

## 4. Opcjonalna tabela demo

Endpoint `POST /api/excel/analyze-demo` probuje zapisac dane do tabeli `excel_analysis_jobs`.
Jesli chcesz pelny demo-save, utworz tabele:

```sql
create table if not exists public.excel_analysis_jobs (
  id bigint generated always as identity primary key,
  file_name text not null,
  row_count integer not null,
  created_at timestamptz not null default now()
);
```
