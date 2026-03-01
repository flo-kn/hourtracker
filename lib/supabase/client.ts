import { createBrowserClient } from "@supabase/ssr"

// Use a consistent storage key that works for both client and server
const STORAGE_KEY = "sb-app-auth-token"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: STORAGE_KEY,
      },
    }
  )
}

export { STORAGE_KEY }
