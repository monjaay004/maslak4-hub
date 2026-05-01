'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function AdminPage() {
  const [activeCycle, setActiveCycle] = useState<any>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [eligibleCount, setEligibleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [mode, setMode] = useState('SEQUENTIAL')
  const supabase = createClient()

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: me } = await supabase
      .from('member')
      .select('tenant_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!me || !['admin', 'super_admin'].includes(me.role)) return

    // Cycle actif
    const { data: cycle } = await supabase
      .from('v_active_cycle_progress')
      .select('*')
      .eq('tenant_id', me.tenant_id)
      .single()
    setActiveCycle(cycle)

    // Compteurs
    const { count: total } = await supabase
      .from('member')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', me.tenant_id)
    setMemberCount(total || 0)

    const { count: eligible } = await supabase
      .from('member')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', me.tenant_id)
      .eq('is_eligible_quran', true)
      .in('status', ['AC', 'HC'])
    setEligibleCount(eligible || 0)

    setLoading(false)
  }

  async function createNewCycle() {
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = await supabase
      .from('member')
      .select('id, tenant_id')
      .eq('auth_user_id', user!.id)
      .single()

    if (!me) return

    // Trouver le dernier cycle
    const { data: lastCycle } = await supabase
      .from('reading_cycle')
      .select('cycle_number')
      .eq('tenant_id', me.tenant_id)
      .order('cycle_number', { ascending: false })
      .limit(1)
      .single()

    const nextNumber = (lastCycle?.cycle_number || 0) + 1
    const now = new Date()

    // Créer le cycle
    const { data: newCycle, error } = await supabase
      .from('reading_cycle')
      .insert({
        tenant_id: me.tenant_id,
        cycle_number: nextNumber,
        week_label: `Semaine ${getWeekNum(now)} — ${now.getFullYear()}`,
        distribution_mode: mode,
        starts_at: now.toISOString(),
        ends_at: new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString(),
        status: 'ACTIVE',
        created_by: me.id,
      })
      .select()
      .single()

    if (error) {
      toast.error('Erreur : ' + error.message)
      setCreating(false)
      return
    }

    // Distribuer les 60 Hizbs
    const { data: members } = await supabase
      .from('member')
      .select('id')
      .eq('tenant_id', me.tenant_id)
      .eq('is_eligible_quran', true)
      .in('status', ['AC', 'HC'])
      .order('membership_date')

    if (!members || members.length === 0) {
      toast.error('Aucun membre éligible')
      setCreating(false)
      return
    }

    const hizbs = Array.from({ length: 60 }, (_, i) => i + 1)

    // Mélanger si mode aléatoire
    if (mode === 'RANDOM_BALANCED') {
      for (let i = hizbs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hizbs[i], hizbs[j]] = [hizbs[j], hizbs[i]]
      }
    }

    const assignments = hizbs.map((hizb, i) => ({
      tenant_id: me.tenant_id,
      cycle_id: newCycle.id,
      member_id: members[i % members.length].id,
      hizb_number: hizb,
      is_carryover: false,
      status: 'ASSIGNED',
    }))

    const { error: assignError } = await supabase
      .from('hizb_assignment')
      .insert(assignments)

    if (assignError) {
      toast.error('Erreur distribution : ' + assignError.message)
    } else {
      toast.success(`Cycle ${nextNumber} créé ! ${assignments.length} Hizbs distribués à ${members.length} membres.`)
    }

    setCreating(false)
    loadData()
  }

  useEffect(() => { loadData() }, [])

  if (loading) {
    return <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Administration</h1>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold">{memberCount}</div>
          <div className="text-xs text-gray-500">Membres</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-brand-500">{eligibleCount}</div>
          <div className="text-xs text-gray-500">Éligibles Coran</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold">{activeCycle?.cycle_number || '—'}</div>
          <div className="text-xs text-gray-500">Cycle actif</div>
        </div>
      </div>

      {/* Cycle actif */}
      {activeCycle ? (
        <section className="card p-4 mb-6">
          <h2 className="font-semibold text-sm text-gray-700 mb-3">
            Cycle {activeCycle.cycle_number} en cours
          </h2>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${activeCycle.progress_pct || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{activeCycle.total_validated}/{activeCycle.total_hizbs} validés</span>
            <span>{activeCycle.total_pending} en attente</span>
            {activeCycle.total_carryovers > 0 && (
              <span className="text-amber-500">{activeCycle.total_carryovers} reliquats</span>
            )}
          </div>
        </section>
      ) : (
        <section className="card p-5 mb-6">
          <h2 className="font-semibold mb-3">Créer un nouveau cycle</h2>
          <p className="text-sm text-gray-500 mb-4">
            Aucun cycle actif. Choisissez un mode de distribution et lancez un cycle.
          </p>

          <div className="space-y-2 mb-4">
            {[
              { value: 'SEQUENTIAL', label: 'Rotation séquentielle', desc: 'Hizb 1→60, chaque membre reçoit à tour de rôle' },
              { value: 'RANDOM_BALANCED', label: 'Aléatoire équilibré', desc: 'Distribution aléatoire, évite les répétitions' },
              { value: 'MANUAL', label: 'Manuel', desc: 'Vous attribuez chaque Hizb manuellement' },
            ].map(opt => (
              <label key={opt.value}
                className={`block p-3 rounded-lg border cursor-pointer transition-all ${
                  mode === opt.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio" name="mode" value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="sr-only"
                />
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </label>
            ))}
          </div>

          <button
            onClick={createNewCycle}
            disabled={creating}
            className="btn-primary w-full"
          >
            {creating ? 'Création en cours...' : `Lancer le cycle (${eligibleCount} membres éligibles)`}
          </button>
        </section>
      )}
    </div>
  )
}

function getWeekNum(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
}
