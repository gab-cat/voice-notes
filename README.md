# Voice Notes

A small floating macOS window that transcribes WhatsApp voice notes as soon as you download them.

**Website:** [gab-cat.github.io/voice-notes](https://gab-cat.github.io/voice-notes/) · **Download:** [latest release](https://github.com/gab-cat/voice-notes/releases/latest/download/stable-macos-arm64-VoiceNotes.dmg)

Download a voice note in WhatsApp. The file lands in `~/Downloads` as `WhatsApp Audio ….opus`. Within two seconds Voice Notes moves it into its own folder and sends it to the Antigravity CLI (`agy`). The window then opens on that note with:

- a summary, a to-do list you can tick off, and the questions the client asked
- the transcript, with an English translation when the note isn't in English
- a chat about the note, with shortcuts for "Draft a reply", "Reply in English" and more

It lives in the menu bar, so closing the window doesn't stop it. The pin button keeps the window above other apps.

Settings (the sliders button) control which folder is watched, the file name pattern, the model and reasoning level, and how many days voice notes are kept (7 by default). Deleting a voice note, by hand or when it expires, deletes its transcript and moves the audio to the Trash.

Built with Electrobun, Bun, React, Vite and Tailwind, sharing Focus Timer's look.

## Requirements

- macOS on Apple Silicon and Bun
- Antigravity CLI: `curl -fsSL https://antigravity.google/cli/install.sh | bash`, then run `agy` once to sign in with Google

## Develop

```bash
bun install
bun run dev        # build the view and run the app with file watching
bun run build      # release build in build/stable-macos-arm64/
```

## Website

The site lives in `site/` (plain HTML, CSS and JS, no build step) and deploys to GitHub Pages from `.github/workflows/pages.yml` on every push to `main` that touches it. Preview it with `python3 -m http.server 5175 -d site`. `scripts/build-og.sh` re-renders the social card from the live hero.

## Releases and auto-update

Same setup as Focus Timer. Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`, which builds on macOS and attaches the DMG, the update tarball and `update.json` to a GitHub Release. Installed copies check `releases/latest` 5 seconds after launch and then hourly, download in the background, and show "Restart to update" in the window and the menu bar.

```bash
# 1. bump "version" in package.json, commit
# 2. tag and push; the tag must match package.json
git tag v0.1.1 && git push origin main v0.1.1
```

Install from the DMG on the Releases page. The app is ad-hoc signed, not notarized, so the first launch needs right-click › Open.

UI-only preview in a browser with sample notes (no Electrobun, no agent):

```bash
bunx vite -c vite.preview.config.ts   # http://localhost:5174
```

## How it works

- `src/bun/notes.ts` watches a folder (Downloads by default). Audio files whose names match the pattern are moved as is (no conversion) into `~/Library/Application Support/Voice Notes/Voice notes/`, which the app reads from. Audio dropped straight into that folder is picked up too. Each note is stored in `notes/<id>/note.json` and links to its file.
- `src/bun/settings.ts` keeps the settings in `settings.json`. Models come from `agy models`; ids are `<family>-<low|medium|high>`.
- `src/bun/agent.ts` runs `agy -p … --output-format json --json-schema … --sandbox`. It never passes `--dangerously-skip-permissions`. In headless runs, tools that need approval are denied, so nothing said in a voice note can make the agent run commands.
- Voice notes already in Downloads the first time the app runs are listed but not sent to the agent. Each has a Transcribe button.
