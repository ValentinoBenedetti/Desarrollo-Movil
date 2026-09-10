# TP3 - iBank: Flujo de Login Completo x Supabase

Este proyecto implementa el flujo completo de autenticación para la aplicación iBank utilizando React Native, Expo Router y Supabase Auth, cumpliendo estrictamente con las reglas de negocio y los diseños de Figma provistos en la consigna.

## Requisitos de Instalación

1. Asegurate de tener Node.js instalado.
2. Cloná este repositorio.
3. Abrí la carpeta `Tp3-ibank` en tu terminal.
4. Ejecutá el siguiente comando para instalar las dependencias:

```bash
npm install
```

## Variables de Entorno

Para que el proyecto se comunique con Supabase, necesitás crear un archivo `.env` en la raíz de la carpeta `Tp3-ibank` con las siguientes variables:

```env
EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase (ej: https://xxx.supabase.co)
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

*(Nota: no incluyas `/rest/v1/` en la URL de Supabase).*

## Cómo Correr el Proyecto

Para iniciar el servidor de desarrollo de Expo, limpiando el caché por seguridad:

```bash
npx expo start -c
```
Luego podés escanear el código QR con la app **Expo Go** en tu celular (o presionar `a` para Android Emulator, `i` para iOS Simulator).

---

## Decisiones de Diseño y Adaptaciones (Figma)

*   **Implementación Visual:** Se construyó un contenedor reutilizable (`AuthContainer.tsx`) para replicar el esquema de colores azul oscuro en la cabecera y la tarjeta superpuesta blanca en la parte inferior, manteniendo la fidelidad visual de los mockups.
*   **Iconografía:** Para garantizar la mayor fidelidad y escalabilidad en dispositivos móviles, las ilustraciones centrales y la iconografía fueron implementadas utilizando vectores nativos a través de la librería `@expo/vector-icons`, asegurando un renderizado nítido en cualquier resolución.
*   **Adaptación de "Olvidé mi contraseña":** El diseño original de Figma muestra un campo para ingresar un número de teléfono. Sin embargo, para cumplir estrictamente con la regla de negocio 6.4 del PDF (recuperación por correo), se reemplazó por un campo de **Email** para consumir la API `resetPasswordForEmail`.
*   **Adaptación de "Registro":** Se agregó el campo *Confirm Password* en el formulario de registro para satisfacer la regla de validación de cliente especificada en el PDF, aunque no figuraba explícitamente en ese frame del mockup.
*   **Pantalla de Home y Entorno de Simulación:** Dado que en el entorno de desarrollo (con Expo Go) los deep links desde un cliente de correo pueden presentar trabas para redirigir de vuelta a la app, se diseñó e implementó un "Home" con estética de banco. Allí se incluye un botón para **"Simular Recuperación"** que navega forzadamente a la pantalla de **Nueva Contraseña**; de este modo, se puede demostrar y evaluar la validación e interfaz de la última pantalla sin depender de la correcta redirección del correo.
*   **Fuera de alcance:** Quedaron excluidos el login social, la verificación por OTP como segundo factor, y la autenticación biométrica local, de acuerdo al alcance obligatorio definido en el TP.

---

## Configuración de Supabase (Dashboard)

Para que la aplicación funcione correctamente, el proyecto en Supabase fue configurado de la siguiente manera, siguiendo las recomendaciones de seguridad (Sección 8):

*   **Longitud y complejidad de contraseña:** Se configuró una longitud mínima de 8 caracteres. La UI fuerza a que se incluya una mayúscula, una minúscula, un dígito y un símbolo.
*   **Confirm Email:** Se mantuvo habilitado para el flujo de producción (o desactivado temporalmente para pruebas ágiles locales, según requerimiento de revisión).
*   **Rate Limits:** Supabase maneja por defecto el cooldown de 60 segundos por usuario y la limitación del servidor SMTP gratuito (2 emails por hora). La UI implementa temporalizadores visuales de 60 segundos para evitar golpear la API innecesariamente ante un código HTTP 429.
*   **Redirect URLs (URL Configuration):** 
    *   Se agregó el scheme de desarrollo de Expo (`exp://*`) para probar los deep links localmente con Expo Go.
    *   Se agregó el scheme de producción (`ibanktp://*`) configurado en el `app.json`.
*   **Seguridad de Claves:** Solamente la `anon key` vive en el entorno del cliente. La `service_role` key está estrictamente excluida del proyecto.

---

*Proyecto desarrollado para la materia Arq. Programación Móvil - Licenciatura en Sistemas de Información, FCyT (2026).*
