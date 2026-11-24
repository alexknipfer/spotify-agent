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

export type SpotifyTrack = z.infer<typeof trackSchema>;

export async function getSpotifyClient(ctx: ToolContext) {
	const { token } = await ctx.getToken(spotifyAuth);

	async function request(
		path: string,
		params: Record<string, string> = {},
		init: RequestInit = {},
	) {
		const url = new URL(`${API_URL}${path}`);

		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}

		const res = await fetch(url, {
			...init,
			headers: { authorization: `Bearer ${token}` },
			signal: ctx.abortSignal,
		});

		if (res.status === 401) {
			ctx.requireAuth(spotifyAuth);
		}

		return res;
	}

	function normalize(value: string) {
		return value.trim().toLowerCase();
	}

	async function getProfile() {
		const res = await request("/me");

		if (!res.ok) {
			throw new Error(`Spotify profile request failed (${res.status}).`);
		}

		const me = profileSchema.parse(await res.json());
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

		if (!response.ok) {
			throw new Error(`Spotify search failed (${response.status}).`);
		}

		const body = searchResponseSchema.parse(await response.json());

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

		if (!res.ok) {
			throw new Error(`Spotify queue request failed (${res.status}).`);
		}
	}

	return {
		getProfile,
		searchTracks,
		findTrack,
		addToQueue,
	};
}
