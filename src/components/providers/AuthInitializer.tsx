import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

export function AuthInitializer() {
  const setSession = useAuthStore((s) => s.setSession)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession, setLoading])

  return null
}
