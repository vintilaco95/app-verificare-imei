# Ghid Complet: Configurare Background Worker pe Render

## 🔍 Ce Se Întâmplă Acum

1. ✅ Utilizatorul trimite IMEI → Web Service primește request-ul
2. ✅ Web Service creează order cu status "pending" în MongoDB
3. ✅ Web Service pune job în Redis queue
4. ❌ **Worker-ul NU procesează job-ul** → Order rămâne "pending"

## 🎯 Problema

Worker-ul nu rulează sau nu se conectează la Redis/MongoDB.

## ✅ Soluție Pas cu Pas

### PASUL 1: Verifică Dacă Worker-ul Rulează

1. Mergi pe [Render Dashboard](https://dashboard.render.com)
2. Caută serviciul **"Background Worker"** sau **"imei-worker"**
3. **Dacă NU există:**
   - Click "New" → "Background Worker"
   - Name: `imei-worker`
   - Repository: același repository ca Web Service
   - Build Command: `npm install`
   - Start Command: `npm run worker`
   - Plan: Starter (sau Free pentru testare)
   - Click "Create Background Worker"
   - **SKIP la PASUL 3**

4. **Dacă EXISTĂ:**
   - Click pe worker-ul existent
   - Verifică status-ul: trebuie să fie "Live" sau "Running"
   - Dacă este "Stopped" sau "Failed", click "Manual Deploy"

### PASUL 2: Verifică Logs-urile Worker-ului

1. Mergi la Worker Service (`imei-worker`)
2. Click pe tab-ul **"Logs"**
3. Caută următoarele mesaje:

**✅ Dacă vezi acestea, worker-ul funcționează:**
```
[Worker Redis] REDIS_URL env var: SET
[Worker Redis] Connecting to: redis://...
[Worker Redis] ✅ Connected successfully
[Worker] ✅ Connected to MongoDB
[Worker] IMEI verification worker started with concurrency 5
```

**❌ Dacă vezi acestea, există probleme:**
```
[Worker Redis] REDIS_URL env var: NOT SET
[Worker Redis] Connection error: ECONNREFUSED
[Worker] MongoDB connection error
```

### PASUL 3: Setează Environment Variables pentru Worker

**Opțiunea A: Environment Groups (Recomandat)**

1. În Render Dashboard, click **"Environment Groups"** (meniu stânga)
2. Click **"+ New Environment Group"**
3. Name: `imei-app-env`
4. Adaugă toate variabilele (aceleași ca pentru Web Service):
   - `REDIS_URL` = connection string Redis (ex: `redis://red-xxxxx:6379`)
   - `MONGODB_URI` = connection string MongoDB
   - `IMEI_API_KEY` = cheia API
   - `EMAIL_HOST` = `smtp.gmail.com`
   - `EMAIL_PORT` = `465`
   - `EMAIL_USER` = email-ul tău
   - `EMAIL_PASS` = parola email
   - `EMAIL_FROM` = email-ul expeditor
   - `BASE_URL` = URL-ul aplicației (ex: `https://app-verificare-imei.onrender.com`)
5. Click **"Create Environment Group"**

6. **Link la servicii:**
   - **Web Service** → Environment → "Linked Environment Groups" → Link `imei-app-env`
   - **Worker Service** → Settings → "Linked Environment Groups" → Link `imei-app-env`

**Opțiunea B: Render CLI (Dacă nu găsești Environment Groups)**

```bash
# Instalează Render CLI
npm install -g render-cli

# Login
render login

# Setează variabilele pentru Worker (înlocuiește cu valorile tale reale)
render env:set REDIS_URL "redis://red-xxxxx:6379" --service imei-worker
render env:set MONGODB_URI "mongodb+srv://user:pass@cluster.mongodb.net/db" --service imei-worker
render env:set IMEI_API_KEY "your-api-key" --service imei-worker
render env:set EMAIL_HOST "smtp.gmail.com" --service imei-worker
render env:set EMAIL_PORT "465" --service imei-worker
render env:set EMAIL_USER "your-email@gmail.com" --service imei-worker
render env:set EMAIL_PASS "your-password" --service imei-worker
render env:set EMAIL_FROM "your-email@gmail.com" --service imei-worker
render env:set BASE_URL "https://app-verificare-imei.onrender.com" --service imei-worker
```

### PASUL 4: Redeploy Worker-ul

1. Mergi la Worker Service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Așteaptă să se termine deploy-ul (1-2 minute)

### PASUL 5: Verifică Din Nou Logs-urile

După redeploy, verifică logs-urile Worker-ului. Ar trebui să vezi:

```
[Worker Redis] ==========================================
[Worker Redis] REDIS_URL env var: SET
[Worker Redis] Connecting to: redis://red-xxxxx:6379
[Worker Redis] ✅ Connected successfully
[Worker Redis] ✅ Redis is ready to accept commands
[Worker] ✅ Connected to MongoDB
[Worker] IMEI verification worker started with concurrency 5
```

### PASUL 6: Testează Verificarea IMEI

1. Mergi pe aplicația ta
2. Trimite o verificare IMEI
3. Verifică logs-urile Worker-ului - ar trebui să vezi:

```
[Worker] Job order-xxxxx is active
[Worker] Processing job order-xxxxx (order xxxxx)
[OrderProcessor] Processing order...
[Worker] Job order-xxxxx completed
```

4. Verifică în aplicație - order-ul ar trebui să se actualizeze de la "pending" la "success"

## 🐛 Troubleshooting

### Problema: Worker-ul nu rulează

**Soluție:**
- Verifică că Worker Service este creat
- Verifică că status-ul este "Live" sau "Running"
- Dacă este "Stopped", fă manual deploy

### Problema: "REDIS_URL env var: NOT SET"

**Soluție:**
- Worker-ul nu are Environment Variables setate
- Folosește Environment Groups sau Render CLI (vezi PASUL 3)

### Problema: "Connection error: ECONNREFUSED"

**Soluție:**
- `REDIS_URL` nu este corect sau Redis nu este accesibil
- Verifică că ai folosit "Internal Redis URL" din Key Value service
- Verifică că Redis (Key Value) este "Available" (nu în sleep mode)

### Problema: "MongoDB connection error"

**Soluție:**
- `MONGODB_URI` nu este setat sau este incorect
- Verifică că ai setat `MONGODB_URI` în Environment Variables pentru Worker

### Problema: Worker rulează dar nu procesează job-uri

**Soluție:**
- Verifică că Web Service și Worker folosesc același `REDIS_URL`
- Verifică că Redis (Key Value) este pornit
- Verifică logs-urile pentru erori de procesare

## ✅ Checklist Final

- [ ] Worker Service creat pe Render
- [ ] Worker Service este "Live" sau "Running"
- [ ] Environment Variables setate pentru Worker (prin Groups sau CLI)
- [ ] `REDIS_URL` setat corect (Internal Redis URL)
- [ ] `MONGODB_URI` setat corect
- [ ] Toate celelalte variabile setate (IMEI_API_KEY, EMAIL_*, BASE_URL)
- [ ] Worker redeploy-at după setarea variabilelor
- [ ] Logs-urile arată conexiune reușită la Redis și MongoDB
- [ ] Logs-urile arată "IMEI verification worker started"
- [ ] Test verificare IMEI funcționează

## 📝 Notă Importantă

**Worker-ul TREBUIE să ruleze separat de Web Service.** Dacă nu rulează, job-urile rămân în Redis queue și nu sunt procesate niciodată.

## 🎯 Rezumat Rapid

1. Creează Worker Service (dacă nu există)
2. Setează Environment Variables (prin Groups sau CLI)
3. Redeploy Worker
4. Verifică logs-urile
5. Testează verificarea IMEI

Dacă după toate acestea worker-ul tot nu funcționează, trimite-mi logs-urile Worker-ului și te ajut să identific problema exactă.

