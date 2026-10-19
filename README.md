# Lactomedi Creator Builders: Railway setup

One link for the team with three pages:

- **Start page** (`/`): pick a builder. At the bottom is the **team media library**, where you can browse every photo, GIF and video the team has uploaded, download any of them, and upload new ones.
- **Content Guide Builder** (`/guide`): a one-page, shot-by-shot guide.
- **Content Script Builder** (`/script`): a four-page reference brief.

## How it works

**Your own work stays yours.** Your open tabs and work in progress live in your own browser.
- Nobody else sees them, and nothing changes for the team until you click **Save**.
- Going back to *All builders*, closing the page or switching between builders never clears your work. Your tabs are saved as you type and again whenever you leave a page.
- Only the reset and close buttons inside a builder clear anything.

**Team script libraries.** **Saved scripts** in each builder shows everything the team has saved in that builder, with who saved it and when. Open any of them to get your own copy in a tab, edit it, and save it back.
- If two people edit the same saved script, the second person gets a message instead of overwriting, and can use **Save as copy**.
- Every older version is kept on the server.
- Deleted scripts go to a trash folder on the server instead of being erased.

**Team media library.** Every place you can add a photo, GIF or video opens a picker.
- Choose something the team already uploaded, so you don't have to upload the same file again.
- Or upload from your device. New uploads are added to the library automatically, for everyone.
- Files are kept at full quality on the server, up to 300 MB each.
- Nothing can be deleted from the library through the website, so files are never lost by accident.

**Your name.** Enter it once, on the start page or next to **Save** in either builder. It's shown on scripts and files you save.

**Protection.** The whole site sits behind one team password.

## What's in the folder

- `server.js`: the server. It needs nothing else installed.
- `package.json`: tells Railway how to start it.
- `public/index.html`: the start page with the media library.
- `public/guide.html`: the Content Guide Builder.
- `public/script.html`: the Content Script Builder.
- `src/`: the media picker source and the build script, kept for future edits. Railway doesn't need it.
- `.gitignore`: keeps local test data out of GitHub.

## Put it on Railway (about 10 minutes)

If someone at your company already manages Railway, send them this folder and this page.

1. **GitHub.** Create a new private repository and upload everything in this folder, keeping the same structure.
2. **Railway.** Click **New Project**, then **Deploy from GitHub repo**, and pick that repository. Railway detects a Node app and starts it with `npm start`.
3. **Add a volume.** Right-click the service and choose **Add Volume**, with the mount path `/data`. This is where saved scripts and media files live. Without it, everything disappears on the next deploy, and the server log warns about this.
4. **Team password.** In the service's **Variables**, add `TEAM_PASSWORD` with a password of your choice.
5. **Link.** In **Settings**, then **Networking**, click **Generate Domain**.
6. **Test it.** Open the link and enter the password. Any username works.
   - Type your name, upload a file in the media library, and check that it appears.
   - Open a builder, click a reference slot, and check that the same file shows in the picker.

Send the team the link and the password.

## Space

Videos take the most room. If the volume fills up, you can make it bigger in Railway's volume settings (live resize) without downtime.

## Updating later

Replace the files in `public/` in GitHub. Railway redeploys automatically, and everything on the volume (scripts, history, trash, media) stays safe.

## Good to know

- **Switching devices:** open tabs belong to the browser they're in. On another device, open your work from **Saved scripts**.
- **Videos and GIFs:** they play inside the builders while the page is open. After reopening, pick them again from the media library to make them move.
- **iPhone videos:** some don't play in Chrome. Use Safari, or export the video as MP4.
