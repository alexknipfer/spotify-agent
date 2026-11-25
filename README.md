# eve-playground

This is an [eve](https://eve.dev) agent bootstrapped with [`eve init`](https://eve.dev/docs/reference/cli#eve-init).

## Getting started

First, run the development server:

```bash
eve dev
```

The development TUI opens an interactive session where you can send messages to your agent.

Start by editing `agent/instructions.md` to define the agent's identity, purpose, tone, and response guidelines. Configure its model and runtime behavior in `agent/agent.ts`.

Add capabilities under `agent/`, including tools, connections, channels, skills, subagents, and schedules. eve reloads your changes as you work.

## Connect Spotify

The agent signs each user in to their own Spotify account through [Vercel Connect](https://vercel.com/docs/connect). Connect handles the Spotify consent screen, token storage, and refresh, so this project stores no Spotify credentials or tokens.

The `spotify_whoami` tool (`agent/tools/spotify_whoami.ts`) is a small example. It reads the signed-in user's Spotify profile. The auth setup lives in `agent/lib/spotify-auth.ts`.

### 1. Install the Vercel CLI and sign in

```bash
npm install -g vercel
vercel login
```

### 2. Link this project to Vercel

```bash
vercel link
```

Connect checks that the requesting project is linked to the connector, so this step is required even for local development.

### 3. Pull the Vercel environment

```bash
vercel env pull
```

This writes the Vercel OIDC token to `.env.local`. Connect uses it to authenticate your local server. The token expires, so run `vercel env pull` again if sign-in starts failing with an authentication error.

### 6. Run the agent and sign in

```bash
eve dev
```

Ask "Who am I on Spotify?". The agent shows a sign-in link. Open it, approve access on Spotify, and the agent continues with your profile. Later requests reuse the stored grant, so you aren't asked again.

## Learn more

To learn more about eve, explore these resources:

- [eve documentation](https://eve.dev/docs) — learn about eve's features and authoring APIs.
- [eve on GitHub](https://github.com/vercel/eve) — view the source and contribute.

## Deploy on Vercel

Deploy your agent to [Vercel](https://vercel.com) from the project root:

```bash
eve deploy
```

`eve deploy` links a Vercel project if needed and deploys the agent to production. See the [eve deployment documentation](https://eve.dev/docs/guides/deployment/vercel) for authentication, environment variables, and deployment options.
