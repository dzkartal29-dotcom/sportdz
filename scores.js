cat > /mnt/user-data/outputs/sportdz/scores.js << 'JSEOF'
// SportDZ — Coupe du Monde 2026 (données réelles openfootball)
const PROXY = '/api/proxy';

const LEAGUES_FD = [
  {code:'PL', name:'Premier League', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
  {code:'PD', name:'La Liga',         flag:'🇪🇸'},
  {code:'BL1',name:'Bundesliga',      flag:'🇩🇪'},
  {code:'SA', name:'Serie A',         flag:'🇮🇹'},
  {code:'FL1',name:'Ligue 1',         flag:'🇫🇷'},
  {code:'PPL',name:'Primeira Liga',   flag:'🇵🇹'},
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
function ph(msg, ar='') {
  return `<div class="loading-state" style="grid-column:1/-1"><div class="spinner"></div><div>${msg}</div>${ar?`<div class="ar" style="font-size:11px;margin-top:3px;color:var(--text3)">${ar}</div>`:''}</div>`;
}

// ── ALGERIA WIDGET ────────────────────────────────
function updateAlgWidget(matches) {
  const alg = matches.find(m =>
    /alger/i.test(m.homeTeam) || /alger/i.test(m.awayTeam)
  );
  if (!alg) return;

  const isHome = /alger/i.test(alg.homeTeam);
  const opp = isHome ? alg.awayTeam : alg.homeTeam;
  const oppFlag = isHome ? alg.awayFlag : alg.homeFlag;

  document.getElementById('alg-opp-name').textContent = opp || '?';
  document.getElementById('alg-opp-flag').textContent = oppFlag || '🏳️';

  const isLive = alg.status === 'STATUS_IN_PROGRESS' || alg.status === 'STATUS_HALFTIME';
  const isFin  = alg.status === 'STATUS_FINAL';

  if (isFin || isLive) {
    const gh = alg.homeScore ?? 0, ga = alg.awayScore ?? 0;
    const sc = isHome ? `${gh} - ${ga}` : `${ga} - ${gh}`;
    const scoreEl = document.getElementById('alg-score');
    scoreEl.textContent = sc;
    scoreEl.classList.add('glow');
    const badge = document.getElementById('alg-badge');
    badge.textContent = isLive ? '🔴 EN DIRECT' : 'Terminé';
    badge.className = `alg-badge ${isLive ? 'badge-live' : 'badge-fin'}`;
  } else {
    document.getElementById('alg-score').textContent = fmtTime(alg.date);
    document.getElementById('alg-date').textContent = `📅 ${fmtDate(alg.date)}`;
    document.getElementById('alg-venue').textContent = alg.venue ? `📍 ${alg.venue}` : '';
  }
}

// ── SCORES DU JOUR ────────────────────────────────
let scoresData = {};

async function fetchScores() {
  const el = document.getElementById('scores-container');
  const tabs = document.getElementById('scores-tabs');
  if (!el) return;
  el.innerHTML = ph('Chargement des scores CdM 2026...', 'جاري تحميل النتائج...');

  try {
    const data = await api('scores');
    const all = data.matches || [];

    // Mettre à jour widget Algérie
    if (all.length) updateAlgWidget(all);

    // Grouper par groupe
    scoresData = {};
    all.forEach(m => {
      const k = m.group || m.league || 'CdM 2026';
      if (!scoresData[k]) scoresData[k] = [];
      scoresData[k].push(m);
    });

    const keys = Object.keys(scoresData);

    if (!keys.length) {
      if (tabs) tabs.innerHTML = '';
      el.innerHTML = ph('Aucun match aujourd\'hui', 'لا توجد مباريات اليوم');
      // Afficher quand même le widget Algérie depuis upcoming
      fetchUpcomingForWidget();
      return;
    }

    if (tabs) {
      tabs.innerHTML = keys.map((k, i) => {
        const cnt = scoresData[k].length;
        return `<button class="tab-btn ${i===0?'active':''}" onclick="switchScores('${k.replace(/'/g,"\\'")}',this)">${k} <span style="font-size:9px;opacity:.6">(${cnt})</span></button>`;
      }).join('');
    }

    renderScores(keys[0]);

    clearInterval(window._scInt);
    let idx = 0;
    window._scInt = setInterval(() => {
      idx = (idx+1) % keys.length;
      if (tabs) { tabs.querySelectorAll('.tab-btn').forEach(t=>t.classList.remove('active')); tabs.querySelectorAll('.tab-btn')[idx]?.classList.add('active'); }
      renderScores(keys[idx]);
    }, 7000);

    updateTicker(all);
  } catch(e) {
    console.error('Scores:', e);
    el.innerHTML = ph(`Erreur: ${e.message}`, '');
    setTimeout(fetchScores, 30000);
  }
}

async function fetchUpcomingForWidget() {
  try {
    const data = await api('upcoming');
    const ms = data.matches || [];
    if (ms.length) updateAlgWidget(ms);
  } catch(e) {}
}

window.switchScores = function(key, btn) {
  clearInterval(window._scInt);
  document.querySelectorAll('#scores-tabs .tab-btn').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderScores(key);
};

function renderScores(key) {
  const el = document.getElementById('scores-container');
  const ms = scoresData[key] || [];
  if (!ms.length) { el.innerHTML = ph('Aucun match', ''); return; }

  const order = {STATUS_IN_PROGRESS:0, STATUS_HALFTIME:1, STATUS_SCHEDULED:2, STATUS_FINAL:3};
  ms.sort((a,b) => (order[a.status]??2)-(order[b.status]??2));

  el.innerHTML = `<div class="matches-grid">${ms.map(m => {
    const isLive = m.status==='STATUS_IN_PROGRESS'||m.status==='STATUS_HALFTIME';
    const isFin  = m.status==='STATUS_FINAL';
    const isUp   = !isLive && !isFin;
    const cls    = isLive?'s-live':isFin?'s-fin':'s-soon';
    const label  = isLive?`🔴 EN DIRECT`:isFin?'Terminé':'À venir';
    const score  = isUp ? fmtTime(m.date) : `${m.homeScore??0} - ${m.awayScore??0}`;

    return `<div class="match-card animate-in">
      <div class="card-comp">🏆 ${m.league||m.group||'Coupe du Monde 2026'}</div>
      <div class="card-body">
        <div class="card-team">
          <div class="card-flag">${m.homeFlag||'🏳️'}</div>
          <div class="card-name">${m.homeShort||m.homeTeam}</div>
        </div>
        <div class="card-mid">
          <div class="card-score ${isLive?'live-glow':''}">${score}</div>
          <span class="card-status ${cls}">${label}</span>
          ${isUp?`<div class="card-time">📅 ${fmtDate(m.date)}</div>`:''}
          ${m.venue?`<div class="card-time">📍 ${m.venue}</div>`:''}
        </div>
        <div class="card-team">
          <div class="card-flag">${m.awayFlag||'🏳️'}</div>
          <div class="card-name">${m.awayShort||m.awayTeam}</div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ── PROCHAINS MATCHS ──────────────────────────────
let upcomingData = {};

async function fetchUpcoming() {
  const el = document.getElementById('upcoming-container');
  const tabs = document.getElementById('upcoming-tabs');
  if (!el||!tabs) return;
  el.innerHTML = ph('Chargement...', '');

  try {
    const data = await api('upcoming');
    const ms = data.matches || [];

    // Grouper: Fennecs en premier, puis par groupe
    upcomingData = {};
    const algMs = ms.filter(m => /alger/i.test(m.homeTeam)||/alger/i.test(m.awayTeam));
    const othMs = ms.filter(m => !/alger/i.test(m.homeTeam)&&!/alger/i.test(m.awayTeam));

    if (algMs.length) upcomingData['🇩🇿 Fennecs'] = algMs;
    othMs.forEach(m => {
      const k = m.group || 'CdM 2026';
      if (!upcomingData[k]) upcomingData[k] = [];
      upcomingData[k].push(m);
    });

    const keys = Object.keys(upcomingData);
    if (!keys.length) {
      tabs.innerHTML = '';
      el.innerHTML = ph('Aucun match à venir dans 7 jours', 'لا توجد مباريات قادمة');
      return;
    }

    tabs.innerHTML = keys.map((k, i) => {
      const cnt = upcomingData[k].length;
      return `<button class="tab-btn ${i===0?'active':''}" onclick="switchUpcoming('${k.replace(/'/g,"\\'")}',this)">${k} <span style="font-size:9px;opacity:.6">(${cnt})</span></button>`;
    }).join('');

    renderUpcoming(keys[0]);
    clearInterval(window._upInt);
    let idx = 0;
    window._upInt = setInterval(() => {
      idx = (idx+1) % keys.length;
      tabs.querySelectorAll('.tab-btn').forEach(t=>t.classList.remove('active'));
      tabs.querySelectorAll('.tab-btn')[idx]?.classList.add('active');
      renderUpcoming(keys[idx]);
    }, 8000);

    // Update widget si pas de matchs aujourd'hui
    if (algMs.length) updateAlgWidget(algMs);
  } catch(e) {
    el.innerHTML = ph('Erreur chargement', '');
  }
}

window.switchUpcoming = function(key, btn) {
  clearInterval(window._upInt);
  document.querySelectorAll('#upcoming-tabs .tab-btn').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderUpcoming(key);
};

function renderUpcoming(key) {
  const el = document.getElementById('upcoming-container');
  const ms = (upcomingData[key]||[]).slice(0, 8);
  if (!ms.length) { el.innerHTML = ph('Aucun match', ''); return; }

  el.innerHTML = `<div class="upcoming-list">${ms.map(m => `
    <div class="upcoming-card animate-in">
      <div class="uc-date">
        <div class="uc-day">${fmtDate(m.date)}</div>
        <div class="uc-time">${fmtTime(m.date)}</div>
        ${m.venue?`<div class="uc-venue">📍 ${m.venue}</div>`:''}
      </div>
      <div class="uc-match">
        <div class="uc-team">
          <div class="uc-flag">${m.homeFlag||'🏳️'}</div>
          <div class="uc-name">${m.homeShort||m.homeTeam||'?'}</div>
        </div>
        <div class="uc-vs">VS</div>
        <div class="uc-team right">
          <div class="uc-name">${m.awayShort||m.awayTeam||'?'}</div>
          <div class="uc-flag">${m.awayFlag||'🏳️'}</div>
        </div>
      </div>
      <div class="uc-comp">${m.round||m.group||'CdM 2026'}</div>
    </div>`).join('')}</div>`;
}

// ── GROUPES CdM 2026 ──────────────────────────────
async function fetchGroups() {
  const el = document.getElementById('groups-container');
  if (!el) return;
  try {
    const data = await api('groups');
    const groups = data.groups || [];
    el.innerHTML = groups.map(g => `
      <div class="group-card animate-in">
        <div class="group-header">
          <div class="group-name">${g.name}</div>
          <div class="group-sub">${g.teams.length} équipes · Top 2 qualifiés</div>
        </div>
        <table class="group-table">
          <thead>
            <tr><th>#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th><th>Buts</th><th>Pts</th></tr>
          </thead>
          <tbody>
            ${g.teams.map((t, i) => `
              <tr class="${i<2?'qualify':''}">
                <td class="g-rank ${i<2?'q':i>=g.teams.length-0?'e':''}">${i+1}</td>
                <td>
                  <div class="g-team-cell">
                    <span class="g-flag">${t.flag}</span>
                    <strong class="g-name">${t.name}</strong>
                  </div>
                </td>
                <td>${t.played}</td>
                <td>${t.won}</td>
                <td>${t.draw}</td>
                <td>${t.lost}</td>
                <td>${t.gf}:${t.ga}</td>
                <td class="g-pts">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = ph('Erreur chargement groupes', '');
  }
}

// ── ARTICLES BENTO ────────────────────────────────
async function fetchArticles() {
  const el = document.getElementById('articles-container');
  if (!el) return;
  try {
    const data = await api('articles');
    const ms = data.matches || [];

    if (!ms.length) { el.innerHTML = fallbackArticles(); return; }

    const cats  = ['Résultats','Analyse','CdM 2026','International','Fennecs'];
    const icons = ['⚽','🏆','🌍','🎯','🇩🇿'];
    const sizes = ['span-7','span-5','span-4','span-4','span-4'];

    el.innerHTML = ms.slice(0,5).map((m, i) => {
      const gh = m.homeScore??0, ga = m.awayScore??0;
      const score = `${gh} - ${ga}`;
      const winner = gh>ga ? m.homeTeam : ga>gh ? m.awayTeam : null;
      const title = winner
        ? `${m.homeFlag||''} ${m.homeTeam} ${score} ${m.awayTeam} ${m.awayFlag||''} — ${winner} s'impose`
        : `${m.homeFlag||''} ${m.homeTeam} ${score} ${m.awayTeam} ${m.awayFlag||''} — Match nul`;
      const titleAr = winner
        ? `${winner} يفوز بنتيجة ${score}`
        : `تعادل ${score} بين الفريقين`;
      const body = winner
        ? `${winner} a remporté ce match de ${m.league||'la Coupe du Monde'} avec un score de ${score}. Une victoire importante dans la course à la qualification.`
        : `Les deux équipes se sont séparées sur un score nul (${score}) dans ce match comptant pour ${m.league||'la Coupe du Monde 2026'}.`;

      return `<div class="bento-card ${sizes[i]||'span-4'} animate-in">
        <div class="bento-img">
          <div class="bento-category">${cats[i%cats.length]}</div>
          <div style="font-size:${i===0?'64':'48'}px">${icons[i%icons.length]}</div>
          <div class="bento-teams">${m.homeFlag||'⚽'} <span style="font-size:12px;font-weight:700;color:var(--gold)">${score}</span> ${m.awayFlag||'⚽'}</div>
          <div class="bento-img-overlay"></div>
        </div>
        <div class="bento-body">
          <div class="bento-title">${title}</div>
          <div class="bento-title-ar ar">${titleAr}</div>
          ${i===0?`<div class="bento-excerpt">${body}</div>`:''}
          <div class="bento-meta">
            <span>⏱ Hier</span>
            <span>🏆 ${m.league||'CdM 2026'}</span>
            ${m.venue?`<span>📍 ${m.venue}</span>`:''}
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
    {sz:'span-7', cat:'Coupe du Monde 2026', ic:'🏆', t:'Coupe du Monde 2026 : 32 nations, 104 matchs, 1 champion', ar:'كأس العالم 2026: 32 منتخبًا و104 مباراة وبطل واحد', body:'La Coupe du Monde 2026 se déroule aux États-Unis, au Canada et au Mexique. Pour la première fois dans l\'histoire, la compétition accueille 48 équipes réparties en 12 groupes. Suivez tous les scores et résultats en temps réel sur SportDZ.'},
    {sz:'span-5', cat:'🇩🇿 Fennecs', ic:'🇩🇿', t:'Algérie dans le Groupe J : Argentine, Jordanie, Autriche', ar:'الجزائر في المجموعة J مع الأرجنتين والأردن والنمسا', body:''},
    {sz:'span-4', cat:'Groupe J', ic:'🌍', t:'Algérie 🇩🇿 vs Argentine 🇦🇷 — 16 juin 2026', ar:'الجزائر ضد الأرجنتين 16 يونيو', body:''},
    {sz:'span-4', cat:'Fennecs', ic:'⚽', t:'Algérie 🇩🇿 vs Jordanie 🇯🇴 — 22 juin 2026', ar:'الجزائر ضد الأردن 22 يونيو', body:''},
    {sz:'span-4', cat:'CdM 2026', ic:'🎯', t:'Algérie 🇩🇿 vs Autriche 🇦🇹 — 27 juin 2026', ar:'الجزائر ضد النمسا 27 يونيو', body:''},
  ];
  return arts.map((a, i) => `
    <div class="bento-card ${a.sz} animate-in">
      <div class="bento-img">
        <div class="bento-category">${a.cat}</div>
        <div style="font-size:${i===0?'64':'48'}px">${a.ic}</div>
        <div class="bento-img-overlay"></div>
      </div>
      <div class="bento-body">
        <div class="bento-title">${a.t}</div>
        <div class="bento-title-ar ar">${a.ar}</div>
        ${a.body?`<div class="bento-excerpt">${a.body}</div>`:''}
        <div class="bento-meta"><span>⏱ Aujourd'hui</span><span>🏆 CdM 2026</span></div>
      </div>
    </div>`).join('');
}

// ── CLASSEMENTS ───────────────────────────────────
let standingsCache = {};

async function fetchStandings() {
  const tabs = document.getElementById('standings-tabs');
  if (!tabs) return;
  tabs.innerHTML = LEAGUES_FD.map((l, i) => `
    <button class="tab-btn ${i===0?'active':''}" onclick="switchStandings('${l.code}',this)">
      ${l.flag} ${l.name}
    </button>`).join('');
  await loadStandings(LEAGUES_FD[0].code);
  clearInterval(window._stInt);
  let idx = 0;
  window._stInt = setInterval(async () => {
    idx = (idx+1) % LEAGUES_FD.length;
    const ts = tabs.querySelectorAll('.tab-btn');
    ts.forEach(t=>t.classList.remove('active'));
    ts[idx]?.classList.add('active');
    await loadStandings(LEAGUES_FD[idx].code);
  }, 10000);
}

window.switchStandings = async function(code, btn) {
  clearInterval(window._stInt);
  document.querySelectorAll('#standings-tabs .tab-btn').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  await loadStandings(code);
};

async function loadStandings(code) {
  const tb = document.getElementById('standings-body');
  if (!tb) return;
  if (standingsCache[code]) { renderStandings(standingsCache[code]); return; }
  tb.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto;width:24px;height:24px;border-width:2px"></div></td></tr>`;
  try {
    const data = await api('standings', `&code=${code}`);
    const table = data.standings?.find(s=>s.type==='TOTAL')?.table || [];
    if (!table.length) throw new Error('Saison terminée');
    standingsCache[code] = table;
    renderStandings(table);
  } catch(e) {
    tb.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:18px;color:var(--text3);font-size:12px">📅 ${e.message}</td></tr>`;
  }
}

function renderStandings(table) {
  const tb = document.getElementById('standings-body');
  const t3 = document.getElementById('top3-container');
  if (!tb) return;
  const total = table.length;

  tb.innerHTML = table.slice(0,10).map(t => {
    const rc = t.position<=3?'top':t.position>=total-2?'rel':'';
    const form = (t.form||'').split(',').slice(-5).map(f =>
      f==='W'?'<div class="fd-dot fw"></div>':f==='D'?'<div class="fd-dot fd2"></div>':'<div class="fd-dot fl"></div>'
    ).join('');
    return `<tr class="animate-in ${t.position<=3?'highlight':''}">
      <td class="s-rank ${rc}">${t.position}</td>
      <td><div style="display:flex;align-items:center;gap:7px">
        <img src="${t.team?.crest||''}" style="width:20px;height:20px;object-fit:contain" onerror="this.style.display='none'">
        <strong>${t.team?.shortName||t.team?.name}</strong>
      </div></td>
      <td>${t.playedGames}</td><td>${t.won}</td><td>${t.draw}</td><td>${t.lost}</td>
      <td>${t.goalsFor}:${t.goalsAgainst}</td>
      <td class="s-pts">${t.points}</td>
      <td><div class="form-dots">${form}</div></td>
    </tr>`;
  }).join('');

  if (t3 && table.length >= 3) {
    const atk = [...table].sort((a,b)=>b.goalsFor-a.goalsFor).slice(0,3);
    const def = [...table].sort((a,b)=>a.goalsAgainst-b.goalsAgainst).slice(0,3);
    t3.innerHTML = `
      <div class="top3-label">⚽ Meilleures Attaques</div>
      ${atk.map((t,i)=>`<div class="top3-row animate-in">
        <div class="top3-emoji">${['🥇','🥈','🥉'][i]}</div>
        <img src="${t.team?.crest||''}" style="width:24px;height:24px;object-fit:contain" onerror="this.style.display='none'">
        <div class="top3-info"><div class="top3-name">${t.team?.shortName||t.team?.name}</div><div class="top3-stat">${t.goalsFor} buts</div></div>
        <div class="top3-val">${t.goalsFor}</div>
      </div>`).join('')}
      <div class="top3-label" style="margin-top:12px">🛡️ Meilleures Défenses</div>
      ${def.map((t,i)=>`<div class="top3-row animate-in">
        <div class="top3-emoji">${['🥇','🥈','🥉'][i]}</div>
        <img src="${t.team?.crest||''}" style="width:24px;height:24px;object-fit:contain" onerror="this.style.display='none'">
        <div class="top3-info"><div class="top3-name">${t.team?.shortName||t.team?.name}</div><div class="top3-stat">${t.goalsAgainst} enc.</div></div>
        <div class="top3-val">${t.goalsAgainst}</div>
      </div>`).join('')}`;
  }
}

// ── TICKER ────────────────────────────────────────
function updateTicker(matches) {
  const el = document.getElementById('ticker');
  if (!el || !matches.length) return;
  const items = matches.slice(0,12).map(m => {
    const sc = (m.homeScore!==null&&m.homeScore!==undefined)
      ? `${m.homeScore} - ${m.awayScore}` : fmtTime(m.date);
    return `<span class="ticker-item">${m.homeFlag||'⚽'} ${m.homeShort||m.homeTeam} — ${m.awayShort||m.awayTeam} ${m.awayFlag||''} <span class="ticker-score">${sc}</span></span>`;
  });
  el.innerHTML = [...items,...items].join('');
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchScores();
  fetchUpcoming();
  fetchGroups();
  fetchArticles();
  fetchStandings();
  setInterval(fetchScores,   60000);
  setInterval(fetchUpcoming, 300000);
});
JSEOF
