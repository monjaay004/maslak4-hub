'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function HadithsPage() {
  const [hadiths, setHadiths] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [myProgress, setMyProgress] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase.from('member').select('*').eq('auth_user_id', user.id).single()
      setMe(member)
      try { const res = await fetch('/hadiths.json'); setHadiths(await res.json()) } catch {}
      if (member) {
        const { data: subs } = await supabase.from('hadith_submission').select('*').eq('member_id', member.id)
        setMyProgress(subs || [])
      }
    })()
  }, [])

  async function submitHadith(num: number) {
    if (!me) return
    const { error } = await supabase.from('hadith_submission').insert({
      tenant_id: me.tenant_id, member_id: me.id, hadith_number: num,
      status: 'PENDING', notes: 'Soumission depuis l\'app'
    })
    if (error) { toast.error(error.message); return }
    toast.success(`Hadith #${num} soumis pour validation`)
    const { data: subs } = await supabase.from('hadith_submission').select('*').eq('member_id', me.id)
    setMyProgress(subs || [])
  }

  function getStatus(num: number) {
    const sub = myProgress.find(s => s.hadith_number === num)
    return sub?.status || 'NOT_STARTED'
  }

  const approved = myProgress.filter(s => s.status === 'APPROVED').length
  const pending = myProgress.filter(s => s.status === 'PENDING').length

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Les 70 Hadiths</h1>
      <p className="text-sm text-gray-500 mb-4">
        Programme recommandé par Cheikh Ibrahima Abdallah Sall (RTA).
        Apprenez, récitez, puis soumettez pour validation.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 bg-green-50 text-center"><div className="text-2xl font-bold text-green-700">{approved}</div><div className="text-xs text-green-600">Validés</div></div>
        <div className="card p-3 bg-amber-50 text-center"><div className="text-2xl font-bold text-amber-700">{pending}</div><div className="text-xs text-amber-600">En attente</div></div>
        <div className="card p-3 bg-gray-50 text-center"><div className="text-2xl font-bold text-gray-600">{hadiths.length - approved - pending}</div><div className="text-xs text-gray-500">Restants</div></div>
      </div>

      {/* Barre de progression */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progression</span>
          <span>{approved}/{hadiths.length} ({hadiths.length ? Math.round(approved/hadiths.length*100) : 0}%)</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${hadiths.length ? (approved/hadiths.length)*100 : 0}%` }} />
        </div>
      </div>

      {selected ? (
        <div className="card p-5">
          <button onClick={() => setSelected(null)} className="text-xs text-brand-500 mb-4 hover:underline">← Retour à la liste</button>
          <div className="text-center mb-4">
            <span className="inline-block w-14 h-14 bg-brand-100 text-brand-700 rounded-full leading-[56px] text-2xl font-bold">{selected.number}</span>
            <h2 className="font-semibold text-lg mt-2">{selected.title}</h2>
          </div>
          <div className="text-right text-xl leading-[2.5] mb-6 p-5 bg-amber-50 rounded-xl" dir="rtl" lang="ar" style={{ fontFamily: 'Traditional Arabic, serif, sans-serif' }}>{selected.arabic}</div>
          <div className="text-sm text-gray-700 leading-relaxed mb-4 p-4 bg-gray-50 rounded-lg">{selected.french}</div>
          {selected.narrator && <p className="text-xs text-gray-500 mb-4 italic">Rapporteur : {selected.narrator}</p>}

          {getStatus(selected.number) === 'NOT_STARTED' && (
            <button onClick={() => submitHadith(selected.number)} className="btn-primary w-full">📖 Je l'ai appris — Soumettre pour validation</button>
          )}
          {getStatus(selected.number) === 'PENDING' && (
            <div className="text-center p-3 bg-amber-50 rounded-lg text-amber-700 text-sm font-medium">⏳ En attente de validation par le correcteur</div>
          )}
          {getStatus(selected.number) === 'APPROVED' && (
            <div className="text-center p-3 bg-green-50 rounded-lg text-green-700 text-sm font-medium">✅ Validé — Hadith maîtrisé, qu'Allah vous récompense</div>
          )}
          {getStatus(selected.number) === 'REJECTED' && (
            <div>
              <div className="text-center p-3 bg-red-50 rounded-lg text-red-700 text-sm font-medium mb-3">❌ À retravailler</div>
              <button onClick={() => submitHadith(selected.number)} className="btn-primary w-full">Resoumettre</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {hadiths.map(h => {
            const st = getStatus(h.number)
            return (
              <button key={h.number} onClick={() => setSelected(h)}
                className={`card p-3 w-full text-left flex items-center gap-3 hover:shadow-md transition-all ${
                  st === 'APPROVED' ? 'border-l-4 border-l-green-500 bg-green-50' :
                  st === 'PENDING' ? 'border-l-4 border-l-amber-400 bg-amber-50' :
                  st === 'REJECTED' ? 'border-l-4 border-l-red-400 bg-red-50' : ''}`}>
                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  st === 'APPROVED' ? 'bg-green-500 text-white' :
                  st === 'PENDING' ? 'bg-amber-400 text-white' :
                  'bg-brand-100 text-brand-700'}`}>{h.number}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{h.title}</div>
                  <div className="text-xs text-gray-500 truncate" dir="rtl">{h.arabic?.substring(0, 50)}...</div>
                </div>
                <span className="text-xs flex-shrink-0">
                  {st === 'APPROVED' ? '✅' : st === 'PENDING' ? '⏳' : st === 'REJECTED' ? '❌' : '→'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
