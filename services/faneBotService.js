const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_HISTORY = parseInt(process.env.FANE_BOT_HISTORY || '6', 10);

const fetchFn = typeof fetch === 'function'
  ? fetch.bind(globalThis)
  : (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

if (!OPENAI_API_KEY) {
  console.warn('[FaneBotService] OPENAI_API_KEY is not set. FANE BOT will not be able to respond.');
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function toTitleCase(value) {
  if (!value) return null;
  return value
    .toLowerCase()
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(' ');
}

function buildSystemPrompt({ language = 'ro', userName }) {
  const friendlyName = userName || (language === 'en' ? 'friend' : 'prieten');

  if (language === 'en') {
    return [
      'You are FANE REPAIRS, a seasoned GSM technician from Bucharest with a witty, friendly vibe.',
      `Address the user as ${friendlyName} when it feels natural, but keep it casual.`,
      'Keep replies short: at most three sentences, no bullet points.',
      'Use a relaxed Bucharest tone, slightly sarcastic but never rude.',
      'Only bring up phone verification details if the user clearly asks about the phone, IMEI, risk, price, or negotiation.',
      'When discussing the phone, include at least one practical negotiation tip based on the data you know.',
      'If the message is vague, ask a short clarifying question.',
      'Never fabricate data; if something is missing, say so.'
    ].join(' ');
  }

  return [
    'Ești FANE REPAIRS, tehnician GSM cu peste 10 ani experiență în București, glumeț dar de treabă.',
    `Folosește numele ${friendlyName} când se potrivește, dar păstrează conversația naturală.`,
    'Răspunsurile trebuie să fie scurte: maximum trei fraze, fără bullet-uri.',
    'Vorbește relaxat, ca un prieten priceput, cu puțin umor de cartier.',
    'Menționează detaliile telefonului doar dacă utilizatorul întreabă explicit de verificare, IMEI, blocări sau negociere.',
    'Când se discută despre telefon, oferă cel puțin un sfat concret de negociere bazat pe datele pe care le ai.',
    'Dacă mesajul e vag, cere o clarificare scurtă.',
    'Nu inventa informații; dacă lipsește ceva, spune clar.'
  ].join(' ');
}

function buildContextBlock({ currentOrder, sessionOrders, lastAccountOrder }) {
  const payload = {
    currentOrder: currentOrder || null,
    sessionOrders: ensureArray(sessionOrders),
    lastAccountOrder: lastAccountOrder || null
  };

  return JSON.stringify(payload, null, 2);
}

function buildUserPrompt({ message, language = 'ro', mentionOrder, contextBlock }) {
  const directive = mentionOrder
    ? (language === 'en'
      ? 'The user is asking about the phone. Use the relevant data from the context if it helps, and include one negotiation tip.'
      : 'Utilizatorul întreabă despre telefon. Folosește datele relevante din context și oferă un sfat de negociere.')
    : (language === 'en'
      ? 'The user is not asking about phone data. Reply naturally without mentioning the verification unless they ask for it.'
      : 'Utilizatorul nu întreabă despre telefon. Răspunde natural fără să aduci în discuție verificarea dacă nu este solicitată.');

  const missingDataCallout = language === 'en'
    ? 'If any important data is missing, politely mention what else you would need.'
    : 'Dacă îți lipsește o informație importantă, spune politicos ce ai mai avea nevoie.';

  return [
    directive,
    missingDataCallout,
    'Available data (JSON):',
    contextBlock,
    language === 'en' ? 'User message:' : 'Mesajul utilizatorului:',
    message
  ].join('\n\n');
}

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) {
    return { success: false, error: 'OPENAI_API_KEY is not configured.' };
  }

  const body = {
    model: OPENAI_MODEL,
    temperature: 0.7,
    messages
  };

  const response = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;

  if (!content) {
    throw new Error('OpenAI returned no content.');
  }

  return { success: true, reply: content.trim(), usage: data.usage || null };
}

async function generateFaneBotReply({
  message,
  history = [],
  currentOrder = null,
  sessionOrders = [],
  lastAccountOrder = null,
  language = 'ro',
  userName = null,
  mentionOrder = false
}) {
  try {
    const sanitizedHistory = ensureArray(history)
      .filter(entry => entry && entry.role && entry.content)
      .slice(-MAX_HISTORY)
      .map(entry => ({
        role: entry.role === 'assistant' ? 'assistant' : 'user',
        content: entry.content
      }));

    const contextBlock = buildContextBlock({ currentOrder, sessionOrders, lastAccountOrder });
    const userPrompt = buildUserPrompt({
      message,
      language,
      mentionOrder,
      contextBlock
    });

    const messages = [
      { role: 'system', content: buildSystemPrompt({ language, userName }) },
      ...sanitizedHistory,
      { role: 'user', content: userPrompt }
    ];

    return await callOpenAI(messages);
  } catch (error) {
    console.error('[FaneBotService] Failed to generate response:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateFaneBotReply,
  ensureArray,
  toTitleCase
};
