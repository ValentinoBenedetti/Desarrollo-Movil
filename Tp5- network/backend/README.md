# QoS Reference Backend

Backend de referencia para el test de throughput y sondas RTT del proyecto **01 Network QoS Monitor**.

## Características
- **HTTP (Puerto 3000)**:
  - `GET /health`: Healthcheck básico y timestamp del servidor.
  - `GET /ping`: Ping liviano HTTP sin cache.
  - `GET /download?mb=5`: Generación y streaming de payloads binarios de tamaño exacto con control de contrapresión (backpressure) para test de throughput de bajada.
  - `POST /upload`: Consumo directo del stream entrante para medir throughput de subida sin saturación de memoria.
- **TCP Socket (Puerto 3001)**:
  - Servidor de echo TCP de baja latencia para sondas RTT directas y cálculo de Jitter según RFC 3550 desde `react-native-tcp-socket`.

## Ejecución con Docker

```bash
docker compose up -d --build
```

## Ejecución local con Node

```bash
npm install
npm run dev
```
