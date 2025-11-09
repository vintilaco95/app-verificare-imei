# Fix Redis Connection pe Render - Troubleshooting

## 🔍 Verifică Logs-urile

După ce ai setat `REDIS_URL`, verifică logs-urile aplicației pentru a vedea:

1. **Ce valoare are REDIS_URL:**
   - Caută în logs: `[Redis] REDIS_URL env var: SET` sau `NOT SET`
   - Caută: `[Redis] Connecting to: ...`
   - Ar trebui să vezi connection string-ul Redis, NU `127.0.0.1:6379`

2. **Dacă vezi încă `127.0.0.1:6379`:**
   - Înseamnă că `REDIS_URL` nu este setat corect sau nu este citit
   - Verifică că ai salvat Environment Variable în Render
   - Verifică că ai făcut redeploy după setare

## 🔧 Probleme Comune și Soluții

### Problema 1: Connection String Incorect

**Sintom:** Logs-urile arată `REDIS_URL env var: SET` dar conexiunea eșuează

**Soluție:**
1. Verifică că ai folosit **"Internal Redis URL"** (nu external)
2. Formatul trebuie să fie: `redis://red-xxxxx:6379` sau `redis://red-xxxxx.redis.internal:6379`
3. Dacă ai doar hostname (fără `redis://`), adaugă prefix-ul:
   - Dacă ai: `red-xxxxx.redis.internal:6379`
   - Folosește: `redis://red-xxxxx.redis.internal:6379`

### Problema 2: REDIS_URL Nu Este Setat

**Sintom:** Logs-urile arată `REDIS_URL env var: NOT SET`

**Soluție:**
1. Mergi la Web Service → Environment
2. Verifică că există variabila `REDIS_URL`
3. Dacă nu există, adaugă-o:
   - Key: `REDIS_URL`
   - Value: Connection string-ul din Key Value service
4. **IMPORTANT:** Click "Save Changes"
5. Fă **Manual Deploy** → "Deploy latest commit"

### Problema 3: Format Connection String Incorect pentru Render

**Sintom:** Connection string-ul pare corect dar nu funcționează

**Soluție - Încearcă aceste formate:**

1. **Format 1 (Internal Redis URL):**
   ```
   redis://red-xxxxx:6379
   ```

2. **Format 2 (cu .redis.internal):**
   ```
   redis://red-xxxxx.redis.internal:6379
   ```

3. **Format 3 (dacă ai password):**
   ```
   redis://default:password@red-xxxxx:6379
   ```

4. **Format 4 (doar hostname, fără redis://):**
   ```
   red-xxxxx.redis.internal:6379
   ```
   (Nu recomandat, dar uneori funcționează)

### Problema 4: Serviciile Nu Sunt în Aceeași Regiune

**Sintom:** Connection string-ul este corect dar conexiunea eșuează

**Soluție:**
1. Verifică că Web Service și Key Value sunt în **aceeași regiune**
2. Dacă nu sunt, mută-le în aceeași regiune sau recreează Key Value în regiunea corectă

### Problema 5: Key Value (Redis) Este în Sleep Mode

**Sintom:** Primele conexiuni eșuează, apoi funcționează

**Soluție:**
1. Verifică că Key Value este "Available" (nu în sleep)
2. Dacă este în sleep, așteaptă 1-2 minute după prima conexiune
3. Pentru producție, folosește un plan plătit (nu free tier)

## 📋 Pași de Debugging

### Pasul 1: Verifică Logs-urile Aplicației

Caută în logs-urile Web Service și Worker:

```
[Redis] REDIS_URL env var: SET
[Redis] Connecting to: redis://red-xxxxx:6379
```

Dacă vezi:
- `REDIS_URL env var: NOT SET` → Variabila nu este setată
- `Connecting to: redis://127.0.0.1:6379` → Folosește fallback-ul (variabila nu este setată corect)

### Pasul 2: Verifică Connection String-ul în Render

1. Mergi la Key Value service
2. Click pe "Info" sau "Connection"
3. Caută **"Internal Redis URL"** sau **"Redis URL"**
4. Copiază exact connection string-ul

### Pasul 3: Verifică Environment Variables

1. Mergi la Web Service → Environment
2. Verifică că `REDIS_URL` există și are valoarea corectă
3. Dacă nu există sau este greșit, editează sau adaugă-l
4. **IMPORTANT:** Click "Save Changes"
5. Repetă pentru Worker Service

### Pasul 4: Redeploy

După ce ai setat/actualizat `REDIS_URL`:
1. Fă **Manual Deploy** la Web Service
2. Fă **Manual Deploy** la Worker Service
3. Așteaptă să se termine deploy-ul
4. Verifică logs-urile din nou

### Pasul 5: Testează Conexiunea

După redeploy, verifică logs-urile:
- Ar trebui să vezi: `[Redis] Connected successfully`
- Ar trebui să vezi: `[Worker Redis] Connected successfully`
- **NU** ar trebui să vezi: `ECONNREFUSED`

## 🔧 Soluție Alternativă: Folosește Hostname Direct

Dacă connection string-ul nu funcționează, încearcă să folosești doar hostname-ul:

1. Din Key Value service, obține hostname-ul (ex: `red-xxxxx.redis.internal`)
2. Setează `REDIS_URL` ca:
   ```
   redis://red-xxxxx.redis.internal:6379
   ```
   (înlocuiește `red-xxxxx` cu hostname-ul tău real)

## 🐛 Dacă Tot Nu Funcționează

1. **Verifică că Key Value este pornit:**
   - Status trebuie să fie "Available"
   - Nu trebuie să fie în sleep mode

2. **Verifică că serviciile sunt în aceeași regiune:**
   - Web Service și Key Value trebuie să fie în aceeași regiune

3. **Verifică logs-urile pentru erori specifice:**
   - Caută erori de conexiune
   - Caută mesaje despre timeout sau connection refused

4. **Încearcă să recreezi Key Value:**
   - Șterge Key Value existent
   - Creează unul nou în aceeași regiune cu aplicația
   - Obține connection string-ul nou
   - Setează-l în aplicație

## 📝 Format Corect pentru REDIS_URL pe Render

**Format recomandat:**
```
redis://red-XXXXX:6379
```

Unde `XXXXX` este ID-ul serviciului Key Value.

**Sau:**
```
redis://red-XXXXX.redis.internal:6379
```

## ✅ Checklist Final

- [ ] Key Value (Redis) este "Available" (nu în sleep)
- [ ] Web Service și Key Value sunt în aceeași regiune
- [ ] `REDIS_URL` este setat în Web Service (verifică în Environment)
- [ ] `REDIS_URL` este setat în Worker Service (verifică în Environment)
- [ ] Connection string-ul începe cu `redis://`
- [ ] Connection string-ul conține portul `:6379`
- [ ] Ai făcut redeploy după setarea `REDIS_URL`
- [ ] Logs-urile arată `REDIS_URL env var: SET`
- [ ] Logs-urile arată connection string-ul corect (nu `127.0.0.1`)
- [ ] Logs-urile arată `Connected successfully`

## 💡 Notă Importantă

Render folosește conexiuni interne între servicii. Asigură-te că folosești **"Internal Redis URL"** (nu external URL). External URL este pentru conexiuni din afara Render.

