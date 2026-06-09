// SportDZ — Juin 2026 = Coupe du Monde 2026
const PROXY = '/api/proxy';

const LEAGUES_FD = [
  { code:'PL',  name:'Premier League',  flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code:'PD',  name:'La Liga',          flag:'🇪🇸' },
  { code:'BL1', name:'Bundesliga',       flag:'🇩🇪' },
  { code:'SA',  name:'Serie A',          flag:'🇮🇹' },
  { code:'FL1', name:'Ligue 1',          flag:'🇫🇷' },
  { code:'PPL', name:'Primeira Liga',    flag:'🇵🇹' },
];

async function api(action, extra='') {
  const res = await fetch(`${PROXY}?action=${action}${extra}`);
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
  if (!url) return `<div style="width:${size}px;height:${size}px;background:var(--card2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.5)}px">⚽</div>`;
  return `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.outerHTML='<span style=font-size:16px>⚽</span>'">`;
}
function stateHTML(icon, fr, ar) {
  const spin = icon==='spinner';
  return `<div style="grid-column:1/-1;text-align:center;padding:40px 24px;color:var(--muted)">
    ${spin?'<div class="spinner" style="margin:0 auto 14px;width:32px;height:32px;border-width:3px"></div>':`<div style="font-size:36px;margin-bottom:10px">${icon}</div>`}
    <div style="font-size:13px">${fr}</div>
    ${ar?`<div class="ar" style="font-size:12px;margin-top:4px">${ar}</div>`:''}
  </div>`;
}

// ── SCORES DU JOUR ────────────────────────────────
let scoresData = {};

async function fetchScores() {
  const el     = document.getElementById('scores-container');
  const tabsEl = document.getElementById('scores-tabs');
  if (!el) return;
  el.innerHTML = stateHTML('spinner','Chargement des scores...','جاري تحميل النتائج...');

  try {
    const data = await api('scores');
    const all  = data.matches || [];

    // Séparer live/terminés des à venir
    const played   = all.filter(m => m.status==='STATUS_FINAL'||m.status==='STATUS_IN_PROGRESS'||m.status==='STATUS_HALFTIME');
    const upcoming = all.filter(m => m.status==='STATUS_SCHEDULED'||m.status==='STATUS_TIMED');

    // Grouper par ligue — priorité matchs joués, sinon à venir
    scoresData = {};
    (played.length ? played : upcoming).forEach(m => {
      const k = m.league||'Autres';
      if (!scoresData[k]) scoresData[k]=[];
      scoresData[k].push(m);
    });

    const leagues = Object.keys(scoresData);
    if (!leagues.length) {
      if (tabsEl) tabsEl.innerHTML='';
      el.innerHTML = stateHTML('📅','Aucun match aujourd\'hui','لا توجد مباريات اليوم');
      return;
    }

    if (tabsEl) {
      tabsEl.innerHTML = leagues.map((lg,i) => `
        <button class="league-tab ${i===0?'active':''}" onclick="switchScores('${lg.replace(/'/g,"\\'")}',this)">
          ${scoresData[lg][0]?.leagueFlag||'⚽'} ${lg}
        </button>`).join('');
    }

    renderScores(leagues[0]);
    clearInterval(window._scInt);
    let idx=0;
    window._scInt=setInterval(()=>{
      // Ignorer les ligues vides
      idx=(idx+1)%leagues.length;
      if (tabsEl) {
        tabsEl.querySelectorAll('.league-tab').forEach(t=>t.classList.remove('active'));
        tabsEl.querySelectorAll('.league-tab')[idx]?.classList.add('active');
      }
      renderScores(leagues[idx]);
    },7000);

    updateTicker(all);
  } catch(e) {
    console.error('Scores:',e);
    el.innerHTML=stateHTML('⚠️',`Erreur: ${e.message}`,'');
    setTimeout(fetchScores,30000);
  }
}

window.switchScores=function(league,btn){
  clearInterval(window._scInt);
  document.querySelectorAll('#scores-tabs .league-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderScores(league);
};

function renderScores(league){
  const el=document.getElementById('scores-container');
  const matches=scoresData[league]||[];
  if(!matches.length){el.innerHTML=stateHTML('📅','Aucun match pour cette ligue','');return;}

  el.innerHTML=`<div class="grid-3">${matches.map(m=>{
    const isLive     = m.status==='STATUS_IN_PROGRESS'||m.status==='STATUS_HALFTIME';
    const isFinished = m.status==='STATUS_FINAL';
    const isUpcoming = !isLive&&!isFinished;
    const cls   = isLive?'live':isFinished?'finished':'upcoming';
    const label = isLive?`🔴 ${m.clock||'LIVE'}`:isFinished?'Terminé':'À venir';
    const scoreOrTime = isUpcoming?fmtTime(m.date):`${m.homeScore??0} - ${m.awayScore??0}`;
    return `
      <div class="score-card animate-in">
        <div class="score-league">${m.leagueFlag||'⚽'} ${m.league||'Football'}</div>
        <div class="score-match">
          <div class="team">
            <div class="team-logo">${crest(m.homeLogo)}</div>
            <div class="team-name">${m.homeShort||m.homeTeam}</div>
          </div>
          <div class="score-center">
            <div class="score-num">${scoreOrTime}</div>
            <span class="score-time ${cls}">${label}</span>
            ${isUpcoming?`<div class="match-date">${fmtDate(m.date)}</div>`:''}
          </div>
          <div class="team">
            <div class="team-logo">${crest(m.awayLogo)}</div>
            <div class="team-name">${m.awayShort||m.awayTeam}</div>
          </div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ── PROCHAINS MATCHS ──────────────────────────────
let upcomingData={};

async function fetchUpcoming(){
  const el=document.getElementById('upcoming-container');
  const tabsEl=document.getElementById('upcoming-tabs');
  if(!el||!tabsEl) return;
  el.innerHTML=stateHTML('spinner','Chargement des prochains matchs...','');
  try{
    const data=await api('upcoming');
    const matches=data.matches||[];

    upcomingData={};
    matches.forEach(m=>{
      const k=m.league||'Autres';
      if(!upcomingData[k]) upcomingData[k]=[];
      upcomingData[k].push(m);
    });

    // Supprimer les ligues vides
    Object.keys(upcomingData).forEach(k=>{
      if(!upcomingData[k].length) delete upcomingData[k];
    });

    const leagues=Object.keys(upcomingData);
    if(!leagues.length){
      tabsEl.innerHTML='';
      el.innerHTML=stateHTML('📅','Aucun match à venir dans les 7 prochains jours','لا توجد مباريات قادمة');
      return;
    }

    tabsEl.innerHTML=leagues.map((lg,i)=>`
      <button class="league-tab ${i===0?'active':''}" onclick="switchUpcoming('${lg.replace(/'/g,"\\'")}',this)">
        ${upcomingData[lg][0]?.leagueFlag||'⚽'} ${lg}
      </button>`).join('');

    renderUpcoming(leagues[0]);
    clearInterval(window._upInt);
    let idx=0;
    window._upInt=setInterval(()=>{
      idx=(idx+1)%leagues.length;
      tabsEl.querySelectorAll('.league-tab').forEach(t=>t.classList.remove('active'));
      tabsEl.querySelectorAll('.league-tab')[idx]?.classList.add('active');
      renderUpcoming(leagues[idx]);
    },8000);
  }catch(e){
    el.innerHTML=stateHTML('⚠️','Erreur chargement','');
  }
}

window.switchUpcoming=function(league,btn){
  clearInterval(window._upInt);
  document.querySelectorAll('#upcoming-tabs .league-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderUpcoming(league);
};

function renderUpcoming(league){
  const el=document.getElementById('upcoming-container');
  const fixtures=(upcomingData[league]||[]).slice(0,6);
  if(!fixtures.length){el.innerHTML=stateHTML('📅','Aucun match à venir','');return;}
  el.innerHTML=`<div class="upcoming-list">${fixtures.map(m=>`
    <div class="upcoming-item animate-in">
      <div class="upcoming-date">
        <div class="upd-day">${fmtDate(m.date)}</div>
        <div class="upd-time">⏰ ${fmtTime(m.date)}</div>
      </div>
      <div class="upcoming-match">
        <div class="upm-team">${crest(m.homeLogo,26)}<span>${m.homeShort||m.homeTeam||'?'}</span></div>
        <div class="upm-vs">VS</div>
        <div class="upm-team right"><span>${m.awayShort||m.awayTeam||'?'}</span>${crest(m.awayLogo,26)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ── CLASSEMENTS ───────────────────────────────────
let standingsCache={};

async function fetchAllStandings(){
  const tabsEl=document.getElementById('standings-tabs');
  if(!tabsEl) return;
  tabsEl.innerHTML=LEAGUES_FD.map((l,i)=>`
    <button class="league-tab ${i===0?'active':''}" onclick="switchStandings('${l.code}',this)">
      ${l.flag} ${l.name}
    </button>`).join('');
  await loadStandings(LEAGUES_FD[0].code);
  clearInterval(window._stInt);
  let idx=0;
  window._stInt=setInterval(async()=>{
    idx=(idx+1)%LEAGUES_FD.length;
    const tabs=tabsEl.querySelectorAll('.league-tab');
    tabs.forEach(t=>t.classList.remove('active'));
    tabs[idx]?.classList.add('active');
    await loadStandings(LEAGUES_FD[idx].code);
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
  tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:24px">
    <div class="spinner" style="margin:0 auto;width:28px;height:28px;border-width:2px"></div>
  </td></tr>`;
  try{
    const data=await api('standings',`&code=${code}`);
    const table=data.standings?.find(s=>s.type==='TOTAL')?.table||[];
    if(!table.length) throw new Error('Saison terminée — données indisponibles');
    standingsCache[code]=table;
    renderStandings(table);
  }catch(e){
    tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted);font-size:13px">
      📅 ${e.message}
    </td></tr>`;
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

// ── ARTICLES — contenu réel pour AdSense ─────────
async function fetchArticles(){
  const el=document.getElementById('articles-container');
  if(!el) return;
  try{
    const data=await api('articles');
    const matches=data.matches||[];

    if(!matches.length){
      // Articles de secours basés sur la Coupe du Monde 2026
      el.innerHTML=generateFallbackArticles();
      return;
    }

    const cats=['Résultats','Analyse','Coupe du Monde','International'];
    const icons=['⚽','🏆','🌍','🎯'];

    el.innerHTML=matches.map((m,i)=>{
      const gh=m.homeScore??0;
      const ga=m.awayScore??0;
      const score=`${gh} - ${ga}`;
      const winner=gh>ga?m.homeTeam:ga>gh?m.awayTeam:null;
      const title=winner
        ?`${winner} s'impose face à ${gh>ga?m.awayTeam:m.homeTeam} (${score})`
        :`Match nul entre ${m.homeTeam} et ${m.awayTeam} (${score})`;
      const titleAr=winner
        ?`${winner} يفوز على ${gh>ga?m.awayTeam:m.homeTeam} بنتيجة ${score}`
        :`تعادل بين ${m.homeTeam} و ${m.awayTeam} (${score})`;
      const analysis=generateAnalysis(m,winner);

      return `
        <div class="article-card animate-in" onclick="this.querySelector('.article-expand').style.display=this.querySelector('.article-expand').style.display==='none'?'block':'none'">
          <div class="article-img" style="background:linear-gradient(135deg,#0d2010,#080808)">
            <div class="article-cat">${cats[i%cats.length]}</div>
            <div style="font-size:44px">${icons[i%icons.length]}</div>
          </div>
          <div class="article-body">
            <div class="article-title">${title}</div>
            <div class="article-title-ar ar">${titleAr}</div>
            <div class="article-expand" style="display:none;margin-top:10px;font-size:13px;color:var(--muted);line-height:1.7">${analysis}</div>
            <div class="article-meta" style="margin-top:8px">
              <span>⏱ Hier</span>
              <span>${m.leagueFlag||'⚽'} ${m.league||'Football'}</span>
              <span style="color:var(--green);font-size:11px">Lire la suite ↓</span>
            </div>
          </div>
        </div>`;
    }).join('');
  }catch(e){
    el.innerHTML=generateFallbackArticles();
  }
}

function generateAnalysis(m, winner){
  const gh=m.homeScore??0, ga=m.awayScore??0;
  if(winner){
    const diff=Math.abs(gh-ga);
    const dom=diff>=3?'une large victoire':'une victoire serrée';
    return `${winner} a réalisé ${dom} lors de ce match comptant pour ${m.league||'la compétition'}. 
    Le score final de ${gh}-${ga} reflète la domination de l'équipe gagnante tout au long de la rencontre. 
    Cette victoire permet à ${winner} de renforcer sa position au classement.`;
  }
  return `Match équilibré entre ${m.homeTeam} et ${m.awayTeam} qui se sont quittés sur un score de parité (${gh}-${ga}). 
  Les deux équipes ont montré de belles qualités techniques dans ce match comptant pour ${m.league||'la compétition'}.`;
}

function generateFallbackArticles(){
  const articles=[
    {
      cat:'Coupe du Monde 2026',icon:'🏆',
      title:'Coupe du Monde 2026 : le point sur les groupes',
      titleAr:'كأس العالم 2026: نظرة على المجموعات',
      content:'La Coupe du Monde 2026 bat son plein aux États-Unis, au Canada et au Mexique. 32 nations s\'affrontent pour décrocher le titre suprême. Suivez tous les résultats et classements en direct sur SportDZ.'
    },
    {
      cat:'Algérie',icon:'🇩🇿',
      title:'Les Fennecs en lice pour la Coupe du Monde',
      titleAr:'الخضر في طريقهم نحو كأس العالم',
      content:'L\'équipe nationale algérienne poursuit son parcours dans cette compétition mondiale. Retrouvez toutes les analyses et statistiques des matchs des Fennecs sur SportDZ.'
    },
    {
      cat:'Analyse',icon:'📊',
      title:'Les meilleures performances de la Coupe du Monde',
      titleAr:'أفضل الأداءات في كأس العالم 2026',
      content:'Découvrez les statistiques des meilleurs joueurs et équipes de cette édition historique de la Coupe du Monde 2026. Buts, passes décisives et classements mis à jour en temps réel.'
    },
    {
      cat:'International',icon:'🌍',
      title:'Classement et résultats des groupes — Jour par jour',
      titleAr:'ترتيب المجموعات والنتائج يومًا بيوم',
      content:'Suivez l\'évolution des groupes de la Coupe du Monde 2026 sur SportDZ. Scores, classements et prochains matchs disponibles en temps réel pour tous les groupes.'
    },
  ];
  return articles.map((a,i)=>`
    <div class="article-card animate-in">
      <div class="article-img" style="background:linear-gradient(135deg,#0d2010,#080808)">
        <div class="article-cat">${a.cat}</div>
        <div style="font-size:44px">${a.icon}</div>
      </div>
      <div class="article-body">
        <div class="article-title">${a.title}</div>
        <div class="article-title-ar ar">${a.titleAr}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6">${a.content}</div>
        <div class="article-meta" style="margin-top:8px"><span>⏱ Aujourd'hui</span><span>🌍 International</span></div>
      </div>
    </div>`).join('');
}

// ── TICKER ────────────────────────────────────────
function updateTicker(matches){
  const ticker=document.getElementById('ticker');
  if(!ticker||!matches.length) return;
  const items=matches.slice(0,12).map(m=>{
    const score=(m.homeScore!==null&&m.homeScore!==undefined)
      ?`${m.homeScore} - ${m.awayScore}`
      :fmtTime(m.date);
    return `<span class="ticker-item">${m.homeShort||m.homeTeam} — ${m.awayShort||m.awayTeam} <span class="ticker-score">${score}</span></span>`;
  });
  ticker.innerHTML=[...items,...items].join('');
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  fetchScores();
  fetchUpcoming();
  fetchAllStandings();
  fetchArticles();
  setInterval(fetchScores,   60000);
  setInterval(fetchUpcoming, 300000);
});
