/* Adophies — Jewelry product page interactions.
 *
 *   - Media stage: thumbnails toggle between 3D viewer and product images.
 *   - Variant swatches: clicking a value rebuilds the hidden <select>'s id and
 *     syncs price / availability / ATC label.
 *   - Quantity stepper: +/- buttons.
 *   - Reveal-on-scroll: IntersectionObserver adds .is-visible to data-reveal els.
 */

(function () {
  if (window.__adophiesJewelryProduct) return;
  window.__adophiesJewelryProduct = true;

  function init() {
    const sections = document.querySelectorAll('[data-jewelry-product]');
    if (!sections.length) return;
    sections.forEach(wireSection);
    wireReveal();
  }

  function wireSection(section) {
    wireMediaThumbs(section);
    wireQty(section);
    wireVariants(section);
  }

  // ---- Media thumbnails ----
  function wireMediaThumbs(section) {
    const thumbs = section.querySelectorAll('[data-thumb]');
    const media = section.querySelectorAll('[data-media]');
    if (!thumbs.length) return;

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const target = thumb.dataset.target;
        const index = thumb.dataset.index;

        thumbs.forEach((t) => {
          const active = t === thumb;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        media.forEach((m) => {
          const isMatch =
            m.dataset.mediaType === target &&
            (target !== 'image' || m.dataset.index === index);
          m.classList.toggle('is-active', isMatch);
        });
      });
    });
  }

  // ---- Quantity stepper ----
  function wireQty(section) {
    const input = section.querySelector('[data-qty-input]');
    if (!input) return;
    section.querySelectorAll('[data-qty-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.qtyStep, 10) || 1;
        const current = parseInt(input.value, 10) || 1;
        input.value = Math.max(1, current + step);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  // ---- Variant swatches ----
  function wireVariants(section) {
    const select = section.querySelector('[data-variant-select]');
    const swatches = section.querySelectorAll('[data-option-value]');
    const priceEl = section.querySelector('[data-price]');
    const compareEl = section.querySelector('[data-compare-price]');
    const atcBtn = section.querySelector('[data-atc]');
    const atcLabel = section.querySelector('[data-atc-label]');

    if (!select || !swatches.length) {
      syncUI(); // still sync on initial load (default variant)
      return;
    }

    swatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const optIdx = parseInt(swatch.dataset.optionIndex, 10);
        const value = swatch.dataset.optionValue;

        // Highlight selected swatch within its option group
        const groupParent = swatch.closest('.jewelry-product__swatches');
        if (groupParent) {
          groupParent.querySelectorAll('[data-option-value]').forEach((s) => {
            const isMe = s === swatch;
            s.classList.toggle('is-active', isMe);
            s.setAttribute('aria-checked', isMe ? 'true' : 'false');
          });
        }

        // Read all current option values
        const selectedOptions = [];
        section.querySelectorAll('.jewelry-product__swatches').forEach((group, i) => {
          const active = group.querySelector('.is-active');
          selectedOptions[i] = active ? active.dataset.optionValue : null;
        });

        // Find variant matching all selected options
        const options = Array.from(select.options);
        const match = options.find((opt) => {
          const variantOpts = (opt.dataset.variantOptions || '').split('||');
          return selectedOptions.every((v, i) => v === null || v === variantOpts[i]);
        });

        if (match) {
          select.value = match.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncUI();
      });
    });

    select.addEventListener('change', syncUI);
    syncUI();

    function syncUI() {
      const opt = select.options[select.selectedIndex];
      if (!opt) return;
      if (priceEl && opt.dataset.price) priceEl.textContent = opt.dataset.price;
      if (compareEl) {
        const cmp = opt.dataset.compare;
        if (cmp && cmp !== '' && cmp !== opt.dataset.price && cmp !== '$0.00') {
          compareEl.textContent = cmp;
          compareEl.style.display = '';
        } else {
          compareEl.style.display = 'none';
        }
      }
      const available = opt.dataset.available === 'true';
      if (atcBtn) atcBtn.disabled = !available;
      if (atcLabel) atcLabel.textContent = available ? 'Add to cart' : 'Sold out';
    }
  }

  // ---- Reveal on scroll ----
  function wireReveal() {
    const els = document.querySelectorAll('[data-jewelry-product] [data-reveal]');
    if (!els.length || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
