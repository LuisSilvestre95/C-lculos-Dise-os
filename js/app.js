/*!
 * TODO GAS SYR S.A.S. — Aplicación: estado, interfaz, predicciones y exportación.
 */
(function () {
  'use strict';
  const E = window.GasEngine;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;
  const STORE = 'tgs-state-v2';

  /* ============================== ESTADO ============================== */
  const defaultCity = E.CITIES.findIndex((c) => c.name === 'Garagoa');
  const blankMode = (m) => ({ ...E.DEFAULT_CRITERIA[m], segs: [] });
  const DEFAULT_STATE = () => ({
    v: 2, mode: 'baja', city: String(defaultCity), altitude: E.CITIES[defaultCity].alt,
    patm: +E.patmFromAltitude(E.CITIES[defaultCity].alt).toFixed(1), gas: 'GN', G: 0.67, factorLE: 1.2,
    client: {}, baja: blankMode('baja'), media: blankMode('media')
  });
  let state = load() || DEFAULT_STATE();
  let seq = 1;
  const newId = () => 's' + Date.now().toString(36) + (seq++);

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === 2 ? normalize(s) : null;
    } catch (e) { return null; }
  }
  function normalize(s) {
    const d = DEFAULT_STATE();
    const out = { ...d, ...s, client: { ...(s.client || {}) } };
    ['baja', 'media'].forEach((m) => {
      out[m] = { ...d[m], ...(s[m] || {}) };
      out[m].segs = (Array.isArray(out[m].segs) ? out[m].segs : []).map((g) => ({
        id: g.id || newId(), ini: String(g.ini || 'A').toUpperCase().slice(0, 4), fin: String(g.fin || 'B').toUpperCase().slice(0, 4),
        q: g.q ?? '', l: g.l ?? '', mat: E.PIPES[g.mat] ? g.mat : 'PEALPE', dn: g.dn ?? '', di: g.di ?? ''
      }));
    });
    out.mode = out.mode === 'media' ? 'media' : 'baja';
    return out;
  }
  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* almacenamiento no disponible */ } }, 250);
  }
  const M = () => state[state.mode];
  const params = (extra = {}) => ({
    mode: state.mode, G: E.num(state.G, 0.67), patm: E.num(state.patm, 1013.25), pi: E.num(M().pi), factorLE: E.num(state.factorLE, 1.2),
    crit: { pmin: E.num(M().pmin), vmax: E.num(M().vmax, 20), maxLossPct: E.num(M().maxLossPct, 10) }, demand: 1, ...extra
  });

  /* ============================== UI BÁSICA ============================== */
  function toast(msg, kind = 'info', ms = 3200) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = icon(kind === 'ok' ? 'check' : kind === 'bad' ? 'alert' : 'info') + `<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, ms);
  }
  function modal({ title, body, actions }) {
    const back = $('#modal');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    const box = $('#modalActions'); box.innerHTML = '';
    const close = () => { back.hidden = true; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-ghost') + (a.danger ? ' danger' : '');
      b.type = 'button'; b.textContent = a.label;
      b.addEventListener('click', () => { if (a.onClick && a.onClick() === false) return; close(); });
      box.appendChild(b);
    });
    back.hidden = false;
    back.onclick = (e) => { if (e.target === back) close(); };
    document.addEventListener('keydown', onKey);
    const first = $('#modalBody input, #modalBody select') || box.lastElementChild;
    setTimeout(() => first && first.focus(), 30);
    return close;
  }
  const confirmBox = (title, text, onYes, yes = 'Aceptar', danger = false) =>
    modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: 'Cancelar' }, { label: yes, primary: !danger, danger, onClick: onYes }] });
  const busy = (on, text) => { $('#busy').hidden = !on; if (text) $('#busyText').textContent = text; };

  /* ============================== PARÁMETROS ============================== */
  function fillSelects() {
    const cs = $('#city');
    const opts = E.CITIES.map((c, i) => ({ i, c })).sort((a, b) => a.c.name.localeCompare(b.c.name, 'es'));
    cs.innerHTML = opts.map(({ i, c }) => `<option value="${i}">${esc(c.name)} · ${esc(c.dept)} (${c.alt} m)</option>`).join('') + '<option value="custom">⚙ Personalizado (altitud / presión manual)</option>';
    $('#gas').innerHTML = Object.entries(E.GASES).map(([k, g]) => `<option value="${k}">${esc(g.label)}</option>`).join('');
  }
  function paintParams() {
    $('#city').value = state.city;
    $('#altitude').value = state.altitude;
    $('#patm').value = state.patm;
    $('#gas').value = state.gas;
    $('#G').value = state.G;
    $('#factorLE').value = state.factorLE;
    const m = M();
    $('#pi').value = m.pi; $('#pmin').value = m.pmin; $('#vmax').value = m.vmax; $('#maxLoss').value = m.maxLossPct;
    $('#piHint').textContent = state.mode === 'baja' ? 'Típico residencial: 21–23 mbar (GN) · 28–37 mbar (GLP)' : 'Salida del regulador de primera etapa (100–5000 mbar)';
    $$('[data-client]').forEach((el) => { el.value = state.client[el.dataset.client] || ''; });
    refPlaceholder();
  }
  // El campo "Informe" muestra el nombre del cliente mientras no se escriba otro valor.
  function refPlaceholder() { const n = (state.client.name || '').trim(); $('#cRef').placeholder = n || 'Nombre del cliente'; }
  function bindParams() {
    $('#city').addEventListener('change', (e) => {
      state.city = e.target.value;
      if (state.city !== 'custom') {
        const c = E.CITIES[+state.city];
        state.altitude = c.alt; state.patm = +E.patmFromAltitude(c.alt).toFixed(1);
        $('#altitude').value = state.altitude; $('#patm').value = state.patm;
        if (!state.client.city) { state.client.city = c.name; $('#cCity').value = c.name; }
        toast(`${c.name}: ${c.alt} m s. n. m. → ${state.patm} mbar`, 'ok');
      }
      changed();
    });
    $('#altitude').addEventListener('input', (e) => {
      state.altitude = e.target.value; state.city = 'custom'; $('#city').value = 'custom';
      const h = E.num(e.target.value, NaN);
      if (Number.isFinite(h)) { state.patm = +E.patmFromAltitude(h).toFixed(1); $('#patm').value = state.patm; }
      changed();
    });
    $('#patm').addEventListener('input', (e) => { state.patm = e.target.value; state.city = 'custom'; $('#city').value = 'custom'; changed(); });
    $('#gas').addEventListener('change', (e) => {
      state.gas = e.target.value;
      if (state.gas !== 'OTRO') { state.G = E.GASES[state.gas].G; $('#G').value = state.G; }
      if (state.mode === 'baja' && state.gas === 'GLP' && E.num(M().pi) < 25) { M().pi = 28; $('#pi').value = 28; }
      changed();
    });
    $('#G').addEventListener('input', (e) => { state.G = e.target.value; const g = E.GASES[state.gas]; if (g && E.num(e.target.value) !== g.G) { state.gas = 'OTRO'; $('#gas').value = 'OTRO'; } changed(); });
    $('#factorLE').addEventListener('input', (e) => { state.factorLE = e.target.value; changed(); });
    [['pi', 'pi'], ['pmin', 'pmin'], ['vmax', 'vmax'], ['maxLoss', 'maxLossPct']].forEach(([id, key]) => $('#' + id).addEventListener('input', (e) => { M()[key] = e.target.value; changed(); }));
    $$('[data-client]').forEach((el) => el.addEventListener('input', () => { state.client[el.dataset.client] = el.value; persist(); refPlaceholder(); }));
  }

  /* ============================== MODO ============================== */
  function setMode(mode) {
    state.mode = mode;
    document.body.dataset.mode = mode;
    $$('.mode-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    $('#segTitle').textContent = mode === 'baja' ? 'Tramos · baja presión' : 'Tramos · media presión';
    $('meta[name="theme-color"]').setAttribute('content', '#023047');
    paintParams(); renderSegments(); changed();
  }

  /* ============================== EDITOR DE TRAMOS ============================== */
  function dnOptions(mat, dn) {
    const cat = E.PIPES[mat];
    if (!cat || !cat.sizes.length) return '<option value="">Ø interno manual →</option>';
    return cat.sizes.map((s) => `<option value="${esc(s.dn)}"${s.dn === dn ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
  }
  const matOptions = (mat) => Object.entries(E.PIPES).map(([k, p]) => `<option value="${k}"${k === mat ? ' selected' : ''}>${esc(p.label)}</option>`).join('');
  function ensureDn(seg) {
    const cat = E.PIPES[seg.mat];
    if (cat && cat.sizes.length && !cat.sizes.some((s) => s.dn === seg.dn)) {
      // conserva el diámetro más cercano al anterior
      const prev = E.num(seg.di, NaN);
      seg.dn = (Number.isFinite(prev) ? cat.sizes.reduce((a, b) => (Math.abs(b.di - prev) < Math.abs(a.di - prev) ? b : a)) : cat.sizes[Math.min(2, cat.sizes.length - 1)]).dn;
    }
    if (seg.mat !== 'CUSTOM') { const p = E.getPipe(seg.mat, seg.dn); if (p) seg.di = p.di; }
  }
  function rowHTML(s, i) {
    ensureDn(s);
    const custom = s.mat === 'CUSTOM';
    return `<div class="seg-row" role="row" data-i="${i}">
      <div class="c-n"><span class="num">${i + 1}</span><span class="route-lbl">Tramo ${esc(s.ini)} → ${esc(s.fin)}</span></div>
      <div class="cell c-ini"><label for="ini${i}">Inicio</label><input id="ini${i}" data-f="ini" value="${esc(s.ini)}" maxlength="4" autocapitalize="characters" autocomplete="off"></div>
      <div class="cell c-fin"><label for="fin${i}">Fin</label><input id="fin${i}" data-f="fin" value="${esc(s.fin)}" maxlength="4" autocapitalize="characters" autocomplete="off"></div>
      <div class="cell c-q"><label for="q${i}">Caudal (m³/h)</label><input id="q${i}" data-f="q" value="${esc(s.q)}" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off"></div>
      <div class="cell c-l"><label for="l${i}">Longitud (m)</label><input id="l${i}" data-f="l" value="${esc(s.l)}" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off"></div>
      <div class="cell c-mat"><label for="m${i}">Material</label><select id="m${i}" data-f="mat">${matOptions(s.mat)}</select></div>
      <div class="cell c-dn"><label for="d${i}">Diámetro</label><select id="d${i}" data-f="dn"${custom ? ' disabled' : ''}>${dnOptions(s.mat, s.dn)}</select></div>
      <div class="cell c-di"><label for="di${i}">Ø interno (mm)</label><input id="di${i}" data-f="di" value="${esc(s.di)}" type="text" inputmode="decimal"${custom ? '' : ' readonly tabindex="-1"'} placeholder="mm"></div>
      <div class="cell c-res"><label>Resultado</label><div class="res-chip">—</div></div>
      <div class="c-act"><button class="mini-btn dup" type="button" title="Duplicar tramo" aria-label="Duplicar tramo ${i + 1}">${icon('copy')}</button><button class="mini-btn del" type="button" title="Eliminar tramo" aria-label="Eliminar tramo ${i + 1}">${icon('trash')}</button></div>
    </div>`;
  }
  function renderSegments() {
    const segs = M().segs;
    $('#segTable').querySelector('.seg-head').style.display = segs.length ? '' : 'none';
    $('#segBody').innerHTML = segs.length ? segs.map(rowHTML).join('') :
      `<div class="empty">${icon('route')}<p><b>Aún no hay tramos.</b><br>Pulse <b>Agregar tramo</b> o cargue el <b>Ejemplo</b> para ver la herramienta en acción.</p></div>`;
  }
  function newSegment() {
    const segs = M().segs;
    const last = segs[segs.length - 1];
    const nodes = segs.flatMap((s) => [s.ini, s.fin]).filter((n) => /^[A-Z]+$/.test(n));
    const maxNode = nodes.reduce((a, n) => (E.nodeIndex(n) > E.nodeIndex(a) ? n : a), nodes[0] || '');
    const def = state.mode === 'baja' ? { mat: 'PEALPE', dn: '1620' } : { mat: 'PE100', dn: '3/4' };
    return {
      id: newId(), ini: last ? last.fin : 'A', fin: last ? E.nextNode(maxNode) : 'B', q: '', l: '',
      mat: last ? last.mat : def.mat, dn: last ? last.dn : def.dn, di: last ? last.di : ''
    };
  }
  function bindSegments() {
    const body = $('#segBody');
    body.addEventListener('input', (e) => {
      const el = e.target, row = el.closest('.seg-row'); if (!row || !el.dataset.f) return;
      const i = +row.dataset.i, s = M().segs[i], f = el.dataset.f;
      if (f === 'ini' || f === 'fin') {
        const val = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (el.value !== val) el.value = val;
        if (f === 'fin') {
          // Propaga el renombre del nodo a los tramos que salían de él.
          const old = s.fin;
          M().segs.forEach((o, j) => { if (j !== i && o.ini === old && old) { o.ini = val; const inp = $(`#ini${j}`); if (inp) inp.value = val; } });
        }
        s[f] = val;
        const lbl = row.querySelector('.route-lbl'); if (lbl) lbl.textContent = `Tramo ${s.ini} → ${s.fin}`;
      } else if (f === 'q' || f === 'l' || f === 'di') {
        s[f] = el.value;
        const v = E.num(el.value, NaN);
        el.classList.toggle('invalid', el.value.trim() !== '' && !(v > 0));
      }
      changed();
    });
    body.addEventListener('change', (e) => {
      const el = e.target, row = el.closest('.seg-row'); if (!row) return;
      const i = +row.dataset.i, s = M().segs[i];
      if (el.dataset.f === 'mat') {
        s.mat = el.value; ensureDn(s);
        const d = row.querySelector('[data-f="dn"]'); d.innerHTML = dnOptions(s.mat, s.dn); d.disabled = s.mat === 'CUSTOM';
        const di = row.querySelector('[data-f="di"]'); di.value = s.di; di.readOnly = s.mat !== 'CUSTOM'; di.tabIndex = s.mat === 'CUSTOM' ? 0 : -1;
        if (s.mat === 'CUSTOM') di.focus();
        changed();
      } else if (el.dataset.f === 'dn') {
        s.dn = el.value; ensureDn(s); row.querySelector('[data-f="di"]').value = s.di; changed();
      }
    });
    // Enter: siguiente campo; en la longitud del último tramo crea automáticamente el siguiente.
    body.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.matches('input')) return;
      e.preventDefault();
      const row = e.target.closest('.seg-row'), i = +row.dataset.i;
      const fields = $$('input:not([readonly]), select:not([disabled])', row);
      const k = fields.indexOf(e.target);
      if (e.target.dataset.f === 'l' && i === M().segs.length - 1) { $('#addBtn').click(); return; }
      const next = fields[k + 1] || $(`#q${i + 1}`);
      if (next) next.focus();
    });
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const i = +btn.closest('.seg-row').dataset.i;
      if (btn.classList.contains('del')) {
        const s = M().segs[i];
        const doDel = () => { M().segs.splice(i, 1); renderSegments(); changed(); toast(`Tramo ${s.ini}-${s.fin} eliminado`); };
        if (E.num(s.q) > 0 || E.num(s.l) > 0) confirmBox('Eliminar tramo', `¿Eliminar el tramo ${s.ini} → ${s.fin}?`, doDel, 'Eliminar', true); else doDel();
      } else if (btn.classList.contains('dup')) {
        const s = M().segs[i];
        const n = newSegment();
        M().segs.splice(i + 1, 0, { ...s, id: newId(), ini: s.ini, fin: n.fin });
        renderSegments(); changed(); toast('Tramo duplicado como nuevo ramal desde ' + s.ini, 'ok');
      }
    });
    $('#addBtn').addEventListener('click', () => {
      M().segs.push(newSegment()); renderSegments(); changed();
      const i = M().segs.length - 1; const q = $(`#q${i}`);
      if (q) { q.focus({ preventScroll: true }); q.closest('.seg-row').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
    $('#clearBtn').addEventListener('click', () => {
      if (!M().segs.length) return;
      confirmBox('Limpiar tramos', `Se eliminarán los ${M().segs.length} tramos de ${state.mode === 'baja' ? 'baja' : 'media'} presión.`, () => { M().segs = []; renderSegments(); changed(); toast('Tramos eliminados'); }, 'Limpiar', true);
    });
    $('#exampleBtn').addEventListener('click', () => {
      const load = () => { M().segs = example(state.mode); renderSegments(); changed(); toast('Ejemplo cargado', 'ok'); };
      if (M().segs.length) confirmBox('Cargar ejemplo', 'Se reemplazarán los tramos actuales por un ejemplo.', load); else load();
    });
    $('#autoBtn').addEventListener('click', autoSizeAction);
    $('#flowCalcBtn').addEventListener('click', flowCalculator);
  }
  function example(mode) {
    const S = (ini, fin, q, l, mat, dn) => ({ id: newId(), ini, fin, q: String(q), l: String(l), mat, dn, di: '' });
    if (mode === 'baja') {
      return [
        S('A', 'B', 3.2, 6, 'PEALPE', '2025'),
        S('B', 'C', 2.3, 8.5, 'PEALPE', '1620'),
        S('B', 'D', 0.9, 5, 'PEALPE', '1216'),
        S('D', 'E', 0.4, 4.2, 'PEALPE', '1216')
      ];
    }
    return [
      S('A', 'B', 24, 30, 'PE100', '1 1/4'),
      S('B', 'C', 16, 22, 'PE100', '1'),
      S('C', 'D', 8, 35, 'PE100', '3/4'),
      S('B', 'E', 8, 18, 'PE100', '3/4')
    ];
  }

  /* ============================== CÁLCULO ============================== */
  let calcRaf = 0, last = null;
  function changed() { persist(); cancelAnimationFrame(calcRaf); calcRaf = requestAnimationFrame(recalc); }

  function compute() {
    const p = params();
    return { p, res: E.calcNetwork(M().segs, p) };
  }

  function recalc() {
    last = compute();
    const { res } = last;
    renderHero(res);
    renderRowChips(res);
    renderNotices(res);
    renderResults(res);
    renderCharts(last);
  }

  const usage = (v, lim) => (lim > 0 ? v / lim : 0);
  const tone = (u) => (u > 1 + 1e-9 ? 'bad' : u >= 0.8 ? 'warn' : 'ok');

  function renderHero(res) {
    const s = res.summary;
    const hero = $('#heroStatus');
    hero.classList.remove('ok', 'bad');
    const use = hero.querySelector('use');
    if (!s.total) { $('#heroValue').textContent = 'Sin datos'; $('#heroSub').textContent = 'Agregue tramos para iniciar el cálculo'; use.setAttribute('href', '#i-gauge'); }
    else if (!s.complete) { $('#heroValue').textContent = 'Incompleto'; $('#heroSub').textContent = `${s.calculated} de ${s.total} tramos con datos completos`; use.setAttribute('href', '#i-alert'); }
    else if (s.ok) { hero.classList.add('ok'); $('#heroValue').textContent = 'APROBADO'; $('#heroSub').textContent = `Los ${s.total} tramos cumplen los criterios`; use.setAttribute('href', '#i-check'); }
    else { hero.classList.add('bad'); $('#heroValue').textContent = 'RECHAZADO'; $('#heroSub').textContent = `${s.total - s.approved} de ${s.total} tramos no cumplen`; use.setAttribute('href', '#i-x'); }
    const c = last.p.crit;
    $('#kPf').innerHTML = Number.isFinite(s.pfMin) ? `${fmt(s.pfMin, 2)}<em>mbar</em>` : '—';
    $('#kPfNode').textContent = Number.isFinite(s.pfMin) ? `En el nodo ${s.criticalNode}${c.pmin > 0 ? ` · exigido ≥ ${c.pmin}` : ''}` : 'punto final de la red';
    $('#kPf').parentElement.className = 'kpi ' + (Number.isFinite(s.pfMin) && s.pfMin < c.pmin ? 'bad' : 'ok');
    $('#kDrop').innerHTML = Number.isFinite(s.totalLoss) ? `${fmt(s.totalLoss, 2)}<em>mbar</em>` : '—';
    $('#kDropPct').textContent = Number.isFinite(s.totalLossPct) ? `${fmt(s.totalLossPct, 1)} % de la presión de suministro` : '—';
    $('#kVel').innerHTML = Number.isFinite(s.vMax) ? `${fmt(s.vMax, 2)}<em>m/s</em>` : '—';
    $('#kVelLim').textContent = `Límite ${c.vmax} m/s`;
    $('#kVel').parentElement.className = 'kpi ' + (s.vMax > c.vmax ? 'bad' : 'ok');
    $('#kOk').textContent = s.total ? `${s.approved} / ${s.total}` : '—';
    $('#kQ').textContent = s.total ? `Caudal total ${fmt(s.qSource, 2)} m³/h` : '—';
  }

  /** Motivo corto del rechazo de un tramo. */
  function why(r) {
    const out = [];
    if (!r.checks.pmin) out.push('presión baja');
    if (!r.checks.vel) out.push('velocidad alta');
    if (!r.checks.loss) out.push('pérdida alta');
    return out.join(' · ');
  }
  function statusChip(r, withWhy = false) {
    if (!r.valid) return `<span class="st idle">${icon('info')}Falta ${esc(r.reason || 'dato').toLowerCase()}</span>`;
    if (r.ok) return `<span class="st ok">${icon('check')}Aprobado</span>`;
    return `<span class="st bad" title="${esc(why(r))}">${icon('x')}Rechazado${withWhy ? ': ' + esc(why(r)) : ''}</span>`;
  }
  function renderRowChips(res) {
    $$('#segBody .seg-row').forEach((row) => {
      const r = res.rows[+row.dataset.i];
      if (!r) return;
      row.classList.toggle('ok', !!(r.valid && r.ok)); row.classList.toggle('bad', !!(r.valid && !r.ok));
      const chip = row.querySelector('.res-chip');
      chip.innerHTML = r.valid
        ? `${statusChip(r, true)}<span>Pf <b>${fmt(r.pf, 2)}</b></span><span>V <b>${fmt(r.v, 2)}</b></span>`
        : statusChip(r);
    });
  }
  function renderNotices(res) {
    const box = $('#netNotice');
    const items = [...res.errors.map((t) => ({ t, k: 'bad' })), ...res.warnings.map((t) => ({ t, k: 'warn' }))];
    if (!items.length) { box.hidden = true; return; }
    const k = items.some((x) => x.k === 'bad') ? 'bad' : 'warn';
    box.className = 'notice ' + k; box.hidden = false;
    box.innerHTML = icon('alert') + `<ul>${items.map((x) => `<li>${esc(x.t)}</li>`).join('')}</ul>`;
  }

  /* ---------- Tabla de resultados ---------- */
  const COLS = {
    baja: [['Tramo', ''], ['Q', 'm³/h'], ['L', 'm'], ['Le', 'm'], ['Material', ''], ['Diámetro', ''], ['D int', 'mm'], ['Pi', 'mbar'], ['ΔP', 'mbar'], ['Pf', 'mbar'], ['ΔP', '%'], ['V', 'm/s'], ['Estado', '']],
    media: [['Tramo', ''], ['Q', 'm³/h'], ['L', 'm'], ['Le', 'm'], ['Material', ''], ['Diámetro', ''], ['D int', 'mm'], ['P1', 'mbar'], ['P1 abs', 'mbar'], ['P2 abs', 'mbar'], ['P2', 'mbar'], ['P2', 'psi'], ['ΔP', '%'], ['V', 'm/s'], ['Estado', '']]
  };
  const matShort = (m) => ({ PEALPE: 'PE-AL-PE', PE100: 'PE100 IPS', PE100M: 'PE100', PE80: 'PE80', ACERO: 'Acero', GALV: 'Galvanizado', COBRE: 'Cobre L', CUSTOM: 'Manual' }[m] || m);
  const dnLabel = (r) => { const p = E.getPipe(r.mat, r.dn); return p ? p.label : r.mat === 'CUSTOM' ? '—' : (r.dn || '—'); };
  function resultRows(res) {
    const c = last.p.crit, media = res.mode === 'media';
    return res.rows.map((r) => {
      if (!r.valid) return { r, cells: null };
      const vT = tone(usage(r.v, c.vmax)), lT = tone(usage(r.lossPct, c.maxLossPct));
      const pT = r.pf < c.pmin || r.pf <= 0 ? 'bad' : 'ok';
      const common = [[`${r.ini}-${r.fin}`, ''], [fmt(r.q, 2), ''], [fmt(r.l, 2), ''], [fmt(r.le, 2), ''], [matShort(r.mat), ''], [dnLabel(r), ''], [fmt(r.d, 1), '']];
      const mid = media
        ? [[fmt(r.pi, 2), ''], [fmt(r.p1Abs, 1), ''], [fmt(r.p2Abs, 1), ''], [fmt(r.pf, 2), 'c-' + pT], [fmt(r.psi, 3), ''], [fmt(r.lossPct, 2), 'c-' + lT], [fmt(r.v, 2), 'c-' + vT]]
        : [[fmt(r.pi, 3), ''], [fmt(r.dp, 3), ''], [fmt(r.pf, 3), 'c-' + pT], [fmt(r.lossPct, 2), 'c-' + lT], [fmt(r.v, 2), 'c-' + vT]];
      return { r, cells: [...common, ...mid, ['__status__', '']] };
    });
  }
  function renderResults(res) {
    const cols = COLS[res.mode];
    $('#resHead').innerHTML = '<tr>' + cols.map(([a, b]) => `<th>${esc(a)}${b ? `<i>${esc(b)}</i>` : ''}</th>`).join('') + '</tr>';
    if (!res.rows.length) { $('#resBody').innerHTML = `<tr><td colspan="${cols.length}" class="muted" style="padding:22px">Sin tramos calculados</td></tr>`; return; }
    $('#resBody').innerHTML = resultRows(res).map(({ r, cells }) => {
      if (!cells) return `<tr><td>${esc(r.ini)}-${esc(r.fin)}</td><td colspan="${cols.length - 1}" class="muted" style="text-align:left">${statusChip(r)}</td></tr>`;
      return '<tr>' + cells.map(([v, cls]) => (v === '__status__' ? `<td>${statusChip(r)}</td>` : `<td class="${cls}">${esc(v)}</td>`)).join('') + '</tr>';
    }).join('');
  }

  /* ---------- Gráficas ---------- */
  let views = null;
  function chartSpecs({ res, p }) {
    const valid = res.rows.filter((r) => r.valid);
    if (!valid.length) {
      const empty = { empty: true, emptyText: 'Agregue tramos con caudal, longitud y diámetro' };
      return { profile: empty, vel: empty };
    }
    const path = res.path.map((i) => res.rows[i]);
    const first = path[0];
    const points = [{ x: 0, y: first.pi, label: first.ini, tip: `<b>Nodo ${esc(first.ini)} (inicio)</b>${fmt(first.pi, 2)} mbar` }]
      .concat(path.map((r) => ({ x: r.dist, y: r.pf, label: r.fin, bad: !r.ok, tip: `<b>Nodo ${esc(r.fin)}</b>P = ${fmt(r.pf, 2)} mbar<br>Distancia ${fmt(r.dist, 1)} m · ΔP ${fmt(r.dp, 3)} mbar` })));
    const profile = {
      kind: 'line', points, xLabel: 'Distancia equivalente (m)', yLabel: 'Presión (mbar)', color: null,
      refs: p.crit.pmin > 0 ? [{ y: p.crit.pmin, label: `Mínima ${p.crit.pmin} mbar` }] : []
    };
    const vel = {
      kind: 'bars', yLabel: 'Velocidad (m/s)', valueLabels: true,
      bars: valid.map((r) => ({ label: `${r.ini}-${r.fin}`, value: r.v, status: tone(usage(r.v, p.crit.vmax)), tip: `<b>Tramo ${esc(r.ini)}-${esc(r.fin)}</b>V = ${fmt(r.v, 2)} m/s<br>Q ${fmt(r.q, 2)} m³/h · D ${fmt(r.d, 1)} mm` })),
      refs: [{ y: p.crit.vmax, label: `Límite ${p.crit.vmax} m/s` }]
    };
    return { profile, vel };
  }
  function renderCharts(data) {
    if (!views) views = { profile: new Charts.ChartView($('#chProfile')), vel: new Charts.ChartView($('#chVel')) };
    const sp = chartSpecs(data);
    views.profile.set(sp.profile); views.vel.set(sp.vel);
  }

  function autoSizeAction() {
    const segs = M().segs;
    if (!segs.length) { toast('Agregue tramos primero'); return; }
    const res = E.calcNetwork(segs, params());
    if (!res.summary.complete) { toast('Complete caudal y longitud de todos los tramos', 'bad'); return; }
    const out = E.autoSize(segs, params());
    const changes = out.segments.map((s, i) => ({ s, o: segs[i] })).filter(({ s, o }) => s.dn !== o.dn);
    if (!changes.length) { toast(out.ok ? 'Los diámetros actuales ya son los óptimos' : 'No hay diámetros en catálogo que resuelvan la red', out.ok ? 'ok' : 'bad'); return; }
    const list = changes.map(({ s, o }) => `<li><b>${esc(s.ini)}-${esc(s.fin)}</b>: ${esc((E.getPipe(o.mat, o.dn) || {}).label || o.dn)} → <b>${esc(E.getPipe(s.mat, s.dn).label)}</b></li>`).join('');
    modal({
      title: 'Dimensionamiento automático',
      body: `<p>Método de pérdida unitaria admisible sobre la ruta más larga, con ajuste iterativo hasta cumplir todos los criterios.</p><ul>${list}</ul><p>${out.ok ? '<span class="st ok">' + icon('check') + 'La red quedará APROBADA</span>' : '<span class="st bad">' + icon('x') + 'Aun así no cumple: revise presión o caudales</span>'}</p>`,
      actions: [{ label: 'Cancelar' }, { label: 'Aplicar cambios', primary: true, onClick: () => { const prev = JSON.parse(JSON.stringify(M().segs)); M().segs = out.segments.map((s) => ({ ...s })); M().segs.forEach(ensureDn); renderSegments(); changed(); undoToast(prev); } }]
    });
  }
  function undoToast(prev) {
    toast('Diámetros aplicados. Puede deshacer desde el botón que aparece abajo.', 'ok');
    const el = document.createElement('div'); el.className = 'toast';
    el.innerHTML = `${icon('info')}<span>¿Deshacer el dimensionamiento?</span>`;
    const b = document.createElement('button'); b.className = 'chip-btn'; b.textContent = 'Deshacer'; b.style.marginLeft = 'auto';
    b.onclick = () => { M().segs = prev; renderSegments(); changed(); el.remove(); toast('Cambios deshechos'); };
    el.appendChild(b); $('#toasts').appendChild(el); setTimeout(() => el.remove(), 9000);
  }

  function flowCalculator() {
    const gas = E.GASES[state.gas] || E.GASES.GN;
    const segOpts = M().segs.map((s, i) => `<option value="${i}">Tramo ${i + 1}: ${esc(s.ini)} → ${esc(s.fin)}</option>`).join('');
    modal({
      title: 'Caudal por potencia de gasodomésticos',
      body: `<p>Q = Potencia / PCS. Sume la potencia nominal de los equipos que alimenta el tramo.</p>
        <div class="fields"><div class="field"><label for="fcP">Potencia</label><input id="fcP" type="text" inputmode="decimal" placeholder="Ej. 24"></div>
        <div class="field"><label for="fcU">Unidad</label><select id="fcU"><option>kW</option><option>BTU/h</option><option>kcal/h</option><option>MJ/h</option></select></div>
        <div class="field"><label for="fcS">PCS (kWh/m³)</label><input id="fcS" type="text" inputmode="decimal" value="${gas.pcs}"></div>
        <div class="field"><label for="fcT">Asignar a</label><select id="fcT">${segOpts || '<option value="">(sin tramos)</option>'}</select></div></div>
        <div class="big-result" id="fcR">— m³/h</div>`,
      actions: [{ label: 'Cerrar' }, {
        label: 'Asignar caudal', primary: true, onClick: () => {
          const q = calcQ(); const i = $('#fcT').value;
          if (!(q > 0) || i === '') { toast('Ingrese una potencia válida y un tramo', 'bad'); return false; }
          M().segs[+i].q = q.toFixed(3); renderSegments(); changed(); toast(`Q = ${q.toFixed(3)} m³/h asignado`, 'ok');
        }
      }]
    });
    const calcQ = () => E.flowFromPower(E.num($('#fcP').value), $('#fcU').value, E.num($('#fcS').value, gas.pcs));
    const upd = () => { const q = calcQ(); $('#fcR').textContent = q > 0 ? `${q.toFixed(3)} m³/h` : '— m³/h'; };
    ['#fcP', '#fcU', '#fcS'].forEach((s) => $(s).addEventListener('input', upd));
  }

  /* ============================== EXPORTACIÓN ============================== */
  const today = () => new Date();
  const dateStr = (d = today()) => d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
  const fileBase = () => `Memoria_${state.mode === 'baja' ? 'BajaPresion' : 'MediaPresion'}_${slug(state.client.name) || 'Proyecto'}_${new Date().toISOString().slice(0, 10)}`;

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function reportData() {
    const data = last || compute();
    const city = state.city !== 'custom' ? E.CITIES[+state.city] : null;
    return {
      mode: state.mode, client: { ...state.client }, date: dateStr(), dateISO: new Date().toISOString(),
      params: { ...data.p, gasLabel: (E.GASES[state.gas] || {}).label || 'Gas', city: city ? `${city.name} (${city.dept})` : 'Personalizado', altitude: E.num(state.altitude, NaN) },
      res: data.res, specs: chartSpecs(data),
      table: { cols: COLS[data.res.mode], rows: resultRows(data.res) }
    };
  }
  async function buildPDF() {
    if (!M().segs.length) { toast('Agregue al menos un tramo para generar la memoria', 'bad'); return null; }
    busy(true, 'Generando memoria de cálculo…');
    try {
      await new Promise((r) => setTimeout(r, 30));
      const doc = await window.GasPDF.build(reportData());
      return doc;
    } catch (err) {
      console.error(err); toast('Error generando el PDF: ' + err.message, 'bad', 6000); return null;
    } finally { busy(false); }
  }
  async function exportPDF() {
    const doc = await buildPDF(); if (!doc) return;
    const blob = doc.output('blob');
    download(blob, fileBase() + '.pdf');
    toast('PDF generado en alta calidad', 'ok');
  }
  async function sharePDF() {
    const doc = await buildPDF(); if (!doc) return;
    const file = new File([doc.output('blob')], fileBase() + '.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Memoria de cálculo — TODO GAS SYR', text: `Memoria de cálculo ${state.client.name || ''}`.trim() }); }
      catch (e) { if (e.name !== 'AbortError') toast('No se pudo compartir: ' + e.message, 'bad'); }
    } else { download(file, file.name); toast('Su navegador no permite compartir archivos: el PDF se descargó', 'info', 4500); }
  }
  function exportCSV() {
    const d = reportData();
    if (!d.res.rows.length) { toast('No hay resultados para exportar', 'bad'); return; }
    const n = (v, k = 3) => (Number.isFinite(v) ? v.toFixed(k).replace('.', ',') : '');
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const L = [];
    L.push(['TODO GAS SYR S.A.S. - NIT 901.126.243-3'].map(q).join(';'));
    L.push([`Memoria de cálculo - ${d.mode === 'baja' ? 'Baja presión (Renouard lineal)' : 'Media presión (Renouard cuadrática)'}`].map(q).join(';'));
    L.push(['Cliente', d.client.name, 'Cédula/NIT', d.client.id].map(q).join(';'));
    L.push(['Dirección', d.client.address, 'Municipio', d.client.city].map(q).join(';'));
    L.push(['Fecha', d.date, 'Proyecto', d.client.ref].map(q).join(';'));
    L.push(['Gas', d.params.gasLabel, 'Densidad relativa', n(d.params.G, 3)].map(q).join(';'));
    L.push(['Presión atmosférica (mbar)', n(d.params.patm, 1), 'Presión de suministro (mbar)', n(d.params.pi, 2)].map(q).join(';'));
    L.push(['Factor Le', n(d.params.factorLE, 2), 'Criterios', `Pmin ${d.params.crit.pmin} mbar; Vmax ${d.params.crit.vmax} m/s; Pérdida máx ${d.params.crit.maxLossPct} %`].map(q).join(';'));
    L.push('');
    const media = d.mode === 'media';
    const head = media
      ? ['Tramo', 'Inicio', 'Fin', 'Q (m3/h)', 'L (m)', 'Le (m)', 'Material', 'Diámetro', 'D int (mm)', 'P1 (mbar)', 'P1 abs (mbar)', 'P2 abs (mbar)', 'P2 (mbar)', 'P2 (psi)', 'Pérdida (%)', 'V (m/s)', 'Estado']
      : ['Tramo', 'Inicio', 'Fin', 'Q (m3/h)', 'L (m)', 'Le (m)', 'Material', 'Diámetro', 'D int (mm)', 'Pi (mbar)', 'Pérdida (mbar)', 'Pf (mbar)', 'Pérdida (%)', 'V (m/s)', 'Estado'];
    L.push(head.map(q).join(';'));
    d.table.rows.forEach(({ r }, i) => {
      const mat = (E.PIPES[r.mat] || {}).label || r.mat;
      const dn = (E.getPipe(r.mat, r.dn) || {}).label || '';
      const base = [i + 1, r.ini, r.fin, n(r.q, 3), n(r.l, 2), n(r.le, 2), mat, dn, n(r.d, 1)];
      if (!r.valid) { L.push([...base, `Datos incompletos: ${r.reason}`].map(q).join(';')); return; }
      const tail = [r.ok ? 'APROBADO' : 'RECHAZADO'];
      L.push((media
        ? [...base, n(r.pi, 2), n(r.p1Abs, 1), n(r.p2Abs, 1), n(r.pf, 2), n(r.psi, 3), n(r.lossPct, 2), n(r.v, 2), ...tail]
        : [...base, n(r.pi, 3), n(r.dp, 3), n(r.pf, 3), n(r.lossPct, 2), n(r.v, 2), ...tail]).map(q).join(';'));
    });
    L.push('');
    const s = d.res.summary;
    L.push(['Resultado global', s.ok ? 'APROBADO' : s.complete ? 'RECHAZADO' : 'INCOMPLETO', 'Presión mínima (mbar)', n(s.pfMin, 3), 'En el nodo', s.criticalNode].map(q).join(';'));
    L.push(['Velocidad máxima (m/s)', n(s.vMax, 2), 'Caída total (mbar)', n(s.totalLoss, 3), 'Caudal total (m3/h)', n(s.qSource, 3)].map(q).join(';'));
    download(new Blob(['﻿' + L.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileBase() + '.csv');
    toast('Archivo CSV listo para Excel', 'ok');
  }
  function saveProject() {
    const payload = { app: 'TODO GAS SYR S.A.S.', format: 'tgs-project', version: 2, savedAt: new Date().toISOString(), state };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `Proyecto_${slug(state.client.name) || 'TODO_GAS'}_${new Date().toISOString().slice(0, 10)}.json`);
    toast('Proyecto guardado', 'ok');
  }
  function openProject(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        const s = data && data.format === 'tgs-project' ? data.state : data;
        if (!s || s.v !== 2 || !s.baja || !s.media) throw new Error('Formato no reconocido');
        state = normalize(s); persist(); setMode(state.mode); toast('Proyecto cargado', 'ok');
      } catch (e) { toast('No se pudo abrir el archivo: ' + e.message, 'bad', 5000); }
    };
    rd.readAsText(file);
  }
  function bindExport() {
    $('#pdfBtn').addEventListener('click', exportPDF);
    $('#shareBtn').addEventListener('click', sharePDF);
    $('#csvBtn').addEventListener('click', exportCSV);
    $('#saveBtn').addEventListener('click', saveProject);
    $('#openFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) openProject(f); e.target.value = ''; });
    $('#printBtn').addEventListener('click', () => window.print());
  }

  /* ============================== TEMA / PWA ============================== */
  function bindChrome() {
    $('#themeBtn').addEventListener('click', () => {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('tgs-theme', root.dataset.theme); } catch (e) { /* sin almacenamiento */ }
      if (last) renderCharts(last);
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => last && renderCharts(last));
    $$('.mode-btn').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
    $('#installBtn').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#installBtn').hidden = true; });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !document.documentElement.hasAttribute('data-single-file')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }

  /* ============================== INICIO ============================== */
  fillSelects();
  if (!state.client.city && state.city !== 'custom' && E.CITIES[+state.city]) state.client.city = E.CITIES[+state.city].name;
  bindParams(); bindSegments(); bindExport(); bindChrome();
  setMode(state.mode);
  window.TGS = { get state() { return state; }, recalc, compute, reportData };
})();
