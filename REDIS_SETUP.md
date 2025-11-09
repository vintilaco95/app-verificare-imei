# Ghid Redis - Ce este și Cum să-l Configurezi

## 🤔 Ce este Redis?

**Redis** (Remote Dictionary Server) este o bază de date **în memorie** (in-memory) foarte rapidă, folosită pentru:
- **Caching** (stocare temporară de date)
- **Job Queues** (cozi de job-uri pentru procesare asincronă)
- **Session Storage** (stocare sesiuni)
- **Real-time data** (date care se schimbă frecvent)

### De ce este rapid?
- Stochează datele în **RAM** (memorie), nu pe disc
- Operațiile sunt **foarte rapide** (microsecunde)
- Perfect pentru date care se schimbă frecvent

## 🎯 De ce folosești Redis în aplicația ta?

În aplicația ta, Redis este folosit pentru **Job Queue** (coadă de job-uri) cu **BullMQ**.

### Cum funcționează:

1. **Utilizatorul trimite o cerere de verificare IMEI**
   - Aplicația creează un "job" (sarcină) și îl pune în coadă (Redis)
   - Utilizatorul primește răspuns imediat: "Verificarea este în procesare..."

2. **Worker-ul procesează job-urile din coadă**
   - Un proces separat (worker) preia job-urile din Redis
   - Procesează verificarea IMEI (apel API extern)
   - Salvează rezultatele în MongoDB
   - Trimite email cu rezultatele

3. **Utilizatorul vede rezultatele**
   - Când job-ul este terminat, utilizatorul poate vedea rezultatele

### De ce este util?

✅ **Răspuns rapid pentru utilizator** - nu trebuie să aștepte procesarea
✅ **Procesare în background** - verificările se procesează asincron
✅ **Rate limiting** - poți controla câte verificări se procesează simultan
✅ **Retry automat** - dacă un job eșuează, se poate reîncerca automat
✅ **Scalabilitate** - poți adăuga mai mulți worker-i pentru procesare mai rapidă

### Exemplu concret:

```
Utilizator → [Aplicație] → [Redis Queue] → [Worker] → [API IMEI] → [MongoDB] → [Email]
   ↓              ↓              ↓            ↓            ↓           ↓          ↓
  "Verifică"   Creează job    Stochează   Procesează   Apelează   Salvează   Trimite
   IMEI        în coadă       în Redis    job-ul       API        rezultate   email
```

## 📦 Instalare Redis Local (Development)

### macOS (cu Homebrew):

```bash
# Instalează Redis
brew install redis

# Pornește Redis
brew services start redis

# Sau rulează manual
redis-server
```

### Windows:

1. Descarcă Redis de pe [GitHub](https://github.com/microsoftarchive/redis/releases)
2. Sau folosește WSL (Windows Subsystem for Linux)
3. Sau folosește Docker:
   ```bash
   docker run -d -p 6379:6379 redis
   ```

### Linux (Ubuntu/Debian):

```bash
# Instalează Redis
sudo apt-get update
sudo apt-get install redis-server

# Pornește Redis
sudo systemctl start redis-server

# Pornește Redis la boot
sudo systemctl enable redis-server
```

### Verifică că Redis rulează:

```bash
# Testează conexiunea
redis-cli ping

# Ar trebui să vezi: PONG
```

## ⚙️ Configurare în Aplicație

### Pentru Development Local:

1. **Asigură-te că Redis rulează** (vezi mai sus)

2. **În fișierul `.env`:**
   ```env
   REDIS_URL=redis://127.0.0.1:6379
   ```

3. **Pornește aplicația:**
   ```bash
   npm start
   ```

4. **Pornește worker-ul** (într-un terminal separat):
   ```bash
   npm run worker
   ```

### Verifică că funcționează:

Când pornești aplicația și worker-ul, ar trebui să vezi:
- **Server:** Nu ar trebui să vezi erori de conexiune Redis
- **Worker:** `[Worker] IMEI verification worker started with concurrency 5`

## 🚀 Configurare Redis pe Render.com

Pe Render.com, Redis este oferit ca serviciu. Nu trebuie să instalezi nimic manual!

### Opțiunea 1: Cu `render.yaml` (Recomandat)

Dacă folosești `render.yaml`, Redis este configurat automat:

```yaml
services:
  - type: redis
    name: imei-redis
    plan: starter
```

Render va crea automat serviciul Redis și va seta `REDIS_URL` pentru tine.

### Opțiunea 2: Manual

1. **Creează Redis Service pe Render:**
   - Mergi pe [Render Dashboard](https://dashboard.render.com)
   - Click **"New"** → **"Redis"**
   - **Name:** `imei-redis` (sau alt nume)
   - **Plan:** `Starter` (sau `Free` pentru testare)
   - Click **"Create Redis"**

2. **Obține Connection String:**
   - După ce Redis este creat, mergi la serviciul Redis
   - Găsește **"Connection String"** sau **"Internal Redis URL"**
   - Va arăta așa: `redis://red-xxxxx:6379` sau `redis://default:password@red-xxxxx:6379`

3. **Configurează în Web Service:**
   - Mergi la Web Service (`imei-verification-app`)
   - **Environment** → **Add Environment Variable**
   - **Key:** `REDIS_URL`
   - **Value:** Connection string-ul de la Redis (sau selectează din dropdown dacă e disponibil)
   - Click **"Save Changes"**

4. **Configurează în Worker Service:**
   - Mergi la Worker Service (`imei-worker`)
   - **Environment** → **Add Environment Variable**
   - **Key:** `REDIS_URL`
   - **Value:** Același connection string ca pentru Web Service
   - Click **"Save Changes"**

## 🔍 Verificare Redis

### Local:

```bash
# Conectează-te la Redis CLI
redis-cli

# Verifică conexiunea
PING
# Ar trebui să vezi: PONG

# Vezi toate cheile
KEYS *

# Vezi job-urile din coadă (dacă folosești BullMQ)
KEYS bull:imei-verification:*

# Ieși din Redis CLI
exit
```

### Pe Render:

Verifică logs-urile:
- **Web Service:** Nu ar trebui să vezi erori de conexiune Redis
- **Worker Service:** Ar trebui să vezi `[Worker] IMEI verification worker started`

## 🐛 Troubleshooting

### Eroare: "Redis connection error"

**Local:**
- Verifică că Redis rulează: `redis-cli ping`
- Verifică că `REDIS_URL` este setat corect în `.env`
- Verifică că portul 6379 nu este blocat de firewall

**Render:**
- Verifică că Redis Service este pornit
- Verifică că `REDIS_URL` este setat corect în Environment Variables
- Verifică că folosești connection string-ul corect (nu localhost)

### Eroare: "ECONNREFUSED"

- Redis nu rulează sau nu este accesibil
- Verifică că Redis este pornit
- Verifică că portul este corect (default: 6379)

### Worker nu procesează job-uri

- Verifică că worker-ul rulează (`npm run worker`)
- Verifică că `REDIS_URL` este setat corect în worker
- Verifică logs-urile worker-ului pentru erori

### Job-urile rămân în coadă

- Verifică că worker-ul rulează
- Verifică logs-urile worker-ului
- Verifică că nu sunt erori în procesarea job-urilor

## 📝 Note Importante

1. **Redis este în memorie:**
   - Datele se pierd când Redis se oprește (dacă nu ai persistence configurat)
   - Pentru job queue, asta e OK - job-urile se reprocesează dacă e necesar

2. **Free Tier pe Render:**
   - Render oferă Redis free tier cu limitări
   - Pentru producție, consideră un plan plătit

3. **Redis vs MongoDB:**
   - **Redis:** Pentru date temporare, cache, job queue (rapid, în memorie)
   - **MongoDB:** Pentru date permanente, utilizatori, comenzi (persistent, pe disc)

4. **Connection String Format:**
   - Local: `redis://127.0.0.1:6379`
   - Render: `redis://red-xxxxx:6379` sau `redis://default:password@red-xxxxx:6379`

## ✅ Checklist

- [ ] Redis instalat local (pentru development)
- [ ] Redis pornit și funcțional (`redis-cli ping` returnează `PONG`)
- [ ] `REDIS_URL` setat în `.env` (local)
- [ ] Redis Service creat pe Render (pentru producție)
- [ ] `REDIS_URL` setat în Web Service pe Render
- [ ] `REDIS_URL` setat în Worker Service pe Render
- [ ] Aplicația se conectează la Redis fără erori
- [ ] Worker-ul procesează job-urile din coadă

## 🎉 Gata!

Acum Redis este configurat și aplicația ta poate procesa verificări IMEI în background folosind job queue!

## 📚 Resurse

- [Redis Documentation](https://redis.io/docs/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Render Redis](https://render.com/docs/redis)

