import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavBar } from '@/components/NavBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Utiliser le client admin pour bypass RLS
  const adminDb = createAdminClient()

  // Récupérer le profil membre
  let { data: member } = await adminDb
    .from('member')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  // AUTO-CRÉATION : Si pas de profil, en créer un automatiquement
  if (!member) {
    const { data: tenant } = await adminDb
      .from('tenant')
      .select('id')
      .eq('slug', process.env.DEFAULT_TENANT_SLUG || 'maslak-4')
      .single()

    if (tenant) {
      const emailName = user.email?.split('@')[0] || 'Nouveau'
      const { data: newMember } = await adminDb
        .from('member')
        .insert({
          tenant_id: tenant.id,
          auth_user_id: user.id,
          first_name: emailName.charAt(0).toUpperCase() + emailName.slice(1),
          last_name: 'Membre',
          email: user.email,
          phone: user.phone || null,
          whatsapp: user.phone || null,
          membership_date: new Date().toISOString().split('T')[0],
          status: 'AC',
          role: 'member',
        })
        .select()
        .single()

      member = newMember
    }

    if (!member) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="card p-8 text-center max-w-sm">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
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
