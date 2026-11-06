# Voice Notes

A small floating macOS window that transcribes WhatsApp voice notes as soon as you download them.

Download a voice note in WhatsApp. The file lands in `~/Downloads` as `WhatsApp Audio ….opus`. Voice Notes picks it up within two seconds and sends it to the Antigravity CLI (`agy`). The window then opens on that note with:

- a summary, a to-do list you can tick off, and the questions the client asked
- the transcript, with an English translation when the note isn't in English
- a chat about the note, with shortcuts for "Draft a reply", "Reply in English" and more

It lives in the menu bar, so closing the window doesn't stop it. The pin button keeps the window above other apps.

Built with Electrobun, Bun, React, Vite and Tailwind, sharing Focus Timer's look.

## Requirements

- macOS on Apple Silicon, Bun, and `ffmpeg` (`brew install ffmpeg`)
- Antigravity CLI: `curl -fsSL https://antigravity.google/cli/install.sh | bash`, then run `agy` once to sign in with Google

## Develop

```bash
bun install
bun run dev        # build the view and run the app with file watching
bun run build      # release build in build/stable-macos-arm64/
```

UI-only preview in a browser with sample notes (no Electrobun, no agent):

```bash
bunx vite -c vite.preview.config.ts   # http://localhost:5174
```

## How it works

- `src/bun/notes.ts` watches Downloads, converts audio to mp3 with ffmpeg, queues notes and stores them in `~/Library/Application Support/Voice Notes/notes/<id>/`.
- `src/bun/agent.ts` runs `agy -p … --output-format json --json-schema … --sandbox`. It never passes `--dangerously-skip-permissions`. In headless runs, tools that need approval are denied, so nothing said in a voice note can make the agent run commands.
- Voice notes already in Downloads the first time the app runs are listed but not sent to the agent. Each has a Transcribe button.
