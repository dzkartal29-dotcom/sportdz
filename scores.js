// ============================================
// SportDZ — Football-Data.org (pas de CORS)
// ============================================

const TOKEN = '6e3a7a6e5e6e4e6e5e6e3a7a6e5e6e4e'; // token demo public
const BASE = 'https://api.football-data.org/v4';

// On utilise TheSportsDB qui est 100% gratuit et sans CORS
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/3';

const LEAGUES_SPORTSDB = [
  { id: '4335', name: 'Premier League',   flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', strLeague: 'English Premier League' },
  { id: '4480', name: 'La Liga',           flag: '🇪🇸', strLeague: 'Spanish La Liga' },
  { id: '4334', name: 'Bundesliga',        flag: '🇩🇪', strLeague: 'German Bundesliga' },
  { id: '4332', name: 'Serie A',           flag: '🇮🇹', strLeague: 'Italian Serie A' },
  { id: '4333', name: 'Ligue 1',           flag: '🇫🇷', strLeague: 'French Ligue 1' },
  { id: '4399', name: 'Champions League',  flag: '🏆', strLeague: 'UEFA Champions League' },
  { id: '4197', name: 'Ligue 1 Algérie',   flag: '🇩🇿', strLeague: 'Algerian Ligue Professionnelle 1' },
];

function fmtTime(d) {
  try { return new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Algiers'}); }
  catch(e){ return '--:--'; }
}
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short',timeZone:'Africa/Algiers'}); }
  catch(e){ return ''; }
}
function teamLogo(url, size=32) {
  if (!url) return `<div style="width:${size}px;height:${size}px;background:var(--card2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px">⚽</div>`;
  return `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:4px" onerror="this.outerHTML='<div style=\\'width:${size}px;height:${size}px;background:var(--card2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px\\'>⚽</div>'">`;
}
function stateHTML(icon, fr, ar) {
  const spin = icon==='spinner';
  return `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--muted)">
    ${spin?'<div class="spinner" style="margin:0 auto 14px;width:32px;height:32px;border-width:3px"></div>':`<div style="font-size:40px;margin-bottom:12px">${icon}</div>`}
    <div style="font-size:14px">${fr}</div>
    ${ar?`<div class="ar" style="font-size:12px;margin-top:4px;color:var(--muted)">${ar}</div>`:''}
  </div>`;
}

// ── SCORES DU JOUR via TheSportsDB ────────────────
async function fetchScores() {
  const el = document.getElementById('scores-container');
  if (!el) return;
  el.innerHTML = stateHTML('spinner','Chargement des scores en direct...','جاري تحميل النتائج...');

  try {
    // Date aujourd'hui format YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${SPORTSDB}/eventsday.php?d=${today}&s=Soccer`);
    const data = await res.json();
    const events = data.events || [];

    if (!events.length) {
      el.innerHTML = stateHTML('📅','Aucun match aujourd\'hui','لا توجد مباريات اليوم');
      return;
    }

    // Filtrer les grandes ligues
    const leagueNames = LEAGUES_SPORTSDB.map(l => l.strLeague.toLowerCase());
    const filtered = events.filter(e =>
      leagueNames.some(ln => e.strLeague?.toLowerCase().includes(ln.split(' ')[0].toLowerCase()))
    ).slice(0, 12);

    const shown = filtered.length > 0 ? filtered : events.slice(0, 9);

    el.innerHTML = shown.map(e => {
      const isLive = e.strStatus === 'Match Finished' ? false :
                     e.strStatus?.includes(':') ? false : true;
      const isFinished = e.strStatus === 'Match Finished' || e.intHomeScore !== null;
      const scoreHome = e.intHomeScore ?? '-';
      const scoreAway = e.intAwayScore ?? '-';
      const scoreOrTime = isFinished ? `${scoreHome} - ${scoreAway}` : fmtTime(e.strTimestamp || e.dateEvent + 'T' + (e.strTime||'20:00:00'));
      const statusCls = isFinished ? 'finished' : isLive ? 'live' : 'upcoming';
      const statusLabel = isFinished ? 'Terminé' : isLive ? '🔴 LIVE' : 'À venir';

      const lg = LEAGUES_SPORTSDB.find(l => e.strLeague?.toLowerCase().includes(l.strLeague.split(' ')[0].toLowerCase()));

      return `
        <div class="score-card animate-in">
          <div class="score-league">${lg?.flag||'⚽'} ${e.strLeague||'Football'}</div>
          <div class="score-match">
            <div class="team">
              <div class="team-logo">${teamLogo(e.strHomeTeamBadge)}</div>
              <div class="team-name">${e.strHomeTeam}</div>
            </div>
            <div class="score-center">
              <div class="score-num">${scoreOrTime}</div>
              <span class="score-time ${statusCls}">${statusLabel}</span>
              ${!isFinished && !isLive ? `<div class="match-date">${fmtDate(e.dateEvent)}</div>` : ''}
            </div>
            <div class="team">
              <div class="team-logo">${teamLogo(e.strAwayTeamBadge)}</div>
              <div class="team-name">${e.strAwayTeam}</div>
            </div>
          </div>
        </div>`;
    }).join('');

    updateTicker(shown);
  } catch(e) {
    console.error('Scores error:', e);
    el.innerHTML = stateHTML('⚠️','Erreur de chargement — réessai dans 30s','');
    setTimeout(fetchScores, 30000);
  }
}

// ── PROCHAINS MATCHS ──────────────────────────────
let upcomingData = {};

async function fetchUpcoming() {
  const el = document.getElementById('upcoming-container');
  const tabsEl = document.getElementById('upcoming-tabs');
  if (!el || !tabsEl) return;

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const res = await fetch(`${SPORTSDB}/eventsday.php?d=${dateStr}&s=Soccer`);
    const data = await res.json();
    const events = (data.events || []);

    upcomingData = {};
    events.forEach(e => {
      const lg = LEAGUES_SPORTSDB.find(l =>
        e.strLeague?.toLowerCase().includes(l.strLeague.split(' ')[0].toLowerCase())
      );
      const lid = lg ? lg.id : 'other';
      if (!upcomingData[lid]) upcomingData[lid] = [];
      upcomingData[lid].push(e);
    });

    const avail = LEAGUES_SPORTSDB.filter(l => upcomingData[l.id]?.length);

    // Ajouter "other" si des matchs existent
    if (upcomingData['other']?.length) {
      avail.push({ id: 'other', name: 'Autres', flag: '🌍' });
    }

    if (!avail.length) {
      tabsEl.innerHTML = '';
      el.innerHTML = stateHTML('📅','Aucun match demain','لا توجد مباريات غداً');
      return;
    }

    tabsEl.innerHTML = avail.map((l,i) => `
      <button class="league-tab ${i===0?'active':''}" onclick="switchUpcoming('${l.id}',this)">
        ${l.flag} ${l.name}
      </button>`).join('');

    renderUpcoming(avail[0].id);

    clearInterval(window._upInt);
    let idx = 0;
    window._upInt = setInterval(() => {
      idx = (idx+1) % avail.length;
      tabsEl.querySelectorAll('.league-tab').forEach(t => t.classList.remove('active'));
      tabsEl.querySelectorAll('.league-tab')[idx]?.classList.add('active');
      renderUpcoming(avail[idx].id);
    }, 8000);

  } catch(e) {
    el.innerHTML = stateHTML('⚠️','Erreur chargement','');
  }
}

window.switchUpcoming = function(lid, btn) {
  clearInterval(window._upInt);
  document.querySelectorAll('#upcoming-tabs .league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderUpcoming(lid);
};

function renderUpcoming(lid) {
  const el = document.getElementById('upcoming-container');
  const fixtures = (upcomingData[lid] || []).slice(0, 6);
  if (!fixtures.length) { el.innerHTML = stateHTML('📅','Aucun match',''); return; }
  el.innerHTML = `<div class="upcoming-list">${fixtures.map(e => `
    <div class="upcoming-item animate-in">
      <div class="upcoming-date">
        <div class="upd-day">${fmtDate(e.dateEvent)}</div>
        <div class="upd-time">⏰ ${fmtTime(e.dateEvent+'T'+(e.strTime||'20:00:00'))}</div>
      </div>
      <div class="upcoming-match">
        <div class="upm-team">${teamLogo(e.strHomeTeamBadge,26)}<span>${e.strHomeTeam}</span></div>
        <div class="upm-vs">VS</div>
        <div class="upm-team right"><span>${e.strAwayTeam}</span>${teamLogo(e.strAwayTeamBadge,26)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ── CLASSEMENTS ───────────────────────────────────
let standingsCache = {};

async function fetchAllStandings() {
  const tabsEl = document.getElementById('standings-tabs');
  if (!tabsEl) return;

  tabsEl.innerHTML = LEAGUES_SPORTSDB.map((l,i) => `
    <button class="league-tab ${i===0?'active':''}" onclick="switchStandings('${l.id}',this)">
      ${l.flag} ${l.name}
    </button>`).join('');

  await loadStandings(LEAGUES_SPORTSDB[0].id);

  clearInterval(window._stInt);
  let idx = 0;
  window._stInt = setInterval(async () => {
    idx = (idx+1) % LEAGUES_SPORTSDB.length;
    const tabs = tabsEl.querySelectorAll('.league-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[idx]?.classList.add('active');
    await loadStandings(LEAGUES_SPORTSDB[idx].id);
  }, 10000);
}

window.switchStandings = async function(lid, btn) {
  clearInterval(window._stInt);
  document.querySelectorAll('#standings-tabs .league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  await loadStandings(lid);
};

async function loadStandings(lid) {
  const tbody = document.getElementById('standings-body');
  if (!tbody) return;
  if (standingsCache[lid]) { renderStandings(standingsCache[lid]); return; }

  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted)">
    <div class="spinner" style="margin:0 auto;width:28px;height:28px;border-width:2px"></div>
  </td></tr>`;

  try {
    const res = await fetch(`${SPORTSDB}/lookuptable.php?l=${lid}&s=2024-2025`);
    const data = await res.json();
    const table = data.table || [];

    if (!table.length) {
      // Essaye saison 2024
      const res2 = await fetch(`${SPORTSDB}/lookuptable.php?l=${lid}&s=2024`);
      const data2 = await res2.json();
      if (!data2.table?.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted)">Données non disponibles</td></tr>`;
        return;
      }
      standingsCache[lid] = data2.table;
      renderStandings(data2.table);
      return;
    }

    standingsCache[lid] = table;
    renderStandings(table);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--red)">Erreur de chargement</td></tr>`;
  }
}

function renderStandings(table) {
  const tbody = document.getElementById('standings-body');
  const top3El = document.getElementById('top-scorers-container');
  if (!tbody) return;

  const total = table.length;
  tbody.innerHTML = table.slice(0, 10).map(t => {
    const rank = parseInt(t.intRank) || 0;
    const rankCls = rank <= 3 ? 'top' : rank >= total - 2 ? 'rel' : '';
    const played = t.intPlayed || 0;
    const won = t.intWin || 0;
    const draw = t.intDraw || 0;
    const loss = t.intLoss || 0;
    const gf = t.intGoalsFor || 0;
    const ga = t.intGoalsAgainst || 0;
    const pts = t.intPoints || 0;
    const form = (t.strForm || '').split('').slice(-5).map(f =>
      f==='W'?'<div class="fd fw"></div>':f==='D'?'<div class="fd fd2"></div>':'<div class="fd fl"></div>'
    ).join('');

    return `
      <tr class="animate-in ${rank<=3?'highlight':''}">
        <td class="rank ${rankCls}">${rank}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            ${teamLogo(t.strTeamBadge, 22)}
            <strong>${t.strTeam}</strong>
          </div>
        </td>
        <td>${played}</td>
        <td>${won}</td>
        <td>${draw}</td>
        <td>${loss}</td>
        <td>${gf}:${ga}</td>
        <td class="pts">${pts}</td>
        <td><div class="form-dots">${form}</div></td>
      </tr>`;
  }).join('');

  // Top 3
  if (top3El && table.length >= 3) {
    const topAtk = [...table].sort((a,b) => (b.intGoalsFor||0) - (a.intGoalsFor||0)).slice(0,3);
    const topDef = [...table].sort((a,b) => (a.intGoalsAgainst||0) - (b.intGoalsAgainst||0)).slice(0,3);

    top3El.innerHTML = `
      <div class="top3-title">⚽ Top 3 Meilleures Attaques</div>
      ${topAtk.map((t,i) => `
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${teamLogo(t.strTeamBadge, 28)}
          <div class="top3-info">
            <div class="top3-name">${t.strTeam}</div>
            <div class="top3-stat">${t.intGoalsFor||0} buts marqués</div>
          </div>
          <div class="top3-num">${t.intGoalsFor||0}</div>
        </div>`).join('')}
      <div class="top3-title" style="margin-top:14px">🛡️ Top 3 Meilleures Défenses</div>
      ${topDef.map((t,i) => `
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${teamLogo(t.strTeamBadge, 28)}
          <div class="top3-info">
            <div class="top3-name">${t.strTeam}</div>
            <div class="top3-stat">${t.intGoalsAgainst||0} buts encaissés</div>
          </div>
          <div class="top3-num">${t.intGoalsAgainst||0}</div>
        </div>`).join('')}`;
  }
}

// ── TICKER ────────────────────────────────────────
function updateTicker(events) {
  const ticker = document.getElementById('ticker');
  if (!ticker || !events.length) return;
  const items = events.slice(0,10).map(e => {
    const score = e.intHomeScore !== null ? `${e.intHomeScore} - ${e.intAwayScore}` : fmtTime(e.dateEvent+'T'+(e.strTime||'20:00'));
    return `<span class="ticker-item">${e.strHomeTeam} — ${e.strAwayTeam} <span class="ticker-score">${score}</span></span>`;
  });
  ticker.innerHTML = [...items,...items].join('');
}

// ── ARTICLES AUTO-GENERES ─────────────────────────
async function fetchArticles() {
  const el = document.getElementById('articles-container');
  if (!el) return;

  try {
    // Récupérer les derniers events pour générer des titres d'articles
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const res = await fetch(`${SPORTSDB}/eventsday.php?d=${dateStr}&s=Soccer`);
    const data = await res.json();
    const events = (data.events || []).filter(e => e.intHomeScore !== null).slice(0, 4);

    if (!events.length) return;

    const categories = ['Résultats','Analyse','Ligue 1 DZ','CAN 2025'];
    el.innerHTML = events.map((e, i) => {
      const score = `${e.intHomeScore} - ${e.intAwayScore}`;
      const winner = e.intHomeScore > e.intAwayScore ? e.strHomeTeam :
                     e.intAwayScore > e.intHomeScore ? e.strAwayTeam : 'Match nul';
      const title = e.intHomeScore === e.intAwayScore
        ? `Match nul entre ${e.strHomeTeam} et ${e.strAwayTeam} (${score})`
        : `${winner} s'impose face à ${e.intHomeScore > e.intAwayScore ? e.strAwayTeam : e.strHomeTeam} (${score})`;
      const titleAr = `نتيجة: ${e.strHomeTeam} ${score} ${e.strAwayTeam}`;

      return `
        <div class="article-card animate-in">
          <div class="article-img">
            <div class="article-cat">${categories[i % categories.length]}</div>
            <div style="font-size:48px">${['⚽','🏆','🎯','📊'][i%4]}</div>
          </div>
          <div class="article-body">
            <div class="article-title">${title}</div>
            <div class="article-title-ar ar">${titleAr}</div>
            <div class="article-meta">
              <span>⏱ Hier</span>
              <span>🏟️ ${e.strLeague}</span>
            </div>
          </div>
        </div>`;
    }).join('');

  } catch(e) {
    console.error('Articles error:', e);
  }
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
