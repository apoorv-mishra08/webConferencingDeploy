# Deployment Guide

This document covers recommended deployment steps for the WebConference project.

Overview
- Frontend (Vite) — deploy to Vercel (static build)
- Backend (Express + Socket.IO) — deploy to Render (web service) or any Node host that supports WebSockets

1) Frontend — Vercel

- In the Vercel dashboard, import the GitHub repository `24ibraheem/web_conferencing_app`.
- Set the project to use the root package.json. Vercel will run `npm run build` by default.
- Add an environment variable (in Project Settings > Environment Variables):
  - Key: `VITE_SOCKET_SERVER_URL`
  - Value: `https://your-backend.example.com` (set to your deployed backend URL)
- Deploy. Vercel will publish the static `dist` output.

2) Backend — Render (recommended)

- Create a new Web Service in Render and connect the `main` branch of this repo.
- Use the `render.yaml` included in the repo or configure via dashboard:
  - Root working directory: `/server`
  - Build command: `npm install`
  - Start command: `npm start`
  - Environment variables (add secrets via the dashboard):
    - `GEMINI_API_KEY` (if you use Gemini for MCQs)
    - `PORT` (optional — Render will supply one)
- Make sure the service uses a plan that supports WebSockets (Render's standard web services do).

3) CORS and environment wiring

- In production tighten CORS in `server/server.js` to only allow your frontend host instead of `*`.
  For example:
  ```js
  const io = new Server(httpServer, { cors: { origin: ['https://your-frontend.vercel.app'] } });
  ```
- Update `VITE_SOCKET_SERVER_URL` to point at your backend's public URL (including https).

4) Optional: GitHub Actions auto-deploy

- You can add GitHub Actions to trigger deploys; Vercel/Render have first-class GitHub integration and will auto-deploy on push.

5) Quick local test before deploy

```bash
# Backend
cd server
npm install
npm start

# Frontend (in another terminal)
cd ..
npm install
npm run build
serve -s dist # or use Vercel preview
```

If you'd like, I can:
- Auto-generate a `render.yaml` (already included) and a Vercel project config (already included),
- Create a `Dockerfile` and GitHub Actions CI workflow for builds + deploy, or
- Walk you through connecting the repo to Vercel and Render step-by-step.
