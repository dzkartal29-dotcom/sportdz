// api/generate-articles.js — Vercel Cron Job
// SportDZ · Génération automatique d'articles IA + RSS
// Stockage dans Upstash Redis

export const config = { maxDuration: 60 };

const REDIS_URL = 'https://model-hookworm-119603.upstash.io';
const REDIS_TOKEN = 'gQAAAAAAAdMzAAIgcDJmZDg1NzFmNzhjMTI0NzNkYjQ5MDhkN2Y3YmIyMjVmMA';
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const RSS_SOURCES = [
  { url: 'https://www.rfi.fr/fr/rss/sportsfr.xml',           name: 'RFI Sport',    flag: '📻', color: '#E8003D' },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',  name: 'BBC Sport',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#7B2FBE' },
  { url: 'https://www.goal.com/feeds/fr/news',                name: 'Goal.com',     flag: '⚽', color: '#00D673' },
  { url: 'https://www.footmercato.net/rss/actualites.xml',    name: 'Foot Mercato', flag: '🌍', color: '#C9A84C' },
  { url: 'https://www.lequipe.fr/rss/actu_rss_Football.xml',  name: "L'Equipe",    flag: '🇫🇷', color: '#0057B8' },
];

const KEYWORDS = [
  'algerie','algerie','fennecs','coupe du monde','world cup',
  'mundial','2026','groupe j','group j','belmadi',
  'mahrez','bennacer','bounedjah','mandi','belaili',
  'fifa','football','but','goal','victoire','match',
];

// REDIS HELPERS
async function redisLPush(listKey, value) {
  const res = await fetch(`${REDIS_URL}/lpush/${encodeURIComponent(listKey)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(JSON.stringify(value)),
  });
  return res.json();
}

async function redisLRange(listKey, start, end) {
  const res = await fetch(`${REDIS_URL}/lrange/${encodeURIComponent(listKey)}/${start}/${end}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  if (!data.result) return [];
  return data.result.map(item => {
    try { return JSON.parse(item); } catch { return null; }
  }).filter(Boolean);
}

async function redisTrim(listKey, start, end) {
  await fetch(`${REDIS_URL}/ltrim/${encodeURIComponent(listKey)}/${start}/${end}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
}

// HANDLER PRINCIPAL
export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  const { action = 'generate' } = req.query;

  if (action === 'list') {
    const articles = await redisLRange('sportdz:articles', 0, 29);
    return res.status(200).json({ articles, count: articles.length });
  }

  try {
    const rssArticles = await fetchAllRSS();
    if (rssArticles.length === 0) {
      return res.status(200).json({ message: 'Aucun article RSS', generated: 0 });
    }

    const existing = await redisLRange('sportdz:articles', 0, 49);
    const existingTitles = new Set(existing.map(a => a.title?.slice(0,40).toLowerCase()));

    const toProcess = rssArticles
      .filter(a => !existingTitles.has(a.title.slice(0,40).toLowerCase()))
      .slice(0, 4);

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

    return res.status(200).json({
      success: true,
      generated: generated.length,
      articles: generated,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// FETCH RSS
async function fetchAllRSS() {
  const results = await Promise.allSettled(RSS_SOURCES.map(src => fetchOneFeed(src)));
  const all = [];
  results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });
  return all
    .filter(a => { const t = (a.title+' '+a.description).toLowerCase(); return KEYWORDS.some(k => t.includes(k)); })
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 15);
}

async function fetchOneFeed(src) {
  try {
    const url = `${RSS2JSON}${encodeURIComponent(src.url)}&count=15`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok') return [];
    return (data.items || []).map(item => ({
      title: cleanHTML(item.title || ''),
      description: cleanHTML(item.description || item.content || '').slice(0, 600),
      url: item.link || '',
      pubDate: item.pubDate || new Date().toISOString(),
      image: item.enclosure?.link || item.thumbnail || null,
      source: src.name, sourceFlag: src.flag, sourceColor: src.color,
    }));
  } catch { return []; }
}

function cleanHTML(html) {
  return html.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g,' ').trim();
}

// GENERATION IA
async function generateWithAI(rssArticle) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return enrichWithoutAI(rssArticle);

    const prompt = `Tu es journaliste sportif algérien expert CdM 2026. 
Article RSS: Titre: ${rssArticle.title} | Contenu: ${rssArticle.description}
Génère UNIQUEMENT ce JSON:
{"title":"Titre français max 80 chars","title_ar":"العنوان بالعربية","excerpt":"Résumé 2 phrases","content":"Article 250 mots","category":"Algérie ou Coupe du Monde ou Analyse ou Résultat","tags":["tag1","tag2","tag3"],"seo_description":"SEO 150 chars"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:1000, messages:[{role:'user',content:prompt}] }),
    });

    if (!response.ok) return enrichWithoutAI(rssArticle);
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());

    return {
      ...parsed,
      source_url: rssArticle.url, source_name: rssArticle.source,
      source_flag: rssArticle.sourceFlag, source_color: rssArticle.sourceColor,
      image: rssArticle.image, published_at: new Date().toISOString(),
      ai_generated: true, slug: slugify(parsed.title),
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    };
  } catch { return enrichWithoutAI(rssArticle); }
}

function enrichWithoutAI(a) {
  return {
    title: a.title, title_ar: '', excerpt: a.description.slice(0,200),
    content: a.description, category: detectCategory(a.title),
    tags: ['Coupe du Monde','Football','CdM2026'],
    seo_description: a.description.slice(0,150),
    source_url: a.url, source_name: a.source,
    source_flag: a.sourceFlag, source_color: a.sourceColor,
    image: a.image, published_at: a.pubDate, ai_generated: false,
    slug: slugify(a.title), id: Date.now().toString(36) + Math.random().toString(36).slice(2),
  };
}

function detectCategory(t) {
  t = t.toLowerCase();
  if (t.includes('algeri') || t.includes('fennec')) return 'Algérie';
  if (t.includes('résultat') || t.includes('score') || t.includes('but')) return 'Résultat';
  if (t.includes('transfert') || t.includes('mercato')) return 'Transfert';
  return 'Coupe du Monde';
}

function slugify(text) {
  return (text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').slice(0,50)+'-'+Date.now().toString(36);
}
