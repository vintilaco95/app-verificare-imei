# Soluție: Environment Groups pentru Worker Service

## 🔴 Problema

Worker Service nu are Environment Variables în interfață. Soluția: **Environment Groups**.

## ✅ Soluție: Creează Environment Group

### Pasul 1: Creează Environment Group

1. Mergi pe [Render Dashboard](https://dashboard.render.com)
2. În meniul din stânga, click pe **"Environment Groups"**
3. Click **"+ New Environment Group"**
4. **Name:** `imei-app-env` (sau alt nume)
5. Adaugă toate variabilele necesare:

   **Variabile obligatorii:**
   - `REDIS_URL` = connection string-ul Redis (ex: `redis://red-xxxxx:6379`)
   - `MONGODB_URI` = connection string-ul MongoDB
   - `IMEI_API_KEY` = cheia API IMEI
   - `EMAIL_HOST` = `smtp.gmail.com` (sau altul)
   - `EMAIL_PORT` = `465`
   - `EMAIL_USER` = email-ul tău
   - `EMAIL_PASS` = parola email
   - `EMAIL_FROM` = email-ul expeditor
   - `BASE_URL` = URL-ul aplicației (ex: `https://app-verificare-imei.onrender.com`)

6. Click **"Create Environment Group"**

### Pasul 2: Link Environment Group la Web Service

1. Mergi la **Web Service** (`imei-verification-app`)
2. Click **"Environment"** (meniu stânga)
3. Caută secțiunea **"Linked Environment Groups"**
4. Click **"Link Environment Group"**
5. Selectează grupul creat (`imei-app-env`)
6. Save

### Pasul 3: Link Environment Group la Worker Service

1. Mergi la **Worker Service** (`imei-worker`)
2. Click **"Settings"** sau **"Config"** (meniu stânga)
3. Caută secțiunea **"Linked Environment Groups"** sau **"Environment"**
4. Click **"Link Environment Group"**
5. Selectează același grup (`imei-app-env`)
6. Save

### Pasul 4: Redeploy

După ce ai link-uit Environment Group:
1. Fă redeploy la Web Service
2. Fă redeploy la Worker Service
3. Verifică logs-urile

## 🔍 Dacă Nu Găsești "Environment Groups"

### Alternativă: Render CLI

1. **Instalează Render CLI:**
   ```bash
   npm install -g render-cli
   ```

2. **Login:**
   ```bash
   render login
   ```

3. **Setează variabilele pentru Worker:**
   ```bash
   # Obține service ID-ul Worker (din URL sau dashboard)
   # Apoi setează variabilele:
   
   render env:set REDIS_URL "redis://red-xxxxx:6379" --service imei-worker
   render env:set MONGODB_URI "mongodb+srv://..." --service imei-worker
   render env:set IMEI_API_KEY "your-key" --service imei-worker
   render env:set EMAIL_HOST "smtp.gmail.com" --service imei-worker
   render env:set EMAIL_PORT "465" --service imei-worker
   render env:set EMAIL_USER "your-email@gmail.com" --service imei-worker
   render env:set EMAIL_PASS "your-password" --service imei-worker
   render env:set EMAIL_FROM "your-email@gmail.com" --service imei-worker
   render env:set BASE_URL "https://app-verificare-imei.onrender.com" --service imei-worker
   ```

## 📋 Checklist

- [ ] Environment Group creat cu toate variabilele
- [ ] Environment Group link-uit la Web Service
- [ ] Environment Group link-uit la Worker Service
- [ ] Serviciile redeploy-ate
- [ ] Logs-urile arată că variabilele sunt setate

## 🎯 Verificare

După ce ai setat variabilele, verifică logs-urile Worker Service:
- Ar trebui să vezi: `[Worker Redis] REDIS_URL env var: SET`
- Ar trebui să vezi: `[Worker] Connected to MongoDB`
- Ar trebui să vezi: `[Worker] IMEI verification worker started`

## 💡 Notă Importantă

Dacă niciuna dintre metode nu funcționează, poți rula Worker Service local temporar pentru testare, sau poți combina Web Service și Worker într-un singur proces (nu recomandat pentru producție).

