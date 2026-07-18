import "server-only";

import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  type Session,
  verifySessionToken,
} from "./session";

export async function getServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return verifySessionToken(token, process.env.AUTH_SESSION_SECRET);
}
