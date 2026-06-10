const PROXY='/api/proxy';
const LEAGUES_FD=[
  {code:'PL',name:'Premier League',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
  {code:'PD',name:'La Liga',flag:'🇪🇸'},
  {code:'BL1',name:'Bundesliga',flag:'🇩🇪'},
  {code:'SA',name:'Serie A',flag:'🇮🇹'},
  {code:'FL1',name:'Ligue 1',flag:'🇫🇷'},
  {code:'PPL',name:'Primeira Liga',flag:'🇵🇹'},
];

async function api(action,extra=''){
  const r=await fetch(`${PROXY}?action=${action}${extra}`);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function ft(d){try{return new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Algiers'})}catch(e){return '--:--'}}
function fd(d){try{return new Date(d).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short',timeZone:'Africa/Algiers'})}catch(e){return ''}}
function fdf(d){try{return new Date(d).toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',timeZone:'Africa/Algiers'})}catch(e){return ''}}
function cr(url,s=32){
  if(!url) return `<div style="width:${s}px;height:${s}px;background:var(--card2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(s*.5)}px">⚽</div>`;
  return `<img src="${url}" style="width:${s}px;height:${s}px;object-fit:contain" onerror="this.outerHTML='<span style=font-size:14px>⚽</span>'">`;
}
function ph(msg,ar=''){return `<div class="ph"><div class="spin"></div><div>${msg}</div>${ar?`<div class="ar" style="font-size:11px;margin-top:3px;color:var(--muted)">${ar}</div>`:''}</div>`}

// ── ALGERIA WIDGET ────────────────────────────────
function updateAlgWidget(matches){
  const alg=matches.find(m=>
    /alger|algérie/i.test(m.homeTeam)||/alger|algérie/i.test(m.awayTeam)||
    /alg/i.test(m.homeShort)||/alg/i.test(m.awayShort)
  );
  if(!alg) return;
  const isHome=/alger|algérie|alg/i.test(alg.homeTeam)||/alg/i.test(alg.homeShort);
  const opp=isHome?alg.awayTeam:alg.homeTeam;
  document.getElementById('alg-onm').textContent=opp||'?';
  document.getElementById('alg-ofl').textContent='🏳️';
  const isLive=alg.status==='STATUS_IN_PROGRESS'||alg.status==='STATUS_HALFTIME';
  const isFin=alg.status==='STATUS_FINAL';
  if(isFin||isLive){
    const gh=alg.homeScore??0,ga=alg.awayScore??0;
    const sc=isHome?`${gh} - ${ga}`:`${ga} - ${gh}`;
    const el=document.getElementById('alg-sc');
    el.textContent=sc;el.classList.add('glow');
    const st=document.getElementById('alg-st');
    st.textContent=isLive?`🔴 ${alg.clock||'LIVE'}`:'Terminé';
    st.className=`alg-st ${isLive?'live-p':'fin-p'}`;
  } else {
    document.getElementById('alg-sc').textContent=ft(alg.date);
    document.getElementById('alg-dt').textContent=fd(alg.date);
    document.getElementById('alg-ve').textContent=alg.venue?`📍 ${alg.venue}${alg.city?', '+alg.city:''}` :'';
  }
}

// ── SCORES PAR JOUR ───────────────────────────────
let scData={};
async function fetchScores(){
  const el=document.getElementById('scores-con');
  const tabs=document.getElementById('scores-tabs');
  if(!el) return;
  el.innerHTML=ph('Chargement des scores...','جاري تحميل النتائج...');
  try{
    const data=await api('scores');
    const all=data.matches||[];
    updateAlgWidget(all);

    // Grouper par ligue (pas par date)
    scData={};
    all.forEach(m=>{
      const k=m.league||'Autres';
      if(!scData[k]) scData[k]=[];
      scData[k].push(m);
    });

    // Supprimer ligues vides
    Object.keys(scData).forEach(k=>{if(!scData[k].length) delete scData[k]});
    const leagues=Object.keys(scData);

    if(!leagues.length){
      if(tabs) tabs.innerHTML='';
      el.innerHTML=ph('Aucun match aujourd\'hui','لا توجد مباريات اليوم');
      return;
    }

    if(tabs){
      tabs.innerHTML=leagues.map((lg,i)=>{
        const cnt=scData[lg].length;
        const flag=scData[lg][0]?.leagueFlag||'⚽';
        return `<button class="tab ${i===0?'on':''}" onclick="swSc('${lg.replace(/'/g,"\\'")}',this)">${flag} ${lg} <span style="font-size:9px;opacity:.6">(${cnt})</span></button>`;
      }).join('');
    }
    renderSc(leagues[0]);
    clearInterval(window._sci);
    let idx=0;
    window._sci=setInterval(()=>{
      idx=(idx+1)%leagues.length;
      if(tabs){tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));tabs.querySelectorAll('.tab')[idx]?.classList.add('on')}
      renderSc(leagues[idx]);
    },8000);
    updateTicker(all);
  }catch(e){
    el.innerHTML=ph(`Erreur: ${e.message}`,'');
    setTimeout(fetchScores,30000);
  }
}
window.swSc=function(lg,btn){
  clearInterval(window._sci);
  document.querySelectorAll('#scores-tabs .tab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');renderSc(lg);
};
function renderSc(lg){
  const el=document.getElementById('scores-con');
  const ms=scData[lg]||[];
  if(!ms.length){el.innerHTML=ph('Aucun match','');return}
  const ord={STATUS_IN_PROGRESS:0,STATUS_HALFTIME:1,STATUS_SCHEDULED:2,STATUS_TIMED:2,STATUS_FINAL:3};
  ms.sort((a,b)=>(ord[a.status]??2)-(ord[b.status]??2));
  el.innerHTML=`<div class="sg">${ms.map(m=>{
    const isL=m.status==='STATUS_IN_PROGRESS'||m.status==='STATUS_HALFTIME';
    const isF=m.status==='STATUS_FINAL';
    const isU=!isL&&!isF;
    const cls=isL?'live-p':isF?'fin-p':'soon-p';
    const lbl=isL?`🔴 ${m.clock||'LIVE'}`:isF?'Terminé':'À venir';
    const sc=isU?ft(m.date):`${m.homeScore??0} - ${m.awayScore??0}`;
    return `<div class="sc ani">
      <div class="sc-lg">${m.leagueFlag||'⚽'} ${m.league||'Football'}</div>
      <div class="mr">
        <div class="tm"><div class="tl">${cr(m.homeLogo)}</div><div class="tn">${m.homeShort||m.homeTeam}</div></div>
        <div class="sm"><div class="sn ${isL?'glow':''}">${sc}</div><span class="sp ${cls}">${lbl}</span>${isU?`<div class="md">${fd(m.date)}</div>`:''}</div>
        <div class="tm"><div class="tl">${cr(m.awayLogo)}</div><div class="tn">${m.awayShort||m.awayTeam}</div></div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ── PROCHAINS MATCHS FENNECS + AUTRES ────────────
let upData={};
async function fetchUpcoming(){
  const el=document.getElementById('upcoming-con');
  const tabs=document.getElementById('upcoming-tabs');
  if(!el||!tabs) return;
  el.innerHTML=ph('Chargement...','');
  try{
    const data=await api('upcoming');
    const ms=data.matches||[];

    // Séparer matchs Algérie en premier
    const algMs=ms.filter(m=>/alger|algérie/i.test(m.homeTeam)||/alger|algérie/i.test(m.awayTeam));
    const othMs=ms.filter(m=>!/alger|algérie/i.test(m.homeTeam)&&!/alger|algérie/i.test(m.awayTeam));

    upData={};
    if(algMs.length) upData['🇩🇿 Fennecs']=algMs;
    othMs.forEach(m=>{
      const k=m.league||'Autres';
      if(!upData[k]) upData[k]=[];
      upData[k].push(m);
    });
    Object.keys(upData).forEach(k=>{if(!upData[k].length) delete upData[k]});
    const leagues=Object.keys(upData);

    if(!leagues.length){
      tabs.innerHTML='';
      el.innerHTML=ph('Aucun match à venir','لا توجد مباريات قادمة');
      return;
    }

    tabs.innerHTML=leagues.map((lg,i)=>{
      const cnt=upData[lg].length;
      const flag=upData[lg][0]?.leagueFlag||'⚽';
      const lname=lg==='🇩🇿 Fennecs'?lg:`${flag} ${lg}`;
      return `<button class="tab ${i===0?'on':''}" onclick="swUp('${lg.replace(/'/g,"\\'")}',this)">${lname} <span style="font-size:9px;opacity:.6">(${cnt})</span></button>`;
    }).join('');

    renderUp(leagues[0]);
    clearInterval(window._upi);
    let idx=0;
    window._upi=setInterval(()=>{
      idx=(idx+1)%leagues.length;
      tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
      tabs.querySelectorAll('.tab')[idx]?.classList.add('on');
      renderUp(leagues[idx]);
    },8000);
  }catch(e){el.innerHTML=ph('Erreur chargement','')}
}
window.swUp=function(lg,btn){
  clearInterval(window._upi);
  document.querySelectorAll('#upcoming-tabs .tab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');renderUp(lg);
};
function renderUp(lg){
  const el=document.getElementById('upcoming-con');
  const ms=(upData[lg]||[]).slice(0,8);
  if(!ms.length){el.innerHTML=ph('Aucun match','');return}
  el.innerHTML=`<div class="ul">${ms.map(m=>`
    <div class="ui ani">
      <div class="ud">
        <div class="udy">${fd(m.date)}</div>
        <div class="utm">${ft(m.date)}</div>
        <div class="uve">${m.venue?`📍 ${m.venue}`:''}</div>
      </div>
      <div class="um">
        <div class="umt">${cr(m.homeLogo,26)}<span>${m.homeShort||m.homeTeam||'?'}</span></div>
        <div class="uvs">VS</div>
        <div class="umt r"><span>${m.awayShort||m.awayTeam||'?'}</span>${cr(m.awayLogo,26)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ── GROUPES CdM 2026 ──────────────────────────────
async function fetchGroups(){
  const el=document.getElementById('groups-con');
  if(!el) return;
  try{
    const data=await api('groups');
    const groups=data.groups||[];
    el.innerHTML=groups.map(g=>`
      <div class="gc ani">
        <div class="gc-head">
          <div class="gc-name">${g.name}</div>
          <div class="gc-info">${g.teams.length} équipes</div>
        </div>
        <table class="gt">
          <thead><tr><th>#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th><th>Buts</th><th>Pts</th></tr></thead>
          <tbody>${g.teams.map((t,i)=>`
            <tr class="${i<2?'q':''}">
              <td class="grk ${i<2?'q':''}">${i+1}</td>
              <td><div style="display:flex;align-items:center;gap:7px"><span style="font-size:18px">${t.flag}</span><strong>${t.name}</strong></div></td>
              <td>${t.played}</td><td>${t.won}</td><td>${t.draw}</td><td>${t.lost}</td>
              <td>${t.gf}:${t.ga}</td>
              <td class="gpts">${t.pts}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');
  }catch(e){el.innerHTML=ph('Erreur groupes','')}
}

// ── ARTICLES BENTO ────────────────────────────────
async function fetchArticles(){
  const el=document.getElementById('articles-con');
  if(!el) return;
  try{
    const data=await api('articles');
    const ms=data.matches||[];
    if(!ms.length){el.innerHTML=fallbackArticles();return}
    const cats=['Résultats','Analyse','Coupe du Monde','International','Fennecs'];
    const icons=['⚽','🏆','🌍','🎯','🇩🇿'];
    const sizes=['big','med','sml','sml','sml'];
    el.innerHTML=ms.slice(0,5).map((m,i)=>{
      const gh=m.homeScore??0,ga=m.awayScore??0;
      const sc=`${gh} - ${ga}`;
      const win=gh>ga?m.homeTeam:ga>gh?m.awayTeam:null;
      const title=win?`${win} s'impose (${sc}) contre ${gh>ga?m.awayTeam:m.homeTeam}`:`Match nul (${sc}) — ${m.homeTeam} vs ${m.awayTeam}`;
      const titleAr=win?`${win} يفوز (${sc}) على ${gh>ga?m.awayTeam:m.homeTeam}`:`تعادل (${sc}) بين ${m.homeTeam} و ${m.awayTeam}`;
      const body=win?`${win} a dominé cette rencontre de ${m.league||'la compétition'} (${sc}). Une performance solide qui confirme la forme du moment.`:`Les deux équipes se sont neutralisées (${sc}) dans ce match de ${m.league||'la compétition'}.`;
      return `<div class="bc ${sizes[i]||'sml'} ani">
        <div class="bi">
          <div class="bcat">${cats[i%cats.length]}</div>
          <div style="font-size:${i===0?'62':'46'}px">${icons[i%icons.length]}</div>
          <div class="bio"></div>
        </div>
        <div class="bb">
          <div class="bt">${title}</div>
          <div class="bar ar">${titleAr}</div>
          ${i===0?`<div class="bex">${body}</div>`:''}
          <div class="bm"><span>⏱ Hier</span><span>${m.leagueFlag||'⚽'} ${m.league||'Football'}</span></div>
        </div>
      </div>`;
    }).join('');
  }catch(e){el.innerHTML=fallbackArticles()}
}

function fallbackArticles(){
  const arts=[
    {sz:'big',cat:'Coupe du Monde 2026',ic:'🏆',t:'Coupe du Monde 2026 : tout ce qu\'il faut savoir',ar:'كأس العالم 2026: كل ما تحتاج معرفته',body:'La Coupe du Monde 2026 se tient aux États-Unis, au Canada et au Mexique. 32 nations s\'affrontent pour le titre. Suivez tous les scores en temps réel sur SportDZ.'},
    {sz:'med',cat:'Fennecs 🇩🇿',ic:'🇩🇿',t:'Les Fennecs à la Coupe du Monde 2026',ar:'الخضر في كأس العالم 2026',body:''},
    {sz:'sml',cat:'Analyse',ic:'📊',t:'Les stats de la Coupe du Monde 2026',ar:'إحصاءات كأس العالم 2026',body:''},
    {sz:'sml',cat:'International',ic:'🌍',t:'Résultats et classements en direct',ar:'النتائج والترتيب مباشرة',body:''},
    {sz:'sml',cat:'Scores',ic:'🎯',t:'Tous les scores du jour',ar:'جميع نتائج اليوم',body:''},
  ];
  return arts.map(a=>`<div class="bc ${a.sz} ani">
    <div class="bi"><div class="bcat">${a.cat}</div><div style="font-size:${a.sz==='big'?'62':'46'}px">${a.ic}</div><div class="bio"></div></div>
    <div class="bb"><div class="bt">${a.t}</div><div class="bar ar">${a.ar}</div>${a.body?`<div class="bex">${a.body}</div>`:''}<div class="bm"><span>⏱ Aujourd'hui</span><span>🌍 CdM 2026</span></div></div>
  </div>`).join('');
}

// ── CLASSEMENTS ───────────────────────────────────
let stCache={};
async function fetchStandings(){
  const tabs=document.getElementById('standings-tabs');
  if(!tabs) return;
  tabs.innerHTML=LEAGUES_FD.map((l,i)=>`<button class="tab ${i===0?'on':''}" onclick="swSt('${l.code}',this)">${l.flag} ${l.name}</button>`).join('');
  await loadSt(LEAGUES_FD[0].code);
  clearInterval(window._sti);let idx=0;
  window._sti=setInterval(async()=>{
    idx=(idx+1)%LEAGUES_FD.length;
    const ts=tabs.querySelectorAll('.tab');ts.forEach(t=>t.classList.remove('on'));ts[idx]?.classList.add('on');
    await loadSt(LEAGUES_FD[idx].code);
  },10000);
}
window.swSt=async function(code,btn){
  clearInterval(window._sti);
  document.querySelectorAll('#standings-tabs .tab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');await loadSt(code);
};
async function loadSt(code){
  const tb=document.getElementById('standings-body');
  if(!tb) return;
  if(stCache[code]){renderSt(stCache[code]);return}
  tb.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:22px"><div class="spin" style="margin:0 auto;width:24px;height:24px;border-width:2px"></div></td></tr>`;
  try{
    const data=await api('standings',`&code=${code}`);
    const table=data.standings?.find(s=>s.type==='TOTAL')?.table||[];
    if(!table.length) throw new Error('Saison terminée');
    stCache[code]=table;renderSt(table);
  }catch(e){
    tb.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:18px;color:var(--muted);font-size:12px">📅 ${e.message}</td></tr>`;
  }
}
function renderSt(table){
  const tb=document.getElementById('standings-body');
  const t3=document.getElementById('top3-con');
  if(!tb) return;
  const tot=table.length;
  tb.innerHTML=table.slice(0,10).map(t=>{
    const rc=t.position<=3?'top':t.position>=tot-2?'rel':'';
    const form=(t.form||'').split(',').slice(-5).map(f=>f==='W'?'<div class="fd fw"></div>':f==='D'?'<div class="fd fd2"></div>':'<div class="fd fl"></div>').join('');
    return `<tr class="ani ${t.position<=3?'hl':''}">
      <td class="srk ${rc}">${t.position}</td>
      <td><div style="display:flex;align-items:center;gap:7px">${cr(t.team?.crest,20)}<strong>${t.team?.shortName||t.team?.name}</strong></div></td>
      <td>${t.playedGames}</td><td>${t.won}</td><td>${t.draw}</td><td>${t.lost}</td>
      <td>${t.goalsFor}:${t.goalsAgainst}</td>
      <td class="spts">${t.points}</td>
      <td><div class="fr">${form}</div></td>
    </tr>`;
  }).join('');
  if(t3&&table.length>=3){
    const atk=[...table].sort((a,b)=>b.goalsFor-a.goalsFor).slice(0,3);
    const def=[...table].sort((a,b)=>a.goalsAgainst-b.goalsAgainst).slice(0,3);
    t3.innerHTML=`
      <div class="t3l">⚽ Meilleures Attaques</div>
      ${atk.map((t,i)=>`<div class="t3i ani"><div class="t3r">${['🥇','🥈','🥉'][i]}</div>${cr(t.team?.crest,26)}<div><div class="t3n">${t.team?.shortName||t.team?.name}</div><div class="t3s">${t.goalsFor} buts</div></div><div class="t3v">${t.goalsFor}</div></div>`).join('')}
      <div class="t3l" style="margin-top:12px">🛡️ Meilleures Défenses</div>
      ${def.map((t,i)=>`<div class="t3i ani"><div class="t3r">${['🥇','🥈','🥉'][i]}</div>${cr(t.team?.crest,26)}<div><div class="t3n">${t.team?.shortName||t.team?.name}</div><div class="t3s">${t.goalsAgainst} enc.</div></div><div class="t3v">${t.goalsAgainst}</div></div>`).join('')}`;
  }
}

// ── TICKER ────────────────────────────────────────
function updateTicker(ms){
  const el=document.getElementById('ticker');
  if(!el||!ms.length) return;
  const items=ms.slice(0,12).map(m=>{
    const sc=(m.homeScore!==null&&m.homeScore!==undefined)?`${m.homeScore} - ${m.awayScore}`:ft(m.date);
    return `<span class="ti">${m.leagueFlag||'⚽'} ${m.homeShort||m.homeTeam} — ${m.awayShort||m.awayTeam} <span class="ts">${sc}</span></span>`;
  });
  el.innerHTML=[...items,...items].join('');
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  fetchScores();
  fetchUpcoming();
  fetchGroups();
  fetchArticles();
  fetchStandings();
  setInterval(fetchScores,60000);
  setInterval(fetchUpcoming,300000);
});
