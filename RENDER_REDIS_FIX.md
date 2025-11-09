# Fix Redis Connection Error pe Render.com

## 🔴 Problema

Eroarea `ECONNREFUSED 127.0.0.1:6379` înseamnă că aplicația încearcă să se conecteze la Redis local, ceea ce nu funcționează pe Render.

**Cauza:** Variabila de mediu `REDIS_URL` nu este setată corect pe Render.

## ✅ Soluție: Setează REDIS_URL Manual în Render Dashboard

### Pasul 1: Obține Connection String-ul Redis

1. Mergi pe [Render Dashboard](https://dashboard.render.com)
2. Găsește serviciul **Redis** (`imei-redis` sau numele tău)
3. Click pe serviciul Redis
4. Găsește secțiunea **"Connection Info"** sau **"Info"**
5. Caută **"Internal Redis URL"** sau **"Connection String"**

**Formate posibile:**
- `redis://red-xxxxx:6379` (fără parolă)
- `redis://default:password@red-xxxxx:6379` (cu parolă)
- `rediss://red-xxxxx:6379` (cu SSL)

**IMPORTANT:** Folosește **"Internal Redis URL"** (nu external), pentru că serviciile Render se conectează intern.

### Pasul 2: Setează REDIS_URL în Web Service

1. Mergi la **Web Service** (`imei-verification-app`)
2. Click pe **"Environment"** (în meniul din stânga)
3. Caută variabila `REDIS_URL`:
   - Dacă **există deja**: Click pe ea și editează valoarea
   - Dacă **nu există**: Click **"Add Environment Variable"**
4. **Key:** `REDIS_URL`
5. **Value:** Connection string-ul obținut la Pasul 1
   - Exemplu: `redis://red-xxxxx:6379`
6. Click **"Save Changes"**

### Pasul 3: Setează REDIS_URL în Worker Service

1. Mergi la **Worker Service** (`imei-worker`)
2. Click pe **"Environment"**
3. Caută variabila `REDIS_URL`:
   - Dacă **există deja**: Click pe ea și editează valoarea
   - Dacă **nu există**: Click **"Add Environment Variable"**
4. **Key:** `REDIS_URL`
5. **Value:** **Același connection string** ca pentru Web Service
6. Click **"Save Changes"**

### Pasul 4: Redeploy Serviciile

După ce ai setat `REDIS_URL`, Render va redeploy automat serviciile. Dacă nu:
1. Mergi la fiecare serviciu (Web și Worker)
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

### Pasul 5: Verifică Logs

După redeploy, verifică logs-urile:

**Web Service:**
- Ar trebui să vezi: `[Redis] REDIS_URL env var: SET`
- Ar trebui să vezi: `[Redis] Connected successfully`
- **NU** ar trebui să vezi: `ECONNREFUSED 127.0.0.1:6379`

**Worker Service:**
- Ar trebui să vezi: `[Worker Redis] REDIS_URL env var: SET`
- Ar trebui să vezi: `[Worker Redis] Connected successfully`
- Ar trebui să vezi: `[Worker] IMEI verification worker started`

## 🔧 Alternative: Dacă render.yaml nu funcționează

Dacă `render.yaml` nu setează automat `REDIS_URL`, poți încerca să schimbi proprietatea:

### Opțiunea 1: Schimbă proprietatea în render.yaml

Înlocuiește `property: connectionString` cu una dintre:
- `property: internalRedisUrl`
- `property: redisUrl`
- `property: connectionString`

Sau elimină complet `fromService` și setează manual:

```yaml
- key: REDIS_URL
  sync: false  # Setează manual în dashboard
```

### Opțiunea 2: Setează manual (Recomandat)

Cel mai sigur este să setezi manual `REDIS_URL` în Render Dashboard (vezi pașii de mai sus).

## 🐛 Troubleshooting

### Eroare persistă după setare

1. **Verifică că ai folosit Internal Redis URL** (nu external)
2. **Verifică că ai setat în ambele servicii** (Web și Worker)
3. **Verifică logs-urile** pentru a vedea ce valoare are `REDIS_URL`:
   - Caută: `[Redis] Connecting to: ...`
   - Ar trebui să vezi connection string-ul Redis, nu `127.0.0.1:6379`

### Nu găsești Connection String în Redis Service

1. Verifică că Redis Service este **pornit** (nu în sleep mode)
2. Caută în secțiunea **"Info"** sau **"Connection"**
3. Dacă nu găsești, poți crea manual:
   - Format: `redis://red-XXXXX:6379` (unde `XXXXX` este ID-ul serviciului)
   - Sau folosește **"Internal Redis URL"** din secțiunea de conexiuni

### Redis Service nu există

1. Creează Redis Service:
   - **"New"** → **"Redis"**
   - **Name:** `imei-redis`
   - **Plan:** `Starter` sau `Free`
2. Apoi urmează pașii de mai sus

## ✅ Checklist

- [ ] Redis Service creat pe Render
- [ ] Connection String obținut din Redis Service
- [ ] `REDIS_URL` setat în Web Service
- [ ] `REDIS_URL` setat în Worker Service (același ca Web)
- [ ] Serviciile redeploy-ate
- [ ] Logs-urile arată `REDIS_URL env var: SET`
- [ ] Logs-urile arată `Connected successfully`
- [ ] Nu mai vezi erori `ECONNREFUSED 127.0.0.1:6379`

## 📝 Note

- **Internal vs External:** Folosește **Internal Redis URL** pentru conexiuni între servicii Render
- **Același connection string:** Web Service și Worker Service trebuie să folosească **același** `REDIS_URL`
- **Format:** Connection string-ul ar trebui să fie de forma `redis://host:port` sau `redis://user:pass@host:port`

## 🎉 Gata!

După ce ai setat `REDIS_URL` corect, aplicația ar trebui să se conecteze la Redis fără erori!

