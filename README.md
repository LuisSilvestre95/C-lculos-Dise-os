# TODO GAS SYR S.A.S. — Cálculo y predicción de redes de gas

Aplicación web para calcular, predecir y documentar redes de **gas natural y GLP** en **baja presión** (Renouard lineal) y **media presión** (Renouard cuadrática). Funciona en PC con Windows o macOS, en celulares Android y iPhone y en tabletas. No necesita internet.

## Cómo usarla

| Opción | Pasos |
|---|---|
| **Un solo archivo** | Abra `dist/TODO_GAS_SYR.html` con doble clic, o envíelo por WhatsApp o correo al celular. Funciona sin conexión. |
| **Sitio web / app instalable** | Publique la carpeta completa (por ejemplo en GitHub Pages). Desde el celular, *Agregar a pantalla de inicio* la instala como app y queda funcionando sin conexión. |

## Qué hace

- **Cálculo por tramo**: pérdida de carga, presión final, velocidad, % de pérdida y estado (aprobado o rechazado). Admite **redes ramificadas**: cada ramal parte de la presión de su nodo.
- **Validaciones**: balance de caudales, ciclos, nodos con doble alimentación y datos faltantes.
- **Predicciones**:
  - diámetro comercial mínimo que cumple (Ø sugerido);
  - caudal máximo y longitud máxima admisibles por tramo;
  - crecimiento de demanda que admite la red;
  - presión mínima de suministro requerida;
  - curva de demanda del 25 % al 250 % y simulador de demanda futura.
- **Dimensionamiento automático**: usa el método de pérdida unitaria sobre la ruta más larga y luego ajusta hasta que la red cumple. Se puede deshacer.
- **Caudal por potencia**: convierte kW, BTU/h, kcal/h o MJ/h a m³/h.
- **Municipios de Colombia**: la presión atmosférica se calcula a partir de la altitud (atmósfera estándar ISA).
- **Exportación**:
  - memoria de cálculo en **PDF** vectorial, con logo, gráficas a unos 300 ppp y firma;
  - **Compartir** el PDF (WhatsApp, correo, Drive);
  - **CSV para Excel** en formato de Colombia;
  - guardar y abrir proyectos en `.json`;
  - imprimir.
- Modo claro y oscuro. Los datos se guardan automáticamente en el dispositivo.

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
