'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin() {
    if (!email || !password) { toast.error('Email et mot de passe requis'); return }
    if (isSignUp && (!firstName || !lastName)) { toast.error('Prénom et nom requis'); return }
    setLoading(true)

    if (isSignUp) {
      // Formater le numéro WhatsApp
      let phone = whatsapp.replace(/\s/g, '')
      if (phone && !phone.startsWith('+')) phone = '+221' + phone

      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { first_name: firstName, last_name: lastName, whatsapp: phone }
        }
      })
      setLoading(false)
      if (error) { toast.error(error.message); return }

      // Connexion automatique après inscription
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
      if (loginErr) { toast.success('Compte créé ! Connectez-vous.'); setIsSignUp(false); return }

      toast.success('Bienvenue dans le Maslak 4 !')
      router.push('/dashboard')
      router.refresh()
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) { toast.error('Email ou mot de passe incorrect'); return }
      toast.success('Connexion réussie !')
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-500 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl text-white font-bold">M4</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Maslak 4</h1>
          <p className="text-brand-200 text-sm mt-1">Digital HUB</p>
        </div>

        <div className="card p-6">
          <h2 className="text-center font-semibold text-gray-800 mb-4">
            {isSignUp ? 'Créer un compte' : 'Se connecter'}
          </h2>

          {isSignUp && (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <input type="text" className="input mb-3" placeholder="Votre prénom"
                value={firstName} onChange={e => setFirstName(e.target.value)} />

              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input type="text" className="input mb-3" placeholder="Votre nom de famille"
                value={lastName} onChange={e => setLastName(e.target.value)} />

              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp</label>
              <div className="flex gap-2 mb-3">
                <span className="input w-16 text-center bg-gray-50 text-gray-500 text-sm flex items-center justify-center">+221</span>
                <input type="tel" className="input flex-1" placeholder="77 123 45 67"
                  value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
              </div>
            </>
          )}

          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input type="email" className="input mb-3" placeholder="votre@email.com"
            value={email} onChange={e => setEmail(e.target.value)} />

          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
          <input type="password" className="input mb-4" placeholder="Minimum 6 caractères"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />

          <button onClick={handleLogin} disabled={loading} className="btn-primary w-full mb-3">
            {loading ? 'Chargement...' : isSignUp ? 'Créer mon compte' : 'Se connecter'}
          </button>

          <button onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-brand-500 w-full text-center hover:underline">
            {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
          </button>
        </div>

        <p className="text-center text-brand-200 text-xs mt-6">
          Assidqi Wa Sadiqina — La Véridicité et les Véridiques
        </p>
      </div>
    </div>
  )
}
