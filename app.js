
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
  container.innerHTML = data.photos.map(ph => `\n    <figure>\n      <img src="${ph.url}" alt="${ph.caption ?? 'photo'}"/>\n      <figcaption>${ph.caption ?? ''}${ph.dateTaken ? ` • ${ph.dateTaken}` : ``}</figcaption>\n    </figure>\n  `).join('');\n}

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
  setActiveNav();
  applyPeopleTabVisibility();
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


// -------- Admin: Stories / Photos / Timeline wiring --------
function populatePersonSelect(sel){
  const data = loadData();
  const opts = ['<option value="">— attach to person (optional) —</option>'].concat(
    data.people.map(p => `<option value="${p.id}">${p.name}</option>`)
  ).join('');
  sel.innerHTML = opts;
}

function renderStoriesAdmin(){
  const el = $('#storiesAdminList'); if(!el) return;
  const d = loadData();
  if(!d.stories?.length){ el.innerHTML = '<div class="muted small">No stories yet.</div>'; return; }
  el.innerHTML = d.stories.map((s, i) => `
    <div class="person">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div>
          <div style="font-weight:600">${s.title}</div>
          <div class="small">${s.personId || '—'}</div>
          <div class="small" style="margin-top:6px">${(s.text||'').slice(0,180)}${(s.text||'').length>180?'…':''}</div>
        </div>
        <button class="btn warn" data-del-story="${i}">Delete</button>
      </div>
    </div>
  `).join('');
  $$('[data-del-story]').forEach(btn => btn.addEventListener('click', e => {
    const idx = parseInt(e.currentTarget.dataset.delStory, 10);
    const d = loadData(); d.stories.splice(idx,1); saveData(d); renderStoriesAdmin();
  }));
}

function renderPhotosAdmin(){
  const el = $('#photosAdminList'); if(!el) return;
  const d = loadData();
  if(!d.photos?.length){ el.innerHTML = '<div class="muted small">No photos yet.</div>'; return; }
  el.innerHTML = d.photos.map((p, i) => `
    <figure>
      <img src="${p.url}" alt="${p.caption||'photo'}">
      <figcaption>${p.caption || ''} ${(p.personId? '• '+p.personId : '')} ${p.dateTaken? '• '+p.dateTaken : ''}</figcaption>
      <div style="padding:8px">
        <button class="btn warn" data-del-photo="${i}">Delete</button>
      </div>
    </figure>
  `).join('');
  $$('[data-del-photo]').forEach(btn => btn.addEventListener('click', e => {
    const idx = parseInt(e.currentTarget.dataset.delPhoto, 10);
    const d = loadData(); d.photos.splice(idx,1); saveData(d); renderPhotosAdmin();
  }));
}

function renderTimelineAdmin(){
  const el = $('#timelineAdminList'); if(!el) return;
  const d = loadData();
  if(!d.timeline?.length){ el.innerHTML = '<div class="muted small">No events yet.</div>'; return; }
  el.innerHTML = d.timeline.sort((a,b)=>(a.year||0)-(b.year||0)).map((t,i)=>`
    <div class="person">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div>
          <div style="font-weight:600">${t.year||''} — ${t.title||''}</div>
          ${t.desc? `<div class="small">${t.desc}</div>`:''}
        </div>
        <button class="btn warn" data-del-evt="${i}">Delete</button>
      </div>
    </div>
  `).join('');
  $$('[data-del-evt]').forEach(btn => btn.addEventListener('click', e => {
    const idx = parseInt(e.currentTarget.dataset.delEvt, 10);
    const d = loadData(); d.timeline.splice(idx,1); saveData(d); renderTimelineAdmin();
  }));
}

function wireAdminEnhancements(){
  if(!$('#addStory') && !$('#addPhoto') && !$('#addEvent')) return;

  // Populate selects
  if($('#st_person')) populatePersonSelect($('#st_person'));
  if($('#ph_person')) populatePersonSelect($('#ph_person'));

  // Stories
  $('#addStory')?.addEventListener('click', ()=>{
    const title = $('#st_title').value.trim();
    const text = $('#st_text').value.trim();
    const personId = $('#st_person').value || undefined;
    if(!title || !text){ alert('Please enter a title and text.'); return; }
    const d = loadData();
    d.stories = d.stories || [];
    d.stories.push({ title, text, personId });
    saveData(d);
    $('#st_title').value = ''; $('#st_text').value=''; $('#st_person').value='';
    renderStoriesAdmin();
    alert('Story added.');
  });
  $('#clearStory')?.addEventListener('click', ()=>{ $('#st_title').value=''; $('#st_text').value=''; $('#st_person').value=''; });
  renderStoriesAdmin();

  // Photos
  $('#addPhoto')?.addEventListener('click', ()=>{
    const url = $('#ph_url').value.trim();
    const caption = $('#ph_caption').value.trim() || undefined;
    const personId = $('#ph_person').value || undefined;
    if(!url){ alert('Enter an image URL.'); return; }
    const d = loadData();
    d.photos = d.photos || [];
    d.photos.push({ url, caption, personId });
    saveData(d);
    $('#ph_url').value=''; $('#ph_caption').value=''; $('#ph_person').value='';
    renderPhotosAdmin();
    alert('Photo added.');
  });
  $('#clearPhoto')?.addEventListener('click', ()=>{ $('#ph_url').value=''; $('#ph_caption').value=''; $('#ph_person').value=''; });
  renderPhotosAdmin();

  // Timeline
  $('#addEvent')?.addEventListener('click', ()=>{
    const year = parseInt($('#tl_year').value,10) || undefined;
    const title = $('#tl_title').value.trim();
    const desc = $('#tl_desc').value.trim() || undefined;
    if(!title){ alert('Enter an event title.'); return; }
    const d = loadData();
    d.timeline = d.timeline || [];
    d.timeline.push({ year, title, desc });
    saveData(d);
    $('#tl_year').value=''; $('#tl_title').value=''; $('#tl_desc').value='';
    renderTimelineAdmin();
    alert('Event added.');
  });
  $('#clearEvent')?.addEventListener('click', ()=>{ $('#tl_year').value=''; $('#tl_title').value=''; $('#tl_desc').value=''; });
  renderTimelineAdmin();
}

document.addEventListener('DOMContentLoaded', wireAdminEnhancements);

// -------- Logo swap: if assets/crest.png exists, replace inline SVG with it --------
function trySwapLogo(){
  const crest = document.querySelector('.crest');
  if(!crest) return;
  const testImg = new Image();
  testImg.onload = () => {
    const img = document.createElement('img');
    img.className = 'crest';
    img.src = 'assets/crest.png';
    img.alt = 'Family crest';
    crest.replaceWith(img);
  };
  testImg.onerror = ()=>{};
  testImg.src = 'assets/crest.png';
}
document.addEventListener('DOMContentLoaded', trySwapLogo);


// -------- GitHub Uploader & Logo Picker --------
const GHKEY = 'pfh.github.settings';
function getGh(){
  try{
    return JSON.parse(localStorage.getItem(GHKEY)) || {};
  }catch(e){ return {}; }
}
function saveGh(s){
  localStorage.setItem(GHKEY, JSON.stringify(s));
}
function ghHeaders(token){
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json'
  };
}
async function ghEnsurePath(owner, repo, branch, path){
  // Contents API creates new files; no explicit "mkdir" needed if path prefix exists.
  // We just ensure branch defaults.
  return true;
}
async function ghPutFile({owner, repo, branch='main', path, token, contentB64, message='Add file via PFH Admin', sha=null}){
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = { message, content: contentB64, branch };
  if(sha) body.sha = sha;
  const res = await fetch(url, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) });
  if(!res.ok){
    const t = await res.text();
    throw new Error(`GitHub error ${res.status}: ${t}`);
  }
  return res.json();
}
async function ghGetSha({owner, repo, path, token, ref}){
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${ref?`?ref=${encodeURIComponent(ref)}`:''}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if(res.status === 404) return null;
  if(!res.ok){ throw new Error('Failed to check existing file'); }
  const j = await res.json();
  return j.sha || null;
}
function getGhSettingsFromForm(){
  return {
    owner: $('#gh_owner')?.value.trim(),
    repo: $('#gh_repo')?.value.trim(),
    branch: $('#gh_branch')?.value.trim() || 'main',
    path: $('#gh_path')?.value.trim() || 'assets',
    token: $('#gh_token')?.value.trim()
  };
}
function loadGhSettingsToForm(){
  const s = getGh();
  if($('#gh_owner')) $('#gh_owner').value = s.owner || '';
  if($('#gh_repo')) $('#gh_repo').value = s.repo || '';
  if($('#gh_branch')) $('#gh_branch').value = s.branch || 'main';
  if($('#gh_path')) $('#gh_path').value = s.path || 'assets';
  // For safety, do not auto-fill the token input field
}
function readGhEffective(){
  const s = {...getGh(), ...getGhSettingsFromForm()};
  // prefer persisted token if form token left blank
  if(!s.token){
    const saved = getGh();
    if(saved.token) s.token = saved.token;
  }
  return s;
}
function toBase64File(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = () => {
      // result is data:...;base64,xxxx
      const b64 = String(r.result).split('base64,')[1] || '';
      resolve(b64);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function wireGithubUI(){
  const saveBtn = $('#ghSave');
  const clearBtn = $('#ghClear');
  saveBtn?.addEventListener('click', ()=>{
    const s = getGhSettingsFromForm();
    if(!s.owner || !s.repo){ alert('Owner and Repo are required.'); return; }
    if(s.token) {
      // Persist token only if provided; otherwise keep previous
      const prev = getGh();
      saveGh({ ...prev, ...s });
    } else {
      const prev = getGh();
      saveGh({ ...prev, owner: s.owner, repo: s.repo, branch: s.branch, path: s.path });
    }
    alert('GitHub settings saved to this browser.');
  });
  clearBtn?.addEventListener('click', ()=>{
    localStorage.removeItem(GHKEY);
    alert('Cleared saved GitHub settings from this browser.');
    loadGhSettingsToForm();
  if($('#gh_person_link')) populatePersonSelect($('#gh_person_link'));
  });

  loadGhSettingsToForm();
  if($('#gh_person_link')) populatePersonSelect($('#gh_person_link'));

  const picker = $('#filePicker');
  const dropZone = $('#dropZone');
  const uploadBtn = $('#uploadBtn');
  const log = $('#uploadLog');
  const logoPicker = $('#logoPicker');
  const uploadLogoBtn = $('#uploadLogoBtn');

  // Drag & drop
  if(dropZone){
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.background='#111826'; });
    dropZone.addEventListener('dragleave', e => { dropZone.style.background=''; });
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.style.background='';
      if(picker) picker.files = e.dataTransfer.files;
    });
  }

  uploadBtn?.addEventListener('click', async ()=>{
    try{
      const s = readGhEffective();
      if(!s.owner || !s.repo || !s.token){ alert('Owner, Repo, and Token are required.'); return; }
      const files = picker?.files;
      if(!files || !files.length){ alert('Choose one or more images.'); return; }
      const subdir = ($('#gh_subdir')?.value.trim() || '').replace(/^\/+|\/+$/g,'');
      const prefix = $('#gh_prefix')?.value.trim() || '';
      log.textContent = 'Uploading...';

      for(const f of files){
        const exif = await readExifDateFromFile(f);
        const b64 = await toBase64File(f);
        const safeName = (prefix + f.name).replace(/[^A-Za-z0-9._-]+/g,'_');
        const rel = [s.path, subdir].filter(Boolean).join('/');
        const path = rel ? `${rel}/${safeName}` : `${safeName}`;

        // Check if exists -> get sha (update), else create
        const sha = await ghGetSha({owner:s.owner, repo:s.repo, path, token:s.token, ref:s.branch});
        await ghPutFile({
          owner:s.owner, repo:s.repo, branch:s.branch, path,
          token:s.token, contentB64:b64,
          message:`Add image ${safeName} via PFH Admin`,
          sha: sha || null
        });
      }
      log.textContent = 'Upload complete.';
      alert('Upload complete.');
    }catch(e){
      console.error(e);
      alert('Upload failed: ' + e.message);
    }
  });

  uploadLogoBtn?.addEventListener('click', async ()=>{
    try{
      const s = readGhEffective();
      if(!s.owner || !s.repo || !s.token){ alert('Owner, Repo, and Token are required.'); return; }
      const f = logoPicker?.files?.[0];
      if(!f){ alert('Choose a logo image first.'); return; }
      const b64 = await toBase64File(f);
      const path = (s.path || 'assets').replace(/^\/+|\/+$/g,'') + '/crest.png';
      const sha = await ghGetSha({owner:s.owner, repo:s.repo, path, token:s.token, ref:s.branch});
      await ghPutFile({
        owner:s.owner, repo:s.repo, branch:s.branch, path,
        token:s.token, contentB64:b64,
        message:`Set crest.png via PFH Admin`,
        sha: sha || null
      });
      alert('Logo uploaded. Reload to see it.');
    }catch(e){
      console.error(e);
      alert('Logo upload failed: ' + e.message);
    }
  });
}
document.addEventListener('DOMContentLoaded', wireGithubUI);


// ---- PFH Prefill defaults for Patrick (pplum71) ----
document.addEventListener('DOMContentLoaded', ()=>{
  // Prefill defaults if fields are empty
  const owner = document.getElementById('gh_owner');
  const repo  = document.getElementById('gh_repo');
  const branch= document.getElementById('gh_branch');
  const path  = document.getElementById('gh_path');
  if (owner && !owner.value) owner.value = 'pplum71';
  if (repo  && !repo.value)  repo.value  = 'Plummer-Family-Tree';
  if (branch&& !branch.value)branch.value= 'main';
  if (path  && !path.value)  path.value  = 'assets';

  const pre = document.getElementById('ghPrefill');
  pre?.addEventListener('click', ()=>{
    if(owner) owner.value = 'pplum71';
    if(repo)  repo.value  = 'Plummer-Family-Tree';
    if(branch)branch.value= 'main';
    if(path)  path.value  = 'assets';
    alert('Prefilled. Paste your GitHub token and click Save Settings.');
  });
});


// Render uploaded files with actions
function renderUploadedList(list, personId){
  const log = $('#uploadLog');
  if(!log) return;
  if(!list || !list.length){
    log.innerHTML = '<span class="muted">No files uploaded yet.</span>';
    return;
  }
  const rows = list.map((it, idx)=>`
    <div class="person" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div>
        <div style="font-weight:600">${it.name}</div>
        <div class="small">${it.path}</div>
        <div class="small"><a href="${it.url}" target="_blank" rel="noopener">Open URL</a> ${it.exifDate? "• EXIF: "+it.exifDate : ""}</div>
      </div>
      <div class="row" style="max-width:340px">
        <button class="btn secondary" data-copy="${idx}">Copy URL</button>
        <button class="btn" data-insert="${idx}">Insert into Photos</button>
      </div>
    </div>
  `).join('');
  log.innerHTML = rows;

  // Wire actions
  $$('[data-copy]').forEach(btn => btn.addEventListener('click', e => {
    const i = parseInt(e.currentTarget.dataset.copy, 10);
    const url = list[i]?.url;
    if(url) navigator.clipboard?.writeText(url).then(()=> alert('URL copied to clipboard.'));
  }));
  $$('[data-insert]').forEach(btn => btn.addEventListener('click', e => {
    const i = parseInt(e.currentTarget.dataset.insert, 10);
    const item = list[i];
    if(!item) return;
    const d = loadData();
    d.photos = d.photos || [];
    const personSel = $('#gh_person_link');
    const pid = personSel ? (personSel.value || undefined) : undefined;
    const caption = item.name;
    const __dt = chooseDateTaken(item.exifDate, readDateTaken());
    d.photos.push({ url: item.url, caption: computeUploadCaption(item.name), personId: pid, dateTaken: __dt });
    maybeAddTimelineForPhoto(item, computeUploadCaption(item.name), __dt);
    saveData(d);
    alert('Added to Photos. See Photos page.');
  }));
}


// ---- Live thumbnail preview and bulk actions ----
function previewFilesList(input, host){
  if(!input || !host) return;
  const files = input.files;
  if(!files || !files.length){ host.innerHTML = '<div class="muted small">No files selected.</div>'; return; }
  const items = [];
  for(const f of files){
    const url = URL.createObjectURL(f);
    items.push(`<figure><img src="${url}" alt="${f.name}"><figcaption>${f.name}</figcaption></figure>`);
  }
  host.innerHTML = items.join('');
}

let __lastUploadResults = []; // cache most recent uploaded results

// Extend renderUploadedList to track results
const __origRenderUploadedList = (typeof renderUploadedList === 'function') ? renderUploadedList : null;
renderUploadedList = function(list, personId){
  __lastUploadResults = list || [];
  if(__origRenderUploadedList){ __origRenderUploadedList(list, personId); }
  // Enable/disable bulk insert button
  const bulkBtn = $('#insertAllBtn');
  if(bulkBtn) bulkBtn.disabled = !(__lastUploadResults.length);
};

document.addEventListener('DOMContentLoaded', ()=>{
  const picker = $('#filePicker');
  const previewHost = $('#uploadPreview');
  const bulkBtn = $('#insertAllBtn');
  const clearBtn = $('#clearListBtn');

  picker?.addEventListener('change', ()=> previewFilesList(picker, previewHost));

  bulkBtn?.addEventListener('click', ()=>{
    if(!__lastUploadResults.length){ alert('No uploaded images to insert. Upload first.'); return; }
    const d = loadData();
    d.photos = d.photos || [];
    const personSel = $('#gh_person_link');
    const pid = personSel ? (personSel.value || undefined) : undefined;
    for(const item of __lastUploadResults){
      const __dt = chooseDateTaken(item.exifDate, readDateTaken());
    d.photos.push({ url: item.url, caption: computeUploadCaption(item.name), personId: pid, dateTaken: __dt });
    maybeAddTimelineForPhoto(item, computeUploadCaption(item.name), __dt);
    }
    saveData(d);
    alert('All uploaded images added to Photos.');
  });

  clearBtn?.addEventListener('click', ()=>{
    const log = $('#uploadLog'); if(log) log.innerHTML='';
    if(previewHost) previewHost.innerHTML='';
    __lastUploadResults = [];
  });
});


function computeUploadCaption(fileName){
  const mode = $('#gh_caption_mode') ? $('#gh_caption_mode').value : 'filename';
  const shared = $('#gh_shared_caption') ? $('#gh_shared_caption').value.trim() : '';
  if(mode === 'shared' && shared) return shared;
  if(mode === 'name') return fileName;
  // default filename without extension
  const noExt = fileName.replace(/\.[^.]+$/, '');
  return noExt;
}
function readDateTaken(){
  const d = $('#gh_date_taken') ? $('#gh_date_taken').value : '';
  return d || undefined;
}


// ---- Minimal EXIF date reader (JPEG only) ----
async function readExifDateFromFile(file){
  try{
    const buf = await file.arrayBuffer();
    const dv = new DataView(buf);
    // JPEG starts with 0xFFD8
    if (dv.getUint16(0) !== 0xFFD8) return undefined;
    let offset = 2;
    while (offset < dv.byteLength){
      if (dv.getUint8(offset) !== 0xFF) return undefined;
      const marker = dv.getUint8(offset+1);
      const size = dv.getUint16(offset+2);
      // APP1 marker (Exif) is 0xE1
      if (marker === 0xE1){
        // Exif header: "Exif\0\0"
        const exifHeader = new Uint8Array(buf, offset+4, 6);
        const txt = new TextDecoder().decode(exifHeader);
        if (txt.startsWith('Exif')){
          const tiffOffset = offset + 10; // after "Exif\0\0"
          const tiffDv = new DataView(buf, tiffOffset);
          // Byte order
          const endian = tiffDv.getUint16(0);
          const le = endian === 0x4949; // 'II' little endian
          const get16 = (o)=> le ? tiffDv.getUint16(o, true) : tiffDv.getUint16(o, false);
          const get32 = (o)=> le ? tiffDv.getUint32(o, true) : tiffDv.getUint32(o, false);

          // Check TIFF magic 42 at offset 2
          if (get16(2) !== 42) return undefined;
          const ifd0 = get32(4);
          // Walk IFD0 to find ExifIFD pointer tag 0x8769
          let exifIFDOffset = 0;
          const entries0 = get16(ifd0);
          for (let i=0; i<entries0; i++){
            const pos = ifd0 + 2 + i*12;
            const tag = get16(pos);
            if (tag === 0x8769){ // ExifIFD
              exifIFDOffset = get32(pos + 8);
              break;
            }
          }
          // Helper to read ASCII value
          function readAscii(ifdBase, entryPos){
            const count = get32(entryPos + 4);
            let valOffset = get32(entryPos + 8);
            // If count <= 4, value may be in-place, but typical Exif puts offset
            const start = ifdBase + valOffset;
            const bytes = new Uint8Array(buf, tiffOffset + valOffset, Math.max(0, Math.min(count, buf.byteLength - (tiffOffset + valOffset))));
            let s = '';
            for (let b of bytes){ if (b === 0) break; s += String.fromCharCode(b); }
            return s;
          }
          // Search ExifIFD for DateTimeOriginal 0x9003; fallback to IFD0 DateTime 0x0132
          function findDateInIFD(ifdBase){
            const count = get16(ifdBase);
            for (let i=0;i<count;i++){
              const pos = ifdBase + 2 + i*12;
              const tag = get16(pos);
              const type = get16(pos+2); // 2 = ASCII
              if ((tag === 0x9003 || tag === 0x0132) && type === 2){
                let s = readAscii(ifdBase, pos); // "YYYY:MM:DD HH:MM:SS"
                s = s.replace(/:/g, (m, idx)=> idx<4?'-': idx<7?'-':' ').replace(' ', 'T'); // basic ISO
                return s.substring(0,19); // "YYYY-MM-DDTHH:MM:SS"
              }
            }
            return undefined;
          }
          let exifDate;
          if (exifIFDOffset){
            exifDate = findDateInIFD(exifIFDOffset);
          }
          // fallback to DateTime in IFD0
          if (!exifDate){
            exifDate = findDateInIFD(ifd0);
          }
          if (exifDate){
            // Convert to YYYY-MM-DD if only date needed
            const ymd = exifDate.split('T')[0];
            return ymd;
          }
        }
      }
      offset += 2 + size;
    }
  }catch(e){
    // ignore
  }
  return undefined;
}
function preferExif(){
  return !!($('#gh_exif_prefer')?.checked);
}


function manualOverride(){ return !!($('#gh_manual_override')?.checked); }
function chooseDateTaken(exifDate, manualDate){
  // If manual override selected and manual date provided, use manual.
  if (manualOverride() && manualDate) return manualDate;
  // Else if prefer EXIF and exif present, use exif; else manual.
  if (preferExif() && exifDate) return exifDate;
  return manualDate || exifDate || undefined;
}
function maybeAddTimelineForPhoto(item, caption, dateTaken){
  try{
    if(!dateTaken) return;
    const year = parseInt(String(dateTaken).slice(0,4), 10);
    if(!year || isNaN(year)) return;
    const currentYear = new Date().getFullYear();
    if (year <= currentYear - 50){
      const d = loadData();
      d.timeline = d.timeline || [];
      d.timeline.push({
        year,
        title: `Historic photo: ${caption}`,
        desc: item.url || ''
      });
      saveData(d);
    }
  } catch(e){ /* ignore */ }
}


// ---- Generate Timeline events from Photos (>=50 years old) ----
function generateTimelineFromPhotos(skipDup=true){
  const d = loadData();
  d.timeline = d.timeline || [];
  d.photos = d.photos || [];
  const nowY = new Date().getFullYear();
  const existingKeys = new Set(
    d.timeline.map(ev => `${ev.year || ''}|${(ev.desc || '').trim()}`)
  );
  let added = 0;
  for(const ph of d.photos){
    if(!ph.dateTaken || !ph.url) continue;
    const y = parseInt(String(ph.dateTaken).slice(0,4), 10);
    if(!y || isNaN(y)) continue;
    if(y > nowY - 50) continue; // only 50+ years old
    const key = `${y}|${ph.url.trim()}`;
    if(skipDup && existingKeys.has(key)) continue;
    d.timeline.push({ year: y, title: `Historic photo: ${ph.caption || 'Untitled'}`, desc: ph.url });
    existingKeys.add(key);
    added++;
  }
  saveData(d);
  return added;
}

document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('genFromPhotosBtn');
  btn?.addEventListener('click', ()=>{
    const skip = document.getElementById('skipDuplicates')?.checked ?? true;
    const n = generateTimelineFromPhotos(skip);
    renderTimelineAdmin?.();
    alert(n ? `Added ${n} timeline event(s).` : 'No eligible photos found (need dateTaken >= 50 years ago).');
  });
});


// ---- CSV Export helpers ----
function toCsvLine(arr){
  return arr.map(v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }).join(',');
}
function downloadCsv(name, rows){
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportPeopleCsv(){
  const d = loadData();
  const rows = [];
  rows.push(toCsvLine(['id','name','birth','death','birthplace','father','mother','spouse','notes']));
  for(const p of (d.people||[])){
    rows.push(toCsvLine([p.id||'', p.name||'', p.birth||'', p.death||'', p.birthplace||'', p.father||'', p.mother||'', p.spouse||'', p.notes||'']));
  }
  downloadCsv('people.csv', rows);
}
function exportPhotosCsv(){
  const d = loadData();
  const rows = [];
  rows.push(toCsvLine(['url','caption','personId','dateTaken']));
  for(const p of (d.photos||[])){
    rows.push(toCsvLine([p.url||'', p.caption||'', p.personId||'', p.dateTaken||'']));
  }
  downloadCsv('photos.csv', rows);
}
function exportTimelineCsv(){
  const d = loadData();
  const rows = [];
  rows.push(toCsvLine(['year','title','desc']));
  for(const t of (d.timeline||[])){
    rows.push(toCsvLine([t.year||'', t.title||'', t.desc||'']));
  }
  downloadCsv('timeline.csv', rows);
}


// ---- Copy CSV helpers ----
async function copyCsv(text){
  try{
    await navigator.clipboard.writeText(text);
    alert('CSV copied to clipboard.');
  }catch(e){
    alert('Clipboard failed. You can still download the CSV.');
  }
}

function getPeopleCsvText(){
  const d = loadData();
  const rows = [];
  rows.push(toCsvLine(['id','name','birth','death','birthplace','father','mother','spouse','notes']));
  for(const p of (d.people||[])){
    rows.push(toCsvLine([p.id||'', p.name||'', p.birth||'', p.death||'', p.birthplace||'', p.father||'', p.mother||'', p.spouse||'', p.notes||'']));
  }
  return rows.join('\n');
}
function getPhotosCsvText(){
  const d = loadData();
  const rows = [];
  rows.push(toCsvLine(['url','caption','personId','dateTaken']));
  for(const p of (d.photos||[])){
    rows.push(toCsvLine([p.url||'', p.caption||'', p.personId||'', p.dateTaken||'']));
  }
  return rows.join('\n');
}
function getTimelineCsvText(){
  const d = loadData();
  const rows = [];
  rows.push(toCsvLine(['year','title','desc']));
  for(const t of (d.timeline||[])){
    rows.push(toCsvLine([t.year||'', t.title||'', t.desc||'']));
  }
  return rows.join('\n');
}

// ---- ZIP export (JSON + CSVs) ----
async function exportZipAll(){
  const zip = new JSZip();
  const d = loadData();
  zip.file('data.json', JSON.stringify(d, null, 2));
  zip.file('people.csv', getPeopleCsvText());
  zip.file('photos.csv', getPhotosCsvText());
  zip.file('timeline.csv', getTimelineCsvText());
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'family-backup.zip';
  a.click();
  URL.revokeObjectURL(a.href);
}


/* === PFH: Modal/Undo/Restore/GED === */

// Modal helpers
function pfhOpenModal(title, html, actions){
  const wrap = document.getElementById('pfhModal');
  const t = document.getElementById('pfhModalTitle');
  const b = document.getElementById('pfhModalBody');
  const a = document.getElementById('pfhModalActions');
  if(!wrap || !t || !b || !a){ alert(title + '\n' + (html?.replace(/<[^>]+>/g,' ') || '')); return; }
  t.textContent = title || 'Review';
  b.innerHTML = html || '';
  a.innerHTML = '';
  (actions || []).forEach(btn => {
    const el = document.createElement('button');
    el.className = 'btn' + (btn.variant ? (' ' + btn.variant) : '');
    el.textContent = btn.label || 'OK';
    el.addEventListener('click', btn.onClick || (()=>{}));
    a.appendChild(el);
  });
  wrap.style.display = 'flex';
}
function pfhCloseModal(){
  const wrap = document.getElementById('pfhModal');
  if(wrap) wrap.style.display = 'none';
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('pfhModalClose')?.addEventListener('click', pfhCloseModal);
  document.getElementById('pfhModal')?.addEventListener('click', (e)=>{
    if(e.target && e.target.id === 'pfhModal') pfhCloseModal();
  });
});

// Undo snapshots
const UNDO_KEY = 'pfh.undo.stack';
function pushUndoSnapshot(){
  const d = loadData();
  const stack = JSON.parse(localStorage.getItem(UNDO_KEY) || '[]');
  stack.push({ ts: new Date().toISOString(), data: d });
  while(stack.length > 10) stack.shift();
  localStorage.setItem(UNDO_KEY, JSON.stringify(stack));
}
function popUndoSnapshot(){
  const stack = JSON.parse(localStorage.getItem(UNDO_KEY) || '[]');
  if(!stack.length) return null;
  const snap = stack.pop();
  localStorage.setItem(UNDO_KEY, JSON.stringify(stack));
  return snap;
}
function undoLastChange(){
  const snap = popUndoSnapshot();
  if(!snap){ alert('No undo snapshot available.'); return; }
  saveData(snap.data);
  alert('Restored previous snapshot from ' + new Date(snap.ts).toLocaleString() + '.');
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('undoBtn')?.addEventListener('click', undoLastChange);
});

// Restore Preview (needs JSZip)
async function analyzeZipForPreview(file, replace=true){
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  let dataJson = zip.file('data.json');
  if(!dataJson){
    const jsonName = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.json'));
    if(jsonName) dataJson = zip.file(jsonName);
  }
  if(!dataJson) throw new Error('No data.json found in ZIP.');
  const text = await dataJson.async('string');
  const imported = JSON.parse(text);

  const current = loadData();
  let merged, stats = { peopleNew:0, peopleUpd:0, photosNew:0, photosUpd:0, storiesNew:0, storiesUpd:0, tlNew:0, tlUpd:0 };

  if(replace){
    merged = imported;
    stats.peopleNew = (imported.people||[]).length;
    stats.photosNew = (imported.photos||[]).length;
    stats.storiesNew = (imported.stories||[]).length;
    stats.tlNew = (imported.timeline||[]).length;
  } else {
    merged = { people: [], photos: [], stories: [], timeline: [] };
    const byId = new Map();
    for(const p of (current.people||[])) byId.set(p.id, p);
    for(const p of (imported.people||[])){
      if(byId.has(p.id)){ stats.peopleUpd++; byId.set(p.id, {...byId.get(p.id), ...p}); }
      else { stats.peopleNew++; byId.set(p.id, p); }
    }
    merged.people = Array.from(byId.values());

    const byUrl = new Map();
    for(const p of (current.photos||[])) if(p.url) byUrl.set(p.url, p);
    for(const p of (imported.photos||[])) if(p.url){
      if(byUrl.has(p.url)){ stats.photosUpd++; byUrl.set(p.url, {...byUrl.get(p.url), ...p}); }
      else { stats.photosNew++; byUrl.set(p.url, p); }
    }
    merged.photos = Array.from(byUrl.values());

    const storyKey = s => (s.title||'')+'|'+(s.personId||'');
    const byStory = new Map();
    for(const s of (current.stories||[])) byStory.set(storyKey(s), s);
    for(const s of (imported.stories||[])){
      const k = storyKey(s);
      if(byStory.has(k)){ stats.storiesUpd++; byStory.set(k, {...byStory.get(k), ...s}); }
      else { stats.storiesNew++; byStory.set(k, s); }
    }
    merged.stories = Array.from(byStory.values());

    const tlKey = t => (t.year||'')+'|'+(t.title||'')+'|'+(t.desc||'');
    const byTl = new Map();
    for(const t of (current.timeline||[])) byTl.set(tlKey(t), t);
    for(const t of (imported.timeline||[])){
      const k = tlKey(t);
      if(byTl.has(k)){ stats.tlUpd++; byTl.set(k, {...byTl.get(k), ...t}); }
      else { stats.tlNew++; byTl.set(k, t); }
    }
    merged.timeline = Array.from(byTl.values());
  }
  return { merged, stats };
}

document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('restoreZipBtn');
  if(btn){
    btn.addEventListener('click', async ()=>{
      const f = document.getElementById('restoreZipFile')?.files?.[0];
      const rep = document.getElementById('restoreReplace')?.checked ?? true;
      if(!f){ alert('Choose a ZIP first.'); return; }
      try{
        const { merged, stats } = await analyzeZipForPreview(f, rep);
        const html = `
          <div class="stack">
            <div>People: <strong>${stats.peopleNew}</strong> new, <strong>${stats.peopleUpd}</strong> updated</div>
            <div>Photos: <strong>${stats.photosNew}</strong> new, <strong>${stats.photosUpd}</strong> updated</div>
            <div>Stories: <strong>${stats.storiesNew}</strong> new, <strong>${stats.storiesUpd}</strong> updated</div>
            <div>Timeline: <strong>${stats.tlNew}</strong> new, <strong>${stats.tlUpd}</strong> updated</div>
          </div>
        `;
        pfhOpenModal('Restore Preview', html, [
          { label: 'Cancel', variant: 'secondary', onClick: ()=> pfhCloseModal() },
          { label: rep ? 'Apply Replace' : 'Apply Merge', onClick: ()=>{
              try{
                pushUndoSnapshot();
                saveData(merged);
                pfhCloseModal();
                alert('Restore applied. You can Undo if needed.');
              }catch(e){ alert('Restore failed: ' + e.message); }
            } }
        ]);
      }catch(e){
        alert('Preview failed: ' + e.message);
      }
    });
  }
});

// GEDCOM parsing (INDI, NAME, BIRT/DATE, DEAT/DATE, SEX, FAMC/FAMS, FAM(HUSB/WIFE/CHIL))
function parseGedcom(text){
  const lines = text.split(/\r?\n/);
  const recs = [];
  let cur = null;
  for(const raw of lines){
    const line = raw.trim();
    if(!line) continue;
    const mTop = line.match(/^0\s+@([^@]+)@\s+(\w+)/);
    if(mTop){
      if(cur) recs.push(cur);
      cur = { id: '@'+mTop[1]+'@', tag: mTop[2], lines: [] };
      continue;
    }
    if(cur) cur.lines.push(line);
  }
  if(cur) recs.push(cur);

  const indi = {};
  const fam  = {};
  for(const r of recs){
    if(r.tag === 'INDI'){
      const obj = { xref: r.id, name: '', sex: '', birth: '', death: '', famc: [], fams: [] };
      let ctx = [];
      for(const l of r.lines){
        const m = l.match(/^(\d+)\s+(\w+)(?:\s+(.*))?$/);
        if(!m) continue;
        const lvl = parseInt(m[1]); const tag = m[2]; const val = m[3]||'';
        ctx[lvl] = tag;
        if(tag === 'NAME'){ obj.name = val.replace(/\//g,'').trim(); }
        else if(tag === 'SEX'){ obj.sex = val.trim(); }
        else if(tag === 'BIRT'){ ctx[lvl] = 'BIRT'; }
        else if(tag === 'DEAT'){ ctx[lvl] = 'DEAT'; }
        else if(tag === 'DATE' && ctx[lvl-1] === 'BIRT'){ obj.birth = val.trim(); }
        else if(tag === 'DATE' && ctx[lvl-1] === 'DEAT'){ obj.death = val.trim(); }
        else if(tag === 'FAMC'){ obj.famc.push(val.trim()); }
        else if(tag === 'FAMS'){ obj.fams.push(val.trim()); }
      }
      indi[obj.xref] = obj;
    } else if(r.tag === 'FAM'){
      const obj = { xref: r.id, husb: '', wife: '', chil: [] };
      for(const l of r.lines){
        const m = l.match(/^\d+\s+(\w+)\s+(.*)$/);
        if(!m) continue;
        const tag = m[1]; const val = m[2].trim();
        if(tag === 'HUSB') obj.husb = val;
        else if(tag === 'WIFE') obj.wife = val;
        else if(tag === 'CHIL') obj.chil.push(val);
      }
      fam[obj.xref] = obj;
    }
  }
  return { indi, fam };
}

function gedToSiteData(g){
  const idMap = new Map();
  function getId(xref){
    if(!xref) return undefined;
    const key = xref.replace(/@/g,'');
    if(!idMap.has(key)) idMap.set(key, key);
    return idMap.get(key);
  }
  const people = [];
  for(const xref in g.indi){
    const p = g.indi[xref];
    const id = getId(p.xref);
    const year = s => { const m = String(s||'').match(/(\d{4})/); return m ? parseInt(m[1]) : ''; };
    people.push({
      id,
      name: p.name || id,
      birth: year(p.birth),
      death: year(p.death),
      birthplace: '',
      father: '',
      mother: '',
      spouse: '',
      notes: ''
    });
  }
  const byId = new Map(people.map(p=>[p.id,p]));
  for(const fx in g.fam){
    const fam = g.fam[fx];
    const fId = getId(fam.husb);
    const mId = getId(fam.wife);
    for(const cx of (fam.chil||[])){
      const cId = getId(cx);
      const child = byId.get(cId);
      if(!child) continue;
      if(fId) child.father = fId;
      if(mId) child.mother = mId;
    }
    if(fId && mId){
      const f = byId.get(fId);
      const m = byId.get(mId);
      if(f && !f.spouse) f.spouse = mId;
      if(m && !m.spouse) m.spouse = fId;
    }
  }
  return { people };
}

async function importGedcomFile(file, merge=true){
  const text = await file.text();
  const g = parseGedcom(text);
  const mapped = gedToSiteData(g);

  let d = loadData();
  if(!merge){
    pushUndoSnapshot();
    d.people = mapped.people;
    saveData(d);
    alert('GEDCOM imported (replaced people).');
    return;
  }
  pushUndoSnapshot();
  const existing = d.people || [];
  const key = p => (p.name||'').toLowerCase().trim() + '|' + (p.birth||'');
  const byKey = new Map(existing.map(p=>[key(p), p]));
  for(const p of mapped.people){
    const k = key(p);
    if(byKey.has(k)){
      const tgt = byKey.get(k);
      tgt.death = tgt.death || p.death;
      tgt.birthplace = tgt.birthplace || p.birthplace;
      tgt.father = tgt.father || p.father;
      tgt.mother = tgt.mother || p.mother;
      tgt.spouse = tgt.spouse || p.spouse;
      tgt.notes = [tgt.notes, p.notes].filter(Boolean).join('\n');
    } else {
      existing.push(p);
      byKey.set(k, p);
    }
  }
  d.people = existing;
  saveData(d);
  alert('GEDCOM imported (merged). You can Undo if needed.');
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('importGedBtn')?.addEventListener('click', async ()=>{
    const f = document.getElementById('importGedFile')?.files?.[0];
    if(!f){ alert('Choose a .ged file first.'); return; }
    const merge = document.getElementById('gedMergeMode')?.checked ?? true;
    try{
      await importGedcomFile(f, merge);
    }catch(e){
      console.error(e);
      alert('GEDCOM import failed: ' + e.message);
    }
  });
});
