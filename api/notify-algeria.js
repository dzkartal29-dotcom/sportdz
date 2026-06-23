// api/notify-algeria.js — Notifications push Algérie
export const config = { maxDuration: 15 };

const ONESIGNAL_APP_ID = '123c4bc1-b60b-4f14-93e0-a8c3b066db28';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const CORS = { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' };

const ALGERIA_MATCHES = [
  { date: new Date('2026-06-17T02:00:00Z'), opp:'الأرجنتين' },
  { date: new Date('2026-06-22T02:00:00Z'), opp:'النمسا'    },
  { date: new Date('2026-06-26T02:00:00Z'), opp:'الأردن'    },
];

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  const now = new Date();

  const upcoming = ALGERIA_MATCHES.find(m => { const d=m.date-now; return d>0&&d<=3600000; });
  const started  = ALGERIA_MATCHES.find(m => { const d=now-m.date; return d>=0&&d<=300000; });
  if(!upcoming && !started) return res.status(200).json({ message:'لا مباريات قريبة', sent:false });

  const match = upcoming || started;
  const isStarted = !!started;

  try {
    const r = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Basic ${ONESIGNAL_API_KEY}` },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { ar: isStarted ? '🔴 المباراة بدأت!' : '⏰ المباراة تبدأ قريباً!' },
        contents: { ar: isStarted
          ? `🇩🇿 الجزائر ضد ${match.opp} — تابع الآن على MXP Sport`
          : `🇩🇿 الجزائر ضد ${match.opp} تبدأ خلال ساعة!` },
        url: 'https://sportdz.vercel.app/#scores',
        chrome_web_icon: 'https://sportdz.vercel.app/mxp-logo.png',
      }),
    });
    const data = await r.json();
    return res.status(200).json({ sent:true, data });
  } catch(e) {
    return res.status(500).json({ error:e.message });
  }
}
