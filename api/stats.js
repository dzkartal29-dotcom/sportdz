// api/stats.js — إحصائيات كأس العالم 2026
export const config = { maxDuration: 30 };

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. جلب قائمة المباريات
    const sbRes = await fetch(`${ESPN_BASE}/scoreboard?limit=100`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const sbData = await sbRes.json();
    const events = sbData.events || [];

    // 2. تصفية المباريات المنتهية فقط
    const finished = events.filter(e => {
      const status = e.competitions?.[0]?.status?.type?.name || '';
      return status === 'STATUS_FINAL' || status === 'STATUS_FULL_TIME';
    });

    // 3. جلب تفاصيل كل مباراة بالتوازي
    const scorerMap = {};

    await Promise.allSettled(finished.map(async (e) => {
      try {
        const detailRes = await fetch(`${ESPN_BASE}/summary?event=${e.id}`, {
          signal: AbortSignal.timeout(6000),
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!detailRes.ok) return;
        const detail = await detailRes.json();

        // من scoring plays
        const plays = detail.scoringPlays || [];
        plays.forEach(p => {
          const typeText = (p.type?.text || '').toLowerCase();
          if (typeText.includes('own goal')) return;

          const playerName = p.participants?.[0]?.athlete?.displayName
                          || p.scoringPlay?.athlete?.displayName;
          if (!playerName) return;

          const teamName = p.team?.displayName || '';

          if (!scorerMap[playerName]) {
            scorerMap[playerName] = { name: playerName, team: teamName, goals: 0 };
          }
          scorerMap[playerName].goals++;
        });

        // من game details أيضاً
        const gameDetail = detail.gameDetails || [];
        gameDetail.forEach(d => {
          const typeText = (d.type?.text || '').toLowerCase();
          if (!typeText.includes('goal') || typeText.includes('own')) return;
          const playerName = d.athletesInvolved?.[0]?.displayName;
          if (!playerName) return;
          const teamName = d.team?.displayName || '';
          if (!scorerMap[playerName]) {
            scorerMap[playerName] = { name: playerName, team: teamName, goals: 0 };
          }
          scorerMap[playerName].goals++;
        });

      } catch {}
    }));

    // 4. ترتيب الهدافين
    const topScorers = Object.values(scorerMap)
      .filter(s => s.goals > 0)
      .sort((a,b) => b.goals - a.goals)
      .slice(0, 10);

    return res.status(200).json({
      topScorers,
      matchesAnalyzed: finished.length,
      timestamp: new Date().toISOString(),
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
