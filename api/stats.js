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
    const scorerMap = {};
    const teamGoals = {};
    const teamConceded = {};
    let totalMatches = 0;
    let totalGoals = 0;

    // جلب جميع الأيام منذ بداية البطولة
    const start = new Date('2026-06-11');
    const today = new Date();
    const dates = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0].replace(/-/g,''));
    }

    await Promise.allSettled(dates.map(async (dateStr) => {
      try {
        const r = await fetch(
          `${ESPN_BASE}/scoreboard?dates=${dateStr}&limit=50`,
          { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (!r.ok) return;
        const data = await r.json();

        for (const e of (data.events || [])) {
          const comp = e.competitions?.[0];
          if (!comp) continue;

          const status = comp.status?.type?.name || '';
          const state  = comp.status?.type?.state || '';
          // مباريات منتهية فقط
          if (state !== 'post') continue;

          const home = comp.competitors?.find(t => t.homeAway === 'home');
          const away = comp.competitors?.find(t => t.homeAway === 'away');
          if (!home || !away) continue;

          const homeTeam  = home.team?.displayName || '';
          const awayTeam  = away.team?.displayName || '';
          const homeId    = home.team?.id || '';
          const awayId    = away.team?.id || '';
          const homeScore = parseInt(home.score || '0');
          const awayScore = parseInt(away.score || '0');

          totalMatches++;

          // إحصائيات الفرق
          [homeTeam, awayTeam].forEach(t => {
            if (!teamGoals[t])    teamGoals[t]    = { name:t, goals:0, played:0 };
            if (!teamConceded[t]) teamConceded[t] = { name:t, conceded:0, played:0 };
          });
          teamGoals[homeTeam].goals    += homeScore;
          teamGoals[homeTeam].played++;
          teamGoals[awayTeam].goals    += awayScore;
          teamGoals[awayTeam].played++;
          teamConceded[homeTeam].conceded += awayScore;
          teamConceded[homeTeam].played++;
          teamConceded[awayTeam].conceded += homeScore;
          teamConceded[awayTeam].played++;

          // الهدافون من details
          for (const d of (comp.details || [])) {
            if (!d.scoringPlay) continue;
            if (d.ownGoal)      continue;

            const player = d.athletesInvolved?.[0]?.displayName;
            if (!player) continue;

            const teamId   = d.team?.id || '';
            const teamName = teamId === homeId ? homeTeam : awayTeam;

            if (!scorerMap[player]) {
              scorerMap[player] = { name: player, team: teamName, goals: 0 };
            }
            scorerMap[player].goals++;
            totalGoals++;
          }
        }
      } catch(err) {
        console.error('Date error:', dateStr, err.message);
      }
    }));

    const topScorers = Object.values(scorerMap)
      .sort((a,b) => b.goals - a.goals)
      .slice(0, 10);

    const topAttack = Object.values(teamGoals)
      .filter(t => t.played > 0)
      .sort((a,b) => b.goals - a.goals)
      .slice(0, 5);

    const topDefense = Object.values(teamConceded)
      .filter(t => t.played > 0)
      .sort((a,b) => a.conceded - b.conceded)
      .slice(0, 5);

    return res.status(200).json({
      topScorers,
      topAttack,
      topDefense,
      debug: { totalMatches, totalGoals, dates: dates.length },
      timestamp: new Date().toISOString(),
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
