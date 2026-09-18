import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthValue>(null as unknown as AuthValue)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile((data as Profile) ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s) await loadProfile(s.user.id)
      else setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthValue = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(cevirHata(error.message))
    },
    signUp: async (email, password, fullName) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) throw new Error(cevirHata(error.message))
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
    refreshProfile: async () => {
      if (session) await loadProfile(session.user.id)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function cevirHata(msg: string) {
  if (msg.includes('Invalid login credentials')) return 'E-posta veya sifre hatali.'
  if (msg.includes('Email not confirmed')) return 'E-posta adresi henuz dogrulanmamis.'
  if (msg.includes('User already registered')) return 'Bu e-posta ile kayitli bir kullanici zaten var.'
  if (msg.includes('Password should be')) return 'Sifre en az 6 karakter olmali.'
  return msg
}
