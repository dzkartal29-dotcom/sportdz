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
      articles = redisData.articles || [];
    } catch {}

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
      const timeAgo = getTimeAgo(a.date);
      const imgStyle = a.image
        ? `background-image:url('${a.image}');background-size:cover;background-position:center`
        : `background:linear-gradient(135deg,#0a1218,#111828)`;

      return `
        <a class="bento-card ${span}" href="${a.url}" target="_blank" rel="noopener noreferrer"
           style="text-decoration:none;color:inherit${isAlg ? ';border-color:rgba(0,214,115,0.5)' : ''}">
          <div class="bento-img" style="${imgStyle}">
            <div class="bento-img-overlay"></div>
            <span class="bento-cat" style="background:${a.sourceColor || 'var(--fifa-green)'}${a.sourceColor && a.sourceColor !== '#00D673' ? ';color:#fff' : ';color:#000'}">
              ${a.sourceFlag} ${a.source}
            </span>
            ${isAlg ? '<span style="position:absolute;top:12px;right:12px;z-index:1;font-size:20px;filter:drop-shadow(0 0 6px rgba(0,214,115,0.8))">🇩🇿</span>' : ''}
            ${!a.image ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${span === 'span7' ? '64' : '40'}px;opacity:0.15">⚽</div>` : ''}
          </div>
          <div class="bento-body">
            <div class="bento-title" style="font-size:${span === 'span7' ? '17px' : '13px'}">${a.title}</div>
            ${a.excerpt ? `<p class="bento-excerpt">${a.excerpt}</p>` : ''}
            <div class="bento-meta">
              <span>🕐 ${timeAgo}</span>
              <span style="color:${a.sourceColor || 'var(--fifa-green)'}">↗ Lire l'article</span>
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
