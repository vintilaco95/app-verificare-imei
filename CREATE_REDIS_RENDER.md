# Cum să Creezi Redis Service pe Render.com

## 📋 Pasul 1: Creează Redis Service

1. **Mergi pe [Render Dashboard](https://dashboard.render.com)**
2. **Click pe "New"** (butonul din colțul dreapta sus)
3. **Selectează "Key Value"** din listă
   - **IMPORTANT:** În Render, Redis este sub numele "Key Value"!

## 📋 Pasul 2: Configurează Redis (Key Value)

1. **Name:** `imei-redis` (sau alt nume preferat)
2. **Plan:** 
   - **Free** - pentru testare (limitat)
   - **Starter** - pentru producție (recomandat)
3. **Region:** Alege aceeași regiune ca și aplicația ta (pentru performanță mai bună)
4. **Click "Create Key Value"** sau **"Create"**

## 📋 Pasul 3: Așteaptă Crearea

- Key Value (Redis) Service va dura 1-2 minute să se creeze
- Când este gata, vei vedea status "Available"
- **Notă:** Render folosește numele "Key Value" dar este de fapt Redis

## 📋 Pasul 4: Obține Connection String

După ce Key Value (Redis) este creat:

1. **Click pe serviciul Key Value** (`imei-redis`)
2. **Caută secțiunea "Connection Info"** sau **"Info"**
3. **Găsește "Internal Redis URL"**, **"Redis URL"** sau **"Connection String"**

**Formate posibile:**
- `redis://red-xxxxx:6379`
- `red-xxxxx.redis.internal:6379`
- `redis://default:password@red-xxxxx:6379`

**IMPORTANT:** 
- Folosește **"Internal Redis URL"** (nu external), pentru că serviciile Render se conectează intern între ele
- Dacă vezi doar "Redis URL", poți folosi și acela (Render va gestiona conexiunea intern)

## 📋 Pasul 5: Setează REDIS_URL în Aplicație

### Pentru Web Service:

1. Mergi la **Web Service** (`imei-verification-app`)
2. Click **"Environment"** (meniul din stânga)
3. Click **"Add Environment Variable"**
4. **Key:** `REDIS_URL`
5. **Value:** Internal Redis URL obținut la Pasul 4
   - Exemplu: `redis://red-xxxxx:6379`
6. Click **"Save Changes"**

### Pentru Worker Service:

1. Mergi la **Worker Service** (`imei-worker`)
2. Click **"Environment"**
3. Click **"Add Environment Variable"**
4. **Key:** `REDIS_URL`
5. **Value:** **Același** Internal Redis URL ca pentru Web Service
6. Click **"Save Changes"**

## 📋 Pasul 6: Redeploy

După ce ai setat `REDIS_URL`:
- Render va redeploy automat serviciile
- Sau fă manual deploy: **"Manual Deploy"** → **"Deploy latest commit"**

## 📋 Pasul 7: Verifică

După redeploy, verifică logs-urile:

**Web Service:**
- Ar trebui să vezi: `[Redis] REDIS_URL env var: SET`
- Ar trebui să vezi: `[Redis] Connected successfully`

**Worker Service:**
- Ar trebui să vezi: `[Worker Redis] REDIS_URL env var: SET`
- Ar trebui să vezi: `[Worker Redis] Connected successfully`
- Ar trebui să vezi: `[Worker] IMEI verification worker started`

## 🐛 Dacă Nu Găsești "Internal Redis URL"

Uneori Render afișează doar "Redis URL" sau "Connection String". Poți folosi oricare dintre acestea:

1. **Redis URL** - de obicei este external, dar poate funcționa și intern
2. **Connection String** - format complet cu toate detaliile
3. **Host** - doar hostname-ul (ex: `red-xxxxx.redis.internal`)

**Format manual dacă ai doar hostname:**
- Dacă ai: `red-xxxxx.redis.internal`
- Folosește: `redis://red-xxxxx.redis.internal:6379`

## 📸 Unde să Cauți în Render Dashboard

1. **Dashboard principal** → Lista de servicii → Caută "Key Value" sau numele tău (`imei-redis`)
2. **Dacă nu vezi Key Value în listă:**
   - Click "New" → **"Key Value"** pentru a crea unul nou
   - **IMPORTANT:** În Render, Redis apare ca "Key Value"!
3. **În pagina Key Value:**
   - Tab "Info" → "Connection Info"
   - Sau tab "Settings" → "Connection"

## ✅ Checklist

- [ ] Key Value (Redis) Service creat pe Render
- [ ] Key Value este "Available" (nu în sleep mode)
- [ ] Internal Redis URL obținut
- [ ] `REDIS_URL` setat în Web Service
- [ ] `REDIS_URL` setat în Worker Service (același ca Web)
- [ ] Serviciile redeploy-ate
- [ ] Logs-urile arată conexiune reușită

## 💡 Notă Importantă Despre Render

În Render Dashboard, Redis apare sub numele **"Key Value"**, nu "Redis". Este același lucru - Render folosește Redis ca backend pentru Key Value store.

## 🎉 Gata!

După ce ai creat Redis și ai setat `REDIS_URL`, aplicația ar trebui să funcționeze fără erori!

## 💡 Notă Importantă

Dacă folosești **Free tier** pentru Redis:
- Redis se poate opri după inactivitate
- Primele conexiuni după sleep pot fi mai lente
- Pentru producție, consideră un plan plătit

