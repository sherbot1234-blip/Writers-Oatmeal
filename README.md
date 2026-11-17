# Writer's Oatmeal

A home for all your stories. Each story has its own look and its own:

- **Overview**: cover, title, hook, genres, synopsis, cast
- **Characters**: customisable character cards with overview charts (label/value rows), stat charts (radar or bars), text, tags and image galleries. Every story has its own **card layout** for new characters, and each character can add or remove sections.
- **Relationships**: step through characters one at a time and see how each feels about the others, in both directions. Pick from relationship templates (Lover, Friend, Family, Rival, Doesn't know…) or make your own. There's also a **Web** view that shows everyone at once.
- **Plot**: plot points grouped into arcs, with drag and drop, status (idea / planned / written), chapter labels and the characters involved. There's a Board view and an Outline view.
- **World**: upload maps and images, and keep a list of world-building questions for each story, with a question bank to start from.
- **Songs**: a soundtrack list with Spotify links that play on the page, plus an embedded story playlist.
- **Customise**: theme presets, colours, fonts, corner shape, background image, and renaming, hiding or reordering pages.

## Your data

Everything is saved in your browser (IndexedDB) on this device. Use **Back up all** on the library page to download a `.json` backup, and **Import** to restore it or move it to another device or browser. Clearing your browser's site data deletes your stories, so keep backups.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

### Publishing on GitHub Pages

`.github/workflows/deploy.yml` builds and deploys the site on every push to `main`.
To turn it on, go to the repo's **Settings → Pages** and set **Source** to **GitHub Actions**.
