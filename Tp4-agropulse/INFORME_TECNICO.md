# Informe Técnico: AgroPulse
**Trabajo Práctico 4 - Agricultura de Precisión**

## 1. Arquitectura del Sistema
El sistema AgroPulse está diseñado con una arquitectura **Event-Driven (CQRS-ish)** para manejar de manera eficiente y escalable la ingesta masiva de datos provenientes de miles de estaciones meteorológicas y dispositivos IoT. 

### Componentes Principales
- **Kafka / Redpanda**: Actúa como el bus de eventos principal (`soil.moisture`, `weather.tick`, `irrigation.commands`, `valve.status`). Garantiza persistencia, orden y absorbe los picos de tráfico (backpressure).
- **Worker / Simulador (Node.js)**: 
  - *Simulador*: Inyecta lecturas ficticias cada 5 segundos para emular el hardware IoT.
  - *Consumidor*: Lee los eventos de Kafka, los valida y los consolida en la base de datos PostgreSQL. También procesa de manera asíncrona los comandos de riego (esperando entre 2 y 3 segundos para simular latencia de hardware).
- **Supabase (PostgreSQL + PostgREST + Realtime + GoTrue)**: Centraliza el estado del sistema. Utiliza Row Level Security (RLS) para proteger los datos a nivel de base de datos sin necesidad de un backend intermediario.
- **Aplicación Móvil (React Native + Expo)**: Cliente Frontend que consume directamente la base de datos a través de la API de Supabase, suscribiéndose por Realtime para observar cambios en vivo (ej. humedad actual o estado de la válvula).

### ¿Por qué el móvil NO se conecta a Kafka directamente?
1. **Red Móvil**: Las conexiones de red celular son inestables, intermitentes y sufren cambios frecuentes de IP/Antenas. Kafka utiliza conexiones persistentes TCP que no toleran bien estas caídas, a diferencia de WebSockets/HTTP con reconexión automática (Realtime).
2. **Autenticación y RLS**: Kafka carece de mecanismos granulares para filtrar qué evento puede ver cada usuario ("¿Pertenece este lote a mi organización?"). Supabase resuelve esto nativamente a nivel de fila (RLS) basado en el token JWT.
3. **Backpressure**: Si el cliente se conecta directo a Kafka, los picos de mensajes pueden sobrecargar los limitados recursos de CPU y RAM del dispositivo móvil.
4. **Esquema de Datos**: Kafka almacena eventos brutos. El móvil generalmente necesita el estado actual consolidado (ej. "dame la *última* lectura"), lo cual requiere consultas complejas o agregaciones que las bases de datos relacionales manejan perfectamente.

## 2. Políticas de Seguridad (RLS)
La base de datos asume que todo cliente es inherentemente inseguro. Se definieron las siguientes políticas RLS:
- **Organizaciones y Relaciones**: Un usuario solo puede hacer `SELECT` de datos (`plots`, `stations`, `readings`, `valves`, `commands`) que pertenezcan a las organizaciones en las cuales figura en la tabla `memberships`.
- **Rol Asesor (`advisor`)**: Tiene restringidos globalmente los permisos de `INSERT` y `UPDATE` (políticas de tipo *read-only*).
- **Roles Productor y Operador (`producer`, `operator`)**: Pueden actualizar umbrales de lotes (`plots`) y enviar comandos de riego (`irrigation_commands`).
- **Ingesta IoT (`service_role`)**: El Worker utiliza una llave con privilegios escalados (`service_role key`) que le permite evadir las políticas RLS y escribir los eventos provenientes de los sensores marcados como `source = 'sensor'`. Los usuarios móviles solo pueden insertar lecturas con `source = 'manual'`.

## 3. Flujos de Uso (Historias)

### H1: Lote Seco y Notificación en Tiempo Real
1. Ingresa a la app con el usuario `productor@agropulse.test` (pass: `123456`).
2. En la pestaña de Mapa o Lotes, observarás el lote **Costa 2** en color rojo (Seco), ya que el umbral es 25-45% y su humedad ronda el 18%.
3. Al entrar al detalle, una alerta agronómica sugiere considerar el riego.

### H2: Apertura de Válvula con Latencia y Feedback Asíncrono
1. Dentro de Costa 2, presiona **"Abrir Válvula"**.
2. Se generará un comando con estado `pending`. Supabase Realtime notificará esto en vivo. La interfaz bloqueará el botón.
3. El Worker (por polling o Kafka) toma el comando, espera ~2.5 segundos para emular la latencia y lo pasa a estado `applied` (abriendo la válvula).
4. Automáticamente la humedad de Costa 2 comenzará a subir paulatinamente (cada 5s) gracias a la simulación. En pocos segundos el semáforo pasará a Verde (Óptimo) o Azul (Húmedo).

### H3: Carga de Humedad Offline con Idempotencia
1. Corta la conexión a internet de la computadora/emulador (o utiliza el switch de "Forzar Offline" en la app).
2. Entra a **Costa 1** y envía una lectura manual. Se encolará localmente (AsyncStorage) con un `client_request_id` (UUID).
3. Restaura la conexión. La app enviará automáticamente las lecturas pendientes. La base de datos aceptará el insert, y si hubiera un fallo de red durante el ack, los reintentos posteriores serán ignorados por la restricción `UNIQUE` en la columna `client_request_id`.

### H4: Lote "Stale" (Sensor Caído)
1. El simulador está configurado para no enviar ticks actualizados al lote **Monte A**.
2. Al iniciar la app, Monte A aparecerá en gris con el texto "Sin datos", dado que su última lectura registrada (en la semilla) tiene una antigüedad mayor a 15 minutos.
3. El Worker genera un registro en la tabla `alerts` de tipo `stale` para notificar al operador.
