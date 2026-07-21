import { updateSession } from "@/lib/supabase/proxy"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Proxy runs in the Node.js runtime by default (Next.js 16). This matters in
  // Docker: session refresh needs the internal SUPABASE_URL (http://kong:8000),
  // which is only reachable/readable server-side in the Node runtime. Do not add
  // a `runtime` option here — setting it in a proxy file throws at build time.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
