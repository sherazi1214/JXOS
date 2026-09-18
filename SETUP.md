# Database Connect Karne Ka Tareeqa (Setup Guide)

Good news: frontend already `/api/...` routes ko call kar raha hai, aur wo
routes already Supabase (Postgres) se data uthate/save karte hain
(`src/lib/db.ts`). Koi mock/dummy data code mein nahi hai. Bas asal DB
credentials missing thay — ye guide wahi fill karwati hai.

## 1. Supabase project banayein
1. https://supabase.com par free account banayein.
2. "New project" -> naam do (e.g. `jasonex-os`) -> region select karein -> create.
3. Project ready hone ke baad: **Project Settings -> API** par jayein. Yahan se
   3 cheezein copy karein:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY` (secret, kabhi frontend
     mein use na karein)

## 2. .env.local banayein
Root folder mein `.env.example` ko copy karke `.env.local` naam dein, aur
values fill karein:

```bash
cp .env.example .env.local
```

`JWT_SECRET` ke liye koi bhi lamba random string daal dein, e.g.:

```bash
openssl rand -hex 32
```

## 3. Schema + migrations run karein
Supabase dashboard -> **SQL Editor** -> "New query". In order se run karein:

1. `db/schema.sql` (poora content paste karke Run karein — tables, roles,
   permissions sab bana dega)
2. `db/migrations/` folder ke sab files, filename ke number ke hisaab se
   (0001, 0002, 0003 ... 0012) — ye extra permissions seed karti hain.

(Chahen to Supabase CLI se bhi run kar sakte hain agar wo installed hai.)

## 4. Dependencies install karein
```bash
npm install
```

## 5. Pehla Admin (login) user banayein
Schema sirf **roles** seed karta hai, users nahi — is liye login ke liye
pehla user khud banana hoga:

```bash
npm run seed:admin -- "Aapka Naam" admin@example.com "StrongPassword123"
```

Ye "CEO/Admin" role ke sath ek user bana dega jis se aap app mein login kar
sakte hain.

## 6. App run karein
```bash
npm run dev
```

Browser mein `http://localhost:3000` kholein, login page par wahi email +
password daal kar login karein jo step 5 mein banaya tha.

## Notes
- `typecheck` (`npm run typecheck`) is codebase par already clean run ho raha
  hai — koi type error nahi.
- Production/deploy karte waqt yehi env variables (Vercel/host ki settings
  mein) set karna hoga — `.env.local` deploy nahi hoti.
- `ANTHROPIC_API_KEY` sirf tab chahiye agar AI Assistant module use karna ho.
