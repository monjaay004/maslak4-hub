'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function CoranPage() {
  const [me, setMe] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [cycle, setCycle] = useState<any>(null)
  const [hizbs, setHizbs] = useState<any[]>([])
  const [viewing, setViewing] = useState<number | null>(null)
  const [content, setContent] = useState<any[]>([])
  const [loadingContent, setLoadingContent] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase.from('member').select('*').eq('auth_user_id', user.id).single()
      if (!member) return
      setMe(member)

      try { const res = await fetch('/hizbs.json'); setHizbs(await res.json()) } catch {}

      const { data: activeCycle } = await supabase.from('reading_cycle').select('*').eq('tenant_id', member.tenant_id).eq('status', 'ACTIVE').single()
      setCycle(activeCycle)

      if (activeCycle) {
        const { data: myAssignments } = await supabase
          .from('hizb_assignment')
          .select('*')
          .eq('cycle_id', activeCycle.id)
          .eq('member_id', member.id)
          .order('hizb_number')
        setAssignments(myAssignments || [])
      }
    })()
  }, [])

  async function loadFullContent(hizbNum: number) {
    setViewing(hizbNum)
    setLoadingContent(true)
    setContent([])
    try {
      // Le hizb N correspond aux quarts (N-1)*4+1 à N*4
      const allAyahs: any[] = []
      const start = (hizbNum - 1) * 4 + 1
      for (let q = start; q < start + 4; q++) {
        const res = await fetch(`https://api.alquran.cloud/v1/hizbQuarter/${q}/quran-uthmani`)
        const data = await res.json()
        if (data.status === 'OK' && data.data?.ayahs) {
          allAyahs.push(...data.data.ayahs)
        }
      }
      setContent(allAyahs)
    } catch (e: any) {
      toast.error('Erreur chargement contenu : ' + e.message)
    }
    setLoadingContent(false)
  }

  async function validateHizb(assignmentId: string) {
    const { error } = await supabase.from('hizb_assignment').update({
      status: 'VALIDATED', validated_at: new Date().toISOString()
    }).eq('id', assignmentId)
    if (error) { toast.error(error.message); return }
    toast.success('Lecture validée — Jazakallahou khayran')
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, status: 'VALIDATED', validated_at: new Date().toISOString() } : a))
  }

  function getHizbRef(num: number) {
    return hizbs.find((h: any) => h.number === num)
  }

  // Modal de lecture du contenu complet
  if (viewing !== null) {
    const ref = getHizbRef(viewing)
    return (
      <div>
        <button onClick={() => { setViewing(null); setContent([]) }} className="text-sm text-brand-500 mb-3 hover:underline">← Retour</button>
        <div className="card p-4 mb-4 bg-brand-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-500 text-white rounded-xl flex items-center justify-center font-bold text-lg">{viewing}</div>
            <div className="flex-1">
              {ref && <div className="text-lg font-medium" dir="rtl" lang="ar" style={{ fontFamily: 'Traditional Arabic, serif' }}>{ref.arabic}</div>}
              {ref && <div className="text-xs text-gray-500">{ref.verses}</div>}
            </div>
          </div>
        </div>

        {loadingContent ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Chargement du contenu coranique...</p>
          </div>
        ) : (
          <div className="card p-5 bg-amber-50">
            <div dir="rtl" lang="ar" style={{ fontFamily: 'Traditional Arabic, "Noto Naskh Arabic", serif', fontSize: '1.5rem', lineHeight: '2.6' }}>
              {content.map((ayah, i) => {
                const prevAyah = i > 0 ? content[i - 1] : null
                const showSurahName = !prevAyah || prevAyah.surah?.number !== ayah.surah?.number
                return (
                  <span key={ayah.number}>
                    {showSurahName && <div className="text-center my-4 text-brand-700 font-bold text-base bg-white rounded-lg py-2 border-2 border-brand-300">{ayah.surah?.name}</div>}
                    {ayah.text}
                    <span className="inline-block mx-1 text-brand-500 text-sm">﴿{ayah.numberInSurah}﴾</span>
                  </span>
                )
              })}
            </div>
            {content.length > 0 && <p className="text-xs text-gray-500 text-center mt-4">{content.length} versets · Source : api.alquran.cloud</p>}
          </div>
        )}
      </div>
    )
  }

  const validated = assignments.filter(a => a.status === 'VALIDATED').length
  const total = assignments.length

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">📖 Lecture du Coran</h1>

      {!cycle ? (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">📖</div>
          <h2 className="text-lg font-semibold mb-2">Aucun cycle actif</h2>
          <p className="text-sm text-gray-500">L'administrateur n'a pas encore lancé de cycle de lecture pour cette semaine.</p>
        </div>
      ) : (
        <>
          <div className="card p-4 mb-4 bg-brand-50 border-brand-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-brand-800">Cycle {cycle.cycle_number}</h2>
              <span className="text-xs text-brand-600 bg-brand-100 px-2 py-1 rounded">{cycle.week_label}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-brand-700">{validated}/{total} Hizbs lus</span>
              <span className="text-brand-500 font-medium">{total ? Math.round(validated/total*100) : 0}%</span>
            </div>
            <div className="h-2 bg-brand-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${total ? (validated/total)*100 : 0}%` }} />
            </div>
          </div>

          {assignments.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-gray-500">Aucun Hizb ne vous est attribué pour ce cycle.</p>
              <p className="text-xs text-gray-400 mt-1">Contactez l'administrateur si vous pensez que c'est une erreur.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const ref = getHizbRef(a.hizb_number)
                const isValidated = a.status === 'VALIDATED'
                return (
                  <div key={a.id} className={`card p-4 border-l-4 ${isValidated ? 'border-l-green-500 bg-green-50' : a.is_carryover ? 'border-l-amber-400 bg-amber-50' : 'border-l-brand-500'}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${isValidated ? 'bg-green-500 text-white' : 'bg-brand-500 text-white'}`}>{a.hizb_number}</div>
                      <div className="flex-1 min-w-0">
                        {ref && <div className="text-base mb-1" dir="rtl" lang="ar" style={{ fontFamily: 'Traditional Arabic, serif' }}>{ref.arabic}</div>}
                        {ref && <div className="text-xs text-gray-500">{ref.verses}</div>}
                        {a.is_carryover && <span className="text-[10px] text-amber-600 font-medium">↻ Report</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadFullContent(a.hizb_number)}
                        className="flex-1 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors">
                        📖 Lire le contenu en arabe
                      </button>
                      {!isValidated ? (
                        <button onClick={() => validateHizb(a.id)}
                          className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                          ✓ Valider
                        </button>
                      ) : (
                        <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">✓ Lu</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
