// api/live.js — Widget Live Bar CdM 2026
export const config = { maxDuration: 15 };

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

const FLAGS = {
  'Algeria':'🇩🇿','Argentina':'🇦🇷','Austria':'🇦🇹','Jordan':'🇯🇴',
  'Mexico':'🇲🇽','Brazil':'🇧🇷','France':'🇫🇷','Spain':'🇪🇸',
  'Germany':'🇩🇪','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Morocco':'🇲🇦','USA':'🇺🇸',
  'Canada':'🇨🇦','Portugal':'🇵🇹','Netherlands':'🇳🇱','Croatia':'🇭🇷',
  'Japan':'🇯🇵','Senegal':'🇸🇳','Uruguay':'🇺🇾','Colombia':'🇨🇴',
  'Australia':'🇦🇺','Switzerland':'🇨🇭','Belgium':'🇧🇪','Turkey':'🇹🇷',
  'Türkiye':'🇹🇷','South Korea':'🇰🇷','Ecuador':'🇪🇨','Tunisia':'🇹🇳',
  'Cameroon':'🇨🇲','Ghana':'🇬🇭','Saudi Arabia':'🇸🇦','Iran':'🇮🇷',
  'Italy':'🇮🇹','Norway':'🇳🇴','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Serbia':'🇷🇸',
  'Ukraine':'🇺🇦','Denmark':'🇩🇰','Poland':'🇵🇱','Sweden':'🇸🇪',
  'Ivory Coast':"🇨🇮","Cote d'Ivoire":"🇨🇮",'DR Congo':'🇨🇩',
  'Nigeria':'🇳🇬','Egypt':'🇪🇬','Cape Verde':'🇨🇻','Tanzania':'🇹🇿',
  'Uzbekistan':'🇺🇿','Iraq':'🇮🇶','Panama':'🇵🇦','Jamaica':'🇯🇲',
  'Venezuela':'🇻🇪','Peru':'🇵🇪','Chile':'🇨🇱','Bolivia':'🇧🇴',
  'Paraguay':'🇵🇾','Costa Rica':'🇨🇷','New Zealand':'🇳🇿','Haiti':'🇭🇹',
  'Curaçao':'🇨🇼','Benin':'🇧🇯','Indonesia':'🇮🇩','Qatar':'🇶🇦',
};

function getFlag(name) {
  return FLAGS[name] || '🏳️';
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const espnRes = await fetch(ESPN_BASE, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!espnRes.ok) throw new Error('ESPN down');
    const data = await espnRes.json();
    const events = data.events || [];
    const now = new Date();

    const live = [], upcoming = [], recent = [];

    for (const e of events) {
      const comp = e.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find(t => t.homeAway === 'home');
      const away = comp.competitors?.find(t => t.homeAway === 'away');
      const statusName = comp.status?.type?.name || '';
      const statusState = comp.status?.type?.state || '';
      const clock = comp.status?.displayClock || '';
      const period = comp.status?.period || 0;

      // Buteurs depuis les détails ESPN
      const scorers = [];
      const details = comp.details || [];
      for (const d of details) {
        const typeText = (d.type?.text || '').toLowerCase();
        if (typeText.includes('goal') || typeText.includes('but')) {
          const playerName = d.athletesInvolved?.[0]?.displayName || '';
          const teamName = d.team?.displayName || '';
          const clockVal = d.clock?.displayValue || '';
          if (playerName) {
            scorers.push({
              player: playerName,
              team: teamName,
              clock: clockVal,
              type: d.type?.text || 'But',
            });
          }
        }
      }

      const match = {
        id: e.id,
        homeTeam: home?.team?.displayName || '?',
        homeFlag: getFlag(home?.team?.displayName),
        homeScore: parseInt(home?.score) || 0,
        awayTeam: away?.team?.displayName || '?',
        awayFlag: getFlag(away?.team?.displayName),
        awayScore: parseInt(away?.score) || 0,
        status: statusName,
        clock, period, scorers,
        date: e.date,
        venue: comp.venue?.fullName || comp.venue?.address?.city || '',
        group: comp.notes?.[0]?.headline || e.season?.slug || 'Coupe du Monde 2026',
      };

      // Trier selon l'état ESPN
      if (statusState === 'in' || statusName === 'STATUS_IN_PROGRESS') {
        live.push(match);
      } else if (statusState === 'post' || statusName === 'STATUS_FINAL' || statusName === 'STATUS_FULL_TIME') {
        recent.push(match);
      } else {
        // pre = à venir
        upcoming.push(match);
      }
    }

    // Trier upcoming par date
    upcoming.sort((a,b) => new Date(a.date) - new Date(b.date));
    // Trier recent par date décroissante
    recent.sort((a,b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      live,
      upcoming,
      recent: recent.slice(0,3),
      nextAlgeria: {
        homeTeam: 'Algeria', homeFlag: '🇩🇿',
        awayTeam: 'Argentina', awayFlag: '🇦🇷',
        date: '2026-06-16T02:00:00Z',
        venue: 'Arrowhead Stadium, Kansas City',
        group: 'Groupe J',
      },
      timestamp: now.toISOString(),
    });

  } catch(e) {
    // Fallback statique
    return res.status(200).json({
      live: [], upcoming: [], recent: [],
      nextAlgeria: {
        homeTeam: 'Algeria', homeFlag: '🇩🇿',
        awayTeam: 'Argentina', awayFlag: '🇦🇷',
        date: '2026-06-16T02:00:00Z',
        venue: 'Arrowhead Stadium, Kansas City',
        group: 'Groupe J',
      },
      timestamp: new Date().toISOString(),
      error: e.message,
    });
  }
}
