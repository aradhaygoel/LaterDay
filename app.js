const STORAGE_KEY = 'laterday.items.v1';
const PREF_KEY = 'laterday.preferences.v1';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const grid = $('#itemGrid');
let items = loadItems();
let view = 'inbox';
let selectedTag = '';
let typeFilter = 'all';
let listView = false;
let selectedImage = '';
let menuItemId = null;
let detailItemId = null;
let toastTimer;
const prefs = loadPrefs();

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isValidItem) : [];
  } catch (error) {
    console.error('Could not load Laterday saves', error);
    return [];
  }
}
function isValidItem(item) {
  return item && typeof item.id === 'string' && ['note','link','image'].includes(item.type) && typeof item.title === 'string';
}
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; }
  catch { return {}; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); render(); return true; }
  catch (error) {
    console.error('Could not save Laterday data', error);
    showToast(error?.name === 'QuotaExceededError' ? 'Storage is full. Try removing a large image.' : 'Could not save. Check your browser storage settings.');
    return false;
  }
}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} }
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function safeUrl(value) {
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
function displayHost(value) { try { return new URL(value).hostname.replace(/^www\./,''); } catch { return value; } }
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'JUST NOW';
  return new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric'}).format(date).toUpperCase();
}
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}
function getVisibleItems() {
  const query = $('#searchInput').value.trim().toLocaleLowerCase();
  const sort = $('#sortSelect').value;
  let result = items.filter(item => view === 'archive' ? item.archived : !item.archived);
  if (view === 'pinned') result = result.filter(item => item.favorite);
  if (selectedTag) result = result.filter(item => item.tags.includes(selectedTag));
  if (typeFilter !== 'all') result = result.filter(item => item.type === typeFilter);
  if (query) result = result.filter(item => [item.title,item.content,item.url,...item.tags].join(' ').toLocaleLowerCase().includes(query));
  return result.sort((a,b) => sort === 'oldest' ? new Date(a.createdAt)-new Date(b.createdAt) : sort === 'title' ? a.title.localeCompare(b.title) : new Date(b.createdAt)-new Date(a.createdAt));
}
const typeInfo = {note:['✎','NOTE'],link:['↗','LINK'],image:['▧','IMAGE']};
function renderCard(item) {
  const [glyph,label] = typeInfo[item.type];
  const excerpt = item.type === 'link' ? item.content : item.type === 'image' ? item.content : item.content;
  const link = item.type === 'link' && safeUrl(item.url) ? `<a class="card-link" href="${escapeHTML(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" aria-label="Open saved link"><span>↗</span>${escapeHTML(displayHost(item.url))}</a>` : '';
  const image = item.type === 'image' && item.image ? `<img class="card-image" src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy" />` : '';
  const body = excerpt ? `<p class="card-excerpt">${escapeHTML(excerpt)}</p>` : item.type === 'image' ? '<p class="card-excerpt">A moment saved for later.</p>' : '<p class="card-excerpt">Nothing written down yet.</p>';
  return `<article class="item-card" data-id="${escapeHTML(item.id)}" tabindex="0" aria-label="${escapeHTML(item.title)}. Open saved item">
    ${image}<div class="card-top"><span class="type-badge"><span class="type-glyph">${glyph}</span>${label}</span><button class="card-menu" aria-label="Item actions" data-menu="${escapeHTML(item.id)}">···</button>${item.favorite ? '<span class="favorite-mark" title="Favorite">✳</span>' : ''}</div>
    <h2 class="card-title">${escapeHTML(item.title)}</h2>${body}${link}
    ${item.tags.length ? `<div class="card-tags">${item.tags.slice(0,3).map(tag => `<span class="tag-pill">${escapeHTML(tag)}</span>`).join('')}${item.tags.length>3 ? `<span class="tag-pill">+${item.tags.length-3}</span>` : ''}</div>` : ''}
    <div class="card-footer"><span>${formatDate(item.createdAt)}</span><span class="card-updated">${item.updatedAt !== item.createdAt ? 'EDITED' : ''}</span></div>
  </article>`;
}
function render() {
  const active = items.filter(item => !item.archived);
  const titles = {inbox:['Good things,<br class="mobile-break"/> saved for later<span>.</span>','The ideas, places, and little things you’d hate to lose.','ALL SAVES'],pinned:['Your little favorites<span>.</span>','The things you want to find first.','FAVORITES'],archive:['Tucked away<span>.</span>','Out of the way, but never out of reach.','ARCHIVED']};
  const heading = titles[view];
  $('#pageTitle').innerHTML = heading[0]; $('#pageSubtitle').textContent = heading[1]; $('#breadcrumbView').textContent = heading[2];
  $('#inboxCount').textContent = active.length;
  const visible = getVisibleItems();
  const label = view === 'archive' ? 'ARCHIVED' : view === 'pinned' ? 'FAVORITES' : 'YOUR COLLECTION';
  $('#resultsLabel').innerHTML = `${label} <span>·</span> <b>${visible.length} ${visible.length === 1 ? 'SAVE' : 'SAVES'}</b>`;
  const filterRow = $('#activeFilterRow');
  filterRow.hidden = !selectedTag && typeFilter === 'all';
  $('#activeFilterLabel').textContent = [selectedTag && `Tag: ${selectedTag}`, typeFilter !== 'all' && `Type: ${typeFilter}`].filter(Boolean).join(' · ');
  $('#typeFilterLabel').textContent = typeFilter === 'all' ? 'All types' : typeInfo[typeFilter][1].toLowerCase().replace(/^./, c=>c.toUpperCase())+'s';
  $('#viewToggle').innerHTML = listView ? '<span>▦</span>' : '<span>☰</span>';
  grid.classList.toggle('list-view', listView);
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (visible.length) grid.innerHTML = visible.map(renderCard).join('');
  else {
    const searching = $('#searchInput').value.trim() || selectedTag || typeFilter !== 'all';
    const title = searching ? 'Nothing found this time.' : view === 'archive' ? 'Nothing tucked away yet.' : view === 'pinned' ? 'Your favorites are waiting.' : 'A little space for something good.';
    const text = searching ? 'Try another search or clear a filter.' : view === 'archive' ? 'Archived saves will be waiting here whenever you need them.' : view === 'pinned' ? 'Favorite an item and it’ll find a home here.' : 'Save a thought, a link, or a little bit of inspiration.';
    grid.innerHTML = `<div class="empty-state"><div class="empty-illustration">✳</div><h2>${title}</h2><p>${text}</p>${!searching && view==='inbox' ? '<button id="emptyAdd">Save your first thing ↗</button>' : ''}</div>`;
    $('#emptyAdd')?.addEventListener('click', () => openForm());
  }
  renderTags();
}
function renderTags() {
  const counts = new Map(); items.filter(i=>!i.archived).forEach(item=>item.tags.forEach(tag=>counts.set(tag,(counts.get(tag)||0)+1)));
  const tags = [...counts].sort((a,b)=>a[0].localeCompare(b[0]));
  $('#tagList').innerHTML = tags.length ? tags.map(([tag,count])=>`<button class="tag-item ${selectedTag===tag?'selected':''}" data-tag="${escapeHTML(tag)}"><span class="tag-hash">#</span>${escapeHTML(tag)}<span class="tag-count">${count}</span></button>`).join('') : '<p style="margin:0 0 0 10px;color:#aaa;font-size:11px">Your tags will live here.</p>';
}
function openForm(item = null) {
  $('#itemForm').reset(); $('#formError').textContent = ''; $('#editId').value = item?.id || '';
  $('#dialogKicker').textContent = item ? 'A LITTLE UPDATE' : 'A NEW LITTLE KEEP';
  $('#dialogTitle').innerHTML = item ? 'Make it yours<span>.</span>' : 'Save for later<span>.</span>';
  $('#saveButton').innerHTML = item ? 'Save changes <span>↗</span>' : 'Save for later <span>↗</span>';
  selectedImage = item?.image || ''; $('#imagePreviewWrap').hidden = !selectedImage; $('#imagePreview').src = selectedImage; $('#uploadLabel').textContent = selectedImage ? 'Image ready' : 'Choose an image from your device';
  $('#itemTitle').value = item?.title || ''; $('#itemContent').value = item?.content || ''; $('#itemUrl').value = item?.url || '';
  $('#linkNote').value = item?.type==='link' ? item.content : ''; $('#imageNote').value = item?.type==='image' ? item.content : '';
  $('#itemTags').value = item?.tags?.join(', ') || ''; setType(item?.type || 'note');
  $('#itemDialog').showModal(); setTimeout(()=>$('#itemTitle').focus(), 50);
}
function setType(type) {
  $('#itemType').value=type; $$('.type-choice').forEach(btn=>btn.classList.toggle('selected',btn.dataset.type===type));
  $('#noteFields').hidden=type!=='note'; $('#linkFields').hidden=type!=='link'; $('#imageFields').hidden=type!=='image';
}
function closeForm() { $('#itemDialog').close(); }
function parseTags(raw) { return [...new Set(raw.split(',').map(tag=>tag.trim().replace(/^#+/,'').slice(0,32)).filter(Boolean))].slice(0,20); }
function normalizeUrl(raw) {
  const trimmed=raw.trim(); if (!trimmed) return '';
  const candidate=/^https?:\/\//i.test(trimmed)?trimmed:`https://${trimmed}`;
  return safeUrl(candidate);
}
$('#newItem').addEventListener('click',()=>openForm()); $('#headingAdd').addEventListener('click',()=>openForm());
$('#closeDialog').addEventListener('click',closeForm); $('#cancelDialog').addEventListener('click',closeForm);
$$('.type-choice').forEach(button=>button.addEventListener('click',()=>setType(button.dataset.type)));
$('#imageFile').addEventListener('change', event=>{
  const file=event.target.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { $('#formError').textContent='Please choose an image file.'; event.target.value=''; return; }
  if (file.size>MAX_IMAGE_BYTES) { $('#formError').textContent='That image is a little large. Choose one under 5 MB.'; event.target.value=''; return; }
  const reader=new FileReader(); reader.onload=()=>{selectedImage=String(reader.result);$('#imagePreview').src=selectedImage;$('#imagePreviewWrap').hidden=false;$('#uploadLabel').textContent=file.name;$('#formError').textContent='';}; reader.onerror=()=>$('#formError').textContent='Could not read that image.'; reader.readAsDataURL(file);
});
$('#removeImage').addEventListener('click',()=>{selectedImage='';$('#imageFile').value='';$('#imagePreviewWrap').hidden=true;$('#uploadLabel').textContent='Choose an image from your device';});
$('#itemForm').addEventListener('submit',event=>{
  event.preventDefault(); const type=$('#itemType').value; const title=$('#itemTitle').value.trim(); const id=$('#editId').value; const existing=items.find(item=>item.id===id);
  const content=type==='note'?$('#itemContent').value.trim():type==='link'?$('#linkNote').value.trim():$('#imageNote').value.trim();
  let url=''; if(type==='link'){url=normalizeUrl($('#itemUrl').value); if(!url){$('#formError').textContent='Add a valid web address, like example.com.';$('#itemUrl').focus();return;}}
  if(type==='image'&&!selectedImage){$('#formError').textContent='Choose an image to save.';return;}
  if(!title&&!content&&!url&&!selectedImage){$('#formError').textContent='Add a title or a little something to save.';$('#itemTitle').focus();return;}
  const now=new Date().toISOString(); const item={id:id||crypto.randomUUID(),type,title:title|| (type==='link'?displayHost(url):type==='image'?'An image saved for later':'A little note'),content,url,image:type==='image'?selectedImage:'',tags:parseTags($('#itemTags').value),createdAt:existing?.createdAt||now,updatedAt:now,archived:existing?.archived||false,favorite:existing?.favorite||false};
  if(existing) items=items.map(old=>old.id===id?item:old); else items.unshift(item);
  if(persist()){closeForm();showToast(existing?'Your changes are saved.':'Tucked away for later.');}
});
$$('.nav-item').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;selectedTag='';$('#sidebar').classList.remove('open');render();}));
$('#tagList').addEventListener('click',event=>{const button=event.target.closest('[data-tag]');if(!button)return;selectedTag=selectedTag===button.dataset.tag?'':button.dataset.tag;view='inbox';render();});
$('#addTag').addEventListener('click',()=>{const name=prompt('Name a tag to use on your next save:');if(!name)return;const clean=name.trim().replace(/^#+/,'').slice(0,32);if(!clean)return;openForm();$('#itemTags').value=clean;});
$('#searchInput').addEventListener('input',render); $('#sortSelect').addEventListener('change',render);
$('#typeFilter').addEventListener('click',()=>{const options=['all','note','link','image'];typeFilter=options[(options.indexOf(typeFilter)+1)%options.length];render();});
$('#clearFilter').addEventListener('click',()=>{selectedTag='';typeFilter='all';render();});
$('#viewToggle').addEventListener('click',()=>{listView=!listView;render();});
grid.addEventListener('click',event=>{
  const menu=event.target.closest('[data-menu]'); if(menu){event.stopPropagation();menuItemId=menu.dataset.menu;const rect=menu.getBoundingClientRect();const context=$('#contextMenu');context.hidden=false;context.style.left=`${Math.max(8,Math.min(rect.right-143,innerWidth-151))}px`;context.style.top=`${Math.min(rect.bottom+4,innerHeight-170)}px`;return;}
  const link=event.target.closest('a');if(link)return;
  const card=event.target.closest('[data-id]');if(card)openDetail(card.dataset.id);
});
grid.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.item-card')){event.preventDefault();openDetail(event.target.dataset.id);}});
function openDetail(id){const item=items.find(candidate=>candidate.id===id);if(!item)return;detailItemId=id;const [glyph,label]=typeInfo[item.type];$('#detailType').textContent=`${glyph}  ${label}`;const safe=safeUrl(item.url);let media=item.type==='image'&&item.image?`<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" />`:'';let url=item.type==='link'&&safe?`<a href="${escapeHTML(safe)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.url)} ↗</a>`:'';$('#detailBody').innerHTML=`${media}<h2>${escapeHTML(item.title)}</h2>${item.content?`<p>${escapeHTML(item.content)}</p>`:''}${url}`;$('#detailMeta').innerHTML=`Saved ${escapeHTML(formatDate(item.createdAt))}${item.updatedAt!==item.createdAt?` · Updated ${escapeHTML(formatDate(item.updatedAt))}`:''}${item.tags.length?`<div class="detail-tags">${item.tags.map(tag=>`<span class="tag-pill">${escapeHTML(tag)}</span>`).join('')}</div>`:''}`;$('#detailArchive').textContent=item.archived?'Restore':'Archive';$('#detailDialog').showModal();}
$('#closeDetail').addEventListener('click',()=>$('#detailDialog').close());
$('#detailEdit').addEventListener('click',()=>{const item=items.find(candidate=>candidate.id===detailItemId);$('#detailDialog').close();if(item)openForm(item);});
$('#detailArchive').addEventListener('click',()=>{const id=detailItemId;items=items.map(item=>item.id===id?{...item,archived:!item.archived,updatedAt:new Date().toISOString()}:item);if(persist()){const archived=items.find(item=>item.id===id).archived;$('#detailDialog').close();showToast(archived?'Tucked away in your archive.':'Back in your library.');}});
$('#detailDelete').addEventListener('click',()=>{const item=items.find(candidate=>candidate.id===detailItemId);if(!item)return;if(confirm(`Delete “${item.title}” for good?`)){items=items.filter(candidate=>candidate.id!==detailItemId);if(persist()){$('#detailDialog').close();showToast('Removed from your library.');}}});
$('#contextMenu').addEventListener('click',event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;const item=items.find(candidate=>candidate.id===menuItemId);$('#contextMenu').hidden=true;if(!item)return;if(action==='edit'){openForm(item);return;}if(action==='delete'){if(confirm(`Delete “${item.title}” for good?`)){items=items.filter(candidate=>candidate.id!==item.id);if(persist())showToast('Removed from your library.');}return;}if(action==='favorite'){items=items.map(candidate=>candidate.id===item.id?{...candidate,favorite:!candidate.favorite,updatedAt:new Date().toISOString()}:candidate);if(persist())showToast(item.favorite?'Removed from favorites.':'Added to favorites.');return;}items=items.map(candidate=>candidate.id===item.id?{...candidate,archived:!candidate.archived,updatedAt:new Date().toISOString()}:candidate);if(persist())showToast(item.archived?'Back in your library.':'Tucked away in your archive.');});
document.addEventListener('click',event=>{if(!event.target.closest('#contextMenu')&&!event.target.closest('[data-menu]'))$('#contextMenu').hidden=true;});
$('#menuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#themeToggle').addEventListener('click',()=>{document.body.classList.toggle('dark');prefs.dark=document.body.classList.contains('dark');savePrefs();});
$('#viewToggle').title='Toggle list view'; if(prefs.dark)document.body.classList.add('dark');
document.addEventListener('keydown',event=>{if((event.key.toLowerCase()==='n'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName))){event.preventDefault();openForm();}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#searchInput').focus();}});
render();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.info('Offline support unavailable:', error)));
