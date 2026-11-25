import { connect } from "@vercel/connect/eve";

// The UID of the Vercel Connect connector created with
// `vercel connect create spotify --name eve-playground`. See the README.
export const SPOTIFY_CONNECTOR = "spotify/eve-playground";

export const spotifyAuth = connect({
  connector: SPOTIFY_CONNECTOR,
  tokenParams: {
    scopes: [
      "user-read-private",
      "user-read-email",
      "user-modify-playback-state",
      "user-read-playback-state",
      "user-read-currently-playing",
      "user-read-recently-played",
      "user-top-read",
      "user-library-read",
      "user-library-modify",
      "playlist-read-private",
      "playlist-modify-public",
      "playlist-modify-private",
    ],
  },
});
