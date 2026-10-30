# SWL Superlatives — setup (about 15 minutes, one time)

## 1. Firebase (stores the votes)
1. console.firebase.google.com → Create a project → name it `swl-superlatives` (Analytics off).
2. Build → Realtime Database → Create database → United States → Start in test mode.
3. Open the **Rules** tab, delete what's there, paste everything from `database.rules.json`, click **Publish**.
4. Gear icon → Project settings → Your apps → `</>` web icon → name it `superlatives` → Register app.
5. Copy the `firebaseConfig = { ... }` block and send it to Claude (or paste it into `config.js` where it says `firebase: null`).

## 2. GitHub (hosts the website)
1. github.com → New repository → name `swl-superlatives` → **Public** → Create.
2. Click **uploading an existing file** → drag in every file from this folder → **Commit changes**.
3. Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
4. After about a minute your site is live at `https://YOUR-USERNAME.github.io/swl-superlatives/`

## The three pages
- Phones (the QR code opens this): `https://YOUR-USERNAME.github.io/swl-superlatives/`
- TV: `.../swl-superlatives/tv.html` (full screen the browser on the TV computer)
- Host controls: `.../swl-superlatives/host.html` (PIN is in `config.js`, default 1211)

## Running the game
1. Host page → enter PIN → **Create the game**. The TV shows How to vote with the QR code.
2. **Start Round 1** → phones show the question → people vote.
3. **Close voting & reveal** → winner on the TV → **Next round**.
4. After round 12 → **Finale** crowns the Golden Shovels winner (most votes all night).
5. After testing, tap **Start a fresh game** to clear all test votes.

## Editing
Names, questions, host PIN and grand prize name are all in `config.js`.
