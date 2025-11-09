# Documentație Platformă Verificare IMEI

## 📋 Cuprins

1. [Prezentare Generală](#prezentare-generală)
2. [Structura Proiectului](#structura-proiectului)
3. [Arhitectura Sistemului](#arhitectura-sistemului)
4. [Module și Funcționalități](#module-și-funcționalități)
5. [Configurări și Setări](#configurări-și-setări)
6. [Flow-uri Principale](#flow-uri-principale)
7. [Ghid de Modificare](#ghid-de-modificare)
8. [Tehnologii Utilizate](#tehnologii-utilizate)

---

## 📖 Prezentare Generală

Platforma de verificare IMEI este o aplicație web full-stack care permite utilizatorilor să verifice statusul dispozitivelor mobile (telefoane) pe baza IMEI-ului. Aplicația suportă:

- **Autentificare utilizatori** cu email și parolă
- **Sistem de credite** pentru verificări
- **Verificări pentru utilizatori neautentificați** (one-time payment)
- **Integrare API** cu `alpha.imeicheck.com`
- **Detectare automată a brandului** (Apple, Samsung, Honor, Huawei, Xiaomi, OnePlus, Motorola)
- **Verificări suplimentare** opționale pe brand
- **Template-uri specifice** pentru fiecare brand
- **Design responsive** și modern

---

## 📁 Structura Proiectului

```
app verificare imei/
├── server.js                 # Punct de intrare principal - configurare Express
├── package.json              # Dependențe și scripturi
├── .env                      # Variabile de mediu (API keys, MongoDB URI, etc.)
├── .gitignore                # Fișiere ignorate de Git
│
├── config/
│   └── pricing.js            # ⚙️ CONFIGURARE PRETURI - Prețuri pentru verificări
│
├── models/                   # Modele Mongoose (MongoDB)
│   ├── User.js               # Model utilizator (email, password, credits)
│   ├── Order.js              # Model comandă verificare IMEI
│   └── CreditTransaction.js  # Model tranzacție credite
│
├── middleware/
│   └── auth.js               # Middleware autentificare (requireAuth, requireGuest, attachUser)
│
├── routes/                   # Rute Express
│   ├── index.js              # Ruta homepage
│   ├── auth.js               # Rute autentificare (login, register, logout)
│   ├── verify.js             # Rute verificare IMEI (form, procesare, rezultate)
│   ├── dashboard.js          # Rute dashboard utilizator
│   └── api.js                # API endpoints (balance, add-credits)
│
├── services/                 # Servicii business logic
│   ├── imeiService.js        # Serviciu integrare API IMEI
│   ├── emailService.js       # Serviciu trimitere email
│   ├── parseSamsungHTML.js   # Parser HTML pentru Samsung
│   ├── parseHonorHTML.js    # Parser HTML pentru Honor
│   ├── parseMotorolaHTML.js  # Parser HTML pentru Motorola
│   ├── parseXiaomiHTML.js    # Parser HTML pentru Xiaomi
│   └── parseAdditionalResults.js # Parser rezultate verificări suplimentare
│
├── views/                    # Template-uri EJS
│   ├── layout.ejs            # Layout principal
│   ├── index.ejs             # Homepage
│   ├── 404.ejs               # Pagină 404
│   ├── error.ejs             # Pagină eroare
│   │
│   ├── partials/             # Componente reutilizabile
│   │   ├── header.ejs        # Header cu navigare
│   │   ├── footer.ejs        # Footer
│   │   └── flash.ejs        # Mesaje flash (erori, succes)
│   │
│   ├── auth/
│   │   ├── login.ejs         # Formular login
│   │   └── register.ejs      # Formular înregistrare
│   │
│   ├── verify/
│   │   ├── form.ejs          # Formular introducere IMEI
│   │   ├── processing.ejs    # Pagină procesare verificare
│   │   ├── result.ejs        # Template rezultat generic (Apple/other)
│   │   ├── result-samsung.ejs # Template rezultat Samsung
│   │   ├── result-honor.ejs   # Template rezultat Honor
│   │   ├── result-motorola.ejs # Template rezultat Motorola
│   │   └── result-xiaomi.ejs  # Template rezultat Xiaomi
│   │
│   └── dashboard/
│       ├── index.ejs         # Dashboard principal
│       ├── orders.ejs        # Listă comenzi grupate pe IMEI
│       └── credits.ejs       # Istoric credite
│
└── public/                   # Fișiere statice
    ├── css/
    │   └── style.css         # ⚙️ STILURI - CSS principal (responsive, dark theme)
    └── js/
        ├── main.js           # JavaScript general (3D effects, flash messages)
        ├── imei-validator.js # ⚙️ VALIDARE IMEI - Validare și detectare brand
        └── pricing.js        # ⚙️ LOGICĂ PRICING - Calcul prețuri dinamic
```

---

## 🏗️ Arhitectura Sistemului

### Stack Tehnologic

- **Backend**: Node.js + Express.js
- **Template Engine**: EJS (Embedded JavaScript)
- **Database**: MongoDB (Mongoose ODM)
- **Session Management**: express-session + connect-mongo
- **HTTP Client**: axios
- **Email**: nodemailer

### Flux de Date

```
User Request → Express Middleware → Route Handler → Service Layer → External API / Database
                                                      ↓
                                            Email Service (if needed)
                                                      ↓
                                            Response → EJS Template → HTML
```

### Autentificare și Sesiuni

- Sesiuni stocate în MongoDB via `connect-mongo`
- Middleware `attachUser` face user-ul disponibil în toate template-urile
- `requireAuth` protejează rutele care necesită autentificare
- `requireGuest` redirecționează utilizatorii autentificați de pe paginile de login/register

---

## 🔧 Module și Funcționalități

### 1. Autentificare (`routes/auth.js`)

**Funcționalități:**
- Înregistrare utilizator nou
- Login cu email și parolă
- Logout
- Validare email și parolă (minim 6 caractere)

**Unde modifici:**
- Validare: `routes/auth.js` (linia ~10-15)
- Mesaje erori: `routes/auth.js` (flash messages)

---

### 2. Verificare IMEI (`routes/verify.js`)

**Funcționalități:**
- Formular introducere IMEI (autentificat și guest)
- Validare IMEI în frontend (Luhn algorithm)
- Detectare brand în frontend (TAC patterns)
- Calcul preț dinamic în funcție de brand și servicii suplimentare
- Procesare asincronă a verificărilor
- Pagină de procesare cu polling pentru status
- Afișare rezultate cu template-uri specifice brand

**Flow pentru utilizator autentificat:**
1. User introduce IMEI → Validare frontend → Detectare brand
2. Selectare servicii suplimentare (opțional) → Calcul preț
3. Verificare credite disponibile
4. Submit → Creare order `pending` → Deductere credite
5. Procesare asincronă în background → Actualizare order
6. Redirect la `/verify/processing/:orderId`
7. Polling AJAX pentru status → Redirect la rezultat când gata

**Flow pentru utilizator guest:**
- Similar, dar fără verificare credite
- Necesită email pentru rezultat

**Unde modifici:**
- Procesare verificări: `services/orderProcessor.js` + worker `workers/imeiWorker.js`
- Validare IMEI: `public/js/imei-validator.js`
- Detectare brand: `public/js/imei-validator.js` (constante `TAC_PATTERNS`)
- Template-uri rezultate: `views/verify/result-*.ejs`

---

### 3. Serviciu IMEI (`services/imeiService.js`)

**Funcționalități:**
- Integrare cu API `alpha.imeicheck.com`
- Mapare servicii API pe branduri
- Detectare brand (fallback dacă nu este detectat în frontend)
- Procesare rezultate pentru fiecare brand
- Gestionare erori și fallback-uri

**Servicii API folosite:**
- `11`: Brand Check (detectare brand)
- `19`: Apple Full Info
- `37`: Samsung Info & KNOX Status
- `58`: Honor Info
- `63`: Motorola Info
- `25`: Xiaomi MI Lock & Info
- `27`: OnePlus Info
- `17`: Huawei Info

**Unde modifici:**
- Servicii API: `services/imeiService.js` (constanta `SERVICES`)
- Mapare brand-serviciu: `services/imeiService.js` (constanta `BRAND_SERVICE_MAP`)
- API URL și Key: `services/imeiService.js` (variabile `API_BASE_URL`, `API_KEY`)

---

### 4. Parsing HTML (`services/parse*.js`)

**Funcționalități:**
- Parsing rezultate HTML pentru Samsung, Honor, Motorola, Xiaomi
- Extragere date structurate din HTML
- Suport pentru rezultate JSON (când API-ul returnează `object: true`)

**Unde modifici:**
- Pattern-uri de extragere: `services/parseSamsungHTML.js`, `parseHonorHTML.js`, etc.
- Câmpuri extrase: funcțiile de parsing în fiecare fișier

---

### 5. Configurare Prețuri (`config/pricing.js`)

**Structură:**
```javascript
PRICING = {
  base: {
    apple: 1,
    samsung: 1,
    // ... prețuri per brand
  },
  additional: {
    apple: [
      {
        id: 9,
        name: "Verificare Sursă de Achiziție",
        price: 1.69,
        serviceId: 9,
        // ...
      }
    ],
    // ... servicii suplimentare pe brand
  }
}
```

**Unde modifici:**
- Prețuri de bază: `config/pricing.js` → `base`
- Servicii suplimentare: `config/pricing.js` → `additional`
- Adăugare servicii noi: `config/pricing.js` → `additional[brand]` array

**Funcții exportate:**
- `getBasePrice(brand)` - Returnează prețul de bază pentru un brand
- `getAdditionalServices(brand)` - Returnează lista de servicii suplimentare
- `calculateTotalPrice(brand, additionalServiceIds)` - Calculează prețul total

---

### 6. Dashboard (`routes/dashboard.js`)

**Funcționalități:**
- Afișare credite disponibile
- Istoric comenzi grupate pe IMEI
- Istoric tranzacții credite
- Link către rezultate verificări

**Unde modifici:**
- Layout dashboard: `views/dashboard/*.ejs`
- Logică grupare: `routes/dashboard.js` (GET `/orders`)

---

### 7. Validare și Detectare Brand (`public/js/imei-validator.js`)

**Funcționalități:**
- Validare IMEI cu algoritm Luhn
- Formatare input (doar cifre, max 15)
- Detectare brand din TAC (primele 8 cifre)
- Pattern matching pentru toate brandurile

**Unde modifici:**
- Pattern-uri TAC: `public/js/imei-validator.js` → `TAC_PATTERNS`
- Logica de detectare: `public/js/imei-validator.js` → `detectBrandFromIMEI()`
- Adăugare brand nou: Adaugă în `TAC_PATTERNS` și în logica de fallback

---

### 8. Pricing Frontend (`public/js/pricing.js`)

**Funcționalități:**
- Calcul preț dinamic în frontend
- Rendering servicii suplimentare pe brand
- Actualizare preț când se selectează/deselectează servicii

**Unde modifici:**
- Configurare prețuri: `public/js/pricing.js` → `PRICING_CONFIG` (sincronizat cu `config/pricing.js`)
- Logică rendering: `public/js/pricing.js` → `renderAdditionalServices()`

---

## ⚙️ Configurări și Setări

### 1. Variabile de Mediu (`.env`)

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/imei-check

# Session Secret
SESSION_SECRET=your-secret-key-here

# IMEI API
IMEI_API_KEY=NZ1k7-hMibW-N9nS4-Fmxbe-5I1NA-EvwYm

# Email (opțional - pentru trimitere rezultate)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**Unde modifici:** Creează fișier `.env` în root-ul proiectului

---

### 2. Prețuri (`config/pricing.js`)

**Modificare preț de bază:**
```javascript
base: {
  apple: 2.5,  // Schimbă prețul pentru Apple
  samsung: 1.8,
  // ...
}
```

**Adăugare serviciu suplimentar:**
```javascript
additional: {
  apple: [
    {
      id: 99,  // ID unic (nu trebuie să se suprapună)
      name: "Nume Serviciu",
      description: "Descriere detaliată",
      price: 2.5,
      serviceId: 99,  // ID serviciu API
      displayName: "Nume Afișat",
      category: "Securitate"
    }
  ]
}
```

**Important:** După modificări, sincronizează `public/js/pricing.js` → `PRICING_CONFIG`

---

### 3. Servicii API (`services/imeiService.js`)

**Adăugare serviciu nou:**
```javascript
const SERVICES = {
  // ... servicii existente
  NEW_SERVICE: 99,  // ID serviciu nou
};

const BRAND_SERVICE_MAP = {
  'apple': [SERVICES.APPLE_FULL, SERVICES.NEW_SERVICE],  // Adaugă în lista brandului
  // ...
};
```

---

### 4. Detectare Brand (`public/js/imei-validator.js`)

**Adăugare pattern nou:**
```javascript
TAC_PATTERNS = {
  'newbrand': [
    { prefix: '123456', length: 6 },  // Pattern exact
    { prefix: '1234', length: 4 },    // Pattern generic
  ]
}
```

**Adăugare în logica de fallback:**
```javascript
// Priority 2: Pattern-based detection
if (prefix3 === '123') {
  return 'newbrand';
}
```

---

### 5. Template-uri (`views/verify/result-*.ejs`)

**Creare template pentru brand nou:**
1. Creează `views/verify/result-newbrand.ejs`
2. Adaugă parser în `services/parseNewBrandHTML.js`
3. Adaugă detecție în `routes/verify.js`:
   ```javascript
   const isNewBrand = order.brand === 'newbrand' || order.result.includes('NewBrand');
   if (isNewBrand) {
     const { parseNewBrandHTML } = require('../services/parseNewBrandHTML');
     const newBrandParsedData = parseNewBrandHTML(mainOrder.result || '', mainOrder.object || null);
     return res.render('verify/result-newbrand', {
       title: 'Rezultat verificare IMEI',
       order: mainOrder,
       user: req.user || null,
       newBrandParsedData: newBrandParsedData,
       additionalResults: parsedResults.additionalResults
     });
   }
   ```

---

### 6. Stiluri (`public/css/style.css`)

**Unde modifici:**
- Culori tema: `public/css/style.css` → Variabile CSS (`:root`)
- Layout componente: `public/css/style.css` → Clase specifice (`.report-card`, `.verify-card`, etc.)
- Responsive: `public/css/style.css` → Media queries (la final)

**Variabile principale:**
```css
:root {
  --primary: #14b8a6;
  --bg-dark: #0f172a;
  --bg-card: rgba(15, 23, 42, 0.8);
  --text-primary: #f1f5f9;
  /* ... */
}
```

---

## 🔄 Flow-uri Principale

### Flow 1: Verificare IMEI (Utilizator Autentificat)

```
1. User accesează /verify/imei
2. Frontend: User introduce IMEI
   ├─ Validare format (15 cifre)
   ├─ Validare Luhn
   ├─ Detectare brand (TAC)
   ├─ Afișare preț dinamic
   ├─ Rendering servicii suplimentare
   └─ Verificare credite disponibile
3. User selectează servicii suplimentare (opțional)
4. User submitează formular
5. Backend: POST /verify/imei
   ├─ Validare IMEI
   ├─ Calcul preț total
   ├─ Verificare credite
   ├─ Creare Order (status: pending)
   ├─ Deductere credite
   └─ Start procesare asincronă (job în coada `imei-verification`)
6. Redirect la /verify/processing/:orderId
7. Frontend: Polling AJAX pentru status
8. Când status = success: Redirect la /verify/result/:orderId
9. Backend: GET /verify/result/:orderId
   ├─ Parse rezultate
   ├─ Detectare brand din rezultat
   ├─ Render template specific brand
   └─ Return HTML cu rezultat
```

### Flow 2: Verificare IMEI (Guest)

```
Similar cu Flow 1, dar:
- Nu verifică credite
- Necesită email
- Nu creează tranzacție credit
- Order.userId = null
```

### Flow 3: Procesare Asincronă

```
1. Worker `imeiWorker` preia job-ul din coadă
2. Fetch order din DB
3. orderProcessor.processOrder()
   ├─ Use detectedBrand (dacă există) sau detectBrand() API
   ├─ getDetailedInfo(imei, brand) → Serviciu specific brand
   ├─ Procesare servicii suplimentare (dacă există)
   └─ Return rezultat combinat
4. Update order:
   ├─ status: success/failed
   ├─ result: HTML/JSON combinat
   ├─ object: JSON object (dacă există)
   ├─ model: Nume model
   └─ brand: Brand final
5. Dacă userId există și status = failed:
   └─ Refund credite (full amount)
6. Dacă status = success:
   └─ Trimite email cu rezultat
```

---

## 🛠️ Ghid de Modificare

### Schimbare Prețuri

**Fișier:** `config/pricing.js`

**Exemplu - Schimbare preț Apple:**
```javascript
base: {
  apple: 2.5,  // Schimbă de la 1 la 2.5
}
```

**Exemplu - Adăugare serviciu nou:**
```javascript
additional: {
  apple: [
    // ... servicii existente
    {
      id: 50,
      name: "Verificare Nouă",
      description: "Descriere serviciu",
      price: 3.0,
      serviceId: 50,
      displayName: "Verificare Nouă",
      category: "Securitate"
    }
  ]
}
```

**Important:** După modificare, sincronizează `public/js/pricing.js` → `PRICING_CONFIG`

---

### Adăugare Brand Nou

**1. Adaugă în `config/pricing.js`:**
```javascript
base: {
  newbrand: 1.5,
}
```

**2. Adaugă în `services/imeiService.js`:**
```javascript
const SERVICES = {
  NEWBRAND_INFO: 99,  // ID serviciu API
};

const BRAND_SERVICE_MAP = {
  'newbrand': [SERVICES.NEWBRAND_INFO],
};
```

**3. Adaugă pattern-uri în `public/js/imei-validator.js`:**
```javascript
TAC_PATTERNS = {
  'newbrand': [
    { prefix: '999000', length: 6 },
  ]
}
```

**4. Adaugă în logica de fallback:**
```javascript
if (prefix3 === '999') {
  return 'newbrand';
}
```

**5. Creează parser:** `services/parseNewBrandHTML.js`

**6. Creează template:** `views/verify/result-newbrand.ejs`

**7. Adaugă detecție în `routes/verify.js`:** (vezi secțiunea Template-uri)

---

### Modificare Validare IMEI

**Fișier:** `public/js/imei-validator.js`

**Funcție:** `validateIMEI(imei)`
- Algoritm Luhn pentru verificare cifră control
- Verificare format (15 cifre)

**Modificare algoritm:** Liniile ~538-565

---

### Modificare Template Rezultat

**Fișier:** `views/verify/result-xiaomi.ejs` (exemplu)

**Secțiuni principale:**
- Header: Informații device și scor siguranță
- Alertă: Warnings (MI Lock, etc.)
- Grid detalii: Carduri cu informații
- Sfaturi: Listă sfaturi pentru cumpărător
- Concluzie: Rezumat final

**Adăugare câmp nou:**
```ejs
<% if (newField) { %>
  <p>Nume Câmp: <strong><%= newField %></strong></p>
<% } %>
```

---

### Modificare Stiluri

**Fișier:** `public/css/style.css`

**Variabile tema:**
```css
:root {
  --primary: #14b8a6;        /* Culoare principală */
  --bg-dark: #0f172a;        /* Background dark */
  --text-primary: #f1f5f9;   /* Text principal */
}
```

**Modificare componentă:**
- Caută clasa CSS (ex: `.report-card`)
- Modifică stilurile respective

**Responsive:**
- Media queries la finalul fișierului
- Breakpoints: 480px, 768px, 1024px, 1200px

---

### Modificare Email

**Fișier:** `services/emailService.js`

**Configurare:**
- Variabile mediu: `.env` (EMAIL_HOST, EMAIL_USER, EMAIL_PASS)
- Template email: Funcția `sendVerificationResult()`

**Modificare template email:**
- Liniile ~30-140 în `services/emailService.js`

---

### Adăugare Endpoint API

**Exemplu în `routes/api.js`:**
```javascript
router.get('/new-endpoint', requireAuth, async (req, res) => {
  // Logică aici
  res.json({ success: true, data: {} });
});
```

---

## 🔍 Tehnologii Utilizate

### Backend
- **Node.js**: Runtime JavaScript
- **Express.js**: Framework web
- **Mongoose**: ODM pentru MongoDB
- **express-session**: Gestionare sesiuni
- **connect-mongo**: Store sesiuni în MongoDB
- **axios**: HTTP client pentru API calls
- **nodemailer**: Trimitere email
- **express-validator**: Validare input

### Frontend
- **EJS**: Template engine
- **Vanilla JavaScript**: Fără framework (jQuery, React, etc.)
- **CSS3**: Stiluri moderne, animations, responsive

### Database
- **MongoDB**: Database NoSQL
- **Collections:**
  - `users`: Utilizatori
  - `orders`: Comenzi verificări
  - `sessions`: Sesiuni (automat gestionat de connect-mongo)
  - `credittransactions`: Tranzacții credite

---

## 📝 Note Importante

### Securitate
- Parole hash-uite cu bcrypt
- Sesiuni securizate
- Validare input pe server și client
- Protecție CSRF (via session)

### Performanță
- Procesare asincronă pentru verificări (nu blochează UI)
- Polling AJAX pentru status updates
- Optimizare query-uri MongoDB (indexe pe userId, imei)

### Scalabilitate
- Codul este pregătit pentru scalare orizontală (sesiuni în MongoDB)
- Serviciile sunt separate și pot fi refactorizate în microservicii

### Testare
- Adăugare credite: `POST /api/add-credits` (temporar)
- Adăugare credits în dashboard: `POST /dashboard/credits/add` (temporar)

---

## 🚀 Deploy

### Variabile Mediu Necesare
```
MONGODB_URI=mongodb://...
SESSION_SECRET=...
IMEI_API_KEY=...
EMAIL_HOST=... (opțional)
EMAIL_USER=... (opțional)
EMAIL_PASS=... (opțional)
```

### Comenzi
```bash
npm install          # Instalare dependențe
npm start            # Start server (development)
```

---

## 📞 Suport

Pentru întrebări sau probleme:
1. Verifică log-urile serverului
2. Verifică log-urile browser (Console)
3. Verifică MongoDB connection
4. Verifică API key pentru IMEI service

---

## 📊 Modele de Date

### User Model (`models/User.js`)

**Schema:**
```javascript
{
  email: String (required, unique),
  password: String (required, hashed),
  credits: Number (default: 0),
  createdAt: Date
}
```

**Operații:**
- Creare: `new User({ email, password })`
- Găsire: `User.findById(id)` sau `User.findOne({ email })`
- Update credite: `user.credits += amount; await user.save()`

---

### Order Model (`models/Order.js`)

**Schema:**
```javascript
{
  orderId: Number (timestamp),
  userId: ObjectId (ref: User, nullable),
  email: String (pentru guest users),
  imei: String (required),
  serviceId: Number,
  serviceName: String,
  price: Number,
  status: String (enum: 'pending', 'success', 'failed', 'error'),
  result: String (HTML sau JSON string),
  object: Object (JSON object dacă API returnează),
  brand: String,
  model: String,
  additionalServices: [Number] (IDs servicii suplimentare),
  emailSent: Boolean,
  createdAt: Date
}
```

**Operații:**
- Creare: `new Order({ imei, userId, price, status: 'pending' })`
- Update: `order.status = 'success'; await order.save()`
- Query: `Order.find({ userId })` sau `Order.find({ imei })`

---

### CreditTransaction Model (`models/CreditTransaction.js`)

**Schema:**
```javascript
{
  userId: ObjectId (ref: User),
  type: String (enum: 'usage', 'refund', 'purchase'),
  amount: Number (negativ pentru usage, pozitiv pentru refund/purchase),
  description: String,
  orderId: ObjectId (ref: Order, nullable),
  createdAt: Date
}
```

**Operații:**
- Creare: `new CreditTransaction({ userId, type: 'usage', amount: -1.5 })`
- Query: `CreditTransaction.find({ userId }).sort({ createdAt: -1 })`

---

## 🔐 Autentificare și Securitate

### Session Management

**Configurare:** `server.js` (liniile 16-26)

**Flow:**
1. User login → `req.session.userId` setat
2. Middleware `attachUser` → Fetch user din DB și adaugă la `req.user` și `res.locals.user`
3. Template-uri au acces la `user` via `res.locals.user`
4. Session expiră după 7 zile (configurabil în `cookie.maxAge`)

**Modificare durată sesiune:**
- `server.js` → `cookie.maxAge` (linia ~24)

---

### Password Hashing

**Tehnologie:** bcryptjs

**Unde se întâmplă:**
- Înregistrare: `routes/auth.js` → `bcrypt.hash(password, 10)`
- Login: `routes/auth.js` → `bcrypt.compare(password, user.password)`

---

## 📧 Email Service

### Configurare

**Fișier:** `services/emailService.js`

**Variabile mediu necesare:**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**Notă:** Dacă email-ul nu este configurat, serviciul nu va trimite email-uri, dar aplicația va funcționa normal.

**Template email:** Modificat în `sendVerificationResult()` (liniile ~30-140)

---

## 🎨 Stiluri și Design

### Sistem de Culori

**Fișier:** `public/css/style.css`

**Variabile CSS:**
```css
:root {
  --primary: #14b8a6;        /* Culoare principală (teal) */
  --bg-dark: #0f172a;        /* Background principal */
  --bg-card: rgba(15, 23, 42, 0.8); /* Background card-uri */
  --text-primary: #f1f5f9;   /* Text principal */
  --text-secondary: #94a3b8; /* Text secundar */
  --border: rgba(148, 163, 184, 0.2); /* Border-uri */
  --shadow-lg: ...            /* Umbre */
}
```

**Modificare temă:** Schimbă variabilele în `:root` (liniile ~10-30)

---

### Responsive Breakpoints

**Media Queries în `style.css`:**
- `max-width: 480px` - Mobile foarte mic
- `max-width: 768px` - Mobile / Tablet
- `min-width: 769px and max-width: 1024px` - Tablet
- `min-width: 1025px` - Desktop

**Modificare breakpoints:** Caută `@media` queries la finalul fișierului

---

### Animații și Efecte 3D

**Fișier:** `public/js/main.js`

**Efecte 3D pe card-uri:**
- Activare doar la hover
- Rotire subtilă bazată pe poziția mouse-ului
- Resetare la `mouseleave`

**Modificare sensibilitate:** `main.js` → `/30` (linia ~30) - mărește numitorul pentru mai puțină sensibilitate

---

## 🔄 API Integration

### Endpoint API IMEI

**URL Base:** `https://alpha.imeicheck.com/api/php-api`

**Format request:**
```
GET /create?key=API_KEY&service=SERVICE_ID&imei=IMEI
```

**Response format:**
```json
{
  "orderId": 123456,
  "status": "success" | "failed" | "error",
  "imei": "123456789012345",
  "price": "0.05",
  "result": "HTML string sau JSON string",
  "object": {} | null,  // JSON object dacă disponibil
  "duration": "5.49s"
}
```

**Gestionare erori:**
- Retry logic nu este implementat (se folosește primul serviciu care reușește)
- Fallback la serviciul de brand check (11) dacă toate serviciile specifice eșuează

---

## 🐛 Debugging și Logging

### Log-uri Server

**Unde se loghează:**
- Console.log pentru debugging: `services/imeiService.js`, `routes/verify.js`
- Erori: `console.error()` în toate try-catch blocks

**Log-uri importante:**
- `[verifyIMEI]` - Flow verificare IMEI
- `[getDetailedInfo]` - Selectare serviciu API
- `[POST /imei]` - Request verificare

### Log-uri Frontend

**Browser Console:**
- Erori JavaScript
- Mesaje de validare IMEI
- AJAX request/response

---

## 🔧 Comenzi Utile

### Development
```bash
npm start          # Start server
npm run dev         # Start cu nodemon (auto-reload)
```

### Database
```bash
# Conectare MongoDB (dacă rulează local)
mongosh mongodb://localhost:27017/imei-verification

# Query-uri utile:
db.users.find()                    # Toți utilizatorii
db.orders.find().sort({createdAt: -1}).limit(10)  # Ultimele 10 comenzi
db.credittransactions.find({userId: ObjectId("...")})  # Tranzacții user
```

### Testing
```bash
# Adăugare credite pentru testare
POST /api/add-credits
Body: { userId: "...", amount: 100 }

# Sau direct în dashboard
POST /dashboard/credits/add
```

---

## 📋 Checklist pentru Modificări

### Când adaugi un brand nou:
- [ ] Adaugă în `config/pricing.js` → `base`
- [ ] Adaugă în `services/imeiService.js` → `SERVICES` și `BRAND_SERVICE_MAP`
- [ ] Adaugă pattern-uri în `public/js/imei-validator.js` → `TAC_PATTERNS`
- [ ] Adaugă logica de fallback în `detectBrandFromIMEI()`
- [ ] Adaugă în `public/js/pricing.js` → `PRICING_CONFIG`
- [ ] Creează parser: `services/parseNewBrandHTML.js`
- [ ] Creează template: `views/verify/result-newbrand.ejs`
- [ ] Adaugă detecție în `routes/verify.js` → `GET /result/:orderId`

### Când modifici prețuri:
- [ ] Modifică `config/pricing.js`
- [ ] Sincronizează `public/js/pricing.js` → `PRICING_CONFIG`
- [ ] Testează calculul în frontend
- [ ] Testează calculul în backend

### Când adaugi serviciu suplimentar:
- [ ] Adaugă în `config/pricing.js` → `additional[brand]`
- [ ] Sincronizează `public/js/pricing.js`
- [ ] Verifică că ID-ul serviciului nu se suprapune
- [ ] Testează că serviciul apare în frontend
- [ ] Testează că datele sunt afișate în rezultat

---

## 🎯 Best Practices

### Cod
- **Validare:** Întotdeauna validează input-ul pe server, chiar dacă e validat și pe client
- **Erori:** Folosește try-catch pentru toate operațiile async
- **Logging:** Loghează erorile, nu doar le arunci în consolă
- **Security:** Nu expune API keys în frontend

### Database
- **Indexe:** MongoDB creează automat indexe pe `_id`. Consideră indexe pe `userId`, `imei` pentru query-uri frecvente
- **Cleanup:** Consideră un job pentru ștergerea sesiunilor expirate (dacă nu folosești TTL)

### Performance
- **Async:** Folosește procesare asincronă pentru operațiuni care durează (API calls)
- **Caching:** Consideră caching pentru rezultate API (opțional, nu implementat)

---

## 📚 Resurse Externe

### API Documentation
- **IMEI Check API:** `https://alpha.imeicheck.com` (documentație API)
- **Service IDs:** Definite în `services/imeiService.js`

### Database
- **MongoDB Docs:** https://docs.mongodb.com
- **Mongoose Docs:** https://mongoosejs.com/docs

### Frontend
- **EJS Docs:** https://ejs.co
- **Express Docs:** https://expressjs.com

---

**Ultima actualizare:** 2024

**Versiune:** 1.0.0

