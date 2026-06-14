// api/live.js — Widget Live CdM 2026
// Données en direct depuis openfootball + ESPN
export const config = { maxDuration: 15 };

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const WC_SLUG = 'fifa.world';

const FLAGS = {
  'Algeria':'🇩🇿','Argentina':'🇦🇷','Austria':'🇦🇹','Jordan':'🇯🇴',
  'Mexico':'🇲🇽','Brazil':'🇧🇷','France':'🇫🇷','Spain':'🇪🇸',
  'Germany':'🇩🇪','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Morocco':'🇲🇦','USA':'🇺🇸',
  'Canada':'🇨🇦','Portugal':'🇵🇹','Netherlands':'🇳🇱','Croatia':'🇭🇷',
  'Japan':'🇯🇵','Senegal':'🇸🇳','Uruguay':'🇺🇾','Colombia':'🇨🇴',
  'South Korea':'🇰🇷','Australia':'🇦🇺','Switzerland':'🇨🇭','Belgium':'🇧🇪',
  'Poland':'🇵🇱','Denmark':'🇩🇰','Serbia':'🇷🇸','Ecuador':'🇪🇨',
  'Tunisia':'🇹🇳','Cameroon':'🇨🇲','Ghana':'🇬🇭','Costa Rica':'🇨🇷',
  'Saudi Arabia':'🇸🇦','Qatar':'🇶🇦','Iran':'🇮🇷','Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','New Zealand':'🇳🇿','Panama':'🇵🇦','Jamaica':'🇯🇲',
  'Italy':'🇮🇹','Norway':'🇳🇴','Turkey':'🇹🇷','Ukraine':'🇺🇦',
  'Sweden':'🇸🇪','Chile':'🇨🇱','Peru':'🇵🇪','Bolivia':'🇧🇴',
  'Venezuela':'🇻🇪','Paraguay':'🇵🇾','Ivory Coast':'🇨🇮','DR Congo':'🇨🇩',
  'Nigeria':'🇳🇬','Egypt':'🇪🇬','Cape Verde':'🇨🇻','Tanzania':'🇹🇿',
  'Uzbekistan':'🇺🇿','Iraq':'🇮🇶','Benin':'🇧🇯','Curaçao':'🇨🇼',
  'Ghana':'🇬🇭','Haiti':'🇭🇹','New Caledonia':'🇳🇨','Indonesia':'🇮🇩',
};

function getFlag(name) { return FLAGS[name] || '🏳️'; }

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Essayer ESPN pour les matchs en direct
    const liveData = await fetchESPNLive();
    return res.status(200).json(liveData);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

async function fetchESPNLive() {
  try {
    const res = await fetch(`${ESPN_BASE}/${WC_SLUG}/scoreboard`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error('ESPN unavailable');
    const data = await res.json();
    const events = data.events || [];

    const now = new Date();
    const liveMatches = [];
    const recentMatches = [];
    const upcomingMatches = [];

    for (const e of events) {
      const comp = e.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find(t => t.homeAway === 'home');
      const away = comp.competitors?.find(t => t.homeAway === 'away');
      const status = comp.status?.type?.name;
      const clock = comp.status?.displayClock || '';
      const period = comp.status?.period || 0;

      // Extraire les buteurs
      const scorers = [];
      const details = comp.details || [];
      for (const d of details) {
        if (d.type?.text?.toLowerCase().includes('goal') ||
            d.type?.text?.toLowerCase().includes('but')) {
          scorers.push({
            player: d.athletesInvolved?.[0]?.displayName || 'Joueur',
            team: d.team?.displayName || '',
            clock: d.clock?.displayValue || '',
            type: d.type?.text || 'But',
          });
        }
      }

      const match = {
        id: e.id,
        homeTeam: home?.team?.displayName || '?',
        homeFlag: getFlag(home?.team?.displayName),
        homeScore: home?.score ?? null,
        homeLogo: home?.team?.logo || null,
        awayTeam: away?.team?.displayName || '?',
        awayFlag: getFlag(away?.team?.displayName),
        awayScore: away?.score ?? null,
        awayLogo: away?.team?.logo || null,
        status, clock, period, scorers,
        date: e.date,
        venue: comp.venue?.fullName || '',
        group: comp.notes?.[0]?.headline || 'Coupe du Monde 2026',
      };

      if (status === 'STATUS_IN_PROGRESS') liveMatches.push(match);
      else if (status === 'STATUS_FINAL') recentMatches.push(match);
      else upcomingMatches.push(match);
    }

    // Prochain match Algérie
    const nextAlgeria = {
      homeTeam: 'Algeria',
      homeFlag: '🇩🇿',
      awayTeam: 'Argentina',
      awayFlag: '🇦🇷',
      date: '2026-06-16T02:00:00Z', // 21h00 ET = 02h00 Algérie
      venue: 'Arrowhead Stadium, Kansas City',
      group: 'Groupe J',
    };

    return {
      live: liveMatches,
      recent: recentMatches.slice(0, 5),
      upcoming: upcomingMatches.slice(0, 10),
      nextAlgeria,
      timestamp: now.toISOString(),
    };

  } catch {
    // Fallback avec données statiques si ESPN down
    return {
      live: [],
      recent: [],
      upcoming: [],
      nextAlgeria: {
        homeTeam: 'Algeria',
        homeFlag: '🇩🇿',
        awayTeam: 'Argentina',
        awayFlag: '🇦🇷',
        date: '2026-06-16T02:00:00Z',
        venue: 'Arrowhead Stadium, Kansas City',
        group: 'Groupe J',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
