import {authPolicy} from "./audit";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

export function origin() {
  return new URL(process.env.CONSOLE_URL).origin;
}
export async function session() {
  const s=await getIronSession(await cookies(), {
    cookieName: "garage_console", password: process.env.SESSION_SECRET, ttl: 8 * 3600,
    cookieOptions: { secure: origin().startsWith("https:"), sameSite: "lax", httpOnly: true },
  });
  if(s.user && s.method!=="oidc"){
    const policy=authPolicy();
    if(policy.ssoOnly || (s.passwordEpoch||0)!==policy.passwordEpoch)delete s.user;
  }
  return s;
}
