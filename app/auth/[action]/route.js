import {passwordSchema} from "../../../lib/forms";
import { beginAudit,authPolicy } from "../../../lib/audit";
import * as oidc from "openid-client";
import { timingSafeEqual, createHash } from "node:crypto";
import { origin, session } from "../../../lib/session";

const digest = value => createHash("sha256").update(value).digest();
const back = path => Response.redirect(origin() + path, 303);
const discovery = () => oidc.discovery(new URL(process.env.OIDC_ISSUER), process.env.OIDC_CLIENT_ID, process.env.OIDC_SECRET);
export async function POST(req, { params }) {
  if (req.headers.get("origin") !== origin()) return new Response("Forbidden", { status: 403 });
  const { action } = await params;
  const s = await session();
  if (action === "logout") { const finish=beginAudit(s.user,"Sign out"); s.destroy(); finish("Succeeded"); return back("/"); }
  if (action !== "login") return new Response(null, {status:404});
  const finish=beginAudit("Administrator","Password sign-in");
  const policy=authPolicy();
  if(policy.ssoOnly){finish("Denied");return back("/?error=sso-only")}
  const input=passwordSchema.safeParse({password:(await req.formData()).get("password")});
  if (!input.success || !process.env.ADMIN_PASSWORD || !timingSafeEqual(digest(input.data.password), digest(process.env.ADMIN_PASSWORD))) { finish("Failed"); return back("/?error=login"); }
  s.method="password";s.passwordEpoch=policy.passwordEpoch;
  s.user = "Administrator";
  await s.save();
  finish("Succeeded");
  return back("/");
}
export async function GET(req, { params }) {
  const { action } = await params;
  if (!process.env.OIDC_ISSUER) return back("/?error=oidc");
  let finish;
  try {
    if(action==="callback") finish=beginAudit(null,"Authentik sign-in");
    const s = await session(), config = await discovery();
    const callback = origin() + "/auth/callback";
    if (action === "sso") {
      s.state = oidc.randomState();
      s.verifier = oidc.randomPKCECodeVerifier();
      s.nonce = oidc.randomNonce();
      await s.save();
      return Response.redirect(oidc.buildAuthorizationUrl(config, {redirect_uri:callback, scope:"openid email profile", state:s.state, nonce:s.nonce, code_challenge:await oidc.calculatePKCECodeChallenge(s.verifier), code_challenge_method:"S256"}));
    }
    if (action !== "callback" || !s.state || !s.verifier || !s.nonce) { finish?.("Failed"); return back("/?error=oidc"); }
    const result = await oidc.authorizationCodeGrant(config, new URL(callback + new URL(req.url).search), {pkceCodeVerifier:s.verifier, expectedState:s.state, expectedNonce:s.nonce, idTokenExpected:true});
    const claims = result.claims();
    const actor=claims.preferred_username || claims.sub;
    if (!process.env.OIDC_ADMIN_GROUP || !Array.isArray(claims.groups) || !claims.groups.includes(process.env.OIDC_ADMIN_GROUP)) { finish("Denied",actor); return back("/?error=group"); }
    delete s.state; delete s.verifier; delete s.nonce;
    s.method="oidc";delete s.passwordEpoch;
    s.user = claims.preferred_username || claims.sub;
    await s.save();
    finish("Succeeded",actor);
    return back("/");
  } catch { finish?.("Failed"); return back("/?error=oidc"); }
}
