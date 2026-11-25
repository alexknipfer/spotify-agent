import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSpotifyClient } from "#lib/spotify.js";

export default defineTool({
  description:
    "Add a song to the end of the signed-in user's Spotify playback queue. `song` is required: if the user didn't name a song, ask them for one first. `artist` is optional; when omitted, the best match for the song name is queued. Returns the track that was queued so you can confirm it. Prompts the user to sign in to Spotify if needed.",
  inputSchema: z.object({
    song: z.string().min(1).describe("The song title to queue."),
    artist: z
      .string()
      .min(1)
      .optional()
      .describe("The artist, only if the user mentioned one."),
  }),
  label: {
    start: ({ song, artist }) =>
      `Queue "${song}"${artist ? ` by ${artist}` : ""} on Spotify`,
  },
  async execute({ song, artist }, ctx) {
    const spotifyClient = await getSpotifyClient(ctx);
    const track = await spotifyClient.findTrack({ song, artist });

    if (!track) {
      throw new Error(
        `No Spotify track found for "${song}"${artist ? ` by ${artist}` : ""}. Ask the user to check the spelling or provide the artist.`,
      );
    }

    await spotifyClient.addToQueue(track.uri);

    return {
      queued: true,
      track: track.name,
      artists: track.artists.map((a) => a.name),
      album: track.album?.name,
      uri: track.uri,
    };
  },
});
