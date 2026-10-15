# Arquitectura Integral: Project Ani-Dimension (Basado en Project Ignis / EDOPro)

Este documento detalla la estructura completa, los repositorios de código fuente, el funcionamiento de cada componente y la guía paso a paso para desplegar en tu propio VPS con tu dominio personalizado.

---

## 1. Estructura del Proyecto

El proyecto está organizado en módulos independientes para garantizar escalabilidad y orden:

```
c:\Users\oscar.castillo\Videos\project Ani-Dimension\
├── server\            # Servidor de Salas y Matchmaking (Node.js / TypeScript - SRVPro)
├── engine\            # ocgcore (Motor C++ de Reglas Oficiales OCG/TCG)
├── npcs\              # WindBot (Bots de Inteligencia Artificial en .NET / C#)
├── client-pc\         # Cliente Gráfico de Escritorio (C++ / Irrlicht 3D - EDOPro)
├── client-android\    # Cliente Móvil para Android (Android Studio / Gradle / NDK)
├── data\              # Base de datos unificada (cards.cdb y scripts de cartas Lua)
├── assets\            # Tapetes, fundas, avatares, texturas, música y efectos visuales de Ani-Dimension
└── docs\              # Guías de despliegue, manual de compilación y especificaciones
```

---

## 2. Mapa de Repositorios Oficiales de Código Fuente

| Componente | Repositorio Oficial | Rol en el Sistema |
| :--- | :--- | :--- |
| **Servidor Central** | `https://github.com/mycard/srvpro.git` | Gestiona salas, autenticación, emparejamientos y sockets TCP. |
| **Motor de Duelos** | `https://github.com/Fluorohydride/ygopro-core.git` | Procesa las reglas oficiales OCG/TCG y ejecuta los scripts Lua. |
| **IA / NPCs** | `https://github.com/ProjectIgnis/WindBot.git` | Bots con barajas temáticas para modo Solo / Aventura. |
| **Scripts de Cartas**| `https://github.com/ProjectIgnis/CardScripts.git` | Archivos `c<id>.lua` de todas las cartas del juego. |
| **Cliente PC** | `https://github.com/edo9300/edopro.git` | Aplicación gráfica ejecutable en Windows, Linux y Mac. |
| **Cliente Android** | `https://github.com/edo9300/edopro-android.git` | Proyecto de Android Studio con interfaz táctil y NDK. |

---

## 3. ¿Cómo Funciona la Conexión en tu VPS con tu Dominio?

```
[Cliente PC (Windows)] ----> | TCP Puerto 7911 | ---> [duel.tudominio.com (VPS)]
[Cliente Android (APK)] ---> | TCP Puerto 7911 | ---> [duel.tudominio.com (VPS)]
[Panel Web / Lobby] -------> | HTTPS 443 (Nginx) | -> [duel.tudominio.com (VPS)]
```

### Configuración de Dominio (DNS):
1. En tu panel de dominio (Cloudflare, GoDaddy, etc.), creas un registro DNS tipo `A`:
   - `duel.tudominio.com` -> `IP_DE_TU_VPS`

### Configuración en el VPS:
1. **Puerto de Duelos**: Habilitar el puerto TCP `7911` en el firewall (`ufw allow 7911/tcp`).
2. **Servidor Node.js**: Ejecutar `srvpro` con **PM2** (`pm2 start app.js --name "ani-dimension-server"`).
3. **Servicio de Bots (NPCs)**: Ejecutar `WindBot` apuntando a `127.0.0.1:7911`.
4. **Proxy Inverso SSL**: Servir el lobby web con Nginx y Certbot en el puerto 443.

---

## 4. Configuración en los Clientes (PC y Android)

Tanto en la versión de PC como en el APK de Android, los clientes leen `config/servers.json`:
```json
[
  {
    "name": "Ani-Dimension Oficial",
    "address": "duel.tudominio.com",
    "port": 7911,
    "version": "0x1340"
  }
]
```
