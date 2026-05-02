import { createServerSupabase } from '@/lib/supabase/server'
import { STATUS_LABELS, ROLE_LABELS, MONTHS_FR, type MemberStatus, type MemberRole } from '@/lib/types'
import { formatDate, formatCFA, getAncienneteLabel, formatPhone } from '@/lib/utils'
import Link from 'next/link'

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: member } = await supabase
    .from('member')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) return <div className="text-center py-12 text-gray-400">Membre introuvable</div>

  // Cotisations de l'année
  const currentYear = new Date().getFullYear()
  const { data: contributions } = await supabase
    .from('contribution')
    .select('*')
    .eq('member_id', id)
    .eq('year', currentYear)
    .order('month')

  // Hizbs récents
  const { data: recentHizbs } = await supabase
    .from('hizb_assignment')
    .select('*, reading_cycle(*)')
    .eq('member_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const validated = recentHizbs?.filter(h => h.status === 'VALIDATED').length || 0
  const total = recentHizbs?.length || 0

  return (
    <div>
      <Link href="/membres" className="text-sm text-gray-400 hover:text-gray-600 mb-4 block">
        ← Retour à la liste
      </Link>

      {/* Profil */}
      <div className="card p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-xl flex-shrink-0">
            {member.first_name[0]}{member.last_name[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">
              {member.first_name} {member.last_name}
            </h1>
            <p className="text-sm text-gray-500">{member.profession || '—'}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="badge badge-green">{STATUS_LABELS[member.status as MemberStatus]}</span>
              <span className="badge badge-blue">{ROLE_LABELS[member.role as MemberRole]}</span>
              {member.is_eligible_quran && <span className="badge badge-green">Coran ✓</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
          <div>
            <span className="text-gray-400 text-xs block">Téléphone</span>
            <span>{member.phone ? formatPhone(member.phone) : '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 text-xs block">WhatsApp</span>
            <span>{member.whatsapp ? formatPhone(member.whatsapp) : '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 text-xs block">Adresse</span>
            <span>{member.address || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 text-xs block">Adhésion</span>
            <span>{formatDate(member.membership_date)}</span>
          </div>
          <div>
            <span className="text-gray-400 text-xs block">Ancienneté</span>
            <span>{getAncienneteLabel(member.anciennete_mois)}</span>
          </div>
          <div>
            <span className="text-gray-400 text-xs block">Genre</span>
            <span>{member.gender === 'M' ? 'Homme' : member.gender === 'F' ? 'Femme' : '—'}</span>
          </div>
        </div>
      </div>

      {/* Cotisations de l'année */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold text-sm text-gray-700 mb-3">
          Cotisations {currentYear}
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => {
            const contrib = contributions?.find(c => c.month === i + 1)
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
      </div>

      {/* Historique Hizbs */}
      <div className="card p-4">
        <h2 className="font-semibold text-sm text-gray-700 mb-3">
          Historique lectures ({validated}/{total} validés)
        </h2>
        {recentHizbs && recentHizbs.length > 0 ? (
          <div className="space-y-1.5">
            {recentHizbs.map(h => (
              <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-sm">
                <span>
                  Hizb <strong>{h.hizb_number}</strong>
                  {h.is_carryover && <span className="text-amber-500 text-xs ml-1">(reliquat)</span>}
                </span>
                <span className={
                  h.status === 'VALIDATED' ? 'text-green-600 text-xs' :
                  h.status === 'EXPIRED' ? 'text-red-500 text-xs' : 'text-gray-400 text-xs'
                }>
                  {h.status === 'VALIDATED' ? 'Validé' :
                   h.status === 'EXPIRED' ? 'Expiré' : 'En cours'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Aucun historique</p>
        )}
      </div>
    </div>
  )
}
