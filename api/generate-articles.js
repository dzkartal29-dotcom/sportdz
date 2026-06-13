// api/generate-articles.js
export const config = { maxDuration: 60 };

const REDIS_URL = 'https://model-hookworm-119603.upstash.io';
const REDIS_TOKEN = 'gQAAAAAAAdMzAAIgcDJmZDg1NzFmNzhjMTI0NzNkYjQ5MDhkN2Y3YmIyMjVmMA';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// Sources RSS lues directement (sans proxy)
const RSS_SOURCES = [
  { url: 'https://www.rfi.fr/fr/rss/sportsfr.xml',          name: 'RFI Sport',    flag: '📻', color: '#E8003D' },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', name: 'BBC Sport',    flag: '⚽', color: '#7B2FBE' },
  { url: 'https://www.footmercato.net/rss/actualites.xml',   name: 'Foot Mercato', flag: '🌍', color: '#C9A84C' },
  { url: 'https://rmcsport.bfmtv.com/rss/football.xml',     name: 'RMC Sport',    flag: '🎙️', color: '#0057B8' },
  { url: 'https://www.sport.fr/football/rss.xml',           name: 'Sport.fr',     flag: '🏆', color: '#00D673' },
];

// Redis helpers
async function redisLPush(key, value) {
  await fetch(`${REDIS_URL}/lpush/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value)),
  });
}

async function redisLRange(key, start, end) {
  const res = await fetch(`${REDIS_URL}/lrange/${encodeURIComponent(key)}/${start}/${end}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  if (!data.result) return [];
  return data.result.map(i => {
    try {
      const parsed = typeof i === 'string' ? JSON.parse(i) : i;
      // Double parse si nécessaire
      if (typeof parsed === 'string') return JSON.parse(parsed);
      return parsed;
    } catch { return null; }
  }).filter(a => a && a.title);
}

async function redisTrim(key, start, end) {
  await fetch(`${REDIS_URL}/ltrim/${encodeURIComponent(key)}/${start}/${end}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
}

// Parse RSS XML manuellement
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const imgMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i) ||
                     block.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
                     block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    items.push({
      title: get('title'),
      description: cleanHTML(get('description') || get('content:encoded') || '').slice(0, 500),
      url: get('link') || get('guid'),
      pubDate: get('pubDate') || new Date().toISOString(),
      image: imgMatch ? imgMatch[1] : null,
    });
  }
  return items.filter(i => i.title && i.title.length > 5);
}

function cleanHTML(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g,' ').trim();
}

// Fetch un flux RSS directement
async function fetchOneFeed(src) {
  try {
    const res = await fetch(src.url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SportDZ/1.0)' }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml).map(item => ({
      ...item,
      source: src.name,
      sourceFlag: src.flag,
      sourceColor: src.color,
    }));
  } catch(e) {
    console.error(`RSS error ${src.name}:`, e.message);
    return [];
  }
}

async function fetchAllRSS() {
  const results = await Promise.allSettled(RSS_SOURCES.map(src => fetchOneFeed(src)));
  const all = [];
  results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });
  return all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 20);
}

// Génération IA avec Claude
async function generateWithAI(article) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return enrichWithoutAI(article);

    const prompt = `Tu es journaliste sportif algérien expert CdM 2026.
Article source: Titre: ${article.title} | Contenu: ${article.description}
Génère UNIQUEMENT ce JSON sans texte avant/après:
{"title":"Titre français accrocheur max 80 chars","title_ar":"العنوان بالعربية","excerpt":"Résumé 2 phrases max","content":"Article complet 250 mots","category":"Algérie ou Coupe du Monde ou Analyse ou Résultat","tags":["tag1","tag2","tag3"],"seo_description":"SEO 150 chars"}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:1000, messages:[{role:'user',content:prompt}] }),
    });

    if (!resp.ok) return enrichWithoutAI(article);
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());

    return {
      ...parsed,
      source_url: article.url, source_name: article.source,
      source_flag: article.sourceFlag, source_color: article.sourceColor,
      image: article.image, published_at: new Date().toISOString(),
      ai_generated: true, slug: slugify(parsed.title),
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    };
  } catch { return enrichWithoutAI(article); }
}

function enrichWithoutAI(a) {
  return {
    title: a.title, title_ar: '', excerpt: a.description.slice(0,200),
    content: a.description, category: 'Football',
    tags: ['Football','CdM2026'], seo_description: a.description.slice(0,150),
    source_url: a.url, source_name: a.source,
    source_flag: a.sourceFlag, source_color: a.sourceColor,
    image: a.image, published_at: a.pubDate,
    ai_generated: false, slug: slugify(a.title),
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
  };
}

function slugify(text) {
  return (text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').slice(0,50)+'-'+Date.now().toString(36);
}

// Handler principal
export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  const { action = 'generate' } = req.query;

  // Lire les articles stockés
  if (action === 'list') {
    const articles = await redisLRange('sportdz:articles', 0, 29);
    return res.status(200).json({ articles, count: articles.length });
  }

  // Tester RSS uniquement
  if (action === 'test-rss') {
    const articles = await fetchAllRSS();
    return res.status(200).json({ count: articles.length, sample: articles.slice(0,3) });
  }

  // Générer articles
  try {
    const rssArticles = await fetchAllRSS();
    if (rssArticles.length === 0) {
      return res.status(200).json({ message: 'Aucun article RSS', generated: 0 });
    }

    const existing = await redisLRange('sportdz:articles', 0, 49);
    const existingTitles = new Set(existing.map(a => a.title?.slice(0,40).toLowerCase()));
    const toProcess = rssArticles.filter(a => !existingTitles.has(a.title.slice(0,40).toLowerCase())).slice(0,4);

    if (toProcess.length === 0) {
      return res.status(200).json({ message: 'Pas de nouveaux articles', generated: 0 });
    }

    const generated = [];
    for (const article of toProcess) {
      const enriched = await generateWithAI(article);
      if (enriched) {
        await redisLPush('sportdz:articles', enriched);
        generated.push(enriched);
      }
    }
    await redisTrim('sportdz:articles', 0, 49);

    return res.status(200).json({ success: true, generated: generated.length, articles: generated });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
