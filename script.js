// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('is-visible'));
}

// Hero dot field — scattered dots settle into an even grid behind the headline, then hold
// still at low contrast. Cursor within 130px parts the nearest dots. Alpha ramps to zero
// over the bottom 200px so the field dissolves into the work section with no divider.
(function(){
  const field  = document.querySelector('.hero-field');
  const canvas = document.getElementById('dotfield');
  if (!field || !canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const GAP = 20, RADIUS = 1.3, PEAK = 0.14;
  const SETTLE = 1700, MAGNET = 130, STRENGTH = 24, FADE = 200;

  let W = 0, H = 0, dots = [], ptr = null, settledDrawn = false, t0 = 0, raf = 0;

  function layout(first){
    W = field.clientWidth;
    H = field.clientHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cols = Math.max(2, Math.ceil(W / GAP) + 1);
    const rows = Math.max(2, Math.ceil(H / GAP) + 1);
    const offX = (W - (cols - 1) * GAP) / 2;
    const offY = (H - (rows - 1) * GAP) / 2;

    const next = [];
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        const prev = dots[next.length];
        next.push({
          gx: offX + c * GAP,
          gy: offY + r * GAP,
          x: (first || !prev) ? Math.random() * W : prev.x,
          y: (first || !prev) ? Math.random() * H : prev.y,
          d: 0.55 + Math.random() * 0.45   // per-dot stagger, so the grid knits together
        });
      }
    }
    dots = next;
    settledDrawn = false;
  }

  function frame(now){
    raf = requestAnimationFrame(frame);

    const raw = reduced ? 1 : Math.min(1, (now - t0) / SETTLE);
    const settle = 1 - Math.pow(1 - raw, 3);
    const magnet = raw >= 1 && ptr;

    // Once settled and un-hovered there is nothing to redraw — bail before touching the canvas.
    if (raw >= 1 && !ptr && settledDrawn) return;
    settledDrawn = raw >= 1 && !ptr;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#363839';

    for (let i = 0; i < dots.length; i++){
      const d = dots[i];
      const e = Math.min(1, settle * (0.6 + d.d * 0.7));
      let x = d.x + (d.gx - d.x) * e;
      let y = d.y + (d.gy - d.y) * e;

      if (magnet){
        const dx = x - ptr.x, dy = y - ptr.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MAGNET && dist > 0.001){
          const push = (1 - dist / MAGNET) * STRENGTH;
          x += (dx / dist) * push;
          y += (dy / dist) * push;
        }
      }

      // smoothstep dissolve across the bottom edge
      let f = Math.max(0, Math.min(1, (H - y) / FADE));
      f = f * f * (3 - 2 * f);

      ctx.globalAlpha = (0.28 + 0.72 * e) * PEAK * f;
      ctx.beginPath();
      ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  field.addEventListener('pointermove', function(e){
    const r = field.getBoundingClientRect();
    ptr = { x: e.clientX - r.left, y: e.clientY - r.top };
    settledDrawn = false;
  });
  field.addEventListener('pointerleave', function(){
    ptr = null;
    settledDrawn = false;
  });
  window.addEventListener('resize', function(){ layout(false); });

  layout(true);
  t0 = performance.now();
  raf = requestAnimationFrame(frame);
})();

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
}

// About board scale — the board's children are laid out on a fixed 880x500 canvas (matching
// Figma's own px values exactly); this scales that canvas to fill whatever width the wrap
// actually renders at, so every child stays pixel-faithful in proportion and, crucially,
// genuinely centered (a CSS-only `scale(calc(100cqw / 880))` was tried first but cqw silently
// doesn't resolve inside a transform's calc() in some engines, leaving the canvas stuck at its
// native 880px width — flush-left in a wider wrap — which is what made the centered elements
// look off in the first place).
(function(){
  const wrap = document.querySelector('.about-board-wrap');
  const board = document.querySelector('.about-board');
  if (!wrap || !board) return;
  function updateScale(){
    // Below 640px the board switches to its own dedicated 375x928 mobile canvas (a real
    // Figma-designed mobile layout, not the 880x500 desktop board scaled down — see
    // index.html's mobile media query), so it scales against that reference width instead.
    const canvasWidth = window.innerWidth <= 640 ? 375 : 880;
    board.style.transform = `scale(${wrap.clientWidth / canvasWidth})`;
  }
  updateScale();
  window.addEventListener('resize', updateScale);
})();

// About board photo shuffle — each of the 3 personal photos keeps one fixed DOM element
// (data-photo="1"/"2"/"3"); shuffling re-assigns which element carries the --front/--mid/--back
// slot class. Since left/top/width/height/rotate are all real CSS transitions on those slot
// classes, that reassignment makes each card physically glide to its new slot — the one moving
// to front passes over the others (its z-index jumps to 3 immediately), the one moving to back
// passes under (z-index drops to 1 immediately) — a genuine reorder, not an in-place wobble
// layered under a src swap.
(function(){
  const shuffleBtn = document.getElementById('aboutPhotoShuffle');
  if (!shuffleBtn) return;
  const cardsEl = shuffleBtn.querySelectorAll('.about-photo-stack-card');
  const cards = {};
  cardsEl.forEach(c => { cards[c.dataset.photo] = c; });
  const SLOT_CLASSES = ['about-photo-stack-card--front', 'about-photo-stack-card--mid', 'about-photo-stack-card--back'];
  let order = [1, 2, 3]; // photo numbers currently in [front, mid, back]

  function render(){
    order.forEach((photoNum, i) => {
      const card = cards[photoNum];
      card.classList.remove(...SLOT_CLASSES);
      card.classList.add(SLOT_CLASSES[i]);
    });
  }

  let animating = false;
  shuffleBtn.addEventListener('click', () => {
    if (animating) return;
    animating = true;
    order = [order[1], order[2], order[0]];
    render();
    setTimeout(() => { animating = false; }, 500);
  });
})();

// Drag-to-compare sliders — click/drag anywhere on the track (or the handle) to reveal
// more of the before/after image; arrow keys move the handle when it has focus.
document.querySelectorAll('.compare-slider').forEach((slider) => {
  const handle = slider.querySelector('.compare-handle');
  let dragging = false;

  function setPos(pct){
    pct = Math.max(0, Math.min(100, pct));
    slider.style.setProperty('--pos', pct + '%');
    handle.setAttribute('aria-valuenow', String(Math.round(pct)));
  }
  function posFromEvent(e){
    const rect = slider.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * 100;
  }

  slider.addEventListener('pointerdown', (e) => {
    dragging = true;
    slider.setPointerCapture(e.pointerId);
    setPos(posFromEvent(e));
  });
  slider.addEventListener('pointermove', (e) => {
    if (dragging) setPos(posFromEvent(e));
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    try { slider.releasePointerCapture(e.pointerId); } catch (err) {}
  };
  slider.addEventListener('pointerup', release);
  slider.addEventListener('pointercancel', release);

  handle.addEventListener('keydown', (e) => {
    const current = parseFloat(getComputedStyle(slider).getPropertyValue('--pos')) || 50;
    if (e.key === 'ArrowLeft'){ setPos(current - 5); e.preventDefault(); }
    else if (e.key === 'ArrowRight'){ setPos(current + 5); e.preventDefault(); }
    else if (e.key === 'Home'){ setPos(0); e.preventDefault(); }
    else if (e.key === 'End'){ setPos(100); e.preventDefault(); }
  });
});

// Coachmark hotspots — CSS already handles hover/focus; this adds tap-to-toggle for touch
// devices (no :hover), closing any other open coachmark and closing on an outside tap.
const coachmarks = document.querySelectorAll('.coachmark');
if (coachmarks.length) {
  coachmarks.forEach((mark) => {
    mark.addEventListener('click', (e) => {
      e.preventDefault();
      const wasOpen = mark.classList.contains('is-open');
      coachmarks.forEach(m => m.classList.remove('is-open'));
      if (!wasOpen) mark.classList.add('is-open');
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.coachmark')) coachmarks.forEach(m => m.classList.remove('is-open'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') coachmarks.forEach(m => m.classList.remove('is-open'));
  });
}

// Scroll-triggered videos — load quietly on page load (muted, paused on its first frame), and
// start playing once the frame actually scrolls into view (matches the .reveal pattern:
// triggers once, then leaves it alone — the `loop` attribute on the <video> itself handles
// repeating from there). Reduced-motion just shows the settled first frame, never plays.
document.querySelectorAll('.scroll-video').forEach((el) => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.play();
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
  } else {
    el.play();
  }
});

// NDA passcode gate — client-side only, by necessity (static site, no backend). See the note
// above .ndagate in style.css for what that actually means in practice. The passcode is
// compared as a SHA-256 hash rather than stored as a literal string, mainly so it doesn't show
// up in plain text in view-source; this is NOT real security, just a soft gate against casual
// browsing.
//
// TO CHANGE THE PASSCODE: open a browser console anywhere and run
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-new-passcode')).then(b =>
//     console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
// then paste the result below. Current placeholder passcode is "selfwealth2026" — change this
// before sharing the link with anyone.
const ndaGate = document.getElementById('ndaGate');
if (ndaGate) {
  const PASSCODE_HASH = '09a14afdaa20835de5de4e8fcde348e810c4d776b71812508b3fb7a5ffac145f';
  const UNLOCKED_URL = 'selfwealth-full.html';
  const passInput = document.getElementById('ndaPasscode');
  const toggleBtn = document.getElementById('ndaToggle');
  if (toggleBtn) {
    const showIcon = toggleBtn.querySelector('.ndagate-toggle-icon-show');
    const hideIcon = toggleBtn.querySelector('.ndagate-toggle-icon-hide');
    toggleBtn.addEventListener('click', () => {
      const willReveal = passInput.type === 'password';
      passInput.type = willReveal ? 'text' : 'password';
      toggleBtn.setAttribute('aria-pressed', String(willReveal));
      toggleBtn.setAttribute('aria-label', willReveal ? 'Hide passcode' : 'Show passcode');
      showIcon.style.display = willReveal ? 'none' : 'block';
      hideIcon.style.display = willReveal ? 'block' : 'none';
    });
  }

  async function sha256Hex(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  ndaGate.addEventListener('submit', async (e) => {
    e.preventDefault();
    ndaGate.classList.remove('is-invalid');
    passInput.classList.remove('is-error');
    const submitBtn = ndaGate.querySelector('.ndagate-submit');
    submitBtn.disabled = true;
    const hash = await sha256Hex(passInput.value.trim());
    submitBtn.disabled = false;
    if (hash === PASSCODE_HASH) {
      window.location.href = UNLOCKED_URL;
    } else {
      ndaGate.classList.add('is-invalid');
      passInput.classList.add('is-error');
      passInput.focus();
      passInput.select();
    }
  });
}
