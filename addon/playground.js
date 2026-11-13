/* Add-on for the local vercel.com/font clone (loaded by serve.py, not part of the mirror).

   Two default actions in the type proofer (the "Interactive font playground"), on every tab,
   picked with one View / Edit toggle above the text:

   View (magnifier)  Click or tap the text -> next sample, always set on two lines. Sans, Mono and Pixel cycle preset
                     texts in the live font. A tab can also cycle pre-rendered SVG samples
                     (one path per word) when samples.json lists any.
   Edit (pencil)     The text is a text field in the live font. An SVG sample cannot be typed
                     in, so Edit switches to the live style with that sample's text.

   The mode only changes through the toggle (or Escape, back to View). Samples come from
   samples.json (see build.py). */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const FAMILY = { sans: 'Geist Sans', serif: 'Geist Serif', mono: 'Geist Mono', pixel: 'Geist Pixel' };
  // Geist icons, 16 x 16: magnifying-glass and pencil-edit
  const ICON = {
    view: 'M1.5 6.5C1.5 3.73858 3.73858 1.5 6.5 1.5C9.26142 1.5 11.5 3.73858 11.5 6.5C11.5 9.26142 9.26142 11.5 6.5 11.5C3.73858 11.5 1.5 9.26142 1.5 6.5ZM6.5 0C2.91015 0 0 2.91015 0 6.5C0 10.0899 2.91015 13 6.5 13C8.02469 13 9.42677 12.475 10.5353 11.596L13.9697 15.0303L14.5 15.5607L15.5607 14.5L15.0303 13.9697L11.596 10.5353C12.475 9.42677 13 8.02469 13 6.5C13 2.91015 10.0899 0 6.5 0Z',
    edit: 'M11.75 0.189331L12.2803 0.719661L15.2803 3.71966L15.8107 4.24999L15.2803 4.78032L5.15901 14.9016C4.45575 15.6049 3.50192 16 2.50736 16H0.75H0V15.25V13.4926C0 12.4981 0.395088 11.5442 1.09835 10.841L11.2197 0.719661L11.75 0.189331ZM11.75 2.31065L9.81066 4.24999L11.75 6.18933L13.6893 4.24999L11.75 2.31065ZM2.15901 11.9016L8.75 5.31065L10.6893 7.24999L4.09835 13.841C3.67639 14.2629 3.1041 14.5 2.50736 14.5H1.5V13.4926C1.5 12.8959 1.73705 12.3236 2.15901 11.9016Z',
  };
  const icon = k => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="${ICON[k]}"/></svg>`;

  let data = null;
  let lists = {};           // tab -> samples
  let tab = '';
  let step = 0;
  let mode = 'view';        // 'view' | 'edit'
  let custom = false;       // the text was typed by the user, not a sample
  let base = null;          // the page's own default text

  // Styles go in as constructed sheets, never as DOM nodes: this file runs before the page has
  // hydrated, and React rejects server HTML that has gained a node (error #418).
  // Until the takeover the page's text field is not clickable, so no caret lands in it first.
  const pre = new CSSStyleSheet();
  pre.replaceSync('textarea[maxlength="256"] { pointer-events: none; }');
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, pre, sheet];
  sheet.replaceSync(`
    .pg-stage { position: relative; }
    .pg-hit { position: absolute; inset: 0; z-index: 2; cursor: pointer; -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none; touch-action: manipulation; }
    .pg-hit[hidden] { display: none; }
    .pg-hit svg { position: absolute; left: 0; top: 0; display: block; fill: currentColor; overflow: visible; }
    .pg-stage[data-mode="view"] > textarea { opacity: 0 !important; position: absolute; left: 0; top: 0; pointer-events: none; }
    .pg-stage[data-mode="view"] > div[class*="auto-rows"] { visibility: hidden; }
    .pg-live { position: absolute; left: 0; right: 0; }
    .pg-live div { white-space: pre; }
    .pg-live span { display: inline-block; }
    .pg-stage[data-mode="edit"] > textarea { cursor: text; caret-color: var(--ds-blue-700, #0070f3); }
    .pg-bar { position: absolute; left: 0; right: 0; top: calc(100% + 28px); z-index: 3;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      font: 12px/18px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ds-gray-900, #8f8f8f); }
    /* same build as the page's Sans / Serif / Mono / Pixel pill */
    .pg-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 128px;
      background: var(--ds-background-100, #0a0a0a); border: 1px solid var(--ds-gray-alpha-400, rgba(255,255,255,.14));
      box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .pg-switch button { all: unset; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 7px;
      height: 30px; padding: 0 16px; border-radius: 128px; cursor: pointer; text-align: center;
      font: 500 16px/30px var(--font-sans, "Geist"), ui-sans-serif, system-ui, sans-serif; color: var(--ds-gray-1000, #ededed);
      transition: color .2s, background .2s; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .pg-switch button[aria-checked="true"] { background: var(--ds-gray-1000, #ededed); color: var(--ds-background-100, #0a0a0a); }
    @media (max-width: 1023.98px) { .pg-switch button { padding: 0 12px; font-size: 14px; gap: 6px; } .pg-switch svg { width: 14px; height: 14px; } }
    @media (max-width: 960px) { .pg-switch button { height: 26px; line-height: 26px; } }
    .pg-switch button:focus-visible { outline: 2px solid var(--ds-blue-700, #0070f3); outline-offset: 2px; }
    .pg-name { text-align: center; max-width: 100%; }
    .pg-name div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pg-name b { font-weight: 500; color: var(--ds-gray-1000, currentColor); }
  `);

  const currentTab = () => new URLSearchParams(location.search).get('type') || 'sans';
  const find = () => {
    const h = [...document.querySelectorAll('h2')].find(e => e.textContent.trim() === 'Interactive font playground');
    const ta = h && h.parentElement.querySelector('textarea');
    return ta ? { ta, stage: ta.parentElement, box: ta.parentElement.parentElement } : null;
  };
  // the textarea is React-controlled: set it the way React listens for
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  const setText = (ta, v) => {
    if (ta.value === v) return;
    valueSetter.call(ta, v);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };
  // where the first line's baseline sits inside the textarea, so an SVG sample lands on the same line
  const ctx = document.createElement('canvas').getContext('2d');
  function baselineOf(cs) {
    const fs = parseFloat(cs.fontSize);
    ctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    const m = ctx.measureText('Hx');
    const asc = m.fontBoundingBoxAscent || fs * 0.8, desc = m.fontBoundingBoxDescent || fs * 0.2;
    const lh = parseFloat(cs.lineHeight) || fs;
    return parseFloat(cs.paddingTop) + (lh - (asc + desc)) / 2 + asc;
  }

  // a sample's own line break, or the break on a space that leaves the two lines closest in length
  function twoLines(text) {
    const t = text.trim();
    const nl = t.indexOf('\n');
    if (nl >= 0) return [t.slice(0, nl).trim(), t.slice(nl + 1).replace(/\s+/g, ' ').trim()].filter(Boolean);
    let cut = -1;
    for (let i = t.indexOf(' '); i >= 0; i = t.indexOf(' ', i + 1))
      if (cut < 0 || Math.max(i, t.length - i - 1) < Math.max(cut, t.length - cut - 1)) cut = i;
    return cut < 0 ? [t] : [t.slice(0, cut), t.slice(cut + 1)];
  }

  function listFor(t) {
    if (!lists[t]) {
      const live = [base, ...(data.texts[t] || [])].map(text => ({ text }));
      lists[t] = t === 'serif' ? live.concat(data.svg.map(s => ({ text: s.word, svg: s }))) : live;
    }
    return lists[t];
  }

  function next() {
    const p = find();
    if (!p || mode !== 'view') return;
    const list = listFor(tab);
    step = custom ? 0 : (step + 1) % list.length;
    custom = false;
    setText(p.ta, list[step].text);
    sync();
  }
  function setMode(m, focus) {
    const p = find();
    if (!p) return;
    mode = m;
    sync();
    if (m === 'edit' && focus) {
      p.ta.focus({ preventScroll: true });
      p.ta.setSelectionRange(p.ta.value.length, p.ta.value.length);
    }
    if (m === 'view' && document.activeElement === p.ta) p.ta.blur();
  }

  function sync() {
    const p = find();
    if (!p || !data) return;
    const t = currentTab();
    if (base === null) base = p.ta.value;      // the page's own text, before anything was changed
    const switched = t !== tab;
    if (switched) { tab = t; step = 0; }
    const list = listFor(tab);
    // the page carries the text across tabs: keep typed text, otherwise start the new tab's list
    if (switched && !custom) setText(p.ta, list[0].text);
    let sample = list[step];
    // typed text (or the page's own Reset) no longer matches the sample
    if (p.ta.value !== sample.text) {
      const i = sample.svg ? -1 : list.findIndex(s => !s.svg && s.text === p.ta.value);
      if (i >= 0) { step = i; custom = false; } else custom = true;
      sample = list[step];
    } else if (!sample.svg) custom = false;
    const svgSample = !custom && mode === 'view' && sample.svg;

    p.stage.classList.add('pg-stage');
    p.stage.dataset.mode = mode;
    let hit = p.stage.querySelector(':scope > .pg-hit');
    if (!hit) {
      hit = document.createElement('div');
      hit.className = 'pg-hit';
      hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', 'Next sample');
      hit.addEventListener('click', next);
      p.stage.append(hit);
      p.ta.addEventListener('keydown', e => { if (e.key === 'Escape') setMode('view'); });
    }
    hit.hidden = mode === 'edit';

    // View always shows exactly two lines, in a stage of fixed height: the sample is drawn here
    // (live font or SVG paths), broken once, and sized down until its longer line fits.
    const cs = getComputedStyle(p.ta);
    const W = p.stage.clientWidth, fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || fs;
    const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
    const H = padT + 2 * lh + padB;
    p.stage.style.minHeight = H + 'px';
    p.stage.style.height = mode === 'view' ? H + 'px' : '';
    // the page puts its first guide on the first line's baseline: take that as the baseline
    const rule = p.stage.querySelector(':scope > div[class*="auto-rows"] > div');
    const ruleY = rule ? rule.getBoundingClientRect().top - p.stage.getBoundingClientRect().top : 0;
    const rise1 = Math.round((ruleY > 1 ? ruleY : baselineOf(cs)) - padT);
    const key = mode !== 'view' ? '' : [svgSample ? 'svg' + step : p.ta.value, fs, lh, W, rise1, cs.textAlign, cs.fontFamily, cs.fontWeight,
      cs.fontStyle, cs.fontVariationSettings, cs.fontFeatureSettings, cs.letterSpacing, cs.color].join('|');
    if (hit.dataset.key !== key) {
      hit.dataset.key = key;
      hit.replaceChildren();
      hit.style.color = cs.color;
      let guides = null;   // { top, fit, n } of the lines just drawn
      const alignX = w => ({ left: 0, start: 0, right: W - w, end: W - w }[cs.textAlign] ?? (W - w) / 2);
      if (mode === 'view' && svgSample) {
        const s = svgSample, n = s.words.length;
        const width = (i, j) => s.words.slice(i, j).reduce((a, w) => a + w.a, 0) + s.space * (j - i - 1);
        let cut = n;                               // break where the two lines are closest in width
        for (let k = 1; k < n; k++) if (cut === n || Math.max(width(0, k), width(k, n)) < Math.max(width(0, cut), width(cut, n))) cut = k;
        const lines = (cut < n ? [[0, cut], [cut, n]] : [[0, n]]).map(([i, j]) => ({ words: s.words.slice(i, j), w: width(i, j) }));
        const scale = Math.min(fs / s.upem, W / Math.max(...lines.map(l => l.w)));
        const fit = scale * s.upem / fs;
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('width', W);
        svg.setAttribute('height', H);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `${s.word}, ${s.style}`);
        const top = padT + (2 * lh - lines.length * lh * fit) / 2;
        const rise = rise1 * fit;
        lines.forEach((line, i) => {
          let x = alignX(line.w * scale);
          for (const w of line.words) {
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', w.d);
            path.setAttribute('transform', `translate(${x} ${top + i * lh * fit + rise}) scale(${scale})`);
            svg.append(path);
            x += (w.a + s.space) * scale;
          }
        });
        hit.append(svg);
        guides = { top, fit, n: lines.length };
      } else if (mode === 'view') {
        const live = document.createElement('div');
        live.className = 'pg-live';
        Object.assign(live.style, { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
          fontVariationSettings: cs.fontVariationSettings, fontFeatureSettings: cs.fontFeatureSettings,
          letterSpacing: (parseFloat(cs.letterSpacing) || 0) / fs + 'em', textAlign: cs.textAlign,
          fontSize: fs + 'px', lineHeight: lh / fs });
        const lines = twoLines(p.ta.value);
        for (const t of lines) {
          const row = document.createElement('div'), span = document.createElement('span');
          span.textContent = t;
          row.append(span);
          live.append(row);
        }
        hit.append(live);
        const widest = Math.max(1, ...[...live.querySelectorAll('span')].map(e => e.getBoundingClientRect().width));
        const fit = Math.min(1, W / widest);
        live.style.fontSize = fs * fit + 'px';
        const top = padT + (2 * lh - lines.length * lh * fit) / 2;
        live.style.top = top + 'px';
        guides = { top, fit, n: lines.length };
      }
      // The page rules one dotted guide per line of its (now hidden) text field, which wraps on its
      // own and can show three or four. View hides those and rules the two lines actually shown.
      if (guides && rule) for (let i = guides.n - 1; i >= 0; i--) {
        const g = rule.cloneNode(false);
        g.style.cssText = `position:absolute;left:0;top:${guides.top + (i * lh + rise1) * guides.fit}px`;
        hit.prepend(g);
      }
    }

    let bar = p.stage.querySelector(':scope > .pg-bar');   // under the lines, out of flow: nothing moves when it arrives
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'pg-bar';
      bar.innerHTML = `<div class="pg-switch" role="radiogroup" aria-label="Sample text mode">
          <button type="button" role="radio" data-mode="view">${icon('view')}View</button>
          <button type="button" role="radio" data-mode="edit">${icon('edit')}Edit</button>
        </div><div class="pg-name" aria-live="polite"></div>`;
      bar.addEventListener('click', e => {
        const b = e.target.closest('button[data-mode]');
        if (b) setMode(b.dataset.mode, true);
      });
      p.stage.append(bar);
    }
    for (const b of bar.querySelectorAll('button[data-mode]')) b.setAttribute('aria-checked', b.dataset.mode === mode);
    // room for the bar is added below the tester only, so the lines above it never move
    const room = Math.max(0, Math.ceil(bar.getBoundingClientRect().bottom - p.box.getBoundingClientRect().bottom + 16)) + 'px';
    if (p.box.style.marginBottom !== room) p.box.style.marginBottom = room;
    const weight = document.querySelector('select#weight');
    const weightName = weight && weight.selectedOptions[0] ? weight.selectedOptions[0].textContent.replace(/\s*\(.*\)/, '') : '';
    const name = svgSample ? `<b>${svgSample.style}</b> · ${svgSample.note}` : `<b>${FAMILY[tab] || 'Geist'}${weightName ? ' ' + weightName : ''}</b>`;
    const hint = mode === 'edit' ? 'type to change the text'
      : `${custom ? 'your text' : `${step + 1} of ${list.length}`} · ${matchMedia('(pointer: coarse)').matches ? 'tap' : 'click'} the text for the next`;
    const html = `<div>${name}</div><div>${hint}</div>`;
    const nameEl = bar.querySelector('.pg-name');
    if (nameEl.dataset.html !== html) { nameEl.dataset.html = html; nameEl.innerHTML = html; }
  }

  // Take over as soon as React has hydrated the text field (it then carries React's own keys),
  // one beat later so the nodes added here are never part of what React checks.
  const hydrated = () => { const p = find(); return p && Object.keys(p.ta).some(k => k.startsWith('__reactProps')); };
  const ready = new Promise(done => { const t = setInterval(() => { if (hydrated()) { clearInterval(t); setTimeout(done, 150); } }, 40); });
  Promise.all([fetch('/addon/samples.json').then(r => r.json()), ready]).then(([d]) => {
    data = d;
    sync();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== pre);
    setInterval(sync, 250);   // follows tab switches, the size and align controls, and React re-renders
  });
})();
