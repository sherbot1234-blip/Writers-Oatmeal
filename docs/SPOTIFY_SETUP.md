# Connecting Spotify (to import playlists)

You only need this for **Import playlist**. Pasting Spotify links to play songs works without any setup.

It's a one-time setup of about 3 minutes. The site walks you through it too: **Songs → Import playlist**.

1. Go to the **Spotify Developer Dashboard**: https://developer.spotify.com/dashboard. Log in with your normal Spotify account and click **Create app**.
2. **App name:** anything, e.g. `Writer's Oatmeal`. **Description:** anything.
3. **Redirect URIs:** paste the address shown in the site's import window and click **Add**. Once the site is on GitHub Pages, it will be
   `https://sherbot1234-blip.github.io/Writers-Oatmeal/`
   (it must match exactly, including the `/` at the end).
4. Under "Which API/SDKs are you planning to use?" tick **Web API**, agree to the terms and click **Save**.
5. Open the app's **Settings** and copy the **Client ID** into the site. Never use the **Client secret**; this site doesn't need it.
6. Click **Connect Spotify**, approve, and you're back on the Songs page with your playlists.

**Good to know**

- The site can only *read* your playlists. It can't change anything in your Spotify account.
- The connection is remembered on each device. **Disconnect** is in the import window.
- If Spotify says *INVALID_CLIENT: Invalid redirect URI*, the address in step 3 doesn't exactly match the one the site shows.
- Spotify runs new apps in "development mode", which is fine for personal use. If it ever says your account isn't allowed, add your Spotify email under the app's **User Management**.
- Optional: so you don't have to paste the Client ID on every device, send it to Claude to build into the site. It isn't secret. Or add it yourself as a repository variable named `SPOTIFY_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables).
