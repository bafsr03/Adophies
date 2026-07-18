/* Adophies — Charm Bar Builder controller.
 *
 * Vanilla JS, no deps. Drives the four-step builder rendered by
 * sections/charm-bar-builder.liquid:  Base → Charms → Arrange → Preview.
 *
 * - Reads the catalog from the [data-charm-bar-data] JSON blob.
 * - Free drag + rotate + remove on the Arrange stage (Pointer Events → touch OK).
 * - Adds the whole build to cart in one /cart/add.js call (base + each charm).
 * - Persists the in-progress build to localStorage.
 *
 * Respects prefers-reduced-motion for the flourishes; core flow always works.
 */
(function () {
  var root = document.querySelector('[data-charm-bar]');
  if (!root || root.__cbInit) return;
  root.__cbInit = true;

  var dataEl = root.querySelector('[data-charm-bar-data]');
  var CATALOG;
  try { CATALOG = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!CATALOG || !CATALOG.bases || !CATALOG.charms) return;

  var MIN = parseInt(root.dataset.cbMin, 10) || 0;
  var MAX = parseInt(root.dataset.cbMax, 10) || 10;
  var CART_URL = root.dataset.cbCartUrl || '/cart';
  var STORE = 'adopCharmBar';
  var FAVS_KEY = 'adopCharmBarFavs';

  var basesById = {}; CATALOG.bases.forEach(function (b) { basesById[b.id] = b; });
  var charmsById = {}; CATALOG.charms.forEach(function (c) { charmsById[c.id] = c; });

  /* ---- Metals ---- */
  var metals = [];
  CATALOG.bases.concat(CATALOG.charms).forEach(function (p) {
    p.variants.forEach(function (v) {
      if (v.metal && metals.indexOf(v.metal) === -1) metals.push(v.metal);
    });
  });
  var HAS_METAL = metals.length > 1;

  /* ---- Money formatter derived from a sample price label ---- */
  var sampleLabel = (CATALOG.bases[0] && CATALOG.bases[0].priceLabel) ||
                    (CATALOG.charms[0] && CATALOG.charms[0].priceLabel) || '$0.00';
  var money = (function (sample) {
    var m = sample.match(/[\d.,]+/);
    var num = m ? m[0] : '0';
    var idx = sample.indexOf(num);
    var prefix = sample.slice(0, idx);
    var suffix = sample.slice(idx + num.length);
    var parts = num.split(/[.,]/);
    var dec = parts.length > 1 ? parts[parts.length - 1].length : 0;
    return function (cents) {
      var v = cents / 100;
      var s = v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
      return prefix + s + suffix;
    };
  })(sampleLabel);

  /* ---- Favorites (localStorage) ---- */
  var favs = {};
  try { (JSON.parse(localStorage.getItem(FAVS_KEY)) || []).forEach(function (id) { favs[id] = true; }); } catch (e) {}
  function saveFavs() { try { localStorage.setItem(FAVS_KEY, JSON.stringify(Object.keys(favs).filter(function (k) { return favs[k]; }).map(Number))); } catch (e) {} }

  /* ---- State ---- */
  var state = {
    step: 1,
    baseId: null,
    metal: metals.indexOf('Gold') !== -1 ? 'Gold' : (metals[0] || ''),
    placed: [],       // {uid, charmId, variantId, x, y, rot, scale, moved}
    activeUid: null,
    filter: { q: '', intention: '', size: '', favs: false, type: null }
  };
  var uidSeq = 1;

  function saveState() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        baseId: state.baseId, metal: state.metal,
        placed: state.placed.map(function (p) { return { charmId: p.charmId, x: p.x, y: p.y, rot: p.rot, scale: p.scale, moved: p.moved }; })
      }));
    } catch (e) {}
  }
  function restoreState() {
    var raw; try { raw = JSON.parse(localStorage.getItem(STORE)); } catch (e) { return; }
    if (!raw) return;
    if (raw.metal && metals.indexOf(raw.metal) !== -1) state.metal = raw.metal;
    if (raw.baseId && basesById[raw.baseId]) state.baseId = raw.baseId;
    (raw.placed || []).forEach(function (p) {
      var charm = charmsById[p.charmId];
      if (!charm) return;
      state.placed.push({
        uid: uidSeq++, charmId: p.charmId, variantId: variantFor(charm).id,
        x: p.x, y: p.y, rot: p.rot || 0, scale: scaleForCharm(charm), moved: !!p.moved
      });
    });
  }

  /* ---- Variant resolution for the active metal ---- */
  function variantFor(product) {
    var vs = product.variants;
    if (HAS_METAL) {
      var match = vs.filter(function (v) { return v.metal === state.metal; });
      var avail = match.filter(function (v) { return v.available; })[0];
      if (avail) return avail;
      if (match[0]) return match[0];
    }
    return vs.filter(function (v) { return v.available; })[0] || vs[0];
  }
  function baseProduct() { return state.baseId ? basesById[state.baseId] : null; }
  function baseVariant() { var b = baseProduct(); return b ? variantFor(b) : null; }

  /* ---- Physical charm sizing ----
     Charms render on the base at a scale that mirrors the real millimetre
     size the store measures them at, so shoppers see true relative size and
     displacement.
       XS / micro 8mm · S 12mm · M 15mm · L 22mm
     Sizes are mapped across a comfortable visual band rather than raw ratio:
     the smallest (8mm) sits at MIN_SCALE so a micro charm still reads clearly,
     the largest (22mm) fills the slot at 1.0, and S/M step between. */
  var SIZE_MM = { xs: 8, micro: 8, s: 12, small: 12, m: 15, medium: 15, l: 22, large: 22, xl: 26 };
  var MIN_MM = 8;          // smallest size we map from
  var MAX_MM = 22;         // largest size we map from (fills the slot)
  var MIN_SCALE = 0.74;    // scale for the smallest charm — big enough to read clearly
  var MAX_SCALE = 1;       // scale for the largest charm
  var DEFAULT_SCALE = 0.87; // used when a charm has no measurable size (≈ M)

  function sizeToMM(size) {
    if (size == null) return null;
    var s = String(size).toLowerCase().trim();
    if (!s) return null;
    var num = s.match(/(\d+(?:\.\d+)?)\s*mm/);   // "8mm", "8 mm"
    if (!num) num = s.match(/^(\d+(?:\.\d+)?)$/); // bare "8"
    if (num) return parseFloat(num[1]);
    if (SIZE_MM.hasOwnProperty(s)) return SIZE_MM[s];
    var toks = s.split(/[^a-z]+/);               // e.g. "XS Micro"
    for (var i = 0; i < toks.length; i++) {
      if (SIZE_MM.hasOwnProperty(toks[i])) return SIZE_MM[toks[i]];
    }
    return null;
  }
  function scaleForCharm(charm) {
    var mm = charm && sizeToMM(charm.size);
    if (!mm) return DEFAULT_SCALE;
    var t = (mm - MIN_MM) / (MAX_MM - MIN_MM);   // 0 at 8mm, 1 at 22mm
    t = Math.max(0, Math.min(1, t));
    return MIN_SCALE + t * (MAX_SCALE - MIN_SCALE);
  }
  function sizeLabel(charm) {
    var raw = charm && charm.size ? String(charm.size).trim() : '';
    if (!raw) return '';
    var mm = sizeToMM(raw);
    if (mm && raw.toLowerCase().indexOf('mm') === -1) return raw + ' · ' + mm + 'mm';
    return raw;
  }

  /* ---- Totals ---- */
  function totalCents() {
    var t = 0;
    var bv = baseVariant(); if (bv) t += bv.price;
    state.placed.forEach(function (p) { var c = charmsById[p.charmId]; if (c) t += variantFor(c).price; });
    return t;
  }

  /* ====================================================================
     Element refs
  ==================================================================== */
  var els = {
    steps: root.querySelectorAll('[data-cb-step]'),
    panels: root.querySelectorAll('[data-cb-panel]'),
    baseTabs: root.querySelector('[data-cb-base-tabs]'),
    bases: root.querySelector('[data-cb-bases]'),
    search: root.querySelector('[data-cb-search]'),
    metal: root.querySelector('[data-cb-metal]'),
    metalBtns: root.querySelectorAll('[data-cb-metal-btn]'),
    filters: root.querySelector('[data-cb-filters]'),
    charms: root.querySelector('[data-cb-charms]'),
    tray: root.querySelector('[data-cb-tray]'),
    trayLabel: root.querySelector('[data-cb-tray-label]'),
    trayItems: root.querySelector('[data-cb-tray-items]'),
    hint: root.querySelector('[data-cb-hint]'),
    stage: root.querySelector('[data-cb-stage-arrange]'),
    stageBase: root.querySelector('[data-cb-stage-base]'),
    layer: root.querySelector('[data-cb-layer]'),
    previewBase: root.querySelector('[data-cb-preview-base]'),
    previewLayer: root.querySelector('[data-cb-preview-layer]'),
    summary: root.querySelector('[data-cb-summary]'),
    prev: root.querySelector('[data-cb-prev]'),
    next: root.querySelector('[data-cb-next]'),
    nextLabel: root.querySelector('[data-cb-next-label]'),
    count: root.querySelector('[data-cb-count]'),
    total: root.querySelector('[data-cb-total]')
  };

  /* ====================================================================
     Rendering
  ==================================================================== */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function renderMetalToggle() {
    if (!els.metal) return;
    els.metal.hidden = !HAS_METAL;
    els.metalBtns.forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.cbMetalBtn === state.metal);
      b.hidden = metals.indexOf(b.dataset.cbMetalBtn) === -1;
    });
  }

  function baseTypes() {
    var seen = [], out = [];
    CATALOG.bases.forEach(function (b) { if (seen.indexOf(b.type) === -1) { seen.push(b.type); out.push(b.type); } });
    return out;
  }

  function renderBaseTabs() {
    var types = baseTypes();
    if (state.filter.type == null) state.filter.type = types[0] || null;
    if (types.length <= 1) { els.baseTabs.hidden = true; return; }
    els.baseTabs.innerHTML = types.map(function (t) {
      return '<button type="button" class="cb-basetab' + (t === state.filter.type ? ' is-active' : '') + '" data-type="' + esc(t) + '" role="tab">' + esc(t) + '</button>';
    }).join('');
  }

  function renderBases() {
    var list = CATALOG.bases.filter(function (b) { return state.filter.type == null || b.type === state.filter.type; });
    els.bases.innerHTML = list.map(function (b) {
      var v = variantFor(b);
      var avail = b.available && v && v.available;
      return '' +
        '<button type="button" class="cb-card cb-card--base' + (b.id === state.baseId ? ' is-selected' : '') + (avail ? '' : ' is-unavailable') + '" data-base="' + b.id + '"' + (avail ? '' : ' disabled') + '>' +
          '<span class="cb-card__check" aria-hidden="true">✓</span>' +
          '<div class="cb-card__media">' + (b.image ? '<img src="' + esc(b.image) + '" alt="' + esc(b.title) + '" loading="lazy">' : '') + '</div>' +
          '<div class="cb-card__body">' +
            '<span class="cb-card__title">' + esc(b.title) + '</span>' +
            (b.length ? '<span class="cb-card__pill">' + esc(b.length) + '</span>' : '') +
            '<span class="cb-card__price">' + esc((v && v.priceLabel) || b.priceLabel) + '</span>' +
          '</div>' +
          '<span class="cb-card__select">' + (b.id === state.baseId ? 'Selected' : 'Select') + '</span>' +
        '</button>';
    }).join('');
  }

  function charmIntentions() {
    var out = [];
    // Prefer explicit intention metafield; fall back to tags.
    var hasIntention = CATALOG.charms.some(function (c) { return c.intention; });
    CATALOG.charms.forEach(function (c) {
      var vals = hasIntention ? (c.intention ? [c.intention] : []) : (c.tags || []);
      vals.forEach(function (v) { if (v && out.indexOf(v) === -1) out.push(v); });
    });
    return out;
  }
  function charmSizes() {
    var out = [];
    CATALOG.charms.forEach(function (c) { if (c.size && out.indexOf(c.size) === -1) out.push(c.size); });
    out.sort(function (a, b) { return (sizeToMM(a) || 999) - (sizeToMM(b) || 999); });
    return out;
  }

  function renderFilters() {
    var chips = [];
    var intentions = charmIntentions();
    var sizes = charmSizes();
    chips.push('<button type="button" class="cb-chip cb-chip--fav' + (state.filter.favs ? ' is-active' : '') + '" data-fav-filter>♥ Favorites</button>');
    intentions.slice(0, 12).forEach(function (it) {
      chips.push('<button type="button" class="cb-chip' + (state.filter.intention === it ? ' is-active' : '') + '" data-intention="' + esc(it) + '">' + esc(it) + '</button>');
    });
    sizes.forEach(function (sz) {
      chips.push('<button type="button" class="cb-chip cb-chip--size' + (state.filter.size === sz ? ' is-active' : '') + '" data-size="' + esc(sz) + '">' + esc(sz) + '</button>');
    });
    els.filters.innerHTML = chips.join('');
  }

  function filteredCharms() {
    var f = state.filter;
    var hasIntention = CATALOG.charms.some(function (c) { return c.intention; });
    return CATALOG.charms.filter(function (c) {
      if (f.q && c.title.toLowerCase().indexOf(f.q.toLowerCase()) === -1) return false;
      if (f.favs && !favs[c.id]) return false;
      if (f.size && c.size !== f.size) return false;
      if (f.intention) {
        var pool = hasIntention ? [c.intention] : (c.tags || []);
        if (pool.indexOf(f.intention) === -1) return false;
      }
      return true;
    });
  }

  function renderCharms() {
    var list = filteredCharms();
    var atCap = state.placed.length >= MAX;
    els.charms.innerHTML = list.map(function (c) {
      var v = variantFor(c);
      var avail = c.available && v && v.available;
      var cnt = state.placed.filter(function (p) { return p.charmId === c.id; }).length;
      return '' +
        '<div class="cb-card cb-card--charm' + (avail ? '' : ' is-unavailable') + (atCap ? ' is-capped' : '') + '" data-charm="' + c.id + '">' +
          '<button type="button" class="cb-card__fav' + (favs[c.id] ? ' is-active' : '') + '" data-fav="' + c.id + '" aria-label="Favorite">♥</button>' +
          (cnt ? '<span class="cb-card__count" aria-hidden="true">' + cnt + '</span>' : '') +
          '<div class="cb-card__media">' + (c.image ? '<img src="' + esc(c.image) + '" alt="' + esc(c.title) + '" loading="lazy">' : '') + '</div>' +
          '<div class="cb-card__body">' +
            '<span class="cb-card__title">' + esc(c.title) + '</span>' +
            '<span class="cb-card__meta">' + esc(sizeLabel(c)) + '</span>' +
            '<span class="cb-card__price">' + esc((v && v.priceLabel) || c.priceLabel) + '</span>' +
          '</div>' +
          '<button type="button" class="cb-card__add" data-add="' + c.id + '"' + (avail && !atCap ? '' : ' disabled') + ' aria-label="Add ' + esc(c.title) + '">+</button>' +
        '</div>';
    }).join('');
  }

  function renderTray() {
    if (!els.tray) return;
    els.tray.hidden = state.placed.length === 0;
    els.trayLabel.textContent = state.placed.length + ' of ' + MAX + ' charms';
    var counts = {};
    state.placed.forEach(function (p) { counts[p.charmId] = (counts[p.charmId] || 0) + 1; });
    els.trayItems.innerHTML = Object.keys(counts).map(function (id) {
      var c = charmsById[id];
      return '<button type="button" class="cb-tray__chip" data-tray-remove="' + id + '" title="Remove one ' + esc(c.title) + '">' +
        (c.image ? '<img src="' + esc(c.image) + '" alt="">' : '') +
        (counts[id] > 1 ? '<span class="cb-tray__n">' + counts[id] + '</span>' : '') +
        '<span class="cb-tray__x">×</span>' +
      '</button>';
    }).join('');
  }

  /* ---- Arrange / preview stage ---- */
  function charmNode(p, readOnly) {
    var c = charmsById[p.charmId];
    var node = document.createElement('div');
    node.className = 'cb-charm' + (p.uid === state.activeUid && !readOnly ? ' is-active' : '');
    node.dataset.uid = p.uid;
    node.style.left = p.x + '%';
    node.style.top = p.y + '%';
    node.style.setProperty('--cb-scale', p.scale);
    node.innerHTML =
      '<div class="cb-charm__ring" aria-hidden="true"></div>' +
      '<div class="cb-charm__inner"><img src="' + esc(c.image) + '" alt="' + esc(c.title) + '" draggable="false"></div>' +
      (readOnly ? '' :
        '<button type="button" class="cb-charm__remove" data-cb-remove aria-label="Remove ' + esc(c.title) + '">×</button>' +
        '<span class="cb-charm__rotate" data-cb-rotate aria-hidden="true">⟲</span>');
    node.querySelector('.cb-charm__inner').style.transform = 'rotate(' + p.rot + 'deg)';
    return node;
  }

  function renderStage(layer, base, readOnly) {
    var b = baseProduct();
    if (base && b) { base.src = b.image; base.alt = b.title; }
    layer.innerHTML = '';
    state.placed.forEach(function (p) { layer.appendChild(charmNode(p, readOnly)); });
  }
  function renderArrange() { renderStage(els.layer, els.stageBase, false); }
  function renderPreview() {
    renderStage(els.previewLayer, els.previewBase, true);
    var rows = '';
    var bv = baseVariant(), b = baseProduct();
    if (b) rows += '<li class="cb-summary__row"><span>' + esc(b.title) + '</span><span>' + esc(bv.priceLabel) + '</span></li>';
    var counts = {};
    state.placed.forEach(function (p) { counts[p.charmId] = (counts[p.charmId] || 0) + 1; });
    Object.keys(counts).forEach(function (id) {
      var c = charmsById[id];
      rows += '<li class="cb-summary__row"><span>' + esc(c.title) + (counts[id] > 1 ? ' ×' + counts[id] : '') + '</span><span>' + esc(variantFor(c).priceLabel) + '</span></li>';
    });
    els.summary.innerHTML = '<ul class="cb-summary__list">' + rows + '</ul>' +
      '<div class="cb-summary__total"><span>Total</span><span>' + money(totalCents()) + '</span></div>';
  }

  /* ---- Chrome: stepper + action bar ---- */
  function updateChrome() {
    els.steps.forEach(function (li) {
      var s = parseInt(li.dataset.cbStep, 10);
      li.classList.toggle('is-active', s === state.step);
      li.classList.toggle('is-done', s < state.step);
    });
    els.panels.forEach(function (pn) {
      var s = parseInt(pn.dataset.cbPanel, 10);
      var on = s === state.step;
      pn.hidden = !on;
      pn.classList.toggle('is-active', on);
    });
    els.prev.hidden = state.step === 1;
    els.count.textContent = state.placed.length + ' of ' + MAX;
    els.total.textContent = money(totalCents());
    var label = 'Continue';
    if (state.step === 4) label = 'Add to cart';
    els.nextLabel.textContent = label;
    // gate the next button
    var ok = true;
    if (state.step === 1) ok = !!state.baseId;
    if (state.step === 2) ok = state.placed.length >= MIN;
    els.next.disabled = !ok;
    els.next.classList.toggle('is-disabled', !ok);
  }

  function renderAll() {
    renderMetalToggle();
    renderBaseTabs();
    renderBases();
    renderFilters();
    renderCharms();
    renderTray();
    if (state.step === 3) renderArrange();
    if (state.step === 4) renderPreview();
    updateChrome();
    saveState();
  }

  /* ====================================================================
     Actions
  ==================================================================== */
  function selectBase(id) {
    state.baseId = id;
    renderAll();
    // gentle auto-advance
    setTimeout(function () { goStep(2); }, 260);
  }

  function placeAuto() {
    var auto = state.placed.filter(function (p) { return !p.moved; });
    var n = auto.length;
    auto.forEach(function (p, i) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      p.x = 20 + t * 60;
      p.y = 44 + Math.sin(Math.PI * t) * 14;
    });
  }

  function addCharm(id) {
    if (state.placed.length >= MAX) { flashCap(); return; }
    var charm = charmsById[id]; if (!charm) return;
    state.placed.push({ uid: uidSeq++, charmId: id, variantId: variantFor(charm).id, x: 50, y: 50, rot: 0, scale: scaleForCharm(charm), moved: false });
    placeAuto();
    renderAll();
    pulseCard(id);
  }
  function removeOneCharm(id) {
    for (var i = state.placed.length - 1; i >= 0; i--) {
      if (state.placed[i].charmId === id) { state.placed.splice(i, 1); break; }
    }
    placeAuto(); renderAll();
  }
  function removeUid(uid) {
    state.placed = state.placed.filter(function (p) { return p.uid !== uid; });
    if (state.activeUid === uid) state.activeUid = null;
    placeAuto(); renderAll();
  }

  function setMetal(m) {
    if (state.metal === m) return;
    state.metal = m;
    // remap placed charm variants
    state.placed.forEach(function (p) { var c = charmsById[p.charmId]; if (c) p.variantId = variantFor(c).id; });
    renderAll();
  }

  function goStep(s) {
    if (s < 1 || s > 4) return;
    if (s > state.step) {
      if (state.step === 1 && !state.baseId) return;
      if (state.step === 2 && state.placed.length < MIN) { flashNeedMore(); return; }
    }
    state.step = s;
    state.activeUid = null;
    renderAll();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---- flourishes ---- */
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function pulseCard(id) {
    if (REDUCED) return;
    var card = els.charms.querySelector('[data-charm="' + id + '"]');
    if (!card) return;
    card.classList.remove('is-pulsed'); void card.offsetWidth; card.classList.add('is-pulsed');
  }
  function flashCap() {
    if (!els.count) return;
    els.count.classList.remove('is-flash'); void els.count.offsetWidth; els.count.classList.add('is-flash');
  }
  function flashNeedMore() {
    els.next.classList.remove('is-shake'); void els.next.offsetWidth; els.next.classList.add('is-shake');
  }

  /* ====================================================================
     Add to cart
  ==================================================================== */
  function addToCart() {
    var bv = baseVariant();
    if (!bv) { goStep(1); return; }
    var buildId = 'cb-' + Date.now();
    var items = [{ id: bv.id, quantity: 1, properties: { 'Custom charm piece': 'Yes', '_cb_build': buildId } }];
    var counts = {};
    state.placed.forEach(function (p) { counts[p.variantId] = (counts[p.variantId] || 0) + 1; });
    Object.keys(counts).forEach(function (vid) {
      items.push({ id: parseInt(vid, 10), quantity: counts[vid], properties: { '_cb_build': buildId, 'Charm on': 'Custom piece' } });
    });

    els.next.disabled = true;
    els.next.classList.add('is-loading');
    var root_ = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
    fetch(root_ + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: items })
    }).then(function (r) {
      if (!r.ok) throw new Error('add failed');
      return r.json();
    }).then(function () {
      try { localStorage.removeItem(STORE); } catch (e) {}
      window.location.href = CART_URL;
    }).catch(function () {
      els.next.disabled = false;
      els.next.classList.remove('is-loading');
      els.nextLabel.textContent = 'Try again';
    });
  }

  /* ====================================================================
     Drag + rotate (Pointer Events)
  ==================================================================== */
  var gesture = null;
  function angleOf(e, cx, cy) { return Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI; }

  // Deselect the active charm (hides its ring + rotate/remove handles).
  // Cheap DOM-only update so it doesn't disturb positions mid-arrange.
  function deselect() {
    if (state.activeUid == null) return;
    state.activeUid = null;
    els.layer.querySelectorAll('.cb-charm.is-active').forEach(function (n) { n.classList.remove('is-active'); });
  }

  els.stage.addEventListener('pointerdown', function (e) {
    var charmEl = e.target.closest('.cb-charm');
    if (!charmEl) { deselect(); return; }
    var uid = parseInt(charmEl.dataset.uid, 10);
    var p = state.placed.filter(function (x) { return x.uid === uid; })[0];
    if (!p) return;

    // Remove button
    if (e.target.closest('[data-cb-remove]')) { e.preventDefault(); removeUid(uid); return; }

    state.activeUid = uid;
    // reflect active class without full re-render (keeps drag smooth)
    els.layer.querySelectorAll('.cb-charm').forEach(function (n) { n.classList.toggle('is-active', parseInt(n.dataset.uid, 10) === uid); });

    var rect = els.stage.getBoundingClientRect();
    var cx = rect.left + p.x / 100 * rect.width;
    var cy = rect.top + p.y / 100 * rect.height;

    if (e.target.closest('[data-cb-rotate]')) {
      gesture = { type: 'rotate', uid: uid, p: p, node: charmEl, cx: cx, cy: cy, startAngle: angleOf(e, cx, cy), startRot: p.rot };
    } else {
      gesture = { type: 'move', uid: uid, p: p, node: charmEl, rect: rect, dx: e.clientX - cx, dy: e.clientY - cy };
    }
    charmEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  els.stage.addEventListener('pointermove', function (e) {
    if (!gesture) return;
    var p = gesture.p;
    if (gesture.type === 'move') {
      var r = gesture.rect;
      var nx = (e.clientX - gesture.dx - r.left) / r.width * 100;
      var ny = (e.clientY - gesture.dy - r.top) / r.height * 100;
      p.x = Math.max(4, Math.min(96, nx));
      p.y = Math.max(4, Math.min(96, ny));
      p.moved = true;
      gesture.node.style.left = p.x + '%';
      gesture.node.style.top = p.y + '%';
    } else if (gesture.type === 'rotate') {
      var a = angleOf(e, gesture.cx, gesture.cy);
      p.rot = gesture.startRot + (a - gesture.startAngle);
      gesture.node.querySelector('.cb-charm__inner').style.transform = 'rotate(' + p.rot + 'deg)';
    }
  });

  function endGesture(e) {
    if (!gesture) return;
    try { gesture.node.releasePointerCapture(e.pointerId); } catch (err) {}
    gesture = null;
    saveState();
  }
  els.stage.addEventListener('pointerup', endGesture);
  els.stage.addEventListener('pointercancel', endGesture);

  // Tap/click anywhere that isn't a charm → deselect, so a finished
  // arrangement reads clean (no red ring). Covers "click outside the viewer"
  // on desktop and tapping away on mobile. Charm taps are handled above and
  // keep their selection; this only fires for non-charm targets.
  document.addEventListener('pointerdown', function (e) {
    if (state.activeUid == null) return;
    if (e.target.closest('.cb-charm')) return;
    deselect();
  });

  /* ====================================================================
     Delegated clicks
  ==================================================================== */
  root.addEventListener('click', function (e) {
    var t = e.target;
    var el;
    if ((el = t.closest('[data-base]'))) { selectBase(parseInt(el.dataset.base, 10)); return; }
    if ((el = t.closest('[data-type]'))) { state.filter.type = el.dataset.type; renderBaseTabs(); renderBases(); return; }
    if ((el = t.closest('[data-fav]')) && el.dataset.fav) { var id = el.dataset.fav; favs[id] = !favs[id]; saveFavs(); renderCharms(); return; }
    if ((el = t.closest('[data-add]'))) { addCharm(parseInt(el.dataset.add, 10)); return; }
    if ((el = t.closest('[data-tray-remove]'))) { removeOneCharm(parseInt(el.dataset.trayRemove, 10)); return; }
    if ((el = t.closest('[data-fav-filter]'))) { state.filter.favs = !state.filter.favs; renderFilters(); renderCharms(); return; }
    if ((el = t.closest('[data-intention]'))) { state.filter.intention = state.filter.intention === el.dataset.intention ? '' : el.dataset.intention; renderFilters(); renderCharms(); return; }
    if ((el = t.closest('[data-size]'))) { state.filter.size = state.filter.size === el.dataset.size ? '' : el.dataset.size; renderFilters(); renderCharms(); return; }
    if ((el = t.closest('[data-cb-metal-btn]'))) { setMetal(el.dataset.cbMetalBtn); return; }
    if ((el = t.closest('[data-cb-prev]'))) { goStep(state.step - 1); return; }
    if ((el = t.closest('[data-cb-next]'))) { if (state.step === 4) addToCart(); else goStep(state.step + 1); return; }
  });

  if (els.search) {
    els.search.addEventListener('input', function () { state.filter.q = els.search.value; renderCharms(); });
  }

  /* ====================================================================
     Boot
  ==================================================================== */
  restoreState();
  renderAll();
})();
