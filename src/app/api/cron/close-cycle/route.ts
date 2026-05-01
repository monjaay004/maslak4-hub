import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Sécuriser l'appel CRON avec un secret
const CRON_SECRET = process.env.CRON_SECRET || 'maslak4-cron-secret'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const tenantSlug = body.tenant || 'maslak-4'

  const { data: tenant } = await supabase
    .from('tenant')
    .select('*')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  try {
    const result = await closeAndRedistribute(supabase, tenant)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('CRON error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function closeAndRedistribute(supabase: any, tenant: any) {
  const tenantId = tenant.id
  const settings = tenant.settings || {}

  // 1. Trouver le cycle actif
  const { data: activeCycle } = await supabase
    .from('reading_cycle')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'ACTIVE')
    .single()

  if (!activeCycle) {
    return { action: 'none', reason: 'Aucun cycle actif' }
  }

  // 2. Identifier les Hizbs non validés
  const { data: expiredAssignments } = await supabase
    .from('hizb_assignment')
    .select('*')
    .eq('cycle_id', activeCycle.id)
    .eq('status', 'ASSIGNED')

  // 3. Marquer comme EXPIRED
  if (expiredAssignments && expiredAssignments.length > 0) {
    await supabase
      .from('hizb_assignment')
      .update({ status: 'EXPIRED' })
      .eq('cycle_id', activeCycle.id)
      .eq('status', 'ASSIGNED')
  }

  // 4. Fermer le cycle actif
  await supabase
    .from('reading_cycle')
    .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
    .eq('id', activeCycle.id)

  // 5. Créer le nouveau cycle
  const now = new Date()
  const weekNum = getWeekNumber(now)
  const newCycleNumber = activeCycle.cycle_number + 1

  const { data: newCycle } = await supabase
    .from('reading_cycle')
    .insert({
      tenant_id: tenantId,
      cycle_number: newCycleNumber,
      week_label: `Semaine ${weekNum} — ${now.getFullYear()}`,
      distribution_mode: activeCycle.distribution_mode,
      starts_at: getNextFriday().toISOString(),
      ends_at: getNextThursday().toISOString(),
      status: 'ACTIVE',
      created_by: null,
    })
    .select()
    .single()

  // 6. Créer les reliquats (MÊMES membres, MÊMES hizbs)
  const carryovers = (expiredAssignments || []).map((ea: any) => ({
    tenant_id: tenantId,
    cycle_id: newCycle.id,
    member_id: ea.member_id,
    hizb_number: ea.hizb_number,
    is_carryover: true,
    source_cycle_id: activeCycle.id,
    status: 'ASSIGNED',
  }))

  if (carryovers.length > 0) {
    await supabase.from('hizb_assignment').insert(carryovers)
  }

  // 7. Distribuer les Hizbs restants
  const carryoverHizbNumbers = new Set(carryovers.map((c: any) => c.hizb_number))

  const { data: eligibleMembers } = await supabase
    .from('member')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_eligible_quran', true)
    .in('status', ['AC', 'HC'])
    .order('membership_date')

  const remainingHizbs: number[] = []
  for (let h = 1; h <= 60; h++) {
    if (!carryoverHizbNumbers.has(h)) remainingHizbs.push(h)
  }

  let newAssignments: any[] = []

  switch (activeCycle.distribution_mode) {
    case 'SEQUENTIAL':
      newAssignments = distributeSequential(
        tenantId, newCycle.id, eligibleMembers || [], remainingHizbs, activeCycle
      )
      break
    case 'RANDOM_BALANCED':
      newAssignments = distributeRandom(
        tenantId, newCycle.id, eligibleMembers || [], remainingHizbs
      )
      break
    case 'MANUAL':
      // En mode manuel, on ne distribue rien automatiquement
      break
    default:
      newAssignments = distributeSequential(
        tenantId, newCycle.id, eligibleMembers || [], remainingHizbs, activeCycle
      )
  }

  if (newAssignments.length > 0) {
    await supabase.from('hizb_assignment').insert(newAssignments)
  }

  // 8. Sauvegarder l'historique
  const allAssignments = [...carryovers, ...newAssignments]
  if (allAssignments.length > 0) {
    await supabase.from('distribution_history').insert(
      allAssignments.map((a: any) => ({
        tenant_id: tenantId,
        member_id: a.member_id,
        hizb_number: a.hizb_number,
        cycle_id: newCycle.id,
      }))
    )
  }

  return {
    action: 'closed_and_redistributed',
    closed_cycle: activeCycle.cycle_number,
    new_cycle: newCycleNumber,
    expired: expiredAssignments?.length || 0,
    carryovers: carryovers.length,
    new_assignments: newAssignments.length,
    total: allAssignments.length,
  }
}

// === ALGORITHMES DE DISTRIBUTION ===

function distributeSequential(
  tenantId: string, cycleId: string,
  members: any[], hizbs: number[],
  previousCycle: any
): any[] {
  if (members.length === 0 || hizbs.length === 0) return []

  const assignments: any[] = []
  hizbs.forEach((hizb, i) => {
    const member = members[i % members.length]
    assignments.push({
      tenant_id: tenantId,
      cycle_id: cycleId,
      member_id: member.id,
      hizb_number: hizb,
      is_carryover: false,
      status: 'ASSIGNED',
    })
  })
  return assignments
}

function distributeRandom(
  tenantId: string, cycleId: string,
  members: any[], hizbs: number[]
): any[] {
  if (members.length === 0 || hizbs.length === 0) return []

  // Mélanger les hizbs (Fisher-Yates)
  const shuffled = [...hizbs]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const assignments: any[] = []
  shuffled.forEach((hizb, i) => {
    const member = members[i % members.length]
    assignments.push({
      tenant_id: tenantId,
      cycle_id: cycleId,
      member_id: member.id,
      hizb_number: hizb,
      is_carryover: false,
      status: 'ASSIGNED',
    })
  })
  return assignments
}

// === UTILS ===

function getNextFriday(): Date {
  const d = new Date()
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7))
  d.setHours(13, 0, 0, 0) // Vendredi 13h (après Jumu'a)
  return d
}

function getNextThursday(): Date {
  const friday = getNextFriday()
  const d = new Date(friday)
  d.setDate(d.getDate() + 6) // Jeudi suivant
  d.setHours(23, 59, 0, 0)
  return d
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime()
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}
