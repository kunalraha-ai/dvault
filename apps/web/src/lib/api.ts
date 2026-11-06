import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateLocalUser, validateDeviceToken, type LocalUser } from "./local-user";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export interface ResolvedUser {
  user: LocalUser;
  /** "device" = request came from a paired extension; "local" = the web app */
  via: "device" | "local";
}

/**
 * Resolve who is acting on this request. There is no authentication anymore:
 * a valid device token maps to the local user; anything else IS the local
 * user (the app is single-user and self-hosted). Device tokens exist only to
 * identify paired extensions for revocation and the consent log.
 */
export async function resolveUser(req: NextRequest): Promise<ResolvedUser> {
  const authHeader = req.headers.get("authorization");
  const token =
    req.headers.get("x-dvault-device-token") ??
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (token) {
    const device = await validateDeviceToken(token);
    if (device) {
      const { prisma } = await import("./db");
      const user = await prisma.user.findUnique({ where: { id: device.userId } });
      if (user) {
        return {
          via: "device",
          user: {
            id: user.id,
            name: user.name,
            vaultKeyJwk: user.vaultKeyJwk,
            demoLoaded: user.demoLoaded,
          },
        };
      }
    }
  }

  const user = await getOrCreateLocalUser();
  return { via: "local", user };
}

/**
 * CORS for the Chrome extension (origin chrome-extension://<id> is dynamic).
 * Only used on extension endpoints — no cookies involved.
 */
export const EXTENSION_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-DVault-Device-Token, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function optionsResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: EXTENSION_CORS });
}

export function corsJson(data: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(data, init);
  for (const [k, v] of Object.entries(EXTENSION_CORS)) res.headers.set(k, v);
  return res;
}

/** Basic same-origin check for mutating web-app routes (CSRF defense). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser or same-origin form posts
  const host = req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
