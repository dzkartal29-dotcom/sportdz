// ============================================
// SportDZ — API-Football via proxy CORS
// ============================================

const API_KEY = '5130309ed2mshe40285506e8c3f9p1259d1jsn9a47c28618f2';
const API_HOST = 'api-football-v1.p.rapidapi.com';
const SEASON = 2024;

const LEAGUES = [
  { id: 197, name: 'Ligue 1 Algérie',  flag: '🇩🇿' },
  { id: 39,  name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga',           flag: '🇪🇸' },
  { id: 61,  name: 'Ligue 1',           flag: '🇫🇷' },
  { id: 135, name: 'Serie A',           flag: '🇮🇹' },
  { id: 78,  name: 'Bundesliga',        flag: '🇩🇪' },
  { id: 2,   name: 'Champions League',  flag: '🏆' },
  { id: 12,  name: 'CAF Champions',     flag: '🌍' },
];

async function apiCall(endpoint) {
  const url = `https://${API_HOST}/v3/${endpoint}`;
  // Essaye direct d'abord, puis proxy si ça échoue
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error('Direct failed');
    return await res.json();
  } catch(e) {
    // Proxy CORS fallback
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, {
        headers: {
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST
        }
      });
      return await res.json();
    } catch(e2) {
      // Deuxième proxy fallback
      const proxyUrl2 = `https://api.allorigins.win/get?url=${encodeURIComponent(url + '&apikey=' + API_KEY)}`;
      const res = await fetch(proxyUrl2);
      const data = await res.json();
      return JSON.parse(data.contents);
    }
  }
}

function getStatusInfo(short, elapsed) {
  if (['1H','2H','ET','BT','P','LIVE'].includes(short))
    return { label: `🔴 ${elapsed || ''}\'`, cls: 'live' };
  if (short === 'HT') return { label: '⏸ Mi-temps', cls: 'live' };
  if (['FT','AET','PEN'].includes(short)) return { label: 'Terminé', cls: 'finished' };
  return { label: 'À venir', cls: 'upcoming' };
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Algiers'});
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short',timeZone:'Africa/Algiers'});
}
function logo(url, size=30) {
  return `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><circle cx=%2216%22 cy=%2216%22 r=%2215%22 fill=%22%231a1a1a%22/><text x=%2216%22 y=%2221%22 text-anchor=%22middle%22 font-size=%2214%22>⚽</text></svg>'">`;
}

// ── SCORES ────────────────────────────────────────
async function fetchScores() {
  const el = document.getElementById('scores-container');
  if (!el) return;
  el.innerHTML = stateHTML('spinner', 'Chargement des scores en direct...', 'جاري تحميل النتائج...');
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await apiCall(`fixtures?date=${today}&timezone=Africa%2FAlgiers`);
    const leagueIds = LEAGUES.map(l => l.id);
    let fixtures = (data.response || []).filter(f => leagueIds.includes(f.league.id));

    if (!fixtures.length) {
      el.innerHTML = stateHTML('📅', 'Aucun match aujourd\'hui', 'لا توجد مباريات اليوم');
      return;
    }

    fixtures.sort((a,b) => {
      const o = {live:0, upcoming:1, finished:2};
      return (o[getStatusInfo(a.fixture.status.short).cls]??3) - (o[getStatusInfo(b.fixture.status.short).cls]??3);
    });

    el.innerHTML = fixtures.map(f => {
      const st = getStatusInfo(f.fixture.status.short, f.fixture.status.elapsed);
      const lg = LEAGUES.find(l => l.id === f.league.id);
      const gh = f.goals.home ?? 0, ga = f.goals.away ?? 0;
      const scoreOrTime = st.cls === 'upcoming' ? fmtTime(f.fixture.date) : `${gh} - ${ga}`;
      return `
        <div class="score-card animate-in">
          <div class="score-league">${lg?.flag||''} ${lg?.name||f.league.name}</div>
          <div class="score-match">
            <div class="team">
              <div class="team-logo">${logo(f.teams.home.logo)}</div>
              <div class="team-name">${f.teams.home.name}</div>
            </div>
            <div class="score-center">
              <div class="score-num">${scoreOrTime}</div>
              <span class="score-time ${st.cls}">${st.label}</span>
              ${st.cls==='upcoming'?`<div class="match-date">${fmtDate(f.fixture.date)}</div>`:''}
            </div>
            <div class="team">
              <div class="team-logo">${logo(f.teams.away.logo)}</div>
              <div class="team-name">${f.teams.away.name}</div>
            </div>
          </div>
        </div>`;
    }).join('');

    updateTicker(fixtures);
  } catch(e) {
    console.error('Scores error:', e);
    el.innerHTML = stateHTML('⚠️', 'Erreur API — vérifiez la clé RapidAPI', e.message);
  }
}

// ── PROCHAINS MATCHS ──────────────────────────────
let upcomingData = {};

async function fetchUpcoming() {
  const el = document.getElementById('upcoming-container');
  const tabsEl = document.getElementById('upcoming-tabs');
  if (!el) return;
  el.innerHTML = stateHTML('spinner', 'Chargement...', '');
  try {
    const from = new Date(); from.setDate(from.getDate()+1);
    const to   = new Date(); to.setDate(to.getDate()+7);
    const f1 = from.toISOString().split('T')[0];
    const t1 = to.toISOString().split('T')[0];
    const data = await apiCall(`fixtures?from=${f1}&to=${t1}&timezone=Africa%2FAlgiers`);
    const leagueIds = LEAGUES.map(l=>l.id);
    const fixtures = (data.response||[]).filter(f=>leagueIds.includes(f.league.id));

    upcomingData = {};
    fixtures.forEach(f => {
      if (!upcomingData[f.league.id]) upcomingData[f.league.id]=[];
      upcomingData[f.league.id].push(f);
    });

    const avail = LEAGUES.filter(l=>upcomingData[l.id]?.length);
    if (!avail.length) { el.innerHTML = stateHTML('📅','Aucun match à venir',''); return; }

    tabsEl.innerHTML = avail.map((l,i)=>`
      <button class="league-tab ${i===0?'active':''}" onclick="switchUpcoming(${l.id},this)">
        ${l.flag} ${l.name}
      </button>`).join('');

    renderUpcoming(avail[0].id);

    clearInterval(window._upInt);
    let idx=0;
    window._upInt = setInterval(()=>{
      idx=(idx+1)%avail.length;
      tabsEl.querySelectorAll('.league-tab').forEach(t=>t.classList.remove('active'));
      tabsEl.querySelectorAll('.league-tab')[idx]?.classList.add('active');
      renderUpcoming(avail[idx].id);
    }, 8000);
  } catch(e) {
    el.innerHTML = stateHTML('⚠️','Erreur chargement','');
  }
}

window.switchUpcoming = function(lid, btn) {
  clearInterval(window._upInt);
  document.querySelectorAll('#upcoming-tabs .league-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderUpcoming(lid);
};

function renderUpcoming(lid) {
  const el = document.getElementById('upcoming-container');
  const fixtures = (upcomingData[lid]||[]).slice(0,6);
  if (!fixtures.length) { el.innerHTML = stateHTML('📅','Aucun match',''); return; }
  el.innerHTML = `<div class="upcoming-list">${fixtures.map(f=>`
    <div class="upcoming-item animate-in">
      <div class="upcoming-date">
        <div class="upd-day">${fmtDate(f.fixture.date)}</div>
        <div class="upd-time">⏰ ${fmtTime(f.fixture.date)}</div>
      </div>
      <div class="upcoming-match">
        <div class="upm-team">${logo(f.teams.home.logo,26)}<span>${f.teams.home.name}</span></div>
        <div class="upm-vs">VS</div>
        <div class="upm-team right"><span>${f.teams.away.name}</span>${logo(f.teams.away.logo,26)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ── CLASSEMENTS ───────────────────────────────────
let standingsCache = {};

async function fetchAllStandings() {
  const tabsEl = document.getElementById('standings-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = LEAGUES.map((l,i)=>`
    <button class="league-tab ${i===0?'active':''}" onclick="switchStandings(${l.id},this)">
      ${l.flag} ${l.name}
    </button>`).join('');

  await loadStandings(LEAGUES[0].id);

  clearInterval(window._stInt);
  let idx=0;
  window._stInt = setInterval(async()=>{
    idx=(idx+1)%LEAGUES.length;
    const tabs = tabsEl.querySelectorAll('.league-tab');
    tabs.forEach(t=>t.classList.remove('active'));
    tabs[idx]?.classList.add('active');
    await loadStandings(LEAGUES[idx].id);
  }, 10000);
}

window.switchStandings = async function(lid, btn) {
  clearInterval(window._stInt);
  document.querySelectorAll('#standings-tabs .league-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  await loadStandings(lid);
};

async function loadStandings(lid) {
  const tbody = document.getElementById('standings-body');
  if (!tbody) return;
  if (standingsCache[lid]) { renderStandings(standingsCache[lid], lid); return; }
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted)"><div class="spinner" style="margin:0 auto;width:28px;height:28px"></div></td></tr>`;
  try {
    const data = await apiCall(`standings?league=${lid}&season=${SEASON}`);
    const st = data.response?.[0]?.league?.standings?.[0];
    if (!st) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted)">Données non disponibles pour cette saison</td></tr>`;
      return;
    }
    standingsCache[lid] = st;
    renderStandings(st, lid);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--red)">Erreur de chargement</td></tr>`;
  }
}

function renderStandings(standings, lid) {
  const tbody = document.getElementById('standings-body');
  const top3El = document.getElementById('top-scorers-container');
  if (!tbody) return;
  const total = standings.length;

  tbody.innerHTML = standings.slice(0,10).map(t => {
    const form = (t.form||'').split('').slice(-5).map(f=>
      f==='W'?'<div class="fd fw"></div>':f==='D'?'<div class="fd fd2"></div>':'<div class="fd fl"></div>'
    ).join('');
    const rankCls = t.rank<=3?'top':t.rank>=total-2?'rel':'';
    return `
      <tr class="animate-in ${t.rank<=3?'highlight':''}">
        <td class="rank ${rankCls}">${t.rank}</td>
        <td><div style="display:flex;align-items:center;gap:8px">${logo(t.team.logo,22)}<strong>${t.team.name}</strong></div></td>
        <td>${t.all.played}</td>
        <td>${t.all.win}</td>
        <td>${t.all.draw}</td>
        <td>${t.all.lose}</td>
        <td>${t.all.goals.for}:${t.all.goals.against}</td>
        <td class="pts">${t.points}</td>
        <td><div class="form-dots">${form}</div></td>
      </tr>`;
  }).join('');

  if (top3El) {
    const topAtk = standings.slice(0,3);
    const topDef = [...standings].sort((a,b)=>a.all.goals.against-b.all.goals.against).slice(0,3);
    top3El.innerHTML = `
      <div class="top3-title">⚽ Top 3 Meilleures Attaques</div>
      ${topAtk.map((t,i)=>`
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${logo(t.team.logo,28)}
          <div class="top3-info"><div class="top3-name">${t.team.name}</div><div class="top3-stat">${t.all.goals.for} buts</div></div>
          <div class="top3-num">${t.all.goals.for}</div>
        </div>`).join('')}
      <div class="top3-title" style="margin-top:14px">🛡️ Top 3 Meilleures Défenses</div>
      ${topDef.map((t,i)=>`
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${logo(t.team.logo,28)}
          <div class="top3-info"><div class="top3-name">${t.team.name}</div><div class="top3-stat">${t.all.goals.against} encaissés</div></div>
          <div class="top3-num">${t.all.goals.against}</div>
        </div>`).join('')}`;
  }
}

// ── TICKER ────────────────────────────────────────
function updateTicker(fixtures) {
  const ticker = document.getElementById('ticker');
  if (!ticker||!fixtures.length) return;
  const items = fixtures.slice(0,10).map(f=>{
    const st = getStatusInfo(f.fixture.status.short, f.fixture.status.elapsed);
    const score = st.cls==='upcoming'?fmtTime(f.fixture.date):`${f.goals.home??0} - ${f.goals.away??0}`;
    return `<span class="ticker-item">${f.teams.home.name} — ${f.teams.away.name} <span class="ticker-score">${score}</span></span>`;
  });
  ticker.innerHTML = [...items,...items].join('');
}

// ── HELPERS ───────────────────────────────────────
function stateHTML(icon, fr, ar) {
  const isSpinner = icon==='spinner';
  return `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--muted)">
    ${isSpinner?'<div class="spinner" style="margin:0 auto 14px"></div>':`<div style="font-size:40px;margin-bottom:12px">${icon}</div>`}
    <div style="font-size:14px">${fr}</div>
    ${ar?`<div class="ar" style="font-size:12px;margin-top:4px">${ar}</div>`:''}
  </div>`;
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  fetchScores();
  fetchUpcoming();
  fetchAllStandings();
  setInterval(fetchScores, 60000);
  setInterval(fetchUpcoming, 300000);
});
