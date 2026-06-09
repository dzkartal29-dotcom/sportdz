// Vercel Serverless Function — proxy API
const FD_TOKEN = '529336eaf4c8420c95e3dd14bad54d40';
const FD_BASE  = 'https://api.football-data.org/v4';
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const ESPN_LEAGUES = [
  { slug: 'eng.1',          name: 'Premier League',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { slug: 'esp.1',          name: 'La Liga',          flag: '🇪🇸' },
  { slug: 'ger.1',          name: 'Bundesliga',       flag: '🇩🇪' },
  { slug: 'ita.1',          name: 'Serie A',          flag: '🇮🇹' },
  { slug: 'fra.1',          name: 'Ligue 1',          flag: '🇫🇷' },
  { slug: 'uefa.champions', name: 'Champions League', flag: '🏆' },
  { slug: 'uefa.europa',    name: 'Europa League',    flag: '🟠' },
  { slug: 'conmebol.copa',  name: 'Copa America',     flag: '🌎' },
  { slug: 'fifa.worldq.conmebol', name: 'Qualif. Mondial', flag: '🌍' },
];

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin','*').end();
  }

  // Set CORS headers
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));

  const action = req.query.action || 'scores';
  const code   = req.query.code || 'PL';

  try {
    let data;
    if (action === 'scores')    data = await fetchScores();
    else if (action === 'upcoming')  data = await fetchUpcoming();
    else if (action === 'standings') data = await fetchStandings(code);
    else if (action === 'articles')  data = await fetchArticles();
    else data = { error: 'Unknown action' };

    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── SCORES via ESPN ───────────────────────────────
async function fetchScores() {
  const allMatches = [];
  await Promise.allSettled(ESPN_LEAGUES.map(async (lg) => {
    try {
      const res = await fetch(`${ESPN_BASE}/${lg.slug}/scoreboard`);
      if (!res.ok) return;
      const data = await res.json();
      (data.events || []).forEach(e => {
        const comp = e.competitions?.[0];
        if (!comp) return;
        const home = comp.competitors?.find(t => t.homeAway === 'home');
        const away = comp.competitors?.find(t => t.homeAway === 'away');
        allMatches.push({
          id: e.id,
          league: lg.name,
          leagueFlag: lg.flag,
          homeTeam:  home?.team?.displayName || '?',
          homeShort: home?.team?.shortDisplayName || home?.team?.displayName || '?',
          homeLogo:  home?.team?.logo || '',
          awayTeam:  away?.team?.displayName || '?',
          awayShort: away?.team?.shortDisplayName || away?.team?.displayName || '?',
          awayLogo:  away?.team?.logo || '',
          homeScore: home?.score ?? null,
          awayScore: away?.score ?? null,
          status: comp.status?.type?.name,
          clock:  comp.status?.displayClock || '',
          date:   e.date,
        });
      });
    } catch(err) {}
  }));
  return { matches: allMatches };
}

// ── UPCOMING via football-data ────────────────────
async function fetchUpcoming() {
  const from = new Date(); from.setDate(from.getDate() + 1);
  const to   = new Date(); to.setDate(to.getDate() + 14);
  const f1 = from.toISOString().split('T')[0];
  const t1 = to.toISOString().split('T')[0];
  const res = await fetch(`${FD_BASE}/matches?dateFrom=${f1}&dateTo=${t1}`, {
    headers: { 'X-Auth-Token': FD_TOKEN }
  });
  return res.json();
}

// ── STANDINGS via football-data ───────────────────
async function fetchStandings(code) {
  const res = await fetch(`${FD_BASE}/competitions/${code}/standings`, {
    headers: { 'X-Auth-Token': FD_TOKEN }
  });
  return res.json();
}

// ── ARTICLES via football-data ────────────────────
async function fetchArticles() {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const d = yesterday.toISOString().split('T')[0];
  const res = await fetch(`${FD_BASE}/matches?dateFrom=${d}&dateTo=${d}&status=FINISHED`, {
    headers: { 'X-Auth-Token': FD_TOKEN }
  });
  return res.json();
}
