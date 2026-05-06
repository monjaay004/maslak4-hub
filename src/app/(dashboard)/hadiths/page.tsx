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
    if (!sub) return 'NOT_STARTED'
    return sub.status
  }

  const approved = myProgress.filter(s => s.status === 'APPROVED').length
  const pending = myProgress.filter(s => s.status === 'PENDING').length

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Les 70 Hadiths</h1>
      <p className="text-sm text-gray-500 mb-4">
        Programme de 70 hadiths recommandés par Cheikh Ibrahima Sall. 
        Apprenez, récitez, puis soumettez pour validation.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 bg-green-50 text-center"><div className="text-2xl font-bold text-green-700">{approved}</div><div className="text-xs text-green-600">Validés</div></div>
        <div className="card p-3 bg-amber-50 text-center"><div className="text-2xl font-bold text-amber-700">{pending}</div><div className="text-xs text-amber-600">En attente</div></div>
        <div className="card p-3 bg-blue-50 text-center"><div className="text-2xl font-bold text-blue-700">{hadiths.length - approved - pending}</div><div className="text-xs text-blue-600">Restants</div></div>
      </div>

      {selected ? (
        <div className="card p-5">
          <button onClick={() => setSelected(null)} className="text-xs text-brand-500 mb-4 hover:underline">← Retour</button>
          <div className="text-center mb-4">
            <span className="inline-block w-14 h-14 bg-brand-100 text-brand-700 rounded-full leading-[56px] text-2xl font-bold">{selected.number}</span>
          </div>
          <div className="text-right text-xl leading-[2.5] mb-6 p-5 bg-amber-50 rounded-xl" dir="rtl" lang="ar" style={{ fontFamily: 'serif' }}>{selected.arabic}</div>
          <div className="text-sm text-gray-700 leading-relaxed mb-4 p-4 bg-gray-50 rounded-lg">{selected.french}</div>
          {selected.narrator && <p className="text-xs text-gray-500 mb-4">Rapporteur : {selected.narrator}</p>}

          {getStatus(selected.number) === 'NOT_STARTED' && (
            <button onClick={() => submitHadith(selected.number)} className="btn-primary w-full">Je l'ai appris — Soumettre pour validation</button>
          )}
          {getStatus(selected.number) === 'PENDING' && (
            <div className="text-center p-3 bg-amber-50 rounded-lg text-amber-700 text-sm font-medium">⏳ En attente de validation par le correcteur</div>
          )}
          {getStatus(selected.number) === 'APPROVED' && (
            <div className="text-center p-3 bg-green-50 rounded-lg text-green-700 text-sm font-medium">✅ Validé ! Hadith maîtrisé</div>
          )}
          {getStatus(selected.number) === 'REJECTED' && (
            <div>
              <div className="text-center p-3 bg-red-50 rounded-lg text-red-700 text-sm font-medium mb-3">❌ Non validé — à retravailler</div>
              <button onClick={() => submitHadith(selected.number)} className="btn-primary w-full">Resoumettre</button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
          {hadiths.map(h => {
            const st = getStatus(h.number)
            return (
              <button key={h.number} onClick={() => setSelected(h)}
                className={`card p-3 text-center hover:shadow-md transition-all ${
                  st === 'APPROVED' ? 'border-green-400 bg-green-50' :
                  st === 'PENDING' ? 'border-amber-300 bg-amber-50' :
                  st === 'REJECTED' ? 'border-red-300 bg-red-50' : ''}`}>
                <div className={`text-xl font-bold mb-0.5 ${
                  st === 'APPROVED' ? 'text-green-600' :
                  st === 'PENDING' ? 'text-amber-600' : 'text-brand-500'}`}>{h.number}</div>
                <div className="text-[9px] text-gray-400">
                  {st === 'APPROVED' ? '✅' : st === 'PENDING' ? '⏳' : st === 'REJECTED' ? '❌' : ''}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
