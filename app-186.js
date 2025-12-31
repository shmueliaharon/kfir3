
const VERSION = '18.6';
const DATA_URL = 'itinerary.json?v=' + VERSION;
const COUNTRY_KEY = 'selected_country_v18_6';

function el(id){ return document.getElementById(id); }
function show(x){ x.classList.remove('hidden'); }

function showFatal(title, details){
  const host = document.getElementById('viewHome') || document.body;
  const box = document.createElement('div');
  box.style.maxWidth = '900px';
  box.style.margin = '24px auto';
  box.style.padding = '16px';
  box.style.background = 'rgba(255,255,255,0.96)';
  box.style.border = '1px solid rgba(15,23,42,0.14)';
  box.style.borderRadius = '16px';
  box.innerHTML = `
    <div style="font-weight:900;font-size:18px;margin-bottom:8px">⚠️ ${title}</div>
    <div style="white-space:pre-wrap;color:rgba(15,23,42,0.78);font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;font-size:12px;line-height:1.45">${details || ''}</div>
    <div style="margin-top:10px;color:rgba(15,23,42,0.70);font-size:13px">פתח את האתר עם ?v=183 כדי לעקוף מטמון.</div>
  `;
  host.innerHTML = '';
  host.appendChild(box);
}
window.addEventListener('error', (e) => {
  try{ showFatal('שגיאה בסקריפט', (e && (e.error && (e.error.stack||e.error.message))) || (e && e.message) || String(e)); }catch(_){}
});
window.addEventListener('unhandledrejection', (e) => {
  try{ showFatal('שגיאה בהבטחה (Promise)', (e && (e.reason && (e.reason.stack||e.reason.message))) || String(e && e.reason || e)); }catch(_){}
});

function hide(x){ x.classList.add('hidden'); }

function mapsSearchUrl(q){
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q || '');
}

function parseRoute(){
  const h = (location.hash || '#/').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts.length === 0) return { name:'home' };
  if (parts[0] === 'day' && parts[1]) return { name:'day', idx: Number(parts[1]) };
  return { name:'home' };
}

async function loadData(){
  try{
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  return await res.json();
  }catch(err){
    throw new Error('שגיאה בקריאת הנתונים (itinerary.json): ' + (err && (err.message||err)));
  }

}


function getSelectedCountry(){
  try { return localStorage.getItem(COUNTRY_KEY) || 'הכל'; } catch(e){ return 'הכל'; }
}
function setSelectedCountry(v){
  try { localStorage.setItem(COUNTRY_KEY, v); } catch(e){}
}
function dayLabel(day, idx){
  const d = day.date ? day.date : ('יום ' + (idx + 1));
  const c = day.country ? day.country : '';
  const loc = day.location ? day.location : '';
  return `${d} | ${c} | ${loc}`.replace(/\s+\|\s+$/,'').replace(/^\s+\|\s+/,'');
}

function renderDayCardNode(day, idx){
  const card = document.createElement('div');
  card.className = 'dayCard';

  const loc = day.location || 'לא צוין';
  const country = day.country || 'לא צוין';
  const date = day.date || ('יום ' + (idx + 1));
  const lodging = day.lodging || 'לא צוין';
  const count = (day.places || []).length;
  const sugCount = (day.suggestions || []).length;

  card.innerHTML = `
    <div class="dayCard__top">
      <div>
        <div class="dayCard__date">${escapeHtml(date)}</div>
        <div class="dayCard__loc">${escapeHtml(loc)}</div>
        <div class="dayCard__meta">מדינה: ${escapeHtml(country)}<br>לינה: ${escapeHtml(lodging)}</div>
      </div>
      <div class="badge">${count ? (count + ' מקומות') : (sugCount ? (sugCount + ' הצעות') : 'יום')}</div>
    </div>
    <div class="dayCard__actions">
      <button type="button" class="btn" data-open="${idx}">פירוט</button>
      <a class="btn btnGhost" target="_blank" rel="noopener" href="${buildMapsLink(loc)}">פתח במפות</a>
    </div>
  `;

  card.querySelector('button[data-open]').addEventListener('click', ()=>{
    state.selectedDayIndex = idx;
    location.hash = '#day=' + (idx+1);
    route();
  });
  return card;
}

function renderHome(data){
  const selectedCountry = getSelectedCountry();
  el('appTitle').textContent = data.title || 'מסלול הטיול שלי';
  el('appSub').textContent = (selectedCountry === 'הכל')
    ? 'בחר יום כדי לראות פירוט'
    : ('מדינה נבחרת: ' + selectedCountry);
  hide(el('btnBack'));

  const q = (el('q').value || '').trim().toLowerCase();
  const list = el('dayList');
  const countryBar = el('countryBar');
  const btnMore = el('btnMore');

  const countries = Array.from(new Set((data.days || [])
    .map(d => (d.country || '').toString().trim())
    .filter(Boolean)));
  countries.sort((a,b)=>a.localeCompare(b,'he'));
  const allOptions = ['הכל', ...countries];

  if (countryBar){
    countryBar.innerHTML = allOptions.map(c => {
      const cls = 'countryChip' + (c === selectedCountry ? ' isActive' : '');
      return `<button type="button" class="${cls}" data-country="${escapeHtml(c)}">${escapeHtml(c)}</button>`;
    }).join('');
    Array.from(countryBar.querySelectorAll('button[data-country]')).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        setSelectedCountry(btn.getAttribute('data-country') || 'הכל');
        state.homeLimit = 20;
        route();
      });
    });
  }

  const days = (data.days || []).map((d,i)=>({day:d, idx:i}));

  const filtered = days.filter(({day})=>{
    const countryOk = (selectedCountry === 'הכל') || ((day.country || '').toString().trim() === selectedCountry);
    if (!countryOk) return false;
    if (!q) return true;
    const hay = [
      day.date, day.location, day.country, day.lodging,
      ...(day.transfers || []),
      ...(day.places || []).map(p=>p.name),
      ...(day.suggestions || [])
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  const total = filtered.length;
  const limit = Math.max(1, state.homeLimit || 20);
  const page = filtered.slice(0, limit);

  // רינדור מדורג כדי למנוע תקיעות במחשב/נייד
  list.innerHTML = '';
  if (!total){
    list.innerHTML = `<div class="empty">לא נמצאו ימים תואמים. נסה לשנות מדינה או חיפוש.</div>`;
    if (btnMore) btnMore.classList.add('hidden');
    return;
  }

  const frag = document.createDocumentFragment();
  page.forEach(({day, idx})=>{
    frag.appendChild(renderDayCardNode(day, idx));
  });
  list.appendChild(frag);

  if (btnMore){
    if (limit >= total){
      btnMore.classList.add('hidden');
    } else {
      btnMore.classList.remove('hidden');
      btnMore.textContent = `טען עוד (${Math.min(total, limit+20)} מתוך ${total})`;
      btnMore.onclick = ()=>{
        state.homeLimit = (state.homeLimit || 20) + 20;
        renderHome(data);
      };
    }
  }
}

function placeCard(p, fallbackQuery){
  const name = (p.name || '').toString();
  const type = (p.type || 'מקום').toString();
  const desc = (p.description || '').toString();
  const tips = (p.tips || '').toString();
  const website = (p.website || '').toString();
  const url = website ? website : mapsSearchUrl(fallbackQuery || name);

  return `
    <div class="placeCard">
      <div class="placeTop">
        <div>
          <div class="placeName">${name}</div>
          <div class="placeType">${type}</div>
        </div>
        <a class="smallLink" href="${url}" target="_blank" rel="noopener">פתח במפות</a>
      </div>
      ${desc ? `<div class="placeDesc">${desc}</div>` : ''}
      ${tips ? `<div class="placeTips"><b>טיפ:</b> ${tips}</div>` : ''}
      <div class="placeActions">
        <button class="smallBtn" data-copy="${name}">העתק שם</button>
      </div>
    </div>
  `;
}

function renderDay(data, idx){
  const day = (data.days || [])[idx];
  if (!day){
    location.hash = '#/';
    return;
  }

  el('appTitle').textContent = data.title || 'מסלול הטיול שלי';
  el('appSub').textContent = dayLabel(day, idx);
  show(el('btnBack'));

  el('dayTitle').textContent = (day.location || 'יום טיול') + (day.date ? ' (' + day.date + ')' : '');
  el('daySub').textContent = (day.country ? ('מדינה: ' + day.country + ' | ') : '') + ((day.places && day.places.length) ? ('מקומות: ' + day.places.length) : ((day.suggestions && day.suggestions.length) ? ('הצעות: ' + day.suggestions.length) : ''));
  el('dayLodging').textContent = day.lodging || 'לא צוין';

  el('daySummary').textContent = day.summary || '';

  el('btnMapsDay').href = mapsSearchUrl((day.location || '') + ' ' + (day.country || ''));

  const transfers = el('dayTransfers');
  const t = day.transfers || [];
  transfers.innerHTML = t.length ? t.map(x => `<li>${x}</li>`).join('') : '<li>לא צוינו מעברים</li>';

  const restCard = el('restaurantsCard');
  const restList = el('dayRestaurants');
  const r = day.restaurants || [];
  if (r.length){
    restList.innerHTML = r.map(x => `<li>${x}</li>`).join('');
    restCard.style.display = '';
  } else {
    restList.innerHTML = '';
    restCard.style.display = 'none';
  }

  const places = el('placesList');
  const ps = day.places || [];
  places.innerHTML = ps.map(p => placeCard(p, (day.location || '') + ' ' + (day.country || ''))).join('');

  const suggestTitle = el('suggestTitle');
  const suggestList = el('suggestList');
  const sug = day.suggestions || [];
  if (!ps.length && sug.length){
    show(suggestTitle);
    show(suggestList);
    suggestList.innerHTML = sug.map(p => placeCard(p, (day.location || '') + ' ' + (day.country || ''))).join('');
  } else {
    hide(suggestTitle);
    hide(suggestList);
    suggestList.innerHTML = '';
  }

  // copy handlers
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy') || '';
      try { await navigator.clipboard.writeText(text); } catch(e) {}
      btn.textContent = 'הועתק';
      setTimeout(() => btn.textContent = 'העתק שם', 900);
    });
  });

  hide(el('viewHome'));
  show(el('viewDay'));
}

async function main(){
  try{
  const data = await loadData();

  el('btnBack').addEventListener('click', () => { location.hash = '#/'; });
  el('btnClear').addEventListener('click', () => { el('q').value=''; renderHome(data); });

  el('q').addEventListener('input', () => {
    const r = parseRoute();
    if (r.name === 'home') renderHome(data);
  });

  function route(){
    const r = parseRoute();
    if (r.name === 'day' && Number.isFinite(r.idx) && r.idx >= 0){
      renderDay(data, r.idx);
    } else {
      renderHome(data);
    }
  }

  window.addEventListener('hashchange', route);
  route();
  }catch(err){
    console.error(err);
    showFatal('שגיאה בטעינה', String(err && (err.stack||err.message||err)));
  }
}

main();
