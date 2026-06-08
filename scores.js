// ============================================
// SportDZ — Scores en direct via API-Football
// ============================================

const API_KEY = '5130309ed2mshe40285506e8c3f9p1259d1jsn9a47c28618f2';
const API_HOST = 'api-football-v1.p.rapidapi.com';

// Ligues qu'on suit
const LEAGUES = [
  { id: 197, name: '🇩🇿 Ligue 1 Algérie' },
  { id: 39,  name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League' },
  { id: 140, name: '🇪🇸 La Liga' },
  { id: 61,  name: '🇫🇷 Ligue 1' },
  { id: 135, name: '🇮🇹 Serie A' },
  { id: 78,  name: '🇩🇪 Bundesliga' },
];

// Statuts des matchs
function getStatus(status, elapsed) {
  if (['1H','2H','ET','BT','P','LIVE'].includes(status)) {
    return { label: `🔴 ${elapsed || ''}\'`, cls: 'live' };
  }
  if (['FT','AET','PEN'].includes(status)) {
    return { label: 'FT', cls: 'finished' };
  }
  if (['HT'].includes(status)) {
    return { label: 'Mi-temps', cls: 'live' };
  }
  return { label: 'À venir', cls: 'upcoming' };
}

// Récupérer les matchs du jour
async function fetchTodayFixtures() {
  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('scores-container');
  const ticker = document.getElementById('ticker');

  container.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
      <div style="font-size:32px;margin-bottom:12px">⚽</div>
      <div>Chargement des scores en direct...</div>
      <div style="font-family:'Cairo',sans-serif;font-size:13px;margin-top:4px">جاري تحميل النتائج...</div>
    </div>
  `;

  try {
    const res = await fetch(`https://${API_HOST}/v3/fixtures?date=${today}&timezone=Africa/Algiers`, {
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST
      }
    });

    const data = await res.json();

    if (!data.response || data.response.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
          <div style="font-size:32px;margin-bottom:12px">📅</div>
          <div>Aucun match aujourd'hui</div>
          <div style="font-family:'Cairo',sans-serif;font-size:13px;margin-top:4px">لا توجد مباريات اليوم</div>
        </div>
      `;
      return;
    }

    // Filtrer les ligues qu'on suit
    const leagueIds = LEAGUES.map(l => l.id);
    const fixtures = data.response
      .filter(f => leagueIds.includes(f.league.id))
      .sort((a, b) => {
        // Live en premier, puis à venir, puis terminés
        const order = { live: 0, upcoming: 1, finished: 2 };
        const sa = getStatus(a.fixture.status.short, a.fixture.status.elapsed).cls;
        const sb = getStatus(b.fixture.status.short, b.fixture.status.elapsed).cls;
        return (order[sa] ?? 3) - (order[sb] ?? 3);
      });

    if (fixtures.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
          <div style="font-size:32px;margin-bottom:12px">📅</div>
          <div>Aucun match dans nos ligues aujourd'hui</div>
        </div>
      `;
      return;
    }

    // Afficher les matchs
    container.innerHTML = fixtures.map(f => {
      const status = getStatus(f.fixture.status.short, f.fixture.status.elapsed);
      const home = f.teams.home;
      const away = f.teams.away;
      const goals = f.goals;
      const league = LEAGUES.find(l => l.id === f.league.id);

      const scoreDisplay = status.cls === 'upcoming'
        ? new Date(f.fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : `${goals.home ?? 0} - ${goals.away ?? 0}`;

      return `
        <div class="score-card">
          <div class="score-league">${league?.name || f.league.name}</div>
          <div class="score-match">
            <div class="team">
              <div class="team-logo">
                <img src="${home.logo}" alt="${home.name}" style="width:32px;height:32px;object-fit:contain" onerror="this.style.display='none'">
              </div>
              <div class="team-name">${home.name}</div>
            </div>
            <div class="score-center">
              <div class="score-num">${scoreDisplay}</div>
              <span class="score-time ${status.cls}">${status.label}</span>
            </div>
            <div class="team">
              <div class="team-logo">
                <img src="${away.logo}" alt="${away.name}" style="width:32px;height:32px;object-fit:contain" onerror="this.style.display='none'">
              </div>
              <div class="team-name">${away.name}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Mettre à jour le ticker
    const tickerItems = fixtures.slice(0, 8).map(f => {
      const goals = f.goals;
      const status = getStatus(f.fixture.status.short, f.fixture.status.elapsed);
      const score = status.cls === 'upcoming' ? 'À venir' : `${goals.home ?? 0} - ${goals.away ?? 0}`;
      return `<span class="ticker-item">${f.teams.home.name} — ${f.teams.away.name} <span class="ticker-score">${score}</span></span>`;
    });

    // Dupliquer pour animation infinie
    const allItems = [...tickerItems, ...tickerItems].join('');
    ticker.innerHTML = allItems;

  } catch (err) {
    console.error('Erreur API:', err);
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
        <div style="font-size:32px;margin-bottom:12px">⚠️</div>
        <div>Erreur de chargement — réessai dans 30 secondes</div>
      </div>
    `;
  }
}

// Récupérer le classement Ligue 1 Algérie
async function fetchStandings() {
  try {
    const year = new Date().getFullYear();
    const res = await fetch(`https://${API_HOST}/v3/standings?league=197&season=${year}`, {
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST
      }
    });

    const data = await res.json();
    if (!data.response || !data.response[0]) return;

    const standings = data.response[0].league.standings[0];
    const tbody = document.getElementById('standings-body');
    if (!tbody) return;

    tbody.innerHTML = standings.slice(0, 8).map(team => {
      const formDots = (team.form || '').split('').slice(-5).map(f => {
        if (f === 'W') return '<div class="fd fw"></div>';
        if (f === 'D') return '<div class="fd fd2"></div>';
        return '<div class="fd fl"></div>';
      }).join('');

      const rankCls = team.rank <= 3 ? 'top' : team.rank >= 14 ? 'rel' : '';

      return `
        <tr>
          <td class="rank ${rankCls}">${team.rank}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <img src="${team.team.logo}" style="width:20px;height:20px;object-fit:contain" onerror="this.style.display='none'">
              <strong>${team.team.name}</strong>
            </div>
          </td>
          <td>${team.all.played}</td>
          <td>${team.all.win}</td>
          <td>${team.all.draw}</td>
          <td>${team.all.lose}</td>
          <td>${team.all.goals.for}:${team.all.goals.against}</td>
          <td class="pts">${team.points}</td>
          <td><div class="form-dots">${formDots}</div></td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Erreur classement:', err);
  }
}

// Lancer au chargement
document.addEventListener('DOMContentLoaded', () => {
  fetchTodayFixtures();
  fetchStandings();

  // Rafraîchir les scores toutes les 60 secondes
  setInterval(fetchTodayFixtures, 60000);
  // Rafraîchir le classement toutes les 10 minutes
  setInterval(fetchStandings, 600000);
});
