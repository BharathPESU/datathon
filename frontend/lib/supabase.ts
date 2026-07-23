import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://laumrpmclobxuwcfepww.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdW1ycG1jbG9ieHV3Y2ZlcHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNjg4MTIsImV4cCI6MjA1NTc0NDgxMn0.Q6Xn3-7X35X-fake-anon-key'
  )
}
