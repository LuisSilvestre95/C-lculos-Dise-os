/*!
 * TODO GAS SYR S.A.S. — Motor de cálculo de redes de gas (GN / GLP)
 * Renouard lineal (baja presión) y Renouard cuadrática (media presión).
 * Módulo puro: sin DOM. Funciona en navegador (window.GasEngine) y en Node (module.exports).
 */
(function (root) {
  'use strict';

  /* ============================== CONSTANTES ============================== */
  const K = {
    // ΔP[mbar] = 23 200 · S · Le[m] · Q[m³/h]^1.82 · D[mm]^-4.82          (Renouard lineal, P ≤ 100 mbar)
    RENOUARD_LINEAL: 23200,
    // P1²−P2² [bar²] = 48 600 · S · Le[km] · Q^1.82 · D^-4.82              (Renouard cuadrática)
    // Pasado a mbar² y metros: 48 600 · 10⁶ / 10³ = 4.86·10⁷
    RENOUARD_CUADRATICA: 4.86e7,
    // V[m/s] = 354 · Q[m³/h] / (P_abs[bar] · D[mm]²)
    VELOCIDAD: 354,
    EXP_Q: 1.82,
    EXP_D: 4.82,
    MBAR_A_PSI: 0.0145037738,
    P_NIVEL_MAR: 1013.25
  };

  /* Catálogo de tuberías — diámetros según norma de fabricación. */
  const PIPES = {
    PEALPE: {
      label: 'PE-AL-PE (multicapa)', short: 'PE-AL-PE',
      norma: 'ISO 17484 / NTC 4579',
      sizes: [
        { dn: '1216', label: '1216 · 1/2" (Ø16 mm)', de: 16, di: 12 },
        { dn: '1418', label: '1418 · 5/8" (Ø18 mm)', de: 18, di: 14 },
        { dn: '1620', label: '1620 · 3/4" (Ø20 mm)', de: 20, di: 16 },
        { dn: '2025', label: '2025 · 1" (Ø25 mm)', de: 25, di: 20 },
        { dn: '2632', label: '2632 · 1 1/4" (Ø32 mm)', de: 32, di: 26 }
      ]
    },
    PE100: {
      label: 'Polietileno PE100 IPS SDR 11', short: 'PE100 · IPS',
      norma: 'ASTM D2513 / NTC 1746',
      sizes: [
        { dn: '1/2', label: '1/2" IPS', de: 21.3, di: 17.4 },
        { dn: '3/4', label: '3/4" IPS', de: 26.7, di: 21.9 },
        { dn: '1', label: '1" IPS', de: 33.4, di: 27.4 },
        { dn: '1 1/4', label: '1 1/4" IPS', de: 42.2, di: 34.5 },
        { dn: '1 1/2', label: '1 1/2" IPS', de: 48.3, di: 39.5 },
        { dn: '2', label: '2" IPS', de: 60.3, di: 49.3 },
        { dn: '3', label: '3" IPS', de: 88.9, di: 72.7 },
        { dn: '4', label: '4" IPS', de: 114.3, di: 93.5 }
      ]
    },
    PE100M: {
      label: 'Polietileno PE100 métrico SDR 11', short: 'PE100 · métrico',
      norma: 'ISO 4437 / NTC 1746',
      sizes: [
        { dn: '20', label: 'Ø20 mm SDR11', de: 20, di: 14.0 },
        { dn: '25', label: 'Ø25 mm SDR11', de: 25, di: 19.0 },
        { dn: '32', label: 'Ø32 mm SDR11', de: 32, di: 26.0 },
        { dn: '40', label: 'Ø40 mm SDR11', de: 40, di: 32.6 },
        { dn: '50', label: 'Ø50 mm SDR11', de: 50, di: 40.8 },
        { dn: '63', label: 'Ø63 mm SDR11', de: 63, di: 51.4 },
        { dn: '90', label: 'Ø90 mm SDR11', de: 90, di: 73.6 },
        { dn: '110', label: 'Ø110 mm SDR11', de: 110, di: 90.0 }
      ]
    },
    PE80: {
      label: 'Polietileno PE80', short: 'PE80',
      norma: 'ASTM D2513',
      sizes: [
        { dn: '1/2 CTS', label: '1/2" CTS', de: 15.9, di: 11.4 },
        { dn: '1/2 IPS', label: '1/2" IPS', de: 21.3, di: 17.4 },
        { dn: '3/4 IPS', label: '3/4" IPS', de: 26.7, di: 21.9 },
        { dn: '1 IPS', label: '1" IPS', de: 33.4, di: 27.4 },
        { dn: '2 IPS', label: '2" IPS', de: 60.3, di: 49.3 }
      ]
    },
    ACERO: {
      label: 'Acero al carbono Sch 40', short: 'Acero Sch 40',
      norma: 'ASTM A53 / A106',
      sizes: [
        { dn: '1/2', label: '1/2" Sch40', de: 21.3, di: 15.8 },
        { dn: '3/4', label: '3/4" Sch40', de: 26.7, di: 20.9 },
        { dn: '1', label: '1" Sch40', de: 33.4, di: 26.6 },
        { dn: '1 1/4', label: '1 1/4" Sch40', de: 42.2, di: 35.1 },
        { dn: '1 1/2', label: '1 1/2" Sch40', de: 48.3, di: 40.9 },
        { dn: '2', label: '2" Sch40', de: 60.3, di: 52.5 },
        { dn: '3', label: '3" Sch40', de: 88.9, di: 77.9 },
        { dn: '4', label: '4" Sch40', de: 114.3, di: 102.3 }
      ]
    },
    GALV: {
      label: 'Acero galvanizado Sch 40', short: 'Galvanizado',
      norma: 'ASTM A53 / NTC 3470',
      sizes: [
        { dn: '1/2', label: '1/2" Sch40', de: 21.3, di: 15.8 },
        { dn: '3/4', label: '3/4" Sch40', de: 26.7, di: 20.9 },
        { dn: '1', label: '1" Sch40', de: 33.4, di: 26.6 },
        { dn: '1 1/4', label: '1 1/4" Sch40', de: 42.2, di: 35.1 },
        { dn: '1 1/2', label: '1 1/2" Sch40', de: 48.3, di: 40.9 },
        { dn: '2', label: '2" Sch40', de: 60.3, di: 52.5 }
      ]
    },
    COBRE: {
      label: 'Cobre tipo L', short: 'Cobre tipo L',
      norma: 'ASTM B88',
      sizes: [
        { dn: '3/8', label: '3/8" tipo L', de: 12.7, di: 10.9 },
        { dn: '1/2', label: '1/2" tipo L', de: 15.9, di: 13.8 },
        { dn: '5/8', label: '5/8" tipo L', de: 19.1, di: 16.9 },
        { dn: '3/4', label: '3/4" tipo L', de: 22.2, di: 19.9 },
        { dn: '1', label: '1" tipo L', de: 28.6, di: 26.0 },
        { dn: '1 1/4', label: '1 1/4" tipo L', de: 34.9, di: 32.1 },
        { dn: '1 1/2', label: '1 1/2" tipo L', de: 41.3, di: 38.2 },
        { dn: '2', label: '2" tipo L', de: 54.0, di: 50.4 }
      ]
    },
    CUSTOM: { label: 'Personalizado (Ø interno manual)', short: 'Manual (Ø interno)', norma: '—', sizes: [] }
  };

  /* Municipios de Colombia: altitud (m s. n. m.). La presión atmosférica se calcula con la atmósfera estándar ISA. */
  const CITIES = [
    ['Bogotá D.C.', 'Cundinamarca', 2640], ['Tunja', 'Boyacá', 2820], ['Duitama', 'Boyacá', 2590],
    ['Sogamoso', 'Boyacá', 2569], ['Garagoa', 'Boyacá', 1650], ['Chiquinquirá', 'Boyacá', 2556],
    ['Paipa', 'Boyacá', 2525], ['Villa de Leyva', 'Boyacá', 2149], ['Guateque', 'Boyacá', 1815],
    ['Zipaquirá', 'Cundinamarca', 2650], ['Chía', 'Cundinamarca', 2564], ['Soacha', 'Cundinamarca', 2566],
    ['Facatativá', 'Cundinamarca', 2586], ['Fusagasugá', 'Cundinamarca', 1728], ['Girardot', 'Cundinamarca', 289],
    ['Medellín', 'Antioquia', 1495], ['Rionegro', 'Antioquia', 2125], ['Manizales', 'Caldas', 2153],
    ['Pereira', 'Risaralda', 1411], ['Armenia', 'Quindío', 1551], ['Cali', 'Valle del Cauca', 1018],
    ['Palmira', 'Valle del Cauca', 1001], ['Tuluá', 'Valle del Cauca', 973], ['Buenaventura', 'Valle del Cauca', 7],
    ['Bucaramanga', 'Santander', 959], ['Barrancabermeja', 'Santander', 75], ['Cúcuta', 'Norte de Santander', 320],
    ['Ibagué', 'Tolima', 1285], ['Neiva', 'Huila', 442], ['Popayán', 'Cauca', 1738], ['Pasto', 'Nariño', 2527],
    ['Villavicencio', 'Meta', 467], ['Yopal', 'Casanare', 350], ['Arauca', 'Arauca', 125],
    ['Florencia', 'Caquetá', 242], ['Mocoa', 'Putumayo', 604], ['Leticia', 'Amazonas', 96],
    ['Quibdó', 'Chocó', 43], ['Barranquilla', 'Atlántico', 18], ['Cartagena', 'Bolívar', 2],
    ['Santa Marta', 'Magdalena', 6], ['Montería', 'Córdoba', 18], ['Sincelejo', 'Sucre', 213],
    ['Valledupar', 'Cesar', 169], ['Riohacha', 'La Guajira', 6], ['San Andrés', 'San Andrés', 1]
  ].map(([name, dept, alt]) => ({ name, dept, alt }));

  const GASES = {
    GN: { label: 'Gas natural (GN)', G: 0.67, pcs: 10.35 },          // PCS ≈ 37.3 MJ/m³
    GLP: { label: 'GLP · propano comercial', G: 1.52, pcs: 26.0 },    // PCS ≈ 93.6 MJ/m³
    GLPM: { label: 'GLP · mezcla 60/40 propano-butano', G: 1.71, pcs: 29.2 },
    BUT: { label: 'GLP · butano', G: 2.0, pcs: 34.0 },               // PCS ≈ 122 MJ/m³
    OTRO: { label: 'Otro gas (densidad manual)', G: 0.67, pcs: 10.35 }
  };

  const DEFAULT_CRITERIA = {
    baja: { pi: 23, pmin: 18, vmax: 20, maxLossPct: 10 },
    media: { pi: 140, pmin: 0, vmax: 20, maxLossPct: 10 }
  };

  /* ============================== UTILIDADES ============================== */
  const num = (v, d = 0) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : d;
    const n = parseFloat(String(v ?? '').trim().replace(',', '.'));
    return Number.isFinite(n) ? n : d;
  };

  /** Presión atmosférica [mbar] a partir de la altitud [m] — atmósfera estándar internacional (ISA). */
  function patmFromAltitude(h) {
    return K.P_NIVEL_MAR * Math.pow(1 - 2.25577e-5 * num(h), 5.25588);
  }

  /** Siguiente nombre de nodo: A→B, Z→AA, AZ→BA. */
  function nextNode(name) {
    const s = String(name || '').trim().toUpperCase();
    if (!/^[A-Z]+$/.test(s)) return 'A';
    const chars = s.split('');
    let i = chars.length - 1;
    while (i >= 0) {
      if (chars[i] !== 'Z') { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); return chars.join(''); }
      chars[i] = 'A'; i--;
    }
    return 'A' + chars.join('');
  }
  const nodeIndex = (s) => String(s).toUpperCase().split('').reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0);

  function getPipe(mat, dn) {
    const m = PIPES[mat];
    return m ? m.sizes.find((s) => s.dn === dn) || null : null;
  }
  function segmentDI(seg) {
    if (seg.mat === 'CUSTOM') return num(seg.di);
    const p = getPipe(seg.mat, seg.dn);
    return p ? p.di : num(seg.di);
  }

  /* ============================== FÓRMULAS ============================== */
  /** Tramo en baja presión (Renouard lineal). */
  function lowTramo({ q, le, d, pi, G, patm }) {
    const dp = K.RENOUARD_LINEAL * G * le * Math.pow(q, K.EXP_Q) * Math.pow(d, -K.EXP_D);
    const pf = pi - dp;
    const pAbsBar = Math.max(pf + patm, 1) / 1000;
    const v = (K.VELOCIDAD * q) / (pAbsBar * d * d);
    return { dp, pf, v, p1Abs: pi + patm, p2Abs: pf + patm };
  }

  /** Tramo en media presión (Renouard cuadrática con presiones absolutas). */
  function mediumTramo({ q, le, d, pi, G, patm }) {
    const p1Abs = pi + patm;
    const term = K.RENOUARD_CUADRATICA * G * le * Math.pow(q, K.EXP_Q) * Math.pow(d, -K.EXP_D);
    const sq = p1Abs * p1Abs - term;
    const p2Abs = sq > 0 ? Math.sqrt(sq) : 0;
    const pf = p2Abs - patm;
    const v = (K.VELOCIDAD * q) / (Math.max(p2Abs, 1) / 1000 * d * d);
    return { dp: pi - pf, pf, v, p1Abs, p2Abs };
  }

  const tramoFn = (mode) => (mode === 'media' ? mediumTramo : lowTramo);

  function evaluate(r, crit, pi) {
    const lossPct = pi > 0 ? (r.dp / pi) * 100 : Infinity;
    const checks = {
      pmin: r.pf >= crit.pmin && r.pf > 0,
      vel: r.v <= crit.vmax,
      loss: lossPct <= crit.maxLossPct
    };
    return { lossPct, checks, ok: checks.pmin && checks.vel && checks.loss };
  }

  /* ============================== TOPOLOGÍA ============================== */
  /**
   * Ordena tramos desde la(s) fuente(s). Cada nodo puede tener UNA sola alimentación (red ramificada).
   * Devuelve { order, errors, parentOf }.
   */
  function topology(segs) {
    const errors = [];
    const byFin = new Map();
    segs.forEach((s, i) => {
      const f = s.fin;
      if (!s.ini || !f) return;
      if (s.ini === f) errors.push(`Tramo ${i + 1}: el nodo inicio y fin son iguales (${f}).`);
      if (byFin.has(f)) errors.push(`El nodo ${f} tiene más de una alimentación (tramos ${byFin.get(f) + 1} y ${i + 1}). Solo se admiten redes ramificadas.`);
      else byFin.set(f, i);
    });
    const children = new Map();
    segs.forEach((s, i) => {
      if (!children.has(s.ini)) children.set(s.ini, []);
      children.get(s.ini).push(i);
    });
    const order = [];
    const state = new Array(segs.length).fill(0);
    const parentOf = new Array(segs.length).fill(-1);
    const visit = (i, parent) => {
      if (state[i] === 2) return;
      if (state[i] === 1) { errors.push('La red contiene un ciclo cerrado (malla).'); return; }
      state[i] = 1; parentOf[i] = parent; order.push(i);
      (children.get(segs[i].fin) || []).forEach((c) => visit(c, i));
      state[i] = 2;
    };
    segs.forEach((s, i) => { if (!byFin.has(s.ini)) visit(i, -1); });
    segs.forEach((s, i) => { if (state[i] === 0) { errors.push(`Tramo ${i + 1} (${s.ini}-${s.fin}) pertenece a un ciclo cerrado.`); } });
    return { order, errors: [...new Set(errors)], parentOf };
  }

  /* ============================== CÁLCULO DE RED ============================== */
  /**
   * @param {Array} segments [{ini, fin, q, l, mat, dn, di}]
   * @param {Object} p { mode, G, patm, pi, factorLE, crit:{pmin,vmax,maxLossPct}, demand (factor 1 = 100 %) }
   */
  function calcNetwork(segments, p) {
    const mode = p.mode === 'media' ? 'media' : 'baja';
    const f = tramoFn(mode);
    const crit = p.crit;
    const demand = num(p.demand, 1);
    const segs = segments.map((s) => ({
      ini: String(s.ini || '').trim().toUpperCase(),
      fin: String(s.fin || '').trim().toUpperCase(),
      q: num(s.q) * demand, qBase: num(s.q), l: num(s.l), mat: s.mat, dn: s.dn, d: segmentDI(s)
    }));
    const topo = topology(segs);
    const rows = new Array(segs.length).fill(null);
    const warnings = [];

    topo.order.forEach((i) => {
      const s = segs[i];
      const parent = topo.parentOf[i];
      const pi = parent < 0 ? num(p.pi) : (rows[parent] && rows[parent].valid ? rows[parent].pf : NaN);
      const le = s.l * num(p.factorLE, 1.2);
      const base = { index: i, ini: s.ini, fin: s.fin, q: s.q, qBase: s.qBase, l: s.l, le, d: s.d, mat: s.mat, dn: s.dn, pi, parent };
      if (!(s.q > 0) || !(s.l > 0) || !(s.d > 0) || !Number.isFinite(pi)) {
        rows[i] = { ...base, valid: false, reason: !(s.q > 0) ? 'Caudal' : !(s.l > 0) ? 'Longitud' : !(s.d > 0) ? 'Diámetro' : 'Presión de entrada' };
        return;
      }
      const r = f({ q: s.q, le, d: s.d, pi, G: p.G, patm: p.patm });
      const ev = evaluate(r, crit, pi);
      rows[i] = { ...base, ...r, valid: true, ...ev, psi: r.pf * K.MBAR_A_PSI, lossAbsPct: r.p1Abs > 0 ? (r.p1Abs - r.p2Abs) / r.p1Abs * 100 : 0 };
    });
    segs.forEach((s, i) => { if (!rows[i]) rows[i] = { index: i, ini: s.ini, fin: s.fin, q: s.q, qBase: s.qBase, l: s.l, le: 0, d: s.d, mat: s.mat, dn: s.dn, pi: NaN, valid: false, reason: 'Topología' }; });

    // Balance de caudales: el caudal que sale de un nodo no puede superar el que entra.
    const outflow = new Map();
    segs.forEach((s) => outflow.set(s.ini, (outflow.get(s.ini) || 0) + s.qBase));
    segs.forEach((s) => {
      const out = outflow.get(s.fin) || 0;
      // Tolerancia de redondeo: 0.02 m³/h o 1 % del caudal del tramo (lo que sea mayor).
      if (out - s.qBase > Math.max(0.02, s.qBase * 0.01)) warnings.push(`Nodo ${s.fin}: sale ${out.toFixed(2)} m³/h pero entran solo ${s.qBase.toFixed(2)} m³/h por el tramo ${s.ini}-${s.fin}.`);
    });

    const valid = rows.filter((r) => r.valid);
    // Longitud acumulada desde la fuente y recorrido hasta el punto de menor presión.
    rows.forEach((r) => { r.dist = r.valid ? (r.parent >= 0 && rows[r.parent].valid ? rows[r.parent].dist : 0) + r.le : 0; });
    let critical = null;
    valid.forEach((r) => { if (!critical || r.pf < critical.pf) critical = r; });
    const path = [];
    for (let r = critical; r; r = r.parent >= 0 ? rows[r.parent] : null) path.unshift(r.index);

    const complete = segs.length > 0 && valid.length === segs.length && topo.errors.length === 0;
    const summary = {
      total: segs.length,
      calculated: valid.length,
      approved: valid.filter((r) => r.ok).length,
      pi: num(p.pi),
      pfMin: critical ? critical.pf : NaN,
      criticalNode: critical ? critical.fin : '—',
      totalLoss: critical ? num(p.pi) - critical.pf : NaN,
      totalLossPct: critical && num(p.pi) > 0 ? (num(p.pi) - critical.pf) / num(p.pi) * 100 : NaN,
      vMax: valid.length ? Math.max(...valid.map((r) => r.v)) : NaN,
      qSource: segs.filter((s, i) => topo.parentOf[i] === -1 && topo.order.includes(i)).reduce((a, s) => a + s.q, 0),
      complete,
      ok: complete && valid.every((r) => r.ok)
    };
    return { mode, rows, path, summary, errors: topo.errors, warnings, order: topo.order };
  }

  /* ============================== DIMENSIONAMIENTO ============================== */
  /**
   * Dimensionamiento automático: método de pérdida unitaria admisible sobre la ruta más larga
   * que pasa por cada tramo, luego ajuste iterativo aumentando diámetros hasta que toda la red aprueba.
   * Devuelve una copia de los tramos con {dn} actualizado (solo materiales con catálogo).
   */
  function autoSize(segments, p) {
    const segs = segments.map((s) => ({ ...s }));
    const sizable = (s) => PIPES[s.mat] && PIPES[s.mat].sizes.length > 0;
    const res0 = calcNetwork(segs, { ...p });
    if (res0.errors.length) return { segments: segs, ok: false, changed: 0 };
    const fle = num(p.factorLE, 1.2);
    // Longitud equivalente máxima de la fuente a cualquier punto final que pasa por cada tramo.
    const topo = topology(segs.map((s) => ({ ini: String(s.ini).toUpperCase(), fin: String(s.fin).toUpperCase() })));
    const childrenOf = segs.map(() => []);
    topo.parentOf.forEach((par, i) => { if (par >= 0) childrenOf[par].push(i); });
    const down = new Array(segs.length).fill(0);
    [...topo.order].reverse().forEach((i) => { down[i] = num(segs[i].l) * fle + Math.max(0, ...childrenOf[i].map((c) => down[c])); });
    const up = new Array(segs.length).fill(0);
    topo.order.forEach((i) => { const par = topo.parentOf[i]; up[i] = par >= 0 ? up[par] + num(segs[par].l) * fle : 0; });
    const budget = Math.max(num(p.pi) - Math.max(p.crit.pmin, 0), num(p.pi) * 0.02);
    const before = segs.map((s) => s.dn);
    const f = tramoFn(p.mode);
    topo.order.forEach((i) => {
      const s = segs[i];
      if (!sizable(s)) return;
      const path = up[i] + down[i];
      const allowed = path > 0 ? budget * (num(s.l) * fle) / path : budget;
      const sizes = PIPES[s.mat].sizes;
      const choice = sizes.find((sz) => {
        const r = f({ q: num(s.q) * num(p.demand, 1), le: num(s.l) * fle, d: sz.di, pi: num(p.pi), G: p.G, patm: p.patm });
        return r.dp <= allowed && r.v <= p.crit.vmax;
      }) || sizes[sizes.length - 1];
      s.dn = choice.dn;
    });
    // Ajuste fino: mientras haya rechazos, aumentar el tramo con mayor pérdida en la ruta del rechazo.
    for (let guard = 0; guard < 200; guard++) {
      const res = calcNetwork(segs, p);
      if (res.summary.ok) break;
      const bad = res.rows.find((r) => r.valid && !r.ok);
      if (!bad) break;
      const chain = [];
      for (let r = bad; r; r = r.parent >= 0 ? res.rows[r.parent] : null) chain.push(r);
      const candidates = chain.filter((r) => sizable(segs[r.index]) && PIPES[segs[r.index].mat].sizes.findIndex((z) => z.dn === segs[r.index].dn) < PIPES[segs[r.index].mat].sizes.length - 1);
      if (!candidates.length) break;
      let pick = bad.checks && !bad.checks.vel && candidates.includes(bad) ? bad : candidates.reduce((a, b) => (b.dp > a.dp ? b : a));
      const sizes = PIPES[segs[pick.index].mat].sizes;
      const k = sizes.findIndex((z) => z.dn === segs[pick.index].dn);
      segs[pick.index].dn = sizes[Math.min(k + 1, sizes.length - 1)].dn;
    }
    const final = calcNetwork(segs, p);
    return { segments: segs, ok: final.summary.ok, changed: segs.filter((s, i) => s.dn !== before[i]).length };
  }

  /** Caudal [m³/h] a partir de potencia térmica. */
  function flowFromPower(value, unit, pcs) {
    const kw = unit === 'kW' ? value : unit === 'BTU/h' ? value * 0.00029307107 : unit === 'kcal/h' ? value * 0.001163 : unit === 'MJ/h' ? value / 3.6 : value;
    return kw / pcs;
  }

  const api = {
    K, PIPES, CITIES, GASES, DEFAULT_CRITERIA,
    num, patmFromAltitude, nextNode, nodeIndex, getPipe, segmentDI,
    lowTramo, mediumTramo, topology, calcNetwork, autoSize, flowFromPower
  };
  root.GasEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
