/**
 * Credit top-up packages configuration
 * Each package defines the amount of credits (equivalent to RON) the user receives.
 */

const CREDIT_PACKAGES = [
  {
    id: 'credits_25',
    credits: 5,
    price: 25,
    label: 'Starter',
    description: 'Pentru câteva verificări rapide'
  },
  {
    id: 'credits_50',
    credits: 10,
    price: 50,
    label: 'Standard',
    description: 'Cel mai popular pachet pentru utilizatorii activi'
  },
  {
    id: 'credits_100',
    credits: 20,
    price: 100,
    label: 'Pro',
    description: 'Ideal pentru comercianți sau revânzători'
  },
  {
    id: 'credits_250',
    credits: 50,
    price: 250,
    label: 'Business',
    description: 'Cea mai bună valoare pentru volume mari'
  }
];

const MIN_TOPUP_AMOUNT = 10;

module.exports = {
  CREDIT_PACKAGES,
  MIN_TOPUP_AMOUNT
};

