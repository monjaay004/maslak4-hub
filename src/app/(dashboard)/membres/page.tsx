import { createServerSupabase } from '@/lib/supabase/server'
import { STATUS_LABELS, type MemberStatus } from '@/lib/types'
import { getInitials, getAncienneteLabel } from '@/lib/utils'
import Link from 'next/link'

export default async function MembresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerSupabase()

  let query = supabase
    .from('member')
    .select('*')
    .order('last_name')

  if (params.status) {
    query = query.eq('status', params.status)
  }

  if (params.q) {
    query = query.or(
      `first_name.ilike.%${params.q}%,last_name.ilike.%${params.q}%,phone.ilike.%${params.q}%,profession.ilike.%${params.q}%`
    )
  }

  const { data: members, error } = await query

  const statusCounts: Record<string, number> = {}
  members?.forEach(m => {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Membres</h1>
        <span className="badge badge-green">{members?.length || 0}</span>
      </div>

      {/* Recherche */}
      <form className="mb-4">
        <input
          type="search"
          name="q"
          className="input"
          placeholder="Rechercher un membre..."
          defaultValue={params.q}
        />
      </form>

      {/* Filtres par statut */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <Link
          href="/membres"
          className={`badge whitespace-nowrap ${!params.status ? 'badge-green' : 'badge-gray'}`}
        >
          Tous ({members?.length})
        </Link>
        {Object.entries(STATUS_LABELS).map(([key, label]) => {
          const count = statusCounts[key] || 0
          if (count === 0) return null
          return (
            <Link
              key={key}
              href={`/membres?status=${key}`}
              className={`badge whitespace-nowrap ${params.status === key ? 'badge-green' : 'badge-gray'}`}
            >
              {label} ({count})
            </Link>
          )
        })}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {members?.map(member => (
          <Link
            key={member.id}
            href={`/membres/${member.id}`}
            className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow block"
          >
            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
              {getInitials(member.first_name, member.last_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {member.first_name} {member.last_name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {member.profession || 'Non renseigné'} · {getAncienneteLabel(member.anciennete_mois)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`badge text-[10px] ${
                member.status === 'AC' ? 'badge-green' :
                member.status === 'HC' ? 'badge-blue' :
                member.status === 'I' ? 'badge-gray' : 'badge-amber'
              }`}>
                {member.status}
              </span>
              {member.is_eligible_quran && (
                <span className="text-[10px] text-green-600">Coran ✓</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {(!members || members.length === 0) && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Aucun membre trouvé
        </div>
      )}
    </div>
  )
}
