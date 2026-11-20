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

### 3. Create the Spotify connector

```bash
vercel connect create spotify --name eve-playground
```

The CLI prompts for the connection method. If it asks for a client ID and secret, create an app in the [Spotify developer dashboard](https://developer.spotify.com/dashboard), copy its credentials into the prompt, and add the redirect URI the CLI shows you to the Spotify app's settings. Spotify requires an exact match.

The connector UID is `<service>/<name>`, so this one is `spotify/eve-playground`. If you use a different `--name`, or the CLI prints another UID, update `SPOTIFY_CONNECTOR` in `agent/lib/spotify-auth.ts`.

### 4. Attach the project to the connector

```bash
vercel connect attach spotify/eve-playground --yes
```

### 5. Pull the Vercel environment

```bash
vercel env pull
```

This writes the Vercel OIDC token to `.env.local`. Connect uses it to authenticate your local server. The token expires, so run `vercel env pull` again if sign-in starts failing with an authentication error.

### 6. Run the agent and sign in

```bash
eve dev
```

Ask "Who am I on Spotify?". The agent shows a sign-in link. Open it, approve access on Spotify, and the agent continues with your profile. Later requests reuse the stored grant, so you aren't asked again.

### Local development identity

Spotify access belongs to one user, so eve needs a user identity for each request. The local `eve dev` caller has none by default, so `agent/channels/eve.ts` wraps `localDev()` to treat every local request as the same user (`local-dev-user`). That is fine for solo development. It would be wrong for a shared or deployed agent. Put a real authenticator, such as your app's login, ahead of it in the `auth` list. A Slack channel maps each Slack user automatically.

### Spotify limitations

- Playback control (play, pause, skip) requires Spotify Premium and an active device. Profile, search, and playlist endpoints work on free accounts.
- A Spotify app in development mode only allows users you add under **User Management** in the Spotify dashboard.
- Connect is billed per token request. See [Vercel Connect pricing](https://vercel.com/docs/connect/pricing).

### Troubleshooting

| What you see | What to do |
| --- | --- |
| `principal_required` | The request had no signed-in user. Check that `agent/channels/eve.ts` still returns `principalType: "user"` for local requests. |
| The sign-in page asks you to log in to Vercel | Deployment Protection is blocking the callback. Sign in to Vercel with project access, or add a Deployment Protection exception. |
| Token or connector not found | Run `vercel connect list` and check the connector UID. Confirm the project is attached and `.env.local` was pulled. |
| Spotify rejects the redirect URI | Add the exact URI shown during `vercel connect create` to the Spotify app's settings. |

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
