import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSpotifyClient, topTracksTimeRangeSchema } from "#lib/spotify.js";

export default defineTool({
  description:
    "Get the signed-in user's top Spotify tracks, most listened to first, for a time period. Spotify only supports three fixed windows: last_4_weeks, last_6_months and last_12_months. Custom date ranges are not supported, so pick the closest window (e.g. 'this month' -> last_4_weeks, 'this year' -> last_12_months) and tell the user which window was used. Prompts the user to sign in to Spotify if needed.",
  inputSchema: z.object({
    timeRange: topTracksTimeRangeSchema
      .default("last_4_weeks")
      .describe("The time window to rank tracks over."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("How many top tracks to return (1-50)."),
  }),
  label: {
    start: ({ timeRange, limit }) =>
      `Get your top ${limit} songs (${timeRange.replaceAll("_", " ")})`,
  },
  async execute({ timeRange, limit }, ctx) {
    const spotifyClient = await getSpotifyClient(ctx);
    const tracks = await spotifyClient.getTopTracks(timeRange, limit);

    return {
      timeRange,
      tracks: tracks.map((track, index) => ({
        rank: index + 1,
        track: track.name,
        artists: track.artists.map((a) => a.name),
        album: track.album?.name,
        uri: track.uri,
      })),
    };
  },
});
