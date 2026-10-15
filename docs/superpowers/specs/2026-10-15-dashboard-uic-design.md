# Dashboard GO UIC — Especificación Técnica

## Resumen

Dashboard web para la Unidad de Investigación Clínica (UIC) de Grupo Oroño. Muestra facturación de protocolos clínicos, producción de visitas, proyección financiera a 10 años, y relaciones con patrocinadores/CROs. Hosteado en GitHub Pages, alimentado en vivo desde Google Sheets.

**Audiencia:** Mixta — gerencia UIC, dirección GO (interna) + patrocinadores y CROs (externa). Todos ven lo mismo, sin perfiles diferenciados.

**Responsable de datos:** Yamila Margaria (ymargaria@grupoorono.com.ar) edita el Google Sheet. El dashboard se actualiza automáticamente en cada recarga.

---

## Stack técnico

| Componente | Tecnología |
|---|---|
| Hosting | GitHub Pages |
| Datos | Google Sheets publicado como CSV (una URL por pestaña) |
| Markup | HTML5 |
| Estilos | Tailwind CSS (CDN) + CSS custom para branding GO |
| Gráficos | Chart.js (CDN) |
| Parsing CSV | PapaParse (CDN) |
| Tablas | HTML nativo con sorting JS, paginación para tablas grandes |
| Login | Hash SHA-256 de contraseña en JS, sessionStorage para persistir sesión |

**Sin build step.** Todo se sirve estático desde el repositorio.

---

## Estructura de archivos

```
UIC/
├── index.html              ← pantalla de login
├── dashboard.html          ← app principal (5 secciones como tabs)
├── css/
│   └── style.css           ← estilos custom, colores GO, overrides
├── js/
│   ├── auth.js             ← lógica de login (hash + sessionStorage)
│   ├── data.js             ← fetch CSVs, parseo con PapaParse, cache en memoria
│   ├── charts.js           ← factory de gráficos Chart.js
│   ├── filters.js          ← lógica de filtros compartida
│   └── sections/
│       ├── home.js         ← Real vs Proyección
│       ├── facturacion.js  ← Facturación
│       ├── produccion.js   ← Producción
│       ├── proyeccion.js   ← Proyección financiera
│       └── sponsors.js     ← Patrocinadores y CROs
├── assets/
│   └── logo-go.png         ← logo Grupo Oroño
└── docs/                   ← documentación (no se publica)
```

---

## Fuente de datos

### Google Sheets

Un único Google Sheet con 3 pestañas, publicado en la web (Archivo → Compartir → Publicar en la web → CSV).

| Pestaña | Filas (actuales) | Columnas clave |
|---|---|---|
| Facturación | 68 | Centro, Protocolo, Visitas, Moneda, Honorarios, Over Head, Total, GO UIC, Fase, IP, Especialidad, Tipo Fact, Fecha Fact, Mes, Año, Cobrado |
| Producción | 839 | Protocolo, Visita, Paciente, Tipo Visita, Asistencia, Cumplimiento Turno, Responsable Cumplimiento, Lugar Turno, Fecha del Turno, Firmante, Patrocinador, CRO, IP, Mes, Año |
| Proyección 10 años | 25 | Indicador (filas), columnas 2026-2035 + Total 10A |

### Flujo de datos

1. Usuario recarga la página
2. `data.js` hace `fetch()` a las 3 URLs CSV del Sheet publicado
3. PapaParse convierte cada CSV a array de objetos JS
4. Los datos se guardan en memoria (variable global o módulo)
5. Cada sección lee de esa cache y aplica sus filtros

### Formato de la hoja Proyección

La hoja Proyección tiene estructura de tabla cruzada (indicadores en filas, años en columnas). Las filas relevantes son:
- Protocolos activos
- Visitas realizadas
- Facturación Total GO UIC
- OH Instituciones GO (13.14%)
- GO ACE UIC (3.33%)
- Total Costos UIC
- EBITDA UIC
- Margen EBITDA / Facturación UIC
- EBITDA UIC acumulado

Para comparar real vs proyección por mes: la proyección es anual, se prorratea /12. Si en el futuro Yamila agrega datos mensuales, se usan esos.

---

## Autenticación

### Login (index.html)

- Pantalla con logo GO, título "GO UIC", campos usuario y contraseña
- Al enviar: se calcula SHA-256 de la contraseña ingresada y se compara con el hash almacenado en `auth.js`
- Si coincide: se guarda un token en `sessionStorage` y se redirige a `dashboard.html`
- Si no: mensaje de error

### Protección (dashboard.html)

- Al cargar, verifica que exista el token en `sessionStorage`
- Si no existe: redirige a `index.html`
- El token se borra al cerrar la pestaña (sessionStorage no persiste entre sesiones de navegador)

### Credenciales iniciales

- Se definen al deployar. El hash se genera offline y se pega en `auth.js`
- Para cambiar la contraseña: se genera un nuevo hash y se actualiza el archivo
- No es seguridad fuerte (el hash está en el código fuente), pero es suficiente para impedir acceso casual desde la URL pública

---

## Branding

### Paleta de colores GO

- **Primario:** Azul institucional GO (#003366 o el que se extraiga del logo — se confirma al recibir el logo)
- **Secundario:** Verde institucional GO (#00874e o el que se extraiga del logo)
- **Fondo:** Gris claro (#f8f9fa)
- **Cards:** Blanco con sombra sutil
- **Texto:** Gris oscuro (#1f2937)
- **Éxito:** Verde (#10b981)
- **Alerta:** Amarillo (#f59e0b)
- **Error:** Rojo (#ef4444)

### Layout

- **Header fijo:** Logo GO a la izquierda, título "GO UIC — Dashboard" al centro, botón cerrar sesión a la derecha
- **Navegación:** Tabs horizontales debajo del header (5 secciones)
- **Contenido:** Ancho máximo 1280px, centrado, padding lateral 16px
- **Responsive:** Se adapta a tablet y móvil (cards apiladas en vertical, tablas con scroll horizontal)
- **Tipografía:** Inter (Google Fonts) o fallback a system-ui

---

## Secciones

### 1. Real vs Proyección (Home)

**Propósito:** Vista inmediata de cumplimiento — ¿vamos bien contra lo proyectado?

**Filtros:**
- Año (select: 2026 a 2035)
- Mes (select: Enero-Diciembre + "Todos" para acumulado anual)

**KPIs (4 cards):**
| KPI | Cálculo | Formato |
|---|---|---|
| Facturado real | SUM(Facturación.Total) filtrado por período | USD #,###  |
| Proyectado | Valor de Proyección para ese año (prorrateado /12 si es mes) | USD #,### |
| Cumplimiento | Facturado / Proyectado × 100 | ##% con semáforo (≥90% verde, 70-89% amarillo, <70% rojo) |
| Desvío | Facturado − Proyectado | USD +#,### o −#,### |

**Gráfico principal:** Barras agrupadas por mes/año
- Barra azul GO = facturación real
- Barra gris semitransparente = proyección
- Eje Y: USD, eje X: meses o años

**Gráfico secundario:** Líneas acumuladas
- Línea azul sólida = real acumulado
- Línea gris punteada = proyección acumulada
- Área sombreada entre ambas muestra el gap

### 2. Facturación

**Propósito:** Detalle de lo facturado, analizable por protocolo e IP.

**Filtros:**
- Período (año + mes)
- Investigador Principal (select: Todos + lista de IPs)
- Protocolo (select: Todos + lista de protocolos)

**KPIs (3 cards):**
| KPI | Cálculo |
|---|---|
| Total facturado | SUM(Total) filtrado |
| Honorarios | SUM(Honorarios) filtrado |
| GO UIC | SUM(GO UIC) filtrado |

**Tabla:**
Protocolo | Fase | IP | Visitas | Honorarios | Over Head | Total USD | Cobrado
- Ordenable por click en header
- Filas con Cobrado vacío o "No" resaltadas en rojo suave
- Fila de totales al final

**Gráficos:**
1. Facturación por IP (barras horizontales)
2. Top 10 protocolos por facturación (barras verticales)
3. Evolución mensual de facturación (línea)

### 3. Producción (Visitas)

**Propósito:** Volumen operativo, cumplimiento, carga por responsable.

**Filtros:**
- Período (año + mes)
- Protocolo (select)
- Investigador Principal (select)

**KPIs (4 cards):**
| KPI | Cálculo |
|---|---|
| Visitas realizadas | COUNT filtrado |
| Pacientes únicos | COUNT DISTINCT(Paciente) |
| Tasa de cumplimiento | COUNT(Cumplimiento Turno = "Sí") / COUNT total × 100 |
| Visitas/mes promedio | Total visitas / cantidad de meses en el período |

**Tabla:**
Protocolo | Visita | Paciente | Tipo Visita | Asistencia | Lugar Turno | Fecha | IP
- Paginada (20 filas por página)
- Búsqueda de texto libre
- Ordenable

**Gráficos:**
1. Visitas por mes (barras)
2. Distribución por tipo de atención (donut: consultorio, teléfono, otros)
3. Visitas por responsable (barras horizontales, top 10)
4. Visitas por firmante (barras horizontales, top 10)

### 4. Proyección financiera

**Propósito:** Modelo a 10 años en detalle para presentaciones a dirección.

**Filtro:**
- Rango de años (selectores: desde / hasta, default 2026-2035)

**KPIs (4 cards):**
| KPI | Cálculo |
|---|---|
| Facturación total | SUM Facturación Total GO UIC del rango |
| EBITDA UIC acumulado | Último valor de EBITDA UIC acumulado en el rango |
| Protocolos proyectados | Valor de Protocolos activos del último año del rango |
| Margen EBITDA | Rango: desde primer año hasta último año del rango |

**Gráficos:**
1. Ingresos vs Costos (barras apiladas por año): OH Instituciones + GO ACE UIC + Costos operativos + EBITDA
2. EBITDA y Margen (combo barras + línea): barras = EBITDA USD, línea = margen %
3. Crecimiento de protocolos (línea): 25 → 114

**Tabla:**
Año | Protocolos | Visitas | Facturación | OH GO | Costos UIC | EBITDA | Margen %
- Fila de totales o acumulado al final
- Números en USD con separadores de miles

### 5. Patrocinadores y CROs

**Propósito:** Vista comercial por sponsor y CRO.

**Filtros:**
- Período (año + mes)
- Patrocinador (select)
- CRO (select)

**Layout dividido en dos columnas:**

**Columna izquierda — Patrocinadores:**
- Gráfico: Facturación por sponsor (barras horizontales)
- Gráfico: Visitas por sponsor (barras horizontales)
- Tabla: Patrocinador | Protocolos activos | Visitas | Facturación USD

**Columna derecha — CROs:**
- Gráfico: Protocolos por CRO (donut)
- Gráfico: Visitas por CRO (barras)
- Tabla: CRO | Protocolos | Patrocinadores asociados | Visitas | Facturación USD

**Join de datos:** Se cruzan Facturación y Producción por nombre de Protocolo. Patrocinador y CRO vienen de Producción; montos de Facturación.

---

## Comportamiento general

### Carga inicial
1. Mostrar spinner con logo GO mientras se bajan los 3 CSVs
2. Si falla un fetch: mostrar mensaje "No se pudieron cargar los datos. Verificá tu conexión." con botón reintentar
3. Una vez cargados los 3, renderizar la sección Home

### Filtros
- Cada sección tiene sus filtros independientes
- Al cambiar un filtro: se re-calculan KPIs y se re-renderizan gráficos y tablas
- Estado de filtros no persiste entre secciones ni recargas

### Gráficos
- Paleta de colores: azul GO como primario, variaciones de intensidad para series múltiples
- Tooltips al pasar el mouse: muestran valor exacto formateado
- Animación suave al cargar o cambiar datos
- Responsive: se ajustan al ancho del contenedor

### Tablas
- Header sticky
- Sorting visual: flecha arriba/abajo en la columna activa
- Tablas grandes (>20 filas): paginación
- Números formateados: USD con separadores de miles, porcentajes con 1 decimal

---

## Limitaciones conocidas

- **Login no es seguro criptográficamente** — el hash está en el código fuente. Es suficiente para impedir acceso casual pero no resiste inspección del código. Aceptable para el caso de uso.
- **Proyección mensual es estimada** — se prorratea la anual /12. Si la UIC tiene estacionalidad, esto podría no reflejarla.
- **Datos dependen de Google Sheets** — si Google cambia la API de publicación CSV o el Sheet se despublica, el dashboard deja de mostrar datos.
- **Sin caché offline** — requiere conexión a internet para cargar datos.
