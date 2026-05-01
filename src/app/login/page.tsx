'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const formatPhoneForAuth = (input: string) => {
    const clean = input.replace(/\D/g, '')
    if (clean.startsWith('221')) return `+${clean}`
    if (clean.startsWith('7') || clean.startsWith('6')) return `+221${clean}`
    return `+${clean}`
  }

  async function sendOtp() {
    setLoading(true)
    const formatted = formatPhoneForAuth(phone)
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)

    if (error) {
      toast.error('Erreur lors de l\'envoi du code. Vérifiez le numéro.')
      return
    }
    toast.success('Code envoyé par SMS')
    setStep('otp')
  }

  async function verifyOtp() {
    setLoading(true)
    const formatted = formatPhoneForAuth(phone)
    const { error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: 'sms',
    })
    setLoading(false)

    if (error) {
      toast.error('Code incorrect ou expiré')
      return
    }
    toast.success('Connexion réussie !')
    router.push('/dashboard')
    router.refresh()
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
          {step === 'phone' ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro WhatsApp
              </label>
              <input
                type="tel"
                className="input mb-4"
                placeholder="77 123 45 67"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendOtp()}
              />
              <button
                onClick={sendOtp}
                disabled={loading || phone.replace(/\D/g, '').length < 9}
                className="btn-primary w-full"
              >
                {loading ? 'Envoi en cours...' : 'Recevoir le code'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Code envoyé au <strong>{phone}</strong>
              </p>
              <input
                type="text"
                inputMode="numeric"
                className="input mb-4 text-center text-2xl tracking-[0.5em]"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                autoFocus
              />
              <button
                onClick={verifyOtp}
                disabled={loading || otp.length < 6}
                className="btn-primary w-full mb-3"
              >
                {loading ? 'Vérification...' : 'Se connecter'}
              </button>
              <button
                onClick={() => { setStep('phone'); setOtp('') }}
                className="btn-secondary w-full text-sm"
              >
                Changer de numéro
              </button>
            </>
          )}
        </div>

        <p className="text-center text-brand-200 text-xs mt-6">
          Assidqi Wa Sadiqina — La Véridicité et les Véridiques
        </p>
      </div>
    </div>
  )
}
