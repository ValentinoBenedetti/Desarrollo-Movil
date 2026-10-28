# 01 Network QoS Monitor

**Analizador y visualizador de calidad de red móvil en tiempo real con mapeo de cobertura personal**  
*Licenciatura en Sistemas de Información — Desarrollo de Aplicaciones Móviles (2026)*  
*Facultad de Ciencia y Tecnología (FCyT)*

---

## 1. Arquitectura del Sistema

La solución implementa una **arquitectura por capas desacoplada** para garantizar que los cálculos matemáticos, sondeos sobre sockets y tareas de segundo plano no bloqueen el hilo de JavaScript (evitando caídas de frames en la UI):

```
┌────────────────────────────────────────────────────────┐
│           Presentation Layer (React Native UI)         │
│  Dashboard | Heatmap Map | Time-Series Charts | Export │
└───────────────────────────┬────────────────────────────┘
                            │ Zustand Reactive Store
┌───────────────────────────▼────────────────────────────┐
│                   Measurement Engine                   │
│   TCP Handshake/Echo RTT • Jitter (RFC 3550) • Mbps    │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
┌─────────────▼───────────────┐ ┌──────────▼─────────────┐
│        Native Bridge        │ │     Geo & Persistence   │
│  Kotlin: TelephonyManager   │ │  GPS Geolocation       │
│  Swift: CoreTelephony       │ │  SQLite Database       │
│  (RSSI/RSRP, Carrier, Gen)  │ │  CSV/JSON Exporter     │
└─────────────────────────────┘ └────────────────────────┘
```

---

## 2. Decisiones de Diseño y Protocolos Técnicos

1. **Sondas TCP de Latencia (RF-02)**:
   * Implementadas sobre `react-native-tcp-socket` para medir RTT real sobre la capa de transporte TCP (SYN/ACK).
   * **Jitter**: Calculado según la norma **RFC 3550** a partir de la fluctuación de retardos entre muestras consecutivas:
     $$D(i, j) = |(R_j - S_j) - (R_i - S_i)|$$
   * Soporta sondeo contra múltiples hosts configurables (`Google DNS 8.8.8.8:53`, `Cloudflare 1.1.1.1:53` y el `Backend QoS Local :3001`).

2. **Test de Throughput (RF-03)**:
   * El backend propio expone `/download` y `/upload` en Node.js optimizado con control de backpressure y sin sobrecarga del Garbage Collector.
   * La app mide tiempo de transferencia con temporizadores de alta precisión y calcula tasa en Mbps:
     $$\text{Throughput (Mbps)} = \frac{\text{Bytes} \times 8}{\text{Segundos} \times 1\,000\,000}$$

3. **Telemetría Celular Nativa (RF-01)**:
   * **Android (Kotlin)**: `CellularInfoModule` accede a `TelephonyManager`, inspecciona `CellInfoLte` / `CellInfoNr` (5G) para extraer nivel de potencia en **dBm** (RSSI/RSRP) y el nivel normalizado (0 a 4).
   * **iOS (Swift)**: `CellularInfoModule` mapea `CTTelephonyNetworkInfo` y `serviceCurrentRadioAccessTechnology`.

4. **Mapa de Cobertura y Heatmap (RF-05)**:
   * Soporta tanto el Heatmap ponderado de `react-native-maps` como círculos georreferenciados con gradiente de color (Verde $\ge -85\text{ dBm}$, Amarillo $-86 \dots -105\text{ dBm}$, Rojo $\le -106\text{ dBm}$).

5. **Segundo Plano y Notificaciones (RF-07)**:
   * Muestreo desatendido con `react-native-background-fetch` con la app cerrada.
   * Alertas locales automáticas con `@notifee/react-native` ante degradación severa (pérdida de paquetes $\ge 20\%$, RTT $> 300\text{ ms}$, jitter inestable o señal crítica).

6. **Persistencia y Exportación (RF-04, RF-08, RF-09)**:
   * Base de datos local SQLite con índices compuestos (`timestamp`, `connection_type`, `generation`).
   * Exportación instantánea a CSV (RFC 4180) y JSON con integración nativa al share sheet.

---

## 3. Estructura del Repositorio

```
Tp5- network/
├── backend/
│   ├── src/
│   │   └── server.js            # Servidor HTTP (Throughput) y TCP Echo (Ping)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
└── mobile/
    ├── android/
    │   └── app/src/main/java/com/networkqosmonitor/
    │       ├── CellularInfoModule.kt     # Native Module Kotlin (TelephonyManager)
    │       ├── CellularInfoPackage.kt    # ReactPackage registration
    │       └── MainApplication.kt
    ├── ios/
    │   └── NetworkQoSMonitor/
    │       ├── CellularInfoModule.swift  # Native Module Swift (CoreTelephony)
    │       └── CellularInfoModule.m      # Obj-C Bridge
    ├── src/
    │   ├── core/
    │   │   ├── types/network.ts          # Modelos de datos QoS
    │   │   └── store/useNetworkStore.ts  # Estado reactivo Zustand
    │   ├── services/
    │   │   ├── background/               # BackgroundFetch task
    │   │   ├── database/                 # SQLite storage & queries
    │   │   ├── export/                   # Exportador CSV/JSON y Share
    │   │   ├── geo/                      # GPS Geolocation service
    │   │   ├── measurement/              # TCP Ping, Throughput & Orchestrator
    │   │   ├── native/                   # Wrapper TypeScript de telefonía
    │   │   ├── network/                  # NetInfo event listener
    │   │   └── notifications/            # Notifee alerts
    │   ├── ui/
    │   │   ├── components/               # MetricCard, SignalGauge, TimeSeriesChart, HeatmapMap
    │   │   ├── screens/                  # Dashboard, Map, Analytics, Export
    │   │   └── theme.ts                  # Dark mode design system tokens
    │   └── utils/permissions.ts          # Permisos Android en tiempo de ejecución
    └── App.tsx                           # Punto de entrada y Tab Navigation
```

---

## 4. Instrucciones de Despliegue y Ejecución

### 4.1 Backend de Referencia
```bash
cd backend
docker compose up -d
# O directamente con Node:
npm install
npm run dev
```
* HTTP Throughput: `http://localhost:3000` (o `http://10.0.2.2:3000` desde el emulador Android).
* TCP Echo Server: `localhost:3001`.

### 4.2 Aplicación Móvil
```bash
cd mobile

# Android
npx react-native run-android

# iOS (macOS)
cd ios && pod install && cd ..
npx react-native run-ios
```
