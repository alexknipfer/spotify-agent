import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSpotifyClient } from "#lib/spotify.js";

export default defineTool({
  description:
    "Get the signed-in user's most recently played Spotify tracks, newest first, with the time each was played. Spotify returns at most the last 50 plays.",
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("How many recent tracks to return (1-50)."),
  }),
  label: {
    start: ({ limit }) => `Get your ${limit} most recently played songs`,
  },
  async execute({ limit }, ctx) {
    const spotifyClient = await getSpotifyClient(ctx);
    const items = await spotifyClient.getRecentlyPlayed(limit);

    return items.map(({ playedAt, track }) => ({
      track: track.name,
      artists: track.artists.map((a) => a.name),
      album: track.album?.name,
      uri: track.uri,
      playedAt,
    }));
  },
});
