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
