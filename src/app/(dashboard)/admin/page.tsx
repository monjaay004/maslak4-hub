'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { STATUS_LABELS, ROLE_LABELS, MONTHS_FR, type MemberStatus, type MemberRole } from '@/lib/types'
import { formatCFA, getAncienneteLabel } from '@/lib/utils'

type Tab = 'dashboard' | 'membres' | 'comptes' | 'coran' | 'cotisations' | 'dons' | 'fonds' | 'parametres'

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
  if (!me) return <div className="text-center py-20 text-gray-400">Accès refusé — réservé aux administrateurs</div>

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Tableau de bord', icon: '📊' },
    { key: 'membres', label: 'Membres', icon: '👥' },
    { key: 'comptes', label: 'Comptes', icon: '🔑' },
    { key: 'coran', label: 'Coran', icon: '📖' },
    { key: 'cotisations', label: 'Cotisations', icon: '💰' },
    { key: 'dons', label: 'Dons & Hadya', icon: '🎁' },
    { key: 'fonds', label: 'Fonds Social', icon: '🤝' },
    { key: 'parametres', label: 'Paramètres', icon: '⚙️' },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Administration</h1>
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
      {/* Tab Content */}
      {tab === 'dashboard' && <AdminDashboard tenantId={me.tenant_id} />}
      {tab === 'membres' && <AdminMembres tenantId={me.tenant_id} />}
      {tab === 'comptes' && <AdminComptes tenantId={me.tenant_id} />}
      {tab === 'coran' && <AdminCoran tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'cotisations' && <AdminCotisations tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'dons' && <AdminDons tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'fonds' && <AdminFonds tenantId={me.tenant_id} adminId={me.id} />}
      {tab === 'parametres' && <AdminParametres tenantId={me.tenant_id} />}
    </div>
  )
}

// ============================================
// DASHBOARD ADMIN
// ============================================
function AdminDashboard({ tenantId }: { tenantId: string }) {
  const [stats, setStats] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { count: totalMembers } = await supabase.from('member').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      const { count: activeMembers } = await supabase.from('member').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'AC')
      const { count: eligible } = await supabase.from('member').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_eligible_quran', true)
      const { count: pendingAccounts } = await supabase.from('app_user').select('*', { count: 'exact', head: true })
      const { data: cycle } = await supabase.from('v_active_cycle_progress').select('*').eq('tenant_id', tenantId).single()
      const year = new Date().getFullYear()
      const { data: contribs } = await supabase.from('contribution').select('amount, status').eq('tenant_id', tenantId).eq('year', year)
      const totalPaid = contribs?.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0) || 0
      const { data: donations } = await supabase.from('donation').select('amount').eq('tenant_id', tenantId)
      const totalDonations = donations?.reduce((s, d) => s + Number(d.amount), 0) || 0
      setStats({ totalMembers, activeMembers, eligible, pendingAccounts, cycle, totalPaid, totalDonations })
    })()
  }, [])

  if (!stats) return <div className="text-center py-8 text-gray-400">Chargement...</div>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard value={stats.totalMembers || 0} label="Membres total" color="blue" />
      <StatCard value={stats.activeMembers || 0} label="Actifs cotisants" color="green" />
      <StatCard value={stats.eligible || 0} label="Éligibles Coran" color="purple" />
      <StatCard value={stats.cycle?.progress_pct || '—'} label={stats.cycle ? `Cycle ${stats.cycle.cycle_number}` : 'Pas de cycle'} suffix={stats.cycle ? '%' : ''} color="amber" />
      <StatCard value={formatCFA(stats.totalPaid)} label={`Cotisations ${new Date().getFullYear()}`} color="green" />
      <StatCard value={formatCFA(stats.totalDonations)} label="Dons totaux" color="amber" />
      <StatCard value={stats.cycle?.total_validated || 0} label="Hizbs validés" color="green" />
      <StatCard value={stats.cycle?.total_pending || 0} label="Hizbs en attente" color="red" />
    </div>
  )
}

function StatCard({ value, label, suffix, color }: { value: any; label: string; suffix?: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className={`card p-4 ${colors[color] || ''}`}>
      <div className="text-xl font-bold">{value}{suffix}</div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  )
}

// ============================================
// GESTION DES MEMBRES (CRUD complet)
// ============================================
function AdminMembres({ tenantId }: { tenantId: string }) {
  const [members, setMembers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<any>({})
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase.from('member').select('*').eq('tenant_id', tenantId).order('last_name')
    setMembers(data || [])
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const filtered = members.filter(m =>
    `${m.first_name} ${m.last_name} ${m.phone} ${m.profession}`.toLowerCase().includes(search.toLowerCase())
  )

  async function saveMember() {
    if (!form.first_name || !form.last_name) { toast.error('Nom et prénom requis'); return }
    if (editing) {
      const { error } = await supabase.from('member').update({
        first_name: form.first_name, last_name: form.last_name, gender: form.gender,
        phone: form.phone, whatsapp: form.whatsapp, email: form.email,
        profession: form.profession, address: form.address, status: form.status,
        role: form.role, membership_date: form.membership_date,
      }).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Membre modifié'); setEditing(null); load() }
    } else {
      const { error } = await supabase.from('member').insert({
        tenant_id: tenantId, first_name: form.first_name, last_name: form.last_name,
        gender: form.gender || 'M', phone: form.phone, whatsapp: form.whatsapp,
        email: form.email, profession: form.profession, address: form.address,
        status: form.status || 'AC', role: form.role || 'member',
        membership_date: form.membership_date || new Date().toISOString().split('T')[0],
      })
      if (error) toast.error(error.message)
      else { toast.success('Membre ajouté'); setAdding(false); setForm({}); load() }
    }
  }

  async function deleteMember(id: string, name: string) {
    if (!confirm(`Supprimer ${name} ? Cette action est irréversible.`)) return
    const { error } = await supabase.from('member').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Membre supprimé'); load() }
  }

  function startEdit(m: any) {
    setEditing(m); setAdding(false)
    setForm({ ...m })
  }

  function startAdd() {
    setAdding(true); setEditing(null)
    setForm({ gender: 'M', status: 'AC', role: 'member', membership_date: new Date().toISOString().split('T')[0] })
  }

  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])

  async function exportCSV() {
    const rows = [['Prénom','Nom','Genre','Statut','Téléphone','WhatsApp','Email','Profession','Adresse','Rôle','Adhésion'].join(';')]
    members.forEach(m => rows.push([m.first_name,m.last_name,m.gender||'',m.status,m.phone||'',m.whatsapp||'',m.email||'',m.profession||'',m.address||'',m.role,m.membership_date].join(';')))
    const blob = new Blob(['\ufeff'+rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `membres_maslak4_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success('Export CSV téléchargé')
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)

    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      const header = lines[0].toLowerCase()

      // Détecter le séparateur
      const sep = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ','

      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
      const rows: any[] = []

      // Mapper les colonnes intelligemment
      const colMap: Record<string, number> = {}
      headers.forEach((h, i) => {
        if (h.includes('prénom') || h.includes('prenom') || h.includes('first')) colMap.first_name = i
        else if (h.includes('nom') || h.includes('last') || h.includes('name')) colMap.last_name = i
        else if (h.includes('genre') || h.includes('sexe') || h.includes('gender')) colMap.gender = i
        else if (h.includes('statut') || h.includes('status')) colMap.status = i
        else if (h.includes('whatsapp') || h.includes('wha')) colMap.whatsapp = i
        else if (h.includes('tel') || h.includes('phone') || h.includes('téléphone')) colMap.phone = i
        else if (h.includes('email') || h.includes('mail')) colMap.email = i
        else if (h.includes('profession') || h.includes('métier') || h.includes('metier')) colMap.profession = i
        else if (h.includes('adresse') || h.includes('address')) colMap.address = i
        else if (h.includes('role') || h.includes('rôle')) colMap.role = i
        else if (h.includes('adhésion') || h.includes('adhesion') || h.includes('date')) colMap.membership_date = i
      })

      // Si pas de colonnes détectées, essayer format simple (Prénom;Nom;Téléphone)
      if (!colMap.first_name && !colMap.last_name) {
        if (headers.length >= 2) {
          colMap.first_name = 0
          colMap.last_name = 1
          if (headers.length >= 3) colMap.phone = 2
          if (headers.length >= 4) colMap.profession = 3
          if (headers.length >= 5) colMap.status = 4
        }
      }

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
        const firstName = cols[colMap.first_name] || ''
        const lastName = cols[colMap.last_name] || ''
        if (!firstName && !lastName) continue

        rows.push({
          first_name: firstName,
          last_name: lastName,
          gender: cols[colMap.gender] || 'M',
          status: cols[colMap.status] || 'AC',
          phone: cols[colMap.phone] || '',
          whatsapp: cols[colMap.whatsapp] || cols[colMap.phone] || '',
          email: cols[colMap.email] || '',
          profession: cols[colMap.profession] || '',
          address: cols[colMap.address] || '',
          role: cols[colMap.role] || 'member',
          membership_date: cols[colMap.membership_date] || new Date().toISOString().split('T')[0],
        })
      }

      setImportPreview(rows)
      toast.success(`${rows.length} membres détectés dans le fichier`)
    } catch (err: any) {
      toast.error('Erreur de lecture du fichier : ' + err.message)
    }
    setImporting(false)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!importPreview.length) return
    setImporting(true)
    let inserted = 0, errors = 0
    for (const m of importPreview) {
      const { error } = await supabase.from('member').insert({
        tenant_id: tenantId, ...m,
        gender: ['M','F'].includes(m.gender?.toUpperCase()) ? m.gender.toUpperCase() : 'M',
        status: Object.keys(STATUS_LABELS).includes(m.status?.toUpperCase()) ? m.status.toUpperCase() : 'AC',
        role: Object.keys(ROLE_LABELS).includes(m.role) ? m.role : 'member',
      })
      if (error) errors++
      else inserted++
    }
    toast.success(`${inserted} membres importés${errors > 0 ? `, ${errors} erreurs (doublons ?)` : ''}`)
    setImportPreview([])
    setImporting(false)
    load()
  }

  const showForm = adding || editing
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input type="search" className="input flex-1 min-w-[200px]" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={startAdd} className="btn-primary text-sm">+ Ajouter</button>
        <label className="btn-secondary text-sm cursor-pointer">
          Importer CSV
          <input type="file" accept=".csv,.txt,.tsv,.xls,.xlsx" onChange={handleFileImport} className="hidden" />
        </label>
        <button onClick={exportCSV} className="btn-secondary text-sm">Exporter CSV</button>
        <span className="text-xs text-gray-400">{filtered.length} membres</span>
      </div>

      {importPreview.length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-l-blue-500">
          <h3 className="font-semibold text-sm mb-2">Aperçu de l'import ({importPreview.length} membres)</h3>
          <div className="max-h-60 overflow-auto text-xs mb-3">
            <table className="w-full">
              <thead><tr className="text-left text-gray-500 border-b"><th className="pb-1">Prénom</th><th className="pb-1">Nom</th><th className="pb-1">Tél.</th><th className="pb-1">Statut</th><th className="pb-1">Profession</th></tr></thead>
              <tbody>
                {importPreview.slice(0, 20).map((m, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1">{m.first_name}</td><td>{m.last_name}</td><td>{m.phone}</td><td>{m.status}</td><td>{m.profession}</td>
                  </tr>
                ))}
                {importPreview.length > 20 && <tr><td colSpan={5} className="py-1 text-gray-400">... et {importPreview.length - 20} autres</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={confirmImport} disabled={importing} className="btn-primary text-sm">
              {importing ? 'Import en cours...' : `Confirmer l'import (${importPreview.length} membres)`}
            </button>
            <button onClick={() => setImportPreview([])} className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
          <h3 className="font-semibold text-sm mb-3">{editing ? 'Modifier le membre' : 'Ajouter un membre'}</h3>
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
            <div><label className="text-xs text-gray-500">Statut</label><select className="input" value={form.status||'AC'} onChange={e => setForm({...form,status:e.target.value})}>
              {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
            <div><label className="text-xs text-gray-500">Rôle</label><select className="input" value={form.role||'member'} onChange={e => setForm({...form,role:e.target.value})}>
              {Object.entries(ROLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveMember} className="btn-primary text-sm">{editing ? 'Enregistrer' : 'Ajouter'}</button>
            <button onClick={() => { setEditing(null); setAdding(false) }} className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {filtered.map(m => (
          <div key={m.id} className="card p-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-xs flex-shrink-0">
              {m.first_name[0]}{m.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{m.first_name} {m.last_name}</div>
              <div className="text-xs text-gray-500 truncate">{m.profession || '—'} · {m.phone || '—'} · {getAncienneteLabel(m.anciennete_mois)}</div>
            </div>
            <span className={`badge text-[10px] ${m.status==='AC'?'badge-green':m.status==='HC'?'badge-blue':m.status==='I'?'badge-gray':'badge-amber'}`}>{m.status}</span>
            <span className="badge badge-blue text-[10px]">{m.role}</span>
            <button onClick={() => startEdit(m)} className="text-xs text-brand-500 hover:underline">Modifier</button>
            <button onClick={() => deleteMember(m.id, `${m.first_name} ${m.last_name}`)} className="text-xs text-red-500 hover:underline">Suppr.</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// VALIDATION DES COMPTES (Associer auth → membre)
// ============================================
function AdminComptes({ tenantId }: { tenantId: string }) {
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [linkedMembers, setLinkedMembers] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      // Membres sans auth_user_id = non liés
      const { data: unlinked } = await supabase.from('member').select('*').eq('tenant_id', tenantId).is('auth_user_id', null).order('last_name')
      setMembers(unlinked || [])
      // Membres liés
      const { data: linked } = await supabase.from('member').select('*').eq('tenant_id', tenantId).not('auth_user_id', 'is', null).order('last_name')
      setLinkedMembers(linked || [])
    })()
  }, [])

  async function linkAccount(memberId: string, email: string) {
    const inputEmail = prompt(`Email du compte à associer au membre :`, email || '')
    if (!inputEmail) return
    // Chercher l'utilisateur auth par email via une requête SQL
    const { data, error } = await supabase.rpc('get_auth_user_by_email', { p_email: inputEmail }).single()
    if (error || !data) {
      toast.error(`Aucun compte trouvé avec l'email ${inputEmail}. Le membre doit d'abord créer un compte sur l'app.`)
      return
    }
    const { error: updateErr } = await supabase.from('member').update({ auth_user_id: data.id, email: inputEmail }).eq('id', memberId)
    if (updateErr) toast.error(updateErr.message)
    else { toast.success('Compte associé !'); window.location.reload() }
  }

  async function unlinkAccount(memberId: string) {
    if (!confirm('Dissocier ce compte ? Le membre ne pourra plus se connecter.')) return
    const { error } = await supabase.from('member').update({ auth_user_id: null }).eq('id', memberId)
    if (error) toast.error(error.message)
    else { toast.success('Compte dissocié'); window.location.reload() }
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Associez les comptes (créés via la page de connexion) aux profils membres. Un membre sans compte associé ne peut pas se connecter à l'app.
      </p>

      <h3 className="font-semibold text-sm mb-2 text-amber-600">Membres sans compte ({members.length})</h3>
      {members.length === 0 ? (
        <p className="text-xs text-gray-400 mb-4">Tous les membres ont un compte associé</p>
      ) : (
        <div className="space-y-1 mb-6">
          {members.map(m => (
            <div key={m.id} className="card p-3 flex items-center gap-3 border-l-4 border-l-amber-400">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{m.first_name} {m.last_name}</div>
                <div className="text-xs text-gray-500">{m.email || m.phone || 'Pas d\'email'}</div>
              </div>
              <button onClick={() => linkAccount(m.id, m.email)} className="btn-primary text-xs py-1.5">Associer un compte</button>
            </div>
          ))}
        </div>
      )}

      <h3 className="font-semibold text-sm mb-2 text-green-600">Comptes actifs ({linkedMembers.length})</h3>
      <div className="space-y-1">
        {linkedMembers.map(m => (
          <div key={m.id} className="card p-3 flex items-center gap-3 border-l-4 border-l-green-400">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{m.first_name} {m.last_name}</div>
              <div className="text-xs text-gray-500">{m.email || '—'} · {m.role}</div>
            </div>
            <span className="badge badge-green text-[10px]">Connecté</span>
            <button onClick={() => unlinkAccount(m.id)} className="text-xs text-red-500 hover:underline">Dissocier</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// GESTION CORAN (Cycles + Distribution)
// ============================================
function AdminCoran({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [cycles, setCycles] = useState<any[]>([])
  const [activeCycle, setActiveCycle] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [mode, setMode] = useState('SEQUENTIAL')
  const [creating, setCreating] = useState(false)
  const [eligibleCount, setEligibleCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('reading_cycle').select('*').eq('tenant_id', tenantId).order('cycle_number', { ascending: false }).limit(10)
      setCycles(data || [])
      const active = data?.find(c => c.status === 'ACTIVE')
      setActiveCycle(active || null)
      if (active) {
        const { data: a } = await supabase.from('hizb_assignment').select('*, member(first_name, last_name)').eq('cycle_id', active.id).order('hizb_number')
        setAssignments(a || [])
      }
      const { count } = await supabase.from('member').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_eligible_quran', true).in('status', ['AC', 'HC'])
      setEligibleCount(count || 0)
    })()
  }, [])

  async function createCycle() {
    setCreating(true)
    const lastNum = cycles[0]?.cycle_number || 0
    const now = new Date()
    const { data: newCycle, error } = await supabase.from('reading_cycle').insert({
      tenant_id: tenantId, cycle_number: lastNum + 1,
      week_label: `Semaine ${Math.ceil((now.getTime() - new Date(now.getFullYear(),0,1).getTime()) / 604800000)} — ${now.getFullYear()}`,
      distribution_mode: mode, starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
      status: 'ACTIVE', created_by: adminId,
    }).select().single()
    if (error) { toast.error(error.message); setCreating(false); return }

    // Distribute 60 hizbs
    const { data: members } = await supabase.from('member').select('id').eq('tenant_id', tenantId).eq('is_eligible_quran', true).in('status', ['AC', 'HC']).order('membership_date')
    if (!members?.length) { toast.error('Aucun membre éligible'); setCreating(false); return }
    const hizbs = Array.from({ length: 60 }, (_, i) => i + 1)
    if (mode === 'RANDOM_BALANCED') { for (let i = hizbs.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [hizbs[i],hizbs[j]]=[hizbs[j],hizbs[i]] } }
    const assigns = hizbs.map((h, i) => ({
      tenant_id: tenantId, cycle_id: newCycle.id, member_id: members[i % members.length].id,
      hizb_number: h, is_carryover: false, status: 'ASSIGNED',
    }))
    await supabase.from('hizb_assignment').insert(assigns)
    toast.success(`Cycle ${lastNum + 1} créé avec ${assigns.length} Hizbs distribués à ${members.length} membres`)
    setCreating(false)
    window.location.reload()
  }

  async function closeCycle() {
    if (!activeCycle || !confirm('Clôturer ce cycle ? Les Hizbs non validés deviendront des reliquats.')) return
    await supabase.from('hizb_assignment').update({ status: 'EXPIRED' }).eq('cycle_id', activeCycle.id).eq('status', 'ASSIGNED')
    await supabase.from('reading_cycle').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('id', activeCycle.id)
    toast.success('Cycle clôturé')
    window.location.reload()
  }

  const validated = assignments.filter(a => a.status === 'VALIDATED').length
  const pending = assignments.filter(a => a.status === 'ASSIGNED').length

  return (
    <div>
      {activeCycle ? (
        <>
          <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">Cycle {activeCycle.cycle_number} — {activeCycle.week_label}</h3>
                <p className="text-xs text-gray-500">Mode : {activeCycle.distribution_mode} · {eligibleCount} membres éligibles</p>
              </div>
              <button onClick={closeCycle} className="btn-secondary text-xs text-red-500">Clôturer</button>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${assignments.length ? (validated/assignments.length)*100 : 0}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="text-green-600 font-medium">{validated} validés</span>
              <span className="text-amber-600">{pending} en attente</span>
              <span>{assignments.filter(a => a.is_carryover).length} reliquats</span>
            </div>
          </div>
          <h3 className="font-semibold text-sm mb-2">Détail des attributions</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {assignments.map(a => (
              <div key={a.id} className={`card p-2 text-center text-xs ${
                a.status === 'VALIDATED' ? 'bg-green-50 border-green-200' :
                a.is_carryover ? 'bg-amber-50 border-amber-200' : ''}`}>
                <div className="font-bold text-lg">{a.hizb_number}</div>
                <div className="truncate text-gray-500">{a.member?.first_name} {a.member?.last_name?.[0]}.</div>
                <div className={a.status === 'VALIDATED' ? 'text-green-600' : 'text-gray-400'}>{a.status === 'VALIDATED' ? '✓' : a.is_carryover ? '↻' : '—'}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Lancer un nouveau cycle de lecture</h3>
          <p className="text-sm text-gray-500 mb-4">{eligibleCount} membres éligibles (6+ mois d'ancienneté, statut AC ou HC)</p>
          <div className="space-y-2 mb-4">
            {[
              { v: 'SEQUENTIAL', l: 'Rotation séquentielle', d: 'Hizb 1→60, chaque membre à tour de rôle' },
              { v: 'RANDOM_BALANCED', l: 'Aléatoire équilibré', d: 'Distribution aléatoire, évite les répétitions' },
              { v: 'MANUAL', l: 'Manuel', d: 'Attribution manuelle de chaque Hizb' },
            ].map(opt => (
              <label key={opt.v} className={`block p-3 rounded-lg border cursor-pointer transition-all ${mode === opt.v ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                <input type="radio" name="mode" value={opt.v} checked={mode===opt.v} onChange={() => setMode(opt.v)} className="sr-only" />
                <div className="font-medium text-sm">{opt.l}</div>
                <div className="text-xs text-gray-500">{opt.d}</div>
              </label>
            ))}
          </div>
          <button onClick={createCycle} disabled={creating} className="btn-primary w-full">
            {creating ? 'Création...' : `Lancer le cycle (${eligibleCount} membres)`}
          </button>
        </div>
      )}

      {cycles.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-sm mb-2">Historique des cycles</h3>
          <div className="space-y-1">
            {cycles.filter(c => c.status === 'CLOSED').map(c => (
              <div key={c.id} className="card p-3 flex items-center justify-between text-sm">
                <span>Cycle {c.cycle_number} — {c.week_label}</span>
                <span className="badge badge-gray">{c.distribution_mode}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// COTISATIONS (Pointage complet)
// ============================================
function AdminCotisations({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [members, setMembers] = useState<any[]>([])
  const [contribs, setContribs] = useState<any[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [memberAmounts, setMemberAmounts] = useState<Record<string, number>>({})
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from('member').select('*').eq('tenant_id', tenantId).in('status', ['AC', 'HC']).order('last_name')
      setMembers(m || [])
      const { data: c } = await supabase.from('contribution').select('*').eq('tenant_id', tenantId).eq('year', year).eq('month', month)
      setContribs(c || [])
      // Charger les montants existants
      const amounts: Record<string, number> = {}
      c?.forEach(co => { amounts[co.member_id] = Number(co.amount) })
      setMemberAmounts(amounts)
    })()
  }, [year, month])

  function getContrib(memberId: string) {
    return contribs.find(c => c.member_id === memberId)
  }

  function getStatus(memberId: string) {
    return getContrib(memberId)?.status || 'PENDING'
  }

  function getAmount(memberId: string) {
    if (memberAmounts[memberId] !== undefined) return memberAmounts[memberId]
    const existing = getContrib(memberId)
    return existing ? Number(existing.amount) : 0
  }

  async function setContribStatus(memberId: string, status: string, customAmount?: number) {
    const amt = customAmount !== undefined ? customAmount : getAmount(memberId)
    const existing = getContrib(memberId)
    if (existing) {
      await supabase.from('contribution').update({
        status, amount: status === 'PAID' ? amt : 0,
        paid_at: status === 'PAID' ? new Date().toISOString() : null, recorded_by: adminId,
      }).eq('id', existing.id)
    } else {
      await supabase.from('contribution').insert({
        tenant_id: tenantId, member_id: memberId, year, month,
        amount: status === 'PAID' ? amt : 0,
        status, paid_at: status === 'PAID' ? new Date().toISOString() : null, recorded_by: adminId,
      })
    }
    const { data: c } = await supabase.from('contribution').select('*').eq('tenant_id', tenantId).eq('year', year).eq('month', month)
    setContribs(c || [])
    toast.success('Cotisation mise à jour')
  }

  const paid = members.filter(m => getStatus(m.id) === 'PAID').length
  const totalCollected = contribs.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="input w-auto" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="input w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs text-gray-500 ml-auto">{paid}/{members.length} payés · Total : <strong>{formatCFA(totalCollected)}</strong></span>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Le montant est libre et individuel pour chaque membre. Saisissez le montant payé puis cliquez "Payé".
      </p>

      <div className="space-y-1">
        {members.map(m => {
          const st = getStatus(m.id)
          const amt = getAmount(m.id)
          return (
            <div key={m.id} className="card p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{m.first_name} {m.last_name}</div>
              </div>
              <input
                type="number"
                className="input w-24 text-right text-sm py-1"
                placeholder="Montant"
                value={memberAmounts[m.id] ?? amt || ''}
                onChange={e => setMemberAmounts({ ...memberAmounts, [m.id]: Number(e.target.value) })}
              />
              <span className="text-[10px] text-gray-400 w-4">F</span>
              <div className="flex gap-1">
                {(['PAID','PENDING','LATE','EXEMPT'] as const).map(s => (
                  <button key={s} onClick={() => setContribStatus(m.id, s, memberAmounts[m.id])}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                      st === s ? (s==='PAID'?'bg-green-500 text-white':s==='LATE'?'bg-red-500 text-white':s==='EXEMPT'?'bg-blue-500 text-white':'bg-amber-500 text-white')
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {s === 'PAID' ? 'Payé' : s === 'LATE' ? 'Retard' : s === 'EXEMPT' ? 'Exon.' : 'Att.'}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// DONS (Hadya)
// ============================================
function AdminDons({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [dons, setDons] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState({ member_id: '', amount: '', category: 'HADYA', description: '' })
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from('donation').select('*, member(first_name, last_name)').eq('tenant_id', tenantId).order('received_at', { ascending: false }).limit(50)
      setDons(d || [])
      const { data: m } = await supabase.from('member').select('id, first_name, last_name').eq('tenant_id', tenantId).order('last_name')
      setMembers(m || [])
    })()
  }, [])

  async function addDon() {
    if (!form.amount) { toast.error('Montant requis'); return }
    const { error } = await supabase.from('donation').insert({
      tenant_id: tenantId, member_id: form.member_id || null,
      amount: Number(form.amount), category: form.category,
      description: form.description, recorded_by: adminId,
    })
    if (error) toast.error(error.message)
    else { toast.success('Don enregistré'); setAdding(false); setForm({ member_id: '', amount: '', category: 'HADYA', description: '' }); window.location.reload() }
  }

  const total = dons.reduce((s, d) => s + Number(d.amount), 0)
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">Total : <strong className="text-lg text-brand-500">{formatCFA(total)}</strong></div>
        <button onClick={() => setAdding(!adding)} className="btn-primary text-sm">+ Nouveau don</button>
      </div>
      {adding && (
        <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Membre</label><select className="input" value={form.member_id} onChange={e => setForm({...form,member_id:e.target.value})}>
              <option value="">Anonyme</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select></div>
            <div><label className="text-xs text-gray-500">Montant (FCFA) *</label><input type="number" className="input" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">Catégorie</label><select className="input" value={form.category} onChange={e => setForm({...form,category:e.target.value})}>
              <option value="HADYA">Hadya</option><option value="SADAQA">Sadaqa</option><option value="ZAKAT">Zakat</option><option value="OTHER">Autre</option>
            </select></div>
            <div><label className="text-xs text-gray-500">Description</label><input className="input" value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addDon} className="btn-primary text-sm">Enregistrer</button>
            <button onClick={() => setAdding(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      )}
      <div className="space-y-1">
        {dons.map(d => (
          <div key={d.id} className="card p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium text-sm">{d.member ? `${d.member.first_name} ${d.member.last_name}` : 'Anonyme'}</div>
              <div className="text-xs text-gray-500">{d.description || d.category} · {new Date(d.received_at).toLocaleDateString('fr-FR')}</div>
            </div>
            <span className="font-bold text-brand-500">{formatCFA(d.amount)}</span>
            <span className="badge badge-green text-[10px]">{d.category}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// FONDS SOCIAL
// ============================================
function AdminFonds({ tenantId, adminId }: { tenantId: string; adminId: string }) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState({ type: 'IN', amount: '', reason: '', beneficiary_id: '' })
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from('social_fund').select('*, beneficiary:member!social_fund_beneficiary_id_fkey(first_name, last_name)').eq('tenant_id', tenantId).order('transaction_date', { ascending: false }).limit(50)
      setTransactions(t || [])
      const { data: m } = await supabase.from('member').select('id, first_name, last_name').eq('tenant_id', tenantId).order('last_name')
      setMembers(m || [])
    })()
  }, [])

  async function addTransaction() {
    if (!form.amount || !form.reason) { toast.error('Montant et motif requis'); return }
    const { error } = await supabase.from('social_fund').insert({
      tenant_id: tenantId, type: form.type, amount: Number(form.amount),
      reason: form.reason, beneficiary_id: form.beneficiary_id || null, approved_by: adminId,
    })
    if (error) toast.error(error.message)
    else { toast.success('Transaction enregistrée'); setAdding(false); window.location.reload() }
  }

  const totalIn = transactions.filter(t => t.type === 'IN').reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = transactions.filter(t => t.type === 'OUT').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4 bg-green-50"><div className="text-lg font-bold text-green-700">{formatCFA(totalIn)}</div><div className="text-xs text-green-600">Entrées</div></div>
        <div className="card p-4 bg-red-50"><div className="text-lg font-bold text-red-700">{formatCFA(totalOut)}</div><div className="text-xs text-red-600">Sorties</div></div>
        <div className="card p-4 bg-blue-50"><div className="text-lg font-bold text-blue-700">{formatCFA(totalIn - totalOut)}</div><div className="text-xs text-blue-600">Solde</div></div>
      </div>
      <button onClick={() => setAdding(!adding)} className="btn-primary text-sm mb-4">+ Nouvelle opération</button>
      {adding && (
        <div className="card p-4 mb-4 border-l-4 border-l-brand-500">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Type</label><select className="input" value={form.type} onChange={e => setForm({...form,type:e.target.value})}>
              <option value="IN">Entrée</option><option value="OUT">Sortie</option>
            </select></div>
            <div><label className="text-xs text-gray-500">Montant *</label><input type="number" className="input" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500">Motif *</label><input className="input" value={form.reason} onChange={e => setForm({...form,reason:e.target.value})} /></div>
            {form.type === 'OUT' && (
              <div><label className="text-xs text-gray-500">Bénéficiaire</label><select className="input" value={form.beneficiary_id} onChange={e => setForm({...form,beneficiary_id:e.target.value})}>
                <option value="">—</option>{members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select></div>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addTransaction} className="btn-primary text-sm">Enregistrer</button>
            <button onClick={() => setAdding(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      )}
      <div className="space-y-1">
        {transactions.map(t => (
          <div key={t.id} className={`card p-3 flex items-center gap-3 border-l-4 ${t.type === 'IN' ? 'border-l-green-400' : 'border-l-red-400'}`}>
            <div className="flex-1">
              <div className="font-medium text-sm">{t.reason}</div>
              <div className="text-xs text-gray-500">{t.beneficiary ? `→ ${t.beneficiary.first_name} ${t.beneficiary.last_name}` : ''} · {new Date(t.transaction_date).toLocaleDateString('fr-FR')}</div>
            </div>
            <span className={`font-bold ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'IN' ? '+' : '-'}{formatCFA(t.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// PARAMÈTRES
// ============================================
function AdminParametres({ tenantId }: { tenantId: string }) {
  const [tenant, setTenant] = useState<any>(null)
  const [settings, setSettings] = useState<any>({})
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenant').select('*').eq('id', tenantId).single()
      setTenant(data)
      setSettings(data?.settings || {})
    })()
  }, [])

  async function saveSettings() {
    const { error } = await supabase.from('tenant').update({
      name: tenant.name, city: tenant.city, settings,
    }).eq('id', tenantId)
    if (error) toast.error(error.message)
    else toast.success('Paramètres sauvegardés')
  }

  if (!tenant) return <div className="text-center py-8 text-gray-400">Chargement...</div>
  return (
    <div>
      <div className="card p-4 mb-4">
        <h3 className="font-semibold text-sm mb-3">Informations de la communauté</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Nom de la communauté</label><input className="input" value={tenant.name||''} onChange={e => setTenant({...tenant,name:e.target.value})} /></div>
          <div><label className="text-xs text-gray-500">Ville</label><input className="input" value={tenant.city||''} onChange={e => setTenant({...tenant,city:e.target.value})} /></div>
          <div><label className="text-xs text-gray-500">Slug (identifiant URL)</label><input className="input bg-gray-100" value={tenant.slug||''} disabled /></div>
          <div><label className="text-xs text-gray-500">Pays</label><input className="input" value={tenant.country||''} onChange={e => setTenant({...tenant,country:e.target.value})} /></div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="font-semibold text-sm mb-3">Configuration métier</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Devise</label><input className="input" value={settings.currency||'XOF'} onChange={e => setSettings({...settings,currency:e.target.value})} /></div>
          <div><label className="text-xs text-gray-500">Montant cotisation (FCFA)</label><input type="number" className="input" value={settings.cotisation_amount||1000} onChange={e => setSettings({...settings,cotisation_amount:Number(e.target.value)})} /></div>
          <div><label className="text-xs text-gray-500">Mois d'éligibilité Coran</label><input type="number" className="input" value={settings.eligibility_months||6} onChange={e => setSettings({...settings,eligibility_months:Number(e.target.value)})} /></div>
          <div><label className="text-xs text-gray-500">Fuseau horaire</label><input className="input" value={settings.timezone||'Africa/Dakar'} onChange={e => setSettings({...settings,timezone:e.target.value})} /></div>
          <div><label className="text-xs text-gray-500">Jour début cycle (0=dim, 5=ven)</label><input type="number" className="input" value={settings.cycle_start_day||5} onChange={e => setSettings({...settings,cycle_start_day:Number(e.target.value)})} /></div>
          <div><label className="text-xs text-gray-500">Jour fin cycle (4=jeu)</label><input type="number" className="input" value={settings.cycle_end_day||4} onChange={e => setSettings({...settings,cycle_end_day:Number(e.target.value)})} /></div>
        </div>
      </div>

      <button onClick={saveSettings} className="btn-primary">Sauvegarder les paramètres</button>
    </div>
  )
}
