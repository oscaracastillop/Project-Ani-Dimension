# Project Ani-Dimension (Ecosistema Completo de Duelos)

Carpeta centralizada con todo el código fuente oficial de Project Ignis / EDOPro y sus componentes de servidor, motor de reglas, IA/NPCs y clientes multiplataforma.

## Estructura de Carpetas

- **`/server`**: Servidor de salas y partidas de duelo en Node.js/TypeScript (SRVPro). Maneja la lógica de matchmaking, salas y comunicación por sockets TCP.
- **`/engine`**: Motor oficial C++ de reglas (ocgcore / ygopro-core). Es el procesador central que valida cadenas, efectos y estados de juego.
- **`/npcs`**: Inteligencia Artificial oficial en C# / .NET (WindBot). Bots con estrategias preprogramadas que se conectan al servidor como jugadores virtuales.
- **`/client-pc`**: Código fuente C++ de la aplicación de escritorio de EDOPro (Windows, Linux, macOS).
- **`/client-android`**: Proyecto de Android Studio (Gradle + CMake + NDK) para compilar la aplicación móvil APK.
- **`/data`**: Base de datos unificada `cards.cdb` y carpeta `/data/scripts/` con los más de 22,800 scripts oficiales en Lua (`c<id>.lua`).
- **`/assets`**: Espacio reservado para texturas, tapetes, fundas, avatares, música y sonidos de Ani-Dimension.
- **`/docs`**: Guía detallada de arquitectura y despliegue en VPS con tu dominio personalizado (`ARCHITECTURE_AND_DEPLOYMENT.md`).
