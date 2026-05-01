# Maslak 4 Digital HUB — Guide de déploiement

## Prérequis

Vous avez besoin de 3 comptes gratuits :
1. **Supabase** → supabase.com (créer un compte)
2. **Vercel** → vercel.com (créer un compte avec GitHub)
3. **Meta for Developers** → developers.facebook.com (pour WhatsApp)

## Étape 1 : Configurer Supabase (15 min)

1. Allez sur [supabase.com](https://supabase.com) → "Start your project"
2. Créez un nouveau projet (nommez-le `maslak4-hub`)
3. Notez le **mot de passe de la base de données**
4. Allez dans **Settings → API** et copiez :
   - `Project URL` → c'est votre `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → c'est votre `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → c'est votre `SUPABASE_SERVICE_ROLE_KEY`
5. Allez dans **SQL Editor** → collez le contenu du fichier
   `supabase/migrations/001_initial_schema.sql` → cliquez **Run**
6. Allez dans **Authentication → Providers → Phone** → activez-le
   (Supabase offre le SMS OTP gratuitement pour les tests)

## Étape 2 : Déployer sur Vercel (10 min)

1. Poussez ce code sur un repo GitHub
2. Allez sur [vercel.com](https://vercel.com) → "New Project"
3. Importez votre repo GitHub
4. Dans **Environment Variables**, ajoutez :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   DEFAULT_TENANT_SLUG=maslak-4
   ```
5. Cliquez **Deploy**

Votre app est en ligne !

## Étape 3 : Importer les membres existants (5 min)

1. Placez votre fichier `list_membres_M4.xlsx` dans un dossier `data/`
2. Créez un fichier `.env` à la racine avec vos variables Supabase
3. Exécutez :
   ```bash
   npm install
   npm run import-members
   ```

## Étape 4 : Configurer WhatsApp (30 min)

1. Allez sur [developers.facebook.com](https://developers.facebook.com)
2. Créez une App → type "Business"
3. Ajoutez le produit "WhatsApp"
4. Dans WhatsApp → Getting Started :
   - Notez le `Phone Number ID` → `WHATSAPP_PHONE_ID`
   - Générez un token permanent → `WHATSAPP_TOKEN`
5. Configurez le webhook :
   - URL : `https://votre-app.vercel.app/api/whatsapp`
   - Token de vérification : choisissez un mot de passe → `WHATSAPP_VERIFY_TOKEN`
   - Abonnez-vous à `messages`
6. Ajoutez ces 3 variables dans Vercel → redéployez

## Étape 5 : Configurer le CRON hebdomadaire

Pour la clôture automatique chaque jeudi soir, ajoutez dans Vercel :
1. Variable : `CRON_SECRET=un-secret-au-choix`
2. Créez un fichier `vercel.json` :
   ```json
   {
     "crons": [{
       "path": "/api/cron/close-cycle",
       "schedule": "59 23 * * 4"
     }]
   }
   ```
   (Tous les jeudis à 23h59)

## Étape 6 : Créer le premier admin

Dans Supabase → SQL Editor :
```sql
-- Remplacez par le vrai auth_user_id (visible dans Authentication → Users)
UPDATE member
SET role = 'super_admin'
WHERE phone = '+221XXXXXXXXX';
```

## Utilisation quotidienne

### Pour les membres
- Ouvrir l'app sur le téléphone (se connecte par OTP)
- Voir ses Hizbs → cliquer "Valider" après lecture
- OU envoyer "VALIDER" par WhatsApp

### Pour l'admin
- Onglet Admin → créer un nouveau cycle chaque semaine
  (ou laisser le CRON le faire automatiquement)
- Onglet Finance → pointer les cotisations
- Onglet Membres → gérer les profils

### Commandes WhatsApp
| Commande | Action |
|----------|--------|
| `VALIDER` | Valide tous vos Hizbs en attente |
| `VALIDER 5` | Valide uniquement le Hizb 5 |
| `HIZB` | Affiche vos Hizbs de la semaine |
| `SOLDE` | Affiche vos cotisations |

## Coûts

| Service | Coût mensuel |
|---------|-------------|
| Supabase (Free tier) | 0 FCFA |
| Vercel (Free tier) | 0 FCFA |
| WhatsApp Cloud API | 0 FCFA (1000 conv./mois) |
| **Total** | **0 FCFA** |

## Support

Pour toute question technique, contactez l'équipe de développement.

*Bismillah — Maslak Assidqi Wa Sadiqina*
