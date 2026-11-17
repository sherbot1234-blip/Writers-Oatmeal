# Setting up cloud sync

This takes about 10 minutes, and you only do it once. After that your stories sync to every device you sign in on.

You'll use **Supabase**, a free online database. The free plan is plenty for one writer: 500 MB of stories and 1 GB of images.

## 1. Create your Supabase project

1. Go to **https://supabase.com** and click **Start your project**. Sign up (signing in with GitHub is easiest).
2. Click **New project**.
   - **Name:** `writers-oatmeal`
   - **Database password:** click **Generate a password**. You won't need it again, but save it in your password manager anyway.
   - **Region:** pick the one closest to you.
3. Click **Create new project** and wait a minute or two while it sets up.

## 2. Create the storage

1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open [`supabase/setup.sql`](../supabase/setup.sql) from this repo, copy **all** of it, and paste it in.
4. Click **Run**. You should see "Success. No rows returned".

## 3. Create your login (and lock the door)

1. In the left sidebar, click **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a password you'll remember. Tick **Auto Confirm User**. Click **Create user**.
3. Then go to **Authentication** → **Sign In / Providers** (sometimes called **Settings**) and turn **off** "Allow new users to sign up".
   This way nobody else can make an account in your project.

## 4. Connect the website

> ✅ **Done:** this project's address and publishable key are already built into the site (`src/config.ts`). Just sign in.


1. In the left sidebar, click **Project Settings** (the cog) → **API Keys** (or **Data API**).
2. Copy two things:
   - **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - **Publishable key**, which starts with `sb_publishable_`. Older projects call it the **anon public** key and it starts with `eyJ`.

   ⚠️ Do **not** use the **secret** / `service_role` key. That one must stay secret.
3. Then pick **one** of these:
   - **Easiest:** send the Project URL and publishable key to Claude, who will build them into the site. Then you only ever need to sign in. (The publishable key is designed to be public. Your stories are protected by your login and the rules from step 2.)
   - **Or do it yourself:** on the website, click **☁️ Not signed in / Only on this device**, paste both values, and click **Connect**. You'd do this once on each device.
4. Sign in with the email and password from step 3.

That's it. The ☁️ button shows **Synced** when everything is up to date.

## How syncing behaves

- Changes upload a few seconds after you stop typing, every minute, and whenever you come back to the tab.
- It works offline. Changes sync when you're back online.
- If you edit the **same story** on two devices before they sync, you'll get a "(conflict copy)" of one version. Nothing is lost. Copy over what you need and delete the copy.
- **Back up all** on the library page still downloads a complete backup file. It's worth doing now and then.
