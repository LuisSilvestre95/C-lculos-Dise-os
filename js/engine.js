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
    // Müller (media presión), tal como en las hojas de cálculo de TODO GAS SYR, con P en mbar absolutos y Le en m:
    // P1² − P2² = ( Q · S^0.425 · Le^0.576 / (4.61·10⁻⁵ · D^2.725) )^1.74
    MULLER_C: 4.61e-5, MULLER_S: 0.425, MULLER_L: 0.576, MULLER_D: 2.725, MULLER_EXP: 1.74,
    EXP_Q: 1.82,
    EXP_D: 4.82,
    MBAR_A_PSI: 0.0145037738,
    P_NIVEL_MAR: 1013.25
  };

  /* Catálogo de tuberías — diámetros según norma de fabricación. */
  let PIPES = {
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
    ['Valledupar', 'Cesar', 169], ['Riohacha', 'La Guajira', 6], ['San Andrés', 'San Andrés', 1],
    // Valle de Tenza, Neira, Lengupá y oriente de Boyacá (altitud aproximada de la cabecera municipal).
    // Se agregan al final para no cambiar los municipios guardados en proyectos anteriores.
    ['Sutatenza', 'Boyacá', 1885, 'VT'], ['Tenza', 'Boyacá', 1600, 'VT'], ['La Capilla', 'Boyacá', 1750, 'VT'],
    ['Chinavita', 'Boyacá', 1880, 'VT'], ['Pachavita', 'Boyacá', 1985, 'VT'], ['Guayatá', 'Boyacá', 1862, 'VT'],
    ['Somondoco', 'Boyacá', 1670, 'VT'], ['Almeida', 'Boyacá', 1925, 'VT'], ['Chivor', 'Boyacá', 1800, 'VT'],
    ['Macanal', 'Boyacá', 1280, 'VT'], ['Santa María', 'Boyacá', 980, 'VT'], ['San Luis de Gaceno', 'Boyacá', 470, 'VT'],
    ['Campohermoso', 'Boyacá', 1150, 'VT'], ['Berbeo', 'Boyacá', 1650, 'VT'], ['Páez', 'Boyacá', 1600, 'VT'],
    ['Miraflores', 'Boyacá', 1432, 'VT'], ['Zetaquira', 'Boyacá', 1650, 'VT'], ['Rondón', 'Boyacá', 2100, 'VT'],
    ['Ramiriquí', 'Boyacá', 2325, 'VT'], ['Úmbita', 'Boyacá', 2482, 'VT'], ['Tibaná', 'Boyacá', 2115, 'VT'],
    ['Jenesano', 'Boyacá', 2076, 'VT'], ['Nuevo Colón', 'Boyacá', 2430, 'VT'], ['Turmequé', 'Boyacá', 2389, 'VT'],
    ['Ventaquemada', 'Boyacá', 2630, 'VT'], ['Ciénega', 'Boyacá', 2460, 'VT'], ['Viracachá', 'Boyacá', 2650, 'VT'],
    ['Boyacá', 'Boyacá', 2420, 'VT'], ['Machetá', 'Cundinamarca', 2097, 'VT'], ['Manta', 'Cundinamarca', 1960, 'VT'],
    ['Tibirita', 'Cundinamarca', 1980, 'VT']
  ].map(([name, dept, alt, region]) => ({ name, dept, alt, region: region || (['Garagoa', 'Guateque'].includes(name) ? 'VT' : '') }));

  let GASES = {
    GN: { label: 'Gas natural', G: 0.67, pcs: 10.35 },          // PCS ≈ 37.3 MJ/m³
    GLP: { label: 'GLP propano', G: 1.52, pcs: 26.0 },    // PCS ≈ 93.6 MJ/m³
    GLPM: { label: 'GLP mezcla 60/40', G: 1.71, pcs: 29.2 },
    BUT: { label: 'GLP butano', G: 2.0, pcs: 34.0 },               // PCS ≈ 122 MJ/m³
    OTRO: { label: 'Otro gas', G: 0.67, pcs: 10.35 }
  };

  const DEFAULT_CRITERIA = {
    baja: { pi: 23, pmin: 18, vmax: 20, maxLossPct: 10, pimax: 25, kv: 354, method: 'renouard' },
    media: { pi: 140, pmin: 0, vmax: 20, maxLossPct: 10, kv: 354, method: 'muller' }
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
  function lowTramo({ q, le, d, pi, G, patm, kv = K.VELOCIDAD }) {
    const dp = K.RENOUARD_LINEAL * G * le * Math.pow(q, K.EXP_Q) * Math.pow(d, -K.EXP_D);
    const pf = pi - dp;
    const pAbsBar = Math.max(pf + patm, 1) / 1000;
    const v = (kv * q) / (pAbsBar * d * d);
    return { dp, pf, v, p1Abs: pi + patm, p2Abs: pf + patm };
  }

  /** Tramo en media presión (Renouard cuadrática con presiones absolutas). */
  function mediumTramo({ q, le, d, pi, G, patm, kv = K.VELOCIDAD }) {
    const p1Abs = pi + patm;
    const term = K.RENOUARD_CUADRATICA * G * le * Math.pow(q, K.EXP_Q) * Math.pow(d, -K.EXP_D);
    const sq = p1Abs * p1Abs - term;
    const p2Abs = sq > 0 ? Math.sqrt(sq) : 0;
    const pf = p2Abs - patm;
    const v = (kv * q) / (Math.max(p2Abs, 1) / 1000 * d * d);
    return { dp: pi - pf, pf, v, p1Abs, p2Abs };
  }

  /** Tramo en media presión con la fórmula de Müller (presiones absolutas en mbar, Le en m, D en mm). */
  function mullerTramo({ q, le, d, pi, G, patm, kv = K.VELOCIDAD }) {
    const p1Abs = pi + patm;
    const term = Math.pow(q * Math.pow(G, K.MULLER_S) * Math.pow(le, K.MULLER_L) / (K.MULLER_C * Math.pow(d, K.MULLER_D)), K.MULLER_EXP);
    const sq = p1Abs * p1Abs - term;
    const p2Abs = sq > 0 ? Math.sqrt(sq) : 0;
    const pf = p2Abs - patm;
    const v = (kv * q) / (Math.max(p2Abs, 1) / 1000 * d * d);
    return { dp: pi - pf, pf, v, p1Abs, p2Abs };
  }

  const tramoFn = (mode, method) => (mode === 'media' ? (method === 'renouard' ? mediumTramo : mullerTramo) : lowTramo);

  function evaluate(r, crit, pi) {
    // Si la presión de entrada ya se agotó (≤ 0), el tramo pierde el 100 %: rechazado con un valor claro.
    const lossPct = pi > 0 ? (r.dp / pi) * 100 : 100;
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

  /* ============================== TRAMOS DE ACCESORIO ============================== */
  /** Longitud máxima de un tramo "entre accesorios" (por ejemplo, de tee a tee). */
  const LONG_ACCESORIO = 0.10;
  /** Tolerancia de redondeo para comparar caudales: 0.02 m³/h o 1 % (lo que sea mayor). */
  const tolQ = (q) => Math.max(0.02, Math.abs(q) * 0.01);
  /**
   * Nodo desde el que realmente toma el gas cada tramo.
   * Un tramo corto (≤ 0.10 m, entre accesorios) es la continuación de la línea principal. Solo se mueve si
   * en su nodo de inicio NO cabe (por ese nodo saldría más caudal del que le entra): entonces sale de la tee
   * aguas arriba donde queda justo su caudal sin repartir, o si no hay coincidencia, de la primera donde cabe.
   * Se mira toda la tabla (no depende del orden de las filas). Los tramos largos nunca se mueven.
   */
  function effectiveStarts(segs) {
    const byFin = new Map(); segs.forEach((s, i) => { if (s.fin && !byFin.has(s.fin)) byFin.set(s.fin, i); });
    const starts = segs.map((s) => s.ini);
    const out = new Map();
    segs.forEach((s) => { if (s.q > 0) out.set(s.ini, (out.get(s.ini) || 0) + s.q); });
    const inflow = (n) => segs[byFin.get(n)].q;
    const left = (n) => inflow(n) - (out.get(n) || 0);
    const up = (n) => starts[byFin.get(n)];
    segs.forEach((s, i) => {
      const n = starts[i];
      if (s.l > LONG_ACCESORIO || !(s.q > 0) || !byFin.has(n)) return; // ≤ 0.10 m o longitud aún sin escribir
      if (!(-left(n) > tolQ(inflow(n)))) return; // en su nodo sí cabe: no se mueve
      let exact = null, fit = null;
      const seen = new Set([n]);
      for (let m = up(n); m && !seen.has(m) && byFin.has(m); m = up(m)) {
        seen.add(m);
        const l = left(m);
        if (Math.abs(l - s.q) <= tolQ(s.q)) { exact = m; break; }
        if (fit == null && l + tolQ(s.q) >= s.q) fit = m;
      }
      const to = exact || fit;
      if (!to) return;
      starts[i] = to;
      out.set(n, out.get(n) - s.q); out.set(to, (out.get(to) || 0) + s.q);
    });
    return starts;
  }

  /**
   * Balance de caudales, como se revisa a mano:
   *   Entra (tramo que sale de la fuente) − Σ consumos (tramos que llegan a un punto final) = Resta → debe dar 0.
   * Además, en cada nodo intermedio (tee): lo que entra − lo que sale debe dar 0.
   * Si en un nodo queda caudal sin repartir y un tramo que sale de un nodo vecino lleva justo ese caudal,
   * se sugiere cambiar su nodo de inicio.
   */
  function flowBalance(segs) {
    const nodes = new Map();
    const N = (n) => { if (!nodes.has(n)) nodes.set(n, { node: n, entra: 0, sale: 0, fed: false, out: [] }); return nodes.get(n); };
    segs.forEach((s, i) => {
      if (!s.ini || !s.fin) return;
      N(s.fin).fed = true; N(s.ini);
      if (!(s.qBase > 0)) return;
      N(s.fin).entra += s.qBase; N(s.ini).sale += s.qBase; N(s.ini).out.push(i);
    });
    const list = [...nodes.values()];
    const qIn = list.filter((n) => !n.fed).reduce((a, n) => a + n.sale, 0);
    const consumos = list.filter((n) => n.fed && n.entra > 0 && n.sale === 0).map((n) => ({ node: n.node, q: n.entra }));
    const qCons = consumos.reduce((a, c) => a + c.q, 0);
    // Nodos intermedios que no cuadran: queda > 0 (sobra caudal) o queda < 0 (falta caudal).
    const nodos = list.filter((n) => n.fed && n.sale > 0).map((n) => ({ node: n.node, entra: n.entra, sale: n.sale, queda: n.entra - n.sale }));
    const issues = nodos.filter((n) => Math.abs(n.queda) > tolQ(n.entra));
    const byFin = new Map(); segs.forEach((s, i) => { if (s.fin && !byFin.has(s.fin)) byFin.set(s.fin, i); });
    const suggest = [];
    issues.filter((n) => n.queda > 0).forEach((n) => {
      // Tramo que sale de un nodo alimentado desde este nodo y que lleva justo lo que sobra aquí.
      (nodes.get(n.node).out || []).forEach((k) => {
        const hijo = nodes.get(segs[k].fin); if (!hijo) return;
        hijo.out.forEach((j) => {
          if (suggest.some((x) => x.index === j)) return;
          if (Math.abs(segs[j].qBase - n.queda) <= tolQ(n.queda)) suggest.push({ index: j, ini: segs[j].iniOrig || segs[j].ini, fin: segs[j].fin, to: n.node, q: segs[j].qBase });
        });
      });
    });
    const diff = qIn - qCons;
    const ok = qIn > 0 && Math.abs(diff) <= Math.max(0.02, qIn * 0.005) && !issues.length;
    return { qIn, qCons, diff, consumos, nodos, issues, suggest, ok };
  }

  /* ============================== CÁLCULO DE RED ============================== */
  /**
   * @param {Array} segments [{ini, fin, q, l, mat, dn, di}]
   * @param {Object} p { mode, G, patm, pi, factorLE, crit:{pmin,vmax,maxLossPct}, demand (factor 1 = 100 %) }
   */
  /**
   * Parámetros depurados: cualquier valor vacío, de texto, negativo o fuera de rango se reemplaza por uno
   * seguro, así un proyecto guardado o manipulado nunca produce resultados sin sentido.
   */
  function cleanParams(p = {}) {
    const pos = (v, d, max = Infinity) => { const n = num(v, NaN); return n > 0 && n <= max ? n : d; };
    const c = p.crit || {};
    return {
      ...p,
      mode: p.mode === 'media' ? 'media' : 'baja',
      G: pos(p.G, 0.67, 5), patm: pos(p.patm, K.P_NIVEL_MAR, 1100), factorLE: pos(p.factorLE, 1.2, 10),
      kv: pos(p.kv, K.VELOCIDAD, 1000), demand: pos(p.demand, 1, 10), pi: num(p.pi),
      crit: { pmin: Math.max(0, num(c.pmin)), vmax: pos(c.vmax, 20), maxLossPct: pos(c.maxLossPct, 10, 100) }
    };
  }
  /** Diámetro interno admisible (mm): fuera de este rango el dato es un error de escritura. */
  const D_MIN = 3, D_MAX = 2000;

  function calcNetwork(segments, p0) {
    const p = cleanParams(p0);
    const mode = p.mode;
    const f = tramoFn(mode, p.method);
    const crit = p.crit;
    const demand = num(p.demand, 1);
    const segs = segments.map((s) => ({
      ini: String(s.ini || '').trim().toUpperCase(),
      fin: String(s.fin || '').trim().toUpperCase(),
      q: num(s.q) * demand, qBase: num(s.q), l: num(s.l), mat: s.mat, dn: s.dn, d: segmentDI(s)
    }));
    // Nodo desde el que cada tramo toma el gas (los tramos de accesorio pueden salir de la tee anterior).
    const starts = effectiveStarts(segs);
    segs.forEach((s, i) => { s.iniOrig = s.ini; s.ini = starts[i]; });
    const topo = topology(segs);
    const rows = new Array(segs.length).fill(null);
    const warnings = [];

    topo.order.forEach((i) => {
      const s = segs[i];
      const parent = topo.parentOf[i];
      const pi = parent < 0 ? num(p.pi) : (rows[parent] && rows[parent].valid ? rows[parent].pf : NaN);
      const le = s.l * p.factorLE;
      const base = { index: i, ini: s.iniOrig, fin: s.fin, from: s.ini, viaTee: s.ini !== s.iniOrig, acc: s.l > 0 && s.l <= LONG_ACCESORIO, q: s.q, qBase: s.qBase, l: s.l, le, d: s.d, mat: s.mat, dn: s.dn, pi, parent };
      const dOk = s.d >= D_MIN && s.d <= D_MAX;
      const piOk = Number.isFinite(pi) && (parent >= 0 || pi > 0);
      if (!s.iniOrig || !s.fin || !(s.q > 0) || !(s.l > 0) || !dOk || !piOk) {
        rows[i] = { ...base, valid: false, reason: !s.iniOrig || !s.fin ? 'Nodo' : !(s.q > 0) ? 'Caudal' : !(s.l > 0) ? 'Longitud' : !dOk ? 'Diámetro' : 'Presión de entrada' };
        return;
      }
      const r = f({ q: s.q, le, d: s.d, pi, G: p.G, patm: p.patm, kv: p.kv });
      if (![r.dp, r.pf, r.v, r.p1Abs, r.p2Abs].every(Number.isFinite)) { rows[i] = { ...base, valid: false, reason: 'Dato fuera de rango' }; return; }
      const ev = evaluate(r, crit, pi);
      rows[i] = { ...base, ...r, valid: true, ...ev, psi: r.pf * K.MBAR_A_PSI, lossAbsPct: r.p1Abs > 0 ? (r.p1Abs - r.p2Abs) / r.p1Abs * 100 : 0 };
    });
    segs.forEach((s, i) => { if (!rows[i]) rows[i] = { index: i, ini: s.iniOrig, fin: s.fin, from: s.ini, q: s.q, qBase: s.qBase, l: s.l, le: 0, d: s.d, mat: s.mat, dn: s.dn, pi: NaN, valid: false, reason: 'Topología' }; });

    // Más de un punto de inicio: cada uno se calcula con la presión de suministro completa. Casi siempre
    // significa que falta (o se borró) el tramo que conecta ese nodo con el resto de la red.
    const fins = new Set(segs.filter((s) => s.fin).map((s) => s.fin));
    const fuentes = [...new Set(segs.filter((s) => s.ini && s.fin && !fins.has(s.ini)).map((s) => s.ini))];
    if (fuentes.length > 1) warnings.push(`La red tiene ${fuentes.length} puntos de inicio (${fuentes.join(', ')}): cada uno se calcula con la presión de suministro. Si no salen todos del regulador, falta el tramo que llega a ${fuentes.slice(1).join(', ')}.`);

    // Balance de caudales (entra − consumos = 0, y en cada tee lo que entra = lo que sale).
    const balance = flowBalance(segs);
    // Salir más caudal del que entra es un error; lo que aún queda por repartir se muestra en el cuadro de resta.
    balance.issues.filter((n) => n.queda < 0).forEach((n) => warnings.push(`Nodo ${n.node}: salen ${n.sale.toFixed(2)} m³/h pero entran solo ${n.entra.toFixed(2)} m³/h (faltan ${(-n.queda).toFixed(2)}).`));

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
      balance,
      ok: complete && valid.every((r) => r.ok)
    };
    return { mode, rows, path, summary, errors: topo.errors, warnings, order: topo.order };
  }

  /**
   * Caudales de la línea principal calculados desde los consumos: cada tramo que alimenta otros lleva la
   * suma de lo que sale de su nodo final; los tramos que llegan a un punto de consumo conservan su caudal.
   * Devuelve el caudal de cada tramo (redondeado a 0.01 m³/h) y la lista de cambios.
   */
  function flowsFromConsumption(segments) {
    const segs = segments.map((s) => ({ ini: String(s.ini || '').trim().toUpperCase(), fin: String(s.fin || '').trim().toUpperCase(), q: num(s.q), l: num(s.l) }));
    const eff = effectiveStarts(segs);
    const topo = topology(segs.map((s, i) => ({ ini: eff[i], fin: s.fin })));
    const kids = segs.map(() => []);
    topo.parentOf.forEach((par, i) => { if (par >= 0) kids[par].push(i); });
    const q = segs.map((s) => s.q);
    [...topo.order].reverse().forEach((i) => { if (kids[i].length) q[i] = kids[i].reduce((a, c) => a + q[c], 0); });
    const out = q.map((v) => Math.round(v * 100) / 100);
    const changes = out.map((v, i) => ({ index: i, ini: segs[i].ini, fin: segs[i].fin, from: segs[i].q, to: v })).filter((c) => kids[c.index].length && Math.abs(c.to - c.from) >= 0.005);
    return { q: out, changes, ok: !topo.errors.length };
  }

  /* ============================== DIMENSIONAMIENTO ============================== */
  /**
   * Dimensionamiento automático: método de pérdida unitaria admisible sobre la ruta más larga
   * que pasa por cada tramo, luego ajuste iterativo aumentando diámetros hasta que toda la red aprueba.
   * Devuelve una copia de los tramos con {dn} actualizado (solo materiales con catálogo).
   */
  function autoSize(segments, p0) {
    const p = cleanParams(p0);
    const segs = segments.map((s) => ({ ...s }));
    const sizable = (s) => PIPES[s.mat] && PIPES[s.mat].sizes.length > 0;
    const res0 = calcNetwork(segs, { ...p });
    if (res0.errors.length) return { segments: segs, ok: false, changed: 0 };
    const fle = p.factorLE;
    // Longitud equivalente máxima de la fuente a cualquier punto final que pasa por cada tramo.
    const norm = segs.map((s) => ({ ini: String(s.ini).toUpperCase(), fin: String(s.fin).toUpperCase(), q: num(s.q), l: num(s.l) }));
    const eff = effectiveStarts(norm);
    const topo = topology(norm.map((s, i) => ({ ini: eff[i], fin: s.fin })));
    const childrenOf = segs.map(() => []);
    topo.parentOf.forEach((par, i) => { if (par >= 0) childrenOf[par].push(i); });
    const down = new Array(segs.length).fill(0);
    [...topo.order].reverse().forEach((i) => { down[i] = num(segs[i].l) * fle + Math.max(0, ...childrenOf[i].map((c) => down[c])); });
    const up = new Array(segs.length).fill(0);
    topo.order.forEach((i) => { const par = topo.parentOf[i]; up[i] = par >= 0 ? up[par] + num(segs[par].l) * fle : 0; });
    const budget = Math.max(num(p.pi) - Math.max(p.crit.pmin, 0), num(p.pi) * 0.02);
    const before = segs.map((s) => s.dn);
    const f = tramoFn(p.mode, p.method);
    topo.order.forEach((i) => {
      const s = segs[i];
      if (!sizable(s)) return;
      const path = up[i] + down[i];
      const allowed = path > 0 ? budget * (num(s.l) * fle) / path : budget;
      const sizes = PIPES[s.mat].sizes;
      const choice = sizes.find((sz) => {
        const r = f({ q: num(s.q) * p.demand, le: num(s.l) * fle, d: sz.di, pi: p.pi, G: p.G, patm: p.patm, kv: p.kv });
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

  // Catálogos sin prototipo: una clave como "__proto__" o "constructor" en un archivo externo nunca coincide.
  const sinProto = (o) => Object.freeze(Object.assign(Object.create(null), o));
  PIPES = sinProto(PIPES); GASES = sinProto(GASES);

  const api = {
    K, PIPES, CITIES, GASES, DEFAULT_CRITERIA,
    num, patmFromAltitude, nextNode, nodeIndex, getPipe, segmentDI,
    LONG_ACCESORIO, tolQ, cleanParams, flowsFromConsumption, flowBalance, lowTramo, mediumTramo, mullerTramo, topology, effectiveStarts, calcNetwork, autoSize, flowFromPower
  };
  root.GasEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
