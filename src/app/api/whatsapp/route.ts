import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const WA_TOKEN = process.env.WHATSAPP_TOKEN!
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID!
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!

// GET = vérification du webhook par Meta
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST = message entrant
export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createAdminClient()

  try {
    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]?.value
    const message = change?.messages?.[0]

    if (!message) return NextResponse.json({ ok: true })

    const phone = message.from
    const text = message.text?.body?.trim().toUpperCase() || ''

    // Logger le message
    await supabase.from('wa_message_log').insert({
      tenant_id: await getDefaultTenantId(supabase),
      phone,
      direction: 'IN',
      content: text,
      parsed_command: extractCommand(text),
    })

    // Trouver le membre
    const { data: member } = await supabase
      .from('member')
      .select('*')
      .or(`phone.eq.${phone},whatsapp.eq.${phone},phone.eq.+${phone},whatsapp.eq.+${phone}`)
      .single()

    if (!member) {
      await sendWA(phone, 'Numéro non reconnu. Contactez l\'administrateur de votre Maslak.')
      return NextResponse.json({ ok: true })
    }

    // Router les commandes
    if (text === 'VALIDER' || text.startsWith('VALIDER')) {
      await handleValider(supabase, member, text, phone)
    } else if (text === 'HIZB' || text === 'MES HIZBS') {
      await handleMesHizbs(supabase, member, phone)
    } else if (text === 'SOLDE') {
      await handleSolde(supabase, member, phone)
    } else {
      await sendWA(phone,
        `Salam ${member.first_name},\n\n` +
        `Commandes disponibles :\n` +
        `VALIDER — Valider vos Hizbs\n` +
        `HIZB — Voir vos Hizbs\n` +
        `SOLDE — Vos cotisations\n\n` +
        `Maslak 4 Digital HUB`
      )
    }
  } catch (err) {
    console.error('Webhook error:', err)
  }

  return NextResponse.json({ ok: true })
}

// === HANDLERS ===

async function handleValider(supabase: any, member: any, text: string, phone: string) {
  const { data: pending } = await supabase
    .from('hizb_assignment')
    .select('*, reading_cycle!inner(*)')
    .eq('member_id', member.id)
    .eq('status', 'ASSIGNED')
    .eq('reading_cycle.status', 'ACTIVE')
    .order('hizb_number')

  if (!pending || pending.length === 0) {
    await sendWA(phone, `Tous vos Hizbs sont validés cette semaine. Barakallahu Fik !`)
    return
  }

  // VALIDER 5 = valider le hizb 5 uniquement
  const hizbNum = parseInt(text.replace('VALIDER', '').trim())
  const toValidate = !isNaN(hizbNum)
    ? pending.filter((p: any) => p.hizb_number === hizbNum)
    : pending

  if (toValidate.length === 0) {
    await sendWA(phone, `Le Hizb ${hizbNum} ne fait pas partie de vos attributions.`)
    return
  }

  for (const a of toValidate) {
    await supabase.from('hizb_assignment').update({
      status: 'VALIDATED',
      validated_at: new Date().toISOString(),
      validated_via: 'WHATSAPP',
    }).eq('id', a.id)
  }

  const list = toValidate.map((a: any) => `Hizb ${a.hizb_number}`).join(', ')
  await sendWA(phone, `${toValidate.length} Hizb(s) validé(s) : ${list}\n\nJazakallahu Khayran !`)
}

async function handleMesHizbs(supabase: any, member: any, phone: string) {
  const { data: hizbs } = await supabase
    .from('hizb_assignment')
    .select('*, reading_cycle!inner(cycle_number, week_label)')
    .eq('member_id', member.id)
    .eq('reading_cycle.status', 'ACTIVE')
    .order('hizb_number')

  if (!hizbs || hizbs.length === 0) {
    await sendWA(phone, 'Aucun Hizb attribué cette semaine.')
    return
  }

  const lines = hizbs.map((h: any) => {
    const icon = h.status === 'VALIDATED' ? '✅' : h.is_carryover ? '⚠️' : '📖'
    return `${icon} Hizb ${h.hizb_number} — ${h.status === 'VALIDATED' ? 'Validé' : 'À lire'}${h.is_carryover ? ' (reliquat)' : ''}`
  })

  const validated = hizbs.filter((h: any) => h.status === 'VALIDATED').length
  await sendWA(phone,
    `📖 Vos Hizbs — Cycle ${hizbs[0].reading_cycle.cycle_number}\n\n` +
    lines.join('\n') +
    `\n\nProgression : ${validated}/${hizbs.length}\n` +
    `Tapez VALIDER pour valider.`
  )
}

async function handleSolde(supabase: any, member: any, phone: string) {
  const year = new Date().getFullYear()
  const { data: contribs } = await supabase
    .from('contribution')
    .select('*')
    .eq('member_id', member.id)
    .eq('year', year)

  const paid = contribs?.filter((c: any) => c.status === 'PAID').length || 0
  const currentMonth = new Date().getMonth() + 1
  const late = currentMonth - paid

  await sendWA(phone,
    `💰 Cotisations ${year}\n\n` +
    `Payé : ${paid}/${currentMonth} mois\n` +
    (late > 0 ? `En retard : ${late} mois\n` : 'Tout est à jour !\n') +
    `\nMaslak 4 Digital HUB`
  )
}

// === UTILS ===

async function sendWA(to: string, text: string) {
  const phone = to.startsWith('+') ? to.slice(1) : to
  await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: text },
    }),
  })
}

function extractCommand(text: string): string | null {
  if (text.startsWith('VALIDER')) return 'VALIDER'
  if (text === 'HIZB' || text === 'MES HIZBS') return 'HIZB'
  if (text === 'SOLDE') return 'SOLDE'
  if (text === 'HORAIRE') return 'HORAIRE'
  return null
}

async function getDefaultTenantId(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('tenant')
    .select('id')
    .eq('slug', process.env.DEFAULT_TENANT_SLUG || 'maslak-4')
    .single()
  return data?.id
}
