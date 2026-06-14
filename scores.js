// scores.js — SportDZ · CdM 2026
// Ce fichier est appelé par index.html
// Il contacte /api/proxy pour toutes les données

// ── URL DU PROXY ──────────────────────────────────
// Sur Vercel : /api/proxy
// En local   : décommenter la ligne LOCAL
const API = '/api/proxy';
// const API = 'http://localhost:3000/api/proxy'; // LOCAL

// ── UTILITAIRES ───────────────────────────────────
function $(id) { return document.getElementById(id); }

function formatDate(iso, opts = {}) {
  const d = new Date(iso);
  const base = { day: '2-digit', month: 'short', timeZone: 'Africa/Algiers', ...opts };
  return d.toLocaleDateString('fr-DZ', base);
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' });
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((d - today) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return d.toLocaleDateString('fr-DZ', { weekday: 'long', timeZone: 'Africa/Algiers' });
}

// ── WIDGET ALGÉRIE ────────────────────────────────
async function loadAlgeriaWidget() {
  try {
    const res = await fetch(`${API}?action=upcoming`);
    const data = await res.json();
    const matches = data.matches || [];

    // Chercher le prochain match de l'Algérie
    const algMatch = matches.find(m =>
      m.homeTeam === 'Algeria' || m.awayTeam === 'Algeria'
    );

    // Aussi chercher dans les scores du jour
    const resS = await fetch(`${API}?action=scores`);
    const dataS = await resS.json();
    const todayAlg = (dataS.matches || []).find(m =>
      m.homeTeam === 'Algeria' || m.awayTeam === 'Algeria'
    );

    const match = todayAlg || algMatch;

    if (!match) {
      $('alg-date').textContent = 'Aucun match programmé';
      $('alg-opp-flag').textContent = '🏆';
      $('alg-opp-name').textContent = 'CdM 2026';
      return;
    }

    const isAlgHome = match.homeTeam === 'Algeria';
    const opp = isAlgHome ? match.awayTeam : match.homeTeam;
    const oppFlag = isAlgHome ? match.awayFlag : match.homeFlag;

    $('alg-opp-flag').textContent = oppFlag;
    $('alg-opp-name').textContent = opp;
    $('alg-date').textContent = `${formatDate(match.date)} · ${formatTime(match.date)}`;
    $('alg-venue').textContent = match.venue || '';

    if (match.status === 'STATUS_IN_PROGRESS') {
      const score = isAlgHome
        ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
        : `${match.awayScore ?? 0} - ${match.homeScore ?? 0}`;
      $('alg-score').textContent = score;
      $('alg-score').classList.add('live-glow');
      $('alg-status').textContent = 'EN DIRECT';
      $('alg-status').className = 'alg-hero-status s-live';
    } else if (match.status === 'STATUS_FINAL') {
      const score = isAlgHome
        ? `${match.homeScore} - ${match.awayScore}`
        : `${match.awayScore} - ${match.homeScore}`;
      $('alg-score').textContent = score;
      $('alg-status').textContent = 'Terminé';
      $('alg-status').className = 'alg-hero-status s-fin';
    } else {
      $('alg-score').textContent = 'VS';
      $('alg-status').textContent = 'À venir';
      $('alg-status').className = 'alg-hero-status s-soon';
    }
  } catch (e) {
    console.error('Algeria widget error:', e);
  }
}

// ── GROUPES ───────────────────────────────────────
async function loadGroups() {
  const container = $('groups-container');
  if (!container) return;

  try {
    const res = await fetch(`${API}?action=groups`);
    const data = await res.json();
    const groups = data.groups || [];

    if (groups.length === 0) {
      container.innerHTML = '<div class="loading-state">Aucune donnée de groupe disponible.</div>';
      return;
    }

    container.innerHTML = groups.map(group => {
      const hasAlg = group.teams.some(t => t.name === 'Algeria');
      return `
        <div class="group-card">
          <div class="group-card-header">
            <span class="group-card-name">${group.name}</span>
            ${hasAlg ? '<span class="group-card-alg">🇩🇿 ALG</span>' : ''}
          </div>
          <table class="group-card-table">
            <thead>
              <tr>
                <td style="color:var(--fifa-muted);font-size:9px;letter-spacing:1px">#</td>
                <td style="color:var(--fifa-muted);font-size:9px;letter-spacing:1px">Équipe</td>
                <td style="color:var(--fifa-muted);font-size:9px;text-align:center">J</td>
                <td style="color:var(--fifa-muted);font-size:9px;text-align:center">G</td>
                <td style="color:var(--fifa-muted);font-size:9px;text-align:center">N</td>
                <td style="color:var(--fifa-muted);font-size:9px;text-align:center">P</td>
                <td style="color:var(--fifa-muted);font-size:9px;text-align:center">Pts</td>
              </tr>
            </thead>
            <tbody>
              ${group.teams.map((t, i) => `
                <tr class="${i < 2 ? 'qualify' : ''}">
                  <td class="g-rank ${i < 2 ? 'q' : ''}">${i + 1}</td>
                  <td>
                    <div class="g-team-cell">
                      <span class="g-flag">${t.flag}</span>
                      <span class="g-name ${t.name === 'Algeria' ? 'g-alg' : ''}">${t.name}</span>
                    </div>
                  </td>
                  <td style="text-align:center;font-size:11px">${t.played}</td>
                  <td style="text-align:center;font-size:11px">${t.won}</td>
                  <td style="text-align:center;font-size:11px">${t.draw}</td>
                  <td style="text-align:center;font-size:11px">${t.lost}</td>
                  <td class="g-pts" style="text-align:center">${t.pts}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

  } catch (e) {
    container.innerHTML = `<div class="loading-state">Erreur chargement groupes : ${e.message}</div>`;
  }
}

// ── SCORES DU JOUR ────────────────────────────────
async function loadScores() {
  const container = $('scores-container');
  if (!container) return;

  try {
    const res = await fetch(`${API}?action=scores`);
    const data = await res.json();
    const matches = data.matches || [];

    if (matches.length === 0) {
      container.innerHTML = `
        <div class="loading-state" style="padding:40px">
          <div style="font-size:32px;margin-bottom:12px">📅</div>
          Aucun match aujourd'hui · لا مباريات اليوم<br>
          <span style="font-size:11px;margin-top:8px;display:block">Consultez le programme des prochains matchs ↓</span>
        </div>`;
      return;
    }

    container.innerHTML = `
      <table class="matches-table">
        <thead>
          <tr>
            <th>Groupe</th>
            <th>Domicile</th>
            <th>Score</th>
            <th>Extérieur</th>
            <th>Statut</th>
            <th>Stade</th>
          </tr>
        </thead>
        <tbody>
          ${matches.map(m => {
            const isLive = m.status === 'STATUS_IN_PROGRESS';
            const isDone = m.status === 'STATUS_FINAL';
            const scoreHTML = (m.homeScore !== null && m.awayScore !== null)
              ? `<span class="match-score">${m.homeScore} – ${m.awayScore}</span>`
              : `<span class="match-vs">${formatTime(m.date)}</span>`;
            const statusHTML = isLive
              ? `<span class="live-dot">LIVE</span>`
              : isDone
              ? `<span class="status-done">FIN</span>`
              : `<span class="status-upcoming">${formatTime(m.date)}</span>`;
            const algClass = (m.homeTeam === 'Algeria' || m.awayTeam === 'Algeria') ? 'style="background:rgba(0,214,115,0.04)"' : '';
            return `
              <tr ${algClass}>
                <td><span class="match-group">${m.group || 'CdM'}</span></td>
                <td>
                  <div class="match-teams">
                    <span style="font-size:20px">${m.homeFlag}</span>
                    <span class="match-team">${m.homeShort}</span>
                  </div>
                </td>
                <td style="text-align:center">${scoreHTML}</td>
                <td>
                  <div class="match-teams">
                    <span style="font-size:20px">${m.awayFlag}</span>
                    <span class="match-team">${m.awayShort}</span>
                  </div>
                </td>
                <td>${statusHTML}</td>
                <td class="match-venue">${m.venue || '—'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    container.innerHTML = `<div class="loading-state">Erreur : ${e.message}</div>`;
  }
}

// ── PROCHAINS MATCHS ─────────────────────────────
async function loadUpcoming() {
  const listEl = $('upcoming-list');
  const tabsEl = $('upcoming-tabs');
  if (!listEl) return;

  try {
    const res = await fetch(`${API}?action=upcoming`);
    const data = await res.json();
    const matches = data.matches || [];

    if (matches.length === 0) {
      listEl.innerHTML = '<div class="loading-state">Aucun match à venir dans les 7 prochains jours.</div>';
      return;
    }

    // Grouper par date
    const byDate = {};
    matches.forEach(m => {
      const d = m.date.split('T')[0];
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(m);
    });

    const dates = Object.keys(byDate).sort();

    // Générer les onglets de dates
    if (tabsEl) {
      tabsEl.innerHTML = ['Tous', ...dates.map(d => {
        return new Date(d).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', timeZone: 'Africa/Algiers' });
      })].map((label, i) => `
        <button class="up-tab ${i === 0 ? 'active' : ''}" data-index="${i - 1}">${label}</button>
      `).join('');

      tabsEl.querySelectorAll('.up-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          tabsEl.querySelectorAll('.up-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const idx = parseInt(btn.dataset.index);
          renderUpcoming(matches, byDate, dates, idx);
        });
      });
    }

    renderUpcoming(matches, byDate, dates, -1);

  } catch (e) {
    listEl.innerHTML = `<div class="loading-state">Erreur : ${e.message}</div>`;
  }
}

function renderUpcoming(matches, byDate, dates, dateIdx) {
  const listEl = $('upcoming-list');
  const filtered = dateIdx === -1 ? matches : (byDate[dates[dateIdx]] || []);

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="loading-state">Aucun match ce jour.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(m => {
    const isAlg = m.homeTeam === 'Algeria' || m.awayTeam === 'Algeria';
    return `
      <div class="up-item" ${isAlg ? 'style="background:rgba(0,214,115,0.04);border-left:2px solid var(--fifa-green)"' : ''}>
        <div class="up-date">
          <div class="up-day">${dayLabel(m.date)}</div>
          <div class="up-time">${formatTime(m.date)}</div>
          <div class="up-venue">${m.venue?.split(',')[1]?.trim() || ''}</div>
        </div>
        <div class="up-match">
          <div class="up-team">
            <span class="up-flag">${m.homeFlag}</span>
            <span class="up-name">${m.homeTeam}</span>
          </div>
          <span class="up-vs">VS</span>
          <div class="up-team right">
            <span class="up-flag">${m.awayFlag}</span>
            <span class="up-name">${m.awayTeam}</span>
          </div>
        </div>
        <span class="up-group">${m.group || 'CdM 2026'}</span>
      </div>`;
  }).join('');
}

// ── ARTICLES RSS + IA TEMPS RÉEL ─────────────────
async function loadArticles() {
  const container = $('articles-container');
  if (!container) return;

  // Afficher le skeleton pendant le chargement
  container.innerHTML = Array(6).fill(0).map((_, i) => `
    <div class="bento-card ${i === 0 ? 'span7' : i === 1 ? 'span5' : 'span4'}" style="pointer-events:none">
      <div class="bento-img" style="background:linear-gradient(135deg,#0d1520,#111828)">
        <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%);animation:shimmer 1.5s infinite;background-size:200% 100%"></div>
      </div>
      <div class="bento-body">
        <div style="height:14px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:8px;width:${70 + i * 5}%"></div>
        <div style="height:10px;background:rgba(255,255,255,0.04);border-radius:2px;margin-bottom:4px"></div>
        <div style="height:10px;background:rgba(255,255,255,0.04);border-radius:2px;width:80%"></div>
      </div>
    </div>
  `).join('');

  try {
    // 1. Essayer Redis (articles générés par IA)
    let articles = [];
    try {
      const redisRes = await fetch('/api/generate-articles?action=list');
      const redisData = await redisRes.json();
      // Parser chaque article (peut être double-stringifié)
      articles = (redisData.articles || []).map(a => {
        if (typeof a === 'string') { try { return JSON.parse(a); } catch { return null; } }
        return a;
      }).filter(a => a && a.title);
    } catch(e) { console.error('Redis error:', e); }

    // 2. Fallback : flux RSS directs si Redis vide
    if (articles.length === 0) {
      const res = await fetch(`${API}?action=articles`);
      const data = await res.json();
      articles = data.articles || [];
    }

    if (articles.length === 0) {
      container.innerHTML = `
        <div style="grid-column:span 12;text-align:center;padding:60px 20px">
          <div style="font-size:40px;margin-bottom:16px">🏆</div>
          <div style="font-family:var(--font-titles);font-size:20px;text-transform:uppercase;margin-bottom:8px">Coupe du Monde 2026 en cours !</div>
          <div style="color:var(--fifa-muted);font-size:13px">Les articles apparaîtront ici · تحميل الأخبار...</div>
        </div>`;
      return;
    }

    const spans = ['span7', 'span5', 'span4', 'span4', 'span4', 'span4', 'span4', 'span4', 'span4', 'span4', 'span4', 'span4'];

    container.innerHTML = articles.map((a, i) => {
      const span = spans[i] || 'span4';
      const isAlg = /algeri|algér|fennec|خضر/i.test(a.title + a.excerpt);
      const timeAgo = getTimeAgo(a.published_at || a.date);
      const imgStyle = a.image
        ? `background-image:url('${a.image}');background-size:cover;background-position:center`
        : `background:linear-gradient(135deg,#0a1218,#111828)`;

      return `
        <a class="bento-card ${span}" href="${a.source_url || a.url || '#'}" target="_blank" rel="noopener noreferrer"
           style="text-decoration:none;color:inherit${isAlg ? ';border-color:rgba(0,214,115,0.5)' : ''}">
          <div class="bento-img" style="${imgStyle}">
            <div class="bento-img-overlay"></div>
            <span class="bento-cat" style="background:${a.source_color || a.sourceColor || 'var(--fifa-green)'}${(a.source_color || a.sourceColor) && (a.source_color || a.sourceColor) !== '#00D673' ? ';color:#fff' : ';color:#000'}">
              ${a.source_flag || a.sourceFlag || "⚽"} ${a.source_name || a.source || "Sport"}
            </span>
            ${isAlg ? '<span style="position:absolute;top:12px;right:12px;z-index:1;font-size:20px;filter:drop-shadow(0 0 6px rgba(0,214,115,0.8))">🇩🇿</span>' : ''}
            ${!a.image ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${span === 'span7' ? '64' : '40'}px;opacity:0.15">⚽</div>` : ''}
          </div>
          <div class="bento-body">
            <div class="bento-title" style="font-size:${span === 'span7' ? '17px' : '13px'}">${a.title}</div>
            ${a.excerpt ? `<p class="bento-excerpt">${a.excerpt}</p>` : ''}
            <div class="bento-meta">
              <span>🕐 ${timeAgo}</span>
              <span style="color:${a.source_color || a.sourceColor || 'var(--fifa-green)'}">↗ Lire l'article</span>
              ${isAlg ? '<span style="color:var(--fifa-green);font-weight:600">🇩🇿 Algérie</span>' : ''}
            </div>
          </div>
        </a>`;
    }).join('');

  } catch (e) {
    container.innerHTML = `
      <div style="grid-column:span 12" class="loading-state">
        <div style="font-size:32px;margin-bottom:10px">📡</div>
        Connexion aux flux d'actualités...<br>
        <span style="font-size:11px;color:var(--fifa-muted)">${e.message}</span>
      </div>`;
  }
}

// Convertir date en "il y a X minutes/heures"
function getTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "À l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

// ── CLASSEMENTS CHAMPIONNATS ──────────────────────
const LEAGUES_META = [
  { code: 'PL',  name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'PD',  name: 'La Liga',        flag: '🇪🇸' },
  { code: 'BL1', name: 'Bundesliga',     flag: '🇩🇪' },
  { code: 'SA',  name: 'Serie A',        flag: '🇮🇹' },
  { code: 'FL1', name: 'Ligue 1',        flag: '🇫🇷' },
  { code: 'CL',  name: 'Champions League', flag: '🏆' },
];

async function loadStandings(code = 'PL') {
  const body = $('standings-body');
  if (!body) return;

  body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:28px"><div class="spinner" style="margin:0 auto;width:26px;height:26px;border-width:2px"></div></td></tr>`;

  try {
    const res = await fetch(`${API}?action=standings&code=${code}`);
    const data = await res.json();

    // football-data format
    const standings = data.standings?.[0]?.table || [];

    if (standings.length === 0) {
      body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--fifa-muted)">Saison terminée · Données bientôt disponibles</td></tr>`;
      return;
    }

    const formMap = { 'W': 'w', 'D': 'd', 'L': 'l' };

    body.innerHTML = standings.map((t, i) => {
      const qualify = i < 4;
      const relegated = i >= standings.length - 3;
      const form = (t.form || '').split(',').slice(-5);

      return `
        <tr>
          <td>
            <span class="rank-num ${qualify ? 'qualify' : ''}">${t.position}</span>
          </td>
          <td>
            <div class="team-name-cell">
              ${t.team.crest ? `<img src="${t.team.crest}" style="width:20px;height:20px;object-fit:contain" alt="">` : ''}
              <span class="team-label">${t.team.shortName || t.team.name}</span>
            </div>
          </td>
          <td>${t.playedGames}</td>
          <td>${t.won}</td>
          <td>${t.draw}</td>
          <td>${t.lost}</td>
          <td>${t.goalsFor}:${t.goalsAgainst}</td>
          <td class="pts-cell">${t.points}</td>
          <td>
            <div class="form-cell">
              ${form.map(f => `<span class="form-${formMap[f] || 'd'}">${f}</span>`).join('')}
            </div>
          </td>
        </tr>`;
    }).join('');

  } catch (e) {
    body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--fifa-red)">${e.message}</td></tr>`;
  }
}

function initStandingsTabs() {
  const tabsEl = $('standings-tabs');
  if (!tabsEl) return;

  tabsEl.innerHTML = LEAGUES_META.map((lg, i) => `
    <button class="up-tab ${i === 0 ? 'active' : ''}" data-code="${lg.code}">
      ${lg.flag} ${lg.name}
    </button>
  `).join('');

  tabsEl.querySelectorAll('.up-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsEl.querySelectorAll('.up-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadStandings(btn.dataset.code);
    });
  });

  loadStandings('PL');
}

// ── AUTO-REFRESH ──────────────────────────────────
// Rafraîchir les scores toutes les 60 secondes si match en cours
let refreshInterval = null;

function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    loadScores();
    loadAlgeriaWidget();
  }, 60000);
}

// ── INITIALISATION ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAlgeriaWidget();
  loadGroups();
  loadScores();
  loadUpcoming();
  loadArticles();
  initStandingsTabs();
  startAutoRefresh();
});

// ══════════════════════════════════════
// WIDGET LIVE — Tâche 2
// ══════════════════════════════════════

const NEXT_ALGERIA = {
  homeTeam: 'Algérie', homeFlag: '🇩🇿', homeAr: 'الجزائر',
  awayTeam: 'Argentine', awayFlag: '🇦🇷', awayAr: 'الأرجنتين',
  date: new Date('2026-06-16T02:00:00Z'), // 21h00 ET = 02h00 Algérie 17 juin
  venue: 'Arrowhead Stadium, Kansas City',
  venueAr: 'ملعب أروهيد، كنساس سيتي',
  group: 'Groupe J · المجموعة J',
};

const TEAM_NAMES_AR = {
  'Algeria':'الجزائر','Argentina':'الأرجنتين','France':'فرنسا',
  'Brazil':'البرازيل','Spain':'إسبانيا','Germany':'ألمانيا',
  'England':'إنجلترا','Portugal':'البرتغال','Morocco':'المغرب',
  'USA':'الولايات المتحدة','Mexico':'المكسيك','Canada':'كندا',
  'Netherlands':'هولندا','Croatia':'كرواتيا','Japan':'اليابان',
  'Senegal':'السنغال','Uruguay':'أوروغواي','Colombia':'كولومبيا',
  'Austria':'النمسا','Jordan':'الأردن',
};

function getArName(name) { return TEAM_NAMES_AR[name] || name; }

async function loadLiveWidget() {
  const container = $('live-widget-content');
  if (!container) return;

  try {
    const res = await fetch('/api/live');
    const data = await res.json();
    const live = data.live || [];
    const recent = data.recent || [];

    if (live.length > 0) {
      // Afficher le match en direct
      renderLiveMatch(live[0], container);
    } else {
      // Pas de match en direct → afficher compteur prochain match Algérie
      renderNextMatch(container);
    }
  } catch {
    renderNextMatch(container);
  }
}

function renderLiveMatch(match, container) {
  const scorers = match.scorers || [];
  const scorersHTML = scorers.length > 0 ? `
    <div class="lw-scorers">
      ${scorers.map(s => `
        <div class="lw-scorer-item">
          <span class="lw-scorer-icon">⚽</span>
          <span class="lw-scorer-name">${s.player}</span>
          <span class="lw-scorer-clock">${s.clock}'</span>
        </div>
      `).join('')}
    </div>
  ` : '<div class="lw-no-live" style="font-size:11px;padding:8px 32px 16px">Aucun but pour le moment · لا أهداف حتى الآن</div>';

  container.innerHTML = `
    <div class="lw-live-card">
      <div class="lw-live-header">
        <div style="display:flex;align-items:center;gap:12px">
          <span class="lw-live-badge">🔴 EN DIRECT</span>
          <span class="lw-live-badge-ar">مباشر</span>
        </div>
        <span class="lw-clock">${match.clock || ''} ${match.period > 1 ? '(2T)' : '(1T)'}</span>
        <span class="lw-group">${match.group || 'CdM 2026'}</span>
      </div>
      <div class="lw-scoreboard">
        <div class="lw-team">
          <span class="lw-team-flag">${match.homeFlag}</span>
          <span class="lw-team-name">${match.homeTeam}</span>
          <span class="lw-team-name-ar">${getArName(match.homeTeam)}</span>
        </div>
        <div class="lw-score-center">
          <div class="lw-score">${match.homeScore ?? 0}<span class="lw-score-sep"> – </span>${match.awayScore ?? 0}</div>
          <div class="lw-halftime">${match.venue || ''}</div>
        </div>
        <div class="lw-team">
          <span class="lw-team-flag">${match.awayFlag}</span>
          <span class="lw-team-name">${match.awayTeam}</span>
          <span class="lw-team-name-ar">${getArName(match.awayTeam)}</span>
        </div>
      </div>
      ${scorersHTML}
    </div>`;
}

function renderNextMatch(container) {
  const m = NEXT_ALGERIA;
  container.innerHTML = `
    <div class="lw-next-card">
      <div class="lw-next-header">
        <span class="lw-next-label">Prochain match · الجزائر</span>
        <span class="lw-next-label-ar">المباراة القادمة للخضر</span>
      </div>
      <div class="lw-next-body">
        <div class="lw-team" style="align-items:center">
          <span class="lw-team-flag">${m.homeFlag}</span>
          <span class="lw-team-name">${m.homeTeam}</span>
          <span class="lw-team-name-ar">${m.homeAr}</span>
        </div>
        <div class="lw-next-vs">
          <div style="font-family:var(--font-titles);font-size:28px;color:var(--fifa-muted)">VS</div>
          <div style="font-size:9px;color:var(--fifa-purple);letter-spacing:1px;margin-top:4px">${m.group}</div>
        </div>
        <div class="lw-team" style="align-items:center">
          <span class="lw-team-flag">${m.awayFlag}</span>
          <span class="lw-team-name">${m.awayTeam}</span>
          <span class="lw-team-name-ar">${m.awayAr}</span>
        </div>
      </div>
      <div class="lw-countdown" id="lw-cd-wrap">
        <div class="lw-cd-unit">
          <span class="lw-cd-num" id="lw-days">00</span>
          <span class="lw-cd-label">Jours</span>
          <span class="lw-cd-label-ar">أيام</span>
        </div>
        <div class="lw-cd-unit">
          <span class="lw-cd-num" id="lw-hours">00</span>
          <span class="lw-cd-label">Heures</span>
          <span class="lw-cd-label-ar">ساعات</span>
        </div>
        <div class="lw-cd-unit">
          <span class="lw-cd-num" id="lw-mins">00</span>
          <span class="lw-cd-label">Mins</span>
          <span class="lw-cd-label-ar">دقائق</span>
        </div>
        <div class="lw-cd-unit">
          <span class="lw-cd-num" id="lw-secs">00</span>
          <span class="lw-cd-label">Secs</span>
          <span class="lw-cd-label-ar">ثواني</span>
        </div>
      </div>
      <div class="lw-venue">📍 ${m.venue} · ${m.venueAr}</div>
    </div>`;

  // Lancer le compteur
  startLiveCountdown(m.date);
}

function startLiveCountdown(targetDate) {
  function pad(n) { return String(Math.max(0,n)).padStart(2,'0'); }
  function tick() {
    const diff = targetDate - Date.now();
    const d = $('lw-days'), h = $('lw-hours'), m = $('lw-mins'), s = $('lw-secs');
    if (!d) return;
    if (diff <= 0) {
      d.textContent = '00'; h.textContent = '00';
      m.textContent = '00'; s.textContent = '00';
      return;
    }
    d.textContent = pad(Math.floor(diff / 86400000));
    h.textContent = pad(Math.floor((diff % 86400000) / 3600000));
    m.textContent = pad(Math.floor((diff % 3600000) / 60000));
    s.textContent = pad(Math.floor((diff % 60000) / 1000));
  }
  tick();
  setInterval(tick, 1000);
}

// Rafraîchir le widget live toutes les 30 secondes
document.addEventListener('DOMContentLoaded', () => {
  loadLiveWidget();
  setInterval(loadLiveWidget, 30000);
});


// ══════════════════════════════════════
// LIVE BAR — Widget flottant mondial
// Complètement indépendant du widget Algérie
// ══════════════════════════════════════

(function LiveBar() {

  let matches = [];   // tous les matchs ESPN
  let idx = 0;        // index actuel
  let cdTimer = null; // countdown interval

  const TEAM_AR = {
    'Algeria':'الجزائر','Argentina':'الأرجنتين','France':'فرنسا',
    'Brazil':'البرازيل','Spain':'إسبانيا','Germany':'ألمانيا',
    'England':'إنجلترا','Portugal':'البرتغال','Morocco':'المغرب',
    'USA':'الولايات المتحدة','Mexico':'المكسيك','Canada':'كندا',
    'Turkey':'تركيا','Türkiye':'تركيا','Austria':'النمسا','Jordan':'الأردن',
    'Netherlands':'هولندا','Croatia':'كرواتيا','Japan':'اليابان',
    'Australia':'أستراليا','Senegal':'السنغال','Uruguay':'أوروغواي',
    'Colombia':'كولومبيا','Italy':'إيطاليا','Norway':'النرويج',
    'Scotland':'اسكتلندا','Serbia':'صربيا','Ukraine':'أوكرانيا',
    'Belgium':'بلجيكا','Denmark':'الدانمارك','Poland':'بولندا',
    'Sweden':'السويد','Switzerland':'سويسرا','South Korea':'كوريا الجنوبية',
    'Ecuador':'الإكوادور','Tunisia':'تونس','Cameroon':'الكاميرون',
    'Ghana':'غانا','Saudi Arabia':'السعودية','Iran':'إيران',
    'Nigeria':'نيجيريا','Egypt':'مصر','Ivory Coast':'كوت ديفوار',
    "Cote d'Ivoire":'كوت ديفوار','Curaçao':'كوراساو',
    'DR Congo':'الكونغو','Cape Verde':'الرأس الأخضر',
    'Uzbekistan':'أوزبكستان','Iraq':'العراق','Panama':'بنما',
    'Jamaica':'جامايكا','Venezuela':'فنزويلا','Peru':'بيرو',
    'Chile':'تشيلي','Bolivia':'بوليفيا','Paraguay':'باراغواي',
    'New Zealand':'نيوزيلندا','Indonesia':'إندونيسيا',
  };

  function ar(name) { return TEAM_AR[name] || name; }
  function pad(n) { return String(n).padStart(2,'0'); }
  function el(id) { return document.getElementById(id); }

  // ── FETCH ESPN ─────────────────────────────
  async function fetch_matches() {
    try {
      const res = await fetch('/api/live');
      if (!res.ok) return;
      const data = await res.json();
      const now = new Date();
      const all = [];

      // 1. LIVE
      (data.live || []).forEach(m => all.push({...m, _s:'live'}));

      // 2. UPCOMING — triés par date
      (data.upcoming || [])
        .filter(m => new Date(m.date) > now)
        .sort((a,b) => new Date(a.date) - new Date(b.date))
        .slice(0,6)
        .forEach(m => all.push({...m, _s:'soon'}));

      // 3. RECENT — terminés
      (data.recent || [])
        .slice(0,2)
        .forEach(m => all.push({...m, _s:'done'}));

      if (all.length === 0) return;

      matches = all;

      // Auto-sélectionner : live > soon > done
      const li = all.findIndex(m => m._s==='live');
      const si = all.findIndex(m => m._s==='soon');
      idx = li >= 0 ? li : si >= 0 ? si : 0;

      render();
    } catch(e) {
      console.warn('LiveBar fetch error:', e.message);
    }
  }

  // ── RENDER ─────────────────────────────────
  function render() {
    if (matches.length === 0) return;
    const m = matches[idx];
    if (!m) return;

    // Arrêter countdown précédent
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }

    // Éléments
    const badge   = el('lb-badge');
    const hFlag   = el('lb-home-flag');
    const hName   = el('lb-home-name');
    const scoreEl = el('lb-score');
    const aFlag   = el('lb-away-flag');
    const aName   = el('lb-away-name');
    const clockEl = el('lb-clock');
    const cdEl    = el('lb-countdown');
    const scorEl  = el('lb-scorers');
    const grpEl   = el('lb-group');
    const arEl    = el('lb-arabic');
    const cntEl   = el('lb-counter');

    if (!badge || !hFlag) return;

    // Équipes
    hFlag.textContent = m.homeFlag || '⚽';
    hName.textContent = m.homeTeam || '—';
    aFlag.textContent = m.awayFlag || '⚽';
    aName.textContent = m.awayTeam || '—';
    grpEl.textContent = m.group || 'CdM 2026';
    arEl.textContent  = `${ar(m.homeTeam)} ضد ${ar(m.awayTeam)}`;
    cntEl.textContent = `${idx+1}/${matches.length}`;
    clockEl.textContent = '';
    cdEl.textContent = '';
    scorEl.innerHTML = '';

    if (m._s === 'live') {
      // ── EN DIRECT ──
      badge.className   = 'lb-badge is-live';
      badge.textContent = '🔴 LIVE';
      scoreEl.className = 'lb-score live';
      scoreEl.textContent = `${m.homeScore ?? 0} – ${m.awayScore ?? 0}`;
      clockEl.textContent = m.clock ? `${m.clock}'` : '';

      const goals = m.scorers || [];
      scorEl.innerHTML = goals.length > 0
        ? goals.map(g => `<span class="lb-scorer">⚽ <span>${g.player}</span> ${g.clock}'</span>`).join('')
        : `<span class="lb-scorer" style="color:var(--fifa-muted)">0 but · لا أهداف</span>`;

    } else if (m._s === 'soon') {
      // ── BIENTÔT — compte à rebours ──
      scoreEl.className   = 'lb-score soon';
      scoreEl.textContent = 'VS';

      const target = new Date(m.date);
      function tick() {
        const diff = target - Date.now();
        const b = el('lb-badge');
        const c = el('lb-countdown');
        if (!b || !c) { clearInterval(cdTimer); return; }
        if (diff <= 0) {
          b.className   = 'lb-badge is-live';
          b.textContent = '🔴 MAINTENANT';
          c.textContent = '';
          clearInterval(cdTimer);
          setTimeout(fetch_matches, 20000);
          return;
        }
        const h  = Math.floor(diff / 3600000);
        const mn = Math.floor((diff % 3600000) / 60000);
        const s  = Math.floor((diff % 60000) / 1000);
        b.className   = 'lb-badge is-soon';
        b.textContent = '⏱ BIENTÔT';
        c.textContent = h > 0
          ? `dans ${h}h ${pad(mn)}m`
          : `dans ${pad(mn)}:${pad(s)}`;
      }
      tick();
      cdTimer = setInterval(tick, 1000);

    } else {
      // ── TERMINÉ ──
      badge.className   = 'lb-badge is-done';
      badge.textContent = '✓ FIN';
      scoreEl.className = 'lb-score done';
      scoreEl.textContent = `${m.homeScore ?? 0} – ${m.awayScore ?? 0}`;
      clockEl.textContent = 'FT';

      const goals = m.scorers || [];
      scorEl.innerHTML = goals.length > 0
        ? goals.map(g => `<span class="lb-scorer">⚽ <span>${g.player}</span> ${g.clock}'</span>`).join('')
        : `<span class="lb-scorer" style="color:var(--fifa-muted)">Résultat final · نهاية</span>`;
    }
  }

  // ── NAVIGATION ─────────────────────────────
  window.liveBarNav = function(dir) {
    if (matches.length === 0) return;
    idx = (idx + dir + matches.length) % matches.length;
    render();
  };

  // ── INIT ───────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    fetch_matches();
    setInterval(fetch_matches, 30000); // refresh toutes les 30s
  });

})(); // fin IIFE — complètement isolé
