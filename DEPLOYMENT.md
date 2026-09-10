# BreachGuard — 100% Free Deployment Guide (No Credit Card Required)

Render now requires a credit card to verify identity on sign-up. To keep your deployment **100% free with ZERO credit card required**, use this updated setup:

| Layer | Platform | Cost | Credit Card Needed? |
| :--- | :--- | :--- | :--- |
| **Database** | [Supabase](https://supabase.com) | Free Tier | **NO** (Already Connected & Seeded) |
| **Backend API** | [Hugging Face Spaces](https://huggingface.co/new-space) or [Back4App](https://back4app.com) | Free Tier | **NO** |
| **Frontend UI** | [Vercel](https://vercel.com) | Free Tier | **NO** |

---

## Status Check: What Is Already Done

1. **GitHub Repository**: Pushed and up-to-date at [https://github.com/KhubaibAhmed0/breachguard](https://github.com/KhubaibAhmed0/breachguard)
2. **Supabase Database**: Provisioned, verified, all tables created, and initial admin account seeded (`admin@acme.com` / `password123`)
   * Connection String:
     ```text
     postgresql+asyncpg://postgres:Khubaib%402011@db.eqcpazrhhplewwzjnxod.supabase.co:5432/postgres
     ```

---

## 🚀 Recommended: Deploy Both Backend and Frontend on Vercel (100% Free, Zero Card)

Vercel provides native Python serverless support for FastAPI and native Next.js hosting. You do not need any credit card, and you can deploy both in under 3 minutes directly from your GitHub repository (`KhubaibAhmed0/breachguard`).

### Part 1: Deploy Backend API to Vercel (1 Minute)

1. Go to **[vercel.com/new](https://vercel.com/new)** and sign in with GitHub (`KhubaibAhmed0`).
2. Click **Import** next to **`KhubaibAhmed0/breachguard`**.
3. In the configuration:
   * **Project Name**: `breachguard-backend`
   * **Root Directory**: Click **Edit** &rarr; select **`backend`** &rarr; click **Continue**.
4. Expand **Environment Variables** and add:
   * `DATABASE_URL`: `postgresql+asyncpg://postgres:Khubaib%402011@db.eqcpazrhhplewwzjnxod.supabase.co:5432/postgres`
   * `SECRET_KEY`: `breachguard_super_secret_key_2026`
5. Click **Deploy**.
6. Copy your live backend URL (e.g. `https://breachguard-backend.vercel.app`). Test it by opening:
   `https://breachguard-backend.vercel.app/docs`

---

### Part 2: Deploy Frontend UI to Vercel (1 Minute)

1. Return to **[vercel.com/new](https://vercel.com/new)**.
2. Click **Import** next to **`KhubaibAhmed0/breachguard`** again.
3. In the configuration:
   * **Project Name**: `breachguard`
   * **Root Directory**: Click **Edit** &rarr; select **`frontend`** &rarr; click **Continue**.
4. Expand **Environment Variables** and add:
   * **Key**: `NEXT_PUBLIC_API_URL`
   * **Value**: Your live backend URL from Part 1 with `/api` appended (e.g. `https://breachguard-backend.vercel.app/api`)
5. Click **Deploy**.
6. Your live production web app is ready!
---

### Option B: Back4App Containers (Alternative — 2 Minutes)

1. Go to **[back4app.com](https://www.back4app.com/)** and click **Sign Up with GitHub** (**no credit card required**).
2. Click **Build a new app** &rarr; choose **Containers as a Service**.
3. Select your repository: **`KhubaibAhmed0/breachguard`**.
4. Configure container settings:
   - **App Name**: `breachguard-api`
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `./Dockerfile`
   - **Environment Variables**:
     - `DATABASE_URL`: `postgresql+asyncpg://postgres:Khubaib%402011@db.eqcpazrhhplewwzjnxod.supabase.co:5432/postgres`
     - `SECRET_KEY`: `breachguard_super_secret_key_2026`
5. Click **Create App**. Once finished, Back4App generates your public HTTPS URL (e.g. `https://breachguard-api.b4a.run`).

---

## Step 2: Deploy Frontend to Vercel (100% Free, No Credit Card)

1. Go to **[vercel.com/signup](https://vercel.com/signup)** and click **Continue with GitHub** (**zero credit card required**).
2. Once signed in, go to **[vercel.com/new](https://vercel.com/new)**.
3. Find **`KhubaibAhmed0/breachguard`** and click **Import**.
4. In the Project Configuration:
   - **Framework Preset**: `Next.js` (automatically detected)
   - **Root Directory**: Click **Edit** &rarr; select **`frontend`** &rarr; click **Continue**.
5. Expand **Environment Variables**:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: Your live backend URL from Step 1 (e.g. `https://<YOUR-HF-USERNAME>-breachguard-api.hf.space/api` or `https://breachguard-api.b4a.run/api`)
6. Click **Deploy**.
7. In ~60 seconds, Vercel gives you your production website URL (e.g. `https://breachguard.vercel.app`).

---

## Step 3: Log In & Verify

1. Open your live Vercel URL in your browser.
2. Click **Sign In** and enter the credentials seeded in your Supabase database:
   - **Email**: `admin@acme.com`
   - **Password**: `password123`
3. You will immediately access the enterprise dark-web dashboard, live breach streams, privileged identity quotas, 7-day trial banner, and MSP tenant console.
