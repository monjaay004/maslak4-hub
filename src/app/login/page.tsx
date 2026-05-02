'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin() {
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs')
      return
    }
    setLoading(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` }
      })
      setLoading(false)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Compte créé ! Vérifiez votre email pour confirmer.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) {
        if (error.message.includes('Invalid login')) {
          toast.error('Email ou mot de passe incorrect')
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success('Connexion réussie !')
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-500 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl text-white font-bold">M4</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Maslak 4</h1>
          <p className="text-brand-200 text-sm mt-1">Digital HUB</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h2 className="text-center font-semibold text-gray-800 mb-4">
            {isSignUp ? 'Créer un compte' : 'Se connecter'}
          </h2>

          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            className="input mb-3"
            placeholder="votre@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
          <input
            type="password"
            className="input mb-4"
            placeholder="Minimum 6 caractères"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-primary w-full mb-3"
          >
            {loading ? 'Chargement...' : isSignUp ? 'Créer le compte' : 'Se connecter'}
          </button>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-brand-500 w-full text-center hover:underline"
          >
            {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un compte'}
          </button>
        </div>

        <p className="text-center text-brand-200 text-xs mt-6">
          Assidqi Wa Sadiqina — La Véridicité et les Véridiques
        </p>
      </div>
    </div>
  )
}
