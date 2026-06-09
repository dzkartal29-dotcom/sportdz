const TOKEN = '529336eaf4c8420c95e3dd14bad54d40';
const BASE  = 'https://api.football-data.org/v4';

exports.handler = async (event) => {
  const path = event.queryStringParameters?.path || '/matches';
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'X-Auth-Token': TOKEN }
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
