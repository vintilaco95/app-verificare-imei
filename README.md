# Aplicație Verificare IMEI

Aplicație web pentru verificare IMEI telefon folosind MERN stack cu EJS ca template engine.

## Funcționalități

- ✅ Autentificare cu email și parolă
- ✅ Sistem de credite pentru utilizatori autentificați
- ✅ Verificări IMEI pentru utilizatori autentificați (cu credite)
- ✅ Verificări IMEI pentru utilizatori neautentificați (one-time payment - va fi implementat)
- ✅ Rezultate afișate pe ecran și trimise pe email
- ✅ Design modern cu animații 3D și background animat
- ✅ Integrare cu API-ul IMEI Check

## Tehnologii

- **Backend**: Node.js, Express.js
- **Database**: MongoDB cu Mongoose
- **Template Engine**: EJS
- **Authentication**: Sessions
- **Styling**: CSS modern cu animații
- **Email**: Nodemailer

## Instalare

1. Clonează repository-ul sau navighează în directorul proiectului

2. Instalează dependențele:
```bash
npm install
```

3. Creează fișierul `.env` în root-ul proiectului cu următoarele variabile:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Connection (pentru local: mongodb://localhost:27017/imei-verification)
# Pentru producție: mongodb+srv://username:password@cluster.mongodb.net/database-name
MONGODB_URI=mongodb://localhost:27017/imei-verification

# Redis Connection (pentru local: redis://127.0.0.1:6379)
REDIS_URL=redis://127.0.0.1:6379

# Session Secret (generează cu: openssl rand -base64 32)
SESSION_SECRET=your-secret-key-change-this-in-production

# IMEI API Configuration
IMEI_API_KEY=your-imei-api-key-here

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
EMAIL_FROM=your-email@gmail.com

# Application Base URL
BASE_URL=http://localhost:3000

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Worker Configuration (Optional)
IMEI_WORKER_CONCURRENCY=5
```

4. Asigură-te că MongoDB și Redis sunt pornite și accesibile

5. Pornește aplicația:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

6. Pornește worker-ul (într-un terminal separat):
```bash
npm run worker
```

7. Deschide browserul la `http://localhost:3000`

## Structură Proiect

```
.
├── models/              # Modele MongoDB
│   ├── User.js
│   ├── Order.js
│   └── CreditTransaction.js
├── routes/              # Routes Express
│   ├── index.js
│   ├── auth.js
│   ├── verify.js
│   ├── dashboard.js
│   └── api.js
├── views/               # Template-uri EJS
│   ├── partials/
│   ├── auth/
│   ├── verify/
│   └── dashboard/
├── services/            # Servicii
│   ├── imeiService.js
│   └── emailService.js
├── middleware/          # Middleware
│   └── auth.js
├── public/              # Fișiere statice
│   ├── css/
│   └── js/
└── server.js           # Entry point
```

## Funcționalități API IMEI

Aplicația face automat:
1. Verificare inițială cu service ID 11 pentru detectarea brandului
2. Verificare detaliată în funcție de brand:
   - Apple: Services 19, 39, 22
   - Samsung: Services 21, 8
   - Huawei: Service 17
   - Honor: Service 58
   - Motorola: Service 63
   - Xiaomi: Service 25
   - OnePlus: Service 27

## Deploy pe Render.com

Pentru instrucțiuni detaliate de deploy pe Render.com, vezi [DEPLOY.md](./DEPLOY.md).

**Rezumat rapid:**
1. Aplicația necesită **MongoDB Atlas** (nu MongoDB local)
2. Render oferă **Redis** ca serviciu (configurat automat cu `render.yaml`)
3. Trebuie să configurezi toate variabilele de mediu în Render Dashboard
4. Trebuie să rulezi **Worker Service** separat pentru procesarea job-urilor

## Variabile de Mediu

Aplicația necesită următoarele variabile de mediu:

| Variabilă | Descriere | Exemplu |
|-----------|-----------|---------|
| `MONGODB_URI` | Connection string MongoDB | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `REDIS_URL` | Connection string Redis | `redis://host:port` |
| `SESSION_SECRET` | Secret pentru sesiuni | Generează cu `openssl rand -base64 32` |
| `IMEI_API_KEY` | Cheia API IMEI Check | Obținută de la provider |
| `EMAIL_HOST` | Host SMTP | `smtp.gmail.com` |
| `EMAIL_PORT` | Port SMTP | `465` sau `587` |
| `EMAIL_USER` | Utilizator SMTP | `your-email@gmail.com` |
| `EMAIL_PASS` | Parolă SMTP | Parolă sau App Password |
| `EMAIL_FROM` | Email expeditor | `your-email@gmail.com` |
| `BASE_URL` | URL-ul aplicației | `https://your-app.onrender.com` |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | `sk_test_...` sau `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret | `whsec_...` |
| `IMEI_WORKER_CONCURRENCY` | Concurrency worker (opțional) | `5` (default) |

## Note

- Aplicația folosește **job queue** (BullMQ + Redis) pentru procesarea verificărilor IMEI
- Worker-ul trebuie să ruleze separat pentru a procesa job-urile din coadă
- Pentru producție, folosește MongoDB Atlas și Redis extern (nu local)

## Licență

ISC
