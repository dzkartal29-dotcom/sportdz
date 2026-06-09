// Netlify Function — Proxy Direct & Transparent pour ESPN (Anti-CORS)
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const action = event.queryStringParameters?.action || 'scores';
  const code = event.queryStringParameters?.code || 'eng.1'; // ex: fra.1, esp.1, etc.

  // Mapping des codes si ton frontend envoie les anciens tags (Ligue 1, La Liga...)
  let leagueSlug = code;
  if (code === 'PL' || code === 'premier-league') leagueSlug = 'eng.1';
  if (code === 'FL1' || code === 'ligue-1') leagueSlug = 'fra.1';
  if (code === 'BL1' || code === 'bundesliga') leagueSlug = 'ger.1';
  if (code === 'SA' || code === 'serie-a') leagueSlug = 'ita.1';
  if (code === 'PD' || code === 'la-liga') leagueSlug = 'esp.1';

  try {
    let url = '';

    if (action === 'scores' || action === 'upcoming') {
      // Endpoint officiel et complet d'ESPN pour le calendrier et les scores
      url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/scoreboard?limit=100`;
    } 
    else if (action === 'standings') {
      // Endpoint officiel d'ESPN pour les classements
      url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/standings`;
    } 
    else if (action === 'articles') {
      // Flux d'actualités général combiné (simulé ou via les news de la ligue principale)
      url = `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=5`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API a répondu avec un statut: ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: error.message, phase: action })
    };
  }
};
