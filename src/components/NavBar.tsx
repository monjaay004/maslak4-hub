'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Member } from '@/lib/types'

const memberLinks = [
  { href: '/dashboard', label: 'Accueil', icon: '🏠' },
  { href: '/coran', label: 'Coran', icon: '📖' },
  { href: '/finance', label: 'Finance', icon: '💰' },
  { href: '/membres', label: 'Membres', icon: '👥' },
]

const adminLinks = [
  { href: '/admin', label: 'Admin', icon: '⚙️' },
]

export function NavBar({ member, isAdmin }: { member: Member; isAdmin: boolean }) {
  const pathname = usePathname()
  const links = isAdmin ? [...memberLinks, ...adminLinks] : memberLinks

  return (
    <>
      {/* Mobile: bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 md:hidden">
        <div className="flex justify-around py-2">
          {links.map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors',
                  active ? 'text-brand-500 font-medium' : 'text-gray-400'
                )}
              >
                <span className="text-lg">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop: sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-brand-800 text-white">
        <div className="p-6 border-b border-brand-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center font-bold text-sm">
              M4
            </div>
            <div>
              <div className="font-semibold text-sm">Maslak 4</div>
              <div className="text-brand-300 text-xs">Digital HUB</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {links.map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  active ? 'bg-brand-500 text-white' : 'text-brand-200 hover:bg-brand-700'
                )}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-brand-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-xs font-medium">
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {member.first_name} {member.last_name}
              </div>
              <div className="text-brand-300 text-xs truncate">{member.role}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
