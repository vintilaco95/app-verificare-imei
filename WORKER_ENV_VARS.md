# Cum să Setezi Environment Variables pentru Worker Service pe Render

## 🔴 Problema

Worker Service nu are Environment Variables în interfața Render Dashboard. Trebuie să le setăm altfel.

## ✅ Soluții

### Soluția 1: Setează Manual în Render Dashboard (Dacă Este Disponibil)

1. Mergi la **Worker Service** (`imei-worker`)
2. Caută tab-ul **"Environment"** sau **"Config"** sau **"Settings"**
3. Dacă vezi opțiunea de Environment Variables, adaugă-le acolo
4. Dacă **NU** vezi opțiunea, continuă cu Soluția 2

### Soluția 2: Folosește Render CLI (Recomandat)

Render CLI permite să setezi Environment Variables din linia de comandă.

1. **Instalează Render CLI:**
   ```bash
   npm install -g render-cli
   ```

2. **Login în Render:**
   ```bash
   render login
   ```

3. **Setează Environment Variables pentru Worker:**
   ```bash
   # Setează REDIS_URL (înlocuiește cu connection string-ul tău real)
   render env:set REDIS_URL "redis://red-xxxxx:6379" --service imei-worker
   
   # Setează MONGODB_URI (același ca pentru Web Service)
   render env:set MONGODB_URI "mongodb+srv://..." --service imei-worker
   
   # Setează celelalte variabile (același ca pentru Web Service)
   render env:set IMEI_API_KEY "your-key" --service imei-worker
   render env:set EMAIL_HOST "smtp.gmail.com" --service imei-worker
   render env:set EMAIL_PORT "465" --service imei-worker
   render env:set EMAIL_USER "your-email@gmail.com" --service imei-worker
   render env:set EMAIL_PASS "your-password" --service imei-worker
   render env:set EMAIL_FROM "your-email@gmail.com" --service imei-worker
   ```

### Soluția 3: Setează Direct în render.yaml (Simplu)

Actualizează `render.yaml` pentru a seta valorile direct (dar nu pentru date sensibile):

```yaml
  # Worker Service
  - type: worker
    name: imei-worker
    env: node
    plan: starter
    buildCommand: npm install
    startCommand: npm run worker
    envVars:
      - key: NODE_ENV
        value: production
      - key: REDIS_URL
        value: redis://red-xxxxx:6379  # SETEAZĂ AICI CU CONNECTION STRING-UL TĂU REAL
      - key: MONGODB_URI
        value: mongodb+srv://...  # SETEAZĂ AICI CU MONGODB URI TĂU REAL
      # ... restul variabilelor
```

**⚠️ ATENȚIE:** Nu commit-a date sensibile (parole, API keys) direct în `render.yaml` dacă repository-ul este public!

### Soluția 4: Folosește Render Dashboard - Settings Tab

Uneori Environment Variables sunt în alt loc:

1. Mergi la **Worker Service**
2. Click pe **"Settings"** (nu "Environment")
3. Caută secțiunea **"Environment Variables"** sau **"Config Vars"**
4. Adaugă variabilele acolo

## 🎯 Soluția Cea Mai Simplă (Recomandat)

**Folosește Render CLI** (Soluția 2) - este cea mai sigură și mai ușoară metodă.

## 📋 Checklist

- [ ] Worker Service există pe Render
- [ ] Ai instalat Render CLI
- [ ] Ai setat `REDIS_URL` pentru Worker Service
- [ ] Ai setat `MONGODB_URI` pentru Worker Service
- [ ] Ai setat toate celelalte variabile necesare
- [ ] Worker Service rulează fără erori

## 🔍 Verificare

După ce setezi variabilele, verifică logs-urile Worker Service:
- Ar trebui să vezi: `[Worker Redis] REDIS_URL env var: SET`
- Ar trebui să vezi: `[Worker] Connected to MongoDB`
- Ar trebui să vezi: `[Worker] IMEI verification worker started`

