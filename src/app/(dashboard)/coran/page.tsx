'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface HizbAssignment {
  id: string
  hizb_number: number
  status: string
  is_carryover: boolean
  validated_at: string | null
  cycle: { cycle_number: number; week_label: string; ends_at: string }
}

export default function CoranPage() {
  const [assignments, setAssignments] = useState<HizbAssignment[]>([])
  const [hizbs, setHizbs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState<string | null>(null)
  const supabase = createClient()

  async function loadMyHizbs() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: member } = await supabase.from('member').select('id').eq('auth_user_id', user.id).single()
    if (!member) return
    const { data } = await supabase.from('hizb_assignment').select('*, cycle:reading_cycle!inner(cycle_number, week_label, ends_at)').eq('member_id', member.id).eq('reading_cycle.status', 'ACTIVE').order('hizb_number')
    setAssignments((data as any) || [])
    try { const res = await fetch('/hizbs.json'); setHizbs(await res.json()) } catch {}
    setLoading(false)
  }

  function getHizbRef(num: number) { return hizbs.find(h => h.number === num) }

  async function validateHizb(assignmentId: string) {
    setValidating(assignmentId)
    const { error } = await supabase.from('hizb_assignment').update({ status: 'VALIDATED', validated_at: new Date().toISOString(), validated_via: 'WEB' }).eq('id', assignmentId)
    if (error) toast.error('Erreur'); else { toast.success('Hizb validé ! Jazakallahu Khayran'); loadMyHizbs() }
    setValidating(null)
  }

  async function validateAll() {
    const pending = assignments.filter(a => a.status === 'ASSIGNED')
    for (const a of pending) {
      await supabase.from('hizb_assignment').update({ status: 'VALIDATED', validated_at: new Date().toISOString(), validated_via: 'WEB' }).eq('id', a.id)
    }
    toast.success(`${pending.length} Hizb(s) validé(s) !`); loadMyHizbs()
  }

  useEffect(() => { loadMyHizbs() }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  const pending = assignments.filter(a => a.status === 'ASSIGNED')
  const validated = assignments.filter(a => a.status === 'VALIDATED')
  const cycle = assignments[0]?.cycle

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Mes lectures</h1>
      {cycle && <p className="text-sm text-gray-500 mb-6">Cycle {cycle.cycle_number} · {cycle.week_label}</p>}

      {assignments.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-gray-500">Aucun Hizb attribué pour cette semaine</p>
        </div>
      ) : (
        <>
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Ma progression</span>
              <span className="text-sm font-bold text-brand-500">{validated.length}/{assignments.length}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${(validated.length / assignments.length) * 100}%` }} />
            </div>
          </div>

          {pending.length > 1 && <button onClick={validateAll} className="btn-primary w-full mb-4">Tout valider ({pending.length} Hizbs)</button>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assignments.map(a => {
              const ref = getHizbRef(a.hizb_number)
              return (
                <div key={a.id} className={`card p-4 transition-all ${a.status === 'VALIDATED' ? 'bg-green-50 border-green-200' : a.is_carryover ? 'bg-amber-50 border-amber-200' : 'hover:shadow-md'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${a.status === 'VALIDATED' ? 'bg-green-100 text-green-600' : 'bg-brand-100 text-brand-700'}`}>
                      {a.hizb_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      {ref && (
                        <>
                          <div className="text-right text-base leading-relaxed mb-1" dir="rtl" lang="ar" style={{ fontFamily: 'serif' }}>{ref.arabic}</div>
                          <div className="text-xs text-gray-500">{ref.verses}</div>
                        </>
                      )}
                      {!ref && <div className="text-sm text-gray-500">Hizb {a.hizb_number}</div>}
                      {a.is_carryover && <span className="text-[10px] text-amber-600 font-medium">↻ Reliquat</span>}
                    </div>
                  </div>
                  <div className="mt-3">
                    {a.status === 'VALIDATED' ? (
                      <div className="text-xs text-green-600 font-medium text-center">✅ Validé</div>
                    ) : (
                      <button onClick={() => validateHizb(a.id)} disabled={validating === a.id} className="btn-primary text-xs py-1.5 w-full">
                        {validating === a.id ? '...' : 'J\'ai lu ce Hizb — Valider ✓'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
