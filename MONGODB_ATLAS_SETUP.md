# Ghid MongoDB Atlas - Pas cu Pas

Acest ghid te va ajuta să configurezi MongoDB Atlas pentru aplicația ta.

## 📋 Pasul 1: Creează Cont MongoDB Atlas

1. Mergi pe [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Click pe **"Try Free"** sau **"Sign Up"**
3. Completează formularul:
   - Email
   - Parolă
   - Nume de utilizator
4. Acceptă termenii și condițiile
5. Click **"Create your Atlas account"**

## 📋 Pasul 2: Creează un Cluster

După ce te-ai înregistrat:

1. **Alege tipul de cluster:**
   - Selectează **"M0 FREE"** (Free tier - perfect pentru început)
   - Sau alege un plan plătit pentru producție

2. **Selectează Cloud Provider și Regiune:**
   - Alege provider-ul (AWS, Google Cloud, Azure)
   - Alege regiunea cea mai apropiată de tine (ex: `Europe (Frankfurt)`)
   - **Important:** Pentru Render.com, alege o regiune apropiată de unde rulează aplicația

3. **Numează cluster-ul:**
   - Nume sugestiv (ex: `imei-verification-cluster`)

4. Click **"Create Cluster"**
   - Cluster-ul va dura 1-3 minute să se creeze

## 📋 Pasul 3: Configurează Database Access (Utilizatori)

1. În dashboard-ul MongoDB Atlas, mergi la **"Database Access"** (meniul din stânga)
2. Click **"Add New Database User"**
3. **Metoda de autentificare:**
   - Selectează **"Password"**
   - Generează parolă automat sau creează una manual
   - **IMPORTANT:** Salvează parola într-un loc sigur! O vei folosi în connection string

4. **Privilegii:**
   - Selectează **"Atlas admin"** (pentru început)
   - Sau **"Read and write to any database"** (mai restrictiv, dar sigur)

5. Click **"Add User"**

## 📋 Pasul 4: Configurează Network Access (IP Whitelist)

1. Mergi la **"Network Access"** (meniul din stânga)
2. Click **"Add IP Address"**
3. **Pentru development local:**
   - Click **"Add Current IP Address"** (adaugă IP-ul tău curent)
   - Sau click **"Allow Access from Anywhere"** (adaugă `0.0.0.0/0`)
   - **Notă:** `0.0.0.0/0` permite acces de oriunde (mai puțin sigur, dar necesar pentru Render.com)

4. Click **"Confirm"**

**Pentru Render.com:**
- Folosește `0.0.0.0/0` pentru a permite conexiuni de la orice IP
- Sau adaugă IP-urile specifice de la Render (dacă le cunoști)

## 📋 Pasul 5: Obține Connection String

1. Mergi la **"Database"** (meniul din stânga)
2. Click pe **"Connect"** pe cluster-ul tău
3. Selectează **"Connect your application"**
4. **Driver:** Selectează **"Node.js"**
5. **Version:** Selectează versiunea (de obicei cea mai recentă, ex: `5.5 or later`)

6. **Vei vedea un connection string de forma:**
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

7. **Înlocuiește:**
   - `<username>` cu numele utilizatorului creat la Pasul 3
   - `<password>` cu parola utilizatorului (URL encode dacă conține caractere speciale)

8. **Adaugă numele bazei de date:**
   - Adaugă numele bazei de date la sfârșitul connection string-ului
   - Exemplu: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/imei-verification?retryWrites=true&w=majority`

**Exemplu de connection string final:**
```
mongodb+srv://myuser:mypassword123@cluster0.abc123.mongodb.net/imei-verification?retryWrites=true&w=majority
```

## 📋 Pasul 6: Creează Baza de Date

1. Mergi la **"Database"** → **"Browse Collections"**
2. Click **"Create Database"**
3. **Database Name:** `imei-verification` (sau alt nume preferat)
4. **Collection Name:** Poți lăsa gol sau adaugă `users` (colecțiile se vor crea automat când aplicația rulează)
5. Click **"Create"**

**Notă:** Nu este obligatoriu să creezi baza de date manual. Mongoose o va crea automat când aplicația se conectează prima dată.

## 📋 Pasul 7: Configurează în Aplicație

### Pentru Development Local:

1. Deschide fișierul `.env` din proiectul tău
2. Înlocuiește `MONGODB_URI` cu connection string-ul obținut:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/imei-verification?retryWrites=true&w=majority
   ```
3. **IMPORTANT:** Înlocuiește `username`, `password`, `cluster0.xxxxx` cu valorile tale reale

### Pentru Render.com:

1. Mergi pe [Render Dashboard](https://dashboard.render.com)
2. Selectează serviciul tău (Web Service sau Worker)
3. Mergi la **"Environment"**
4. Găsește variabila `MONGODB_URI`
5. Click **"Edit"** și înlocuiește valoarea cu connection string-ul de la MongoDB Atlas
6. Click **"Save Changes"**
7. Repetă pentru **Worker Service** (același connection string)

## 📋 Pasul 8: Testează Conexiunea

### Local:

1. Pornește aplicația:
   ```bash
   npm start
   ```

2. Ar trebui să vezi în consolă:
   ```
   ✅ Connected to MongoDB
   ```

3. Dacă vezi erori:
   - Verifică că connection string-ul este corect
   - Verifică că Network Access permite IP-ul tău
   - Verifică că username și password sunt corecte

### Pe Render:

1. Verifică logs-urile serviciului pe Render
2. Ar trebui să vezi:
   ```
   ✅ Connected to MongoDB
   ```

## 🔒 Securitate - Best Practices

1. **Parolă puternică:**
   - Folosește o parolă complexă pentru utilizatorul MongoDB
   - Nu folosi aceeași parolă ca pentru alte servicii

2. **Network Access:**
   - Pentru producție, restricționează IP-urile când e posibil
   - Pentru Render.com, poți folosi `0.0.0.0/0` dar asigură-te că parola este puternică

3. **Database User:**
   - Creează utilizatori separați pentru fiecare aplicație
   - Nu folosi utilizatorul admin principal pentru aplicații

4. **Connection String:**
   - Nu commit-a connection string-ul în Git
   - Folosește variabile de mediu
   - Rotatează parola periodic

## 🐛 Troubleshooting

### Eroare: "MongoServerError: bad auth"
- Verifică că username și password sunt corecte în connection string
- Verifică că utilizatorul există în Database Access

### Eroare: "MongoServerError: IP not whitelisted"
- Mergi la Network Access și adaugă IP-ul tău
- Sau folosește `0.0.0.0/0` pentru a permite acces de oriunde

### Eroare: "MongooseError: Operation buffering timed out"
- Verifică că connection string-ul este corect
- Verifică că Network Access permite conexiunea
- Verifică că cluster-ul este pornit (nu în sleep mode)

### Eroare: "MongoNetworkError: failed to connect"
- Verifică că ai internet
- Verifică că cluster-ul nu este în sleep mode (free tier se poate opri după inactivitate)
- Verifică că connection string-ul este corect

## 📝 Note Importante

1. **Free Tier:**
   - MongoDB Atlas free tier oferă 512MB storage
   - Cluster-ul se poate opri după 1 săptămână de inactivitate
   - Pentru producție, consideră un plan plătit

2. **Sleep Mode:**
   - Dacă cluster-ul este în sleep mode, va dura 1-2 minute să se pornească
   - Primele conexiuni după sleep pot fi mai lente

3. **Connection String Format:**
   - Folosește `mongodb+srv://` pentru cluster-uri Atlas
   - Nu folosi `mongodb://` pentru cluster-uri Atlas (doar pentru MongoDB local)

4. **URL Encoding:**
   - Dacă parola conține caractere speciale (`@`, `#`, `%`, etc.), trebuie URL encoded
   - Exemplu: `password@123` devine `password%40123`
   - Poți folosi [URL Encoder](https://www.urlencoder.org/) pentru a codifica parola

## ✅ Checklist Final

- [ ] Cont MongoDB Atlas creat
- [ ] Cluster creat și pornit
- [ ] Database user creat cu parolă
- [ ] Network Access configurat (IP whitelist)
- [ ] Connection string obținut și testat
- [ ] Baza de date creată (opțional, se creează automat)
- [ ] `MONGODB_URI` setat în `.env` (local) sau Render Dashboard (producție)
- [ ] Conexiunea testată și funcțională

## 🎉 Gata!

Acum aplicația ta ar trebui să se conecteze la MongoDB Atlas. Dacă întâmpini probleme, verifică logs-urile și asigură-te că toate pașii de mai sus au fost urmați corect.

## 📸 Screenshots și Exemple

### Connection String Format:
```
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE_NAME?retryWrites=true&w=majority
```

### Exemplu Real:
```
mongodb+srv://admin:MySecurePass123@cluster0.abc123.mongodb.net/imei-verification?retryWrites=true&w=majority
```

### În fișierul .env:
```env
MONGODB_URI=mongodb+srv://admin:MySecurePass123@cluster0.abc123.mongodb.net/imei-verification?retryWrites=true&w=majority
```

