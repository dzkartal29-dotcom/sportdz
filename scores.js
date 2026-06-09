// ============================================
// SportDZ — via Netlify Function proxy
// ============================================

const PROXY = '/.netlify/functions/api';

const LEAGUES = [
  { code: 'PL',  id: 2021, name: 'Premier League',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'PD',  id: 2014, name: 'La Liga',          flag: '🇪🇸' },
  { code: 'BL1', id: 2002, name: 'Bundesliga',       flag: '🇩🇪' },
  { code: 'SA',  id: 2019, name: 'Serie A',          flag: '🇮🇹' },
  { code: 'FL1', id: 2015, name: 'Ligue 1',          flag: '🇫🇷' },
  { code: 'PPL', id: 2017, name: 'Primeira Liga',    flag: '🇵🇹' },
  { code: 'CL',  id: 2001, name: 'Champions League', flag: '🏆' },
];

async function api(path) {
  const res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fmtTime(d) {
  try { return new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Algiers'}); }
  catch(e){ return '--:--'; }
}
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short',timeZone:'Africa/Algiers'}); }
  catch(e){ return ''; }
}
function crest(url, size=32) {
  if (!url) return `<div style="width:${size}px;height:${size}px;background:var(--card2);border-radius:50%;display:flex;align-items:center;justify-content:center">⚽</div>`;
  return `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.outerHTML='<span>⚽</span>'">`;
}
function stateHTML(icon, fr, ar) {
  const spin = icon==='spinner';
  return `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--muted)">
    ${spin?'<div class="spinner" style="margin:0 auto 14px;width:32px;height:32px;border-width:3px"></div>':`<div style="font-size:40px;margin-bottom:12px">${icon}</div>`}
    <div style="font-size:14px">${fr}</div>
    ${ar?`<div class="ar" style="font-size:12px;margin-top:4px">${ar}</div>`:''}
  </div>`;
}
function statusInfo(status) {
  if (status==='IN_PLAY') return {label:'🔴 EN DIRECT',cls:'live'};
  if (status==='PAUSED')  return {label:'⏸ Mi-temps',cls:'live'};
  if (status==='FINISHED')return {label:'Terminé',cls:'finished'};
  return {label:'À venir',cls:'upcoming'};
}

// ── SCORES ────────────────────────────────────────
async function fetchScores() {
  const el = document.getElementById('scores-container');
  if (!el) return;
  el.innerHTML = stateHTML('spinner','Chargement des scores...','جاري تحميل النتائج...');
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await api(`/matches?dateFrom=${today}&dateTo=${today}`);
    const matches = data.matches || [];
    if (!matches.length) { el.innerHTML = stateHTML('📅','Aucun match aujourd\'hui','لا توجد مباريات اليوم'); return; }

    const order = {IN_PLAY:0,PAUSED:1,TIMED:2,SCHEDULED:2,FINISHED:3};
    matches.sort((a,b)=>(order[a.status]??4)-(order[b.status]??4));

    el.innerHTML = matches.slice(0,12).map(m => {
      const st = statusInfo(m.status);
      const lg = LEAGUES.find(l=>l.id===m.competition?.id);
      const gh = m.score?.fullTime?.home ?? '-';
      const ga = m.score?.fullTime?.away ?? '-';
      const scoreOrTime = st.cls==='upcoming' ? fmtTime(m.utcDate) : `${gh} - ${ga}`;
      return `
        <div class="score-card animate-in">
          <div class="score-league">${lg?.flag||'⚽'} ${m.competition?.name||'Football'}</div>
          <div class="score-match">
            <div class="team">
              <div class="team-logo">${crest(m.homeTeam?.crest)}</div>
              <div class="team-name">${m.homeTeam?.shortName||m.homeTeam?.name}</div>
            </div>
            <div class="score-center">
              <div class="score-num">${scoreOrTime}</div>
              <span class="score-time ${st.cls}">${st.label}</span>
              ${st.cls==='upcoming'?`<div class="match-date">${fmtDate(m.utcDate)}</div>`:''}
            </div>
            <div class="team">
              <div class="team-logo">${crest(m.awayTeam?.crest)}</div>
              <div class="team-name">${m.awayTeam?.shortName||m.awayTeam?.name}</div>
            </div>
          </div>
        </div>`;
    }).join('');
    updateTicker(matches);
  } catch(e) {
    el.innerHTML = stateHTML('⚠️',`Erreur: ${e.message}`,'');
    setTimeout(fetchScores,30000);
  }
}

// ── PROCHAINS MATCHS ──────────────────────────────
let upcomingData = {};
async function fetchUpcoming() {
  const el=document.getElementById('upcoming-container');
  const tabsEl=document.getElementById('upcoming-tabs');
  if(!el||!tabsEl) return;
  try {
    const from=new Date(); from.setDate(from.getDate()+1);
    const to=new Date(); to.setDate(to.getDate()+7);
    const data = await api(`/matches?dateFrom=${from.toISOString().split('T')[0]}&dateTo=${to.toISOString().split('T')[0]}`);
    const matches = data.matches||[];
    upcomingData={};
    matches.forEach(m=>{
      const cid=m.competition?.id;
      if(!upcomingData[cid]) upcomingData[cid]=[];
      upcomingData[cid].push(m);
    });
    const avail=LEAGUES.filter(l=>upcomingData[l.id]?.length);
    if(!avail.length){tabsEl.innerHTML='';el.innerHTML=stateHTML('📅','Aucun match à venir','');return;}
    tabsEl.innerHTML=avail.map((l,i)=>`
      <button class="league-tab ${i===0?'active':''}" onclick="switchUpcoming(${l.id},this)">
        ${l.flag} ${l.name}
      </button>`).join('');
    renderUpcoming(avail[0].id);
    clearInterval(window._upInt);
    let idx=0;
    window._upInt=setInterval(()=>{
      idx=(idx+1)%avail.length;
      tabsEl.querySelectorAll('.league-tab').forEach(t=>t.classList.remove('active'));
      tabsEl.querySelectorAll('.league-tab')[idx]?.classList.add('active');
      renderUpcoming(avail[idx].id);
    },8000);
  } catch(e){el.innerHTML=stateHTML('⚠️','Erreur chargement','');}
}
window.switchUpcoming=function(lid,btn){
  clearInterval(window._upInt);
  document.querySelectorAll('#upcoming-tabs .league-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderUpcoming(lid);
};
function renderUpcoming(lid){
  const el=document.getElementById('upcoming-container');
  const fixtures=(upcomingData[lid]||[]).slice(0,6);
  if(!fixtures.length){el.innerHTML=stateHTML('📅','Aucun match','');return;}
  el.innerHTML=`<div class="upcoming-list">${fixtures.map(m=>`
    <div class="upcoming-item animate-in">
      <div class="upcoming-date">
        <div class="upd-day">${fmtDate(m.utcDate)}</div>
        <div class="upd-time">⏰ ${fmtTime(m.utcDate)}</div>
      </div>
      <div class="upcoming-match">
        <div class="upm-team">${crest(m.homeTeam?.crest,26)}<span>${m.homeTeam?.shortName||m.homeTeam?.name}</span></div>
        <div class="upm-vs">VS</div>
        <div class="upm-team right"><span>${m.awayTeam?.shortName||m.awayTeam?.name}</span>${crest(m.awayTeam?.crest,26)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ── CLASSEMENTS ───────────────────────────────────
let standingsCache={};
async function fetchAllStandings(){
  const tabsEl=document.getElementById('standings-tabs');
  if(!tabsEl) return;
  const lg=LEAGUES.filter(l=>l.code!=='CL');
  tabsEl.innerHTML=lg.map((l,i)=>`
    <button class="league-tab ${i===0?'active':''}" onclick="switchStandings('${l.code}',this)">
      ${l.flag} ${l.name}
    </button>`).join('');
  await loadStandings(lg[0].code);
  clearInterval(window._stInt);
  let idx=0;
  window._stInt=setInterval(async()=>{
    idx=(idx+1)%lg.length;
    tabsEl.querySelectorAll('.league-tab').forEach(t=>t.classList.remove('active'));
    tabsEl.querySelectorAll('.league-tab')[idx]?.classList.add('active');
    await loadStandings(lg[idx].code);
  },10000);
}
window.switchStandings=async function(code,btn){
  clearInterval(window._stInt);
  document.querySelectorAll('#standings-tabs .league-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  await loadStandings(code);
};
async function loadStandings(code){
  const tbody=document.getElementById('standings-body');
  if(!tbody) return;
  if(standingsCache[code]){renderStandings(standingsCache[code]);return;}
  tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto;width:28px;height:28px;border-width:2px"></div></td></tr>`;
  try {
    const data=await api(`/competitions/${code}/standings`);
    const table=data.standings?.find(s=>s.type==='TOTAL')?.table||[];
    if(!table.length) throw new Error('Pas de données');
    standingsCache[code]=table;
    renderStandings(table);
  } catch(e){
    tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--red)">${e.message}</td></tr>`;
  }
}
function renderStandings(table){
  const tbody=document.getElementById('standings-body');
  const top3El=document.getElementById('top-scorers-container');
  if(!tbody) return;
  const total=table.length;
  tbody.innerHTML=table.slice(0,10).map(t=>{
    const rankCls=t.position<=3?'top':t.position>=total-2?'rel':'';
    const form=(t.form||'').split(',').slice(-5).map(f=>
      f==='W'?'<div class="fd fw"></div>':f==='D'?'<div class="fd fd2"></div>':'<div class="fd fl"></div>'
    ).join('');
    return `
      <tr class="animate-in ${t.position<=3?'highlight':''}">
        <td class="rank ${rankCls}">${t.position}</td>
        <td><div style="display:flex;align-items:center;gap:8px">${crest(t.team?.crest,22)}<strong>${t.team?.shortName||t.team?.name}</strong></div></td>
        <td>${t.playedGames}</td><td>${t.won}</td><td>${t.draw}</td><td>${t.lost}</td>
        <td>${t.goalsFor}:${t.goalsAgainst}</td>
        <td class="pts">${t.points}</td>
        <td><div class="form-dots">${form}</div></td>
      </tr>`;
  }).join('');
  if(top3El&&table.length>=3){
    const topAtk=[...table].sort((a,b)=>b.goalsFor-a.goalsFor).slice(0,3);
    const topDef=[...table].sort((a,b)=>a.goalsAgainst-b.goalsAgainst).slice(0,3);
    top3El.innerHTML=`
      <div class="top3-title">⚽ Top 3 Meilleures Attaques</div>
      ${topAtk.map((t,i)=>`
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${crest(t.team?.crest,28)}
          <div class="top3-info"><div class="top3-name">${t.team?.shortName||t.team?.name}</div><div class="top3-stat">${t.goalsFor} buts</div></div>
          <div class="top3-num">${t.goalsFor}</div>
        </div>`).join('')}
      <div class="top3-title" style="margin-top:14px">🛡️ Top 3 Meilleures Défenses</div>
      ${topDef.map((t,i)=>`
        <div class="top3-item animate-in">
          <div class="top3-rank">${['🥇','🥈','🥉'][i]}</div>
          ${crest(t.team?.crest,28)}
          <div class="top3-info"><div class="top3-name">${t.team?.shortName||t.team?.name}</div><div class="top3-stat">${t.goalsAgainst} encaissés</div></div>
          <div class="top3-num">${t.goalsAgainst}</div>
        </div>`).join('')}`;
  }
}

// ── ARTICLES ──────────────────────────────────────
async function fetchArticles(){
  const el=document.getElementById('articles-container');
  if(!el) return;
  try {
    const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
    const d=yesterday.toISOString().split('T')[0];
    const data=await api(`/matches?dateFrom=${d}&dateTo=${d}&status=FINISHED`);
    const matches=(data.matches||[]).slice(0,4);
    if(!matches.length) return;
    const cats=['Résultats','Analyse','Ligue 1','Champions'];
    const icons=['⚽','🏆','🎯','📊'];
    el.innerHTML=matches.map((m,i)=>{
      const gh=m.score?.fullTime?.home??0;
      const ga=m.score?.fullTime?.away??0;
      const score=`${gh} - ${ga}`;
      const winner=gh>ga?m.homeTeam?.name:ga>gh?m.awayTeam?.name:null;
      const title=winner?`${winner} s'impose (${score})`:`Match nul (${score}) — ${m.homeTeam?.name} vs ${m.awayTeam?.name}`;
      return `
        <div class="article-card animate-in">
          <div class="article-img">
            <div class="article-cat">${cats[i%cats.length]}</div>
            <div style="font-size:48px">${icons[i%icons.length]}</div>
          </div>
          <div class="article-body">
            <div class="article-title">${title}</div>
            <div class="article-title-ar ar">${m.homeTeam?.name} ${score} ${m.awayTeam?.name}</div>
            <div class="article-meta"><span>⏱ Hier</span><span>🏟️ ${m.competition?.name}</span></div>
          </div>
        </div>`;
    }).join('');
  } catch(e){ console.error('Articles:',e); }
}

// ── TICKER ────────────────────────────────────────
function updateTicker(matches){
  const ticker=document.getElementById('ticker');
  if(!ticker||!matches.length) return;
  const items=matches.slice(0,10).map(m=>{
    const gh=m.score?.fullTime?.home;
    const score=(gh!==null&&gh!==undefined)?`${gh} - ${m.score?.fullTime?.away}`:fmtTime(m.utcDate);
    return `<span class="ticker-item">${m.homeTeam?.shortName||m.homeTeam?.name} — ${m.awayTeam?.shortName||m.awayTeam?.name} <span class="ticker-score">${score}</span></span>`;
  });
  ticker.innerHTML=[...items,...items].join('');
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  fetchScores();
  fetchUpcoming();
  fetchAllStandings();
  fetchArticles();
  setInterval(fetchScores,60000);
  setInterval(fetchUpcoming,300000);
});
