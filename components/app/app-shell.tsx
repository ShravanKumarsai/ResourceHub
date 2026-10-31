'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Bell,
  ChevronRight,
  Command,
  LayoutDashboard,
  LogOut,
  Repeat,
  Search,
  UserRound,
} from 'lucide-react'

import { BrandLogo, LogoMark } from '@/components/brand-logo'
import { Avatar } from '@/components/app/avatar'
import { LogoutButton } from '@/components/auth/logout-actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { NAV, ROLE_LABEL } from '@/lib/nav'
import type { AccountIdentity } from '@/lib/identity'
import { useStore } from '@/lib/store'
import type { Role } from '@/lib/types'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

function isActive(pathname: string, href: string, all: string[]) {
  if (pathname === href) return true
  if (!pathname.startsWith(`${href}/`)) return false
  return !all.some((other) => other !== href && other.startsWith(`${href}/`) && pathname.startsWith(other))
}

function BrandHeader() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <div className="flex h-full items-center justify-between gap-2">
      {collapsed ? (
        <Link href="/" aria-label="ResourceHub home" className="flex size-9 items-center justify-center rounded-md hover:bg-surface">
          <LogoMark className="size-7" />
        </Link>
      ) : (
        <BrandLogo className="min-w-0" />
      )}
      <SidebarTrigger className="hidden md:inline-flex" aria-label="Collapse sidebar" />
    </div>
  )
}

function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const collapsed = state === 'collapsed'
  const allHrefs = NAV[role].flatMap((group) => group.items.map((item) => item.href))

  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
      {NAV[role].map((group) => (
        <div key={group.heading} className="mb-5 last:mb-0">
          {!collapsed && (
            <p className="text-ink-muted mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] uppercase">
              {group.heading}
            </p>
          )}
          <ul className="space-y-1.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, allHrefs)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => {
                      if (isMobile) setOpenMobile(false)
                    }}
                    className={cn(
                      'relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-teal focus-visible:outline-none',
                      collapsed ? 'justify-center px-0' : 'justify-start',
                      active
                        ? 'bg-teal-soft text-navy shadow-[inset_0_0_0_1px_rgba(22,125,141,0.08)]'
                        : 'text-ink-muted hover:bg-surface hover:text-navy',
                    )}
                  >
                    {active && (
                      <span className="bg-teal absolute top-2.5 bottom-2.5 left-1.5 w-[3px] rounded-full" aria-hidden="true" />
                    )}
                    <item.icon className={cn('size-[18px] shrink-0', active ? 'text-teal' : 'text-ink-muted')} aria-hidden="true" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Breadcrumbs({ role }: { role: Role }) {
  const pathname = usePathname()
  const { getResource } = useStore()
  const segments = pathname.split('/').filter(Boolean).slice(1)
  const labels: Record<string, string> = {
    dashboard: role === 'owner' ? 'Overview' : 'Dashboard',
    notifications: 'Notifications',
    explore: 'Explore resources',
    bookings: 'My bookings',
    handover: role === 'owner' ? 'Handover' : 'Check-in / Check-out',
    incidents: role === 'owner' ? 'Incidents' : 'Incident reports',
    activity: role === 'owner' ? 'Activity' : 'Activity history',
    profile: role === 'owner' ? 'My Profile' : 'Profile',
    resources: role === 'owner' ? 'My Resources' : 'My resources',
    requests: role === 'owner' ? 'Booking Requests' : 'Booking requests',
    new: 'Add resource',
    edit: 'Edit',
  }
  const label = (seg: string) => labels[seg] ?? getResource(seg)?.name ?? seg

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      <span className="text-ink-muted">{ROLE_LABEL[role]}</span>
      {segments.map((seg, index) => (
        <span key={`${seg}-${index}`} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="text-ink-muted size-3.5 shrink-0" aria-hidden="true" />
          <span
            className={cn('truncate', index === segments.length - 1 ? 'text-ink font-medium' : 'text-ink-muted')}
            aria-current={index === segments.length - 1 ? 'page' : undefined}
          >
            {label(seg)}
          </span>
        </span>
      ))}
    </nav>
  )
}

export function AppShell({
  role,
  userId,
  identity,
  children,
}: {
  role: Role
  userId: string
  identity: AccountIdentity
  children: React.ReactNode
}) {
  const user = identity
  const other: Role = role === 'student' ? 'owner' : role === 'owner' ? 'student' : 'student'
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function loadUnreadCount() {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null)

      if (error) {
        console.error('Could not load unread notifications.', error)
        return
      }
      if (active) setUnreadCount(count ?? 0)
    }

    void loadUnreadCount()
    const refresh = () => void loadUnreadCount()
    window.addEventListener('focus', refresh)
    window.addEventListener('resourcehub:notifications-updated', refresh)
    const interval = window.setInterval(refresh, 60_000)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('resourcehub:notifications-updated', refresh)
      window.clearInterval(interval)
    }
  }, [userId])

  return (
    <SidebarProvider defaultOpen className="bg-canvas">
      <Sidebar collapsible="icon" variant="sidebar" className="border-r border-line bg-white/90 backdrop-blur-xl">
        <SidebarHeader className="border-b border-line-muted h-16 px-3 py-0">
          <BrandHeader />
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          <SidebarNav role={role} />
        </SidebarContent>

        <SidebarFooter className="border-t border-line-muted p-3">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/70 p-2">
            <Avatar initials={user.initials} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-navy">{user.name}</p>
              <p className="text-ink-muted truncate text-[11px]">{user.institutionName ?? ROLE_LABEL[role]}</p>
            </div>
          </div>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent">
          <header className="border-line sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <SidebarTrigger className="md:hidden" aria-label="Open navigation" />

            <div className="hidden items-center gap-2 rounded-full border border-line bg-surface/80 px-2.5 py-1.5 md:flex">
              <LayoutDashboard className="size-3.5 text-teal" aria-hidden="true" />
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-muted">{ROLE_LABEL[role]}</span>
            </div>

            <Breadcrumbs role={role} />

            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="hidden gap-2 sm:inline-flex">
                <Search className="size-4" aria-hidden="true" />
                <span>Search</span>
                <span className="rounded border border-line bg-white/70 px-1 text-[10px] font-semibold text-ink-muted">⌘K</span>
              </Button>

              <Link
                href={`/${role}/notifications`}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                className="text-ink-muted hover:bg-surface hover:text-navy relative flex size-10 items-center justify-center rounded-md"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="bg-teal absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger className="hover:bg-surface focus-visible:ring-teal flex items-center gap-2.5 rounded-md py-1 pr-2 pl-1 focus-visible:ring-2 focus-visible:outline-none">
                  <Avatar initials={user.initials} />
                  <span className="hidden text-left sm:block">
                    <span className="block text-[13px] leading-4 font-semibold text-navy">{user.name}</span>
                    <span className="text-ink-muted block text-xs leading-4">{ROLE_LABEL[role]}</span>
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <span className="block text-sm font-semibold text-navy">{user.name}</span>
                      <span className="text-ink-muted block text-xs">{user.email}</span>
                      {user.institutionName ? (
                        <span className="text-ink-muted block text-xs">{user.institutionName}</span>
                      ) : null}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link href={`/${role}/profile`} className="flex items-center gap-2" />}>
                    <UserRound className="size-4" />
                    Profile
                  </DropdownMenuItem>
                  {role !== 'institution' ? (
                    <DropdownMenuItem render={<Link href={`/${other}/dashboard`} className="flex items-center gap-2" />}>
                      <Repeat className="size-4" />
                      Switch to {other === 'owner' ? 'resource owner' : 'student'} view
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => undefined} className="text-ink-muted">
                    <Command className="size-4" />
                    Command palette
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
