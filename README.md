# TODO GAS SYR S.A.S. — Cálculo de redes de gas

Aplicación web para calcular y documentar redes de **gas natural y GLP** en **baja presión** (Renouard lineal) y **media presión** (Renouard cuadrática). Funciona en PC con Windows o macOS, en celulares Android y iPhone y en tabletas. No necesita internet.

## Cómo usarla

| Opción | Pasos |
|---|---|
| **Un solo archivo** | Abra `dist/TODO_GAS_SYR.html` con doble clic, o envíelo por WhatsApp o correo al celular. Funciona sin conexión. |
| **Sitio web / app instalable** | Publique la carpeta completa (por ejemplo en GitHub Pages). Desde el celular, *Agregar a pantalla de inicio* la instala como app y queda funcionando sin conexión. |

## Qué hace

- **Baja y media presión**, con gas natural, GLP (propano, butano o mezcla 60/40) u otro gas con densidad manual.
- **Tuberías**: PE-AL-PE, polietileno PE100 (IPS y métrico SDR 11), PE80, acero Sch 40, acero galvanizado, cobre tipo L y diámetro manual.
- **Tramos automáticos**: cada tramo nuevo empieza donde terminó el anterior, con el siguiente nodo, el mismo material y el mismo diámetro. Con **Enter** se pasa de campo en campo y, al final del último tramo, se crea el siguiente. Admite redes con ramales.
- **Cálculo al instante** de pérdida, presión final, velocidad y estado (aprobado o rechazado, con el motivo).
- **Elegir diámetros automáticamente**: busca los diámetros comerciales para que toda la red cumpla. Se puede deshacer.
- **Caudal por potencia** de gasodomésticos y presión atmosférica según el municipio.
- **Exportación**: PDF con logo, resultados del cálculo, gráficas y firma; compartir el PDF; CSV para Excel; guardar y abrir proyectos; imprimir.
- Modo claro y oscuro. Los datos se guardan automáticamente en el dispositivo.

Hay dos PDF de ejemplo en `docs/` (baja y media presión).

## Fórmulas

- Baja presión: `ΔP[mbar] = 23 200 · S · Le[m] · Q^1.82 · D^-4.82`
- Media presión: `P1² − P2² = 48 600 · S · Le[km] · Q^1.82 · D^-4.82`, con P absoluta en bar. Con P en mbar y Le en m, la constante es `4.86·10⁷`.
- Velocidad: `V = 354 · Q / (P_abs[bar] · D²)`
- `Le = L × 1.2`. El factor y los criterios de aceptación (Pmin, Vmax, % de pérdida) se pueden editar.

## Desarrollo

```bash
node --test tests/*.cjs     # pruebas del motor de cálculo
node tools/build.mjs        # regenera dist/TODO_GAS_SYR.html y assets/brand.js
```

Estructura: `index.html`, `css/app.css`, `js/engine.js` (motor puro, con pruebas), `js/charts.js`, `js/pdf.js`, `js/app.js`, `vendor/` (jsPDF 4.2.1 y jsPDF-AutoTable 5.0.8, licencia MIT), `sw.js` y `manifest.webmanifest` (PWA).
