'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { STATUS_LABELS, ROLE_LABELS, type MemberStatus, type MemberRole } from '@/lib/types'
import { formatCFA, getAncienneteLabel } from '@/lib/utils'

export default function ProfilPage() {
  const [me, setMe] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState(false)
  const [stats, setStats] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase.from('member').select('*').eq('auth_user_id', user.id).single()
      if (!member) return
      setMe(member); setForm(member)

      const year = new Date().getFullYear()
      const { data: contribs } = await supabase.from('contribution').select('*').eq('member_id', member.id).eq('year', year)
      const paid = contribs?.filter(c => c.status === 'PAID').length || 0
      const total = contribs?.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0) || 0
      const { count: hadithsApproved } = await supabase.from('hadith_submission').select('*', { count: 'exact', head: true }).eq('member_id', member.id).eq('status', 'APPROVED')
      const { count: hizbsValidated } = await supabase.from('hizb_assignment').select('*', { count: 'exact', head: true }).eq('member_id', member.id).eq('status', 'VALIDATED')
      setStats({ paid, total, hadithsApproved: hadithsApproved || 0, hizbsValidated: hizbsValidated || 0 })
    })()
  }, [])

  async function saveProfile() {
    setSaving(true)
    const updates = {
      first_name: form.first_name, last_name: form.last_name, gender: form.gender,
      phone: form.phone, whatsapp: form.whatsapp, email: form.email,
      profession: form.profession, address: form.address,
    }
    const { error } = await supabase.from('member').update(updates).eq('id', me.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Profil mis à jour')
    setMe({ ...me, ...updates }); setEditing(false)
  }

  if (!me) return <div className="text-center py-12 text-gray-400">Chargement...</div>

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Mon profil</h1>

      {/* Carte profil */}
      <div className="card p-5 mb-4">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-xl flex-shrink-0">
            {me.first_name[0]}{me.last_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg">{me.first_name} {me.last_name}</h2>
            <p className="text-sm text-gray-500">{me.profession || 'Profession non renseignée'}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700">{STATUS_LABELS[me.status as MemberStatus] || me.status}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">{ROLE_LABELS[me.role as MemberRole] || me.role}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">{getAncienneteLabel(me.anciennete_mois)}</span>
            </div>
          </div>
          {!editing && <button onClick={() => setEditing(true)} className="btn-primary text-sm">Modifier</button>}
        </div>
      </div>

      {/* Statistiques personnelles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="card p-3 bg-green-50 text-center"><div className="text-lg font-bold text-green-700">{stats.paid}/12</div><div className="text-[10px] text-green-600">Cotisations payées</div></div>
        <div className="card p-3 bg-amber-50 text-center"><div className="text-lg font-bold text-amber-700">{formatCFA(stats.total)}</div><div className="text-[10px] text-amber-600">Total cotisé {new Date().getFullYear()}</div></div>
        <div className="card p-3 bg-purple-50 text-center"><div className="text-lg font-bold text-purple-700">{stats.hadithsApproved}/63</div><div className="text-[10px] text-purple-600">Hadiths validés</div></div>
        <div className="card p-3 bg-blue-50 text-center"><div className="text-lg font-bold text-blue-700">{stats.hizbsValidated}</div><div className="text-[10px] text-blue-600">Hizbs lus</div></div>
      </div>

      {/* Informations personnelles */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm mb-4">Informations personnelles</h3>
        {editing ? (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className="text-xs text-gray-500">Prénom</label><input className="input" value={form.first_name || ''} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
              <div><label className="text-xs text-gray-500">Nom</label><input className="input" value={form.last_name || ''} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
              <div><label className="text-xs text-gray-500">Genre</label><select className="input" value={form.gender || 'M'} onChange={e => setForm({...form, gender: e.target.value})}><option value="M">Homme</option><option value="F">Femme</option></select></div>
              <div><label className="text-xs text-gray-500">Profession</label><input className="input" value={form.profession || ''} onChange={e => setForm({...form, profession: e.target.value})} placeholder="Ex: Ingénieur, Enseignant..." /></div>
              <div><label className="text-xs text-gray-500">Téléphone</label><input className="input" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+221..." /></div>
              <div><label className="text-xs text-gray-500">WhatsApp</label><input className="input" value={form.whatsapp || ''} onChange={e => setForm({...form, whatsapp: e.target.value})} placeholder="+221..." /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Email</label><input type="email" className="input" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Adresse</label><textarea className="input" rows={2} value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm">{saving ? 'Sauvegarde...' : 'Enregistrer'}</button>
              <button onClick={() => { setForm(me); setEditing(false) }} className="btn-secondary text-sm">Annuler</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-gray-500">Téléphone</div><div className="font-medium">{me.phone || '—'}</div></div>
            <div><div className="text-xs text-gray-500">WhatsApp</div><div className="font-medium">{me.whatsapp || '—'}</div></div>
            <div className="col-span-2"><div className="text-xs text-gray-500">Email</div><div className="font-medium break-all">{me.email || '—'}</div></div>
            <div><div className="text-xs text-gray-500">Profession</div><div className="font-medium">{me.profession || '—'}</div></div>
            <div><div className="text-xs text-gray-500">Genre</div><div className="font-medium">{me.gender === 'M' ? 'Homme' : me.gender === 'F' ? 'Femme' : '—'}</div></div>
            <div className="col-span-2"><div className="text-xs text-gray-500">Adresse</div><div className="font-medium">{me.address || '—'}</div></div>
            <div><div className="text-xs text-gray-500">Date d'adhésion</div><div className="font-medium">{me.membership_date ? new Date(me.membership_date).toLocaleDateString('fr-FR') : '—'}</div></div>
            <div><div className="text-xs text-gray-500">Ancienneté</div><div className="font-medium">{getAncienneteLabel(me.anciennete_mois)}</div></div>
          </div>
        )}
      </div>
    </div>
  )
}
