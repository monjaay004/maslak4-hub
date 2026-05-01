import { createServerSupabase } from '@/lib/supabase/server'
import { MONTHS_FR } from '@/lib/types'
import { formatCFA } from '@/lib/utils'

export default async function FinancePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: me } = await supabase
    .from('member')
    .select('*')
    .eq('auth_user_id', user!.id)
    .single()

  if (!me) return null

  const isAdmin = ['admin', 'super_admin', 'treasurer'].includes(me.role)
  const currentYear = new Date().getFullYear()

  // Mes cotisations
  const { data: myContribs } = await supabase
    .from('contribution')
    .select('*')
    .eq('member_id', me.id)
    .eq('year', currentYear)
    .order('month')

  const paid = myContribs?.filter(c => c.status === 'PAID') || []
  const totalPaid = paid.reduce((s, c) => s + Number(c.amount), 0)

  // Stats admin
  let stats = null
  if (isAdmin) {
    const { data: allContribs } = await supabase
      .from('contribution')
      .select('status, amount')
      .eq('tenant_id', me.tenant_id)
      .eq('year', currentYear)

    const { data: donations } = await supabase
      .from('donation')
      .select('amount')
      .eq('tenant_id', me.tenant_id)

    const { data: socialFund } = await supabase
      .from('social_fund')
      .select('type, amount')
      .eq('tenant_id', me.tenant_id)

    stats = {
      totalCotisations: allContribs
        ?.filter(c => c.status === 'PAID')
        .reduce((s, c) => s + Number(c.amount), 0) || 0,
      totalDonations: donations?.reduce((s, d) => s + Number(d.amount), 0) || 0,
      fondsIn: socialFund
        ?.filter(s => s.type === 'IN')
        .reduce((s, f) => s + Number(f.amount), 0) || 0,
      fondsOut: socialFund
        ?.filter(s => s.type === 'OUT')
        .reduce((s, f) => s + Number(f.amount), 0) || 0,
      retards: allContribs?.filter(c => c.status === 'LATE' || c.status === 'PENDING').length || 0,
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Finance</h1>

      {/* Mes cotisations */}
      <section className="card p-4 mb-4">
        <h2 className="font-semibold text-sm text-gray-700 mb-3">
          Mes cotisations {currentYear}
        </h2>
        <div className="flex items-center gap-4 mb-4">
          <div>
            <div className="text-2xl font-bold text-brand-500">{formatCFA(totalPaid)}</div>
            <div className="text-xs text-gray-500">{paid.length} mois payés</div>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => {
            const contrib = myContribs?.find(c => c.month === i + 1)
            const status = contrib?.status || 'PENDING'
            const past = i + 1 <= new Date().getMonth() + 1
            return (
              <div
                key={i}
                className={`rounded-lg p-2 text-center text-xs border ${
                  status === 'PAID' ? 'bg-green-50 border-green-200 text-green-700' :
                  status === 'EXEMPT' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                  past ? 'bg-red-50 border-red-200 text-red-600' :
                  'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                <div className="font-medium">{MONTHS_FR[i].slice(0, 3)}</div>
                <div className="text-[10px] mt-0.5">
                  {status === 'PAID' ? 'Payé' :
                   status === 'EXEMPT' ? 'Exon.' :
                   past ? 'Retard' : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Dashboard Admin Finance */}
      {isAdmin && stats && (
        <section className="card p-4 border-l-4 border-l-gold-500">
          <h2 className="font-semibold text-sm text-gray-700 mb-4">Trésorerie globale</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-700">{formatCFA(stats.totalCotisations)}</div>
              <div className="text-xs text-green-600">Cotisations {currentYear}</div>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <div className="text-lg font-bold text-amber-700">{formatCFA(stats.totalDonations)}</div>
              <div className="text-xs text-amber-600">Dons (Hadya)</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-700">{formatCFA(stats.fondsIn - stats.fondsOut)}</div>
              <div className="text-xs text-blue-600">Solde fonds social</div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-bold text-red-700">{stats.retards}</div>
              <div className="text-xs text-red-600">Cotisations en retard</div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
