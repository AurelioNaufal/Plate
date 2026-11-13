# Plate — one-time setup

These steps connect Plate to your Google account. You do them once (step 11 once more when you go live). Everything is created **in your own Google Drive**; nobody else can see it unless you share it.

Run the commands in a terminal opened in the Plate project folder.

## Part A — the backend (Google side)

1. **Turn on the Apps Script API.** Open https://script.google.com/home/usersettings and switch **Google Apps Script API** to **On**.
   *You should see:* the switch turns blue.

2. **Sign in clasp** (the tool that uploads the script): run
   `npx clasp login`
   A browser tab opens. Choose your personal Gmail account and click **Allow**.
   *You should see:* "You are logged in as …" in the terminal.

3. **Create the script project:** run
   `npx clasp create --type standalone --title "Plate API" --rootDir gas`
   *You should see:* "Created new standalone script" and a link. A file `.clasp.json` appears in this folder (it is git-ignored).

4. **Upload the code:** run
   `npm run push:gas`
   *You should see:* "Pushed 3 files."

5. **Open the script editor:** run `npx clasp open-script` (or open the link from step 3).

6. **Create the two Sheets.** In the editor, pick **createSheets** in the function dropdown at the top and click **Run**.
   Google asks for permission the first time: **Review permissions → your account → Advanced → Go to Plate API (unsafe) → Allow**. ("Unsafe" only means Google hasn't reviewed your own private script.)
   *You should see:* in the Execution log, two links: **Plate TEST** and **Plate**. Both are now in your Google Drive.

7. **Build the TEST Sheet's tabs.** Run **setup**.
   *You should see:* "Set up Plate TEST". Open Plate TEST: it has Summary, ByMonth, Transactions, Categories (16 rows), Meals, SavedFoods, QuickAdd, Recurring, Budgets, Exercises, Routines, Workouts, Body, Settings.

8. **Make your secret token.** Run **generateToken** and copy the long code from the log. Keep it private — anyone with it and the URL from step 9 could edit your data.

9. **Publish the API.** Click **Deploy → New deployment → ⚙ → Web app**. Description "Plate API", **Execute as: Me**, **Who has access: Anyone**. Click **Deploy**, then copy the **Web app URL** (ends in `/exec`).
   *You should see:* opening that URL in a browser shows `{"ok":true,"data":"Plate API"}`.

10. **Connect the app.** In Plate, open **Body → Settings**, paste the Web app URL and the token, tap **Test connection**.
    *You should see:* a ✓.

11. **Go live (later, when testing is done).** In the script editor run **useRealSheet**, then **runMigration** (it copies your old history in), then open the **MigrationReport** tab in Plate to check the totals. The app needs no change — same URL, same token.
    - Fix any flagged rows in the old Sheet and re-run **runMigration** *before* you start editing imported entries in the app. A re-run replaces every row still marked "migrated": entries you edited in the app are safe (they become "app" rows), but imported rows you deleted come back, and category renames on untouched imported rows are undone.

**Typing into the Sheet by hand** is fine. Write dates as `2026-11-12` so the Sheet's Summary counts them in the right month (the app understands `11/12/2026` too, but the Summary formulas don't).

## Part B — put the app online (GitHub Pages, free)

You need a free GitHub account (github.com/signup).

0. **First, make your old Monthly Budget Sheet private.** It is currently readable by anyone with its link, and its link is written in this project's docs and code. In Google Sheets: **Share → General access → Restricted**. Plate's migration runs as you, so it does not need link sharing. (The new Plate Sheets are private from the start.)
1. Create a new **empty** repository on GitHub, for example `plate`. Public works with free GitHub Pages: the code holds no token or password — your token stays on your phone and in the script's settings. The only identifier in it is your old Sheet's ID, which is harmless once step 0 is done.
2. In this folder, connect and push (Claude can run these for you):
   `git remote add origin https://github.com/<you>/plate.git` then `git push -u origin main`
3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Open the **Actions** tab and wait for "Deploy Plate to GitHub Pages" to turn green (about a minute).
   *You should see:* the site at `https://<you>.github.io/plate/`.
5. **On your phone**, open that link:
   - iPhone (Safari): Share → **Add to Home Screen**.
   - Android (Chrome): ⋮ → **Install app**.
   *You should see:* a blue plate icon named **Plate**; it opens full-screen.
6. In Plate: **Body → Settings** → paste the Web app URL and token from Part A → **Test connection** → **Save**.

Every later `git push` to `main` updates the app automatically.

## After code changes

`npm run push:gas`, then in the editor **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. The URL stays the same.
