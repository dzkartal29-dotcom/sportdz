// api/stats.js — Statistiques CdM 2026
// Buteurs, meilleures attaques, meilleures défenses
export const config = { maxDuration: 15 };

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Récupérer tous les matchs terminés du tournoi
    const [scoresRes, standingsRes] = await Promise.all([
      fetch(`${ESPN_BASE}/scoreboard?limit=100`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }),
      fetch(`${ESPN_BASE}/standings`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
    ]);

    const scoreboard = await scoresRes.json();
    const events = scoreboard.events || [];

    // Construire la map des buteurs depuis tous les matchs
    const scorerMap = {};

    for (const e of events) {
      const comp = e.competitions?.[0];
      if (!comp) continue;
      const statusName = comp.status?.type?.name || '';
      // Seulement les matchs terminés
      if (statusName !== 'STATUS_FINAL' && statusName !== 'STATUS_FULL_TIME') continue;

      const home = comp.competitors?.find(t => t.homeAway === 'home');
      const away = comp.competitors?.find(t => t.homeAway === 'away');

      const details = comp.details || [];
      for (const d of details) {
        const typeText = (d.type?.text || '').toLowerCase();
        if (!typeText.includes('goal')) continue;
        // Ignorer les buts contre son camp
        if (typeText.includes('own')) continue;

        const playerName = d.athletesInvolved?.[0]?.displayName;
        if (!playerName) continue;

        const teamName = d.team?.displayName || '';
        const isHome = home?.team?.displayName === teamName;
        const teamFlag = isHome ? home?.team?.displayName : away?.team?.displayName;

        if (!scorerMap[playerName]) {
          scorerMap[playerName] = {
            name: playerName,
            team: teamName,
            goals: 0,
          };
        }
        scorerMap[playerName].goals++;
      }
    }

    // Trier les buteurs
    const topScorers = Object.values(scorerMap)
      .sort((a,b) => b.goals - a.goals)
      .slice(0, 10);

    return res.status(200).json({
      topScorers,
      timestamp: new Date().toISOString(),
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
