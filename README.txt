# Macro Ledger – Phone app

This is a Progressive Web App (PWA). It works on iPhone and Android, can be added to the home screen, and caches its app files for offline use after the first visit.

## Install on your phone

A PWA needs to be served from an HTTPS website. The easiest free route is GitHub Pages:

1. On a computer, create a GitHub account if you don't already have one.
2. Create a new public repository, e.g. `macro-ledger`.
3. Upload **all files in this folder** to the repository root (index.html, app.js, foods.js, sw.js, manifest.webmanifest, both icons).
4. In the repository, open Settings → Pages.
5. Under Build and deployment, choose Deploy from a branch; select `main` and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish the site. It will provide an HTTPS address.
7. Open that address on your phone:
   - **iPhone:** Safari → Share → Add to Home Screen → Add.
   - **Android:** Chrome → menu (⋮) → Install app or Add to Home screen.

After opening it once while online, the app files are cached and the core tracker works offline.

## Data and privacy

- Your food library and diary are stored in local browser storage on that phone/browser.
- No account, analytics, or external API is used.
- Use History & export → Backup JSON regularly. Restore that JSON on another device/browser.
- Clearing browser/site data can erase your local records.

## Included features

- Food library populated with the recurring foods and estimates from your logs.
- Search and category filtering.
- Serving converter that scales all four values from the base serving.
- Daily diary with repeated entries and running totals.
- Independent 4/4/9 macro-calorie cross-check; supplied calories are never overwritten.
- Custom food creation.
- Date-based logs, CSV export and JSON backup/restore.

The food values are personal estimates based on the values used in your logs, not verified nutrition-label data. Check product labels when accuracy matters.


Latest update (v15): dark, eye-friendly colour theme; diary entries now appear directly beneath protein target progress; Add food shows the five most frequently logged foods (ties are broken by most recent use); Browse library remains available for all other foods.

Google Drive backup (v40)
- In History & backup, select Connect Google Drive and sign in with the Google account added as an OAuth test user.
- On the first device, if no Drive backup exists, the app uploads that device's current food library, diary and categories.
- On another device, connect the same account. If a backup already exists, choose Restore to download it, or Cancel to keep the device's current data and replace the cloud backup.
- Once connected in an open app session, changes are backed up automatically after a short pause. You can also select Back up now.
- Reconnect after reloading the app or opening it on another device. Google access tokens are kept only in memory.
- If the app detects that the cloud file changed since this device last synced, it stops rather than silently overwriting the newer cloud copy. Reconnect and explicitly choose which copy to keep.
- This is a backup/restore workflow, not simultaneous live editing or background sync while the app is closed. Keep using JSON export as an additional backup.
