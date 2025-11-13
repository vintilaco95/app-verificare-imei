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
      'Only bring up data from the latest verification if the user clearly refers to their current phone, the IMEI report, or the verification details.',
      'You have the full raw IMEI verification payload in the context; you may quote any relevant field directly.',
      'Never assume the user wants to sell their current device; focus on the request they just made.',
      'When the discussion is about that verified phone, include one practical negotiation tip based on the known data.',
      'If the message is vague, ask a short clarifying question.',
      'Never fabricate data; if something is missing, say so.',
      'If you see servicePrice in the data, that is the verification cost, not the phone selling price.'
    ].join(' ');
  }

  return [
    'Ești FANE REPAIRS, tehnician GSM cu peste 10 ani experiență în București, bisnitar de telefoane pregatit sa negociezi la sange pretul oricarui telefon.',
    `Folosește numele ${friendlyName} când se potrivește, dar păstrează conversația naturală.`,
    'Răspunsurile trebuie să fie scurte: maximum trei fraze, fără bullet-uri.',
    'Vorbește relaxat, ca un prieten priceput, cu puțin umor de cartier si cu sfaturi bine gandite despre ce sa ai grija la orice telefon.',
    'Adu în discuție datele din ultima verificare doar dacă utilizatorul se referă clar la telefonul lui actual, la raportul de IMEI sau la detalii din verificare.',
    'Ai în context întregul obiect JSON al verificării IMEI; folosește orice câmp este relevant pentru răspuns.',
    'Nu presupune că utilizatorul vrea să-și vândă telefonul curent; răspunde strict la cererea pe care tocmai a formulat-o.',
    'Când discuția chiar este despre acel telefon verificat, oferă un sfat concret de negociere bazat pe datele pe care le ai.',
    'Dacă mesajul e vag, cere o clarificare scurtă.',
    'Nu inventa informații; dacă lipsește ceva, spune clar.',
    'Daca utilizatorul te intreaba ceva despre repararea unui defect al telefonului indruma-l catre ZEN GSM Timisoara si pe site ul zengsm.ro',
    'Dacă vezi servicePrice în date, acela reprezintă costul verificării, nu prețul de vânzare al telefonului.',
    'Indruma cand ai ocazia utimizatorul sa verifice raportul de IMEI al telefonului si sa faca si verificarea suplimentara pentru a afla exact de unde a fost cumparat telefonul in cazul telefoanelor apple iphone.'
  ].join(' ');
}

function buildVerificationSummary(verification, language) {
  if (!verification) {
    return null;
  }

  const locale = language === 'en' ? 'en-GB' : 'ro-RO';
  const parts = [];

  const deviceName = [verification.brand, verification.modelDesc || verification.model]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (deviceName) {
    parts.push(language === 'en' ? `Device: ${deviceName}` : `Dispozitiv: ${deviceName}`);
  }

  if (verification.imei) {
    parts.push(`IMEI: ${verification.imei}`);
  }

  if (verification.riskLabel || typeof verification.riskScore === 'number') {
    const riskScoreText = typeof verification.riskScore === 'number'
      ? ` (${verification.riskScore})`
      : '';
    parts.push(
      language === 'en'
        ? `Risk: ${verification.riskLabel || 'N/A'}${riskScoreText}`
        : `Risc: ${verification.riskLabel || 'N/A'}${riskScoreText}`
    );
  }

  if (verification.summaryLabel) {
    parts.push(language === 'en'
      ? `Summary: ${verification.summaryLabel}`
      : `Rezumat: ${verification.summaryLabel}`);
  }

  if (verification.statuses && typeof verification.statuses === 'object') {
    const statusPairs = Object.entries(verification.statuses)
      .slice(0, 6)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    if (statusPairs) {
      parts.push(language === 'en' ? `Statuses: ${statusPairs}` : `Statusuri: ${statusPairs}`);
    }
  }

  if (verification.blacklist && typeof verification.blacklist === 'object' && verification.blacklist.status) {
    parts.push(language === 'en'
      ? `Blacklist: ${verification.blacklist.status}`
      : `Blacklist: ${verification.blacklist.status}`);
  }

  if (verification.iCloud && typeof verification.iCloud === 'object' && verification.iCloud.status) {
    parts.push(language === 'en'
      ? `iCloud: ${verification.iCloud.status}`
      : `iCloud: ${verification.iCloud.status}`);
  }

  if (verification.mdm && typeof verification.mdm === 'object' && verification.mdm.status) {
    parts.push(language === 'en'
      ? `MDM: ${verification.mdm.status}`
      : `MDM: ${verification.mdm.status}`);
  }

  if (verification.createdAt) {
    const formattedDate = new Date(verification.createdAt).toLocaleString(locale, {
      timeZone: 'Europe/Bucharest'
    });
    parts.push(language === 'en'
      ? `Verified at: ${formattedDate}`
      : `Verificare din: ${formattedDate}`);
  }

  return parts.join(' | ');
}

function buildContextBlock({ verification, priceInsight, language }) {
  const payload = {};

  if (verification) {
    payload.verificationSummary = buildVerificationSummary(verification, language);
    payload.latestVerification = verification;
  }

  if (priceInsight) {
    payload.marketIntel = priceInsight;
  }

  if (!Object.keys(payload).length) {
    return null;
  }

  return JSON.stringify(payload, null, 2);
}

function buildUserPrompt({ message, language = 'ro', mentionVerification, contextBlock }) {
  const directive = mentionVerification
    ? (language === 'en'
      ? 'The user is referring to the latest verification. Use the data above to answer precisely and add one short negotiation tip if it fits.'
      : 'Utilizatorul se referă la ultima verificare. Folosește datele de mai sus pentru un răspuns precis și adaugă un sfat scurt de negociere dacă are sens.')
    : (language === 'en'
      ? 'The user is not directly referencing the verification. Answer naturally, but feel free to bring up relevant verification facts if they strengthen the reply.'
      : 'Utilizatorul nu face referire directă la verificare. Răspunde natural și adu în discuție detalii din verificare doar dacă ajută răspunsul.');

  const segments = [
    directive,
    contextBlock ? (language === 'en' ? 'Context bundle (JSON):' : 'Context (JSON):') : null,
    contextBlock,
    language === 'en' ? 'User message:' : 'Mesajul utilizatorului:',
    message
  ];

  return segments.filter(Boolean).join('\n\n');
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
  verification = null,
  language = 'ro',
  userName = null,
  mentionVerification = false,
  priceInsight = null
}) {
  try {
    const sanitizedHistory = ensureArray(history)
      .filter(entry => entry && entry.role && entry.content)
      .slice(-MAX_HISTORY)
      .map(entry => ({
        role: entry.role === 'assistant' ? 'assistant' : 'user',
        content: entry.content
      }));

    const contextBlock = buildContextBlock({ verification, priceInsight, language });
    const userPrompt = buildUserPrompt({
      message,
      language,
      mentionVerification,
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
