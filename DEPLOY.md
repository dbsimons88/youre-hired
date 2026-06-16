# You're Hired. — Netlify Deployment Guide

This guide gets your app live on a real URL you can share with beta testers. Total time: ~20 minutes.

---

## What you'll need

- A free [GitHub](https://github.com) account
- A free [Netlify](https://netlify.com) account
- Your Anthropic API key (from [console.anthropic.com](https://console.anthropic.com))
- Your ElevenLabs API key (from [elevenlabs.io](https://elevenlabs.io) → Profile → API Keys)

---

## Step 1 — Put the project on GitHub

1. Go to [github.com](https://github.com) and sign in (or create an account — it's free).

2. Click the **+** button in the top-right corner → **New repository**.

3. Name it something like `youre-hired` and leave everything else at the default. Click **Create repository**.

4. GitHub will show you a page with setup instructions. **Ignore those** — we'll use their web uploader instead.

5. On that same page, click the link that says **"uploading an existing file"** (it's in small text near the top).

6. Open Finder and navigate to your `Mock Interviews` folder (the one with `interview-coach.html` in it).

7. Drag the **entire contents** of the Mock Interviews folder into the GitHub upload area. You should see these files and folders upload:
   - `interview-coach.html`
   - `netlify.toml`
   - `netlify/` (folder containing `functions/claude.js` and `functions/elevenlabs.js`)

8. Scroll down, leave the commit message as-is, and click **Commit changes**.

Your code is now on GitHub. ✓

---

## Step 2 — Connect to Netlify

1. Go to [netlify.com](https://netlify.com) and sign up (or sign in). **Use "Sign up with GitHub"** — this makes the connection automatic.

2. Once you're in the Netlify dashboard, click **Add new site** → **Import an existing project**.

3. Click **GitHub**, authorize Netlify to access your repositories, then select `youre-hired` from the list.

4. Netlify will detect your settings automatically from `netlify.toml`. You don't need to change anything. Click **Deploy site**.

5. Netlify will build and deploy. This takes about 60 seconds. You'll see a progress bar.

6. When it finishes, Netlify gives you a URL like `https://amazing-name-123456.netlify.app`. This is your live app — but the API keys aren't set yet, so it won't work quite yet.

---

## Step 3 — Add your API keys (the secure part)

This is where your keys live — on Netlify's servers, never in your code.

1. In your Netlify dashboard, go to **Site configuration** (left sidebar) → **Environment variables**.

2. Click **Add a variable** and add these two, one at a time:

   | Key | Value |
   |-----|-------|
   | `ANTHROPIC_API_KEY` | Your Anthropic API key (starts with `sk-ant-`) |
   | `ELEVENLABS_API_KEY` | Your ElevenLabs API key |

3. After adding both, go to **Deploys** (top navigation) → click **Trigger deploy** → **Deploy site**.

   This redeploy picks up your new environment variables. It takes about 30 seconds.

---

## Step 4 — Test it

1. Visit your Netlify URL (e.g. `https://amazing-name-123456.netlify.app`).

2. Create an account on the app (just a username + password you'll share with testers — stored locally on their browser).

3. Start a Quick Warmup to verify voice is working.

4. Try a full interview to confirm the coaching report generates.

If something isn't working, go to **Netlify dashboard → Functions** tab — you can see logs from the `claude` and `elevenlabs` serverless functions which will show any errors.

---

## Step 5 — Share with beta testers

Send testers your Netlify URL and these quick instructions:

> "Open this in **Chrome or Edge** (not Safari or Firefox — the mic feature requires Chrome/Edge). Create an account with any username and password you want — it's just stored on your device. No email required."

---

## Giving the app a better URL (optional)

The default URL (`amazing-name-123456.netlify.app`) isn't very shareable. Two options:

**Option A — Custom Netlify subdomain (free, 2 minutes):**
In Netlify dashboard → **Domain management** → **Options** next to the auto-generated name → **Edit site name**. Change it to something like `youre-hired-app`. Your URL becomes `youre-hired-app.netlify.app`.

**Option B — Buy a domain (~$12/year):**
Buy `yourehiredapp.com` or similar from [Namecheap](https://namecheap.com), then add it in Netlify's Domain management. Netlify handles the SSL certificate automatically.

---

## Updating the app later

Whenever you want to push changes:

1. Go to your GitHub repo → click on the file you want to update → click the pencil icon (Edit) → paste the new version → **Commit changes**.

2. Netlify detects the GitHub change and automatically redeploys. Takes ~60 seconds.

Or, if you want to re-upload a whole new version of `interview-coach.html`:
1. Go to your GitHub repo → click `interview-coach.html` → click the pencil icon → select all text → paste the new file → **Commit changes**.

---

## Troubleshooting

**"API error" or blank coaching report:** Check Netlify → Functions → claude → logs. Likely cause: `ANTHROPIC_API_KEY` environment variable wasn't saved, or you forgot to redeploy after adding it.

**No interviewer voice:** Check Netlify → Functions → elevenlabs → logs. Likely cause: `ELEVENLABS_API_KEY` typo or missing redeploy.

**Mic not working:** Tester is using Safari or Firefox. Chrome or Edge only.

**App loads but feels broken:** Open browser DevTools (F12) → Console tab. Share any red errors with Dan.
