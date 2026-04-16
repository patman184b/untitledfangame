# Imperium — local web frontend

The browser UI is **not** meant to be opened as a file. Express must serve `public/` so ES modules and `/api` calls work.

## Run the local test server

From **this folder** (`fangame/Server`):

```powershell
npm install
npm start
```

You should see:

```text
Shard Server running on port 3847
```

## Open the game

In your browser:

- **http://127.0.0.1:3847/**  
- or **http://localhost:3847/**

Do **not** use `file:///.../index.html` — `import` and `/api` will break.

## Port already in use

Use another port:

```powershell
$env:PORT=3848; npm start
```

Then open **http://127.0.0.1:3848/**

## Quick check

- **http://127.0.0.1:3847/** should return HTTP **200** (HTML).
- **http://127.0.0.1:3847/styles.css** should return **200** (CSS).

If `npm start` fails, paste the full error (often `better-sqlite3` rebuild on a new Node version — try `npm rebuild better-sqlite3`).
