// ============================================
// SportDZ — API-Football Complete Integration
// ============================================

const API_KEY = '5130309ed2mshe40285506e8c3f9p1259d1jsn9a47c28618f2';
const API_HOST = 'api-football-v1.p.rapidapi.com';
const SEASON = 2024;

const LEAGUES = [
  { id: 197, name: 'Ligue 1 Algérie',   flag: '🇩🇿', country: 'Algérie' },
  { id: 39,  name: 'Premier League',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'Angleterre' },
  { id: 140, name: 'La Liga',            flag: '🇪🇸', country: 'Espagne' },
  { id: 61,  name: 'Ligue 1',            flag: '🇫🇷', country: 'France' },
  { id: 135, name: 'Serie A',            flag: '🇮🇹', country: 'Italie' },
  { id: 78,  name: 'Bundesliga',         flag: '🇩🇪', country: 'Allemagne' },
  { id: 2,   name: 'Champions League',   flag: '🏆', country: 'UEFA' },
  { id: 12,  name: 'CAF Champions',      flag: '🌍', country: 'Afrique' },
];

function apiHeaders() {
  return { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST };
}

function getStatusInfo(short, elapsed) {
  if (['1H','2H','ET','BT','P','LIVE'].includes(short))
    return { label: `🔴 ${elapsed || ''}\'`, cls: 'live' };
  if (['HT'].includes(short))
    return { label: '⏸ Mi-temps', cls: 'live' };
  if (['FT','AET','PEN'].includes(short))
    return { label: 'Terminé', cls: 'finished' };
  return { label: 'À venir', cls: 'upcoming' };
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' });
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Africa/Algiers' });
}

// ── SCORES EN DIRECT ──────────────────────────────
async function fetchScores() {
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('scores-container');
  if (!el) return;
  el.innerHTML = loadingHTML('Chargement des scores...', 'جاري تحميل النتائج...');

  try {
    const res = await fetch(`https://${API_HOST}/v3/fixtures?date=${today}&timezone=Africa/Algiers`, { headers: apiHeaders() });
    const data = await res.json();
    const leagueIds = LEAGUES.map(l => l.id);
    const fixtures = (data.response || []).filter(f => leagueIds.includes(f.league.id));

    if (!fixtures.length) {
      el.innerHTML = emptyHTML('Aucun match aujourd\'hui', 'لا توجد مباريات اليوم', '📅');
      return;
    }

    fixtures.sort((a, b) => {
      const order = { live: 0, upcoming: 1, finished: 2 };
      return (order[getStatusInfo(a.fixture.status.short).cls] ?? 3)
           - (order[getStatusInfo(b.fixture.status.short).cls] ?? 3);
    });

    el.innerHTML = fixtures.map(f => {
      const st = getStatusInfo(f.fixture.status.short, f.fixture.status.elapsed);
      const lg = LEAGUES.find(l => l.id === f.league.id);
      const gh = f.goals.home ?? 0, ga = f.goals.away ?? 0;
      const scoreOrTime = st.cls === 'upcoming' ? formatTime(f.fixture.date) : `${gh} - ${ga}`;
      return `
        <div class="score-card animate-in">
          <div class="score-league">${lg?.flag || ''} ${lg?.name || f.league.name}</div>
          <div class="score-match">
            <div class="team">
              <div class="team-logo"><img src="${f.teams.home.logo}" onerror="this.src='https://via.placeholder.com/32/1C1C1C/888?text=?'"></div>
              <div class="team-name">${f.teams.home.name}</div>
            </div>
            <div class="score-center">
              <div class="score-num">${scoreOrTime}</div>
              <span class="score-time ${st.cls}">${st.label}</span>
              ${st.cls === 'upcoming' ? `<div class="match-date">${formatDate(f.fixture.date)}</div>` : ''}
            </div>
            <div class="team">
              <div class="team-logo"><img src="${f.teams.away.logo}" onerror="this.src='https://via.placeholder.com/32/1C1C1C/888?text=?'"></div>
              <div class="team-name">${f.teams.away.name}</div>
            </div>
          </div>
        </div>`;
    }).join('');

    // Update ticker
    updateTicker(fixtures);
  } catch(e) {
    el.innerHTML = errorHTML();
  }
}

// ── PROCHAINS MATCHS ──────────────────────────────
let upcomingLeagueIndex = 0;
let upcomingData = {};

async function fetchUpcoming() {
  const el = document.getElementById('upcoming-container');
  const tabsEl = document.getElementById('upcoming-tabs');
  if (!el) return;
  el.innerHTML = loadingHTML('Chargement des prochains matchs...', 'جاري التحميل...');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next7 = new Date();
  next7.setDate(next7.getDate() + 7);
  const from = tomorrow.toISOString().split('T')[0];
  const to = next7.toISOString().split('T')[0];

  try {
    const res = await fetch(`https://${API_HOST}/v3/fixtures?from=${from}&to=${to}&timezone=Africa/Algiers`, { headers: apiHeaders() });
    const data = await res.json();
    const leagueIds = LEAGUES.map(l => l.id);
    const fixtures = (data.response || []).filter(f => leagueIds.includes(f.league.id));

    // Group by league
    upcomingData = {};
    fixtures.forEach(f => {
      const lid = f.league.id;
      if (!upcomingData[lid]) upcomingData[lid] = [];
      upcomingData[lid].push(f);
    });

    // Build tabs
    const availLeagues = LEAGUES.filter(l => upcomingData[l.id]?.length);
    if (!availLeagues.length) {
      el.innerHTML = emptyHTML('Aucun match à venir', 'لا توجد مباريات قادمة', '📅');
      return;
    }

    tabsEl.innerHTML = availLeagues.map((l, i) => `
      <button class="league-tab ${i === 0 ? 'active' : ''}" onclick="switchUpcomingLeague(${l.id}, this)">
        ${l.flag} ${l.name}
      </button>`).join('');

    renderUpcoming(availLeagues[0].id);

    // Auto-rotate every 8 seconds
    clearInterval(window.upcomingInterval);
    let tabIdx = 0;
    window.upcomingInterval = setInterval(() => {
      tabIdx = (tabIdx + 1) % availLeagues.length;
      const tabs = tabsEl.querySelectorAll('.league-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tabs[tabIdx]?.classList.add('active');
      renderUpcoming(availLeagues[tabIdx].id);
    }, 8000);

  } catch(e) {
    el.innerHTML = errorHTML();
  }
}

function switchUpcomingLeague(lid, btn) {
  clearInterval(window.upcomingInterval);
  document.querySelectorAll('.league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderUpcoming(lid);
}

function renderUpcoming(lid) {
  const el = document.getElementById('upcoming-container');
  const fixtures = (upcomingData[lid] || []).slice(0, 6);
  if (!fixtures.length) { el.innerHTML = emptyHTML('Aucun match', '', '📅'); return; }

  el.innerHTML = `<div class="upcoming-list">${fixtures.map(f => `
    <div class="upcoming-item animate-in">
      <div class="upcoming-date">
        <div class="upd-day">${formatDate(f.fixture.date)}</div>
        <div class="upd-time">⏰ ${formatTime(f.fixture.date)}</div>
      </div>
      <div class="upcoming-match">
        <div class="upm-team">
          <img src="${f.teams.home.logo}" onerror="this.src='https://via.placeholder.com/28/1C1C1C/888?text=?'">
          <span>${f.teams.home.name}</span>
        </div>
        <div class="upm-vs">VS</div>
        <div class="upm-team right">
          <span>${f.teams.away.name}</span>
          <img src="${f.teams.away.logo}" onerror="this.src='https://via.placeholder.com/28/1C1C1C/888?text=?'">
        </div>
      </div>
    </div>`).join('')}</div>`;
}

// ── CLASSEMENTS ───────────────────────────────────
let standingsLeagueIndex = 0;
let standingsData = {};

async function fetchAllStandings() {
  const tabsEl = document.getElementById('standings-tabs');
  const el = document.getElementById('standings-body');
  if (!tabsEl || !el) return;

  tabsEl.innerHTML = LEAGUES.map((l, i) => `
    <button class="league-tab ${i === 0 ? 'active' : ''}" onclick="switchStandingsLeague(${l.id}, this)">
      ${l.flag} ${l.name}
    </button>`).join('');

  // Load first league
  await loadStandings(LEAGUES[0].id);

  // Auto-rotate every 10 seconds
  clearInterval(window.standingsInterval);
  let idx = 0;
  window.standingsInterval = setInterval(async () => {
    idx = (idx + 1) % LEAGUES.length;
    const tabs = tabsEl.querySelectorAll('.league-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[idx]?.classList.add('active');
    await loadStandings(LEAGUES[idx].id);
  }, 10000);
}

async function switchStandingsLeague(lid, btn) {
  clearInterval(window.standingsInterval);
  document.querySelectorAll('#standings-tabs .league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  await loadStandings(lid);
}

async function loadStandings(lid) {
  const el = document.getElementById('standings-body');
  if (!el) return;

  if (standingsData[lid]) {
    renderStandings(standingsData[lid], lid);
    return;
  }

  el.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted)">Chargement...</td></tr>`;

  try {
    const res = await fetch(`https://${API_HOST}/v3/standings?league=${lid}&season=${SEASON}`, { headers: apiHeaders() });
    const data = await res.json();
    const st = data.response?.[0]?.league?.standings?.[0];
    if (!st) {
      el.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted)">Données non disponibles</td></tr>`;
      return;
    }
    standingsData[lid] = st;
    renderStandings(st, lid);
  } catch(e) {
    el.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--red)">Erreur de chargement</td></tr>`;
  }
}

function renderStandings(standings, lid) {
  const el = document.getElementById('standings-body');
  const topScorers = document.getElementById('top-scorers-container');
  if (!el) return;

  const total = standings.length;
  el.innerHTML = standings.slice(0, 10).map(t => {
    const form = (t.form || '').split('').slice(-5).map(f =>
      f === 'W' ? '<div class="fd fw"></div>' : f === 'D' ? '<div class="fd fd2"></div>' : '<div class="fd fl"></div>'
    ).join('');
    const rankCls = t.rank <= 3 ? 'top' : t.rank >= total - 2 ? 'rel' : '';
    return `
      <tr class="animate-in ${t.rank <= 3 ? 'highlight' : ''}">
        <td class="rank ${rankCls}">${t.rank}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <img src="${t.team.logo}" style="width:22px;height:22px;object-fit:contain" onerror="this.style.display='none'">
            <strong>${t.team.name}</strong>
          </div>
        </td>
        <td>${t.all.played}</td>
        <td>${t.all.win}</td>
        <td>${t.all.draw}</td>
        <td>${t.all.lose}</td>
        <td>${t.all.goals.for}:${t.all.goals.against}</td>
        <td class="pts">${t.points}</td>
        <td><div class="form-dots">${form}</div></td>
      </tr>`;
  }).join('');

  // Top 3 scorers in standings (by goals for)
  if (topScorers) {
    const top3 = standings.slice(0, 3);
    topScorers.innerHTML = `
      <div class="top3-title">⚽ Top 3 — Meilleure attaque</div>
      ${top3.map((t, i) => `
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          <img src="${t.team.logo}" onerror="this.style.display='none'">
          <div class="top3-info">
            <div class="top3-name">${t.team.name}</div>
            <div class="top3-stat">${t.all.goals.for} buts marqués</div>
          </div>
          <div class="top3-num">${t.all.goals.for}</div>
        </div>`).join('')}
      <div class="top3-title" style="margin-top:16px">🛡️ Top 3 — Meilleure défense</div>
      ${[...standings].sort((a,b) => a.all.goals.against - b.all.goals.against).slice(0,3).map((t, i) => `
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          <img src="${t.team.logo}" onerror="this.style.display='none'">
          <div class="top3-info">
            <div class="top3-name">${t.team.name}</div>
            <div class="top3-stat">${t.all.goals.against} buts encaissés</div>
          </div>
          <div class="top3-num">${t.all.goals.against}</div>
        </div>`).join('')}
    `;
  }
}

// ── TICKER ────────────────────────────────────────
function updateTicker(fixtures) {
  const ticker = document.getElementById('ticker');
  if (!ticker || !fixtures.length) return;
  const items = fixtures.slice(0, 10).map(f => {
    const st = getStatusInfo(f.fixture.status.short, f.fixture.status.elapsed);
    const score = st.cls === 'upcoming' ? formatTime(f.fixture.date) : `${f.goals.home ?? 0} - ${f.goals.away ?? 0}`;
    return `<span class="ticker-item">${f.teams.home.name} — ${f.teams.away.name} <span class="ticker-score">${score}</span></span>`;
  });
  ticker.innerHTML = [...items, ...items].join('');
}

// ── HELPERS ───────────────────────────────────────
function loadingHTML(fr, ar) {
  return `<div class="placeholder-state"><div class="spinner"></div><div>${fr}</div><div class="ar" style="font-size:12px;color:var(--muted)">${ar}</div></div>`;
}
function emptyHTML(fr, ar, icon) {
  return `<div class="placeholder-state"><div style="font-size:40px">${icon}</div><div>${fr}</div><div class="ar" style="font-size:12px;color:var(--muted)">${ar}</div></div>`;
}
function errorHTML() {
  return `<div class="placeholder-state"><div style="font-size:40px">⚠️</div><div style="color:var(--red)">Erreur — réessai dans 60s</div></div>`;
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchScores();
  fetchUpcoming();
  fetchAllStandings();
  setInterval(fetchScores, 60000);
  setInterval(fetchUpcoming, 300000);
});
