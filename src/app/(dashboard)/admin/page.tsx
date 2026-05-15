'use client'

import { useEffect, useState, useCallback, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { STATUS_LABELS, ROLE_LABELS, MONTHS_FR, type MemberStatus, type MemberRole } from '@/lib/types'
import { formatCFA, getAncienneteLabel } from '@/lib/utils'

type Tab = 'dashboard' | 'membres' | 'comptes' | 'coran' | 'cotisations' | 'dons' | 'fonds' | 'hadiths' | 'parametres'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('member').select('*').eq('auth_user_id', user.id).single()
      if (data && ['admin', 'super_admin'].includes(data.role)) setMe(data)
      setLoading(false)
    })()
  }, [])
  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!me) return <div className="text-center py-20 text-gray-400">Accès refusé</div>

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'membres', label: 'Membres', icon: '👥' },
    { key: 'comptes', label: 'Comptes', icon: '🔑' },
    { key: 'coran', label: 'Coran', icon: '📖' },
    { key: 'cotisations', label: 'Cotisations', icon: '💰' },
    { key: 'dons', label: 'Dons', icon: '🎁' },
    { key: 'fonds', label: 'Fonds Social', icon: '🤝' },
    { key: 'hadiths', label: '70 Hadiths', icon: '📜' },
    { key: 'parametres', label: 'Paramètres', icon: '⚙️' },
  ]
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Administration</h1>
      <div className="flex gap-1 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <AdminDashboard tenantId={me.tenant_id} />}
      {tab === 'membres' && <AdminMembres tenantId={me.tenant_id} />}
      {tab === 'comptes' && <AdminComptes tenantId={me.tenant_id} />}
      {tab === 'coran' && <AdminCoran tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'cotisations' && <AdminCotisations tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'dons' && <AdminDons tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'fonds' && <AdminFonds tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'hadiths' && <AdminHadiths tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'parametres' && <AdminParametres tenantId={me.tenant_id} />}
    </div>
  )
}

/* ========== DASHBOARD ========== */
function AdminDashboard({ tenantId }: { tenantId: string }) {
  const [s, setS] = useState<any>(null)
  const [notifs, setNotifs] = useState<any[]>([])
  const [toFollowUp, setToFollowUp] = useState<any[]>([])
  const [recentDonations, setRecentDonations] = useState<any[]>([])
  const supabase = createClient()
  useEffect(() => {
    (async () => {
      const { count: total } = await supabase.from('member').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      const { count: active } = await supabase.from('member').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'AC')
      const { count: eligible } = await supabase.from('member').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_eligible_quran', true)
      const y = new Date().getFullYear(); const m = new Date().getMonth() + 1
      const { data: co } = await supabase.from('contribution').select('amount,status').eq('tenant_id', tenantId).eq('year', y)
      const paid = co?.filter(c => c.status === 'PAID').reduce((a, c) => a + Number(c.amount), 0) || 0
      const paidCount = co?.filter(c => c.status === 'PAID').length || 0
      const { data: don } = await supabase.from('donation').select('amount').eq('tenant_id', tenantId)
      const totalDon = don?.reduce((a, d) => a + Number(d.amount), 0) || 0
      const { data: sf } = await supabase.from('social_fund').select('type,amount').eq('tenant_id', tenantId)
      const sfIn = sf?.filter(t => t.type === 'IN').reduce((a, t) => a + Number(t.amount), 0) || 0
      const sfOut = sf?.filter(t => t.type === 'OUT').reduce((a, t) => a + Number(t.amount), 0) || 0
      setS({ total, active, eligible, paid, paidCount, totalDon, sfBalance: sfIn - sfOut })

      // Membres à relancer (n'ont pas payé le mois en cours)
      const { data: actives } = await supabase.from('member').select('id, first_name, last_name, phone, whatsapp').eq('tenant_id', tenantId).in('status', ['AC', 'HC']).order('last_name')
      const { data: monthCo } = await supabase.from('contribution').select('member_id, status').eq('tenant_id', tenantId).eq('year', y).eq('month', m)
      const paidThisMonth = new Set(monthCo?.filter(c => c.status === 'PAID' || c.status === 'EXEMPT').map(c => c.member_id) || [])
      const followUp = actives?.filter(m => !paidThisMonth.has(m.id)).slice(0, 10) || []
      setToFollowUp(followUp)

      // Derniers dons reçus
      const { data: lastDons } = await supabase.from('donation').select('*, member(first_name, last_name)').eq('tenant_id', tenantId).order('received_at', { ascending: false }).limit(5)
      setRecentDonations(lastDons || [])

      // Notifications non lues
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: me } = await supabase.from('member').select('id').eq('auth_user_id', user.id).single()
        if (me) {
          const { data: n } = await supabase.from('notification').select('*').eq('member_id', me.id).is('read_at', null).order('created_at', { ascending: false }).limit(10)
          setNotifs(n || [])
        }
      }
    })()
  }, [])

  async function markRead(id: string) {
    await supabase.from('notification').update({ read_at: new Date().toISOString() }).eq('id', id)
    setNotifs(notifs.filter(n => n.id !== id))
  }
  async function markAllRead() {
    for (const n of notifs) { await supabase.from('notification').update({ read_at: new Date().toISOString() }).eq('id', n.id) }
    setNotifs([]); toast.success('Notifications marquées lues')
  }

  if (!s) return <p className="text-center py-8 text-gray-400">Chargement...</p>
  const currentMonth = MONTHS_FR[new Date().getMonth()]

  return (
    <div>
      {/* Notifications */}
      {notifs.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-amber-600">🔔 Notifications ({notifs.length})</h3>
            <button onClick={markAllRead} className="text-xs text-brand-500 hover:underline">Tout marquer lu</button>
          </div>
          <div className="space-y-2">{notifs.map(n => (
            <div key={n.id} className="card p-3 border-l-4 border-l-amber-400 flex items-start gap-3">
              <div className="flex-1"><div className="font-medium text-sm">{n.title}</div><div className="text-xs text-gray-500">{n.body}</div><div className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('fr-FR')}</div></div>
              <button onClick={() => markRead(n.id)} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
            </div>
          ))}</div>
        </div>
      )}

      {/* KPIs principaux */}
      <h3 className="font-semibold text-sm mb-2 text-gray-700">Indicateurs clés</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="card p-4 bg-blue-50 text-blue-700"><div className="text-2xl font-bold">{s.total || 0}</div><div className="text-xs mt-1 opacity-70">Membres total</div></div>
        <div className="card p-4 bg-green-50 text-green-700"><div className="text-2xl font-bold">{s.active || 0}</div><div className="text-xs mt-1 opacity-70">Actifs cotisants</div></div>
        <div className="card p-4 bg-purple-50 text-purple-700"><div className="text-2xl font-bold">{s.eligible || 0}</div><div className="text-xs mt-1 opacity-70">Éligibles Coran</div></div>
        <div className="card p-4 bg-green-50 text-green-700"><div className="text-xl font-bold">{formatCFA(s.paid)}</div><div className="text-xs mt-1 opacity-70">Cotisations {new Date().getFullYear()}</div></div>
        <div className="card p-4 bg-amber-50 text-amber-700"><div className="text-xl font-bold">{formatCFA(s.totalDon)}</div><div className="text-xs mt-1 opacity-70">Dons totaux</div></div>
        <div className="card p-4 bg-blue-50 text-blue-700"><div className="text-xl font-bold">{formatCFA(s.sfBalance)}</div><div className="text-xs mt-1 opacity-70">Solde fonds social</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Membres à relancer */}
        <div>
          <h3 className="font-semibold text-sm mb-2 text-red-600">⚠️ À relancer pour {currentMonth} ({toFollowUp.length})</h3>
          {toFollowUp.length === 0 ? (
            <div className="card p-4 text-center text-sm text-green-600">✓ Tous les membres actifs ont payé ce mois</div>
          ) : (
            <div className="space-y-1">{toFollowUp.map(m => (
              <div key={m.id} className="card p-2 flex items-center gap-2 border-l-4 border-l-red-400">
                <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{m.first_name} {m.last_name}</div><div className="text-xs text-gray-500">{m.phone || m.whatsapp || '—'}</div></div>
                {m.whatsapp && <a href={`https://wa.me/${m.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Salam ${m.first_name}, petit rappel pour votre cotisation de ${currentMonth}. Barakallahou fik.`)}`} target="_blank" rel="noopener" className="text-xs text-green-600 hover:underline">WhatsApp</a>}
              </div>
            ))}</div>
          )}
        </div>

        {/* Derniers dons */}
        <div>
          <h3 className="font-semibold text-sm mb-2 text-amber-600">🎁 Derniers dons reçus</h3>
          {recentDonations.length === 0 ? (
            <div className="card p-4 text-center text-sm text-gray-400">Aucun don récent</div>
          ) : (
            <div className="space-y-1">{recentDonations.map(d => (
              <div key={d.id} className="card p-2 flex items-center gap-2 border-l-4 border-l-amber-400">
                <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{d.member ? `${d.member.first_name} ${d.member.last_name}` : 'Anonyme'}</div><div className="text-xs text-gray-500">{d.category} · {new Date(d.received_at).toLocaleDateString('fr-FR')}</div></div>
                <span className="font-bold text-amber-600 text-sm">{formatCFA(d.amount)}</span>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ========== MEMBRES avec filtres + archivage + import CSV ========== */
function AdminMembres({ tenantId }: { tenantId: string }) {
  const [members, setMembers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterRole, setFilterRole] = useState<string>('ALL')
  const [editing, setEditing] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<any>({})
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase.from('member').select('*').eq('tenant_id', tenantId).order('last_name')
    setMembers(data || [])
  }, [tenantId])
  useEffect(() => { load() }, [load])

  const filtered = members.filter(m => {
    if (filterStatus !== 'ALL' && m.status !== filterStatus) return false
    if (filterRole !== 'ALL' && m.role !== filterRole) return false
    return `${m.first_name} ${m.last_name} ${m.phone} ${m.profession}`.toLowerCase().includes(search.toLowerCase())
  })

  async function saveMember() {
    if (!form.first_name || !form.last_name) { toast.error('Nom et prénom requis'); return }
    if (editing) {
      const { error } = await supabase.from('member').update({ first_name: form.first_name, last_name: form.last_name, gender: form.gender, phone: form.phone, whatsapp: form.whatsapp, email: form.email, profession: form.profession, address: form.address, status: form.status, role: form.role, membership_date: form.membership_date }).eq('id', editing.id)
      if (error) toast.error(error.message); else { toast.success('Membre modifié'); setEditing(null); load() }
    } else {
      const { error } = await supabase.from('member').insert({ tenant_id: tenantId, first_name: form.first_name, last_name: form.last_name, gender: form.gender || 'M', phone: form.phone, whatsapp: form.whatsapp, email: form.email, profession: form.profession, address: form.address, status: form.status || 'AC', role: form.role || 'member', membership_date: form.membership_date || new Date().toISOString().split('T')[0] })
      if (error) toast.error(error.message); else { toast.success('Membre ajouté'); setAdding(false); setForm({}); load() }
    }
  }

  async function archiveMember(id: string, name: string) {
    if (!confirm(`Archiver ${name} ? Le membre sera marqué Inactif.`)) return
    const { error } = await supabase.from('member').update({ status: 'I' }).eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Membre archivé'); load() }
  }

  function startEdit(m: any) { setEditing(m); setAdding(false); setForm({ ...m }) }
  function startAdd() { setAdding(true); setEditing(null); setForm({ gender: 'M', status: 'AC', role: 'member', membership_date: new Date().toISOString().split('T')[0] }) }

  function exportCSV() {
    const rows = [['Prénom','Nom','Genre','Statut','Téléphone','WhatsApp','Email','Profession','Adresse','Rôle','Adhésion'].join(';')]
    members.forEach(m => rows.push([m.first_name,m.last_name,m.gender||'',m.status,m.phone||'',m.whatsapp||'',m.email||'',m.profession||'',m.address||'',m.role,m.membership_date].join(';')))
    const blob = new Blob(['\ufeff'+rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `membres_maslak4_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    toast.success('Export CSV téléchargé')
  }

  async function handleFileImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setImporting(true)
    try {
      const text = await file.text(); const lines = text.split(/\r?\n/).filter(l => l.trim())
      const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
      const colMap: Record<string, number> = {}
      headers.forEach((h, i) => {
        if (h.includes('prénom') || h.includes('prenom') || h.includes('first')) colMap.first_name = i
        else if (h.includes('nom') || h.includes('last') || h.includes('name')) colMap.last_name = i
        else if (h.includes('genre') || h.includes('sexe')) colMap.gender = i
        else if (h.includes('statut') || h.includes('status')) colMap.status = i
        else if (h.includes('whatsapp')) colMap.whatsapp = i
        else if (h.includes('tel') || h.includes('phone') || h.includes('téléphone')) colMap.phone = i
        else if (h.includes('email') || h.includes('mail')) colMap.email = i
        else if (h.includes('profession') || h.includes('métier')) colMap.profession = i
        else if (h.includes('adresse') || h.includes('address')) colMap.address = i
      })
      if (!colMap.first_name && !colMap.last_name) { colMap.first_name = 0; colMap.last_name = 1; if (headers.length >= 3) colMap.phone = 2; if (headers.length >= 4) colMap.profession = 3 }
      const rows: any[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
        const fn = cols[colMap.first_name] || '', ln = cols[colMap.last_name] || ''
        if (!fn && !ln) continue
        rows.push({ first_name: fn, last_name: ln, gender: cols[colMap.gender] || 'M', status: cols[colMap.status] || 'AC', phone: cols[colMap.phone] || '', whatsapp: cols[colMap.whatsapp] || cols[colMap.phone] || '', email: cols[colMap.email] || '', profession: cols[colMap.profession] || '', address: cols[colMap.address] || '', role: 'member', membership_date: new Date().toISOString().split('T')[0] })
      }
      setImportPreview(rows); toast.success(`${rows.length} membres détectés`)
    } catch (err: any) { toast.error('Erreur: ' + err.message) }
    setImporting(false); e.target.value = ''
  }

  async function confirmImport() {
    setImporting(true); let ok = 0, err = 0
    for (const m of importPreview) {
      const { error } = await supabase.from('member').insert({ tenant_id: tenantId, ...m, gender: ['M','F'].includes(m.gender?.toUpperCase()) ? m.gender.toUpperCase() : 'M', status: Object.keys(STATUS_LABELS).includes(m.status?.toUpperCase()) ? m.status.toUpperCase() : 'AC' })
      if (error) err++; else ok++
    }
    toast.success(`${ok} importés${err ? `, ${err} erreurs` : ''}`); setImportPreview([]); setImporting(false); load()
  }

  const showForm = adding || editing
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input type="search" className="input flex-1 min-w-[180px]" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-auto text-xs" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="ALL">Tous rôles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={startAdd} className="btn-primary text-sm">+ Ajouter</button>
        <label className="btn-secondary text-sm cursor-pointer">Importer CSV<input type="file" accept=".csv,.txt,.tsv" onChange={handleFileImport} className="hidden" /></label>
        <button onClick={exportCSV} className="btn-secondary text-sm">Exporter CSV</button>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length}/{members.length} membres</span>
      </div>
      {importPreview.length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-l-blue-500">
          <h3 className="font-semibold text-sm mb-2">Aperçu ({importPreview.length} membres)</h3>
          <div className="max-h-48 overflow-auto text-xs mb-3"><table className="w-full"><thead><tr className="text-left text-gray-500 border-b"><th className="pb-1">Prénom</th><th>Nom</th><th>Tél.</th><th>Statut</th><th>Profession</th></tr></thead><tbody>
            {importPreview.slice(0, 20).map((m, i) => <tr key={i} className="border-b border-gray-50"><td className="py-1">{m.first_name}</td><td>{m.last_name}</td><td>{m.phone}</td><td>{m.status}</td><td>{m.profession}</td></tr>)}
            {importPreview.length > 20 && <tr><td colSpan={5} className="py-1 text-gray-400">... et {importPreview.length - 20} autres</td></tr>}
          </tbody></table></div>
          <div className="flex gap-2"><button onClick={confirmImport} disabled={importing} className="btn-primary text-sm">{importing ? 'Import...' : `Confirmer (${importPreview.length})`}</button><button onClick={() => setImportPreview([])} className="btn-secondary text-sm">Annuler</button></div>
        </div>
      )}
      {showForm && (
        <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
          <h3 className="font-semibold text-sm mb-3">{editing ? 'Modifier' : 'Ajouter un membre'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Prénom *</label><input className="input" value={form.first_name||''} onChange={e => setForm({...form,first_name:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Nom *</label><input className="input" value={form.last_name||''} onChange={e => setForm({...form,last_name:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Genre</label><select className="input" value={form.gender||'M'} onChange={e => setForm({...form,gender:e.target.value})}><option value="M">Homme</option><option value="F">Femme</option></select></div>
            <div><label className="text-xs text-gray-500">Téléphone</label><input className="input" value={form.phone||''} onChange={e => setForm({...form,phone:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">WhatsApp</label><input className="input" value={form.whatsapp||''} onChange={e => setForm({...form,whatsapp:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Email</label><input className="input" type="email" value={form.email||''} onChange={e => setForm({...form,email:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Profession</label><input className="input" value={form.profession||''} onChange={e => setForm({...form,profession:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Adresse</label><input className="input" value={form.address||''} onChange={e => setForm({...form,address:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Date adhésion</label><input className="input" type="date" value={form.membership_date||''} onChange={e => setForm({...form,membership_date:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Statut</label><select className="input" value={form.status||'AC'} onChange={e => setForm({...form,status:e.target.value})}>{Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Rôle</label><select className="input" value={form.role||'member'} onChange={e => setForm({...form,role:e.target.value})}>{Object.entries(ROLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={saveMember} className="btn-primary text-sm">{editing ? 'Enregistrer' : 'Ajouter'}</button><button onClick={() => { setEditing(null); setAdding(false) }} className="btn-secondary text-sm">Annuler</button></div>
        </div>
      )}
      <div className="space-y-1">{filtered.filter(m => m.status !== 'I').map(m => (
        <div key={m.id} className="card p-3 flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-xs flex-shrink-0">{m.first_name[0]}{m.last_name[0]}</div>
          <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{m.first_name} {m.last_name}</div><div className="text-xs text-gray-500 truncate">{m.profession || '—'} · {m.phone || '—'}</div></div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.status==='AC'?'bg-green-100 text-green-700':m.status==='HC'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>{STATUS_LABELS[m.status as MemberStatus] || m.status}</span>
          <button onClick={() => startEdit(m)} className="text-xs text-brand-500 hover:underline">Éditer</button>
          <button onClick={() => archiveMember(m.id, `${m.first_name} ${m.last_name}`)} className="text-xs text-red-500 hover:underline">Archiver</button>
        </div>
      ))}</div>

      {/* MEMBRES ARCHIVÉS */}
      {filtered.filter(m => m.status === 'I').length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold text-sm text-gray-400 mb-2">📦 Membres archivés ({filtered.filter(m => m.status === 'I').length})</h3>
          <div className="space-y-1">{filtered.filter(m => m.status === 'I').map(m => (
            <div key={m.id} className="card p-3 flex items-center gap-2 bg-gray-50 opacity-70">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-semibold text-xs flex-shrink-0">{m.first_name[0]}{m.last_name[0]}</div>
              <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate text-gray-500">{m.first_name} {m.last_name}</div><div className="text-xs text-gray-400 truncate">{m.profession || '—'} · {m.phone || '—'}</div></div>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-200 text-gray-500">Archivé</span>
              <button onClick={() => startEdit(m)} className="text-xs text-brand-500 hover:underline">Réactiver</button>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  )
}

/* ========== COMPTES ========== */
function AdminComptes({ tenantId }: { tenantId: string }) {
  const [unlinked, setUnlinked] = useState<any[]>([])
  const [linked, setLinked] = useState<any[]>([])
  const supabase = createClient()
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.from('member').select('*').eq('tenant_id', tenantId).is('auth_user_id', null).order('last_name')
      setUnlinked(u || [])
      const { data: l } = await supabase.from('member').select('*').eq('tenant_id', tenantId).not('auth_user_id', 'is', null).order('last_name')
      setLinked(l || [])
    })()
  }, [])
  async function linkAccount(memberId: string, email: string) {
    const inputEmail = prompt('Email du compte à associer :', email || '')
    if (!inputEmail) return
    const { data, error } = await supabase.rpc('get_auth_user_by_email', { p_email: inputEmail }).single()
    if (error || !data) { toast.error(`Aucun compte trouvé pour ${inputEmail}`); return }
    const { error: e2 } = await supabase.from('member').update({ auth_user_id: data.id, email: inputEmail }).eq('id', memberId)
    if (e2) toast.error(e2.message); else { toast.success('Compte associé'); window.location.reload() }
  }
  async function unlinkAccount(id: string) { if (!confirm('Dissocier ce compte ?')) return; await supabase.from('member').update({ auth_user_id: null }).eq('id', id); toast.success('Dissocié'); window.location.reload() }
  return (
    <div>
      <h3 className="font-semibold text-sm mb-2 text-amber-600">Sans compte ({unlinked.length})</h3>
      {unlinked.length === 0 ? <p className="text-xs text-gray-400 mb-4">Tous les membres ont un compte</p> : <div className="space-y-1 mb-6">{unlinked.map(m => <div key={m.id} className="card p-3 flex items-center gap-3 border-l-4 border-l-amber-400"><div className="flex-1"><div className="font-medium text-sm">{m.first_name} {m.last_name}</div><div className="text-xs text-gray-500">{m.email || m.phone || '—'}</div></div><button onClick={() => linkAccount(m.id, m.email)} className="btn-primary text-xs py-1.5">Associer</button></div>)}</div>}
      <h3 className="font-semibold text-sm mb-2 text-green-600">Comptes actifs ({linked.length})</h3>
      <div className="space-y-1">{linked.map(m => <div key={m.id} className="card p-3 flex items-center gap-3 border-l-4 border-l-green-400"><div className="flex-1"><div className="font-medium text-sm">{m.first_name} {m.last_name}</div><div className="text-xs text-gray-500">{m.email} · {m.role}</div></div><span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Connecté</span><button onClick={() => unlinkAccount(m.id)} className="text-xs text-red-500 hover:underline">Dissocier</button></div>)}</div>
    </div>
  )
}

/* ========== CORAN avec vue détaillée Hizb ↔ Lecteur ========== */
function AdminCoran({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [cycles, setCycles] = useState<any[]>([])
  const [activeCycle, setActiveCycle] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [mode, setMode] = useState('SEQUENTIAL')
  const [creating, setCreating] = useState(false)
  const [eligibleCount, setEligibleCount] = useState(0)
  const [hizbs, setHizbs] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const supabase = createClient()
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('reading_cycle').select('*').eq('tenant_id', tenantId).order('cycle_number', { ascending: false }).limit(10)
      setCycles(data || []); const active = data?.find(c => c.status === 'ACTIVE'); setActiveCycle(active || null)
      if (active) { const { data: a } = await supabase.from('hizb_assignment').select('*, member(first_name, last_name)').eq('cycle_id', active.id).order('hizb_number'); setAssignments(a || []) }
      const { count } = await supabase.from('member').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_eligible_quran', true).in('status', ['AC', 'HC'])
      setEligibleCount(count || 0)
      try { const res = await fetch('/hizbs.json'); setHizbs(await res.json()) } catch {}
    })()
  }, [])
  async function createCycle() {
    setCreating(true); const lastNum = cycles[0]?.cycle_number || 0; const now = new Date()
    const { data: newCycle, error } = await supabase.from('reading_cycle').insert({ tenant_id: tenantId, cycle_number: lastNum + 1, week_label: `Semaine ${Math.ceil((now.getTime() - new Date(now.getFullYear(),0,1).getTime()) / 604800000)} — ${now.getFullYear()}`, distribution_mode: mode, starts_at: now.toISOString(), ends_at: new Date(now.getTime() + 7 * 86400000).toISOString(), status: 'ACTIVE', created_by: adminId }).select().single()
    if (error) { toast.error(error.message); setCreating(false); return }
    const { data: mems } = await supabase.from('member').select('id').eq('tenant_id', tenantId).eq('is_eligible_quran', true).in('status', ['AC', 'HC']).order('membership_date')
    if (!mems?.length) { toast.error('Aucun membre éligible'); setCreating(false); return }
    const hizbNums = Array.from({ length: 60 }, (_, i) => i + 1)
    if (mode === 'RANDOM_BALANCED') { for (let i = hizbNums.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [hizbNums[i],hizbNums[j]]=[hizbNums[j],hizbNums[i]] } }
    const assigns = hizbNums.map((h, i) => ({ tenant_id: tenantId, cycle_id: newCycle.id, member_id: mems[i % mems.length].id, hizb_number: h, is_carryover: false, status: 'ASSIGNED' }))
    await supabase.from('hizb_assignment').insert(assigns)
    toast.success(`Cycle ${lastNum + 1} créé — ${assigns.length} Hizbs → ${mems.length} membres`); setCreating(false); window.location.reload()
  }
  async function closeCycle() {
    if (!activeCycle || !confirm('Clôturer ce cycle ?')) return
    await supabase.from('hizb_assignment').update({ status: 'EXPIRED' }).eq('cycle_id', activeCycle.id).eq('status', 'ASSIGNED')
    await supabase.from('reading_cycle').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('id', activeCycle.id)
    toast.success('Cycle clôturé'); window.location.reload()
  }
  function getHizbRef(num: number) { return hizbs.find((h: any) => h.number === num) }
  const validated = assignments.filter(a => a.status === 'VALIDATED').length
  const pending = assignments.filter(a => a.status === 'ASSIGNED').length
  return (
    <div>
      {activeCycle ? (<>
        <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between mb-3">
            <div><h3 className="font-semibold">Cycle {activeCycle.cycle_number} — {activeCycle.week_label}</h3><p className="text-xs text-gray-500">{activeCycle.distribution_mode} · {eligibleCount} éligibles</p></div>
            <button onClick={closeCycle} className="btn-secondary text-xs text-red-500">Clôturer</button>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2"><div className="h-full bg-brand-500 rounded-full" style={{ width: `${assignments.length ? (validated/assignments.length)*100 : 0}%` }} /></div>
          <div className="flex gap-4 text-xs"><span className="text-green-600 font-medium">✓ {validated} validés</span><span className="text-amber-600">⏳ {pending} en attente</span></div>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setViewMode('list')} className={`text-xs px-3 py-1.5 rounded ${viewMode==='list' ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>Liste détaillée</button>
          <button onClick={() => setViewMode('grid')} className={`text-xs px-3 py-1.5 rounded ${viewMode==='grid' ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>Grille compacte</button>
        </div>

        {viewMode === 'list' ? (
          <div className="space-y-1">
            {assignments.map(a => {
              const ref = getHizbRef(a.hizb_number)
              return (
                <div key={a.id} className={`card p-3 flex items-center gap-3 ${a.status === 'VALIDATED' ? 'bg-green-50 border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-200'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${a.status === 'VALIDATED' ? 'bg-green-500 text-white' : 'bg-brand-100 text-brand-700'}`}>{a.hizb_number}</div>
                  <div className="flex-1 min-w-0">
                    {ref && <div className="text-sm mb-0.5" dir="rtl" lang="ar" style={{ fontFamily: 'Traditional Arabic, serif' }}>{ref.arabic}</div>}
                    {ref && <div className="text-[10px] text-gray-400">{ref.verses}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-medium text-sm">{a.member?.first_name} {a.member?.last_name}</div>
                    <div className={`text-[10px] font-medium ${a.status === 'VALIDATED' ? 'text-green-600' : 'text-amber-500'}`}>
                      {a.status === 'VALIDATED' ? '✓ Validé' : '⏳ En attente'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">{assignments.map(a => {
            const ref = getHizbRef(a.hizb_number)
            return <div key={a.id} className={`p-2 text-center text-xs rounded border ${a.status === 'VALIDATED' ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
              <div className="font-bold text-lg text-brand-600">{a.hizb_number}</div>
              {ref && <div className="text-[9px] truncate mb-0.5" dir="rtl">{ref.arabic}</div>}
              <div className="truncate text-[10px] font-medium text-gray-700">{a.member?.first_name} {a.member?.last_name?.[0]}.</div>
              <div className={`text-[10px] ${a.status === 'VALIDATED' ? 'text-green-600' : 'text-gray-400'}`}>{a.status === 'VALIDATED' ? '✓' : '—'}</div>
            </div>
          })}</div>
        )}
      </>) : (
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Lancer un nouveau cycle de lecture</h3>
          <p className="text-sm text-gray-500 mb-2">{eligibleCount} membres éligibles · 60 Hizbs à distribuer</p>
          <p className="text-xs text-gray-400 mb-4">Chaque Hizb sera attribué à un lecteur. Le membre voit ses Hizbs et les valide après lecture.</p>
          <div className="space-y-2 mb-4">{[
            { v: 'SEQUENTIAL', l: 'Séquentiel', d: 'Hizb 1→60, chaque membre à tour de rôle' },
            { v: 'RANDOM_BALANCED', l: 'Aléatoire équilibré', d: 'Distribution aléatoire, répartition égale' },
            { v: 'MANUAL', l: 'Manuel', d: 'Attribution manuelle de chaque Hizb' }
          ].map(o => <label key={o.v} className={`block p-3 rounded-lg border cursor-pointer ${mode === o.v ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}><input type="radio" name="mode" value={o.v} checked={mode===o.v} onChange={() => setMode(o.v)} className="sr-only" /><div className="font-medium text-sm">{o.l}</div><div className="text-xs text-gray-500">{o.d}</div></label>)}</div>
          <button onClick={createCycle} disabled={creating} className="btn-primary w-full">{creating ? 'Création...' : `Lancer le cycle (${eligibleCount} membres × 60 Hizbs)`}</button>
        </div>
      )}
      {cycles.filter(c => c.status === 'CLOSED').length > 0 && <div className="mt-6"><h3 className="font-semibold text-sm mb-2">Historique des cycles</h3>{cycles.filter(c => c.status === 'CLOSED').map(c => <div key={c.id} className="card p-3 flex justify-between text-sm mb-1"><span>Cycle {c.cycle_number} — {c.week_label}</span><span className="text-gray-400">{c.distribution_mode}</span></div>)}</div>}
    </div>
  )
}

/* ========== COTISATIONS avec grille annuelle ========== */
function AdminCotisations({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [members, setMembers] = useState<any[]>([])
  const [contribs, setContribs] = useState<any[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [view, setView] = useState<'grid' | 'month'>('grid')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [memberAmounts, setMemberAmounts] = useState<Record<string, number>>({})
  const supabase = createClient()
  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from('member').select('*').eq('tenant_id', tenantId).in('status', ['AC', 'HC']).order('last_name')
      setMembers(m || [])
      const { data: c } = await supabase.from('contribution').select('*').eq('tenant_id', tenantId).eq('year', year)
      setContribs(c || [])
    })()
  }, [year])

  function getStatus(memberId: string, m: number) { return contribs.find(c => c.member_id === memberId && c.month === m)?.status || '' }
  function getMonthContribs() { return contribs.filter(c => c.month === month) }

  async function setContribStatus(memberId: string, status: string) {
    const amt = memberAmounts[memberId] || 0
    const existing = contribs.find(c => c.member_id === memberId && c.month === month)
    if (existing) { await supabase.from('contribution').update({ status, amount: status === 'PAID' ? amt : 0, paid_at: status === 'PAID' ? new Date().toISOString() : null, recorded_by: adminId }).eq('id', existing.id) }
    else { await supabase.from('contribution').insert({ tenant_id: tenantId, member_id: memberId, year, month, amount: status === 'PAID' ? amt : 0, status, paid_at: status === 'PAID' ? new Date().toISOString() : null, recorded_by: adminId }) }
    const { data: c } = await supabase.from('contribution').select('*').eq('tenant_id', tenantId).eq('year', year)
    setContribs(c || []); toast.success('Mis à jour')
  }

  const totalPaid = contribs.filter(c => c.status === 'PAID').reduce((a, c) => a + Number(c.amount), 0)

  function exportYearCSV() {
    const rows = [['Membre', ...MONTHS_FR, 'Total annuel'].join(';')]
    members.forEach(m => {
      const row = [`${m.first_name} ${m.last_name}`]
      let total = 0
      for (let mo = 1; mo <= 12; mo++) {
        const c = contribs.find(x => x.member_id === m.id && x.month === mo)
        if (c?.status === 'PAID') { row.push(String(c.amount)); total += Number(c.amount) }
        else if (c?.status === 'LATE') row.push('Retard')
        else if (c?.status === 'EXEMPT') row.push('Exonéré')
        else row.push('—')
      }
      row.push(String(total))
      rows.push(row.join(';'))
    })
    const blob = new Blob(['\ufeff'+rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cotisations_${year}_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    toast.success('Export téléchargé')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="input w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>{[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
        <button onClick={() => setView('grid')} className={`text-xs px-3 py-1.5 rounded ${view==='grid' ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>Grille annuelle</button>
        <button onClick={() => setView('month')} className={`text-xs px-3 py-1.5 rounded ${view==='month' ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>Par mois</button>
        <button onClick={exportYearCSV} className="btn-secondary text-xs">Exporter CSV</button>
        <span className="text-xs text-gray-500 ml-auto">Total {year}: <strong>{formatCFA(totalPaid)}</strong></span>
      </div>
      {view === 'grid' ? (
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b"><th className="text-left p-1.5">Membre</th>{MONTHS_FR.map((m, i) => <th key={i} className="p-1 text-center w-8" title={m}>{m.substring(0, 3)}</th>)}</tr></thead><tbody>
          {members.map(m => <tr key={m.id} className="border-b border-gray-50"><td className="p-1.5 font-medium truncate max-w-[120px]">{m.first_name} {m.last_name?.[0]}.</td>
            {Array.from({ length: 12 }, (_, i) => { const st = getStatus(m.id, i + 1); return <td key={i} className="p-1 text-center"><span className={`inline-block w-5 h-5 rounded text-[9px] leading-5 ${st === 'PAID' ? 'bg-green-500 text-white' : st === 'LATE' ? 'bg-red-400 text-white' : st === 'EXEMPT' ? 'bg-blue-400 text-white' : st === 'PENDING' ? 'bg-amber-300 text-white' : 'bg-gray-100 text-gray-300'}`}>{st === 'PAID' ? '✓' : st === 'LATE' ? '!' : st === 'EXEMPT' ? 'E' : st ? '?' : '·'}</span></td> })}
          </tr>)}
        </tbody></table></div>
      ) : (
        <div>
          <select className="input w-auto mb-3" value={month} onChange={e => setMonth(Number(e.target.value))}>{MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
          <p className="text-xs text-gray-400 mb-3">Montant individuel par membre</p>
          <div className="space-y-1">{members.map(m => {
            const st = getMonthContribs().find(c => c.member_id === m.id)?.status || 'PENDING'
            const existingAmt = getMonthContribs().find(c => c.member_id === m.id)?.amount || 0
            return <div key={m.id} className="card p-2 flex items-center gap-2">
              <div className="flex-1 min-w-0 text-sm font-medium truncate">{m.first_name} {m.last_name}</div>
              <input type="number" className="input w-20 text-right text-sm py-1" placeholder="Montant" value={(memberAmounts[m.id] ?? existingAmt) || ''} onChange={e => setMemberAmounts({ ...memberAmounts, [m.id]: Number(e.target.value) })} /><span className="text-[10px] text-gray-400">F</span>
              {(['PAID','PENDING','LATE','EXEMPT'] as const).map(s => <button key={s} onClick={() => setContribStatus(m.id, s)} className={`px-1.5 py-1 rounded text-[10px] font-medium ${st === s ? (s==='PAID'?'bg-green-500 text-white':s==='LATE'?'bg-red-500 text-white':s==='EXEMPT'?'bg-blue-500 text-white':'bg-amber-500 text-white') : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{s === 'PAID' ? '✓' : s === 'LATE' ? '!' : s === 'EXEMPT' ? 'E' : '?'}</button>)}
            </div>
          })}</div>
        </div>
      )}
    </div>
  )
}

/* ========== DONS avec filtres + suppression ========== */
function AdminDons({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [dons, setDons] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [filterCat, setFilterCat] = useState('ALL')
  const [form, setForm] = useState({ member_id: '', amount: '', category: 'HADYA', description: '' })
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const supabase = createClient()
  const load = useCallback(async () => {
    const { data: d } = await supabase.from('donation').select('*, member(first_name, last_name)').eq('tenant_id', tenantId).order('received_at', { ascending: false }).limit(100)
    setDons(d || [])
    const { data: m } = await supabase.from('member').select('id, first_name, last_name').eq('tenant_id', tenantId).order('last_name')
    setMembers(m || [])
  }, [tenantId])
  useEffect(() => { load() }, [load])

  const filtered = filterCat === 'ALL' ? dons : dons.filter(d => d.category === filterCat)
  const total = filtered.reduce((s, d) => s + Number(d.amount), 0)

  async function saveDon() {
    if (!form.amount) { toast.error('Montant requis'); return }
    if (editingId) {
      await supabase.from('donation').update({ member_id: form.member_id || null, amount: Number(form.amount), category: form.category, description: form.description }).eq('id', editingId)
      toast.success('Don modifié'); setEditingId(null)
    } else {
      await supabase.from('donation').insert({ tenant_id: tenantId, member_id: form.member_id || null, amount: Number(form.amount), category: form.category, description: form.description, recorded_by: adminId })
      toast.success('Don enregistré')
    }
    setAdding(false); setForm({ member_id: '', amount: '', category: 'HADYA', description: '' }); load()
  }
  async function deleteDon(id: string) { if (!confirm('Supprimer ce don ?')) return; await supabase.from('donation').delete().eq('id', id); toast.success('Supprimé'); load() }
  function editDon(d: any) { setEditingId(d.id); setForm({ member_id: d.member_id || '', amount: String(d.amount), category: d.category, description: d.description || '' }); setAdding(true) }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="input w-auto text-xs" value={filterCat} onChange={e => setFilterCat(e.target.value)}><option value="ALL">Toutes catégories</option><option value="HADYA">Hadya</option><option value="SADAQA">Sadaqa</option><option value="ZAKAT">Zakat</option><option value="OTHER">Autre</option></select>
        <span className="text-sm">Total : <strong className="text-brand-500">{formatCFA(total)}</strong></span>
        <button onClick={() => { setAdding(!adding); setEditingId(null); setForm({ member_id: '', amount: '', category: 'HADYA', description: '' }) }} className="btn-primary text-sm ml-auto">+ Nouveau don</button>
      </div>
      {adding && (
        <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Membre</label><select className="input" value={form.member_id} onChange={e => setForm({...form,member_id:e.target.value})}><option value="">Anonyme</option>{members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Montant *</label><input type="number" className="input" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Catégorie</label><select className="input" value={form.category} onChange={e => setForm({...form,category:e.target.value})}><option value="HADYA">Hadya</option><option value="SADAQA">Sadaqa</option><option value="ZAKAT">Zakat</option><option value="OTHER">Autre</option></select></div>
            <div><label className="text-xs text-gray-500">Description</label><input className="input" value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></div>
          </div>
          <div className="flex gap-2 mt-3"><button onClick={saveDon} className="btn-primary text-sm">{editingId ? 'Modifier' : 'Enregistrer'}</button><button onClick={() => { setAdding(false); setEditingId(null) }} className="btn-secondary text-sm">Annuler</button></div>
        </div>
      )}
      <div className="space-y-1">{filtered.map(d => <div key={d.id} className="card p-3 flex items-center gap-2">
        <div className="flex-1"><div className="font-medium text-sm">{d.member ? `${d.member.first_name} ${d.member.last_name}` : 'Anonyme'}</div><div className="text-xs text-gray-500">{d.description || d.category} · {new Date(d.received_at).toLocaleDateString('fr-FR')}</div></div>
        <span className="font-bold text-brand-500">{formatCFA(d.amount)}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${d.category==='HADYA'?'bg-green-100 text-green-700':d.category==='ZAKAT'?'bg-purple-100 text-purple-700':d.category==='SADAQA'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'}`}>{d.category}</span>
        <button onClick={() => editDon(d)} className="text-xs text-brand-500 hover:underline">Éditer</button>
        <button onClick={() => deleteDon(d.id)} className="text-xs text-red-500 hover:underline">Suppr.</button>
      </div>)}</div>
    </div>
  )
}

/* ========== FONDS SOCIAL avec catégories ========== */
function AdminFonds({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [txs, setTxs] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState({ type: 'IN', amount: '', reason: '', beneficiary_id: '', category: 'GENERAL' })
  const [adding, setAdding] = useState(false)
  const supabase = createClient()
  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from('social_fund').select('*, beneficiary:member!social_fund_beneficiary_id_fkey(first_name, last_name)').eq('tenant_id', tenantId).order('transaction_date', { ascending: false }).limit(100)
      setTxs(t || [])
      const { data: m } = await supabase.from('member').select('id, first_name, last_name').eq('tenant_id', tenantId).order('last_name')
      setMembers(m || [])
    })()
  }, [])
  async function addTx() {
    if (!form.amount || !form.reason) { toast.error('Montant et motif requis'); return }
    await supabase.from('social_fund').insert({ tenant_id: tenantId, type: form.type, amount: Number(form.amount), reason: `[${form.category}] ${form.reason}`, beneficiary_id: form.beneficiary_id || null, approved_by: adminId })
    toast.success('Opération enregistrée'); setAdding(false); window.location.reload()
  }
  const totalIn = txs.filter(t => t.type === 'IN').reduce((a, t) => a + Number(t.amount), 0)
  const totalOut = txs.filter(t => t.type === 'OUT').reduce((a, t) => a + Number(t.amount), 0)
  const categories = ['GENERAL', 'MALADIE', 'DECES', 'MARIAGE', 'NAISSANCE', 'VOYAGE', 'AUTRE']
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-3 bg-green-50"><div className="text-lg font-bold text-green-700">{formatCFA(totalIn)}</div><div className="text-xs text-green-600">Entrées</div></div>
        <div className="card p-3 bg-red-50"><div className="text-lg font-bold text-red-700">{formatCFA(totalOut)}</div><div className="text-xs text-red-600">Sorties</div></div>
        <div className="card p-3 bg-blue-50"><div className="text-lg font-bold text-blue-700">{formatCFA(totalIn - totalOut)}</div><div className="text-xs text-blue-600">Solde</div></div>
      </div>
      <button onClick={() => setAdding(!adding)} className="btn-primary text-sm mb-4">+ Nouvelle opération</button>
      {adding && (
        <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Type</label><select className="input" value={form.type} onChange={e => setForm({...form,type:e.target.value})}><option value="IN">Entrée</option><option value="OUT">Sortie</option></select></div>
            <div><label className="text-xs text-gray-500">Catégorie</label><select className="input" value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Montant *</label><input type="number" className="input" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} /></div>
            {form.type === 'OUT' && <div><label className="text-xs text-gray-500">Bénéficiaire</label><select className="input" value={form.beneficiary_id} onChange={e => setForm({...form,beneficiary_id:e.target.value})}><option value="">—</option>{members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}</select></div>}
            <div className="col-span-2"><label className="text-xs text-gray-500">Motif *</label><input className="input" value={form.reason} onChange={e => setForm({...form,reason:e.target.value})} /></div>
          </div>
          <div className="flex gap-2 mt-3"><button onClick={addTx} className="btn-primary text-sm">Enregistrer</button><button onClick={() => setAdding(false)} className="btn-secondary text-sm">Annuler</button></div>
        </div>
      )}
      <div className="space-y-1">{txs.map(t => <div key={t.id} className={`card p-3 flex items-center gap-2 border-l-4 ${t.type === 'IN' ? 'border-l-green-400' : 'border-l-red-400'}`}>
        <div className="flex-1"><div className="font-medium text-sm">{t.reason}</div><div className="text-xs text-gray-500">{t.beneficiary ? `→ ${t.beneficiary.first_name} ${t.beneficiary.last_name}` : ''} · {new Date(t.transaction_date).toLocaleDateString('fr-FR')}</div></div>
        <span className={`font-bold ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'IN' ? '+' : '-'}{formatCFA(t.amount)}</span>
      </div>)}</div>
    </div>
  )
}

/* ========== 70 HADITHS ========== */
function AdminHadiths({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [hadiths, setHadiths] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loadingH, setLoadingH] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      // Charger les hadiths depuis le fichier JSON statique
      try {
        const res = await fetch('/hadiths.json')
        const data = await res.json()
        setHadiths(data)
      } catch { setHadiths([]) }
      // Charger les soumissions
      const { data: subs } = await supabase.from('hadith_submission').select('*, member(first_name, last_name)').eq('tenant_id', tenantId).order('submitted_at', { ascending: false })
      setSubmissions(subs || [])
      setLoadingH(false)
    })()
  }, [])

  async function reviewSubmission(id: string, status: 'APPROVED' | 'REJECTED') {
    await supabase.from('hadith_submission').update({ status, reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq('id', id)
    toast.success(status === 'APPROVED' ? 'Approuvé !' : 'Rejeté')
    const { data: subs } = await supabase.from('hadith_submission').select('*, member(first_name, last_name)').eq('tenant_id', tenantId).order('submitted_at', { ascending: false })
    setSubmissions(subs || [])
  }

  const pending = submissions.filter(s => s.status === 'PENDING')

  if (loadingH) return <p className="text-center py-8 text-gray-400">Chargement...</p>
  return (
    <div>
      {/* Soumissions en attente */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-sm mb-2 text-amber-600">Soumissions en attente ({pending.length})</h3>
          <div className="space-y-2">{pending.map(s => (
            <div key={s.id} className="card p-4 border-l-4 border-l-amber-400">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm">{s.member?.first_name} {s.member?.last_name} — Hadith #{s.hadith_number}</div>
                <div className="flex gap-2">
                  <button onClick={() => reviewSubmission(s.id, 'APPROVED')} className="px-3 py-1 rounded text-xs font-medium bg-green-500 text-white">Approuver</button>
                  <button onClick={() => reviewSubmission(s.id, 'REJECTED')} className="px-3 py-1 rounded text-xs font-medium bg-red-500 text-white">Rejeter</button>
                </div>
              </div>
              {s.notes && <p className="text-xs text-gray-500">{s.notes}</p>}
            </div>
          ))}</div>
        </div>
      )}

      {/* Liste des 70 hadiths */}
      <h3 className="font-semibold text-sm mb-3">Les 70 Hadiths ({hadiths.length} chargés)</h3>
      {selected ? (
        <div className="card p-5 mb-4">
          <button onClick={() => setSelected(null)} className="text-xs text-brand-500 mb-3 hover:underline">← Retour à la liste</button>
          <div className="text-center mb-4">
            <span className="inline-block w-12 h-12 bg-brand-100 text-brand-700 rounded-full leading-[48px] text-xl font-bold">{selected.number}</span>
            <h3 className="font-semibold mt-2">{selected.title}</h3>
          </div>
          <div className="text-right text-lg leading-loose mb-4 p-4 bg-amber-50 rounded-lg font-serif" dir="rtl" lang="ar">{selected.arabic}</div>
          <div className="text-sm text-gray-700 leading-relaxed mb-3">{selected.french}</div>
          {selected.narrator && <p className="text-xs text-gray-500">Rapporteur : {selected.narrator}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {hadiths.map(h => {
            const approved = submissions.filter(s => s.hadith_number === h.number && s.status === 'APPROVED').length
            return (
              <button key={h.number} onClick={() => setSelected(h)}
                className={`card p-3 text-center hover:shadow-md transition-shadow ${approved > 0 ? 'border-green-300 bg-green-50' : ''}`}>
                <div className="text-2xl font-bold text-brand-500 mb-1">{h.number}</div>
                <div className="text-[10px] text-gray-700 font-medium truncate mb-0.5">{h.title}</div>
                <div className="text-[9px] text-gray-400 truncate" dir="rtl">{h.arabic?.substring(0, 25)}...</div>
                {approved > 0 && <div className="text-[10px] text-green-600 mt-1">{approved} validé(s)</div>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ========== PARAMÈTRES avec export données ========== */
function AdminParametres({ tenantId }: { tenantId: string }) {
  const [tenant, setTenant] = useState<any>(null)
  const [settings, setSettings] = useState<any>({})
  const [exporting, setExporting] = useState(false)
  const supabase = createClient()
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenant').select('*').eq('id', tenantId).single()
      setTenant(data); setSettings(data?.settings || {})
    })()
  }, [])
  async function saveSettings() {
    const { error } = await supabase.from('tenant').update({ name: tenant.name, city: tenant.city, settings }).eq('id', tenantId)
    if (error) toast.error(error.message); else toast.success('Paramètres sauvegardés')
  }
  async function exportAllData() {
    setExporting(true)
    const tables = ['member', 'contribution', 'donation', 'social_fund', 'reading_cycle', 'hizb_assignment', 'hadith_submission']
    const allData: Record<string, any> = { exported_at: new Date().toISOString(), tenant_id: tenantId }
    for (const t of tables) {
      const { data } = await supabase.from(t).select('*').eq('tenant_id', tenantId)
      allData[t] = data || []
    }
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `maslak4_export_${new Date().toISOString().split('T')[0]}.json`; a.click()
    toast.success('Export complet téléchargé'); setExporting(false)
  }
  if (!tenant) return <p className="text-center py-8 text-gray-400">Chargement...</p>
  return (
    <div>
      <div className="card p-4 mb-4">
        <h3 className="font-semibold text-sm mb-3">Communauté</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Nom</label><input className="input" value={tenant.name||''} onChange={e => setTenant({...tenant,name:e.target.value})} /></div>
          <div><label className="text-xs text-gray-500">Ville</label><input className="input" value={tenant.city||''} onChange={e => setTenant({...tenant,city:e.target.value})} /></div>
          <div><label className="text-xs text-gray-500">Slug</label><input className="input bg-gray-100" value={tenant.slug||''} disabled /></div>
          <div><label className="text-xs text-gray-500">Pays</label><input className="input" value={tenant.country||''} onChange={e => setTenant({...tenant,country:e.target.value})} /></div>
        </div>
      </div>
      <div className="card p-4 mb-4">
        <h3 className="font-semibold text-sm mb-3">Configuration</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Devise</label><input className="input" value={settings.currency||'XOF'} onChange={e => setSettings({...settings,currency:e.target.value})} /></div>
          <div><label className="text-xs text-gray-500">Mois éligibilité Coran</label><input type="number" className="input" value={settings.eligibility_months||6} onChange={e => setSettings({...settings,eligibility_months:Number(e.target.value)})} /></div>
          <div><label className="text-xs text-gray-500">Jour début cycle (0=dim)</label><input type="number" className="input" value={settings.cycle_start_day||5} onChange={e => setSettings({...settings,cycle_start_day:Number(e.target.value)})} /></div>
          <div><label className="text-xs text-gray-500">Jour fin cycle</label><input type="number" className="input" value={settings.cycle_end_day||4} onChange={e => setSettings({...settings,cycle_end_day:Number(e.target.value)})} /></div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={saveSettings} className="btn-primary">Sauvegarder</button>
        <button onClick={exportAllData} disabled={exporting} className="btn-secondary">{exporting ? 'Export...' : 'Exporter toutes les données (JSON)'}</button>
      </div>
    </div>
  )
}
