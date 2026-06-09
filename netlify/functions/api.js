// Netlify Function — proxy multi-API 100% ESPN (Sans blocage CORS)

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*'
};

// Répertoire des ligues supportées par ESPN
const ESPN_LEAGUES = [
  { slug: 'fifa.world',       name: 'Coupe du Monde',      flag: '🏆' },
  { slug: 'eng.1',            name: 'Premier League',      flag: '🏴' },
  { slug: 'esp.1',            name: 'La Liga',             flag: '🇪🇸' },
  { slug: 'ger.1',            name: 'Bundesliga',          flag: '🇩🇪' },
  { slug: 'ita.1',            name: 'Serie A',             flag: '🇮🇹' },
  { slug: 'fra.1',            name: 'Ligue 1',             flag: '🇫🇷' },
  { slug: 'uefa.champions',   name: 'Champions League',    flag: '⭐' }
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const action = event.queryStringParameters?.action || 'scores';

  try {
    let result;

    if (action === 'scores') {
      result = await fetchESPNData('scores');
    } else if (action === 'upcoming') {
      result = await fetchESPNData('upcoming');
    } else if (action === 'standings') {
      // Pour les classements, on utilise l'API de stats d'ESPN
      const league = event.queryStringParameters?.code || 'eng.1';
      result = await fetchStandingsESPN(league);
    } else if (action === 'articles') {
      result = await fetchArticlesESPN();
    } else {
      result = { error: 'Unknown action' };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(result)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: e.message })
    };
  }
};

// ── FONCTION PRINCIPALE MATCHS (SCORES & UPCOMING) ─────────────────
async function fetchESPNData(type) {
  const allMatches = [];

  await Promise.allSettled(ESPN_LEAGUES.map(async (lg) => {
    try {
      const res = await fetch(`${ESPN_BASE}/${lg.slug}/scoreboard?limit=50`);
      const data = await res.json();
      const events = data.events || [];

      events.forEach(e => {
        const comp = e.competitions?.[0];
        if (!comp) return;
        const home = comp.competitors?.find(t => t.homeAway === 'home');
        const away = comp.competitors?.find(t => t.homeAway === 'away');
        const statusState = comp.status?.type?.state; // 'pre', 'in', ou 'post'
        const statusName = comp.status?.type?.name;
        const clock  = comp.status?.displayClock;

        const matchData = {
          id: e.id,
          league: lg.name,
          leagueFlag: lg.flag,
          homeTeam: home?.team?.displayName || '?',
          homeShort: home?.team?.shortDisplayName || home?.team?.displayName || '?',
          homeLogo: home?.team?.logo || '',
          awayTeam: away?.team?.displayName || '?',
          awayShort: away?.team?.shortDisplayName || away?.team?.displayName || '?',
          awayLogo: away?.team?.logo || '',
          homeScore: home?.score ?? null,
          awayScore: away?.score ?? null,
          status: statusName,
          clock: clock,
          date: e.date,
        };

        // Filtrage propre selon la section demandée
        if (type === 'scores' && (statusState === 'in' || statusState === 'post')) {
          allMatches.push(matchData);
        } else if (type === 'upcoming' && statusState === 'pre') {
          allMatches.push(matchData);
        }
      });
    } catch(err) {}
  }));

  // Format compatible avec le script frontend existant de Claude
  return type === 'scores' ? { matches: allMatches } : { matches: allMatches };
}

// ── STANDINGS via ESPN ─────────────────────────────────────────────
async function fetchStandingsESPN(leagueSlug) {
  try {
    // Si le code reçu est un ancien code FD (ex: PL, FL1), on le convertit au format ESPN
    let slug = leagueSlug;
    if (slug === 'PL') slug = 'eng.1';
    if (slug === 'FL1') slug = 'fra.1';
    if (slug === 'BL1') slug = 'ger.1';
    if (slug === 'SA') slug = 'ita.1';
    if (slug === 'PD') slug = 'esp.1';

    const res = await fetch(`${ESPN_BASE}/${slug}/standings`);
    return await res.json();
  } catch (e) {
    return { error: 'Impossible de charger le classement' };
  }
}

// ── ARTICLES (Simulation d'actualités basées sur les derniers matchs) ──
async function fetchArticlesESPN() {
  try {
    const res = await fetch(`${ESPN_BASE}/eng.1/scoreboard`);
    const data = await res.json();
    const events = data.events || [];
    
    // On prend les derniers matchs terminés pour simuler des actus de façon dynamique
    const finished = events.filter(e => e.competitions?.[0]?.status?.type?.state === 'post').slice(0, 5);
    
    const articles = finished.map(m => {
      const comp = m.competitions[0];
      const home = comp.competitors.find(t => t.homeAway === 'home')?.team?.displayName;
      const away = comp.competitors.find(t => t.homeAway === 'away')?.team?.displayName;
      const hScore = comp.competitors.find(t => t.homeAway === 'home')?.score;
      const aScore = comp.competitors.find(t => t.homeAway === 'away')?.score;

      return {
        title: `Débrief : ${home} vs ${away} (${hScore}-${aScore})`,
        summary: `Retour sur la confrontation intense entre le ${home} et le ${away}. Les statistiques complètes et les faits marquants du match sont désormais disponibles sur SportDZ.`,
        date: m.date
      };
    });

    return { articles: articles.length > 0 ? articles : [{ title: "SportDZ : Toute l'actualité en direct", summary: "Suivez les dernières compétitions internationales et restez connectés pour les classements mis à jour.", date: new Date() }] };
  } catch(e) {
    return { articles: [] };
  }
}
