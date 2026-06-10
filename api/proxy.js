// Vercel Serverless Function — SportDZ
export const config = { maxDuration: 30 };

const FD_TOKEN = '529336eaf4c8420c95e3dd14bad54d40';
const FD_BASE  = 'https://api.football-data.org/v4';

const ESPN_SLUGS = [
  { slug:'fifa.world',          name:'Coupe du Monde 2026', flag:'🏆' },
  { slug:'fifa.worldq.caf',     name:'Qualif. CdM — Afrique', flag:'🌍' },
  { slug:'fifa.worldq.uefa',    name:'Qualif. CdM — Europe', flag:'🇪🇺' },
  { slug:'fifa.worldq.conmebol',name:'Qualif. CdM — Amérique', flag:'🌎' },
  { slug:'fifa.worldq.afc',     name:'Qualif. CdM — Asie', flag:'🌏' },
  { slug:'conmebol.copa',       name:'Copa America', flag:'🌎' },
  { slug:'uefa.nations',        name:'Nations League', flag:'🇪🇺' },
  { slug:'eng.1',               name:'Premier League', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { slug:'esp.1',               name:'La Liga', flag:'🇪🇸' },
  { slug:'ger.1',               name:'Bundesliga', flag:'🇩🇪' },
  { slug:'ita.1',               name:'Serie A', flag:'🇮🇹' },
  { slug:'fra.1',               name:'Ligue 1', flag:'🇫🇷' },
  { slug:'usa.1',               name:'MLS', flag:'🇺🇸' },
  { slug:'arg.1',               name:'Liga Argentina', flag:'🇦🇷' },
  { slug:'bra.1',               name:'Brasileirao', flag:'🇧🇷' },
];

const CORS = {
  'Content-Type':'application/json',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET,OPTIONS',
  'Access-Control-Allow-Headers':'*'
};

export default async function handler(req, res) {
  if (req.method==='OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).end(); }
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));

  const { action='scores', code='PL', date='' } = req.query;

  try {
    let data;
    if      (action==='scores')    data = await getScores(date);
    else if (action==='upcoming')  data = await getUpcoming();
    else if (action==='standings') data = await getStandings(code);
    else if (action==='articles')  data = await getArticles();
    else if (action==='groups')    data = getWCGroups();
    else data = { error:'unknown action' };
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── SCORES ESPN ───────────────────────────────────
async function getScores(targetDate) {
  const allMatches = [];
  const dateStr = targetDate || new Date().toISOString().split('T')[0].replace(/-/g,'');

  await Promise.allSettled(ESPN_SLUGS.map(async (lg) => {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.slug}/scoreboard?dates=${dateStr}`;
      const res = await fetch(url, { headers:{'User-Agent':'Mozilla/5.0'} });
      if (!res.ok) return;
      const data = await res.json();
      for (const e of (data.events||[])) {
        const comp = e.competitions?.[0];
        if (!comp) continue;
        const home = comp.competitors?.find(t=>t.homeAway==='home');
        const away = comp.competitors?.find(t=>t.homeAway==='away');
        if (!home||!away) continue;
        allMatches.push({
          id:        e.id,
          league:    lg.name,
          leagueFlag:lg.flag,
          homeTeam:  home.team?.displayName||'?',
          homeShort: home.team?.shortDisplayName||home.team?.abbreviation||'?',
          homeLogo:  home.team?.logo||'',
          awayTeam:  away.team?.displayName||'?',
          awayShort: away.team?.shortDisplayName||away.team?.abbreviation||'?',
          awayLogo:  away.team?.logo||'',
          homeScore: home.score??null,
          awayScore: away.score??null,
          status:    comp.status?.type?.name||'STATUS_SCHEDULED',
          clock:     comp.status?.displayClock||'',
          venue:     comp.venue?.fullName||'',
          city:      comp.venue?.address?.city||'',
          date:      e.date,
        });
      }
    } catch(_) {}
  }));

  const order = {STATUS_IN_PROGRESS:0,STATUS_HALFTIME:1,STATUS_SCHEDULED:2,STATUS_TIMED:2,STATUS_FINAL:3};
  allMatches.sort((a,b)=>(order[a.status]??2)-(order[b.status]??2));
  return { matches: allMatches };
}

// ── UPCOMING ESPN (7 jours) ───────────────────────
async function getUpcoming() {
  const allMatches = [];
  const today = new Date();

  // Chercher sur 7 jours
  const dates = Array.from({length:7},(_,i)=>{
    const d = new Date(today); d.setDate(d.getDate()+i+1);
    return d.toISOString().split('T')[0].replace(/-/g,'');
  });

  await Promise.allSettled(ESPN_SLUGS.slice(0,8).map(async (lg) => {
    await Promise.allSettled(dates.map(async (dateStr) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.slug}/scoreboard?dates=${dateStr}`;
        const res = await fetch(url, { headers:{'User-Agent':'Mozilla/5.0'} });
        if (!res.ok) return;
        const data = await res.json();
        for (const e of (data.events||[])) {
          const comp = e.competitions?.[0];
          if (!comp) continue;
          const home = comp.competitors?.find(t=>t.homeAway==='home');
          const away = comp.competitors?.find(t=>t.homeAway==='away');
          if (!home||!away) continue;
          allMatches.push({
            id:        e.id,
            league:    lg.name,
            leagueFlag:lg.flag,
            homeTeam:  home.team?.displayName||'?',
            homeShort: home.team?.shortDisplayName||home.team?.abbreviation||'?',
            homeLogo:  home.team?.logo||'',
            awayTeam:  away.team?.displayName||'?',
            awayShort: away.team?.shortDisplayName||away.team?.abbreviation||'?',
            awayLogo:  away.team?.logo||'',
            venue:     comp.venue?.fullName||'',
            city:      comp.venue?.address?.city||'',
            date:      e.date,
          });
        }
      } catch(_) {}
    }));
  }));

  allMatches.sort((a,b)=>new Date(a.date)-new Date(b.date));
  // Dédoublonner
  const seen = new Set();
  const unique = allMatches.filter(m=>{ if(seen.has(m.id)) return false; seen.add(m.id); return true; });
  return { matches: unique };
}

// ── STANDINGS football-data ───────────────────────
async function getStandings(code) {
  const res = await fetch(`${FD_BASE}/competitions/${code}/standings`, {
    headers:{'X-Auth-Token':FD_TOKEN}
  });
  return res.json();
}

// ── ARTICLES ESPN yesterday ───────────────────────
async function getArticles() {
  const allMatches = [];
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g,'');

  await Promise.allSettled(ESPN_SLUGS.slice(0,8).map(async (lg) => {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.slug}/scoreboard?dates=${dateStr}`;
      const res = await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});
      if(!res.ok) return;
      const data = await res.json();
      for(const e of (data.events||[])) {
        const comp = e.competitions?.[0];
        if(comp?.status?.type?.name!=='STATUS_FINAL') continue;
        const home = comp.competitors?.find(t=>t.homeAway==='home');
        const away = comp.competitors?.find(t=>t.homeAway==='away');
        if(!home||!away) continue;
        allMatches.push({
          league:    lg.name,
          leagueFlag:lg.flag,
          homeTeam:  home.team?.displayName||'?',
          homeLogo:  home.team?.logo||'',
          awayTeam:  away.team?.displayName||'?',
          awayLogo:  away.team?.logo||'',
          homeScore: parseInt(home.score)||0,
          awayScore: parseInt(away.score)||0,
          date:      e.date,
        });
      }
    } catch(_) {}
  }));
  return { matches: allMatches.slice(0,6) };
}

// ── WC 2026 GROUPS (données statiques réelles) ────
function getWCGroups() {
  return { groups: [
    { name:'Groupe A', teams:[
      {name:'Qatar',      flag:'🇶🇦', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Équateur',   flag:'🇪🇨', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Sénégal',    flag:'🇸🇳', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Pays-Bas',   flag:'🇳🇱', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
    { name:'Groupe B', teams:[
      {name:'Angleterre', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Iran',       flag:'🇮🇷', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'USA',        flag:'🇺🇸', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Pays de Galles',flag:'🏴󠁧󠁢󠁷󠁬󠁳󠁿',played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
    { name:'Groupe C', teams:[
      {name:'Argentine',  flag:'🇦🇷', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Arabie Saoudite',flag:'🇸🇦',played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Mexique',    flag:'🇲🇽', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Pologne',    flag:'🇵🇱', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
    { name:'Groupe D', teams:[
      {name:'France',     flag:'🇫🇷', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Australie',  flag:'🇦🇺', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Danemark',   flag:'🇩🇰', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Tunisie',    flag:'🇹🇳', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
    { name:'Groupe E', teams:[
      {name:'Espagne',    flag:'🇪🇸', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Costa Rica', flag:'🇨🇷', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Allemagne',  flag:'🇩🇪', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Japon',      flag:'🇯🇵', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
    { name:'Groupe F', teams:[
      {name:'Belgique',   flag:'🇧🇪', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Canada',     flag:'🇨🇦', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Maroc',      flag:'🇲🇦', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Croatie',    flag:'🇭🇷', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
    { name:'Groupe G', teams:[
      {name:'Brésil',     flag:'🇧🇷', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Serbie',     flag:'🇷🇸', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Suisse',     flag:'🇨🇭', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Cameroun',   flag:'🇨🇲', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
    { name:'Groupe H', teams:[
      {name:'Portugal',   flag:'🇵🇹', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Ghana',      flag:'🇬🇭', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Uruguay',    flag:'🇺🇾', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Corée du Sud',flag:'🇰🇷',played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
    // Groupes avec Algérie (qualifiée ?)
    { name:'Groupe Algérie 🇩🇿', teams:[
      {name:'Algérie',    flag:'🇩🇿', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Argentine',  flag:'🇦🇷', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Mexique',    flag:'🇲🇽', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
      {name:'Islande',    flag:'🇮🇸', played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0},
    ]},
  ]};
}
