// scores.js — FootDZ · كأس العالم 2026
// 100% عربي — Mobile First

const API = '/api/proxy';

function $(id){ return document.getElementById(id); }

function timeAgo(iso){
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if(m<1) return 'الآن';
  if(m<60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m/60);
  if(h<24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h/24)} يوم`;
}

function formatTime(iso){
  return new Date(iso).toLocaleTimeString('ar-DZ',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Algiers'});
}
function formatDate(iso){
  return new Date(iso).toLocaleDateString('ar-DZ',{day:'2-digit',month:'short',timeZone:'Africa/Algiers'});
}
function dayLabel(iso){
  const d=new Date(iso), now=new Date();
  const diff=Math.floor((d-now)/86400000);
  if(diff===0) return 'اليوم';
  if(diff===1) return 'غداً';
  return d.toLocaleDateString('ar-DZ',{weekday:'long',timeZone:'Africa/Algiers'});
}

const TEAM_AR={
  'Algeria':'الجزائر','Argentina':'الأرجنتين','France':'فرنسا',
  'Brazil':'البرازيل','Spain':'إسبانيا','Germany':'ألمانيا',
  'England':'إنجلترا','Portugal':'البرتغال','Morocco':'المغرب',
  'USA':'الولايات المتحدة','Mexico':'المكسيك','Canada':'كندا',
  'Turkey':'تركيا','Türkiye':'تركيا','Austria':'النمسا','Jordan':'الأردن',
  'Netherlands':'هولندا','Croatia':'كرواتيا','Japan':'اليابان',
  'Australia':'أستراليا','Senegal':'السنغال','Uruguay':'أوروغواي',
  'Colombia':'كولومبيا','Italy':'إيطاليا','Norway':'النرويج',
  'Scotland':'اسكتلندا','Serbia':'صربيا','Ukraine':'أوكرانيا',
  'Belgium':'بلجيكا','Denmark':'الدانمارك','Poland':'بولندا',
  'Sweden':'السويد','Switzerland':'سويسرا','South Korea':'كوريا الجنوبية',
  'Ecuador':'الإكوادور','Tunisia':'تونس','Cameroon':'الكاميرون',
  'Ghana':'غانا','Saudi Arabia':'السعودية','Iran':'إيران',
  'Nigeria':'نيجيريا','Egypt':'مصر','Ivory Coast':'كوت ديفوار',
  "Cote d'Ivoire":'كوت ديفوار','Curaçao':'كوراساو',
  'DR Congo':'الكونغو','Cape Verde':'الرأس الأخضر',
  'Uzbekistan':'أوزبكستان','Iraq':'العراق','Panama':'بنما',
  'Jamaica':'جامايكا','Venezuela':'فنزويلا','Peru':'بيرو',
  'Chile':'تشيلي','Bolivia':'بوليفيا','Paraguay':'باراغواي',
  'New Zealand':'نيوزيلندا','Indonesia':'إندونيسيا',
  'Costa Rica':'كوستاريكا','Haiti':'هايتي','Benin':'بنين',
  'Tanzania':'تنزانيا','Angola':'أنغولا','Ghana':'غانا',
};
function ar(n){ return TEAM_AR[n]||n; }

// ══════════════════════════════════════
// LIVE BAR
// ══════════════════════════════════════
(function LiveBar(){
  let matches=[], idx=0, cdT=null;

  function el(id){ return document.getElementById(id); }
  function pad(n){ return String(n).padStart(2,'0'); }

  async function load(){
    try{
      const r=await fetch('/api/live');
      if(!r.ok) return;
      const d=await r.json();
      const now=new Date(), all=[];
      (d.live||[]).forEach(m=>all.push({...m,_s:'live'}));
      (d.upcoming||[]).filter(m=>new Date(m.date)>now).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,6).forEach(m=>all.push({...m,_s:'soon'}));
      (d.recent||[]).slice(0,2).forEach(m=>all.push({...m,_s:'done'}));
      if(!all.length) return;
      matches=all;
      const li=all.findIndex(m=>m._s==='live');
      const si=all.findIndex(m=>m._s==='soon');
      idx=li>=0?li:si>=0?si:0;
      render();
    }catch(e){ console.warn('LiveBar:',e.message); }
  }

  function render(){
    if(!matches.length) return;
    const m=matches[idx];
    if(!m) return;
    if(cdT){ clearInterval(cdT); cdT=null; }
    const badge=el('lb-badge'), hf=el('lb-hflag'), hn=el('lb-hname');
    const sc=el('lb-score'), af=el('lb-aflag'), an=el('lb-aname');
    const cd=el('lb-cd'), cnt=el('lb-counter');
    if(!badge) return;
    hf.textContent=m.homeFlag||'⚽';
    hn.textContent=ar(m.homeTeam)||'—';
    af.textContent=m.awayFlag||'⚽';
    an.textContent=ar(m.awayTeam)||'—';
    cnt.textContent=`${idx+1}/${matches.length}`;
    cd.textContent='';

    if(m._s==='live'){
      badge.className='lb-badge live'; badge.textContent='🔴 مباشر';
      sc.className='lb-score live'; sc.textContent=`${m.homeScore??0}–${m.awayScore??0}`;
      cd.textContent=m.clock?`${m.clock}'`:'';
    } else if(m._s==='soon'){
      badge.className='lb-badge soon'; sc.className='lb-score soon'; sc.textContent='VS';
      const target=new Date(m.date);
      function tick(){
        const diff=target-Date.now();
        if(!el('lb-cd')){ clearInterval(cdT); return; }
        if(diff<=0){ el('lb-badge').className='lb-badge live'; el('lb-badge').textContent='🔴 الآن'; el('lb-cd').textContent=''; clearInterval(cdT); setTimeout(load,20000); return; }
        const h=Math.floor(diff/3600000), mn=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
        el('lb-badge').textContent='⏱ قريباً';
        el('lb-cd').textContent=h>0?`بعد ${h}س ${pad(mn)}د`:`بعد ${pad(mn)}:${pad(s)}`;
      }
      tick(); cdT=setInterval(tick,1000);
    } else {
      badge.className='lb-badge done'; badge.textContent='✓ انتهى';
      sc.className='lb-score done'; sc.textContent=`${m.homeScore??0}–${m.awayScore??0}`;
      cd.textContent='FT';
    }
  }

  window.lbNav=function(dir){ if(!matches.length)return; idx=(idx+dir+matches.length)%matches.length; render(); };
  document.addEventListener('DOMContentLoaded',()=>{ load(); setInterval(load,30000); });
})();

// ══════════════════════════════════════
// WIDGET ALGÉRIE
// ══════════════════════════════════════
async function loadAlgWidget(){
  try{
    const [rs,ru]=await Promise.all([fetch(`${API}?action=scores`),fetch(`${API}?action=upcoming`)]);
    const [ds,du]=await Promise.all([rs.json(),ru.json()]);
    const all=[...(ds.matches||[]),...(du.matches||[])];
    const m=all.find(x=>x.homeTeam==='Algeria'||x.awayTeam==='Algeria');
    if(!m){ $('alg-date').textContent='لا مباريات مجدولة'; return; }
    const isHome=m.homeTeam==='Algeria';
    const opp=isHome?m.awayTeam:m.homeTeam;
    const oppFlag=isHome?m.awayFlag:m.homeFlag;
    $('alg-opp-flag').textContent=oppFlag||'🏳️';
    $('alg-opp-name').textContent=ar(opp);
    $('alg-date').textContent=`${formatDate(m.date)} · ${formatTime(m.date)}`;
    $('alg-venue').textContent=m.venue?`📍 ${m.venue}`:'';
    if(m.status==='STATUS_IN_PROGRESS'){
      const sc=isHome?`${m.homeScore??0}–${m.awayScore??0}`:`${m.awayScore??0}–${m.homeScore??0}`;
      $('alg-score').textContent=sc; $('alg-score').classList.add('live');
      $('alg-status').textContent='مباشر'; $('alg-status').className='alg-status s-live';
    } else if(m.status==='STATUS_FINAL'){
      const sc=isHome?`${m.homeScore}–${m.awayScore}`:`${m.awayScore}–${m.homeScore}`;
      $('alg-score').textContent=sc; $('alg-status').textContent='انتهت'; $('alg-status').className='alg-status s-fin';
    } else {
      $('alg-score').textContent='VS'; $('alg-status').textContent='قادمة'; $('alg-status').className='alg-status s-soon';
    }
  }catch(e){ console.error('AlgWidget:',e); }
}

// ══════════════════════════════════════
// GROUPES
// ══════════════════════════════════════
async function loadGroups(){
  const c=$('groups-container'); if(!c)return;
  try{
    const r=await fetch(`${API}?action=groups`);
    const d=await r.json();
    const groups=d.groups||[];
    if(!groups.length){ c.innerHTML='<div class="loading-state">لا توجد بيانات</div>'; return; }
    c.innerHTML=groups.map(g=>{
      const hasAlg=g.teams.some(t=>t.name==='Algeria');
      return `<div class="group-card">
        <div class="group-header">
          <span class="group-name">${g.name.replace('Group','المجموعة')}</span>
          ${hasAlg?'<span class="group-alg">🇩🇿 الجزائر</span>':''}
        </div>
        <table class="group-table">
          <tbody>
            ${g.teams.map((t,i)=>`
              <tr class="${i<2?'q':''}">
                <td class="g-rank ${i<2?'q':''}">${i+1}</td>
                <td><div class="g-team"><span class="g-flag">${t.flag}</span><span class="g-name ${t.name==='Algeria'?'g-alg':''}">${ar(t.name)}</span></div></td>
                <td style="text-align:center">${t.played}</td>
                <td style="text-align:center">${t.won}</td>
                <td style="text-align:center">${t.draw}</td>
                <td style="text-align:center">${t.lost}</td>
                <td class="g-pts" style="text-align:center">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('');
  }catch(e){ c.innerHTML=`<div class="loading-state">خطأ: ${e.message}</div>`; }
}

// ══════════════════════════════════════
// SCORES
// ══════════════════════════════════════
async function loadScores(){
  const c=$('scores-container'); if(!c)return;
  try{
    const r=await fetch(`${API}?action=scores`);
    const d=await r.json();
    const matches=d.matches||[];
    if(!matches.length){
      c.innerHTML='<div class="loading-state" style="padding:32px">📅 لا مباريات اليوم · تصفح البرنامج القادم ↓</div>';
      return;
    }
    c.innerHTML=matches.map(m=>{
      const isAlg=m.homeTeam==='Algeria'||m.awayTeam==='Algeria';
      const isLive=m.status==='STATUS_IN_PROGRESS';
      const isDone=m.status==='STATUS_FINAL';
      const scoreHTML=(m.homeScore!==null&&m.awayScore!==null)
        ?`<span class="match-score">${m.homeScore} – ${m.awayScore}</span>`
        :`<span class="match-vs">${formatTime(m.date)}</span>`;
      const stHTML=isLive
        ?`<span class="match-status-live">مباشر</span>`
        :isDone?`<span class="match-status-done">انتهى</span>`
        :`<span class="match-time">${formatTime(m.date)}</span>`;
      return `<div class="match-row ${isAlg?'alg-match':''}">
        <span class="match-group">${(m.group||'CdM').replace('Group','J')}</span>
        <div class="match-teams">
          <span class="match-flag">${m.homeFlag||''}</span>
          <span class="match-team">${ar(m.homeTeam)}</span>
          ${scoreHTML}
          <span class="match-team">${ar(m.awayTeam)}</span>
          <span class="match-flag">${m.awayFlag||''}</span>
        </div>
        ${stHTML}
      </div>`;
    }).join('');
  }catch(e){ c.innerHTML=`<div class="loading-state">خطأ: ${e.message}</div>`; }
}

// ══════════════════════════════════════
// UPCOMING
// ══════════════════════════════════════
async function loadUpcoming(){
  const list=$('upcoming-list'), tabs=$('upcoming-tabs'); if(!list)return;
  try{
    const r=await fetch(`${API}?action=upcoming`);
    const d=await r.json();
    const matches=d.matches||[];
    if(!matches.length){ list.innerHTML='<div class="loading-state">لا مباريات قادمة</div>'; return; }
    const byDate={};
    matches.forEach(m=>{ const k=m.date.split('T')[0]; if(!byDate[k])byDate[k]=[]; byDate[k].push(m); });
    const dates=Object.keys(byDate).sort();
    if(tabs){
      tabs.innerHTML=['الكل',...dates.map(d=>new Date(d).toLocaleDateString('ar-DZ',{day:'2-digit',month:'short',timeZone:'Africa/Algiers'}))].map((l,i)=>
        `<button class="up-tab ${i===0?'active':''}" data-i="${i-1}">${l}</button>`
      ).join('');
      tabs.querySelectorAll('.up-tab').forEach(btn=>{
        btn.addEventListener('click',()=>{
          tabs.querySelectorAll('.up-tab').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          const i=parseInt(btn.dataset.i);
          renderUpcoming(i===-1?matches:byDate[dates[i]]||[]);
        });
      });
    }
    renderUpcoming(matches);
  }catch(e){ list.innerHTML=`<div class="loading-state">خطأ: ${e.message}</div>`; }
}

function renderUpcoming(matches){
  const list=$('upcoming-list'); if(!list)return;
  if(!matches.length){ list.innerHTML='<div class="loading-state">لا مباريات</div>'; return; }
  list.innerHTML=matches.map(m=>{
    const isAlg=m.homeTeam==='Algeria'||m.awayTeam==='Algeria';
    return `<div class="up-item ${isAlg?'alg':''}">
      <div class="up-time-block">
        <div class="up-day">${dayLabel(m.date)}</div>
        <div class="up-time">${formatTime(m.date)}</div>
        <div class="up-venue">${(m.venue||'').split(',')[1]?.trim()||''}</div>
      </div>
      <div class="up-match">
        <div class="up-team">
          <span class="up-tflag">${m.homeFlag||''}</span>
          <span class="up-tname">${ar(m.homeTeam)}</span>
        </div>
        <span class="up-vs">VS</span>
        <div class="up-team away">
          <span class="up-tflag">${m.awayFlag||''}</span>
          <span class="up-tname">${ar(m.awayTeam)}</span>
        </div>
      </div>
      <span class="up-grp">${(m.group||'').replace('Group','J')}</span>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════
// STANDINGS
// ══════════════════════════════════════
const LEAGUES=[
  {code:'PL',name:'الدوري الإنجليزي',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
  {code:'PD',name:'الدوري الإسباني',flag:'🇪🇸'},
  {code:'BL1',name:'الدوري الألماني',flag:'🇩🇪'},
  {code:'SA',name:'الدوري الإيطالي',flag:'🇮🇹'},
  {code:'FL1',name:'الدوري الفرنسي',flag:'🇫🇷'},
  {code:'CL',name:'دوري الأبطال',flag:'🏆'},
];

async function loadStandings(code='PL'){
  const body=$('standings-body'); if(!body)return;
  body.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto;width:20px;height:20px;border-width:2px"></div></td></tr>';
  try{
    const r=await fetch(`${API}?action=standings&code=${code}`);
    const d=await r.json();
    const table=d.standings?.[0]?.table||[];
    if(!table.length){ body.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted)">البيانات غير متاحة حالياً</td></tr>'; return; }
    const fm={'W':'fw','D':'fd','L':'fl'};
    body.innerHTML=table.map((t,i)=>`
      <tr>
        <td><span class="rank-num ${i<4?'q':''}">${t.position}</span></td>
        <td><div class="team-cell">${t.team.crest?`<img src="${t.team.crest}" class="team-crest" alt="">`:''}
          <span class="team-lbl">${t.team.shortName||t.team.name}</span></div></td>
        <td>${t.playedGames}</td><td>${t.won}</td><td>${t.draw}</td><td>${t.lost}</td>
        <td>${t.goalsFor}:${t.goalsAgainst}</td>
        <td class="pts-cell">${t.points}</td>
        <td><div class="form-cell">${(t.form||'').split(',').slice(-5).map(f=>`<span class="${fm[f]||'fd'}">${f}</span>`).join('')}</div></td>
      </tr>`).join('');
  }catch(e){ body.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--red)">${e.message}</td></tr>`; }
}

function initStandings(){
  const tabs=$('standings-tabs'); if(!tabs)return;
  tabs.innerHTML=LEAGUES.map((l,i)=>`<button class="up-tab ${i===0?'active':''}" data-code="${l.code}">${l.flag} ${l.name}</button>`).join('');
  tabs.querySelectorAll('.up-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      tabs.querySelectorAll('.up-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      loadStandings(btn.dataset.code);
    });
  });
  loadStandings('PL');
}

// ══════════════════════════════════════
// CARROUSEL ARTICLES
// ══════════════════════════════════════
(function Carousel(){
  let arts=[], cur=0, autoT=null, progT=null, prog=0;
  const DELAY=6000;
  function el(id){ return document.getElementById(id); }

  function timeAgo(iso){
    const diff=Date.now()-new Date(iso).getTime();
    const m=Math.floor(diff/60000);
    if(m<1)return'الآن';
    if(m<60)return`منذ ${m} دقيقة`;
    const h=Math.floor(m/60);
    if(h<24)return`منذ ${h} ساعة`;
    return`منذ ${Math.floor(h/24)} يوم`;
  }

  function renderMain(){
    const a=arts[cur], main=el('carousel-main'); if(!main||!a)return;
    const isAlg=/algeri|algér|fennec|خضر/i.test((a.title||'')+(a.excerpt||''));
    const col=a.source_color||'#00D673';
    main.onclick=()=>{ if(a.source_url)window.open(a.source_url,'_blank'); };
    main.innerHTML=`
      ${a.image?`<img class="c-img" src="${a.image}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:''}
      <div class="c-img-ph" ${a.image?'style="display:none"':''}>⚽</div>
      <div class="c-overlay">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span class="c-cat" style="background:${col};color:${col==='#00D673'?'#000':'#fff'}">${a.source_flag||'⚽'} ${a.category||'كرة القدم'}</span>
          ${isAlg?'<span style="font-size:16px">🇩🇿</span>':''}
        </div>
        <div class="c-title">${a.title||''}</div>
        ${a.title_ar?`<div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:6px">${a.title_ar}</div>`:''}
        ${a.excerpt?`<p class="c-excerpt">${a.excerpt}</p>`:''}
        <div class="c-meta">
          <span class="c-source">${a.source_flag||''} ${a.source_name||''} · ${timeAgo(a.published_at||new Date().toISOString())}</span>
          <span class="c-read">اقرأ المزيد ↗</span>
        </div>
      </div>
      <div class="c-progress"><div class="c-bar" id="c-bar" style="width:0%"></div></div>`;
    updateThumbs(); updateDots(); startProg();
  }

  function renderThumbs(){
    const t=el('c-thumbs'); if(!t)return;
    t.innerHTML=arts.slice(0,8).map((a,i)=>`
      <div class="c-thumb ${i===cur?'active':''}" onclick="cGoTo(${i})">
        <div class="c-thumb-img">${a.image?`<img src="${a.image}" alt="" onerror="this.parentElement.textContent='⚽'">`:'⚽'}</div>
        <div class="c-thumb-body"><div class="c-thumb-title">${(a.title||'').slice(0,55)}</div></div>
      </div>`).join('');
  }

  function updateThumbs(){ document.querySelectorAll('.c-thumb').forEach((t,i)=>t.classList.toggle('active',i===cur)); }

  function renderDots(){
    const d=el('c-dots'); if(!d)return;
    d.innerHTML=arts.slice(0,8).map((_,i)=>`<div class="c-dot ${i===cur?'active':''}" onclick="cGoTo(${i})"></div>`).join('');
  }
  function updateDots(){ document.querySelectorAll('.c-dot').forEach((d,i)=>d.classList.toggle('active',i===cur)); }

  function startProg(){
    if(progT)clearInterval(progT); prog=0;
    const bar=el('c-bar'); if(!bar)return; bar.style.width='0%';
    progT=setInterval(()=>{ prog+=100/(DELAY/100); if(bar)bar.style.width=Math.min(prog,100)+'%'; },100);
  }

  function startAuto(){ if(autoT)clearInterval(autoT); autoT=setInterval(()=>{ cur=(cur+1)%Math.min(arts.length,8); renderMain(); },DELAY); }

  window.cNav=function(dir){ cur=(cur+dir+arts.length)%Math.min(arts.length,8); renderMain(); startAuto(); };
  window.cGoTo=function(i){ cur=i; renderMain(); startAuto(); };

  async function load(){
    try{
      let a=[];
      try{
        const r=await fetch('/api/generate-articles?action=list');
        const d=await r.json();
        a=(d.articles||[]).map(x=>{ if(typeof x==='string'){try{return JSON.parse(x);}catch{return null;}} return x; }).filter(x=>x&&x.title);
      }catch{}
      if(a.length<3){
        const r2=await fetch(`${API}?action=articles`);
        const d2=await r2.json();
        a=[...a,...(d2.articles||[])];
      }
      if(!a.length){
        const m=el('carousel-main');
        if(m)m.innerHTML='<div class="c-img-ph">🏆</div><div class="c-overlay"><div style="text-align:center;padding:20px;color:var(--muted)">الأخبار ستظهر قريباً</div></div>';
        return;
      }
      arts=a; cur=0;
      renderMain(); renderThumbs(); renderDots(); startAuto();
    }catch(e){ console.error('Carousel:',e); }
  }

  document.addEventListener('DOMContentLoaded',load);
})();

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  loadAlgWidget();
  loadGroups();
  loadScores();
  loadUpcoming();
  initStandings();
  setInterval(()=>{ loadScores(); loadAlgWidget(); },60000);
});

// ══════════════════════════════════════
// WIDGET TOP STATS — أفضل الفرق والهدافين
// ══════════════════════════════════════
(function TopStats(){

  // بيانات ثابتة من كأس العالم 2026 — تُحدَّث من API
  const STATS = {
    topAttack: [
      { name:'Germany', flag:'🇩🇪', ar:'ألمانيا',     goals:5, matches:2 },
      { name:'France',  flag:'🇫🇷', ar:'فرنسا',       goals:4, matches:2 },
      { name:'Brazil',  flag:'🇧🇷', ar:'البرازيل',    goals:4, matches:2 },
    ],
    topScorers: [
      { name:'Kylian Mbappé',   flag:'🇫🇷', ar:'كيليان مبابي',   team:'فرنسا',    goals:3 },
      { name:'Vinicius Jr',     flag:'🇧🇷', ar:'فينيسيوس جونيور', team:'البرازيل', goals:3 },
      { name:'Harry Kane',      flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', ar:'هاري كين',       team:'إنجلترا',  goals:2 },
    ],
    topDefense: [
      { name:'Argentina', flag:'🇦🇷', ar:'الأرجنتين',  conceded:0, matches:2 },
      { name:'Morocco',   flag:'🇲🇦', ar:'المغرب',     conceded:0, matches:2 },
      { name:'Spain',     flag:'🇪🇸', ar:'إسبانيا',    conceded:1, matches:2 },
    ],
  };

  const TABS = [
    { key:'topAttack',  label:'⚽ أفضل الهجمات',  ar:'أكثر الفرق تسجيلاً' },
    { key:'topScorers', label:'🥇 أفضل الهدافين',  ar:'أكثر اللاعبين تسجيلاً' },
    { key:'topDefense', label:'🛡️ أفضل الدفاعات', ar:'أقل الفرق استقبالاً' },
  ];

  let current = 0;
  let autoT   = null;

  function el(id){ return document.getElementById(id); }

  function render(){
    const tab  = TABS[current];
    const data = STATS[tab.key];
    const wrap = el('top-stats-content');
    if(!wrap) return;

    // تحديث التبويبات
    document.querySelectorAll('.ts-tab').forEach((t,i)=>
      t.classList.toggle('active', i===current)
    );

    // تحديث العنوان
    const title = el('ts-title');
    if(title) title.textContent = tab.ar;

    // رسم البطاقات بأنيميشن
    wrap.style.opacity='0';
    wrap.style.transform='translateY(10px)';

    setTimeout(()=>{
      wrap.innerHTML = data.map((item,i)=>{
        const medal = i===0?'🥇':i===1?'🥈':'🥉';
        if(tab.key==='topScorers'){
          return `
            <div class="ts-item">
              <span class="ts-medal">${medal}</span>
              <span class="ts-flag">${item.flag}</span>
              <div class="ts-info">
                <div class="ts-name">${item.ar}</div>
                <div class="ts-sub">${item.team}</div>
              </div>
              <div class="ts-stat">
                <span class="ts-num">${item.goals}</span>
                <span class="ts-unit">أهداف</span>
              </div>
            </div>`;
        } else if(tab.key==='topAttack'){
          return `
            <div class="ts-item">
              <span class="ts-medal">${medal}</span>
              <span class="ts-flag">${item.flag}</span>
              <div class="ts-info">
                <div class="ts-name">${item.ar}</div>
                <div class="ts-sub">${item.matches} مباريات</div>
              </div>
              <div class="ts-stat">
                <span class="ts-num">${item.goals}</span>
                <span class="ts-unit">أهداف</span>
              </div>
            </div>`;
        } else {
          return `
            <div class="ts-item">
              <span class="ts-medal">${medal}</span>
              <span class="ts-flag">${item.flag}</span>
              <div class="ts-info">
                <div class="ts-name">${item.ar}</div>
                <div class="ts-sub">${item.matches} مباريات</div>
              </div>
              <div class="ts-stat">
                <span class="ts-num">${item.conceded}</span>
                <span class="ts-unit">استقبل</span>
              </div>
            </div>`;
        }
      }).join('');

      wrap.style.transition='opacity .4s ease,transform .4s ease';
      wrap.style.opacity='1';
      wrap.style.transform='translateY(0)';
    }, 200);
  }

  function next(){
    current = (current+1) % TABS.length;
    render();
  }

  function startAuto(){
    if(autoT) clearInterval(autoT);
    autoT = setInterval(next, 4000);
  }

  window.tsGoTo = function(i){
    current = i;
    render();
    startAuto();
  };

  // Charger les vraies données depuis ESPN + groupes
  async function loadFromAPI(){
    try{
      // 1. Récupérer les groupes pour hجوم/دفاع
      const rg = await fetch(`${API}?action=groups`);
      const dg = await rg.json();
      const groups = dg.groups||[];
      const teamStats = {};
      groups.forEach(g=>{
        g.teams.forEach(t=>{
          teamStats[t.name]={name:t.name,flag:t.flag,ar:ar(t.name),gf:t.gf||0,ga:t.ga||0,played:t.played||0};
        });
      });
      const teams = Object.values(teamStats).filter(t=>t.played>0);
      if(teams.length>0){
        STATS.topAttack=teams.sort((a,b)=>b.gf-a.gf).slice(0,3).map(t=>({name:t.name,flag:t.flag,ar:t.ar,goals:t.gf,matches:t.played}));
        STATS.topDefense=teams.sort((a,b)=>a.ga-b.ga).slice(0,3).map(t=>({name:t.name,flag:t.flag,ar:t.ar,conceded:t.ga,matches:t.played}));
      }

      // 2. Récupérer les vrais buteurs depuis ESPN live
      const rl = await fetch('/api/live');
      const dl = await rl.json();
      const scorerMap = {};
      const allMatches=[...(dl.live||[]),...(dl.recent||[])];
      allMatches.forEach(m=>{
        (m.scorers||[]).forEach(s=>{
          if(!s.player||s.player==='Joueur') return;
          const key=s.player;
          if(!scorerMap[key]){
            // Trouver le flag de l'équipe
            const teamName=s.team||'';
            const teamFlag=m.homeTeam===teamName?m.homeFlag:m.awayFlag;
            scorerMap[key]={name:s.player,ar:s.player,flag:teamFlag||'⚽',team:ar(teamName),goals:0};
          }
          scorerMap[key].goals++;
        });
      });
      const scorers=Object.values(scorerMap).filter(s=>s.goals>0).sort((a,b)=>b.goals-a.goals).slice(0,3);
      if(scorers.length>0){
        STATS.topScorers=scorers;
      }

      render();
      // Mettre à jour les dots
      document.querySelectorAll('.ts-dot').forEach((d,i)=>d.classList.toggle('active',i===current));
    }catch(e){ console.warn('TopStats API:',e.message); }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    render();
    startAuto();
    loadFromAPI();
  });
})();
