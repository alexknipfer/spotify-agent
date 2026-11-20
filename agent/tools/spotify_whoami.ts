import { defineTool } from "eve/tools";
import { z } from "zod";
import { spotifyAuth } from "../lib/spotify-auth";

export default defineTool({
  description:
    "Get the signed-in user's Spotify profile (display name, plan, country). Prompts the user to sign in to Spotify if needed.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const { token } = await ctx.getToken(spotifyAuth);
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 401) ctx.requireAuth(spotifyAuth);
    if (!res.ok) throw new Error(`Spotify profile request failed (${res.status}).`);

    const me = (await res.json()) as {
      id: string;
      display_name: string | null;
      product?: string;
      country?: string;
    };
    return {
      id: me.id,
      displayName: me.display_name,
      plan: me.product,
      country: me.country,
    };
  },
});
