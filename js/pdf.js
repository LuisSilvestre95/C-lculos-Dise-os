/*!
 * TODO GAS SYR — Memoria de cálculo en PDF (jsPDF + AutoTable).
 * Texto y tablas vectoriales (nítidos a cualquier zoom), gráficas a ~300 ppp, logo y firma.
 * Las librerías se cargan solo al exportar para que la app abra al instante.
 */
(function (root) {
  'use strict';

  /* ---------- Carga diferida de librerías ---------- */
  const loaded = {};
  function loadLib(name, src, test) {
    if (test()) return Promise.resolve();
    if (loaded[name]) return loaded[name];
    loaded[name] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const inline = document.getElementById('lib-' + name); // versión de un solo archivo
      if (inline) { s.textContent = inline.textContent; document.head.appendChild(s); test() ? resolve() : reject(new Error('No se pudo iniciar ' + name)); return; }
      s.src = src; s.async = true;
      s.onload = () => (test() ? resolve() : reject(new Error('No se pudo iniciar ' + name)));
      s.onerror = () => { loaded[name] = null; reject(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
    return loaded[name];
  }
  async function ensureLibs() {
    await loadLib('jspdf', 'vendor/jspdf.umd.min.js', () => !!(root.jspdf && root.jspdf.jsPDF));
    await loadLib('autotable', 'vendor/jspdf.plugin.autotable.min.js', () => !!(root.jspdf && root.jspdf.jsPDF && root.jspdf.jsPDF.API.autoTable));
    await loadLib('brand', 'assets/brand.js', () => !!root.TGS_BRAND);
  }

  /* ---------- Utilidades ---------- */
  const MAP = { 'Δ': 'Delta ', '≤': '<=', '≥': '>=', '√': 'raiz', '–': '-', '—': '-', '✓': '', '→': '->', '₁': '1', '₂': '2', '…': '...', '−': '-', '⁻': '-', '⁷': '7', '⁵': '5', '¹': '1', '·': '·', '“': '"', '”': '"', '‘': "'", '’': "'" };
  const T = (s) => String(s ?? '').replace(/[^\x00-\xFF]/g, (c) => (c in MAP ? MAP[c] : '')).trim();
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));

  const C = {
    navy: hex('#023047'), navy0: hex('#01263a'), navy2: hex('#01537a'), cyan: hex('#219ebc'), gold: hex('#ffb703'), orange: hex('#fb8500'),
    ink: hex('#10283a'), ink2: hex('#3c5569'), muted: hex('#6a8093'), line: hex('#d8e3ea'), wash: hex('#f4f8fb'), white: [255, 255, 255],
    ok: hex('#0a7a4f'), okBg: hex('#dcf5e8'), bad: hex('#b4232f'), badBg: hex('#fde3e4'), warn: hex('#9a5b00'), warnBg: hex('#fff1d1')
  };

  function hGrad(doc, x, y, w, h, stops, n = 80) {
    const seg = w / n;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [t0, c0] = stops[k], [t1, c1] = stops[k + 1];
      doc.setFillColor(...mix(c0, c1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0 || 1)))));
      doc.rect(x + i * seg, y, seg + 0.15, h, 'F');
    }
  }

  /* ---------- Documento ---------- */
  async function build(d) {
    await ensureLibs();
    const { jsPDF } = root.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter', compress: true });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
    const B = root.TGS_BRAND;
    const media = d.mode === 'media';
    const accent = media ? C.cyan : C.orange, accent2 = media ? C.navy : C.gold;
    const regimen = media ? 'MEDIA PRESIÓN · RENOUARD CUADRÁTICA' : 'BAJA PRESIÓN · RENOUARD LINEAL';
    const s = d.res.summary, p = d.params, crit = p.crit;
    // El informe lleva por defecto el nombre del cliente; el campo "Informe" solo se usa si se cambia a mano.
    const ref = (d.client.ref || '').trim() || (d.client.name || '').trim() || ('TGS-' + d.dateISO.slice(0, 10).replace(/-/g, ''));

    doc.setProperties({
      title: T(`Memoria de cálculo - ${d.client.name || 'Proyecto'} - ${media ? 'Media' : 'Baja'} presión`),
      subject: 'Cálculo de red de gas - TODO GAS SYR S.A.S.', author: 'TODO GAS SYR S.A.S.', creator: 'TODO GAS SYR · Sistema de cálculo', keywords: 'gas natural, GLP, Renouard, NTC 2505'
    });
    doc.setLineHeightFactor(1.25);

    /* Encabezado completo (página 1) */
    function headerFull() {
      hGrad(doc, 0, 0, W, 32, [[0, C.navy0], [0.55, C.navy], [1, C.navy2]]);
      // brillo dorado
      doc.setGState(new doc.GState({ opacity: 0.16 })); doc.setFillColor(...C.gold); doc.circle(W - 40, -6, 34, 'F'); doc.setGState(new doc.GState({ opacity: 1 }));
      hGrad(doc, 0, 32, W, 1.6, [[0, C.cyan], [0.55, C.gold], [1, C.orange]]);
      if (B && B.flame) doc.addImage(B.flame, 'PNG', M, 4.5, 20, 23.5, 'flame', 'FAST');
      doc.setTextColor(...C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
      doc.text('TODO GAS SYR', M + 25, 13);
      const tw = doc.getTextWidth('TODO GAS SYR ');
      doc.setTextColor(...C.gold); doc.text('S.A.S.', M + 25 + tw, 13);
      doc.setFontSize(9.5); doc.setTextColor(...C.gold); doc.text(T('MEMORIA DE CÁLCULO · RED DE GAS · ' + regimen), M + 25, 19.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 226, 238);
      doc.text(T('NIT 901.126.243-3 · Colombia · Tel. 322 361 8360 · 320 948 5534'), M + 25, 25);
      // Caja del informe: el texto se ajusta solo (1 o 2 líneas) para no salirse del recuadro.
      const bw = 72, bx = W - M - bw, by = 5, bh = 23, tw0 = bw - 8;
      doc.setFillColor(255, 255, 255); doc.setGState(new doc.GState({ opacity: 0.1 })); doc.roundedRect(bx, by, bw, bh, 2.5, 2.5, 'F'); doc.setGState(new doc.GState({ opacity: 1 }));
      doc.setDrawColor(...C.gold); doc.setLineWidth(0.3); doc.roundedRect(bx, by, bw, bh, 2.5, 2.5, 'S');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(200, 226, 238); doc.text('INFORME', bx + 4, by + 4.8);
      doc.setFont('helvetica', 'bold');
      let fs = 11, lines = [T(ref)];
      for (; fs >= 6.5; fs -= 0.25) {
        doc.setFontSize(fs);
        lines = doc.splitTextToSize(T(ref), tw0);
        if (lines.length === 1 || (lines.length === 2 && fs <= 9.5)) break;
      }
      if (lines.length > 2) { lines = lines.slice(0, 2); lines[1] = lines[1].replace(/.{0,3}$/, '...'); }
      doc.setFontSize(fs); doc.setTextColor(...C.white);
      const ty = lines.length === 1 ? by + 12.5 : by + 10.2;
      doc.text(lines, bx + 4, ty, { lineHeightFactor: 1.15 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...C.gold); doc.text(T(d.date), bx + 4, by + bh - 3);
    }
    /* Encabezado compacto (páginas siguientes) */
    function headerSmall() {
      hGrad(doc, 0, 0, W, 14, [[0, C.navy0], [0.6, C.navy], [1, C.navy2]]);
      hGrad(doc, 0, 14, W, 1, [[0, C.cyan], [0.55, C.gold], [1, C.orange]]);
      if (B && B.flame) doc.addImage(B.flame, 'PNG', M, 2.2, 8.5, 10, 'flame', 'FAST');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...C.white); doc.text('TODO GAS SYR S.A.S.', M + 11, 8.8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gold); doc.text(T(regimen), M + 55, 8.8);
      doc.setTextColor(200, 226, 238); oneLine(T(ref === (d.client.name || '').trim() ? ref : `${d.client.name ? d.client.name + ' · ' : ''}Informe ${ref}`), W - M, 8.8, W / 2 - 30, 7.5, { align: 'right' });
    }
    /** Escribe en una sola línea: reduce la letra hasta 6.5 pt y, si aún no cabe, recorta con "...". */
    function oneLine(txt, x, y, maxW, size, opt = {}) {
      let fs = size; doc.setFontSize(fs);
      while (doc.getTextWidth(txt) > maxW && fs > 6.5) { fs -= 0.25; doc.setFontSize(fs); }
      let t = txt;
      while (doc.getTextWidth(t) > maxW && t.length > 4) t = t.slice(0, -4) + '...';
      doc.text(t, x, y, opt);
    }
    function sectionTitle(txt, y, x = M, color = accent) {
      doc.setFillColor(...color); doc.roundedRect(x, y - 3.6, 1.8, 5, 0.6, 0.6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink); doc.text(T(txt.toUpperCase()), x + 4, y);
      return y + 4;
    }
    function card(x, y, w, h, title, color = accent) {
      doc.setFillColor(...C.wash); doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.roundedRect(x, y, w, h, 2.2, 2.2, 'FD');
      doc.setFillColor(...color); doc.roundedRect(x, y, w, 6.5, 2.2, 2.2, 'F'); doc.rect(x, y + 3.5, w, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8); doc.setTextColor(...C.white); doc.text(T(title.toUpperCase()), x + 3, y + 4.5);
    }
    function kv(x, y, rows, labelW, maxW) {
      rows.forEach(([k, v], i) => {
        const yy = y + i * 5.1;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...C.muted); doc.text(T(k), x, yy);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.ink); oneLine(T(v || '-'), x + labelW, yy, maxW - labelW, 8.2);
      });
    }

    /* ===== PÁGINA 1 ===== */
    headerFull();
    let y = 40;
    const gap = 5, wA = 96, wB = 88, wC = W - 2 * M - wA - wB - 2 * gap, hC = 37;
    card(M, y, wA, hC, 'Cliente / Proyecto');
    kv(M + 3, y + 11.5, [['Nombre', d.client.name], ['Cédula / NIT', d.client.id], ['Dirección', d.client.address], ['Municipio', d.client.city], ['Teléfono', d.client.phone]], 22, wA - 5);
    card(M + wA + gap, y, wB, hC, 'Parámetros de diseño', media ? C.navy : C.cyan);
    kv(M + wA + gap + 3, y + 11.5, [
      ['Gas', `${p.gasLabel} · S = ${fmt(p.G, 3)}`],
      ['Ubicación', `${p.city}${Number.isFinite(p.altitude) ? ` · ${fmt(p.altitude, 0)} m` : ''}`],
      ['P. atmosférica', `${fmt(p.patm, 1)} mbar`],
      ['P. suministro', `${fmt(p.pi, 2)} mbar (${fmt(p.pi * 0.0145038, 3)} psi)`],
      ['Criterios', `${crit.pmin > 0 ? `Pmin ${crit.pmin} mbar · ` : ''}Vmax ${crit.vmax} m/s · dP <= ${crit.maxLossPct} %`]
    ], 24, wB - 5);
    // Resultado global
    const xC = M + wA + wB + 2 * gap;
    const okAll = s.ok, incomplete = !s.complete;
    const stCol = incomplete ? C.warn : okAll ? C.ok : C.bad, stBg = incomplete ? C.warnBg : okAll ? C.okBg : C.badBg;
    card(xC, y, wC, hC, 'Resultado global', stCol);
    doc.setFillColor(...stBg); doc.roundedRect(xC + 4, y + 10, wC - 8, 13, 6.5, 6.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...stCol);
    doc.text(incomplete ? 'INCOMPLETO' : okAll ? 'APROBADO' : 'RECHAZADO', xC + wC / 2, y + 18.8, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.ink2);
    doc.text(T(`${s.approved} de ${s.total} tramos cumplen`), xC + wC / 2, y + 28.5, { align: 'center' });
    doc.text(T(Number.isFinite(s.pfMin) ? `Presión mínima: ${fmt(s.pfMin, 2)} mbar` : 'Complete los datos de los tramos'), xC + wC / 2, y + 33, { align: 'center' });

    // Tabla de resultados
    y += hC + 9;
    y = sectionTitle('Resultados del cálculo', y);
    const cols = d.table.cols.map(([a, b]) => T(a) + (b ? '\n' + T(b) : ''));
    const statusIdx = cols.findIndex((c) => c.startsWith('Estado'));
    const body = d.table.rows.map(({ r, cells }) => {
      if (!cells) return [T(`${r.ini}-${r.fin}`), { content: T(`Datos incompletos: ${r.reason}`), colSpan: cols.length - 1, styles: { halign: 'left', textColor: C.muted, fontStyle: 'italic' } }];
      return cells.map(([v, cls]) => (v === '__status__' ? (r.ok ? 'APROBADO' : 'RECHAZADO') : { content: T(v), cls }));
    });
    doc.autoTable({
      startY: y, margin: { left: M, right: M, top: 22, bottom: 16 }, head: [cols], body,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: media ? 7.6 : 8, cellPadding: { top: 2, bottom: 2, left: 1.2, right: 1.2 }, halign: 'center', valign: 'middle', lineColor: C.line, lineWidth: 0.2, textColor: C.ink, overflow: 'linebreak' },
      headStyles: { fillColor: accent, textColor: C.white, fontStyle: 'bold', fontSize: media ? 7.2 : 7.6, lineColor: mix(accent, C.white, 0.35), minCellHeight: 9 },
      alternateRowStyles: { fillColor: C.wash },
      columnStyles: { 0: { fontStyle: 'bold' } },
      didParseCell: (h) => {
        if (h.section !== 'body') return;
        const raw = h.cell.raw;
        if (h.column.index === statusIdx && typeof raw === 'string') {
          const ok = raw === 'APROBADO';
          h.cell.styles.fillColor = ok ? C.okBg : C.badBg; h.cell.styles.textColor = ok ? C.ok : C.bad; h.cell.styles.fontStyle = 'bold';
        } else if (raw && raw.cls) {
          if (raw.cls === 'c-bad') { h.cell.styles.fillColor = C.badBg; h.cell.styles.textColor = C.bad; h.cell.styles.fontStyle = 'bold'; }
          else if (raw.cls === 'c-warn') { h.cell.styles.fillColor = C.warnBg; h.cell.styles.textColor = C.warn; h.cell.styles.fontStyle = 'bold'; }
          else if (raw.cls === 'c-ok') { h.cell.styles.textColor = C.ok; h.cell.styles.fontStyle = 'bold'; }
          else if (raw.cls === 'muted') { h.cell.styles.textColor = C.muted; }
        }
      },
      didDrawPage: (h) => { if (h.pageNumber > 1) headerSmall(); }
    });
    y = doc.lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...C.muted);
    const note = media
      ? `Renouard cuadrática con presiones absolutas (P abs = P + ${fmt(p.patm, 1)} mbar). Le = L × ${fmt(p.factorLE, 2)}. Criterios: V <= ${crit.vmax} m/s · pérdida por tramo <= ${crit.maxLossPct} %${crit.pmin > 0 ? ` · P2 >= ${crit.pmin} mbar` : ''}.`
      : `Renouard lineal: dP = 23 200 · S · Le · Q^1.82 · D^-4.82. Le = L × ${fmt(p.factorLE, 2)}. Criterios: Pf >= ${crit.pmin} mbar · V <= ${crit.vmax} m/s · pérdida por tramo <= ${crit.maxLossPct} %.`;
    doc.text(T(note), M, y + 1, { maxWidth: W - 2 * M });

    /* ===== PÁGINA 2: GRÁFICAS + FIRMA ===== */
    doc.addPage(); headerSmall();
    y = 24;
    y = sectionTitle('Gráficas', y);
    const Charts = root.Charts;
    const cw = (W - 2 * M - 6) / 2, ch = 100;
    const drawChart = (spec, x, yy, w, h, title, sub) => {
      doc.setFillColor(...C.white); doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.roundedRect(x, yy, w, h, 2.2, 2.2, 'FD');
      hGrad(doc, x + 2, yy, w - 4, 1.2, [[0, accent2], [1, accent]], 30);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink); doc.text(T(title), x + 4, yy + 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...C.muted); doc.text(T(sub), x + 4, yy + 11.5);
      if (spec.empty) { doc.setFontSize(8.5); doc.text(T(spec.emptyText || 'Sin datos'), x + w / 2, yy + h / 2, { align: 'center' }); return; }
      const pw = w - 8, ph = h - 18, pxPerMm = 3.9;
      const img = Charts.toPNG({ ...spec, fontScale: 1 }, pw * pxPerMm, ph * pxPerMm, 3.6);
      doc.addImage(img, 'PNG', x + 4, yy + 15, pw, ph, undefined, 'FAST');
    };
    drawChart(d.specs.profile, M, y, cw, ch, 'Presión en cada nodo', 'Desde la fuente hasta el punto final de la red');
    drawChart(d.specs.vel, M + cw + 6, y, cw, ch, 'Velocidad por tramo', 'Rojo: supera el límite · ámbar: >= 80 % del límite');
    y += ch + 8;

    // Firma
    if (y + 40 > H - 14) { doc.addPage(); headerSmall(); y = 24; }
    const sigW = 66, sx = W - M - sigW;
    if (B && B.logo) doc.addImage(B.logo, 'PNG', M, y, 30, 31.8, 'logo', 'FAST');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.ink); doc.text('TODO GAS SYR S.A.S.', M + 35, y + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...C.ink2);
    doc.text(T('NIT 901.126.243-3'), M + 35, y + 14);
    doc.text(T('Diseño, cálculo e instalación de redes de gas'), M + 35, y + 18.5);
    doc.text(T('Tel. 322 361 8360 · 320 948 5534 · Colombia'), M + 35, y + 23);
    const fw = 44, fh = fw / 3.99; // firma más pequeña y proporcionada
    if (B && B.firma) doc.addImage(B.firma, 'PNG', sx + (sigW - fw) / 2, y + 22 - fh, fw, fh, 'firma', 'FAST');
    doc.setDrawColor(...C.ink); doc.setLineWidth(0.3); doc.line(sx + 4, y + 24, sx + sigW - 4, y + 24);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8); doc.setTextColor(...C.ink); doc.text('Luis Silvestre', sx + sigW / 2, y + 28.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...C.ink2);
    doc.text(T('Ingeniero · MP 041122-0809747 BYC - COPNIA'), sx + sigW / 2, y + 32.5, { align: 'center' });
    doc.text(T('Responsable del diseño y cálculos'), sx + sigW / 2, y + 36.3, { align: 'center' });

    /* Pie de página en todas las hojas */
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      hGrad(doc, M, H - 11, W - 2 * M, 0.5, [[0, C.cyan], [0.55, C.gold], [1, C.orange]], 40);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...C.muted);
      doc.text(T(`TODO GAS SYR S.A.S. · NIT 901.126.243-3 · Memoria de cálculo generada el ${d.date}`), M, H - 6.5);
      doc.setFontSize(6.2); doc.text(T('Documento técnico: verifique los datos de entrada antes de construir.'), M, H - 3.4);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.ink2); doc.text(`Página ${i} de ${n}`, W - M, H - 6.5, { align: 'right' });
    }
    return doc;
  }

  root.GasPDF = { build, ensureLibs };
})(window);
