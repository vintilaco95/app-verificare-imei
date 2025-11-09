# Stripe Payment Integration Setup

## Configurare Variabile de Mediu

Adaugă următoarele variabile în fișierul `.env`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Cheia secretă Stripe (din Dashboard → Developers → API keys)
STRIPE_WEBHOOK_SECRET=whsec_... # Secretul webhook-ului (din Dashboard → Developers → Webhooks)
BASE_URL=http://localhost:3000 # URL-ul aplicației (pentru producție: https://domeniul-tau.com)
```

## Pași de Configurare

### 1. Creează Cont Stripe

1. Mergi pe [stripe.com](https://stripe.com) și creează un cont
2. Activează modul "Test mode" pentru testare

### 2. Obține Cheia Secretă

1. Mergi în Dashboard → Developers → API keys
2. Copiază "Secret key" (începe cu `sk_test_...` pentru test mode)
3. Adaugă-l în `.env` ca `STRIPE_SECRET_KEY`

### 3. Configurează Webhook-ul

#### Pentru Development (Local):

1. Instalează Stripe CLI: `brew install stripe/stripe-cli/stripe` (Mac) sau [descarcă](https://stripe.com/docs/stripe-cli)
2. Autentifică-te: `stripe login`
3. Pornește un tunel local: `stripe listen --forward-to localhost:3000/verify/payment/webhook`
4. Copiază "webhook signing secret" (începe cu `whsec_...`)
5. Adaugă-l în `.env` ca `STRIPE_WEBHOOK_SECRET`

#### Pentru Production:

1. Mergi în Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://domeniul-tau.com/verify/payment/webhook`
4. Selectează evenimentele:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copiază "Signing secret" și adaugă-l în `.env`

### 4. Testare

#### Carduri de Test Stripe:

- **Succes**: `4242 4242 4242 4242`
- **Eșec**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Pentru toate cardurile de test:
- **Expirare**: Orice dată viitoare (ex: 12/25)
- **CVC**: Orice 3 cifre (ex: 123)
- **ZIP**: Orice cod poștal (ex: 12345)

## Securitate

### Măsuri Implementate:

1. **Verificare Semnătură Webhook**: Toate webhook-urile sunt verificate cu semnătura Stripe
2. **Validare Preț**: Prețul este validat pe server (între 0 și 100 RON)
3. **Verificare Sesiune**: Sesiunea Stripe este verificată înainte de procesare
4. **Prevenire Double-Spending**: Verificare `paymentStatus` înainte de procesare
5. **Expirare Sesiune**: Sesiunile expiră după 30 minute

### Best Practices:

- **NU** expune niciodată `STRIPE_SECRET_KEY` în codul frontend
- Folosește HTTPS în producție
- Monitorizează webhook-urile în Stripe Dashboard
- Implementează rate limiting pentru endpoint-urile de plată
- Loghează toate tranzacțiile pentru audit

## Flow de Plată

1. Utilizatorul introduce IMEI și email
2. Se creează o comandă cu `paymentStatus: 'pending'`
3. Se creează o sesiune Stripe Checkout
4. Utilizatorul este redirecționat la Stripe pentru plată
5. După plată, Stripe trimite webhook
6. Webhook-ul verifică semnătura și actualizează `paymentStatus: 'paid'`
7. Verificarea IMEI pornește automat după confirmarea plății
8. Utilizatorul este redirecționat la pagina de procesare

## Troubleshooting

### Webhook-ul nu funcționează:

1. Verifică că `STRIPE_WEBHOOK_SECRET` este setat corect
2. Verifică că webhook-ul este înregistrat în Stripe Dashboard
3. Verifică log-urile serverului pentru erori
4. Testează webhook-ul manual din Stripe Dashboard → Webhooks → Send test webhook

### Plățile nu se procesează:

1. Verifică că `STRIPE_SECRET_KEY` este setat corect
2. Verifică că utilizatorul este redirecționat corect după plată
3. Verifică log-urile worker-ului (`npm run worker`) pentru erori de procesare
4. Verifică că `paymentStatus` este actualizat corect în baza de date

