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

## Plan 2 update — meals, recurring charges, estimates

Do these once, in order, in the Apps Script editor (the project Claude pushed the new code to). Your Web app URL and token stay the same.

1. **Upload the new version:** **Deploy → Manage deployments → ✏ → Version: New version → Deploy**.
2. **Run `setup`** (pick it in the function menu at the top, then **Run**). If Google asks for permission, allow it.
   *You should see:* in the Sheet, the **QuickAdd**, **SavedFoods** and **Recurring** tabs have starter rows (rice, chicken, …; Gym and Laundry every Sunday), and the Recurring tab has a new **ChargedThrough** column. In the editor, **Triggers** (the alarm-clock icon) lists one daily trigger for `runRecurring`.
   Tabs that already had rows are left alone, so running setup again never brings back something you deleted.
3. **Load your estimates:** in the Sheet, **File → Import → Upload** `private/food-estimates.csv` (in the Plate folder on your computer) → **Insert new sheet(s)** → **Import data**.
   *You should see:* a new tab **food-estimates** with one row per food you've bought: how many times, the usual price, and guessed kcal and protein. Change any number you know better, and clear the ones you'd rather not track. A ✓ (TRUE) in **SavedFood** turns that food into a one-tap saved food.
4. **Run `importFoodEstimates`.**
   *You should see:* the log says how many Food expenses were linked. In Plate, past meals on Money show protein and kcal, and your money totals don't change.
5. **After any later `runMigration`, run `importFoodEstimates` again.** It re-links the meals and removes the stale ones.
6. **From Sunday 15 Nov, stop typing Gym and Laundry yourself**, in the app or the Sheet. Plate adds them every Sunday just after midnight, and also whenever the app opens. Typing them too would count them twice.

**Adding a subscription** (Claude, YouTube Premium, …): in Plate, **Body → Settings → Recurring charges → Add recurring charge**. Choose **Monthly**, set the day your card is billed, and set the start date to your **next** billing day so past months aren't added. You can also type a row into the Recurring tab. Leave ID blank, use `monthly` or `weekly`, and give Weekday as 0 = Sunday … 6 = Saturday or MonthDay as 1–31.

**Moving to your real Sheet later:** after `useRealSheet` and `runMigration`, repeat steps 2–4 there. `useRealSheet` already runs `setup` for you.

## Plan 3 update, stage 1 — gym, body, targets

Do these once, in the Apps Script editor, after Claude has pushed the new code. Your Web app URL and token stay the same.

1. **Upload the new version:** **Deploy → Manage deployments → ✏ → Version: New version → Deploy**.
2. **Run `setup`.**
   *You should see:* the **Exercises** tab has 11 starter exercises and the **Routines** tab has Push (Mon, Thu), Pull (Tue, Fri) and Anytime (leg extension, leg curl, abs). Tabs you already filled, or emptied on purpose, are left alone.
3. **In Plate:** Body → Profile. Enter your height, age and sex (used only for BMI and the calorie estimate). Then log today's weight on the Body tab.
   *You should see:* your BMI, the weight chart, and on Targets an "Estimated maintenance" line with a **Use estimate** button. If your weight trend suggests new targets, a card offers them; nothing changes until you tap **Update**.

**Logging a workout:** Gym → **Start workout** (or Start blank workout). Each exercise shows last time's sets, already filled in. Tick ✓ each set as you finish it: ticked sets are saved to the Sheet straight away. If you close the app mid-workout, Gym → **Continue workout** picks up where you left off. Tap **Finish workout** at the end.

## Plan 3 update, stage 2 — Money analytics, export

Nothing to do in Apps Script: this stage only changes the app. **Exporting:** Settings → **Export**, tick what you want (transactions, meals, recurring, saved foods, workouts, body), pick This month / a month / All time, and tap **Export** — one CSV per type opens in your phone's share sheet (or downloads on a laptop). Money's own **Export** link saves exactly the entries on screen. For a full backup, download the Plate Sheet itself: File → Download → Microsoft Excel (.xlsx).
