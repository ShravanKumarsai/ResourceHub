import {
  Activity,
  ArrowLeftRight,
  Building2,
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  PlusCircle,
  Search,
  ShieldAlert,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from './types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  heading: string
  items: NavItem[]
}

export const NAV: Record<Role, NavGroup[]> = {
  student: [
    {
      heading: 'Discover',
      items: [
        { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/student/explore', label: 'Explore resources', icon: Search },
      ],
    },
    {
      heading: 'My activity',
      items: [
        { href: '/student/bookings', label: 'My bookings', icon: CalendarCheck },
        { href: '/student/handover', label: 'Check-in / Check-out', icon: ArrowLeftRight },
        { href: '/student/incidents', label: 'Incident reports', icon: ShieldAlert },
        { href: '/student/activity', label: 'Activity history', icon: Activity },
      ],
    },
    {
      heading: 'Account',
      items: [{ href: '/student/profile', label: 'Profile', icon: UserRound }],
    },
  ],
  owner: [
    {
      heading: 'Overview',
      items: [{ href: '/owner/dashboard', label: 'Overview', icon: LayoutDashboard }],
    },
    {
      heading: 'Resource management',
      items: [
        { href: '/owner/resources', label: 'My Resources', icon: FlaskConical },
        { href: '/owner/resources/new', label: 'Add resource', icon: PlusCircle },
      ],
    },
    {
      heading: 'Operations',
      items: [
        { href: '/owner/requests', label: 'Booking Requests', icon: ClipboardList },
        { href: '/owner/handover', label: 'Handover', icon: ArrowLeftRight },
        { href: '/owner/incidents', label: 'Incidents', icon: ShieldAlert },
        { href: '/owner/activity', label: 'Activity', icon: Activity },
      ],
    },
    {
      heading: 'Account',
      items: [{ href: '/owner/profile', label: 'My Profile', icon: UserRound }],
    },
  ],
  institution: [
    {
      heading: 'Workspace',
      items: [
        { href: '/institution/dashboard', label: 'Overview', icon: LayoutDashboard },
        { href: '/institution', label: 'Members', icon: UsersRound },
      ],
    },
    {
      heading: 'Verification',
      items: [{ href: '/institution/dashboard', label: 'Verification requests', icon: ClipboardList }],
    },
    {
      heading: 'Operations',
      items: [
        { href: '/institution/incidents', label: 'Incidents', icon: ShieldAlert },
        { href: '/institution/activity', label: 'Activity history', icon: Activity },
      ],
    },
    {
      heading: 'Account',
      items: [
        { href: '/institution/profile', label: 'My profile', icon: UserRound },
        { href: '/institution/dashboard#settings', label: 'Institution details', icon: Building2 },
      ],
    },
  ],
}

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Student / researcher',
  owner: 'Resource owner',
  institution: 'Institution admin',
}
