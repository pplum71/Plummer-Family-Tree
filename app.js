
// Tiny helper
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

// Storage keys
const KEY = 'pfh.data.v1';

// Default data (can be replaced via Import)
const defaultData = {
  people: [
    { id: 'patrick-1971', name: 'Patrick L. Plummer', birth: 1971, birthplace: 'Jamaica → USA', notes: 'Family historian.', spouse: 'taska-1973' },
    { id: 'taska-1973', name: 'Taska Plummer', birth: 1973, notes: 'Beloved spouse of Patrick.' }
  ],
  stories: [],
  photos: [],
  timeline: []
};

// Load / Save
function loadData(){
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : structuredClone(defaultData);
  } catch (e) {
    console.warn('Failed to parse data; using defaults.', e);
    return structuredClone(defaultData);
  }
}
function saveData(data){
  localStorage.setItem(KEY, JSON.stringify(data));
}
function exportData(){
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plummer-family-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      saveData(json);
      alert('Import complete. Reloading...');
      location.reload();
    } catch(e){
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
}

// Populate selects for root/person linking
function populateAllSelects(){
  const data = loadData();
  const opts = ['<option value="">— none —</option>'].concat(
    data.people.map(p => `<option value="${p.id}">${p.name}</option>`)
  ).join('');
  $$('#rootSelect, #rootSelect2, #p_father, #p_mother, #p_spouse').forEach(sel => {
    if(!sel) return;
    sel.innerHTML = opts;
  });
}

// Renderers
function renderPeopleList(container){
  const data = loadData();
  if(!container) return;
  container.innerHTML = data.people.map(p => `
    <div class="person">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <div style="font-weight:600">${p.name}</div>
          <div class="small">${p.birth ?? ''} ${p.birthplace ? ' • ' + p.birthplace : ''}</div>
          ${p.notes ? `<div class="small">${p.notes}</div>` : ''}
        </div>
        <a class="btn secondary" href="admin.html?edit=${encodeURIComponent(p.id)}">Edit</a>
      </div>
    </div>
  `).join('');
}

function renderTimeline(container){
  const data = loadData();
  if(!container) return;
  if(!data.timeline || !data.timeline.length){
    container.innerHTML = '<p class="muted">No timeline events yet. Add them on the Admin page.</p>';
    return;
  }
  container.innerHTML = data.timeline
    .sort((a,b)=> (a.year||0) - (b.year||0))
    .map(ev => `
      <div class="person">
        <div style="font-weight:600">${ev.year} — ${ev.title}</div>
        ${ev.desc ? `<div class="small">${ev.desc}</div>` : ''}
      </div>
    `).join('');
}

function renderPhotos(container){
  const data = loadData();
  if(!container) return;
  if(!data.photos || !data.photos.length){
    container.innerHTML = '<p class="muted">No photos yet. Add them on the Admin page.</p>';
    return;
  }
  container.innerHTML = data.photos.map(ph => `
    <figure>
      <img src="${ph.url}" alt="${ph.caption ?? 'photo'}"/>
      <figcaption>${ph.caption ?? ''}</figcaption>
    </figure>
  `).join('');
}

function renderStories(container){
  const data = loadData();
  if(!container) return;
  if(!data.stories || !data.stories.length){
    container.innerHTML = '<p class="muted">No stories yet. Add them on the Admin page.</p>';
    return;
  }
  container.innerHTML = data.stories.map(st => `
    <div class="person">
      <div style="font-weight:600">${st.title}</div>
      <div class="small">About: ${st.personId ?? '—'}</div>
      <div style="margin-top:6px">${st.text ?? ''}</div>
    </div>
  `).join('');
}

// Admin helpers
function readForm(){
  return {
    id: $('#p_id').value.trim() || undefined,
    name: $('#p_name').value.trim(),
    birth: parseInt($('#p_birth').value,10) || undefined,
    death: parseInt($('#p_death').value,10) || undefined,
    birthplace: $('#p_birthplace').value.trim() || undefined,
    father: $('#p_father').value || undefined,
    mother: $('#p_mother').value || undefined,
    spouse: $('#p_spouse').value || undefined,
    notes: $('#p_notes').value.trim() || undefined
  };
}

// Simple router-ish active tab highlighter
function setActiveNav(){
  const path = location.pathname.split('/').pop() || 'index.html';
  $$('.tab').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.endsWith(path)) a.classList.add('active');
  });
}

// People tab visibility (hide unless admin=true in query)
function applyPeopleTabVisibility(){
  const u = new URL(location.href);
  const isAdmin = u.searchParams.get('admin') === 'true' || location.pathname.endsWith('admin.html');
  const peopleTab = $('#peopleTab');
  if (peopleTab && !isAdmin){
    peopleTab.classList.add('hide-people-tab');
  }
}

document.addEventListener('DOMContentLoaded', () => {
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  applyPeopleTabVisibility();

  // HYDRATE FROM data.json (live site) then render sections
  (async () => {
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && serverData.people) {
          // Make fetched data available to existing renderers that call loadData()
          saveData(serverData);
        }
      }
    } catch (e) {
      // no data.json yet; fall back to localStorage defaults
    }

    // Render sections if their containers exist
    const photosEl = document.getElementById('photosGrid');
    if (photosEl) renderPhotos(photosEl);

    const storiesEl = document.getElementById('storiesList');
    if (storiesEl) renderStories(storiesEl);

    const timelineEl = document.getElementById('timeline');
    if (timelineEl) renderTimeline(timelineEl);

    const peopleEl = document.getElementById('peopleList');
    if (peopleEl) renderPeopleList(peopleEl);
  })();
});


// -------- GEDCOM IMPORT --------
// Very small GEDCOM reader (handles INDI/FAM essentials).
// Extracts: name, birth/death year/place, parents/children, spouse links.
function parseGedcom(text){
  const lines = text.split(/\r?\n/);
  const recs = {};
  let current = null;

  function startRec(xref, tag){
    current = { xref, tag, data: [] };
    recs[xref] = current;
  }

  for (const raw of lines){
    if(!raw.trim()) continue;
    const m = raw.match(/^(\d+)\s+(@[^@]+@)?\s*([A-Z0-9_]+)(?:\s+(.*))?$/i);
    if(!m) continue;
    const level = parseInt(m[1], 10);
    const xref = m[2] || null;
    const tag  = (m[3] || '').toUpperCase();
    const val  = (m[4] || '').trim();

    if(level === 0 && xref && (tag === 'INDI' || tag === 'FAM')){
      startRec(xref, tag);
    } else if(current){
      current.data.push({ level, tag, val });
    }
  }

  const individuals = {};
  const families = {};

  // Normalize records
  for(const [xref, rec] of Object.entries(recs)){
    if(rec.tag === 'INDI'){
      const ind = { xref, famc: [], fams: [] };
      // Walk sub-tags
      let name = null, sex = null, birth = {}, death = {}, note = null, bp=null;
      for(const row of rec.data){
        if(row.tag === 'NAME') name = row.val;
        else if(row.tag === 'SEX') sex = row.val;
        else if(row.tag === 'FAMC') ind.famc.push(row.val);
        else if(row.tag === 'FAMS') ind.fams.push(row.val);
      }
      // Second pass for BIRT/DEAT with child tags
      for(let i=0;i<rec.data.length;i++){
        const r = rec.data[i];
        if(r.tag === 'BIRT'){
          // read following level+1
          let j = i+1; birth = {};
          while(j < rec.data.length && rec.data[j].level > r.level){
            if(rec.data[j].tag === 'DATE') birth.date = rec.data[j].val;
            if(rec.data[j].tag === 'PLAC') birth.place = rec.data[j].val;
            j++;
          }
        }
        if(r.tag === 'DEAT'){
          let j = i+1; death = {};
          while(j < rec.data.length && rec.data[j].level > r.level){
            if(rec.data[j].tag === 'DATE') death.date = rec.data[j].val;
            if(rec.data[j].tag === 'PLAC') death.place = rec.data[j].val;
            j++;
          }
        }
        if(r.tag === 'NOTE') note = (note? note+"\n":"") + r.val;
      }
      individuals[xref] = {
        xref,
        name: name || '(Unknown)',
        sex,
        birth, death, note,
        famc: ind.famc, fams: ind.fams
      };
    } else if(rec.tag === 'FAM'){
      const fam = { xref, husb: null, wife: null, children: [] };
      for(const row of rec.data){
        if(row.tag === 'HUSB') fam.husb = row.val;
        else if(row.tag === 'WIFE') fam.wife = row.val;
        else if(row.tag === 'CHIL') fam.children.push(row.val);
      }
      families[xref] = fam;
    }
  }

  // Build simple site data model
  // Map xref -> person id
  const idMap = new Map();

  function yearFromDate(s){
    if(!s) return undefined;
    const m = s.match(/(1[6-9]\d{2}|20\d{2}|21\d{2})/);
    return m ? parseInt(m[1],10) : undefined;
  }

  // Create people first
  const people = Object.values(individuals).map(ind => {
    const birthYear = yearFromDate(ind.birth?.date);
    const cleanName = ind.name.replace(/\s*\/([^\/]+)\//g, (m,surn)=> ` ${surn}`); // "John /Smith/" -> "John Smith"
    const id = (cleanName || ind.xref).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    idMap.set(ind.xref, id);
    return {
      id,
      name: cleanName,
      birth: birthYear,
      death: yearFromDate(ind.death?.date),
      birthplace: ind.birth?.place || undefined,
      notes: ind.note || undefined
    };
  });

  // Link parents/spouse via families
  // Build reverse index person xref -> fams/famc already in individuals
  const idx = {};
  for(const [xref, ind] of Object.entries(individuals)){
    idx[xref] = { famc: ind.famc, fams: ind.fams };
  }

  // Parents: if a person has famc[0], look up family and set father/mother
  const byId = new Map(people.map(p=>[p.id,p]));
  for(const [xref, ind] of Object.entries(individuals)){
    const p = byId.get(idMap.get(xref));
    if(!p) continue;
    const famRef = ind.famc[0];
    const fam = famRef ? families[famRef] : null;
    if(fam){
      const fatherId = fam.husb ? idMap.get(fam.husb) : undefined;
      const motherId = fam.wife ? idMap.get(fam.wife) : undefined;
      if(fatherId) p.father = fatherId;
      if(motherId) p.mother = motherId;
    }
    // Spouse: take first FAMS and set spouse to the other partner in that family
    const famsRef = ind.fams[0];
    const famS = famsRef ? families[famsRef] : null;
    if(famS){
      const spouseX = (famS.husb === xref) ? famS.wife : (famS.wife === xref ? famS.husb : null);
      if(spouseX){
        const spouseId = idMap.get(spouseX);
        if(spouseId) p.spouse = spouseId;
      }
    }
  }

  return { people, stories: [], photos: [], timeline: [] };
}

function wireGedcomImport(){
  const btn = document.getElementById('importGedBtn');
  const file = document.getElementById('gedFile');
  const status = document.getElementById('gedStatus');
  if(!btn || !file) return;
  btn.addEventListener('click', ()=>{
    if(!file.files || !file.files[0]){
      alert('Choose a .GED file first.');
      return;
    }
    const f = file.files[0];
    const reader = new FileReader();
    status.textContent = 'Parsing GEDCOM…';
    reader.onload = () => {
      try{
        const text = reader.result;
        const data = parseGedcom(text);
        saveData(data);
        status.textContent = `Imported ${data.people.length} people. Saved to your browser storage.`;
        alert('GEDCOM import complete. Open People/Tree to view.');
      }catch(e){
        console.error(e);
        status.textContent = 'Failed to import GEDCOM.';
        alert('Sorry, could not parse this GEDCOM.');
      }
    };
    reader.readAsText(f);
  });
}

document.addEventListener('DOMContentLoaded', wireGedcomImport);
