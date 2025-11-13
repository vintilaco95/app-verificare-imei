const fetchFn = typeof fetch === 'function'
  ? fetch.bind(globalThis)
  : (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

const SERP_API_KEY = process.env.SERPAPI_KEY || process.env.PRICE_SEARCH_API_KEY || null;
const DEFAULT_ENGINE = 'google';
const MAX_RESULTS = 5;

function buildQuery({ brand, model, language }) {
  const normalizedBrand = brand ? String(brand).trim() : '';
  const normalizedModel = model ? String(model).trim() : '';
  const base = [normalizedBrand, normalizedModel].filter(Boolean).join(' ');
  if (!base) {
    return null;
  }

  if (language === 'en') {
    return `${base} average price Romania`;
  }

  return `pret mediu ${base}`;
}

function parseOrganicResults(results = []) {
  if (!Array.isArray(results) || !results.length) {
    return null;
  }

  const snippets = results
    .slice(0, MAX_RESULTS)
    .map((item) => {
      const parts = [];
      if (item.title) {
        parts.push(item.title);
      }
      if (item.snippet) {
        parts.push(item.snippet);
      }
      if (item.price) {
        const priceParts = [];
        if (item.price.extracted_value) {
          priceParts.push(`${item.price.extracted_value} ${item.price.currency || ''}`.trim());
        }
        if (item.price.extracted_low) {
          priceParts.push(`low ${item.price.extracted_low}`);
        }
        if (item.price.extracted_high) {
          priceParts.push(`high ${item.price.extracted_high}`);
        }
        if (priceParts.length) {
          parts.push(priceParts.join(' · '));
        }
      }
      return parts.join(' — ');
    })
    .filter(Boolean);

  if (!snippets.length) {
    return null;
  }

  return snippets.join('\n');
}

async function lookupAveragePrice({ brand, model, language = 'ro', fallbackQuery }) {
  if (!SERP_API_KEY) {
    return { success: false, error: 'SERPAPI_KEY is not configured.' };
  }

  try {
    const query = buildQuery({ brand, model, language }) || fallbackQuery;
    if (!query) {
      return { success: false, error: 'Nu există suficiente informații pentru căutare.' };
    }

    const params = new URLSearchParams({
      engine: DEFAULT_ENGINE,
      api_key: SERP_API_KEY,
      q: query,
      google_domain: 'google.com',
      hl: language === 'en' ? 'en' : 'ro',
      gl: 'ro',
      num: String(MAX_RESULTS)
    });

    const response = await fetchFn(`https://serpapi.com/search.json?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SERP API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const summary = parseOrganicResults(data.organic_results || []);

    if (!summary) {
      return {
        success: false,
        error: 'Nu am găsit informații de preț relevante.'
      };
    }

    return {
      success: true,
      summary,
      source: 'serpapi',
      query
    };
  } catch (error) {
    console.error('[PriceLookup] Failed to fetch price data:', error);
    return { success: false, error: error.message || 'Eroare la căutarea prețului.' };
  }
}

module.exports = {
  lookupAveragePrice
};

