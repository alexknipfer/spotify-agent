import { connect } from "@vercel/connect/eve";

// The UID of the Vercel Connect connector created with
// `vercel connect create spotify --name eve-playground`. See the README.
export const SPOTIFY_CONNECTOR = "spotify/eve-playground";

export const spotifyAuth = connect({
  connector: SPOTIFY_CONNECTOR,
  tokenParams: { scopes: ["user-read-private", "user-read-email", "user-modify-playback-state"] },
});
