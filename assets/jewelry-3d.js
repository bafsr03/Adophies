/* Adophies — 3D jewelry interactions
 *
 * Responsibilities:
 *   1. Loads <model-viewer> web component (Google's, ~150KB gz) once per
 *      page, only if a jewelry card exists on the page.
 *   2. Opens a shared fullscreen modal when any card is clicked. Only one
 *      <model-viewer> is mounted at a time inside the modal — keeps GPU
 *      memory bounded no matter how many cards are on the page.
 *   3. Respects prefers-reduced-motion (kills auto-rotate).
 */

(function () {
  if (window.__adophiesJewelry3D) return;
  window.__adophiesJewelry3D = true;

  const MODEL_VIEWER_SRC =
    'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js';

  function loadModelViewer() {
    if (customElements.get('model-viewer')) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-model-viewer]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const s = document.createElement('script');
      s.type = 'module';
      s.src = MODEL_VIEWER_SRC;
      s.dataset.modelViewer = 'true';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureModal() {
    let modal = document.getElementById('jewelry-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'jewelry-modal';
    modal.className = 'jewelry-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="jewelry-modal__inner">
        <button class="jewelry-modal__close" type="button" aria-label="Close 3D viewer" data-jewelry-modal-close>×</button>
        <model-viewer
          class="jewelry-modal__viewer"
          data-jewelry-modal-viewer
          camera-controls
          auto-rotate
          auto-rotate-delay="400"
          rotation-per-second="20deg"
          interaction-prompt="none"
          shadow-intensity="0.7"
          exposure="1.1"></model-viewer>
        <div class="jewelry-modal__meta">
          <div>
            <h3 class="jewelry-modal__name" data-jewelry-modal-name></h3>
            <div class="jewelry-modal__specs" data-jewelry-modal-specs></div>
          </div>
          <div class="jewelry-modal__price" data-jewelry-modal-price></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-jewelry-modal-close]')) {
        closeModal();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        closeModal();
      }
    });
    return modal;
  }

  function openModal(card) {
    const modal = ensureModal();
    const viewer = modal.querySelector('[data-jewelry-modal-viewer]');
    const nameEl = modal.querySelector('[data-jewelry-modal-name]');
    const priceEl = modal.querySelector('[data-jewelry-modal-price]');
    const specsEl = modal.querySelector('[data-jewelry-modal-specs]');

    const modelUrl = card.dataset.modelUrl;
    const name = card.dataset.name || '';
    const material = card.dataset.material || '';
    const dimensions = card.dataset.dimensions || '';
    const price = card.dataset.price || '';

    if (!modelUrl) return;

    viewer.setAttribute('src', modelUrl);
    viewer.setAttribute('alt', '3D model of ' + name);
    nameEl.textContent = name;
    priceEl.textContent = price;

    const specs = [];
    if (material)   specs.push('<span>' + escapeHtml(material) + '</span>');
    if (dimensions) specs.push('<span>' + escapeHtml(dimensions) + '</span>');
    specsEl.innerHTML = specs.join('');

    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('jewelry-modal');
    if (!modal) return;
    const viewer = modal.querySelector('[data-jewelry-modal-viewer]');
    if (viewer) viewer.removeAttribute('src');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function wireCards() {
    const cards = document.querySelectorAll('[data-jewelry-card]');
    if (!cards.length) return false;

    cards.forEach((card) => {
      if (card.__wired) return;
      card.__wired = true;

      // Earrings (and any other "front only" piece) use a sway animation instead
      // of a 360 spin — the back is uninteresting, so we oscillate the camera.
      if (card.dataset.jewelryAnimation === 'sway') {
        const viewer = card.querySelector('model-viewer');
        if (viewer) wireSwayAnimation(viewer);
      }

      // Teaser cards (data-jewelry-no-modal): click navigates to the accessories page,
      // dragging on the <model-viewer> still rotates the model (drag is detected and
      // suppresses the navigation).
      if (card.hasAttribute('data-jewelry-no-modal')) {
        wireNavOnClick(card);
        return;
      }

      const trigger = card.querySelector('[data-jewelry-trigger]');
      if (!trigger) return;
      const open = () => openModal(card);
      trigger.addEventListener('click', open);
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
    return true;
  }

  // Sway animation: oscillates camera theta back and forth around the front so
  // viewers see the face of the piece (e.g. earrings) without ever spinning to
  // the back. Pauses when the user drags, resumes after a short delay.
  function wireSwayAnimation(viewer) {
    if (viewer.__swayWired) return;
    viewer.__swayWired = true;

    const reducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const initialOrbit = viewer.getAttribute('camera-orbit') || '0deg 75deg 145%';
    const parts = initialOrbit.trim().split(/\s+/);
    const phi = parts[1] || '75deg';
    const radius = parts[2] || '145%';

    const AMPLITUDE_DEG = 32;     // how far it swings off-center
    const PERIOD_MS = 6000;       // one full left→right→left cycle
    const RESUME_DELAY_MS = 2200; // pause this long after user drag before resuming

    let startTime = null;
    let paused = false;
    let resumeTimer = null;
    let userTouchedAt = 0;

    viewer.addEventListener('camera-change', (e) => {
      if (e.detail && e.detail.source === 'user-interaction') {
        paused = true;
        userTouchedAt = performance.now();
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => {
          paused = false;
          startTime = null; // re-anchor phase from current moment for a smooth restart
        }, RESUME_DELAY_MS);
      }
    });

    function tick(now) {
      if (!paused) {
        if (startTime === null) startTime = now;
        const t = (now - startTime) / PERIOD_MS;
        const theta = Math.sin(t * Math.PI * 2) * AMPLITUDE_DEG;
        viewer.cameraOrbit = theta.toFixed(2) + 'deg ' + phi + ' ' + radius;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function wireNavOnClick(card) {
    const media = card.querySelector('.jewelry-card__media');
    if (!media) return;
    const url = card.getAttribute('data-jewelry-link') || '/pages/charm-bar';

    let startX = 0, startY = 0, dragged = false;
    const DRAG_THRESHOLD = 6;

    media.addEventListener('pointerdown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      dragged = false;
    });
    media.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - startX) > DRAG_THRESHOLD ||
          Math.abs(e.clientY - startY) > DRAG_THRESHOLD) {
        dragged = true;
      }
    });
    media.addEventListener('click', (e) => {
      if (dragged) return;          // user was rotating, don't navigate
      window.location.href = url;
    });
  }

  function init() {
    if (!wireCards()) return;
    loadModelViewer().catch((err) => {
      console.warn('[adophies] model-viewer failed to load:', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
