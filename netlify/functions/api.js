// Netlify Function — proxy multi-API
// ESPN (public) + football-data fallback

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const FD_TOKEN  = '529336eaf4c8420c95e3dd14bad54d40';
const FD_BASE   = 'https://api.football-data.org/v4';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*'
};

// Mapping ESPN league slugs
const ESPN_LEAGUES = [
  { slug: 'eng.1',   id: 2021, name: 'Premier League',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { slug: 'esp.1',   id: 2014, name: 'La Liga',          flag: '🇪🇸' },
  { slug: 'ger.1',   id: 2002, name: 'Bundesliga',       flag: '🇩🇪' },
  { slug: 'ita.1',   id: 2019, name: 'Serie A',          flag: '🇮🇹' },
  { slug: 'fra.1',   id: 2015, name: 'Ligue 1',          flag: '🇫🇷' },
  { slug: 'uefa.champions', id: 2001, name: 'Champions League', flag: '🏆' },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const action = event.queryStringParameters?.action || 'scores';

  try {
    let result;

    if (action === 'scores') {
      result = await fetchScoresESPN();
    } else if (action === 'upcoming') {
      result = await fetchUpcomingFD();
    } else if (action === 'standings') {
      const code = event.queryStringParameters?.code || 'PL';
      result = await fetchStandingsFD(code);
    } else if (action === 'articles') {
      result = await fetchArticlesFD();
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

// ── SCORES via ESPN ───────────────────────────────
async function fetchScoresESPN() {
  const allMatches = [];

  await Promise.allSettled(ESPN_LEAGUES.map(async (lg) => {
    try {
      const res = await fetch(`${ESPN_BASE}/${lg.slug}/scoreboard`);
      const data = await res.json();
      const events = data.events || [];

      events.forEach(e => {
        const comp = e.competitions?.[0];
        if (!comp) return;
        const home = comp.competitors?.find(t => t.homeAway === 'home');
        const away = comp.competitors?.find(t => t.homeAway === 'away');
        const status = comp.status?.type?.name;
        const clock  = comp.status?.displayClock;
        const period = comp.status?.period;

        allMatches.push({
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
          status: status,
          clock: clock,
          date: e.date,
        });
      });
    } catch(err) {}
  }));

  return { matches: allMatches };
}

// ── UPCOMING via football-data ────────────────────
async function fetchUpcomingFD() {
  const from = new Date(); from.setDate(from.getDate() + 1);
  const to   = new Date(); to.setDate(to.getDate() + 7);
  const f1 = from.toISOString().split('T')[0];
  const t1 = to.toISOString().split('T')[0];

  const res = await fetch(`${FD_BASE}/matches?dateFrom=${f1}&dateTo=${t1}`, {
    headers: { 'X-Auth-Token': FD_TOKEN }
  });
  return res.json();
}

// ── STANDINGS via football-data ───────────────────
async function fetchStandingsFD(code) {
  const res = await fetch(`${FD_BASE}/competitions/${code}/standings`, {
    headers: { 'X-Auth-Token': FD_TOKEN }
  });
  return res.json();
}

// ── ARTICLES via football-data ────────────────────
async function fetchArticlesFD() {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const d = yesterday.toISOString().split('T')[0];
  const res = await fetch(`${FD_BASE}/matches?dateFrom=${d}&dateTo=${d}&status=FINISHED`, {
    headers: { 'X-Auth-Token': FD_TOKEN }
  });
  return res.json();
}
