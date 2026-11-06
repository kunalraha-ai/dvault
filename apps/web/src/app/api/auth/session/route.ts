import { NextRequest } from "next/server";
import { json, resolveUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session — bootstrap for the no-account local mode.
 *
 * No cookie, no login: creates the implicit local user (and its AES-256-GCM
 * instance key) on first call and returns both. The client imports the key and
 * every value stays encrypted end-to-end with it.
 */
export async function GET(req: NextRequest) {
  const { user, via } = await resolveUser(req);
  return json({
    user: { id: user.id, name: user.name },
    keyJwk: JSON.parse(user.vaultKeyJwk),
    via,
    mode: "local-no-auth",
  });
}
