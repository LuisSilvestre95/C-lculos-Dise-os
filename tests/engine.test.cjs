/* Pruebas del motor de cálculo: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');

const close = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg || ''} ${a} ≉ ${b}`);
const crit = { pmin: 18, vmax: 20, maxLossPct: 10 };
const base = { G: 0.67, patm: 823, factorLE: 1.2, crit };

test('Renouard lineal: valor calculado a mano', () => {
  // ΔP = 23200·0.67·12·10^1.82·20^-4.82
  const expected = 23200 * 0.67 * 12 * Math.pow(10, 1.82) / Math.pow(20, 4.82);
  const r = E.lowTramo({ q: 10, le: 12, d: 20, pi: 23, G: 0.67, patm: 823 });
  close(r.dp, expected);
  close(r.dp, 6.5997, 1e-3, 'orden de magnitud');
  close(r.pf, 23 - expected);
  // V = 354·Q/(Pabs[bar]·D²)
  close(r.v, 354 * 10 / (((23 - expected) + 823) / 1000 * 400));
});

test('Renouard cuadrática coincide con la lineal a baja presión (consistencia física)', () => {
  // Con P ≈ 1013 mbar abs, P1²−P2² ≈ 2·P·ΔP → ΔP_cuad ≈ 4.86e7/(2·1013)·(...) ≈ 23 988·(...) ≈ 23 200·(...)
  const lin = E.lowTramo({ q: 3, le: 20, d: 16, pi: 23, G: 0.67, patm: 1013.25 });
  const cua = E.mediumTramo({ q: 3, le: 20, d: 16, pi: 23, G: 0.67, patm: 1013.25 });
  assert.ok(Math.abs(cua.dp - lin.dp) / lin.dp < 0.06, `lin ${lin.dp} vs cuad ${cua.dp}`);
});

test('Renouard cuadrática: valor calculado a mano (mbar², m)', () => {
  const p1 = 140 + 823;
  const term = 4.86e7 * 0.67 * 12 * Math.pow(10, 1.82) / Math.pow(20, 4.82);
  const p2 = Math.sqrt(p1 * p1 - term);
  const r = E.mediumTramo({ q: 10, le: 12, d: 20, pi: 140, G: 0.67, patm: 823 });
  close(r.p2Abs, p2);
  close(r.pf, p2 - 823);
  assert.ok(r.dp > 5 && r.dp < 10, 'caída realista de algunos mbar: ' + r.dp);
});

test('Presión atmosférica ISA', () => {
  close(E.patmFromAltitude(0), 1013.25);
  close(E.patmFromAltitude(2640), 734.3, 2e-3);
  close(E.patmFromAltitude(1650), 830.6, 2e-3);
});

test('Nombres de nodos', () => {
  assert.equal(E.nextNode('A'), 'B');
  assert.equal(E.nextNode('Z'), 'AA');
  assert.equal(E.nextNode('AZ'), 'BA');
  assert.equal(E.nextNode(''), 'A');
});

test('Red en serie: la presión se transmite tramo a tramo', () => {
  const segs = [
    { ini: 'A', fin: 'B', q: 2.5, l: 8, mat: 'PEALPE', dn: '2025' },
    { ini: 'B', fin: 'C', q: 1.5, l: 6, mat: 'PEALPE', dn: '1620' },
    { ini: 'C', fin: 'D', q: 0.8, l: 4, mat: 'PEALPE', dn: '1216' }
  ];
  const res = E.calcNetwork(segs, { ...base, mode: 'baja', pi: 23 });
  assert.equal(res.errors.length, 0);
  close(res.rows[1].pi, res.rows[0].pf);
  close(res.rows[2].pi, res.rows[1].pf);
  assert.equal(res.summary.criticalNode, 'D');
  assert.equal(res.summary.ok, true);
  assert.deepEqual(res.path, [0, 1, 2]);
});

test('Red ramificada: cada ramal parte de la presión del nodo común', () => {
  const segs = [
    { ini: 'A', fin: 'B', q: 3, l: 10, mat: 'PEALPE', dn: '2632' },
    { ini: 'B', fin: 'C', q: 1, l: 5, mat: 'PEALPE', dn: '1620' },
    { ini: 'B', fin: 'D', q: 2, l: 9, mat: 'PEALPE', dn: '1620' }
  ];
  const res = E.calcNetwork(segs, { ...base, mode: 'baja', pi: 23 });
  close(res.rows[1].pi, res.rows[0].pf);
  close(res.rows[2].pi, res.rows[0].pf);
  assert.equal(res.warnings.length, 0);
  assert.equal(res.summary.criticalNode, 'D');
});

test('Balance de caudales y ciclos', () => {
  const bad = E.calcNetwork([
    { ini: 'A', fin: 'B', q: 1, l: 5, mat: 'PEALPE', dn: '1620' },
    { ini: 'B', fin: 'C', q: 3, l: 5, mat: 'PEALPE', dn: '1620' }
  ], { ...base, mode: 'baja', pi: 23 });
  assert.equal(bad.warnings.length, 1);
  const cyc = E.calcNetwork([
    { ini: 'A', fin: 'B', q: 1, l: 5, mat: 'PEALPE', dn: '1620' },
    { ini: 'B', fin: 'A', q: 1, l: 5, mat: 'PEALPE', dn: '1620' }
  ], { ...base, mode: 'baja', pi: 23 });
  assert.ok(cyc.errors.length > 0);
});

test('Dimensionamiento automático deja toda la red aprobada', () => {
  const segs = [
    { ini: 'A', fin: 'B', q: 6, l: 12, mat: 'PEALPE', dn: '1216' },
    { ini: 'B', fin: 'C', q: 3, l: 10, mat: 'PEALPE', dn: '1216' },
    { ini: 'B', fin: 'D', q: 3, l: 18, mat: 'PEALPE', dn: '1216' },
    { ini: 'D', fin: 'E', q: 1.2, l: 7, mat: 'PEALPE', dn: '1216' }
  ];
  const p = { ...base, mode: 'baja', pi: 23 };
  const out = E.autoSize(segs, p);
  assert.equal(out.ok, true);
  assert.ok(E.calcNetwork(out.segments, p).summary.ok);
});

test('Catálogo: todos los diámetros internos son menores que los externos', () => {
  Object.values(E.PIPES).forEach((m) => m.sizes.forEach((z) => assert.ok(z.di > 0 && z.di < z.de, m.label + ' ' + z.label)));
});

test('Proyecto real (José Ricardo Mendoza, Garagoa): coincide con la memoria entregada', () => {
  const S = (ini, fin, q, l) => ({ ini, fin, q, l, mat: 'PEALPE', dn: '1620' });
  const p = { G: 0.67, patm: 830.1, factorLE: 1.2, crit, mode: 'baja', pi: 23 };
  const res = E.calcNetwork([S('B', 'C', 9.97, 0.05), S('C', 'D', 3.8, 1.65), S('C', 'E', 6.17, 0.05), S('E', 'F', 2.19, 2.9),
    S('E', 'G', 3.97, 0.05), S('G', 'H', 2.02, 3.45), S('G', 'I', 1.96, 4.55)], p);
  const pf = Object.fromEntries(res.rows.map((r) => [r.fin, +r.pf.toFixed(3)]));
  assert.deepEqual(pf, { C: 22.904, D: 22.355, E: 22.864, F: 22.51, G: 22.846, H: 22.482, I: 22.392 });
  close(res.rows[0].v, 16.16, 1e-3);
  assert.equal(res.summary.ok, true);
  assert.equal(res.warnings.length, 0, 'un redondeo de 0.01 m³/h no es un error de balance');
  const m = E.calcNetwork([S('A', 'B', 9.97, 10.4)], { ...p, mode: 'media', method: 'renouard', pi: 350, crit: { pmin: 0, vmax: 20, maxLossPct: 10 } }).rows[0];
  assert.equal(m.pf.toFixed(2), '332.09'); assert.equal(m.v.toFixed(2), '11.86'); assert.equal(m.lossPct.toFixed(2), '5.12');
});

test('Datos vacíos, cero, negativos o texto no rompen el cálculo', () => {
  const p = { G: 0.67, patm: 830, factorLE: 1.2, crit, mode: 'baja', pi: 23 };
  for (const q of ['', '0', '-3', 'abc', null, undefined, '1e400']) {
    const r = E.calcNetwork([{ ini: 'A', fin: 'B', q, l: '5', mat: 'PEALPE', dn: '1620' }], p);
    assert.equal(r.summary.ok, false); assert.ok(Array.isArray(r.rows));
  }
  assert.equal(E.calcNetwork([], p).summary.total, 0);
  assert.ok(Number.isFinite(E.calcNetwork([{ ini: 'A', fin: 'B', q: '2,5', l: '3', mat: 'PEALPE', dn: '1620' }], p).rows[0].pf), 'acepta coma decimal');
});

test('Excel Diseño_Baja_2 (hoja Baja Presión): mismos valores con Patm 723.6 y constante 345', () => {
  // Fila 8: Q 1.52, L 40, D 16, Pi 23 → I8 2.51131, J8 20.48869, K8 2.75295
  const r = E.calcNetwork([{ ini: 'A', fin: 'B', q: 1.52, l: 40, mat: 'CUSTOM', di: 16 }],
    { mode: 'baja', G: 0.67, patm: 723.6, factorLE: 1.2, pi: 23, kv: 345, crit }).rows[0];
  close(r.dp, 2.5113141207263467, 1e-12); close(r.pf, 20.488685879273653, 1e-12); close(r.v, 2.752948054275822, 1e-12);
});

test('Excel Diseño_Media_Presion (Müller): mismos valores, encadenando tramos', () => {
  const p = { mode: 'media', method: 'muller', G: 0.67, patm: 723.6, factorLE: 1.2, pi: 140, kv: 354, crit: { pmin: 0, vmax: 20, maxLossPct: 10 } };
  const C = (ini, fin, q, l, di) => ({ ini, fin, q, l, mat: 'CUSTOM', di });
  const res = E.calcNetwork([C('A', 'B', 3.63, 2.55, 16), C('B', 'C', 3.42, 11.28, 20), C('C', 'D', 1.35, 0.9, 16), C('D', 'E', 1.35, 0.05, 12)], p);
  const [ab, bc, cd, de] = res.rows;
  close(ab.p2Abs, 862.7466508266393, 1e-12); close(ab.pf, 139.1466508266393, 1e-12); close(ab.v, 5.818173122075257, 1e-12);
  close(ab.lossPct / 100, 0.006095351238290699, 1e-9);
  close(bc.pf, 137.9599949658067, 1e-12); close(bc.v, 3.5130461229459975, 1e-12);
  close(cd.pf, 137.906145023499, 1e-12); close(de.pf, 137.8945167710856, 1e-12); close(de.v, 3.8523170320790925, 1e-12);
  // Segundo libro: A-B 1.52 m³/h, 50 m, D 12, 150 mbar → P2 135.5653, V 4.34918, pérdida 9.623 %
  const x = E.calcNetwork([C('A', 'B', 1.52, 50, 12)], { ...p, pi: 150 }).rows[0];
  close(x.pf, 135.56531756398692, 1e-12); close(x.v, 4.3491823869954755, 1e-12); close(x.lossPct / 100, 0.09623121624008718, 1e-9);
});

test('Müller y Renouard cuadrática coinciden dentro de un 20 % (validación cruzada)', () => {
  const base = { mode: 'media', G: 0.67, patm: 830, factorLE: 1.2, pi: 140, crit: { pmin: 0, vmax: 20, maxLossPct: 10 } };
  for (const [q, l, di] of [[3.63, 2.55, 16], [10, 30, 26.6], [24, 30, 34.5], [1.5, 50, 12]]) {
    const m = E.calcNetwork([{ ini: 'A', fin: 'B', q, l, mat: 'CUSTOM', di }], { ...base, method: 'muller' }).rows[0].dp;
    const r = E.calcNetwork([{ ini: 'A', fin: 'B', q, l, mat: 'CUSTOM', di }], { ...base, method: 'renouard' }).rows[0].dp;
    assert.ok(Math.abs(m - r) / r < 0.20, `Q ${q}: Müller ${m.toFixed(3)} vs Renouard ${r.toFixed(3)}`);
  }
});

test('Caudal desde potencia', () => {
  close(E.flowFromPower(10.35, 'kW', 10.35), 1);
  close(E.flowFromPower(100000, 'BTU/h', 10.35), 29.307107 / 10.35);
});
