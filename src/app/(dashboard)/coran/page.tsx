'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function CoranPage() {
  const [me, setMe] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [cycle, setCycle] = useState<any>(null)
  const [hizbs, setHizbs] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase.from('member').select('*').eq('auth_user_id', user.id).single()
      if (!member) return
      setMe(member)

      // Charger les références des 60 Hizbs
      try { const res = await fetch('/hizbs.json'); setHizbs(await res.json()) } catch {}

      // Charger le cycle actif
      const { data: activeCycle } = await supabase.from('reading_cycle').select('*').eq('tenant_id', member.tenant_id).eq('status', 'ACTIVE').single()
      setCycle(activeCycle)

      if (activeCycle) {
        // Charger MES hizbs assignés pour ce cycle
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
          {/* En-tête du cycle */}
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

          {/* Mes Hizbs */}
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
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl flex-shrink-0 ${isValidated ? 'bg-green-500 text-white' : 'bg-brand-500 text-white'}`}>
                        {a.hizb_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        {ref && (
                          <>
                            <div className="text-right text-lg mb-1" dir="rtl" lang="ar" style={{ fontFamily: 'Traditional Arabic, serif' }}>
                              {ref.arabic}
                            </div>
                            <div className="text-xs text-gray-500">{ref.verses}</div>
                          </>
                        )}
                        {a.is_carryover && <span className="text-[10px] text-amber-600 font-medium">↻ Report du cycle précédent</span>}
                      </div>
                      <div className="flex-shrink-0">
                        {isValidated ? (
                          <div className="text-center">
                            <span className="text-green-500 text-2xl">✓</span>
                            <div className="text-[10px] text-green-600">Lu</div>
                          </div>
                        ) : (
                          <button onClick={() => validateHizb(a.id)}
                            className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                            Valider
                          </button>
                        )}
                      </div>
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
