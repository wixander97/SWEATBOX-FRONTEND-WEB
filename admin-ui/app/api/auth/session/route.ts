import { forwardJson } from "@/lib/api/backend";

/**
 * The signed-in account and its role.
 *
 * The portal asks the API who it is rather than reading the JWT in the browser:
 * the token is httpOnly by design, and the role the server reports is the one
 * that will actually be enforced.
 */
export async function GET() {
  return forwardJson("/api/v1/auth/profile");
}
