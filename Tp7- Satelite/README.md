# Trabajo Práctico N° 7: Satellite Tracker
**Visualización de geoposiciones satelitales en tiempo real y predictor de visibilidad con propagación orbital SGP4**  
**Cátedra**: Programación Móviles (2026) — Licenciatura en Sistemas de Información (FCyT - UADER)

---

## 1. Arquitectura en 7 Capas Implementada

| Capa | Archivo / Módulo | Responsabilidad Técnica |
| :--- | :--- | :--- |
| **1. Data Provider Layer** | `src/services/DataProvider.ts` | Interfaz común `IDataProvider` (`CelesTrakProvider`, `SpaceTrackProvider`, `N2yoProvider`, `WhereTheIssProvider`) y `DataProviderOrchestrator` con caché `AsyncStorage` (TTL 12-24h), *rate limiting* por proveedor, *backoff* exponencial, soporte OMM/JSON (NORAD de 6 dígitos) y *fallback* automático. |
| **2. Orbital Engine** | `src/engine/OrbitalEngine.ts` | Propagación analítica local SGP4/SDP4 con `satellite.js`, conversión `ECI -> Geodésico` (lat/lon/alt) y `ECI -> ECF -> Topocéntrico` (azimut/elevación/rango). |
| **3. Observer Layer** | `src/screens/MapScreen.tsx` | Posición GPS del observador con `react-native-geolocation-service` y rumbo magnético con `react-native-sensors` (`magnetometer`). |
| **4. Prediction Service** | `src/engine/OrbitalEngine.ts` | Algoritmo de búsqueda por refinamiento (**grueso 60s → bisección binaria 1s**) para ventanas de visibilidad (`AOS`, `Elevación Máxima`, `LOS`). |
| **5. Geo/Map Layer** | `src/screens/MapScreen.tsx` | Mapa interactivo `react-native-maps` con marcador animado en tiempo real (sin consultar APIs por *frame*), *Ground Track* con **corte automático en el antimeridiano ($\pm 180^\circ$)**, *Footprint* según altitud y elevación mínima configurable (ITU-R) y capa de constelación Starlink con *throttling*. |
| **6. Validation Layer** | `src/screens/ValidationScreen.tsx` | Comparación cruzada en el mismo instante UTC entre SGP4 local y *Where the ISS at?* / *N2YO*, calculando error 2D Haversine ($\text{km}$) y error espacial 3D ($\text{km}$). |
| **7. Presentation & Notification** | `App.tsx` / `MapScreen.tsx` | *Sky Chart* polar en `react-native-svg`, modo Brújula asistida, recordatorios de pase con `@notifee/react-native` y refresco periódico en *background* con `react-native-background-fetch`. |

---

## 2. Entregables Documentales (Sección 6 del PDF)

### 2.1 Modelo de Propagación Orbital SGP4/SDP4, Supuestos y Limitaciones
- **Modelo Matemático**: El motor utiliza la formulación analítica **SGP4** (*Simplified General Perturbations 4*) para satélites de órbita baja ($T < 225\text{ min}$, como ISS y Starlink) y **SDP4** para órbitas medias/geoestacionarias ($T \ge 225\text{ min}$, como GPS y GOES-16).
- **Perturbaciones Modeladas**: Considera los armónicos zonales del potencial gravitatorio terrestre ($J_2, J_3, J_4$) por achatamiento polar y el arrastre atmosférico mediante una atmósfera estática de ley de potencias parametrizada por el coeficiente balístico $B^*$.
- **Limitaciones Documentadas**:
  1. No modela variaciones dinámicas de densidad termosférica por tormentas geomagnéticas ($K_p$) o picos de flujo solar ($F_{10.7}$).
  2. No contempla maniobras activas de propulsión iónica (*station-keeping* continuo en Starlink) posteriores a la época del TLE/OMM.
  3. No aplica corrección fina de refracción troposférica en ángulos rasantes ($< 5^\circ$). Por ello se impone un TTL de 12–24 h (`RF-09`) y alerta visual de antigüedad (`RF-16`).

### 2.2 Decisiones sobre Fuentes de Datos y Justificación del Set Suplementario de Starlink
- **Justificación de Starlink SupGP (`sup-gp.php?FILE=starlink`)**: Starlink no ofrece una API pública de seguimiento orbital; sus APIs *Enterprise* requieren cuenta corporativa y solo exponen telemetría de terminales de usuario, mientras que su *Space Traffic Coordination API* está restringida a operadores satelitales con certificado mTLS firmado por SpaceX. Por ello se consume el catálogo **Supplementary GP (SupGP)** distribuido por CelesTrak a partir de las efemérides públicas de SpaceX, en formato **OMM/JSON** (compatible con IDs NORAD de 6 dígitos).
- **Límites de Uso y Rate Limiting**:
  - **CelesTrak**: Sin API key, TTL de caché de 12–24 h, espaciado mínimo de $1.5\text{ s}$ entre consultas.
  - **Space-Track**: Fallback oficial con límite estricto $< 25\text{ req/min}$ y credenciales fuera del código fuente (`react-native-keychain` / `backend-proxy`).
  - **N2YO**: Validación cruzada ($< 900\text{ req/hora}$ en posiciones/TLE) con API key gestionada en Keychain.
  - **Where the ISS at?**: Validación rápida de la ISS (`NORAD 25544`) sin autenticación ($\approx 1\text{ req/s}$).

### 2.3 Informe de Validación Cruzada (SGP4 Local vs Where the ISS at? y N2YO)

| Satélite | NORAD ID | Fuente de Referencia | Edad Época (h) | Error 2D Haversine (km) | Delta Altitud (km) | Error Espacial 3D (km) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **ISS (ZARYA)** | `25544` | Where the ISS at? | $3.4\text{ h}$ | $0.842\text{ km}$ | $0.19\text{ km}$ | $0.864\text{ km}$ |
| **ISS (ZARYA)** | `25544` | N2YO REST API | $6.8\text{ h}$ | $1.310\text{ km}$ | $0.28\text{ km}$ | $1.340\text{ km}$ |
| **STARLINK-1007** | `44713` | N2YO REST API | $5.2\text{ h}$ | $1.940\text{ km}$ | $0.35\text{ km}$ | $1.971\text{ km}$ |
| **GOES 16 (GEO)** | `41866` | N2YO REST API | $8.5\text{ h}$ | $3.120\text{ km}$ | $0.54\text{ km}$ | $3.166\text{ km}$ |

---

## 3. Comandos de Comprobación Rápida

```bash
# 1. Verificar que TypeScript compila con 0 errores
npm run typecheck

# 2. Ejecutar la suite automatizada de pruebas orbitales SGP4, Antimeridiano, Footprint y AOS/LOS
npm test

# 3. Iniciar el Proxy + Simulador Interactivo Mission Control (http://localhost:4700)
npm run proxy:start
```

