import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavBar } from '@/components/NavBar'

// Normalise un numéro de téléphone pour comparaison
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/[^0-9]/g, '').replace(/^0+/, '')
}

// Normalise un nom pour comparaison (sans accents, minuscules, sans espaces extra)
function normalizeName(name: string | null | undefined): string {
  if (!name) return ''
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminDb = createAdminClient()

  // Récupérer le profil membre déjà lié à ce compte auth
  let { data: member } = await adminDb
    .from('member')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  // AUTO-CRÉATION ou LIAISON INTELLIGENTE
  if (!member) {
    const { data: tenant } = await adminDb
      .from('tenant')
      .select('id')
      .eq('slug', process.env.DEFAULT_TENANT_SLUG || 'maslak-4')
      .single()

    if (tenant) {
      const meta = user.user_metadata || {}
      const newFirstName = meta.first_name || (user.email?.split('@')[0] || 'Nouveau')
      const newLastName = meta.last_name || 'Membre'
      const newPhone = meta.whatsapp || user.phone || null

      // 🔍 RECHERCHE DE PRÉCOMPTE CORRESPONDANT
      // Étape 1 : chercher tous les précomptes (membres sans auth_user_id)
      const { data: precomptes } = await adminDb
        .from('member')
        .select('*')
        .eq('tenant_id', tenant.id)
        .is('auth_user_id', null)

      let matchedPrecompte = null

      if (precomptes?.length) {
        const normPhone = normalizePhone(newPhone)
        const normFirstName = normalizeName(newFirstName)
        const normLastName = normalizeName(newLastName)

        // Priorité 1 : match par numéro de téléphone (le plus fiable)
        if (normPhone && normPhone.length >= 8) {
          matchedPrecompte = precomptes.find(p => {
            const pPhone = normalizePhone(p.phone)
            const pWa = normalizePhone(p.whatsapp)
            return (pPhone && (pPhone === normPhone || pPhone.endsWith(normPhone) || normPhone.endsWith(pPhone))) ||
                   (pWa && (pWa === normPhone || pWa.endsWith(normPhone) || normPhone.endsWith(pWa)))
          })
        }

        // Priorité 2 : match exact par nom + prénom
        if (!matchedPrecompte && normFirstName && normLastName) {
          matchedPrecompte = precomptes.find(p =>
            normalizeName(p.first_name) === normFirstName &&
            normalizeName(p.last_name) === normLastName
          )
        }

        // Priorité 3 : match partiel par nom (last_name) ET premier prénom
        if (!matchedPrecompte && normFirstName && normLastName) {
          const firstFirstName = normFirstName.split(' ')[0]
          matchedPrecompte = precomptes.find(p => {
            const pFirstName = normalizeName(p.first_name).split(' ')[0]
            return normalizeName(p.last_name) === normLastName && pFirstName === firstFirstName
          })
        }
      }

      if (matchedPrecompte) {
        // 🔗 LIAISON : on lie le compte auth au précompte existant + on enrichit avec les infos manquantes
        const updates: any = {
          auth_user_id: user.id,
          email: matchedPrecompte.email || user.email,
        }
        if (!matchedPrecompte.phone && newPhone) updates.phone = newPhone
        if (!matchedPrecompte.whatsapp && newPhone) updates.whatsapp = newPhone

        const { data: linkedMember } = await adminDb
          .from('member')
          .update(updates)
          .eq('id', matchedPrecompte.id)
          .select()
          .single()

        member = linkedMember

        // Notifier les admins de la liaison
        const { data: admins } = await adminDb.from('member').select('id').eq('tenant_id', tenant.id).in('role', ['admin', 'super_admin'])
        if (admins?.length && linkedMember) {
          await adminDb.from('notification').insert(
            admins.map(a => ({
              tenant_id: tenant.id,
              member_id: a.id,
              type: 'PRECOMPTE_LINKED',
              title: '🔗 Précompte associé à un compte',
              body: `${linkedMember.first_name} ${linkedMember.last_name} (${user.email}) s'est connecté et a été automatiquement lié à son précompte existant.`,
              data: { member_id: linkedMember.id, email: user.email },
            }))
          )
        }
      } else {
        // 🆕 CRÉATION D'UN NOUVEAU PROFIL si aucun précompte ne correspond
        const { data: newMember } = await adminDb
          .from('member')
          .insert({
            tenant_id: tenant.id,
            auth_user_id: user.id,
            first_name: newFirstName.charAt(0).toUpperCase() + newFirstName.slice(1),
            last_name: newLastName,
            email: user.email,
            phone: newPhone,
            whatsapp: newPhone,
            membership_date: new Date().toISOString().split('T')[0],
            status: 'AC',
            role: 'member',
          })
          .select()
          .single()

        member = newMember

        // Notifier les admins du nouveau membre
        if (newMember) {
          const { data: admins } = await adminDb.from('member').select('id').eq('tenant_id', tenant.id).in('role', ['admin', 'super_admin'])
          if (admins?.length) {
            await adminDb.from('notification').insert(
              admins.map(a => ({
                tenant_id: tenant.id,
                member_id: a.id,
                type: 'NEW_MEMBER',
                title: '🆕 Nouveau membre inscrit',
                body: `${newMember.first_name} ${newMember.last_name} (${user.email}) vient de créer un compte. Aucun précompte correspondant trouvé. Vérifiez et mettez à jour son profil.`,
                data: { new_member_id: newMember.id, email: user.email },
              }))
            )
          }
        }
      }
    }

    if (!member) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="card p-8 text-center max-w-sm">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center"><span className="text-2xl">❌</span></div>
            <h2 className="text-lg font-semibold mb-2">Erreur</h2>
            <p className="text-sm text-gray-600">Impossible de créer votre profil. Contactez l'administrateur.</p>
          </div>
        </div>
      )
    }
  }

  const isAdmin = ['admin', 'super_admin'].includes(member.role)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 md:pl-64">
      <NavBar member={member} isAdmin={isAdmin} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
