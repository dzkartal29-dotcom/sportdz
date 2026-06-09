// SportDZ — scores via ESPN + standings via football-data
const PROXY = '/.netlify/functions/api';

const LEAGUES_FD = [
  { code:'PL',  name:'Premier League',  flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code:'PD',  name:'La Liga',          flag:'🇪🇸' },
  { code:'BL1', name:'Bundesliga',       flag:'🇩🇪' },
  { code:'SA',  name:'Serie A',          flag:'🇮🇹' },
  { code:'FL1', name:'Ligue 1',          flag:'🇫🇷' },
  { code:'PPL', name:'Primeira Liga',    flag:'🇵🇹' },
];

async function api(action, extra='') {
  const res = await fetch(`${PROXY}?action=${action}${extra}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fmtTime(d) {
  try { return new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Algiers'}); }
  catch(e){ return '--:--'; }
}
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short',timeZone:'Africa/Algiers'}); }
  catch(e){ return ''; }
}
function crest(url, size=32) {
  if (!url) return `<div style="width:${size}px;height:${size}px;background:var(--card2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size*.5}px">⚽</div>`;
  return `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.outerHTML='<span style=font-size:18px>⚽</span>'">`;
}
function stateHTML(icon, fr, ar) {
  const spin = icon==='spinner';
  return `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--muted)">
    ${spin?'<div class="spinner" style="margin:0 auto 14px;width:32px;height:32px;border-width:3px"></div>':`<div style="font-size:40px;margin-bottom:12px">${icon}</div>`}
    <div style="font-size:14px">${fr}</div>
    ${ar?`<div class="ar" style="font-size:12px;margin-top:4px">${ar}</div>`:''}
  </div>`;
}

// ── SCORES ESPN ───────────────────────────────────
async function fetchScores() {
  const el = document.getElementById('scores-container');
  if (!el) return;
  el.innerHTML = stateHTML('spinner','Chargement des scores...','جاري تحميل النتائج...');
  try {
    const data = await api('scores');
    const matches = data.matches || [];

    if (!matches.length) {
      el.innerHTML = stateHTML('📅','Aucun match aujourd\'hui','لا توجد مباريات اليوم');
      return;
    }

    // Trier live → à venir → terminés
    const order = { STATUS_IN_PROGRESS:0, STATUS_HALFTIME:1, STATUS_SCHEDULED:2, STATUS_FINAL:3 };
    matches.sort((a,b) => (order[a.status]??2) - (order[b.status]??2));

    el.innerHTML = matches.map(m => {
      const isLive     = m.status === 'STATUS_IN_PROGRESS' || m.status === 'STATUS_HALFTIME';
      const isFinished = m.status === 'STATUS_FINAL' || m.status === 'STATUS_FULL_TIME';
      const isUpcoming = !isLive && !isFinished;
      const cls = isLive ? 'live' : isFinished ? 'finished' : 'upcoming';
      const label = isLive ? `🔴 ${m.clock||'LIVE'}` : isFinished ? 'Terminé' : 'À venir';
      const scoreOrTime = isUpcoming ? fmtTime(m.date) : `${m.homeScore??0} - ${m.awayScore??0}`;

      return `
        <div class="score-card animate-in">
          <div class="score-league">${m.leagueFlag||'⚽'} ${m.league||'Football'}</div>
          <div class="score-match">
            <div class="team">
              <div class="team-logo">${crest(m.homeLogo)}</div>
              <div class="team-name">${m.homeShort||m.homeTeam}</div>
            </div>
            <div class="score-center">
              <div class="score-num">${scoreOrTime}</div>
              <span class="score-time ${cls}">${label}</span>
              ${isUpcoming?`<div class="match-date">${fmtDate(m.date)}</div>`:''}
            </div>
            <div class="team">
              <div class="team-logo">${crest(m.awayLogo)}</div>
              <div class="team-name">${m.awayShort||m.awayTeam}</div>
            </div>
          </div>
        </div>`;
    }).join('');

    updateTicker(matches);
  } catch(e) {
    el.innerHTML = stateHTML('⚠️',`Erreur: ${e.message}`,'');
    setTimeout(fetchScores, 30000);
  }
}

// ── PROCHAINS MATCHS ──────────────────────────────
let upcomingData = {};
async function fetchUpcoming() {
  const el = document.getElementById('upcoming-container');
  const tabsEl = document.getElementById('upcoming-tabs');
  if (!el||!tabsEl) return;
  try {
    const data = await api('upcoming');
    const matches = data.matches || [];
    upcomingData = {};
    matches.forEach(m => {
      const cid = m.competition?.code;
      if (!upcomingData[cid]) upcomingData[cid] = [];
      upcomingData[cid].push(m);
    });
    const avail = LEAGUES_FD.filter(l => upcomingData[l.code]?.length);
    if (!avail.length) {
      tabsEl.innerHTML = '';
      el.innerHTML = stateHTML('📅','Aucun match à venir','لا توجد مباريات');
      return;
    }
    tabsEl.innerHTML = avail.map((l,i) => `
      <button class="league-tab ${i===0?'active':''}" onclick="switchUpcoming('${l.code}',this)">
        ${l.flag} ${l.name}
      </button>`).join('');
    renderUpcoming(avail[0].code);
    clearInterval(window._upInt);
    let idx = 0;
    window._upInt = setInterval(() => {
      idx = (idx+1) % avail.length;
      tabsEl.querySelectorAll('.league-tab').forEach(t => t.classList.remove('active'));
      tabsEl.querySelectorAll('.league-tab')[idx]?.classList.add('active');
      renderUpcoming(avail[idx].code);
    }, 8000);
  } catch(e) { el.innerHTML = stateHTML('⚠️','Erreur chargement',''); }
}
window.switchUpcoming = function(code, btn) {
  clearInterval(window._upInt);
  document.querySelectorAll('#upcoming-tabs .league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderUpcoming(code);
};
function renderUpcoming(code) {
  const el = document.getElementById('upcoming-container');
  const fixtures = (upcomingData[code]||[]).slice(0,6);
  if (!fixtures.length) { el.innerHTML = stateHTML('📅','Aucun match',''); return; }
  el.innerHTML = `<div class="upcoming-list">${fixtures.map(m => `
    <div class="upcoming-item animate-in">
      <div class="upcoming-date">
        <div class="upd-day">${fmtDate(m.utcDate)}</div>
        <div class="upd-time">⏰ ${fmtTime(m.utcDate)}</div>
      </div>
      <div class="upcoming-match">
        <div class="upm-team">${crest(m.homeTeam?.crest,26)}<span>${m.homeTeam?.shortName||m.homeTeam?.name}</span></div>
        <div class="upm-vs">VS</div>
        <div class="upm-team right"><span>${m.awayTeam?.shortName||m.awayTeam?.name}</span>${crest(m.awayTeam?.crest,26)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ── CLASSEMENTS ───────────────────────────────────
let standingsCache = {};
async function fetchAllStandings() {
  const tabsEl = document.getElementById('standings-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = LEAGUES_FD.map((l,i) => `
    <button class="league-tab ${i===0?'active':''}" onclick="switchStandings('${l.code}',this)">
      ${l.flag} ${l.name}
    </button>`).join('');
  await loadStandings(LEAGUES_FD[0].code);
  clearInterval(window._stInt);
  let idx = 0;
  window._stInt = setInterval(async () => {
    idx = (idx+1) % LEAGUES_FD.length;
    const tabs = tabsEl.querySelectorAll('.league-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[idx]?.classList.add('active');
    await loadStandings(LEAGUES_FD[idx].code);
  }, 10000);
}
window.switchStandings = async function(code, btn) {
  clearInterval(window._stInt);
  document.querySelectorAll('#standings-tabs .league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  await loadStandings(code);
};
async function loadStandings(code) {
  const tbody = document.getElementById('standings-body');
  if (!tbody) return;
  if (standingsCache[code]) { renderStandings(standingsCache[code]); return; }
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto;width:28px;height:28px;border-width:2px"></div></td></tr>`;
  try {
    const data = await api('standings', `&code=${code}`);
    const table = data.standings?.find(s => s.type==='TOTAL')?.table || [];
    if (!table.length) throw new Error('Données indisponibles');
    standingsCache[code] = table;
    renderStandings(table);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--red)">${e.message}</td></tr>`;
  }
}
function renderStandings(table) {
  const tbody = document.getElementById('standings-body');
  const top3El = document.getElementById('top-scorers-container');
  if (!tbody) return;
  const total = table.length;
  tbody.innerHTML = table.slice(0,10).map(t => {
    const rankCls = t.position<=3?'top':t.position>=total-2?'rel':'';
    const form = (t.form||'').split(',').slice(-5).map(f =>
      f==='W'?'<div class="fd fw"></div>':f==='D'?'<div class="fd fd2"></div>':'<div class="fd fl"></div>'
    ).join('');
    return `
      <tr class="animate-in ${t.position<=3?'highlight':''}">
        <td class="rank ${rankCls}">${t.position}</td>
        <td><div style="display:flex;align-items:center;gap:8px">${crest(t.team?.crest,22)}<strong>${t.team?.shortName||t.team?.name}</strong></div></td>
        <td>${t.playedGames}</td><td>${t.won}</td><td>${t.draw}</td><td>${t.lost}</td>
        <td>${t.goalsFor}:${t.goalsAgainst}</td>
        <td class="pts">${t.points}</td>
        <td><div class="form-dots">${form}</div></td>
      </tr>`;
  }).join('');
  if (top3El && table.length >= 3) {
    const topAtk = [...table].sort((a,b) => b.goalsFor-a.goalsFor).slice(0,3);
    const topDef = [...table].sort((a,b) => a.goalsAgainst-b.goalsAgainst).slice(0,3);
    top3El.innerHTML = `
      <div class="top3-title">⚽ Top 3 Meilleures Attaques</div>
      ${topAtk.map((t,i) => `
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${crest(t.team?.crest,28)}
          <div class="top3-info"><div class="top3-name">${t.team?.shortName||t.team?.name}</div><div class="top3-stat">${t.goalsFor} buts</div></div>
          <div class="top3-num">${t.goalsFor}</div>
        </div>`).join('')}
      <div class="top3-title" style="margin-top:14px">🛡️ Top 3 Meilleures Défenses</div>
      ${topDef.map((t,i) => `
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${crest(t.team?.crest,28)}
          <div class="top3-info"><div class="top3-name">${t.team?.shortName||t.team?.name}</div><div class="top3-stat">${t.goalsAgainst} encaissés</div></div>
          <div class="top3-num">${t.goalsAgainst}</div>
        </div>`).join('')}`;
  }
}

// ── ARTICLES ──────────────────────────────────────
async function fetchArticles() {
  const el = document.getElementById('articles-container');
  if (!el) return;
  try {
    const data = await api('articles');
    const matches = (data.matches||[]).slice(0,4);
    if (!matches.length) return;
    const cats = ['Résultats','Analyse','Ligue 1','Champions'];
    const icons = ['⚽','🏆','🎯','📊'];
    el.innerHTML = matches.map((m,i) => {
      const gh = m.score?.fullTime?.home ?? 0;
      const ga = m.score?.fullTime?.away ?? 0;
      const score = `${gh} - ${ga}`;
      const winner = gh>ga ? m.homeTeam?.name : ga>gh ? m.awayTeam?.name : null;
      const title = winner
        ? `${winner} s'impose (${score}) contre ${gh>ga?m.awayTeam?.name:m.homeTeam?.name}`
        : `Match nul (${score}) — ${m.homeTeam?.name} vs ${m.awayTeam?.name}`;
      return `
        <div class="article-card animate-in">
          <div class="article-img">
            <div class="article-cat">${cats[i%cats.length]}</div>
            <div style="font-size:48px">${icons[i%icons.length]}</div>
          </div>
          <div class="article-body">
            <div class="article-title">${title}</div>
            <div class="article-title-ar ar">${m.homeTeam?.name} ${score} ${m.awayTeam?.name}</div>
            <div class="article-meta"><span>⏱ Hier</span><span>🏟️ ${m.competition?.name}</span></div>
          </div>
        </div>`;
    }).join('');
  } catch(e) { console.error('Articles:',e); }
}

// ── TICKER ────────────────────────────────────────
function updateTicker(matches) {
  const ticker = document.getElementById('ticker');
  if (!ticker||!matches.length) return;
  const items = matches.slice(0,10).map(m => {
    const score = (m.homeScore!==null&&m.homeScore!==undefined) ? `${m.homeScore} - ${m.awayScore}` : fmtTime(m.date);
    return `<span class="ticker-item">${m.homeShort||m.homeTeam} — ${m.awayShort||m.awayTeam} <span class="ticker-score">${score}</span></span>`;
  });
  ticker.innerHTML = [...items,...items].join('');
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchScores();
  fetchUpcoming();
  fetchAllStandings();
  fetchArticles();
  setInterval(fetchScores, 60000);
  setInterval(fetchUpcoming, 300000);
});
