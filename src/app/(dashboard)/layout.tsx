import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavBar } from '@/components/NavBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Récupérer le profil membre
  const { data: member } = await supabase
    .from('member')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!member) {
    // L'utilisateur auth existe mais pas encore de profil membre
    // Rediriger vers une page d'attente ou créer le profil
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card p-8 text-center max-w-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">⏳</span>
          </div>
          <h2 className="text-lg font-semibold mb-2">Profil en attente</h2>
          <p className="text-sm text-gray-600">
            Votre compte a été créé mais l'administrateur doit d'abord associer votre
            numéro à un profil membre. Contactez l'admin de votre Maslak.
          </p>
        </div>
      </div>
    )
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
