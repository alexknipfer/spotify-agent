import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSpotifyClient } from "../lib/spotify";

export default defineTool({
	description:
		"Get the signed-in user's Spotify profile (display name, plan, country). Prompts the user to sign in to Spotify if needed.",
	inputSchema: z.object({}),
	async execute(_input, ctx) {
		const spotifyClient = await getSpotifyClient(ctx);

		return spotifyClient.getProfile();
	},
});
