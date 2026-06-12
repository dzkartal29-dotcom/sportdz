// api/generate-articles.js — Vercel Cron Job
// SportDZ · Génération automatique d'articles IA + RSS
// S'exécute automatiquement toutes les 6 heures via Vercel Cron

export const config = { maxDuration: 60 };

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// ── SOURCES RSS ───────────────────────────────────
const RSS_SOURCES = [
  'https://www.rfi.fr/fr/rss/sportsfr.xml',
  'https://feeds.bbci.co.uk/sport/football/rss.xml',
  'https://www.goal.com/feeds/fr/news',
  'https://www.footmercato.net/rss/actualites.xml',
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Mots-clés à surveiller
const KEYWORDS = [
  'algerie','algérie','fennecs','coupe du monde','world cup',
  'mundial','2026','groupe j','group j','djamel belmadi',
  'mahrez','bennacer','bounedjah','mandi','belaili',
];

// ── HANDLER PRINCIPAL ─────────────────────────────
export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  // Sécurité : vérifier le token cron Vercel ou clé secrète
  const authHeader = req.headers['authorization'] || '';
  const cronSecret = process.env.CRON_SECRET || 'sportdz2026';
  if (req.method !== 'GET' && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Récupérer les articles RSS
    const rssArticles = await fetchAllRSS();

    if (rssArticles.length === 0) {
      return res.status(200).json({ message: 'Aucun article RSS trouvé', generated: 0 });
    }

    // 2. Générer les articles avec l'IA (Claude)
    const generated = [];
    // Prendre les 3 meilleurs articles RSS
    const toProcess = rssArticles.slice(0, 3);

    for (const article of toProcess) {
      const enriched = await generateWithAI(article);
      if (enriched) generated.push(enriched);
    }

    // 3. Sauvegarder dans KV Store (Vercel KV) ou retourner les articles
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

// ── RÉCUPÉRER LES FLUX RSS ────────────────────────
async function fetchAllRSS() {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(url => fetchRSS(url))
  );

  const all = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') all.push(...r.value);
  });

  // Filtrer par mots-clés et trier par date
  return all
    .filter(a => {
      const text = (a.title + ' ' + a.description).toLowerCase();
      return KEYWORDS.some(k => text.includes(k));
    })
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 10);
}

async function fetchRSS(feedUrl) {
  try {
    const url = `${RSS2JSON}${encodeURIComponent(feedUrl)}&count=20`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok') return [];
    return (data.items || []).map(item => ({
      title: item.title || '',
      description: cleanHTML(item.description || item.content || ''),
      url: item.link || '',
      pubDate: item.pubDate || new Date().toISOString(),
      image: item.enclosure?.link || item.thumbnail || null,
      source: data.feed?.title || 'Source inconnue',
    }));
  } catch {
    return [];
  }
}

function cleanHTML(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim().slice(0, 500);
}

// ── GÉNÉRER ARTICLE AVEC CLAUDE IA ───────────────
async function generateWithAI(rssArticle) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Sans clé API : enrichir le RSS sans IA
      return enrichWithoutAI(rssArticle);
    }

    const prompt = `Tu es un journaliste sportif algérien expert en football et Coupe du Monde.

Voici un article RSS source :
Titre : ${rssArticle.title}
Contenu : ${rssArticle.description}
Source : ${rssArticle.source}
Date : ${rssArticle.pubDate}

Génère un article complet en JSON avec exactement ce format :
{
  "title": "Titre accrocheur en français (max 80 caractères)",
  "title_ar": "العنوان بالعربية (max 80 حرف)",
  "excerpt": "Résumé en 2 phrases maximum",
  "content": "Article complet de 200-300 mots en français, avec contexte CdM 2026 et angle algérien si possible",
  "category": "une parmi : Algérie / Coupe du Monde / Analyse / Résultat / Transfert",
  "tags": ["tag1", "tag2", "tag3"],
  "seo_description": "Description SEO de 150 caractères max"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return enrichWithoutAI(rssArticle);

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parser le JSON généré
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      ...parsed,
      source_url: rssArticle.url,
      source_name: rssArticle.source,
      image: rssArticle.image,
      published_at: new Date().toISOString(),
      ai_generated: true,
      slug: slugify(parsed.title),
    };

  } catch {
    return enrichWithoutAI(rssArticle);
  }
}

// Fallback sans IA — enrichir le RSS directement
function enrichWithoutAI(article) {
  return {
    title: article.title,
    title_ar: '',
    excerpt: article.description.slice(0, 150) + '...',
    content: article.description,
    category: detectCategory(article.title),
    tags: extractTags(article.title),
    seo_description: article.description.slice(0, 150),
    source_url: article.url,
    source_name: article.source,
    image: article.image,
    published_at: article.pubDate,
    ai_generated: false,
    slug: slugify(article.title),
  };
}

function detectCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('algeri') || t.includes('fennec')) return 'Algérie';
  if (t.includes('résultat') || t.includes('score') || t.includes('but')) return 'Résultat';
  if (t.includes('transfert') || t.includes('mercato')) return 'Transfert';
  if (t.includes('analys') || t.includes('tactique')) return 'Analyse';
  return 'Coupe du Monde';
}

function extractTags(title) {
  const tags = [];
  const t = title.toLowerCase();
  if (t.includes('algeri') || t.includes('fennec')) tags.push('Algérie');
  if (t.includes('france')) tags.push('France');
  if (t.includes('bresil') || t.includes('brazil')) tags.push('Brésil');
  if (t.includes('2026')) tags.push('CdM2026');
  tags.push('Coupe du Monde');
  return tags.slice(0, 4);
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}
