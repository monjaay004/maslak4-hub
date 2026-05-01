/**
 * Script d'import des membres existants
 * Usage : npm run import-members
 *
 * Lit le fichier list_membres_M4.xlsx et insère les membres dans Supabase.
 * À exécuter UNE SEULE FOIS lors du setup initial.
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Variables SUPABASE manquantes. Créez un fichier .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface RawMember {
  numero: number
  nom: string
  adresse: string
  telephone: string
  profession: string
  statut: string
}

async function importMembers() {
  // 1. Lire le fichier Excel
  const filePath = path.resolve(process.cwd(), 'data/list_membres_M4.xlsx')
  console.log(`📂 Lecture de ${filePath}...`)

  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })

  // Les données commencent à la ligne 3 (index 2) dans ce fichier
  // Colonnes : N°, Noms, adresses, téléphones, professions, statut
  const members: RawMember[] = []

  for (let i = 2; i < raw.length; i++) {
    const row = raw[i]
    if (!row || !row[1]) continue // Ignorer les lignes vides

    members.push({
      numero: row[0],
      nom: String(row[1] || '').trim(),
      adresse: String(row[2] || '').trim(),
      telephone: String(row[3] || '').trim(),
      profession: String(row[4] || '').trim(),
      statut: String(row[5] || 'AC').trim().toUpperCase(),
    })
  }

  console.log(`📋 ${members.length} membres trouvés dans le fichier`)

  // 2. Récupérer le tenant
  const { data: tenant } = await supabase
    .from('tenant')
    .select('id')
    .eq('slug', 'maslak-4')
    .single()

  if (!tenant) {
    console.error('❌ Tenant maslak-4 introuvable. Exécutez d\'abord le schéma SQL.')
    process.exit(1)
  }

  // 3. Parser et insérer chaque membre
  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const m of members) {
    try {
      // Parser le nom (format : "Prénom NOM" ou "Prénom Nom")
      const parts = m.nom.split(/\s+/)
      const firstName = parts[0] || 'Inconnu'
      const lastName = parts.slice(1).join(' ') || 'Inconnu'

      // Normaliser le téléphone
      let phone = m.telephone.replace(/[\s\/\-\.]/g, '')
      if (phone.includes('/')) phone = phone.split('/')[0] // Prendre le premier numéro
      if (phone.length === 9 && (phone.startsWith('7') || phone.startsWith('6'))) {
        phone = `+221${phone}`
      } else if (phone.length === 10 && phone.startsWith('0')) {
        phone = `+221${phone.slice(1)}`
      } else if (phone.length > 0 && !phone.startsWith('+')) {
        phone = `+221${phone}`
      }

      // Normaliser le statut
      const statusMap: Record<string, string> = {
        'AC': 'AC', 'HC': 'HC', 'I': 'I', 'HNC': 'HNC', 'ANC': 'ANC',
        'ac': 'AC', 'hc': 'HC', 'i': 'I',
      }
      const status = statusMap[m.statut] || 'AC'

      // Déterminer le genre (heuristique basée sur le prénom)
      const femaleNames = ['AISSATOU','AMINATA','AÏCHA','AICHA','ANNA','ARAME',
        'COUMBA','DIEYNABA','FATOU','FATOUMATA','KADIA','KHAR','MAMA','MAREME',
        'NDEYE','OUMY','YAYE','ADJA','NENE']
      const gender = femaleNames.some(n =>
        firstName.toUpperCase().includes(n)
      ) ? 'F' : 'M'

      // Calculer une date d'adhésion approximative
      // Le fichier date de 2011, on met une date par défaut
      const membershipDate = '2011-01-01'

      const { error } = await supabase.from('member').insert({
        tenant_id: tenant.id,
        first_name: capitalize(firstName),
        last_name: capitalize(lastName),
        gender,
        address: m.adresse || null,
        phone: phone || null,
        whatsapp: phone || null,
        profession: m.profession || null,
        membership_date: membershipDate,
        status,
        role: 'member',
      })

      if (error) {
        if (error.code === '23505') {
          skipped++
          console.log(`⏭️ Doublon : ${firstName} ${lastName}`)
        } else {
          errors++
          console.error(`❌ ${firstName} ${lastName} :`, error.message)
        }
      } else {
        inserted++
        console.log(`✅ ${firstName} ${lastName} (${status})`)
      }
    } catch (err: any) {
      errors++
      console.error(`❌ Erreur ligne ${m.numero}:`, err.message)
    }
  }

  console.log(`\n📊 Résultat :`)
  console.log(`   ✅ Insérés : ${inserted}`)
  console.log(`   ⏭️ Doublons : ${skipped}`)
  console.log(`   ❌ Erreurs : ${errors}`)
  console.log(`   📋 Total traité : ${members.length}`)
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

importMembers().catch(console.error)
