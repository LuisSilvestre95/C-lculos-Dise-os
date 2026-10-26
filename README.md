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

Hay dos PDF de ejemplo en `docs/` (baja y media presión). Gráficas: presión que llega a cada nodo (con la mínima permitida) y velocidad por tramo (con el límite).

## Fórmulas (se eligen solas)

| Régimen | Fórmula | Por qué |
|---|---|---|
| **Baja presión** (≤ 100 mbar) | Renouard lineal: `ΔP[mbar] = 23 200 · S · Le[m] · Q^1.82 · D^-4.82` | Es la fórmula normativa de baja presión |
| **Media presión** (100–5000 mbar) | Müller: `P1² − P2² = (Q · S^0.425 · Le^0.576 / (4.61·10⁻⁵ · D^2.725))^1.74`, con P absoluta en mbar | Es la más cercana al método físico de referencia (Darcy-Weisbach con Colebrook): menos de 5 % de diferencia, frente a 8–28 % de Renouard cuadrática |

- **Velocidad:** `V = 354 · Q / (P_abs[bar] · D²)`.
- **Automático:**
  - el régimen cambia solo según la presión que se escriba (más de 100 mbar pasa a media presión);
  - la densidad la pone el tipo de gas y la presión típica de baja se ajusta (GN 23 mbar, GLP 28 mbar);
  - la presión atmosférica sale del municipio;
  - altitud, presión atmosférica y densidad solo aparecen cuando hace falta escribirlas (municipio "Personalizado" u "Otro gas").
- **Tramos de accesorio:** un tramo corto (≤ 0.10 m, de tee a tee) que lleva más caudal que el tramo que llega a su nodo se toma automáticamente desde la tee anterior. Así cuadra el caudal y la presión es la real. En la tabla y en el PDF, la Q y la L de esos tramos salen en azul para identificarlos en la suma manual.
- **Resta de caudales (solo en pantalla, uso interno):** debajo de la columna Caudal de la tabla de tramos, se actualiza mientras se escribe: entra − consumos = resta (debe dar 0), con el consumo de cada nodo. No sale en el PDF.
- **Municipios del Valle de Tenza y oriente de Boyacá** (Garagoa, Guateque, Tenza, Sutatenza, La Capilla, Chinavita, Pachavita, Zetaquira, Berbeo, Páez, Miraflores, Macanal, Santa María, etc.) agrupados primero en el selector; altitud aproximada de la cabecera, ajustable con «Personalizado».
- **Regulador de baja:** avisa si la presión de suministro supera la salida máxima del regulador (25 mbar por defecto, editable).
- **Exportación:** los archivos se llaman `Diseno Baja - NOMBRE DEL CLIENTE.pdf` o `Diseno Media - …`, y el PDF lleva el título "DISEÑO".
- **Criterios y ajustes** (plegados): presión mínima, velocidad máxima, pérdida máxima por tramo y factor de longitud equivalente (`Le = L × 1.2`).
- El motor también reproduce las hojas de Excel anteriores (Patm 723.6, k 345). Las pruebas automáticas lo verifican hasta 12 decimales.

## Desarrollo

```bash
node --test tests/*.cjs     # pruebas del motor de cálculo
node tools/build.mjs        # regenera dist/TODO_GAS_SYR.html y assets/brand.js
```

Estructura: `index.html`, `css/app.css`, `js/engine.js` (motor puro, con pruebas), `js/charts.js`, `js/pdf.js`, `js/app.js`, `vendor/` (jsPDF 4.2.1 y jsPDF-AutoTable 5.0.8, licencia MIT), `sw.js` y `manifest.webmanifest` (PWA).
