// SportDZ — Coupe du Monde 2026
const PROXY = '/api/proxy';

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
function fmtDateFull(d) {
  try { return new Date(d).toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',timeZone:'Africa/Algiers'}); }
  catch(e){ return ''; }
}
function crest(url, size=32) {
  if (!url) return `<div style="width:${size}px;height:${size}px;background:var(--card2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.5)}px">⚽</div>`;
  return `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.outerHTML='<span style=font-size:16px>⚽</span>'">`;
}
function placeholder(msg, ar='') {
  return `<div class="placeholder"><div class="spinner"></div><div>${msg}</div>${ar?`<div class="ar" style="font-size:12px;margin-top:4px;color:var(--muted)">${ar}</div>`:''}</div>`;
}

// ── ALGERIA WIDGET ────────────────────────────────
async function updateAlgeriaWidget(allMatches) {
  const algMatch = allMatches.find(m =>
    m.homeTeam?.toLowerCase().includes('alger') ||
    m.awayTeam?.toLowerCase().includes('alger') ||
    m.homeShort?.toLowerCase().includes('alg') ||
    m.awayShort?.toLowerCase().includes('alg')
  );
  if (!algMatch) return;

  const isHome = algMatch.homeTeam?.toLowerCase().includes('alger') || algMatch.homeShort?.toLowerCase().includes('alg');
  const opp = isHome ? algMatch.awayTeam : algMatch.homeTeam;
  const oppFlag = isHome ? (algMatch.awayShort||'❓') : (algMatch.homeShort||'❓');

  document.getElementById('alg-opp').textContent = opp || '?';
  document.getElementById('alg-opp-flag').textContent = '🏳️';

  const isLive = algMatch.status === 'STATUS_IN_PROGRESS' || algMatch.status === 'STATUS_HALFTIME';
  const isFinished = algMatch.status === 'STATUS_FINAL';

  if (isFinished || isLive) {
    const gh = algMatch.homeScore ?? 0;
    const ga = algMatch.awayScore ?? 0;
    const score = isHome ? `${gh} - ${ga}` : `${ga} - ${gh}`;
    document.getElementById('alg-score').textContent = score;
    document.getElementById('alg-score').classList.add('glow');
    document.getElementById('alg-status').textContent = isLive ? `🔴 ${algMatch.clock||'LIVE'}` : 'Terminé';
    document.getElementById('alg-status').className = `alg-status ${isLive?'live-s':'fin'}`;
  } else {
    document.getElementById('alg-score').textContent = fmtTime(algMatch.date);
    document.getElementById('alg-status').textContent = 'À venir';
    document.getElementById('alg-date').textContent = fmtDate(algMatch.date);
  }
}

// ── SCORES PAR JOURNÉE ────────────────────────────
let scoresData = {};

async function fetchScores() {
  const el     = document.getElementById('scores-container');
  const tabsEl = document.getElementById('scores-tabs');
  if (!el) return;
  el.innerHTML = placeholder('Chargement des scores...','جاري تحميل النتائج...');

  try {
    const data = await api('scores');
    const all  = data.matches || [];

    // Mettre à jour widget Algérie
    updateAlgeriaWidget(all);

    // Grouper par DATE (journée)
    scoresData = {};
    all.forEach(m => {
      const dateKey = fmtDateFull(m.date);
      if (!scoresData[dateKey]) scoresData[dateKey] = [];
      scoresData[dateKey].push(m);
    });

    const days = Object.keys(scoresData);
    if (!days.length) {
      if (tabsEl) tabsEl.innerHTML = '';
      el.innerHTML = placeholder('Aucun match aujourd\'hui','لا توجد مباريات اليوم');
      return;
    }

    // Tab = chaque journée
    if (tabsEl) {
      tabsEl.innerHTML = days.map((day, i) => {
        const count = scoresData[day].length;
        return `<button class="tab ${i===0?'active':''}" onclick="switchScores('${day.replace(/'/g,"\\'")}',this)">
          📅 ${day} <span style="font-size:10px;opacity:.7">(${count})</span>
        </button>`;
      }).join('');
    }

    renderScores(days[0]);

    clearInterval(window._scInt);
    let idx = 0;
    window._scInt = setInterval(() => {
      idx = (idx+1) % days.length;
      if (tabsEl) {
        tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabsEl.querySelectorAll('.tab')[idx]?.classList.add('active');
      }
      renderScores(days[idx]);
    }, 8000);

    updateTicker(all);
  } catch(e) {
    console.error('Scores:', e);
    el.innerHTML = placeholder(`Erreur: ${e.message}`,'');
    setTimeout(fetchScores, 30000);
  }
}

window.switchScores = function(day, btn) {
  clearInterval(window._scInt);
  document.querySelectorAll('#scores-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderScores(day);
};

function renderScores(day) {
  const el = document.getElementById('scores-container');
  const matches = scoresData[day] || [];
  if (!matches.length) { el.innerHTML = placeholder('Aucun match',''); return; }

  const order = { STATUS_IN_PROGRESS:0, STATUS_HALFTIME:1, STATUS_SCHEDULED:2, STATUS_TIMED:2, STATUS_FINAL:3 };
  matches.sort((a,b) => (order[a.status]??2) - (order[b.status]??2));

  el.innerHTML = `<div class="scores-grid">${matches.map(m => {
    const isLive     = m.status==='STATUS_IN_PROGRESS'||m.status==='STATUS_HALFTIME';
    const isFinished = m.status==='STATUS_FINAL';
    const isUpcoming = !isLive&&!isFinished;
    const cls   = isLive?'live-s':isFinished?'fin':'soon';
    const label = isLive?`🔴 ${m.clock||'LIVE'}`:isFinished?'Terminé':'À venir';
    const score = isUpcoming ? fmtTime(m.date) : `${m.homeScore??0} - ${m.awayScore??0}`;

    return `
      <div class="score-card animate-in">
        <div class="card-league">${m.leagueFlag||'⚽'} ${m.league||'Football'}</div>
        <div class="match-row">
          <div class="team">
            <div class="team-logo">${crest(m.homeLogo)}</div>
            <div class="team-name">${m.homeShort||m.homeTeam}</div>
          </div>
          <div class="score-mid">
            <div class="score-num ${isLive?'glow':''}">${score}</div>
            <span class="status-pill ${cls}">${label}</span>
            ${isUpcoming?`<div class="match-date">${fmtDate(m.date)}</div>`:''}
          </div>
          <div class="team">
            <div class="team-logo">${crest(m.awayLogo)}</div>
            <div class="team-name">${m.awayShort||m.awayTeam}</div>
          </div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ── PROCHAINS MATCHS PAR GROUPE/COMPÉTITION ───────
let upcomingData = {};

async function fetchUpcoming() {
  const el     = document.getElementById('upcoming-container');
  const tabsEl = document.getElementById('upcoming-tabs');
  if (!el||!tabsEl) return;
  el.innerHTML = placeholder('Chargement...','');
  try {
    const data = await api('upcoming');
    const matches = data.matches || [];

    // Grouper par ligue/compétition
    upcomingData = {};
    matches.forEach(m => {
      const k = m.league||'Autres';
      if (!upcomingData[k]) upcomingData[k] = [];
      upcomingData[k].push(m);
    });

    // Supprimer ligues vides
    Object.keys(upcomingData).forEach(k => {
      if (!upcomingData[k].length) delete upcomingData[k];
    });

    const leagues = Object.keys(upcomingData);
    if (!leagues.length) {
      tabsEl.innerHTML = '';
      el.innerHTML = placeholder('Aucun match à venir dans les 7 prochains jours','لا توجد مباريات قادمة');
      return;
    }

    tabsEl.innerHTML = leagues.map((lg, i) => {
      const flag = upcomingData[lg][0]?.leagueFlag||'⚽';
      const count = upcomingData[lg].length;
      return `<button class="tab ${i===0?'active':''}" onclick="switchUpcoming('${lg.replace(/'/g,"\\'")}',this)">
        ${flag} ${lg} <span style="font-size:10px;opacity:.7">(${count})</span>
      </button>`;
    }).join('');

    renderUpcoming(leagues[0]);

    clearInterval(window._upInt);
    let idx = 0;
    window._upInt = setInterval(() => {
      idx = (idx+1) % leagues.length;
      tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tabsEl.querySelectorAll('.tab')[idx]?.classList.add('active');
      renderUpcoming(leagues[idx]);
    }, 8000);
  } catch(e) {
    el.innerHTML = placeholder('Erreur chargement','');
  }
}

window.switchUpcoming = function(league, btn) {
  clearInterval(window._upInt);
  document.querySelectorAll('#upcoming-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderUpcoming(league);
};

function renderUpcoming(league) {
  const el = document.getElementById('upcoming-container');
  const fixtures = (upcomingData[league]||[]).slice(0, 8);
  if (!fixtures.length) { el.innerHTML = placeholder('Aucun match',''); return; }

  el.innerHTML = `<div class="upcoming-list">${fixtures.map(m => `
    <div class="upcoming-item animate-in">
      <div class="up-date">
        <div class="up-day">${fmtDate(m.date)}</div>
        <div class="up-time">${fmtTime(m.date)}</div>
      </div>
      <div class="up-match">
        <div class="up-team">${crest(m.homeLogo,26)}<span>${m.homeShort||m.homeTeam||'?'}</span></div>
        <div class="up-vs">VS</div>
        <div class="up-team r"><span>${m.awayShort||m.awayTeam||'?'}</span>${crest(m.awayLogo,26)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ── CLASSEMENTS ───────────────────────────────────
const LEAGUES_FD = [
  { code:'PL',  name:'Premier League',  flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code:'PD',  name:'La Liga',          flag:'🇪🇸' },
  { code:'BL1', name:'Bundesliga',       flag:'🇩🇪' },
  { code:'SA',  name:'Serie A',          flag:'🇮🇹' },
  { code:'FL1', name:'Ligue 1',          flag:'🇫🇷' },
  { code:'PPL', name:'Primeira Liga',    flag:'🇵🇹' },
];
let standingsCache = {};

async function fetchAllStandings() {
  const tabsEl = document.getElementById('standings-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = LEAGUES_FD.map((l,i) => `
    <button class="tab ${i===0?'active':''}" onclick="switchStandings('${l.code}',this)">
      ${l.flag} ${l.name}
    </button>`).join('');
  await loadStandings(LEAGUES_FD[0].code);
  clearInterval(window._stInt);
  let idx = 0;
  window._stInt = setInterval(async () => {
    idx = (idx+1) % LEAGUES_FD.length;
    const tabs = tabsEl.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[idx]?.classList.add('active');
    await loadStandings(LEAGUES_FD[idx].code);
  }, 10000);
}

window.switchStandings = async function(code, btn) {
  clearInterval(window._stInt);
  document.querySelectorAll('#standings-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  await loadStandings(code);
};

async function loadStandings(code) {
  const tbody = document.getElementById('standings-body');
  if (!tbody) return;
  if (standingsCache[code]) { renderStandings(standingsCache[code]); return; }
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:28px">
    <div class="spinner" style="margin:0 auto;width:28px;height:28px;border-width:2px"></div>
  </td></tr>`;
  try {
    const data = await api('standings', `&code=${code}`);
    const table = data.standings?.find(s => s.type==='TOTAL')?.table || [];
    if (!table.length) throw new Error('Saison terminée');
    standingsCache[code] = table;
    renderStandings(table);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted);font-size:13px">
      📅 ${e.message}
    </td></tr>`;
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
      <tr class="animate-in ${t.position<=3?'hl':''}">
        <td class="s-rank ${rankCls}">${t.position}</td>
        <td><div style="display:flex;align-items:center;gap:8px">${crest(t.team?.crest,22)}<strong>${t.team?.shortName||t.team?.name}</strong></div></td>
        <td>${t.playedGames}</td><td>${t.won}</td><td>${t.draw}</td><td>${t.lost}</td>
        <td>${t.goalsFor}:${t.goalsAgainst}</td>
        <td class="s-pts">${t.points}</td>
        <td><div class="form-row">${form}</div></td>
      </tr>`;
  }).join('');

  if (top3El && table.length >= 3) {
    const topAtk = [...table].sort((a,b) => b.goalsFor-a.goalsFor).slice(0,3);
    const topDef = [...table].sort((a,b) => a.goalsAgainst-b.goalsAgainst).slice(0,3);
    top3El.innerHTML = `
      <div class="top3-label">⚽ Meilleures Attaques</div>
      ${topAtk.map((t,i) => `
        <div class="top3-item animate-in">
          <div class="top3-rnk">${['🥇','🥈','🥉'][i]}</div>
          ${crest(t.team?.crest,28)}
          <div class="top3-info"><div class="top3-name">${t.team?.shortName||t.team?.name}</div><div class="top3-stat">${t.goalsFor} buts</div></div>
          <div class="top3-num">${t.goalsFor}</div>
        </div>`).join('')}
      <div class="top3-label" style="margin-top:14px">🛡️ Meilleures Défenses</div>
      ${topDef.map((t,i) => `
        <div class="top3-item animate-in">
          <div class="top3-rnk">${['🥇','🥈','🥉'][i]}</div>
          ${crest(t.team?.crest,28)}
          <div class="top3-info"><div class="top3-name">${t.team?.shortName||t.team?.name}</div><div class="top3-stat">${t.goalsAgainst} enc.</div></div>
          <div class="top3-num">${t.goalsAgainst}</div>
        </div>`).join('')}`;
  }
}

// ── ARTICLES BENTO ────────────────────────────────
async function fetchArticles() {
  const el = document.getElementById('articles-container');
  if (!el) return;
  try {
    const data = await api('articles');
    const matches = data.matches || [];

    if (!matches.length) { el.innerHTML = fallbackArticles(); return; }

    const cats  = ['Résultats','Analyse','Coupe du Monde','International','Fennecs'];
    const icons = ['⚽','🏆','🌍','🎯','🇩🇿'];
    const sizes = ['big','med','sml','sml','sml'];

    el.innerHTML = matches.slice(0,5).map((m, i) => {
      const gh = m.homeScore??0, ga = m.awayScore??0;
      const score = `${gh} - ${ga}`;
      const winner = gh>ga?m.homeTeam:ga>gh?m.awayTeam:null;
      const title = winner
        ? `${winner} s'impose (${score}) contre ${gh>ga?m.awayTeam:m.homeTeam}`
        : `Match nul (${score}) — ${m.homeTeam} vs ${m.awayTeam}`;
      const titleAr = winner
        ? `${winner} يفوز (${score}) على ${gh>ga?m.awayTeam:m.homeTeam}`
        : `تعادل (${score}) بين ${m.homeTeam} و ${m.awayTeam}`;
      const analysis = winner
        ? `${winner} a dominé cette rencontre de ${m.league||'la compétition'} avec un score final de ${score}. Une performance solide qui confirme la forme du moment.`
        : `Les deux équipes se sont neutralisées dans ce match de ${m.league||'la compétition'}. Un résultat qui arrange les deux formations dans la course à la qualification.`;

      return `
        <div class="bento-card ${sizes[i]||'sml'} animate-in">
          <div class="bento-img">
            <div class="bento-cat">${cats[i%cats.length]}</div>
            <div style="font-size:${i===0?'64px':'48px'}">${icons[i%icons.length]}</div>
            <div class="bento-img-overlay"></div>
          </div>
          <div class="bento-body">
            <div class="bento-title">${title}</div>
            <div class="bento-title-ar ar">${titleAr}</div>
            ${i===0?`<div class="bento-excerpt">${analysis}</div>`:''}
            <div class="bento-meta">
              <span>⏱ Hier</span>
              <span>${m.leagueFlag||'⚽'} ${m.league||'Football'}</span>
            </div>
          </div>
        </div>`;
    }).join('');

  } catch(e) {
    el.innerHTML = fallbackArticles();
  }
}

function fallbackArticles() {
  const arts = [
    { size:'big', cat:'Coupe du Monde 2026', icon:'🏆', title:'Coupe du Monde 2026 : tout ce qu\'il faut savoir', titleAr:'كأس العالم 2026: كل ما تحتاج معرفته', excerpt:'La Coupe du Monde 2026 bat son plein aux États-Unis, au Canada et au Mexique. 32 nations s\'affrontent pour décrocher le titre suprême du football mondial. Suivez tous les résultats et classements en temps réel sur SportDZ.' },
    { size:'med', cat:'Fennecs 🇩🇿', icon:'🇩🇿', title:'Les Fennecs à la Coupe du Monde 2026', titleAr:'الخضر في كأس العالم 2026' },
    { size:'sml', cat:'Analyse', icon:'📊', title:'Les stats incroyables de cette Coupe du Monde', titleAr:'إحصاءات مذهلة من كأس العالم' },
    { size:'sml', cat:'International', icon:'🌍', title:'Tous les résultats de la Coupe du Monde', titleAr:'جميع نتائج كأس العالم' },
    { size:'sml', cat:'Scores', icon:'🎯', title:'Scores et classements mis à jour en direct', titleAr:'النتائج والترتيب محدثة مباشرة' },
  ];
  return arts.map(a => `
    <div class="bento-card ${a.size} animate-in">
      <div class="bento-img">
        <div class="bento-cat">${a.cat}</div>
        <div style="font-size:${a.size==='big'?'64':'48'}px">${a.icon}</div>
        <div class="bento-img-overlay"></div>
      </div>
      <div class="bento-body">
        <div class="bento-title">${a.title}</div>
        <div class="bento-title-ar ar">${a.titleAr}</div>
        ${a.excerpt?`<div class="bento-excerpt">${a.excerpt}</div>`:''}
        <div class="bento-meta"><span>⏱ Aujourd'hui</span><span>🌍 CdM 2026</span></div>
      </div>
    </div>`).join('');
}

// ── TICKER ────────────────────────────────────────
function updateTicker(matches) {
  const ticker = document.getElementById('ticker');
  if (!ticker||!matches.length) return;
  const items = matches.slice(0,12).map(m => {
    const score = (m.homeScore!==null&&m.homeScore!==undefined)
      ? `${m.homeScore} - ${m.awayScore}` : fmtTime(m.date);
    return `<span class="ticker-item">${m.leagueFlag||'⚽'} ${m.homeShort||m.homeTeam} — ${m.awayShort||m.awayTeam} <span class="t-score">${score}</span></span>`;
  });
  ticker.innerHTML = [...items,...items].join('');
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchScores();
  fetchUpcoming();
  fetchAllStandings();
  fetchArticles();
  setInterval(fetchScores,   60000);
  setInterval(fetchUpcoming, 300000);
});
