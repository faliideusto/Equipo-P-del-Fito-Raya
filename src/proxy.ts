import { NextRequest, NextResponse } from "next/server";
import { accountCookieOptions, authRequest, type Session } from "@/lib/account-auth";
import { verifyCoachToken } from "@/lib/coach-session";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const headers = new Headers(request.headers);
  // Overwrite client-supplied values; this flag only controls the access layout.
  headers.set("x-fito-access-page", path === "/acceso" ? "1" : "0");
  if (path === "/acceso" || path === "/api/account" || path === "/api/account/roster" || path === "/api/health") return NextResponse.next({ request: { headers } });
  let session: Session | undefined;
  try {
    const token = request.cookies.get("fito-access")?.value;
    let valid = await verifyCoachToken(request.cookies.get("fito-coach")?.value);
    if (token && !valid) {
      const response = await authRequest("user", undefined, token);
      if (response.ok) valid = Boolean((await response.json()).id);
      else if (response.status !== 401 && response.status !== 403) throw new Error("Auth unavailable");
    }
    if (!valid) {
      const refresh = request.cookies.get("fito-refresh")?.value;
      if (refresh) {
        const response = await authRequest("token?grant_type=refresh_token", { refresh_token: refresh });
        if (response.ok) {
          session = await response.json();
          valid = Boolean(session?.user?.id && session.access_token && session.refresh_token);
        } else if (response.status >= 500 || response.status === 429) throw new Error("Auth unavailable");
      }
    }
    if (!valid) {
      const protocol = process.env.RENDER === "true" ? "https:" : request.nextUrl.protocol;
      const destination = new URL("/acceso", `${protocol}//${request.headers.get("host") ?? request.nextUrl.host}`);
      destination.searchParams.set("next", path + request.nextUrl.search);
      const response = path.startsWith("/api/")
        ? NextResponse.json({ error: "Inicia sesión para acceder a la web." }, { status: 401 })
        : NextResponse.redirect(destination);
      response.headers.set("Cache-Control", "private, no-store");
      response.cookies.delete("fito-access"); response.cookies.delete("fito-refresh");
      response.cookies.delete("fito-coach");
      return response;
    }
    if (session) {
      request.cookies.set("fito-access", session.access_token);
      request.cookies.set("fito-refresh", session.refresh_token);
      headers.set("cookie", request.cookies.toString());
    }
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Cache-Control", "private, no-store");
    if (session) {
      response.cookies.set("fito-access", session.access_token, { ...accountCookieOptions(), maxAge: session.expires_in });
      response.cookies.set("fito-refresh", session.refresh_token, { ...accountCookieOptions(), maxAge: 30 * 86400 });
    }
    return response;
  } catch {
    return NextResponse.json({ error: "No se pudo comprobar tu sesión. Vuelve a intentarlo en unos momentos." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
export const config = {
  // Only the assets used by the access page can load without going through Auth.
  matcher: ["/((?!_next/static/|_next/image|favicon.ico|icon.svg|logo-fito.png).*)"],
};
