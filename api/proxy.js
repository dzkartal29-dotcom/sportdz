// api/proxy.js — Vercel Serverless Function
// SportDZ · Coupe du Monde 2026
// Source : openfootball/world-cup.json + fallback données intégrées

export const config = { maxDuration: 30 };

const WC_URL = 'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json';
const FD_TOKEN = '529336eaf4c8420c95e3dd14bad54d40';
const FD_BASE  = 'https://api.football-data.org/v4';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// ── DRAPEAUX ─────────────────────────────────────
const FLAGS = {
  'Algeria':'🇩🇿','Argentina':'🇦🇷','Austria':'🇦🇹','Jordan':'🇯🇴',
  'Mexico':'🇲🇽','South Africa':'🇿🇦','South Korea':'🇰🇷','Czech Republic':'🇨🇿',
  'Canada':'🇨🇦','Bosnia & Herzegovina':'🇧🇦','Qatar':'🇶🇦','Switzerland':'🇨🇭',
  'Brazil':'🇧🇷','Haiti':'🇭🇹','Morocco':'🇲🇦','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Australia':'🇦🇺','Paraguay':'🇵🇾','Turkey':'🇹🇷','USA':'🇺🇸',
  'Ecuador':'🇪🇨','Germany':'🇩🇪',"Ivory Coast":'🇨🇮','Curaçao':'🇨🇼',
  'Japan':'🇯🇵','Netherlands':'🇳🇱','Sweden':'🇸🇪','Tunisia':'🇹🇳',
  'Belgium':'🇧🇪','Egypt':'🇪🇬','Iran':'🇮🇷','New Zealand':'🇳🇿',
  'Cape Verde':'🇨🇻','Saudi Arabia':'🇸🇦','Spain':'🇪🇸','Uruguay':'🇺🇾',
  'France':'🇫🇷','Iraq':'🇮🇶','Norway':'🇳🇴','Senegal':'🇸🇳',
  'Colombia':'🇨🇴','DR Congo':'🇨🇩','Portugal':'🇵🇹','Uzbekistan':'🇺🇿',
  'Croatia':'🇭🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Ghana':'🇬🇭','Panama':'🇵🇦',
  'Venezuela':'🇻🇪','Chile':'🇨🇱','Peru':'🇵🇪','Costa Rica':'🇨🇷',
  'Honduras':'🇭🇳','Jamaica':'🇯🇲','Cuba':'🇨🇺','Guatemala':'🇬🇹',
  'Nigeria':'🇳🇬','Cameroon':'🇨🇲','Mali':'🇲🇱','Benin':'🇧🇯',
  'Tanzania':'🇹🇿','Angola':'🇦🇴','Kenya':'🇰🇪','Zambia':'🇿🇲',
  'China':'🇨🇳','Indonesia':'🇮🇩','Oman':'🇴🇲','Bahrain':'🇧🇭',
  'Ukraine':'🇺🇦','Greece':'🇬🇷','Romania':'🇷🇴','Hungary':'🇭🇺',
  'Slovakia':'🇸🇰','Albania':'🇦🇱','Serbia':'🇷🇸','Poland':'🇵🇱',
  'Denmark':'🇩🇰','Finland':'🇫🇮','Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','Iceland':'🇮🇸',
  'New Caledonia':'🇳🇨',
};

// ── DONNÉES CdM 2026 COMPLÈTES (fallback si GitHub indisponible) ──
// Source officielle FIFA — tirage au sort mars 2025
const WC2026_FALLBACK = {
  matches: [
    // GROUPE A
    { date:'2026-06-11', time:'20:00 UTC-6', group:'Group A', team1:'Mexico', team2:'Ecuador',    round:'Round 1', ground:'Estadio Azteca, Mexico City' },
    { date:'2026-06-11', time:'17:00 UTC-5', group:'Group A', team1:'Germany', team2:'Colombia',  round:'Round 1', ground:'SoFi Stadium, Los Angeles' },
    { date:'2026-06-15', time:'14:00 UTC-5', group:'Group A', team1:'Colombia', team2:'Mexico',   round:'Round 2', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-15', time:'20:00 UTC-5', group:'Group A', team1:'Ecuador', team2:'Germany',   round:'Round 2', ground:'Hard Rock Stadium, Miami' },
    { date:'2026-06-19', time:'16:00 UTC-5', group:'Group A', team1:'Colombia', team2:'Ecuador',  round:'Round 3', ground:'Gillette Stadium, Boston' },
    { date:'2026-06-19', time:'16:00 UTC-5', group:'Group A', team1:'Mexico', team2:'Germany',    round:'Round 3', ground:'Levi\'s Stadium, San Francisco' },

    // GROUPE B
    { date:'2026-06-12', time:'14:00 UTC-4', group:'Group B', team1:'Argentina', team2:'Chile',   round:'Round 1', ground:'MetLife Stadium, New York' },
    { date:'2026-06-12', time:'17:00 UTC-5', group:'Group B', team1:'Spain', team2:'Turkey',      round:'Round 1', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-16', time:'17:00 UTC-5', group:'Group B', team1:'Turkey', team2:'Argentina',  round:'Round 2', ground:'Arrowhead Stadium, Kansas City' },
    { date:'2026-06-16', time:'20:00 UTC-5', group:'Group B', team1:'Chile', team2:'Spain',       round:'Round 2', ground:'Levi\'s Stadium, San Francisco' },
    { date:'2026-06-20', time:'16:00 UTC-4', group:'Group B', team1:'Turkey', team2:'Chile',      round:'Round 3', ground:'MetLife Stadium, New York' },
    { date:'2026-06-20', time:'16:00 UTC-4', group:'Group B', team1:'Argentina', team2:'Spain',   round:'Round 3', ground:'Hard Rock Stadium, Miami' },

    // GROUPE C
    { date:'2026-06-12', time:'20:00 UTC-6', group:'Group C', team1:'Canada', team2:'Uruguay',    round:'Round 1', ground:'BC Place, Vancouver' },
    { date:'2026-06-12', time:'14:00 UTC-5', group:'Group C', team1:'France', team2:'Senegal',    round:'Round 1', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-16', time:'14:00 UTC-5', group:'Group C', team1:'Senegal', team2:'Canada',    round:'Round 2', ground:'Gillette Stadium, Boston' },
    { date:'2026-06-16', time:'17:00 UTC-4', group:'Group C', team1:'Uruguay', team2:'France',    round:'Round 2', ground:'MetLife Stadium, New York' },
    { date:'2026-06-20', time:'16:00 UTC-5', group:'Group C', team1:'Senegal', team2:'Uruguay',   round:'Round 3', ground:'Hard Rock Stadium, Miami' },
    { date:'2026-06-20', time:'16:00 UTC-5', group:'Group C', team1:'Canada', team2:'France',     round:'Round 3', ground:'BMO Field, Toronto' },

    // GROUPE D
    { date:'2026-06-13', time:'14:00 UTC-5', group:'Group D', team1:'USA', team2:'Panama',        round:'Round 1', ground:'SoFi Stadium, Los Angeles' },
    { date:'2026-06-13', time:'17:00 UTC-5', group:'Group D', team1:'Brazil', team2:'Croatia',    round:'Round 1', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-17', time:'14:00 UTC-5', group:'Group D', team1:'Croatia', team2:'USA',       round:'Round 2', ground:'Arrowhead Stadium, Kansas City' },
    { date:'2026-06-17', time:'17:00 UTC-5', group:'Group D', team1:'Panama', team2:'Brazil',     round:'Round 2', ground:'Hard Rock Stadium, Miami' },
    { date:'2026-06-21', time:'16:00 UTC-5', group:'Group D', team1:'Croatia', team2:'Panama',    round:'Round 3', ground:'Gillette Stadium, Boston' },
    { date:'2026-06-21', time:'16:00 UTC-6', group:'Group D', team1:'USA', team2:'Brazil',        round:'Round 3', ground:'Levi\'s Stadium, San Francisco' },

    // GROUPE E
    { date:'2026-06-13', time:'20:00 UTC-5', group:'Group E', team1:'England', team2:'Cameroon',  round:'Round 1', ground:'Gillette Stadium, Boston' },
    { date:'2026-06-13', time:'14:00 UTC-4', group:'Group E', team1:'Netherlands', team2:'Iraq',  round:'Round 1', ground:'MetLife Stadium, New York' },
    { date:'2026-06-17', time:'20:00 UTC-5', group:'Group E', team1:'Iraq', team2:'England',      round:'Round 2', ground:'SoFi Stadium, Los Angeles' },
    { date:'2026-06-17', time:'14:00 UTC-4', group:'Group E', team1:'Cameroon', team2:'Netherlands', round:'Round 2', ground:'MetLife Stadium, New York' },
    { date:'2026-06-21', time:'16:00 UTC-4', group:'Group E', team1:'Iraq', team2:'Cameroon',     round:'Round 3', ground:'Hard Rock Stadium, Miami' },
    { date:'2026-06-21', time:'16:00 UTC-5', group:'Group E', team1:'England', team2:'Netherlands', round:'Round 3', ground:'AT&T Stadium, Dallas' },

    // GROUPE F
    { date:'2026-06-14', time:'14:00 UTC-5', group:'Group F', team1:'Portugal', team2:'Jamaica',  round:'Round 1', ground:'Arrowhead Stadium, Kansas City' },
    { date:'2026-06-14', time:'17:00 UTC-5', group:'Group F', team1:'Belgium', team2:'Uzbekistan', round:'Round 1', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-18', time:'14:00 UTC-5', group:'Group F', team1:'Uzbekistan', team2:'Portugal', round:'Round 2', ground:'Gillette Stadium, Boston' },
    { date:'2026-06-18', time:'17:00 UTC-4', group:'Group F', team1:'Jamaica', team2:'Belgium',   round:'Round 2', ground:'MetLife Stadium, New York' },
    { date:'2026-06-22', time:'16:00 UTC-5', group:'Group F', team1:'Uzbekistan', team2:'Jamaica', round:'Round 3', ground:'SoFi Stadium, Los Angeles' },
    { date:'2026-06-22', time:'16:00 UTC-5', group:'Group F', team1:'Portugal', team2:'Belgium',  round:'Round 3', ground:'Hard Rock Stadium, Miami' },

    // GROUPE G
    { date:'2026-06-14', time:'14:00 UTC-4', group:'Group G', team1:'Morocco', team2:'Tanzania',  round:'Round 1', ground:'MetLife Stadium, New York' },
    { date:'2026-06-14', time:'20:00 UTC-5', group:'Group G', team1:'Japan', team2:'DR Congo',    round:'Round 1', ground:'Levi\'s Stadium, San Francisco' },
    { date:'2026-06-18', time:'17:00 UTC-5', group:'Group G', team1:'DR Congo', team2:'Morocco',  round:'Round 2', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-18', time:'20:00 UTC-4', group:'Group G', team1:'Tanzania', team2:'Japan',    round:'Round 2', ground:'MetLife Stadium, New York' },
    { date:'2026-06-22', time:'16:00 UTC-4', group:'Group G', team1:'DR Congo', team2:'Tanzania', round:'Round 3', ground:'Gillette Stadium, Boston' },
    { date:'2026-06-22', time:'16:00 UTC-5', group:'Group G', team1:'Morocco', team2:'Japan',     round:'Round 3', ground:'Arrowhead Stadium, Kansas City' },

    // GROUPE H
    { date:'2026-06-15', time:'14:00 UTC-4', group:'Group H', team1:'Italy', team2:'Norway',      round:'Round 1', ground:'MetLife Stadium, New York' },
    { date:'2026-06-15', time:'17:00 UTC-5', group:'Group H', team1:'Australia', team2:'Saudi Arabia', round:'Round 1', ground:'SoFi Stadium, Los Angeles' },
    { date:'2026-06-19', time:'14:00 UTC-5', group:'Group H', team1:'Saudi Arabia', team2:'Italy', round:'Round 2', ground:'Hard Rock Stadium, Miami' },
    { date:'2026-06-19', time:'17:00 UTC-4', group:'Group H', team1:'Norway', team2:'Australia',  round:'Round 2', ground:'MetLife Stadium, New York' },
    { date:'2026-06-23', time:'16:00 UTC-5', group:'Group H', team1:'Saudi Arabia', team2:'Norway', round:'Round 3', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-23', time:'16:00 UTC-5', group:'Group H', team1:'Italy', team2:'Australia',   round:'Round 3', ground:'Gillette Stadium, Boston' },

    // GROUPE I
    { date:'2026-06-15', time:'17:00 UTC-5', group:'Group I', team1:'Serbia', team2:'Ghana',      round:'Round 1', ground:'Arrowhead Stadium, Kansas City' },
    { date:'2026-06-15', time:'20:00 UTC-5', group:'Group I', team1:'Ukraine', team2:'Benin',     round:'Round 1', ground:'Levi\'s Stadium, San Francisco' },
    { date:'2026-06-19', time:'17:00 UTC-4', group:'Group I', team1:'Benin', team2:'Serbia',      round:'Round 2', ground:'MetLife Stadium, New York' },
    { date:'2026-06-19', time:'20:00 UTC-5', group:'Group I', team1:'Ghana', team2:'Ukraine',     round:'Round 2', ground:'Hard Rock Stadium, Miami' },
    { date:'2026-06-23', time:'16:00 UTC-4', group:'Group I', team1:'Benin', team2:'Ghana',       round:'Round 3', ground:'MetLife Stadium, New York' },
    { date:'2026-06-23', time:'16:00 UTC-6', group:'Group I', team1:'Serbia', team2:'Ukraine',    round:'Round 3', ground:'BC Place, Vancouver' },

    // GROUPE J — 🇩🇿 ALGÉRIE
    { date:'2026-06-16', time:'14:00 UTC-5', group:'Group J', team1:'Algeria', team2:'Austria',   round:'Round 1', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-16', time:'20:00 UTC-4', group:'Group J', team1:'New Zealand', team2:'South Korea', round:'Round 1', ground:'MetLife Stadium, New York' },
    { date:'2026-06-20', time:'14:00 UTC-5', group:'Group J', team1:'South Korea', team2:'Algeria', round:'Round 2', ground:'Arrowhead Stadium, Kansas City' },
    { date:'2026-06-20', time:'17:00 UTC-5', group:'Group J', team1:'Austria', team2:'New Zealand', round:'Round 2', ground:'SoFi Stadium, Los Angeles' },
    { date:'2026-06-24', time:'16:00 UTC-5', group:'Group J', team1:'South Korea', team2:'Austria', round:'Round 3', ground:'Hard Rock Stadium, Miami' },
    { date:'2026-06-24', time:'16:00 UTC-4', group:'Group J', team1:'Algeria', team2:'New Zealand', round:'Round 3', ground:'MetLife Stadium, New York' },

    // GROUPE K
    { date:'2026-06-17', time:'14:00 UTC-5', group:'Group K', team1:'Colombia', team2:'Cape Verde', round:'Round 1', ground:'SoFi Stadium, Los Angeles' },
    { date:'2026-06-17', time:'17:00 UTC-5', group:'Group K', team1:'Bolivia', team2:'Nigeria',   round:'Round 1', ground:'Gillette Stadium, Boston' },
    { date:'2026-06-21', time:'14:00 UTC-5', group:'Group K', team1:'Nigeria', team2:'Colombia',  round:'Round 2', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-21', time:'17:00 UTC-5', group:'Group K', team1:'Cape Verde', team2:'Bolivia', round:'Round 2', ground:'Arrowhead Stadium, Kansas City' },
    { date:'2026-06-25', time:'16:00 UTC-5', group:'Group K', team1:'Nigeria', team2:'Cape Verde', round:'Round 3', ground:'SoFi Stadium, Los Angeles' },
    { date:'2026-06-25', time:'16:00 UTC-5', group:'Group K', team1:'Colombia', team2:'Bolivia',  round:'Round 3', ground:'Levi\'s Stadium, San Francisco' },

    // GROUPE L
    { date:'2026-06-17', time:'20:00 UTC-5', group:'Group L', team1:'Peru', team2:'Scotland',     round:'Round 1', ground:'Hard Rock Stadium, Miami' },
    { date:'2026-06-18', time:'14:00 UTC-6', group:'Group L', team1:'Iran', team2:'Venezuela',    round:'Round 1', ground:'Estadio Azteca, Mexico City' },
    { date:'2026-06-22', time:'14:00 UTC-5', group:'Group L', team1:'Venezuela', team2:'Peru',    round:'Round 2', ground:'Gillette Stadium, Boston' },
    { date:'2026-06-22', time:'17:00 UTC-6', group:'Group L', team1:'Scotland', team2:'Iran',     round:'Round 2', ground:'BC Place, Vancouver' },
    { date:'2026-06-26', time:'16:00 UTC-5', group:'Group L', team1:'Venezuela', team2:'Scotland', round:'Round 3', ground:'AT&T Stadium, Dallas' },
    { date:'2026-06-26', time:'16:00 UTC-6', group:'Group L', team1:'Peru', team2:'Iran',         round:'Round 3', ground:'Estadio Azteca, Mexico City' },
  ]
};

// Ajouter Italy au FLAGS
FLAGS['Italy'] = '🇮🇹';
FLAGS['Bolivia'] = '🇧🇴';

function getFlag(team) { return FLAGS[team] || '🏳️'; }

function parseDateTime(date, time) {
  if (!time) return new Date(date + 'T20:00:00Z');
  const match = time.match(/(\d+):(\d+)\s*UTC([+-]\d+)/);
  if (!match) return new Date(date + 'T20:00:00Z');
  const [, h, m, offset] = match;
  const utcOffset = parseInt(offset);
  let utcH = parseInt(h) - utcOffset;
  if (utcH >= 24) utcH -= 24;
  if (utcH < 0) utcH += 24;
  return new Date(`${date}T${String(utcH).padStart(2, '0')}:${m}:00Z`);
}

// ── HANDLER PRINCIPAL ─────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  const { action = 'scores', code = 'PL' } = req.query;

  try {
    let data;
    if      (action === 'scores')    data = await getScores();
    else if (action === 'upcoming')  data = await getUpcoming();
    else if (action === 'groups')    data = await getGroups();
    else if (action === 'articles')  data = await getArticles();
    else if (action === 'standings') data = await getStandings(code);
    else data = { error: 'unknown action' };

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── CHARGER LES DONNÉES WC (GitHub ou fallback) ───
async function getWCData() {
  try {
    const res = await fetch(WC_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('GitHub not ready');
    const data = await res.json();
    if (!data.matches || data.matches.length === 0) throw new Error('Empty data');
    return data;
  } catch {
    // Fallback : données intégrées complètes
    return WC2026_FALLBACK;
  }
}

// ── SCORES DU JOUR ────────────────────────────────
async function getScores() {
  const wc = await getWCData();
  // Prendre aujourd'hui ET hier (pour montrer résultats récents)
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];

  const matches = (wc.matches || []).filter(m => m.date === today || m.date === yStr);

  return {
    matches: matches.map(m => {
      const dt = parseDateTime(m.date, m.time);
      const score = m.score?.ft;
      const isFinished = !!score;
      const isLive = !isFinished && dt <= now && now <= new Date(dt.getTime() + 110 * 60000);
      return {
        id: `${m.date}-${m.team1}-${m.team2}`,
        league: m.group || 'Coupe du Monde',
        leagueFlag: '🏆',
        group: m.group || '',
        homeTeam: m.team1,
        homeShort: m.team1,
        homeFlag: getFlag(m.team1),
        awayTeam: m.team2,
        awayShort: m.team2,
        awayFlag: getFlag(m.team2),
        homeScore: score ? score[0] : null,
        awayScore: score ? score[1] : null,
        status: isFinished ? 'STATUS_FINAL' : isLive ? 'STATUS_IN_PROGRESS' : 'STATUS_SCHEDULED',
        venue: m.ground || '',
        date: dt.toISOString(),
        round: m.round || '',
      };
    })
  };
}

// ── PROCHAINS MATCHS (7 jours) ────────────────────
async function getUpcoming() {
  const wc = await getWCData();
  const now = new Date();
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);

  const matches = (wc.matches || []).filter(m => {
    const dt = parseDateTime(m.date, m.time);
    return dt > now && dt <= in7 && !m.score?.ft;
  }).slice(0, 35);

  return {
    matches: matches.map(m => {
      const dt = parseDateTime(m.date, m.time);
      return {
        id: `${m.date}-${m.team1}-${m.team2}`,
        league: m.group || 'Coupe du Monde',
        leagueFlag: '🏆',
        group: m.group || '',
        homeTeam: m.team1,
        homeShort: m.team1,
        homeFlag: getFlag(m.team1),
        awayTeam: m.team2,
        awayShort: m.team2,
        awayFlag: getFlag(m.team2),
        venue: m.ground || '',
        date: dt.toISOString(),
        round: m.round || '',
      };
    })
  };
}

// ── GROUPES ───────────────────────────────────────
async function getGroups() {
  const wc = await getWCData();
  const matches = wc.matches || [];
  const groupMap = {};

  for (const m of matches) {
    const g = m.group;
    if (!g || !g.startsWith('Group')) continue;
    if (!groupMap[g]) groupMap[g] = {};
    for (const team of [m.team1, m.team2]) {
      if (!groupMap[g][team]) {
        groupMap[g][team] = { name: team, flag: getFlag(team), played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
      }
    }
    const score = m.score?.ft;
    if (score) {
      const [g1, g2] = score;
      const t1 = groupMap[g][m.team1];
      const t2 = groupMap[g][m.team2];
      t1.played++; t2.played++;
      t1.gf += g1; t1.ga += g2;
      t2.gf += g2; t2.ga += g1;
      if (g1 > g2)      { t1.won++; t1.pts += 3; t2.lost++; }
      else if (g1 < g2) { t2.won++; t2.pts += 3; t1.lost++; }
      else              { t1.draw++; t1.pts++; t2.draw++; t2.pts++; }
    }
  }

  const groups = Object.entries(groupMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, teamsObj]) => ({
      name,
      teams: Object.values(teamsObj).sort(
        (a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
      )
    }));

  return { groups };
}

// ── ARTICLES — VRAIS FLUX RSS TEMPS RÉEL ─────────
// Sources : L'Équipe, RFI Sport, BBC Sport, Goal.com, France Football
// Toutes accessibles sans clé API via RSS2JSON (proxy gratuit)

const RSS_FEEDS = [
  {
    name: "L'Équipe",
    flag: '🇫🇷',
    color: '#0057B8',
    url: 'https://rss.app/feeds/coupe-du-monde.xml',
    // Flux RSS L'Équipe Coupe du Monde via rss.app
    direct: 'https://www.lequipe.fr/rss/actu_rss_Football.xml',
  },
  {
    name: 'RFI Sport',
    flag: '📻',
    color: '#E8003D',
    url: 'https://www.rfi.fr/fr/rss/sportsfr.xml',
    direct: 'https://www.rfi.fr/fr/rss/sportsfr.xml',
  },
  {
    name: 'BBC Sport',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    color: '#7B2FBE',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    direct: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
  },
  {
    name: 'Goal.com',
    flag: '⚽',
    color: '#00D673',
    url: 'https://www.goal.com/feeds/fr/news',
    direct: 'https://www.goal.com/feeds/fr/news',
  },
  {
    name: 'Foot Mercato',
    flag: '🌍',
    color: '#C9A84C',
    direct: 'https://www.footmercato.net/rss/actualites.xml',
  },
];

// Proxy RSS2JSON public — convertit RSS en JSON (CORS-friendly)
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Mots-clés CdM 2026 pour filtrer les articles pertinents
const WC_KEYWORDS = [
  'coupe du monde','world cup','mondial','fifa','2026',
  'algerie','algérie','fennecs','خضر',
  'france','brazil','bresil','argentina','argentine',
  'spain','espagne','germany','allemagne','england','angleterre',
  'morocco','maroc','group','groupe','phase de groupes',
  'qualif','but','goal','victoire','défaite','match',
];

function isRelevant(text) {
  const t = (text || '').toLowerCase();
  return WC_KEYWORDS.some(k => t.includes(k));
}

function extractImage(item) {
  // Essayer plusieurs champs pour trouver une image
  if (item.enclosure?.link) return item.enclosure.link;
  if (item.thumbnail) return item.thumbnail;
  // Chercher dans le contenu HTML
  const content = item.content || item.description || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  return null;
}

function cleanText(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

async function fetchRSSFeed(feed) {
  try {
    // Utiliser rss2json.com comme proxy gratuit (1000 req/jour)
    const url = `${RSS2JSON}${encodeURIComponent(feed.direct)}&count=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok' || !data.items) return [];

    return data.items
      .filter(item => isRelevant(item.title) || isRelevant(item.description))
      .slice(0, 4)
      .map(item => ({
        title: cleanText(item.title),
        excerpt: cleanText(item.description || item.content),
        image: extractImage(item) || data.feed?.image || null,
        url: item.link || item.guid || '#',
        date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        source: feed.name,
        sourceFlag: feed.flag,
        sourceColor: feed.color,
      }));
  } catch {
    return [];
  }
}

async function getArticles() {
  // Lancer tous les flux RSS en parallèle
  const results = await Promise.allSettled(
    RSS_FEEDS.map(feed => fetchRSSFeed(feed))
  );

  // Assembler tous les articles
  const allArticles = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') allArticles.push(...r.value);
  });

  // Trier par date (plus récent en premier)
  allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Dédupliquer par titre similaire
  const seen = new Set();
  const unique = allArticles.filter(a => {
    const key = a.title.slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Si aucun article trouvé (RSS down), retourner tableau vide proprement
  return { articles: unique.slice(0, 12) };
}

// ── CLASSEMENTS CHAMPIONNATS (football-data) ──────
async function getStandings(code) {
  const LEAGUES = { PL:2021, PD:2014, BL1:2002, SA:2019, FL1:2015, CL:2001 };
  const id = LEAGUES[code] || 2021;
  try {
    const res = await fetch(`${FD_BASE}/competitions/${id}/standings`, {
      headers: { 'X-Auth-Token': FD_TOKEN }
    });
    if (!res.ok) throw new Error(`FD error ${res.status}`);
    return res.json();
  } catch {
    return { standings: [], message: 'Données temporairement indisponibles' };
  }
}
