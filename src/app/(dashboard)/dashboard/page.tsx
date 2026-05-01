import { createServerSupabase } from '@/lib/supabase/server'
import { formatCFA, getAncienneteLabel } from '@/lib/utils'
import { STATUS_LABELS } from '@/lib/types'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase
    .from('member')
    .select('*')
    .eq('auth_user_id', user!.id)
    .single()

  if (!me) return null

  const isAdmin = ['admin', 'super_admin'].includes(me.role)

  // Mes Hizbs en cours
  const { data: myHizbs } = await supabase
    .from('hizb_assignment')
    .select('*, reading_cycle!inner(*)')
    .eq('member_id', me.id)
    .eq('reading_cycle.status', 'ACTIVE')
    .order('hizb_number')

  // Mes cotisations de l'année
  const currentYear = new Date().getFullYear()
  const { data: myContribs } = await supabase
    .from('contribution')
    .select('*')
    .eq('member_id', me.id)
    .eq('year', currentYear)
    .order('month')

  const paidMonths = myContribs?.filter(c => c.status === 'PAID').length || 0
  const currentMonth = new Date().getMonth() + 1

  // Stats admin
  let memberCount = 0
  let activeCycle = null
  if (isAdmin) {
    const { count } = await supabase
      .from('member')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', me.tenant_id)

    memberCount = count || 0

    const { data } = await supabase
      .from('v_active_cycle_progress')
      .select('*')
      .eq('tenant_id', me.tenant_id)
      .single()

    activeCycle = data
  }

  // Progression Hadiths
  const { count: hadithsDone } = await supabase
    .from('hadith_submission')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', me.id)
    .eq('status', 'APPROVED')

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Salam, {me.first_name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {STATUS_LABELS[me.status]} · {getAncienneteLabel(me.anciennete_mois)}
        </p>
      </div>

      {/* Mes Hizbs */}
      <section className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-gray-700">Mes Hizbs cette semaine</h2>
          <Link href="/coran" className="text-xs text-brand-500 font-medium">
            Voir tout
          </Link>
        </div>

        {!myHizbs || myHizbs.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {me.is_eligible_quran
              ? 'Aucun Hizb attribué pour le moment'
              : `Éligible dans ${6 - me.anciennete_mois} mois`}
          </p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {myHizbs.map(h => (
              <HizbCard key={h.id} assignment={h} />
            ))}
          </div>
        )}
      </section>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-brand-500">
            {paidMonths}/{currentMonth}
          </div>
          <div className="text-xs text-gray-500 mt-1">Cotisations {currentYear}</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-brand-500">
            {hadithsDone || 0}/70
          </div>
          <div className="text-xs text-gray-500 mt-1">Hadiths validés</div>
        </div>
      </div>

      {/* Section Admin */}
      {isAdmin && (
        <section className="card p-4 mb-4 border-l-4 border-l-brand-500">
          <h2 className="font-semibold text-sm text-gray-700 mb-3">Tableau de bord Admin</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xl font-bold">{memberCount}</div>
              <div className="text-xs text-gray-500">Membres</div>
            </div>
            {activeCycle && (
              <>
                <div>
                  <div className="text-2xl font-bold text-brand-500">
                    {activeCycle.progress_pct || 0}%
                  </div>
                  <div className="text-xs text-gray-500">Cycle {activeCycle.cycle_number}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {activeCycle.total_validated}
                  </div>
                  <div className="text-xs text-gray-500">Hizbs validés</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-500">
                    {activeCycle.total_pending}
                  </div>
                  <div className="text-xs text-gray-500">En attente</div>
                </div>
              </>
            )}
          </div>

          {activeCycle && (
            <div className="mt-3">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{ width: `${activeCycle.progress_pct || 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {activeCycle.total_validated}/{activeCycle.total_hizbs} Hizbs ·
                {activeCycle.total_carryovers > 0 && ` ${activeCycle.total_carryovers} reliquats ·`}
                {' '}{activeCycle.distribution_mode}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function HizbCard({ assignment }: { assignment: any }) {
  const validated = assignment.status === 'VALIDATED'
  const carryover = assignment.is_carryover

  return (
    <div className={`
      rounded-lg p-3 text-center border transition-all
      ${validated
        ? 'bg-green-50 border-green-200 text-green-700'
        : carryover
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-white border-gray-200 text-gray-700 hover:border-brand-300 cursor-pointer'}
    `}>
      <div className="text-lg font-bold">{assignment.hizb_number}</div>
      <div className="text-[10px] mt-0.5">
        {validated ? 'Validé' : carryover ? 'Reliquat' : 'À lire'}
      </div>
    </div>
  )
}
