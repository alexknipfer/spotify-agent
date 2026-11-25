import {
  type AuthFn,
  localDev,
  placeholderAuth,
  vercelOidc,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

// Per-user connections (like Spotify) need a user identity. `localDev()` keeps
// its safety checks (dev server only, loopback only); we only upgrade the
// caller it accepts to a stable user so OAuth tokens have someone to bind to.
function localDevUser(): AuthFn<Request> {
  const authenticate = localDev();
  return async (request) => {
    const caller = await authenticate(request);
    if (!caller) return null;
    return {
      ...caller,
      authenticator: "local-dev",
      principalId: "local-dev-user",
      principalType: "user",
    };
  };
}

export default eveChannel({
  auth: [
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDevUser(),
    // This placeholder will not allow browser requests in production.
    // Replace it with your app's auth provider, like Auth.js or Clerk,
    // or use none() for a public demo.
    placeholderAuth(),
  ],
});
