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

3. Creează fișierul `.env` (copiază din `.env.example`):
```bash
cp .env.example .env
```

4. Configurează variabilele de mediu în `.env`:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/imei-verification
SESSION_SECRET=your-secret-key-change-this-in-production
IMEI_API_KEY=your-imei-api-key-here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
EMAIL_FROM=your-email@gmail.com
BASE_URL=http://localhost:3000
```

5. Asigură-te că MongoDB este pornit și accesibil

6. Pornește aplicația:
```bash
# Development mode
npm run dev

# Production mode
npm start
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

## Note

- Plățile pentru utilizatori neautentificați vor fi implementate ulterior
- Sistemul de alimentare credite pentru utilizatori autentificați va fi implementat ulterior
- Aplicația este pregătită pentru testare și dezvoltare

## Licență

ISC
