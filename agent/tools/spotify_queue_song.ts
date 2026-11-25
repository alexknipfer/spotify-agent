import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSpotifyClient, type SpotifyTrack } from "#lib/spotify.js";

const describeSong = ({ song, artist }: { song: string; artist?: string }) =>
  `"${song}"${artist ? ` by ${artist}` : ""}`;

export default defineTool({
  description:
    "Add one or more songs to the end of the signed-in user's Spotify playback queue, in the order given. Pass every song the user asked for in a single call via `songs`; do not call this tool once per song. If the user didn't name any song, ask them for one first. `artist` is optional per song; when omitted, the best match for the song name is queued. Songs that can't be found are reported in `notFound` and songs Spotify refused to queue are reported in `failed`; the rest are still queued. Always tell the user clearly which songs were queued and which were not found or failed (with the reason). Returns the tracks that were queued so you can confirm them. Prompts the user to sign in to Spotify if needed.",
  inputSchema: z.object({
    songs: z
      .array(
        z.object({
          song: z.string().min(1).describe("The song title to queue."),
          artist: z
            .string()
            .min(1)
            .optional()
            .describe("The artist, only if the user mentioned one."),
        }),
      )
      .min(1)
      .max(25)
      .describe("The songs to queue, in the order they should play."),
  }),
  label: {
    start: ({ songs }) =>
      songs.length === 1
        ? `Queue ${describeSong(songs[0])} on Spotify`
        : `Queue ${songs.length} songs on Spotify`,
  },
  async execute({ songs }, ctx) {
    const spotifyClient = await getSpotifyClient(ctx);

    const found: SpotifyTrack[] = [];
    const notFound: string[] = [];

    const lookups = await Promise.all(
      songs.map((request) => spotifyClient.findTrack(request)),
    );

    lookups.forEach((track, index) => {
      if (track) {
        found.push(track);
      } else {
        notFound.push(describeSong(songs[index]));
      }
    });

    if (found.length === 0) {
      throw new Error(
        `No Spotify tracks found for ${notFound.join(", ")}. Ask the user to check the spelling or provide the artists.`,
      );
    }

    const queued: SpotifyTrack[] = [];
    const failed: { track: string; artists: string[]; error: string }[] = [];
    let firstError: unknown;

    for (const track of found) {
      try {
        await spotifyClient.addToQueue(track.uri);
        queued.push(track);
      } catch (error) {
        firstError ??= error;

        failed.push({
          track: track.name,
          artists: track.artists.map((a) => a.name),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Nothing worked, so the failure is likely systemic (sign-in, no active
    // device, Premium); surface the original error rather than a partial result.
    if (queued.length === 0) {
      throw firstError;
    }

    return {
      queued: queued.map((track) => ({
        track: track.name,
        artists: track.artists.map((a) => a.name),
        album: track.album?.name,
        uri: track.uri,
      })),
      failed,
      notFound,
    };
  },
});
