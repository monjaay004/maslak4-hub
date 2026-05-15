'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS, type MemberStatus } from '@/lib/types'

export default function MembresPage() {
  const [members, setMembers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: me } = await supabase.from('member').select('tenant_id').eq('auth_user_id', user.id).single()
      if (!me) return
      const { data } = await supabase.from('member').select('*').eq('tenant_id', me.tenant_id).neq('status', 'I').order('last_name')
      setMembers(data || [])
    })()
  }, [])

  const filtered = members.filter(m =>
    `${m.first_name} ${m.last_name} ${m.profession || ''} ${m.phone || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Annuaire des membres</h1>
      <p className="text-sm text-gray-500 mb-4">{members.length} membres actifs · Cliquez sur un membre pour voir son profil</p>

      <input type="search" className="input mb-4" placeholder="🔍 Rechercher par nom, profession, téléphone..."
        value={search} onChange={e => setSearch(e.target.value)} />

      <div className="space-y-1">
        {filtered.map(m => (
          <Link key={m.id} href={`/membres/${m.id}`} className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
              {m.first_name[0]}{m.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{m.first_name} {m.last_name}</div>
              <div className="text-xs text-gray-500 truncate">{m.profession || '—'}</div>
            </div>
            <div className="text-right flex-shrink-0">
              {m.phone && <div className="text-xs text-gray-600">{m.phone}</div>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.status==='AC'?'bg-green-100 text-green-700':m.status==='HC'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>{STATUS_LABELS[m.status as MemberStatus] || m.status}</span>
            </div>
            {m.whatsapp && (
              <a href={`https://wa.me/${m.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener"
                onClick={e => e.stopPropagation()}
                className="text-green-600 hover:text-green-700 flex-shrink-0" title="Contacter sur WhatsApp">💬</a>
            )}
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          {search ? 'Aucun membre trouvé' : 'Aucun membre dans l\'annuaire'}
        </div>
      )}
    </div>
  )
}
