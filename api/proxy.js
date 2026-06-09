// Vercel Serverless Function — SportDZ proxy
// Juin 2026 = Coupe du Monde 2026 + matchs internationaux

const FD_TOKEN  = '529336eaf4c8420c95e3dd14bad54d40';
const FD_BASE   = 'https://api.football-data.org/v4';
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Toutes les ligues ESPN — priorité aux compétitions actives en juin 2026
const ESPN_LEAGUES = [
  // Coupe du Monde 2026 — PRIORITÉ ABSOLUE
  { slug: 'fifa.world',           name: 'Coupe du Monde 2026', flag: '🏆' },
  { slug: 'fifa.worldq.uefa',     name: 'Qualif. Mondial UEFA', flag: '🌍' },
  { slug: 'fifa.worldq.conmebol', name: 'Qualif. Mondial CONMEBOL', flag: '🌎' },
  { slug: 'fifa.worldq.afc',      name: 'Qualif. Mondial AFC', flag: '🌏' },
  { slug: 'fifa.worldq.caf',      name: 'Qualif. Mondial CAF', flag: '🌍' },
  // Tournois internationaux été 2026
  { slug: 'conmebol.copa',        name: 'Copa America',        flag: '🌎' },
  { slug: 'uefa.nations',         name: 'Nations League',      flag: '🇪🇺' },
  { slug: 'caf.nations',          name: 'CAN 2025',            flag: '🌍' },
  // Championnats européens (hors saison mais play-offs)
  { slug: 'eng.1',                name: 'Premier League',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { slug: 'esp.1',                name: 'La Liga',             flag: '🇪🇸' },
  { slug: 'ger.1',                name: 'Bundesliga',          flag: '🇩🇪' },
  { slug: 'ita.1',                name: 'Serie A',             flag: '🇮🇹' },
  { slug: 'fra.1',                name: 'Ligue 1',             flag: '🇫🇷' },
  { slug: 'usa.1',                name: 'MLS',                 flag: '🇺🇸' },
  { slug: 'arg.1',                name: 'Liga Argentina',      flag: '🇦🇷' },
  { slug: 'bra.1',                name: 'Brasileirao',         flag: '🇧🇷' },
];

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin','*').end();
  }
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));

  const action = req.query.action || 'scores';
  const code   = req.query.code   || 'PL';

  try {
    let data;
    if      (action === 'scores')    data = await fetchScores();
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
      const res = await fetch(`${ESPN_BASE}/${lg.slug}/scoreboard`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) return;
      const data = await res.json();
      (data.events || []).forEach(e => {
        const comp = e.competitions?.[0];
        if (!comp) return;
        const home = comp.competitors?.find(t => t.homeAway === 'home');
        const away = comp.competitors?.find(t => t.homeAway === 'away');
        if (!home || !away) return;

        allMatches.push({
          id:        e.id,
          league:    lg.name,
          leagueFlag:lg.flag,
          homeTeam:  home.team?.displayName || '?',
          homeShort: home.team?.shortDisplayName || home.team?.displayName || '?',
          homeLogo:  home.team?.logo || '',
          awayTeam:  away.team?.displayName || '?',
          awayShort: away.team?.shortDisplayName || away.team?.displayName || '?',
          awayLogo:  away.team?.logo || '',
          homeScore: home.score ?? null,
          awayScore: away.score ?? null,
          status:    comp.status?.type?.name || 'STATUS_SCHEDULED',
          statusDetail: comp.status?.type?.detail || '',
          clock:     comp.status?.displayClock || '',
          date:      e.date,
        });
      });
    } catch(err) {}
  }));

  // Trier : live → à venir → terminés
  const order = { STATUS_IN_PROGRESS:0, STATUS_HALFTIME:1, STATUS_SCHEDULED:2, STATUS_FINAL:3 };
  allMatches.sort((a,b) => (order[a.status]??2) - (order[b.status]??2));

  return { matches: allMatches };
}

// ── UPCOMING : plage élargie 21 jours ────────────
async function fetchUpcoming() {
  // ESPN upcoming — on prend les 21 prochains jours
  const allUpcoming = [];

  await Promise.allSettled(ESPN_LEAGUES.map(async (lg) => {
    try {
      // Chercher les matchs futurs via ESPN scoreboard avec dates
      const today = new Date();
      for (let i = 1; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0].replace(/-/g,'');
        const res = await fetch(
          `${ESPN_BASE}/${lg.slug}/scoreboard?dates=${dateStr}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (!res.ok) continue;
        const data = await res.json();
        (data.events || []).forEach(e => {
          const comp = e.competitions?.[0];
          if (!comp) return;
          const home = comp.competitors?.find(t => t.homeAway === 'home');
          const away = comp.competitors?.find(t => t.homeAway === 'away');
          if (!home || !away) return;
          allUpcoming.push({
            id:        e.id,
            league:    lg.name,
            leagueFlag:lg.flag,
            leagueCode:lg.slug,
            homeTeam:  home.team?.displayName || '?',
            homeShort: home.team?.shortDisplayName || home.team?.displayName || '?',
            homeLogo:  home.team?.logo || '',
            awayTeam:  away.team?.displayName || '?',
            awayShort: away.team?.shortDisplayName || away.team?.displayName || '?',
            awayLogo:  away.team?.logo || '',
            date:      e.date,
          });
        });
      }
    } catch(err) {}
  }));

  allUpcoming.sort((a,b) => new Date(a.date) - new Date(b.date));
  return { matches: allUpcoming };
}

// ── STANDINGS via football-data ───────────────────
async function fetchStandings(code) {
  const res = await fetch(`${FD_BASE}/competitions/${code}/standings`, {
    headers: { 'X-Auth-Token': FD_TOKEN }
  });
  return res.json();
}

// ── ARTICLES — générés intelligemment ────────────
async function fetchArticles() {
  // Récupérer matchs récents ESPN pour générer des vrais articles
  const recentMatches = [];

  await Promise.allSettled(ESPN_LEAGUES.slice(0, 6).map(async (lg) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g,'');
      const res = await fetch(
        `${ESPN_BASE}/${lg.slug}/scoreboard?dates=${dateStr}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!res.ok) return;
      const data = await res.json();
      (data.events || []).forEach(e => {
        const comp = e.competitions?.[0];
        const status = comp?.status?.type?.name;
        if (status !== 'STATUS_FINAL') return;
        const home = comp.competitors?.find(t => t.homeAway === 'home');
        const away = comp.competitors?.find(t => t.homeAway === 'away');
        if (!home || !away) return;
        recentMatches.push({
          league:    lg.name,
          leagueFlag:lg.flag,
          homeTeam:  home.team?.displayName || '?',
          homeLogo:  home.team?.logo || '',
          awayTeam:  away.team?.displayName || '?',
          awayLogo:  away.team?.logo || '',
          homeScore: parseInt(home.score) || 0,
          awayScore: parseInt(away.score) || 0,
          date:      e.date,
          headline:  e.name || '',
        });
      });
    } catch(err) {}
  }));

  return { matches: recentMatches.slice(0, 6) };
}
