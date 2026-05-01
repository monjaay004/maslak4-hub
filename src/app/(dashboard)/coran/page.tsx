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
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState<string | null>(null)
  const supabase = createClient()

  async function loadMyHizbs() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: member } = await supabase
      .from('member')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!member) return

    const { data } = await supabase
      .from('hizb_assignment')
      .select('*, cycle:reading_cycle!inner(cycle_number, week_label, ends_at)')
      .eq('member_id', member.id)
      .eq('reading_cycle.status', 'ACTIVE')
      .order('hizb_number')

    setAssignments(data || [])
    setLoading(false)
  }

  async function validateHizb(assignmentId: string) {
    setValidating(assignmentId)

    const { error } = await supabase
      .from('hizb_assignment')
      .update({
        status: 'VALIDATED',
        validated_at: new Date().toISOString(),
        validated_via: 'WEB',
      })
      .eq('id', assignmentId)

    if (error) {
      toast.error('Erreur lors de la validation')
    } else {
      toast.success('Hizb validé ! Jazakallahu Khayran')
      loadMyHizbs()
    }
    setValidating(null)
  }

  async function validateAll() {
    const pending = assignments.filter(a => a.status === 'ASSIGNED')
    for (const a of pending) {
      await supabase
        .from('hizb_assignment')
        .update({
          status: 'VALIDATED',
          validated_at: new Date().toISOString(),
          validated_via: 'WEB',
        })
        .eq('id', a.id)
    }
    toast.success(`${pending.length} Hizb(s) validé(s) ! Jazakallahu Khayran`)
    loadMyHizbs()
  }

  useEffect(() => { loadMyHizbs() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pending = assignments.filter(a => a.status === 'ASSIGNED')
  const validated = assignments.filter(a => a.status === 'VALIDATED')
  const cycle = assignments[0]?.cycle

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Mes lectures</h1>
      {cycle && (
        <p className="text-sm text-gray-500 mb-6">
          Cycle {cycle.cycle_number} · {cycle.week_label}
        </p>
      )}

      {assignments.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-gray-500">Aucun Hizb attribué pour cette semaine</p>
        </div>
      ) : (
        <>
          {/* Progression */}
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Ma progression
              </span>
              <span className="text-sm font-bold text-brand-500">
                {validated.length}/{assignments.length}
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-700"
                style={{ width: `${(validated.length / assignments.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Bouton tout valider */}
          {pending.length > 1 && (
            <button onClick={validateAll} className="btn-primary w-full mb-4">
              Tout valider ({pending.length} Hizbs)
            </button>
          )}

          {/* Liste des Hizbs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {assignments.map(a => (
              <div
                key={a.id}
                className={`card p-4 text-center transition-all ${
                  a.status === 'VALIDATED'
                    ? 'bg-green-50 border-green-200'
                    : a.is_carryover
                      ? 'bg-amber-50 border-amber-200'
                      : 'hover:shadow-md'
                }`}
              >
                <div className={`text-3xl font-bold mb-1 ${
                  a.status === 'VALIDATED' ? 'text-green-600' :
                  a.is_carryover ? 'text-amber-600' : 'text-gray-800'
                }`}>
                  {a.hizb_number}
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  Hizb {a.hizb_number}
                  {a.is_carryover && <span className="text-amber-500 ml-1">(reliquat)</span>}
                </div>

                {a.status === 'VALIDATED' ? (
                  <div className="text-xs text-green-600 font-medium">
                    Validé ✓
                  </div>
                ) : (
                  <button
                    onClick={() => validateHizb(a.id)}
                    disabled={validating === a.id}
                    className="btn-primary text-xs py-1.5 px-4 w-full"
                  >
                    {validating === a.id ? '...' : 'Valider'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
