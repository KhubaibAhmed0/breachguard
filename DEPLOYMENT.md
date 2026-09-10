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

## Step 1: Deploy Backend (Zero Credit Card)

You can choose either **Hugging Face Spaces** (recommended: 16 GB RAM, 2 vCPU) or **Back4App Containers**.

### Option A: Hugging Face Spaces (Recommended — 2 Minutes)

Hugging Face Spaces is completely free, does not ask for a card, and gives 16GB of RAM.

1. Go to **[huggingface.co/join](https://huggingface.co/join)** and create a free account (Sign up with GitHub or email — **zero credit card required**).
2. Go to **[huggingface.co/new-space](https://huggingface.co/new-space)**.
3. Configure your Space:
   - **Space name**: `breachguard-api`
   - **License**: `mit`
   - **Select the Space SDK**: Choose **Docker** &rarr; **Blank**
   - **Space hardware**: `CPU basic (2 vCPU, 16GB RAM) - Free`
   - **Space visibility**: `Public`
   - Click **Create Space**.
4. Set your Environment Variables:
   - Go to your Space **Settings** (tab at the top) &rarr; scroll to **Variables and secrets**.
   - Under **Secrets**, click **New secret**:
     - **Name**: `DATABASE_URL`
     - **Value**: `postgresql+asyncpg://postgres:Khubaib%402011@db.eqcpazrhhplewwzjnxod.supabase.co:5432/postgres`
     - Click **Save**.
   - Click **New secret** again:
     - **Name**: `SECRET_KEY`
     - **Value**: `breachguard_super_secret_key_2026`
     - Click **Save**.
5. Connect your repository or push your backend:
   - In your Space, click the **...** menu (top right) &rarr; **Settings** &rarr; scroll to **Connect a GitHub repository**, or simply push to the Space's Git URL.
   - Alternatively, you can copy the HF Space clone URL shown on the Space page and run:
     ```bash
     git remote add hf https://huggingface.co/spaces/<YOUR-HF-USERNAME>/breachguard-api
     git push hf main
     ```
6. Hugging Face will build the Docker container and start your API.
   - Your live backend URL will be:
     `https://<YOUR-HF-USERNAME>-breachguard-api.hf.space`
   - Test it by visiting:
     `https://<YOUR-HF-USERNAME>-breachguard-api.hf.space/docs`

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
