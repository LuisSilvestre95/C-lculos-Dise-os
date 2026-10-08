/*!
 * TODO GAS SYR — Gráficas en canvas nativo (sin dependencias).
 * Nítidas en pantallas retina (devicePixelRatio), tooltips con mouse y táctil, y
 * renderizado a alta resolución para el PDF.
 */
(function (root) {
  'use strict';

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || getComputedStyle(document.body).getPropertyValue(name).trim();
  const themeFromCSS = () => ({
    ink: css('--ink'), ink2: css('--chart-ink'), grid: css('--chart-grid'), surface: css('--surface'),
    s1: css('--ser-1'), s2: css('--ser-2'), ok: css('--ok'), warn: css('--warn'), bad: css('--bad'), okBg: css('--ok-bg'),
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
  });
  const LIGHT = { ink: '#10283a', ink2: '#4d6477', grid: '#e3ebf0', surface: '#ffffff', s1: '#0e7fa3', s2: '#e06c00', ok: '#0a7a4f', warn: '#b86e00', bad: '#b4232f', okBg: '#dcf5e8', font: 'Helvetica, Arial, sans-serif' };

  function niceTicks(min, max, count = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
    if (min === max) { const pad = Math.abs(min) * 0.1 || 1; min -= pad; max += pad; }
    const span = max - min;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { min: lo, max: hi, step, ticks };
  }
  const fmtTick = (v, step) => { const d = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step))); return v.toFixed(d); };

  function roundRectTop(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, Math.abs(h));
    ctx.beginPath();
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.closePath();
  }

  /**
   * Dibuja un gráfico en un contexto 2D (w×h en unidades CSS). Devuelve el layout para hit-testing.
   * spec.kind = 'line' | 'bars'
   */
  function draw(ctx, w, h, spec, t, hover) {
    const fs = spec.fontScale || 1;
    const F = (px, weight = 500) => `${weight} ${px * fs}px ${t.font}`;
    ctx.clearRect(0, 0, w, h);
    if (spec.background) { ctx.fillStyle = spec.background; ctx.fillRect(0, 0, w, h); }
    if (!spec || spec.empty) {
      ctx.fillStyle = t.ink2; ctx.font = F(13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(spec && spec.emptyText ? spec.emptyText : 'Sin datos para graficar', w / 2, h / 2);
      return null;
    }
    const pad = { l: 46 * fs, r: 14 * fs, t: 18 * fs, b: 36 * fs };
    const X0 = pad.l, X1 = w - pad.r, Y0 = pad.t, Y1 = h - pad.b;

    // Dominio Y
    let ys = spec.kind === 'bars' ? spec.bars.map((b) => b.value) : spec.points.map((p) => p.y);
    (spec.refs || []).forEach((r) => ys.push(r.y));
    ys = ys.filter(Number.isFinite);
    let yMin = spec.yMin != null ? Math.min(spec.yMin, ...ys) : Math.min(...ys);
    let yMax = Math.max(...ys);
    if (spec.kind === 'bars') yMin = 0;
    else { const padY = (yMax - yMin) * 0.12 || 1; yMin -= padY; yMax += padY * 0.6; if (spec.yFloor != null) yMin = Math.max(yMin, spec.yFloor); }
    const yt = niceTicks(yMin, yMax, h < 240 ? 4 : 5);
    const sy = (v) => Y1 - (v - yt.min) / (yt.max - yt.min) * (Y1 - Y0);

    // Rejilla + eje Y
    ctx.lineWidth = 1; ctx.strokeStyle = t.grid; ctx.fillStyle = t.ink2; ctx.font = F(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    yt.ticks.forEach((v) => { const y = Math.round(sy(v)) + 0.5; ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke(); ctx.fillText(fmtTick(v, yt.step), X0 - 8 * fs, y); });
    if (spec.yLabel) { ctx.save(); ctx.translate(12 * fs, (Y0 + Y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.font = F(10, 600); ctx.fillText(spec.yLabel, 0, 0); ctx.restore(); }

    const layout = { X0, X1, Y0, Y1, sy, kind: spec.kind, items: [] };

    if (spec.kind === 'line') {
      const xs = spec.points.map((p) => p.x);
      let xMin = spec.xMin != null ? spec.xMin : Math.min(...xs), xMax = Math.max(...xs);
      if (xMax === xMin) xMax = xMin + 1;
      const xt = niceTicks(xMin, xMax, w < 420 ? 4 : 6);
      if (spec.xTight) { xt.min = xMin; xt.max = xMax; }
      const sx = (v) => X0 + (v - xt.min) / (xt.max - xt.min) * (X1 - X0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = t.ink2; ctx.font = F(10);
      xt.ticks.filter((v) => v >= xt.min - 1e-9 && v <= xt.max + 1e-9).forEach((v) => ctx.fillText((spec.xFmt || ((x) => fmtTick(x, xt.step)))(v), sx(v), Y1 + 7 * fs));
      if (spec.xLabel) { ctx.font = F(10, 600); ctx.fillText(spec.xLabel, (X0 + X1) / 2, Y1 + 20 * fs); }
      // Zona sombreada (por ejemplo, zona de rechazo)
      (spec.bands || []).forEach((b) => {
        const xa = sx(Math.max(b.from, xt.min)), xb = sx(Math.min(b.to, xt.max));
        if (xb > xa) { ctx.fillStyle = b.color; ctx.globalAlpha = 0.09; ctx.fillRect(xa, Y0, xb - xa, Y1 - Y0); ctx.globalAlpha = 1; }
      });
      // Área bajo la curva
      const pts = spec.points.filter((p) => Number.isFinite(p.y)).map((p) => ({ ...p, px: sx(p.x), py: sy(p.y) }));
      if (pts.length) {
        const g = ctx.createLinearGradient(0, Y0, 0, Y1);
        g.addColorStop(0, spec.color || t.s1); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 0.12; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pts[0].px, Y1);
        pts.forEach((p) => ctx.lineTo(p.px, p.py)); ctx.lineTo(pts[pts.length - 1].px, Y1); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = spec.color || t.s1; ctx.lineWidth = 1.75 * fs; ctx.lineJoin = 'round'; ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py))); ctx.stroke();
        if (spec.markers !== false) pts.forEach((p) => {
          ctx.beginPath(); ctx.arc(p.px, p.py, 3.2 * fs, 0, Math.PI * 2); ctx.fillStyle = t.surface; ctx.fill();
          ctx.lineWidth = 1.75 * fs; ctx.strokeStyle = p.bad ? t.bad : (spec.color || t.s1); ctx.stroke();
        });
        // Etiquetas directas selectivas
        ctx.font = F(9.5, 700); ctx.fillStyle = t.ink; ctx.textBaseline = 'bottom';
        // Etiquetas sin superponerse: si dos nodos quedan muy juntos se omite el anterior (se conserva el último).
        const minGap = 16 * fs;
        const show = pts.map((p) => !!p.label);
        for (let i = pts.length - 2; i >= 0; i--) {
          let j = i + 1; while (j < pts.length && !show[j]) j++;
          if (j < pts.length && show[i] && Math.hypot(pts[j].px - pts[i].px, pts[j].py - pts[i].py) < minGap) show[i] = i === 0; // la fuente siempre se nombra
          if (i === 0 && show[0] && j < pts.length && Math.hypot(pts[j].px - pts[0].px, pts[j].py - pts[0].py) < minGap) show[j] = j === pts.length - 1 ? true : false;
        }
        pts.forEach((p, i) => {
          if (!show[i]) return;
          const near0 = i > 0 && show[0] && Math.abs(p.px - pts[0].px) < minGap;
          ctx.textAlign = i === 0 ? 'left' : i === pts.length - 1 ? 'right' : 'center';
          ctx.fillText(p.label, p.px + (near0 ? 10 * fs : 0), p.py - 8 * fs);
        });
        layout.items = pts;
      }
      // Marcador vertical (por ejemplo, demanda actual)
      (spec.vmarks || []).forEach((m) => {
        if (!Number.isFinite(m.x)) return;
        const x = Math.round(sx(m.x)) + 0.5; ctx.save(); ctx.setLineDash([3 * fs, 3 * fs]); ctx.strokeStyle = m.color || t.ink2; ctx.lineWidth = 1.5 * fs;
        ctx.beginPath(); ctx.moveTo(x, Y0); ctx.lineTo(x, Y1); ctx.stroke(); ctx.restore();
        ctx.fillStyle = m.color || t.ink2; ctx.font = F(10.5, 700); ctx.textAlign = x > (X0 + X1) / 2 ? 'right' : 'left'; ctx.textBaseline = 'top';
        ctx.fillText(m.label, x + (ctx.textAlign === 'left' ? 5 : -5) * fs, Y0 + 2 * fs);
      });
      layout.sx = sx;
    } else {
      const n = spec.bars.length;
      const slot = (X1 - X0) / n;
      const bw = Math.max(6 * fs, Math.min(28 * fs, slot * 0.46));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = F(n > 12 ? 9 : 10, 600);
      spec.bars.forEach((b, i) => {
        const cx = X0 + slot * (i + 0.5);
        const y = sy(Math.max(0, b.value));
        const col = b.status === 'bad' ? t.bad : b.status === 'warn' ? t.warn : (spec.color || t.s1);
        ctx.globalAlpha = hover && hover.index !== i ? 0.55 : 1;
        ctx.fillStyle = col; roundRectTop(ctx, cx - bw / 2, y, bw, Y1 - y, 4 * fs); ctx.fill(); ctx.globalAlpha = 1;
        if (n <= 16 || i % 2 === 0) { ctx.fillStyle = t.ink2; ctx.fillText(b.label, cx, Y1 + 7 * fs); }
        if (spec.valueLabels && n <= 12) { ctx.fillStyle = t.ink; ctx.font = F(9.5, 700); ctx.textBaseline = 'bottom'; ctx.fillText(b.value.toFixed(1), cx, y - 3 * fs); ctx.textBaseline = 'top'; ctx.font = F(n > 12 ? 9 : 10, 600); }
        layout.items.push({ px: cx, py: y, w: slot, ...b });
      });
      if (spec.xLabel) { ctx.fillStyle = t.ink2; ctx.font = F(10, 600); ctx.fillText(spec.xLabel, (X0 + X1) / 2, Y1 + 20 * fs); }
    }

    // Líneas de referencia (límites)
    (spec.refs || []).forEach((r) => {
      if (!Number.isFinite(r.y)) return;
      const y = Math.round(sy(r.y)) + 0.5;
      ctx.save(); ctx.setLineDash([5 * fs, 4 * fs]); ctx.strokeStyle = r.color || t.bad; ctx.lineWidth = 1.1 * fs;
      ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke(); ctx.restore();
      ctx.font = F(9.5, 700); const tw = ctx.measureText(r.label).width;
      ctx.fillStyle = t.surface; ctx.globalAlpha = 0.9; ctx.fillRect(X1 - tw - 10 * fs, y - 16 * fs, tw + 8 * fs, 14 * fs); ctx.globalAlpha = 1;
      ctx.fillStyle = r.color || t.bad; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(r.label, X1 - 6 * fs, y - 3 * fs);
    });

    // Eje base
    ctx.strokeStyle = t.ink2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X0, Y1 + 0.5); ctx.lineTo(X1, Y1 + 0.5); ctx.stroke();

    // Capa de hover (crosshair)
    if (hover && spec.kind === 'line') {
      const p = hover.item; ctx.save(); ctx.strokeStyle = t.ink2; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(p.px) + 0.5, Y0); ctx.lineTo(Math.round(p.px) + 0.5, Y1); ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(p.px, p.py, 5, 0, Math.PI * 2); ctx.fillStyle = spec.color || t.s1; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = t.surface; ctx.stroke();
    }
    return layout;
  }

  /** Vista interactiva enlazada a un <canvas>. */
  class ChartView {
    constructor(canvas) {
      this.canvas = canvas; this.box = canvas.parentElement; this.spec = { empty: true }; this.hover = null;
      this.tip = document.createElement('div'); this.tip.className = 'chart-tip'; this.tip.hidden = true; this.box.appendChild(this.tip);
      this.ro = new ResizeObserver(() => this.render()); this.ro.observe(this.box);
      const move = (e) => this.onMove(e);
      canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', move);
      canvas.addEventListener('pointerleave', () => this.clearHover());
    }
    set(spec) { this.spec = spec; this.hover = null; this.tip.hidden = true; this.render(); }
    render() {
      const r = this.box.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
      const ctx = this.canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.layout = draw(ctx, r.width, r.height, this.spec, themeFromCSS(), this.hover);
    }
    onMove(e) {
      if (!this.layout || !this.layout.items.length) return;
      const r = this.canvas.getBoundingClientRect(); const x = e.clientX - r.left;
      let best = null, bd = Infinity;
      this.layout.items.forEach((it, i) => { const d = Math.abs(it.px - x); if (d < bd) { bd = d; best = { item: it, index: i }; } });
      if (!best) return;
      this.hover = best; this.render();
      this.tip.innerHTML = best.item.tip || '';
      this.tip.hidden = !best.item.tip;
      const left = Math.max(70, Math.min(r.width - 70, best.item.px));
      this.tip.style.left = left + 'px'; this.tip.style.top = Math.max(best.item.py, 40) + 'px';
    }
    clearHover() { this.hover = null; this.tip.hidden = true; this.render(); }
  }

  /** Renderiza un gráfico a PNG de alta resolución (para PDF). */
  function toPNG(spec, wCss, hCss, scale = 3) {
    const c = document.createElement('canvas'); c.width = Math.round(wCss * scale); c.height = Math.round(hCss * scale);
    const ctx = c.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw(ctx, wCss, hCss, { ...spec, background: '#ffffff' }, LIGHT, null);
    return c.toDataURL('image/png');
  }

  root.Charts = { ChartView, toPNG, draw, niceTicks, LIGHT };
})(window);
