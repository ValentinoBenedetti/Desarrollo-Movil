# Guía de Estudio y Resumen Técnico: TP2 - Flujo Checkout Tienda

## 1. Resumen de la Arquitectura
El proyecto fue construido utilizando **React Native con Expo**. Para asegurar un código limpio, mantenible y escalable, implementamos una separación clara de responsabilidades (Separation of Concerns).

La estructura principal es:
- **`App.tsx`**: Funciona como el punto de entrada. Aquí configuramos el enrutador (`NavigationContainer`), los proveedores de contexto global (`CartProvider` y `PaymentProvider`) y la jerarquía de navegación (Stack Navigator para la tienda, manteniendo el Bottom Tab Navigator del TP1).
- **`src/context/`**: Contiene la capa de datos y estado global (`CartContext.tsx` y `PaymentContext.tsx`). Aquí reside toda la **lógica de negocio** pura, completamente aislada de la interfaz gráfica.
- **`src/components/`**: Componentes visuales reutilizables. Destaca `CartItem.tsx`, que renderiza cada producto y emite acciones (como borrar o cambiar talle) hacia el contexto.
- **`src/screens/`**: Vistas de pantalla completa. `ShoppingCartScreen.tsx` (Carrito) y `SecurePaymentScreen.tsx` (Formulario de pago). Estas vistas simplemente leen los datos del contexto y los dibujan.

## 2. Librerías y Dependencias Utilizadas
- **`@react-navigation/native` & `@react-navigation/native-stack`**: Elegidas para manejar el enrutamiento. Stack Navigator es la opción ideal para flujos de "checkout" donde el usuario avanza de un paso a otro secuencialmente (Carrito -> Pago) con posibilidad de volver atrás mediante la pila de navegación.
- **`@expo/vector-icons`**: Provee acceso inmediato a miles de iconos (Ionicons, FontAwesome) sin necesidad de configuraciones nativas complejas. Lo usamos para los logos de Visa, MasterCard, botones de navegación y tachos de basura.
- **`React Context API` (Nativo de React)**: Elegido en lugar de librerías externas como Redux o Zustand debido al tamaño del proyecto. Permite evitar el "prop drilling" (pasar propiedades por muchos niveles) inyectando el estado global directamente a las pantallas que lo necesitan.

## 3. Lógica de Negocio (Paso a Paso)

### Selección de Color, Size y Qty
Toda esta lógica vive en `CartContext.tsx`. 
- **Color y Size**: Cuando el usuario toca estas opciones en `CartItem.tsx`, se abre un **Modal** nativo (Bottom Sheet). Al seleccionar una opción, el componente dispara `updateColor` o `updateSize` pasando el ID del producto. El Context hace un `.map()` sobre el arreglo de ítems, encuentra el producto y devuelve un nuevo objeto con el color/talle modificado, forzando un re-render de React.
- **Quantity (Qty)**: La función `updateQuantity` recibe un delta (+1 o -1). En el Context, se calcula la nueva cantidad usando `Math.max(1, cantidadActual + delta)` para asegurar matemáticamente que la cantidad nunca sea menor a 1.

### Eliminación de Productos
El componente visual pregunta explícitamente usando un `Alert.alert` nativo cuando el usuario presiona el tacho de basura (que solo aparece cuando la cantidad es 1). Si el usuario confirma, se ejecuta `removeItem(id)`. 
El Context usa el método `.filter()` de JavaScript para retornar un arreglo nuevo que excluye al producto con ese ID, eliminándolo automáticamente de la vista y recalculando el total general instantáneamente.

### Selección y Validación de Tarjeta (Secure Payment)
En `PaymentContext.tsx` tenemos un estado con los datos (Nombre, Número, Fecha, CVV y Tipo).
- El selector visual es simplemente un grupo de botones (`TouchableOpacity`). Al tocar "Visa" o "MasterCard", se actualiza la propiedad `cardType` en el contexto.
- **Validación robusta**: Se implementó la lógica estricta para evitar inconsistencias. Al escribir la fecha (MM/YY), se intercepta el texto. Se extrae el mes, y si es mayor a 12 o menor a 1, se avisa del error. Para el año se exige que sea al menos 26.
- El botón de "Pay Now" queda deshabilitado (`disabled={true}`) si la variable derivada `isValid` arroja `false`.

## 4. Traducción de Figma a Código
Para lograr una réplica exacta (Pixel-Perfect) y responsiva:
- **Flexbox**: Fue la herramienta principal. Usamos `flexDirection: 'row'` para alinear elementos horizontalmente (como las opciones de talle o el carrusel inferior) y `justifyContent: 'space-between'` para empujar textos a los extremos (ej: Total y Precio).
- **Carrusel (FlatList Horizontal)**: Para la lista inferior de productos en la pantalla de pago, configuramos un `FlatList` con la prop `horizontal={true}`. Le dimos a las tarjetas un ancho fijo de `300px` usando `snapToInterval` para que el scroll frene de a una tarjeta por vez, dejando que asome un fragmento de la siguiente tarjeta.
- **Shadows y Bordes**: Se imitaron las tarjetas del diseño usando `backgroundColor: '#FFF'` (blanco), un `borderRadius` pronunciado, y propiedades de sombra (`shadowOpacity`, `elevation`) muy sutiles para darle profundidad premium.

---

## 5. Simulación de Coloquio (Q&A de Nivel Avanzado)

**Pregunta 1: ¿Por qué usaste Context API en lugar de simplemente pasar props de `App` a las pantallas?**
*Respuesta:* Para evitar el "prop drilling". Como el carrito y el total necesitan ser mostrados tanto en `ShoppingCartScreen` como en `SecurePaymentScreen`, si usara props, tendría que definir el estado en el componente padre (`App.tsx`) y pasarlo pantalla por pantalla a través del Navigator. Con Context API, extraigo toda esa lógica a un proveedor externo, dejando que las pantallas se suscriban solo a los datos que necesitan, haciendo el código más limpio y modular.

**Pregunta 2: Explicame exactamente cómo asegurás que el componente React se actualice cuando modificás la cantidad de un producto.**
*Respuesta:* En React, el estado es inmutable. Si yo hiciera `item.quantity = 2`, React no se daría cuenta del cambio. Por eso, en la función `updateQuantity` utilizo el hook setter (`setItems`) pasándole el estado previo. Uso un `.map()` para recorrer el arreglo, y cuando encuentro el ID modificado, uso el *spread operator* (`...item`) para clonar el objeto y pisar la cantidad vieja con la nueva. Al entregarle una referencia de memoria completamente nueva a React, este detecta el cambio y dispara el ciclo de renderizado.

**Pregunta 3: En el formulario de pago limitaste la longitud de los inputs. ¿Por qué el botón "Pay Now" no depende solo de la longitud del campo?**
*Respuesta:* Porque la longitud es una validación superficial. Que el usuario haya puesto 5 caracteres en la fecha (MM/YY) no garantiza que la fecha sea lógica (ej. podría escribir 99/99). En `PaymentContext`, creé una variable derivada `isValid` que parsea matemáticamente los strings. Verifica específicamente que el mes (MM) no sea mayor a 12, y que el año (YY) no sea menor a 26, bloqueando el botón si es inválido, protegiendo así la integridad de los datos antes de enviarlos a un hipotético backend.

**Pregunta 4: Veo que pusiste un `FlatList` horizontal dentro del ScrollView principal en SecurePayment. ¿Eso no causa problemas de rendimiento o de gestos cruzados?**
*Respuesta:* Anidar un ScrollView vertical (la pantalla) con un FlatList horizontal (el carrusel) está perfectamente soportado por React Native, ya que los ejes de desplazamiento (vertical vs horizontal) son ortogonales y no generan conflictos de gestos. Sin embargo, no se podría anidar un FlatList vertical dentro de un ScrollView vertical porque rompería la virtualización de memoria. Como acá los ejes son distintos, el FlatList horizontal virtualiza sus ítems correctamente sin penalizar el rendimiento del padre.

**Pregunta 5: Hablando del `FlatList`, ¿por qué elegiste este componente para el carrusel en lugar de un `.map()` dentro de un `ScrollView` horizontal regular?**
*Respuesta:* Por la escalabilidad de la memoria (Virtualización). Un `.map()` dentro de un `ScrollView` renderiza todos los componentes hijos de golpe, sin importar si están en pantalla o no. Si el usuario tuviera 50 productos en el carrito, la app colapsaría. `FlatList` destruye los ítems que salen de la pantalla y solo mantiene en memoria los que el usuario está viendo (más un margen). Aunque en un carrito rara vez hay tantos ítems, es una buena práctica de ingeniería móvil usar siempre componentes virtualizados para listas dinámicas.
