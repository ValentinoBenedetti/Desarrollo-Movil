# AgroPulse - Agricultura de Precisión

Este repositorio contiene la entrega del **Trabajo Práctico 4 (AgroPulse)**. Implementa una arquitectura Event-Driven para IoT (Kafka/Redpanda) conectada a un backend de Supabase con una aplicación móvil React Native (Expo) que consume los datos por Realtime y envía comandos con soporte offline-first.

## Arquitectura
El monorepo está dividido en:
- `/apps/agropulse`: Aplicación Móvil en React Native (Expo Router, TypeScript).
- `/supabase`: Configuración de base de datos PostgreSQL, esquemas, políticas RLS y Realtime.
- `/infra`: Contenedor Docker para Redpanda (Broker Kafka) y un `worker` Node.js que simula los sensores IoT y procesa asíncronamente los comandos de riego.

## Credenciales de Prueba
El archivo `seed.sql` genera los siguientes usuarios de prueba (la contraseña para todos es `123456`):
- **Productor**: `productor@agropulse.test` (Rol: `producer` - Control total).
- **Operador**: `operador@agropulse.test` (Rol: `operator` - Control total).
- **Asesor**: `asesor@agropulse.test` (Rol: `advisor` - Solo lectura).
- **Externo**: `externo@otro.test` (Rol: `producer` en otra organización, usado para probar aislamiento RLS).

## Guía de Reproducción (Paso a Paso)

### 1. Iniciar Base de Datos (Supabase)
Requiere [Docker](https://docs.docker.com/get-docker/) y [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) instalados.
```bash
# En la raíz del proyecto
npx supabase start
```
*Al terminar, la consola mostrará tu `API URL` y tu `service_role key`. Anotalos.*

### 2. Iniciar Infraestructura de Eventos y Simulador IoT
Requiere Docker Compose.
```bash
# Entrar a la carpeta infra
cd infra

# Crear archivo .env usando la plantilla
cp .env.example .env
```
Edita el `.env` y coloca la `SUPABASE_URL` y la `SUPABASE_SERVICE_ROLE_KEY` obtenidas en el paso 1.

```bash
# Levantar Redpanda y el Worker Simulador
docker-compose up -d
```
*Puedes ver los logs en vivo con `docker-compose logs -f worker-simulator` para observar cómo los ticks de humedad ingresan a Kafka.*

### 3. Iniciar Aplicación Móvil
Requiere Node.js y Expo CLI.
```bash
# Entrar a la carpeta de la app
cd apps/agropulse

# Instalar dependencias
npm install

# Crear configuración de entorno
cp .env.example .env
```
Edita el `.env` con la `EXPO_PUBLIC_SUPABASE_URL` (la misma del paso 1, pero usa tu IP local ej: `http://192.168.1.5:54321` si pruebas en dispositivo físico) y la `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

```bash
# Arrancar el empaquetador de Expo
npx expo start
```
*Escanea el código QR con Expo Go en tu celular o presiona `a` para emulador de Android.*

## Tests Unitarios
Para correr la suite de tests (lógica del semáforo y deduplicación offline):
```bash
cd apps/agropulse
npm test
```
