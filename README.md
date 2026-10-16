# Laterday

Laterday is a quiet, local-first save-for-later inbox for notes, links, and images. This project completes **Stage 1**: one device, no account, no backend.

## Publish on GitHub

1. Create an empty GitHub repository (for example, `laterday`) without adding a README or license.
2. From this project folder, connect it and push the existing history:

   ```powershell
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

3. In the repository, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source.
4. The included workflow deploys the app on each push to `main`. The published URL appears in the workflow run and the Pages settings.

The app is static and needs no secrets, backend, or build step. GitHub Pages serves it over HTTPS so it can be installed on a phone. Saved items stay in the browser on the device where they were created; publishing the app does not upload those saves.

## Run it locally

The app is a static progressive web app. Serve this folder from a local HTTP server (service workers and install prompts need HTTP or HTTPS):

```powershell
py -m http.server 8000
```

Open `http://localhost:8000` on a computer. For phone installation, publish to GitHub Pages (or another static HTTPS host) and choose **Add to Home Screen** in the browser. There is no build step or dependency installation.

## What’s here

- Save and edit notes, links, and images; add comma-separated tags.
- Search across titles, text, links, and tags; filter by type or tag; sort by date or title.
- Open a detail view, favorite saves, archive and restore them, or delete them.
- Data persists in browser `localStorage`; uploaded images are stored as data URLs. The app shell is cached for offline launch after the first visit.
- Responsive mobile layout, optional dark mode, and installable PWA manifest.

## Architecture

```mermaid
flowchart LR
  A[Laterday mobile web app] --> B[Browser localStorage]
  A --> C[Service worker cache]
```

Saved items have an ID, type, title, text/link/image content, tags, created and updated timestamps, favorite state, and archived state. No information is sent to a Laterday server. Opening a saved URL navigates to that external website.

## Important decisions and known limits

- LocalStorage keeps setup simple, but it is limited in capacity and tied to this browser profile. There is no cross-device sync or automatic backup. Large image files are capped at 5 MB; browser storage limits may be lower than the theoretical maximum.
- Deletion is permanent. Archiving is reversible.
- The type selector cycles through all types; the service-worker offline cache requires the app to be opened over HTTP(S) at least once. The serif and sans-serif typefaces load from Google Fonts when online and fall back to system fonts offline.
- This is a static web app rather than a native APK. It can be installed from a secure static host or run locally in a mobile browser.
