import { defineTool } from "eve/tools";
import { z } from "zod";
import { spotifyAuth } from "../lib/spotify-auth";

type Track = {
  uri: string;
  name: string;
  popularity?: number;
  artists: { name: string }[];
  album?: { name: string };
};

const normalize = (value: string) => value.trim().toLowerCase();

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
    const { token } = await ctx.getToken(spotifyAuth);
    const headers = { authorization: `Bearer ${token}` };

    const search = async (q: string): Promise<Track[]> => {
      const url = new URL("https://api.spotify.com/v1/search");
      url.searchParams.set("q", q);
      url.searchParams.set("type", "track");
      url.searchParams.set("limit", "10");
      const res = await fetch(url, { headers, signal: ctx.abortSignal });
      if (res.status === 401) ctx.requireAuth(spotifyAuth);
      if (!res.ok) throw new Error(`Spotify search failed (${res.status}).`);
      const body = (await res.json()) as { tracks?: { items?: Track[] } };
      return body.tracks?.items ?? [];
    };

    let candidates: Track[] = [];
    if (artist) {
      candidates = await search(`track:"${song}" artist:"${artist}"`);
      if (candidates.length === 0)
        candidates = await search(`${song} ${artist}`);
    } else {
      candidates = await search(song);
    }
    if (candidates.length === 0) {
      throw new Error(
        `No Spotify track found for "${song}"${artist ? ` by ${artist}` : ""}. Ask the user to check the spelling or provide the artist.`,
      );
    }

    // Prefer exact title matches (and the artist, if given), then the most popular.
    const wantedTitle = normalize(song);
    const wantedArtist = artist ? normalize(artist) : undefined;
    const score = (t: Track) =>
      (normalize(t.name) === wantedTitle ? 2 : 0) +
      (wantedArtist &&
      t.artists.some((a) => normalize(a.name).includes(wantedArtist))
        ? 2
        : 0);
    const track = [...candidates].sort(
      (a, b) =>
        score(b) - score(a) || (b.popularity ?? 0) - (a.popularity ?? 0),
    )[0]!;

    const queueUrl = new URL("https://api.spotify.com/v1/me/player/queue");
    queueUrl.searchParams.set("uri", track.uri);
    const res = await fetch(queueUrl, {
      method: "POST",
      headers,
      signal: ctx.abortSignal,
    });
    if (res.status === 401) ctx.requireAuth(spotifyAuth);
    if (res.status === 404) {
      throw new Error(
        "Spotify has no active device. Ask the user to start playing something in the Spotify app, then try again.",
      );
    }
    if (res.status === 403) {
      throw new Error(
        "Spotify refused the request. Queueing requires a Premium account.",
      );
    }
    if (!res.ok)
      throw new Error(`Spotify queue request failed (${res.status}).`);

    return {
      queued: true,
      track: track.name,
      artists: track.artists.map((a) => a.name),
      album: track.album?.name,
      uri: track.uri,
    };
  },
});
