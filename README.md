# Population Ecology Platform

Interactive teaching tool for population ecology, optimized for live lectures. Visual model building, real-time simulations, and clear biology-first explanations.

## Quick start

1. Install dependencies

```
npm install
```

2. Start the dev server

```
npm start
```

3. Build for production

```
npm run build
```

## Deployment (Vercel)

- Vercel auto-detects Create React App and runs `npm run build`.
- SPA routing is handled via `vercel.json` with filesystem-first and a catch-all to `/`.
- Configure optional env vars for speech-to-text in Vercel dashboard (see `.env.example`).

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```
REACT_APP_SPEECH_PROVIDER=web
REACT_APP_SPEECH_API_KEY=
REACT_APP_SPEECH_REGION=
REACT_APP_SPEECH_LANGUAGE=en-US
```

The app functions without cloud STT by using the browser Web Speech API.

## Node version

Requires Node.js 18.x (see `package.json` engines). Use `nvm`/`fnm` if needed.

## Notes

- TailwindCSS is loaded via CDN for simplicity.
- For production hardening, consider migrating to Vite/Next.js and local Tailwind config.


