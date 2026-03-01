import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Use a consistent storage key that works for both client and server
const STORAGE_KEY = "sb-app-auth-token"

export async function createClient() {
  const cookieStore = await cookies()

  // Use internal Docker network URL for server-side requests, fallback to public URL
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!

  return createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      storageKey: STORAGE_KEY,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The "setAll" method was called from a Server Component.
          // This can be ignored if you have proxy refreshing user sessions.
        }
      },
    },
  })
}
