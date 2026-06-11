// Vercel Function — SportDZ
// Données CdM 2026 depuis GitHub openfootball (accessible sans CORS)
export const config = { maxDuration: 30 };

const WC_URL = 'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json';
const FD_TOKEN = '529336eaf4c8420c95e3dd14bad54d40';
const FD_BASE = 'https://api.football-data.org/v4';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

// Drapeaux pays
const FLAGS = {
  'Algeria':'🇩🇿','Argentina':'🇦🇷','Austria':'🇦🇹','Jordan':'🇯🇴',
  'Mexico':'🇲🇽','South Africa':'🇿🇦','South Korea':'🇰🇷','Czech Republic':'🇨🇿',
  'Canada':'🇨🇦','Bosnia & Herzegovina':'🇧🇦','Qatar':'🇶🇦','Switzerland':'🇨🇭',
  'Brazil':'🇧🇷','Haiti':'🇭🇹','Morocco':'🇲🇦','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Australia':'🇦🇺','Paraguay':'🇵🇾','Turkey':'🇹🇷','USA':'🇺🇸',
  'Ecuador':'🇪🇨','Germany':'🇩🇪','Ivory Coast':'🇨🇮','Curaçao':'🇨🇼',
  'Japan':'🇯🇵','Netherlands':'🇳🇱','Sweden':'🇸🇪','Tunisia':'🇹🇳',
  'Belgium':'🇧🇪','Egypt':'🇪🇬','Iran':'🇮🇷','New Zealand':'🇳🇿',
  'Cape Verde':'🇨🇻','Saudi Arabia':'🇸🇦','Spain':'🇪🇸','Uruguay':'🇺🇾',
  'France':'🇫🇷','Iraq':'🇮🇶','Norway':'🇳🇴','Senegal':'🇸🇳',
  'Colombia':'🇨🇴','DR Congo':'🇨🇩','Portugal':'🇵🇹','Uzbekistan':'🇺🇿',
  'Croatia':'🇭🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Ghana':'🇬🇭','Panama':'🇵🇦',
};

// Logos officiels pays (Wikipedia)
const LOGOS = {
  'Algeria':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Flag_of_Algeria.svg/60px-Flag_of_Algeria.svg.png',
  'Argentina':'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/24701-nature-sunflowers-1920x1080-flower-wallpaper.jpg/60px-thumbnail.jpg',
  'France':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_France.svg/60px-Flag_of_France.svg.png',
  'Brazil':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Flag_of_Brazil.svg/60px-Flag_of_Brazil.svg.png',
  'Germany':'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/60px-Flag_of_Germany.svg.png',
  'Spain':'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Flag_of_Spain.svg/60px-Flag_of_Spain.svg.png',
  'England':'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Flag_of_England.svg/60px-Flag_of_England.svg.png',
  'Portugal':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_Portugal.svg/60px-Flag_of_Portugal.svg.png',
  'Morocco':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Flag_of_Morocco.svg/60px-Flag_of_Morocco.svg.png',
};

function getFlag(team){ return FLAGS[team] || '🏳️'; }

function parseDateTime(date, time) {
  // Convertir heure UTC-X en heure Algérie (UTC+1)
  if (!time) return new Date(date + 'T20:00:00Z');
  const match = time.match(/(\d+):(\d+)\s*UTC([+-]\d+)/);
  if (!match) return new Date(date + 'T20:00:00Z');
  const [,h,m,offset] = match;
  const utcOffset = parseInt(offset);
  const utcH = parseInt(h) - utcOffset;
  return new Date(`${date}T${String(utcH).padStart(2,'0')}:${m}:00Z`);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).end(); }
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));

  const { action='scores', code='PL' } = req.query;

  try {
    let data;
    if      (action === 'scores')    data = await getScores();
    else if (action === 'upcoming')  data = await getUpcoming();
    else if (action === 'groups')    data = await getGroups();
    else if (action === 'articles')  data = await getArticles();
    else if (action === 'standings') data = await getStandings(code);
    else data = { error: 'unknown' };
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

async function getWCData() {
  const res = await fetch(WC_URL);
  return res.json();
}

// ── SCORES DU JOUR ────────────────────────────────
async function getScores() {
  const wc = await getWCData();
  const today = new Date().toISOString().split('T')[0];
  const matches = (wc.matches || []).filter(m => m.date === today);

  return {
    matches: matches.map(m => {
      const dt = parseDateTime(m.date, m.time);
      const score = m.score?.ft;
      const isFinished = !!score;
      const now = new Date();
      const isLive = !isFinished && dt <= now && now <= new Date(dt.getTime() + 105*60000);
      return {
        id: `${m.date}-${m.team1}-${m.team2}`,
        league: `🏆 ${m.group || 'Coupe du Monde'}`,
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
  const today = new Date();
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

  const matches = (wc.matches || []).filter(m => {
    const d = new Date(m.date);
    return d > today && d <= in7 && !m.score?.ft;
  }).slice(0, 30);

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
        city: m.ground || '',
        date: dt.toISOString(),
        round: m.round || '',
      };
    })
  };
}

// ── GROUPES ────────────────────────────────────────
async function getGroups() {
  const wc = await getWCData();
  const matches = wc.matches || [];

  // Construire les groupes
  const groupMap = {};
  for (const m of matches) {
    const g = m.group;
    if (!g) continue;
    if (!groupMap[g]) groupMap[g] = {};
    for (const team of [m.team1, m.team2]) {
      if (!groupMap[g][team]) groupMap[g][team] = { name:team, flag:getFlag(team), played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0 };
    }
    // Calculer si score disponible
    const score = m.score?.ft;
    if (score) {
      const [g1, g2] = score;
      const t1 = groupMap[g][m.team1];
      const t2 = groupMap[g][m.team2];
      t1.played++; t2.played++;
      t1.gf += g1; t1.ga += g2;
      t2.gf += g2; t2.ga += g1;
      if (g1 > g2) { t1.won++; t1.pts += 3; t2.lost++; }
      else if (g1 < g2) { t2.won++; t2.pts += 3; t1.lost++; }
      else { t1.draw++; t1.pts++; t2.draw++; t2.pts++; }
    }
  }

  const groups = Object.entries(groupMap).sort(([a],[b]) => a.localeCompare(b)).map(([name, teamsObj]) => ({
    name,
    teams: Object.values(teamsObj).sort((a,b) => b.pts - a.pts || (b.gf-b.ga) - (a.gf-a.ga))
  }));

  return { groups };
}

// ── ARTICLES ──────────────────────────────────────
async function getArticles() {
  const wc = await getWCData();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const yStr = yesterday.toISOString().split('T')[0];
  const played = (wc.matches||[]).filter(m => m.date <= yStr && m.score?.ft).slice(-6);
  return {
    matches: played.map(m => ({
      league: m.group || 'Coupe du Monde',
      leagueFlag: '🏆',
      homeTeam: m.team1,
      homeFlag: getFlag(m.team1),
      awayTeam: m.team2,
      awayFlag: getFlag(m.team2),
      homeScore: m.score.ft[0],
      awayScore: m.score.ft[1],
      venue: m.ground || '',
      date: m.date,
    }))
  };
}

// ── CLASSEMENTS (football-data) ───────────────────
async function getStandings(code) {
  const res = await fetch(`${FD_BASE}/competitions/${code}/standings`, {
    headers: { 'X-Auth-Token': FD_TOKEN }
  });
  return res.json();
}
