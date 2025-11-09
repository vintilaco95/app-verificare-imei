# Ghid de Deploy pe Render.com

Acest ghid te va ajuta să deployezi aplicația pe Render.com.

## 📋 Cerințe Pre-Deploy

### 1. MongoDB Atlas (Recomandat)

Aplicația necesită MongoDB. **Nu poți folosi MongoDB local pe Render**, trebuie să folosești un serviciu extern.

**📖 Pentru instrucțiuni detaliate pas cu pas, vezi [MONGODB_ATLAS_SETUP.md](./MONGODB_ATLAS_SETUP.md)**

**Rezumat rapid:**
1. Creează un cont gratuit pe [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Creează un cluster (free tier disponibil)
3. Configurează accesul:
   - **Network Access**: Adaugă `0.0.0.0/0` pentru a permite conexiuni de oriunde (sau doar IP-urile Render)
   - **Database Access**: Creează un utilizator cu parolă
4. Obține connection string-ul:
   - Forma: `mongodb+srv://username:password@cluster.mongodb.net/database-name`
   - Înlocuiește `username`, `password`, `cluster` și `database-name`

### 2. Redis (Oferit de Render)

**📖 Pentru explicații detaliate despre Redis și cum funcționează în aplicație, vezi [REDIS_SETUP.md](./REDIS_SETUP.md)**

Render oferă Redis ca serviciu. Nu trebuie să configurezi manual dacă folosești `render.yaml`.

**Rezumat rapid:**
- Redis este folosit pentru **job queue** (coadă de job-uri)
- Permite procesarea verificărilor IMEI în background
- Render oferă Redis ca serviciu (configurat automat cu `render.yaml`)

### 3. Stripe Account

1. Creează cont pe [Stripe](https://stripe.com)
2. Obține **Secret Key** din Dashboard → Developers → API keys
3. Configurează Webhook:
   - URL: `https://your-app.onrender.com/verify/payment/webhook`
   - Events: `checkout.session.completed`
   - Obține **Webhook Secret** după creare

### 4. Email SMTP

Configurează un cont SMTP pentru trimiterea emailurilor:
- Gmail: Trebuie să folosești "App Password" (nu parola normală)
- Alt provider: Configurează conform documentației

## 🚀 Deploy pe Render.com

### Opțiunea 1: Deploy automat cu `render.yaml` (Recomandat)

1. **Push codul pe GitHub/GitLab/Bitbucket**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Conectează repository-ul pe Render**
   - Mergi pe [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Conectează repository-ul
   - Render va detecta automat `render.yaml`

3. **Configurează variabilele de mediu**
   
   Pentru **Web Service** (`imei-verification-app`):
   - `MONGODB_URI`: Connection string de la MongoDB Atlas
   - `IMEI_API_KEY`: Cheia API de la IMEI Check
   - `EMAIL_HOST`: Host SMTP (ex: `smtp.gmail.com`)
   - `EMAIL_PORT`: Port SMTP (ex: `465`)
   - `EMAIL_USER`: Email pentru SMTP
   - `EMAIL_PASS`: Parolă/App Password pentru SMTP
   - `EMAIL_FROM`: Email de la care se trimit mesajele
   - `STRIPE_SECRET_KEY`: Secret key de la Stripe
   - `STRIPE_WEBHOOK_SECRET`: Webhook secret de la Stripe
   - `BASE_URL`: Va fi setat automat de Render (sau setează manual URL-ul aplicației)

   Pentru **Worker Service** (`imei-worker`):
   - Setează aceleași variabile ca pentru Web Service (`MONGODB_URI`, `IMEI_API_KEY`, `EMAIL_*`, etc.)

4. **Așteaptă deploy-ul**
   - Render va construi și deploya toate serviciile
   - Verifică logs pentru erori

### Opțiunea 2: Deploy manual (fără `render.yaml`)

1. **Creează Web Service**
   - "New" → "Web Service"
   - Conectează repository-ul
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
   - **Plan**: `Starter` (sau `Free` pentru testare)

2. **Creează Redis Service**
   - "New" → "Redis"
   - **Name**: `imei-redis`
   - **Plan**: `Starter` (sau `Free`)

3. **Creează Worker Service**
   - "New" → "Background Worker"
   - Conectează același repository
   - **Build Command**: `npm install`
   - **Start Command**: `npm run worker`
   - **Environment**: `Node`
   - **Plan**: `Starter` (sau `Free`)

4. **Configurează variabilele de mediu** (vezi Opțiunea 1)

5. **Link Redis la Web Service și Worker**
   - În Web Service → Environment → Add Environment Variable
   - Key: `REDIS_URL`
   - Value: Selectează din Redis service → "Connection String"
   - Repetă pentru Worker Service

## ✅ Verificare Post-Deploy

1. **Verifică logs**
   - Web Service: Ar trebui să vezi `✅ Connected to MongoDB`
   - Worker: Ar trebui să vezi `[Worker] IMEI verification worker started`

2. **Testează aplicația**
   - Accesează URL-ul aplicației
   - Încearcă să te loghezi
   - Testează o verificare IMEI

3. **Verifică Stripe Webhook**
   - În Stripe Dashboard → Webhooks
   - Verifică că webhook-ul primește evenimente

## 🔧 Troubleshooting

### Eroare: "MongoDB connection error"
- Verifică că `MONGODB_URI` este setat corect
- Verifică Network Access în MongoDB Atlas (permite `0.0.0.0/0`)
- Verifică că username și password sunt corecte

### Eroare: "Redis connection error"
- Verifică că `REDIS_URL` este setat corect
- Verifică că Redis service este pornit pe Render

### Eroare: "IMEI_API_KEY is not defined"
- Verifică că variabila `IMEI_API_KEY` este setată în Environment Variables

### Email-uri nu se trimit
- Verifică că toate variabilele `EMAIL_*` sunt setate
- Pentru Gmail, folosește "App Password" (nu parola normală)
- Verifică logs pentru erori de conectare SMTP

### Worker nu procesează job-uri
- Verifică că Worker Service este pornit
- Verifică logs pentru erori
- Verifică că `REDIS_URL` este setat corect în Worker

### Stripe Webhook nu funcționează
- Verifică că `STRIPE_WEBHOOK_SECRET` este setat corect
- Verifică că URL-ul webhook-ului în Stripe este corect
- Verifică logs pentru erori de verificare semnătură

## 📝 Note Importante

1. **MongoDB Local**: Nu funcționează pe Render. Trebuie MongoDB Atlas sau alt serviciu extern.

2. **Redis Local**: Nu funcționează pe Render. Folosește Redis service de pe Render.

3. **Worker Service**: Trebuie să ruleze separat pentru a procesa job-urile din coadă.

4. **Environment Variables**: Toate variabilele sensibile trebuie setate în Render Dashboard, nu în cod.

5. **BASE_URL**: Important pentru Stripe redirects și email links. Setează-l la URL-ul real al aplicației.

6. **Free Tier**: Render oferă free tier, dar serviciile se opresc după inactivitate. Pentru producție, recomand planuri plătite.

## 🔐 Securitate

- **Nu commit-a** `.env` în Git
- Folosește variabile de mediu pentru toate datele sensibile
- Generează `SESSION_SECRET` sigur: `openssl rand -base64 32`
- Verifică că MongoDB Atlas are Network Access restricționat (dacă e posibil)

## 📚 Resurse

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/getting-started/)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Node.js on Render](https://render.com/docs/node)

