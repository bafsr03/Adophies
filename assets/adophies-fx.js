/* Adophies — site-wide motion + interaction layer.
 *
 * Vanilla JS, ~5 KB. Loaded globally from layout/theme.liquid.
 *
 * Features:
 *   - IntersectionObserver scroll reveals     [data-reveal]
 *   - Magnetic buttons                        [data-magnetic]
 *   - Custom cursor (desktop only)
 *   - Marquee duplication for seamless loop   .marquee
 *   - Show/hide floating cocktail spinner on scroll
 *
 * Respects prefers-reduced-motion (skips cursor + magnetic).
 */
(function () {
  if (window.__adophiesFX) return;
  window.__adophiesFX = true;

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  document.addEventListener('DOMContentLoaded', () => {
    autoTagReveals();
    initRevealObserver();
    initMarquees();
    initFloatingSpinner();
    initStickyHeader();
    if (!REDUCED && !TOUCH) {
      initCustomCursor();
      initMagnetic();
    }
  });

  /* ---------- Sticky header: toggle 'adop-header-scrolled' on body ---------- */
  function initStickyHeader() {
    const update = () => {
      document.body.classList.toggle('adop-header-scrolled', window.scrollY > 24);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ---------- Auto-tag common elements with data-reveal ---------- */
  function autoTagReveals() {
    const selectors = [
      '.jewelry-card',
      '.pillar',
      '.editorial-split',
      '.grid-product',
      '.product-card',
      '.feature-row',
      '.section-header',
      '.hero__inner > *',
      '.collection-grid-item'
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
        if (!el.style.getPropertyValue('--reveal-delay')) {
          el.style.setProperty('--reveal-delay', (i % 4) * 90 + 'ms');
        }
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  function initRevealObserver() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    if (!('IntersectionObserver' in window) || REDUCED) {
      els.forEach((el) => el.classList.add('is-revealed'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Marquee — duplicate track content so it loops seamlessly ---------- */
  function initMarquees() {
    document.querySelectorAll('.marquee').forEach((wrap) => {
      const track = wrap.querySelector('.marquee__track');
      if (!track || track.dataset.cloned === 'true') return;
      const clone = track.innerHTML;
      track.innerHTML = clone + clone;
      track.dataset.cloned = 'true';
    });
  }

  /* ---------- Custom cursor ---------- */
  function initCustomCursor() {
    const dot = document.createElement('div');
    dot.className = 'adop-cursor';
    const ring = document.createElement('div');
    ring.className = 'adop-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add('adop-cursor-on');

    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let rx = x, ry = y;

    document.addEventListener('mousemove', (e) => {
      x = e.clientX; y = e.clientY;
      dot.style.transform = 'translate(' + x + 'px, ' + y + 'px) translate(-50%, -50%)';
    });

    function animateRing() {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px, ' + ry + 'px) translate(-50%, -50%)';
      requestAnimationFrame(animateRing);
    }
    animateRing();

    const hoverSelectors = 'a, button, [role="button"], .jewelry-card__media, [data-magnetic], .pillar, input[type=submit]';
    document.querySelectorAll(hoverSelectors).forEach((el) => {
      el.addEventListener('mouseenter', () => {
        dot.classList.add('adop-cursor--hover');
        ring.classList.add('adop-cursor-ring--hover');
      });
      el.addEventListener('mouseleave', () => {
        dot.classList.remove('adop-cursor--hover');
        ring.classList.remove('adop-cursor-ring--hover');
      });
    });

    document.addEventListener('mouseleave', () => {
      dot.classList.add('adop-cursor--hidden');
      ring.classList.add('adop-cursor-ring--hidden');
    });
    document.addEventListener('mouseenter', () => {
      dot.classList.remove('adop-cursor--hidden');
      ring.classList.remove('adop-cursor-ring--hidden');
    });
  }

  /* ---------- Magnetic buttons ---------- */
  function initMagnetic() {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.35;
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = 'translate(' + (x * strength) + 'px, ' + (y * strength) + 'px)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ---------- Floating cocktail spinner: appear after some scroll ---------- */
  function initFloatingSpinner() {
    const spinner = document.querySelector('.cocktail-spinner--floating');
    if (!spinner) return;
    function update() {
      const shown = window.scrollY > 240;
      spinner.classList.toggle('is-visible', shown);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }
})();
