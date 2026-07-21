import { updateSession } from "@/lib/supabase/proxy"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Run in the Node.js runtime (not edge) so the middleware can read runtime
  // environment variables like SUPABASE_URL. In the edge runtime these are not
  // available, so the session-refresh Supabase client fell back to the public
  // URL (e.g. http://localhost:8001), which is unreachable server-side inside
  // Docker — breaking token refresh and, via RLS, all server-side reads.
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
