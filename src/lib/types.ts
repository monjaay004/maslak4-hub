export type MemberStatus = 'AC' | 'HC' | 'I' | 'HNC' | 'ANC' | 'EX'
export type MemberRole = 'member' | 'treasurer' | 'corrector' | 'imam' | 'admin' | 'super_admin'
export type ContributionStatus = 'PAID' | 'PENDING' | 'LATE' | 'EXEMPT'
export type CycleStatus = 'DRAFT' | 'ACTIVE' | 'CLOSING' | 'CLOSED'
export type DistributionMode = 'FIXED_GROUPS' | 'SEQUENTIAL' | 'RANDOM_BALANCED' | 'MANUAL'
export type HizbStatus = 'ASSIGNED' | 'VALIDATED' | 'EXPIRED' | 'REASSIGNED'
export type HadithSubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Member {
  id: string
  tenant_id: string
  auth_user_id: string | null
  first_name: string
  last_name: string
  gender: 'M' | 'F' | null
  date_of_birth: string | null
  address: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  profession: string | null
  photo_url: string | null
  membership_date: string
  status: MemberStatus
  role: MemberRole
  is_eligible_quran: boolean
  anciennete_mois: number
  created_at: string
  updated_at: string
}

export interface ReadingCycle {
  id: string
  tenant_id: string
  cycle_number: number
  week_label: string | null
  distribution_mode: DistributionMode
  starts_at: string
  ends_at: string
  status: CycleStatus
  total_hizbs: number
  validated_count: number
  created_at: string
}

export interface HizbAssignment {
  id: string
  tenant_id: string
  cycle_id: string
  member_id: string
  hizb_number: number
  is_carryover: boolean
  status: HizbStatus
  validated_at: string | null
  validated_via: 'WEB' | 'WHATSAPP' | null
  member?: Member
}

export interface Contribution {
  id: string
  tenant_id: string
  member_id: string
  year: number
  month: number
  amount: number
  status: ContributionStatus
  paid_at: string | null
  member?: Member
}

export interface CycleProgress {
  cycle_id: string
  tenant_id: string
  cycle_number: number
  week_label: string
  distribution_mode: DistributionMode
  total_hizbs: number
  total_assigned: number
  total_validated: number
  total_pending: number
  total_carryovers: number
  progress_pct: number
}

export const STATUS_LABELS: Record<MemberStatus, string> = {
  AC: 'Actif Cotisant',
  HC: 'Honoraire Cotisant',
  I: 'Inactif',
  HNC: 'Honoraire Non-Cotisant',
  ANC: 'Actif Non-Cotisant',
  EX: 'Exonéré',
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  member: 'Membre',
  treasurer: 'Trésorier',
  corrector: 'Correcteur',
  imam: 'Imam',
  admin: 'Administrateur',
  super_admin: 'Super Admin',
}

export const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
]
