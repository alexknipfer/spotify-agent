import type { ToolContext } from "eve/tools";
import { z } from "zod";
import { spotifyAuth } from "./spotify-auth";

const API_URL = "https://api.spotify.com/v1";

const trackSchema = z.object({
  uri: z.string(),
  name: z.string(),
  popularity: z.number().optional(),
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({ name: z.string() }).optional(),
});

const searchResponseSchema = z.object({
  tracks: z.object({ items: z.array(trackSchema) }).optional(),
});

const profileSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  product: z.string().optional(),
  country: z.string().optional(),
});

const recentlyPlayedResponseSchema = z.object({
  items: z.array(
    z.object({
      played_at: z.string(),
      track: trackSchema,
    }),
  ),
});

const topTracksResponseSchema = z.object({
  items: z.array(trackSchema),
});

export const topTracksTimeRangeSchema = z.enum([
  "last_4_weeks",
  "last_6_months",
  "last_12_months",
]);

export type TopTracksTimeRange = z.infer<typeof topTracksTimeRangeSchema>;

const TOP_TRACKS_TIME_RANGES: Record<TopTracksTimeRange, string> = {
  last_4_weeks: "short_term",
  last_6_months: "medium_term",
  last_12_months: "long_term",
};

export type SpotifyTrack = z.infer<typeof trackSchema>;

export async function getSpotifyClient(ctx: ToolContext) {
  const { token } = await ctx.getToken(spotifyAuth);

  async function request(
    path: string,
    params: Record<string, string> = {},
    init: Omit<RequestInit, "body"> & { json?: unknown } = {},
  ) {
    const { json, headers: initHeaders, ...rest } = init;
    const url = new URL(`${API_URL}${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const headers = new Headers(initHeaders);
    headers.set("authorization", `Bearer ${token}`);

    if (json !== undefined) {
      headers.set("content-type", "application/json");
    }

    const res = await fetch(url, {
      ...rest,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
      signal: ctx.abortSignal,
    });

    if (res.status === 401) {
      ctx.requireAuth(spotifyAuth);
    }

    return res;
  }

  async function readJson(res: Response): Promise<unknown> {
    return res.status === 204 ? undefined : res.json();
  }

  function ensureOk(
    res: Response,
    action: string,
    { playback = false }: { playback?: boolean } = {},
  ) {
    if (res.ok) {
      return;
    }

    if (playback && res.status === 404) {
      throw new Error(
        "Spotify has no active device. Ask the user to start playing something in the Spotify app, then try again.",
      );
    }

    if (playback && res.status === 403) {
      throw new Error(
        "Spotify refused the request. Playback control requires a Premium account.",
      );
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      throw new Error(
        `Spotify rate limit hit${retryAfter ? `; retry in ${retryAfter}s` : ""}.`,
      );
    }

    throw new Error(`Spotify ${action} failed (${res.status}).`);
  }

  function normalize(value: string) {
    return value.trim().toLowerCase();
  }

  async function getProfile() {
    const res = await request("/me");
    ensureOk(res, "profile request");

    const me = profileSchema.parse(await readJson(res));
    return {
      id: me.id,
      displayName: me.display_name,
      plan: me.product,
      country: me.country,
    };
  }

  async function searchTracks(
    query: string,
    limit = 10,
  ): Promise<SpotifyTrack[]> {
    const response = await request("/search", {
      q: query,
      type: "track",
      limit: String(limit),
    });

    ensureOk(response, "search");

    const body = searchResponseSchema.parse(await readJson(response));

    return body.tracks?.items ?? [];
  }

  /**
   * Finds the best matching track: prefers exact title matches (and the artist,
   * if given), then the most popular. Returns undefined when nothing matches.
   */
  async function findTrack({
    song,
    artist,
  }: {
    song: string;
    artist?: string;
  }): Promise<SpotifyTrack | undefined> {
    let candidates: SpotifyTrack[];

    if (artist) {
      candidates = await searchTracks(`track:"${song}" artist:"${artist}"`);

      if (candidates.length === 0) {
        candidates = await searchTracks(`${song} ${artist}`);
      }
    } else {
      candidates = await searchTracks(song);
    }

    const wantedTitle = normalize(song);
    const wantedArtist = artist ? normalize(artist) : undefined;

    function score(t: SpotifyTrack) {
      const titleScore = normalize(t.name) === wantedTitle ? 2 : 0;
      const artistScore =
        wantedArtist &&
        t.artists.some((a) => normalize(a.name).includes(wantedArtist))
          ? 2
          : 0;
      return titleScore + artistScore;
    }

    return [...candidates].sort(
      (a, b) =>
        score(b) - score(a) || (b.popularity ?? 0) - (a.popularity ?? 0),
    )[0];
  }

  async function addToQueue(trackUri: string) {
    const res = await request(
      "/me/player/queue",
      { uri: trackUri },
      { method: "POST" },
    );

    ensureOk(res, "queue request", { playback: true });
  }

  async function getRecentlyPlayed(limit = 20) {
    const res = await request("/me/player/recently-played", {
      limit: String(limit),
    });

    ensureOk(res, "recently played request");

    const body = recentlyPlayedResponseSchema.parse(await readJson(res));

    return body.items.map((item) => ({
      playedAt: item.played_at,
      track: item.track,
    }));
  }

  async function getTopTracks(timeRange: TopTracksTimeRange, limit = 20) {
    const res = await request("/me/top/tracks", {
      time_range: TOP_TRACKS_TIME_RANGES[timeRange],
      limit: String(limit),
    });

    ensureOk(res, "top tracks request");

    const body = topTracksResponseSchema.parse(await readJson(res));

    return body.items;
  }

  return {
    getProfile,
    searchTracks,
    findTrack,
    addToQueue,
    getRecentlyPlayed,
    getTopTracks,
  };
}
