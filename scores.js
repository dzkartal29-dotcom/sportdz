// SportDZ — Front-end synchronisé 100% avec le Proxy ESPN
const PROXY = '/.netlify/functions/api';

// Liste des ligues adaptées aux slugs d'ESPN
const LEAGUES_ESPN = [
  { code: 'fifa.world',       name: 'Coupe du Monde',   flag: '🏆' },
  { code: 'eng.1',            name: 'Premier League',   flag: '🏴' },
  { code: 'esp.1',            name: 'La Liga',          flag: '🇪🇸' },
  { code: 'ger.1',            name: 'Bundesliga',       flag: '🇩🇪' },
  { code: 'ita.1',            name: 'Serie A',          flag: '🇮🇹' },
  { code: 'fra.1',            name: 'Ligue 1',          flag: '🇫🇷' },
  { code: 'uefa.champions',   name: 'Champions League', flag: '⭐' }
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
  if (!url) return `<div style="width:${size}px;height:${size}px;background:var(--card2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.5)}px">⚽</div>`;
  return `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.outerHTML='<span style=font-size:18px>⚽</span>'">`;
}
function stateHTML(icon, fr, ar) {
  const spin = icon==='spinner';
  return `<div style="grid-column:1/-1;text-align:center;padding:40px 24px;color:var(--muted)">
    ${spin?'<div class="spinner" style="margin:0 auto 14px;width:32px;height:32px;border-width:3px"></div>':`<div style="font-size:36px;margin-bottom:10px">${icon}</div>`}
    <div style="font-size:13px">${fr}</div>
    ${ar?`<div class="ar" style="font-size:12px;margin-top:4px">${ar}</div>`:''}
  </div>`;
}

// ── 1. SCORES DU JOUR ──────────────────────────────────────────────
let scoresData = {};

async function fetchScores() {
  const el = document.getElementById('scores-container');
  const tabsEl = document.getElementById('scores-tabs');
  if (!el) return;
  el.innerHTML = stateHTML('spinner','Chargement des scores...','جاري تحميل النتائج...');

  try {
    // Par défaut, on charge les scores de la ligue active ou de la première disponible
    const activeTab = tabsEl?.querySelector('.league-tab.active')?.getAttribute('data-code') || LEAGUES_ESPN[0].code;
    const data = await api('scores', `&code=${activeTab}`);
    
    const events = data.events || [];
    scoresData = { [activeTab]: [] };

    events.forEach(e => {
      const comp = e.competitions?.[0];
      if (!comp) return;
      const home = comp.competitors?.find(t => t.homeAway === 'home');
      const away = comp.competitors?.find(t => t.homeAway === 'away');
      
      scoresData[activeTab].push({
        id: e.id,
        status: comp.status?.type?.name,
        state: comp.status?.type?.state, // 'pre', 'in' ou 'post'
        clock: comp.status?.displayClock,
        date: e.date,
        homeTeam: home?.team?.displayName || '?',
        homeShort: home?.team?.shortDisplayName || home?.team?.displayName || '?',
        homeLogo: home?.team?.logo,
        awayTeam: away?.team?.displayName || '?',
        awayShort: away?.team?.shortDisplayName || away?.team?.displayName || '?',
        awayLogo: away?.team?.logo,
        homeScore: home?.score,
        awayScore: away?.score
      });
    });

    // Générer les onglets de sélection si vides
    if (tabsEl && !tabsEl.children.length) {
      tabsEl.innerHTML = LEAGUES_ESPN.map((lg, i) => `
        <button class="league-tab ${i===0?'active':''}" data-code="${lg.code}" onclick="switchScores('${lg.code}',this)">
          ${lg.flag} ${lg.name}
        </button>`).join('');
    }

    renderScores(activeTab);
  } catch(e) {
    console.error('Scores Error:', e);
    el.innerHTML = stateHTML('⚠️',`Erreur: ${e.message}`,'');
  }
}

window.switchScores = function(code, btn) {
  document.querySelectorAll('#scores-tabs .league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  fetchScores(); // On recharge avec la bonne ligue
};

function renderScores(leagueCode) {
  const el = document.getElementById('scores-container');
  const matches = scoresData[leagueCode] || [];
  const lgInfo = LEAGUES_ESPN.find(l => l.code === leagueCode);

  if (!matches.length) { 
    el.innerHTML = stateHTML('📅','Aucun match en cours ou terminé aujourd\'hui pour ce championnat',''); 
    return; 
  }

  el.innerHTML = `<div class="grid-3">${matches.map(m => {
    const isLive = m.state === 'in';
    const isFinished = m.state === 'post';
    const cls = isLive ? 'live' : isFinished ? 'finished' : 'upcoming';
    const label = isLive ? `🔴 ${m.clock||'LIVE'}` : isFinished ? 'Terminé' : 'À venir';
    const scoreOrTime = !isLive && !isFinished ? fmtTime(m.date) : `${m.homeScore??0} - ${m.awayScore??0}`;

    return `
      <div class="score-card animate-in">
        <div class="score-league">${lgInfo?.flag||'⚽'} ${lgInfo?.name}</div>
        <div class="score-match">
          <div class="team">
            <div class="team-logo">${crest(m.homeLogo)}</div>
            <div class="team-name">${m.homeShort}</div>
          </div>
          <div class="score-center">
            <div class="score-num">${scoreOrTime}</div>
            <span class="score-time ${cls}">${label}</span>
            ${m.state === 'pre' ? `<div class="match-date">${fmtDate(m.date)}</div>` : ''}
          </div>
          <div class="team">
            <div class="team-logo">${crest(m.awayLogo)}</div>
            <div class="team-name">${m.awayShort}</div>
          </div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ── 2. PROCHAINS MATCHS (UPCOMING) ─────────────────────────────────
let upcomingData = {};

async function fetchUpcoming() {
  const el = document.getElementById('upcoming-container');
  const tabsEl = document.getElementById('upcoming-tabs');
  if (!el || !tabsEl) return;

  try {
    const activeTab = tabsEl.querySelector('.league-tab.active')?.getAttribute('data-code') || LEAGUES_ESPN[0].code;
    const data = await api('upcoming', `&code=${activeTab}`);
    const events = data.events || [];

    upcomingData[activeTab] = events.filter(e => e.competitions?.[0]?.status?.type?.state === 'pre').map(e => {
      const comp = e.competitions[0];
      return {
        date: e.date,
        homeTeam: comp.competitors.find(t => t.homeAway === 'home'),
        awayTeam: comp.competitors.find(t => t.homeAway === 'away')
      };
    });

    if (!tabsEl.children.length) {
      tabsEl.innerHTML = LEAGUES_ESPN.map((l,i) => `
        <button class="league-tab ${i===0?'active':''}" data-code="${l.code}" onclick="switchUpcoming('${l.code}',this)">
          ${l.flag} ${l.name}
        </button>`).join('');
    }

    renderUpcoming(activeTab);
  } catch(e) {
    el.innerHTML = stateHTML('⚠️','Erreur de chargement des matchs à venir','');
  }
}

window.switchUpcoming = function(code, btn) {
  document.querySelectorAll('#upcoming-tabs .league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  fetchUpcoming();
};

function renderUpcoming(code) {
  const el = document.getElementById('upcoming-container');
  const fixtures = upcomingData[code] || [];
  if (!fixtures.length) { el.innerHTML = stateHTML('📅','Aucun match à venir programmé pour cette sélection','لا توجد مباريات قادمة'); return; }

  el.innerHTML = `<div class="upcoming-list">${fixtures.slice(0, 6).map(m => `
    <div class="upcoming-item animate-in">
      <div class="upcoming-date">
        <div class="upd-day">${fmtDate(m.date)}</div>
        <div class="upd-time">⏰ ${fmtTime(m.date)}</div>
      </div>
      <div class="upcoming-match">
        <div class="upm-team">${crest(m.homeTeam?.team?.logo,26)}<span>${m.homeTeam?.team?.shortDisplayName || m.homeTeam?.team?.displayName}</span></div>
        <div class="upm-vs">VS</div>
        <div class="upm-team right"><span>${m.awayTeam?.team?.shortDisplayName || m.awayTeam?.team?.displayName}</span>${crest(m.awayTeam?.team?.logo,26)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ── 3. CLASSEMENTS (STANDINGS) ─────────────────────────────────────
let standingsCache = {};

async function fetchAllStandings() {
  const tabsEl = document.getElementById('standings-tabs');
  if (!tabsEl) return;
  
  if (!tabsEl.children.length) {
    tabsEl.innerHTML = LEAGUES_ESPN.filter(l => l.code !== 'uefa.champions' && l.code !== 'fifa.world').map((l,i) => `
      <button class="league-tab ${i===0?'active':''}" data-code="${l.code}" onclick="switchStandings('${l.code}',this)">
        ${l.flag} ${l.name}
      </button>`).join('');
  }
  
  const firstLeague = LEAGUES_ESPN.find(l => l.code !== 'uefa.champions' && l.code !== 'fifa.world').code;
  await loadStandings(firstLeague);
}

window.switchStandings = async function(code, btn) {
  document.querySelectorAll('#standings-tabs .league-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  await loadStandings(code);
};

async function loadStandings(code) {
  const tbody = document.getElementById('standings-body');
  if (!tbody) return;
  if (standingsCache[code]) { renderStandings(standingsCache[code]); return; }

  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px">
    <div class="spinner" style="margin:0 auto;width:28px;height:28px;border-width:2px"></div>
  </td></tr>`;

  try {
    const data = await api('standings', `&code=${code}`);
    const entries = data.children?.[0]?.standings?.entries || data.standings?.entries || [];
    
    if (!entries.length) throw new Error('Données indisponibles pour cette ligue');

    // On formate l'objet pour qu'il s'adapte à l'ancien template de rendu
    const formattedTable = entries.map(e => {
      const stats = e.stats || [];
      return {
        position: e.stats?.find(s => s.name === 'rank')?.value || stats[0]?.value || 1,
        team: { name: e.team?.displayName, shortName: e.team?.shortDisplayName, crest: e.team?.logos?.[0]?.href },
        playedGames: e.stats?.find(s => s.name === 'gamesPlayed')?.value || 0,
        won: e.stats?.find(s => s.name === 'wins')?.value || 0,
        draw: e.stats?.find(s => s.name === 'ties')?.value || 0,
        lost: e.stats?.find(s => s.name === 'losses')?.value || 0,
        goalsFor: e.stats?.find(s => s.name === 'pointsFor')?.value || 0,
        goalsAgainst: e.stats?.find(s => s.name === 'pointsAgainst')?.value || 0,
        points: e.stats?.find(s => s.name === 'points')?.value || 0,
        form: e.stats?.find(s => s.name === 'summary')?.summary || ''
      };
    });

    standingsCache[code] = formattedTable;
    renderStandings(formattedTable);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--red)">${e.message}</td></tr>`;
  }
}

function renderStandings(table) {
  const tbody = document.getElementById('standings-body');
  const top3El = document.getElementById('top-scorers-container');
  if (!tbody) return;
  const total = table.length;

  tbody.innerHTML = table.slice(0, 10).map(t => {
    const rankCls = t.position <= 3 ? 'top' : t.position >= total - 2 ? 'rel' : '';
    const formDots = t.form.split('').map(f => 
      f === 'W' ? '<div class="fd fw"></div>' : f === 'D' ? '<div class="fd fd2"></div>' : '<div class="fd fl"></div>'
    ).join('');

    return `
      <tr class="animate-in ${t.position<=3?'highlight':''}">
        <td class="rank ${rankCls}">${t.position}</td>
        <td><div style="display:flex;align-items:center;gap:8px">${crest(t.team?.crest,22)}<strong>${t.team?.shortName || t.team?.name}</strong></div></td>
        <td>${t.playedGames}</td><td>${t.won}</td><td>${t.draw}</td><td>${t.lost}</td>
        <td>${t.goalsFor}:${t.goalsAgainst}</td>
        <td class="pts">${t.points}</td>
        <td><div class="form-dots">${formDots}</div></td>
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
          <div class="top3-info"><div class="top3-name">${t.team?.shortName}</div><div class="top3-stat">${t.goalsFor} buts</div></div>
          <div class="top3-num">${t.goalsFor}</div>
        </div>`).join('')}
      <div class="top3-title" style="margin-top:14px">🛡️ Top 3 Meilleures Défenses</div>
      ${topDef.map((t,i) => `
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${crest(t.team?.crest,28)}
          <div class="top3-info"><div class="top3-name">${t.team?.shortName}</div><div class="top3-stat">${t.goalsAgainst} buts</div></div>
          <div class="top3-num">${t.goalsAgainst}</div>
        </div>`).join('')}`;
  }
}

// ── 4. ARTICLES (NEWS VIA PROXY) ───────────────────────────────────
async function fetchArticles() {
  const el = document.getElementById('articles-container');
  if (!el) return;
  try {
    const data = await api('articles');
    const news = data.articles || [];
    if (!news.length) return;

    el.innerHTML = news.slice(0, 4).map((art, i) => `
      <div class="article-card animate-in">
        <div class="article-img">
          <div class="article-cat">Actu</div>
          <div style="font-size:42px">📰</div>
        </div>
        <div class="article-body">
          <div class="article-title">${art.title}</div>
          <div class="article-desc" style="font-size:12px; color:var(--muted); margin: 4px 0;">${art.summary || ''}</div>
          <div class="article-meta"><span>⏱ ${fmtDate(art.date)}</span><span>🏟️ SportDZ Live</span></div>
        </div>
      </div>`);
  } catch(e) { console.error('Articles Error:', e); }
}

// ── 5. TICKER ──────────────────────────────────────────────────────
function updateTicker(matches) {
  const ticker = document.getElementById('ticker');
  if (!ticker || !matches.length) return;
  const items = matches.slice(0,10).map(m => {
    const score = (m.homeScore!==null && m.homeScore!==undefined) ? `${m.homeScore} - ${m.awayScore}` : fmtTime(m.date);
    return `<span class="ticker-item">${m.homeShort} — ${m.awayShort} <span class="ticker-score">${score}</span></span>`;
  });
  ticker.innerHTML = [...items,...items].join('');
}

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchScores();
  fetchUpcoming();
  fetchAllStandings();
  fetchArticles();
  
  // Refresh automatique régulier
  setInterval(fetchScores, 45000);
  setInterval(fetchUpcoming, 180000);
});
