# TurboNetwork SaaS Engine

> **Plataforma de Alto Rendimiento para Proveedores de Servicios de Internet (ISP / WISP)**  
> Desarrollada en **TypeScript**, **Node.js**, **Fastify** y **PostgreSQL** con arquitectura desacoplada, interfaz corporativa libre de emojis y soporte para monitores de 30", 35" y ultra-panorámicos.

---

## Características de Arquitectura

- **Compatibilidad Dual Total**:
  - **cPanel**: Ejecución nativa con *Phusion Passenger* con consumo inferior a **80 MB** de memoria RAM y archivo de arranque `app.js`.
  - **VPS / Servidores Dedicados**: Soporte de alta concurrencia mediante *PM2*, *Docker* o *systemd*.
- **Pipeline de Compilación Ultrarrápido**:
  - **Desarrollo**: Ejecución directa con recarga en tiempo real mediante `tsx`.
  - **Producción**: Empaquetado a JavaScript optimizado con `tsup` (*esbuild*) en menos de **30 milisegundos**.
- **Autenticación con PIN de 8 Dígitos**:
  - Teclado numérico táctil y físico para operadores de red y cajeros.
  - Validación de credenciales y autorización por roles.
- **Control de Acceso Basado en Roles (RBAC)**:
  - Matriz granular de permisos (Clientes, Facturación, Red/OLTs, Planes y Sistema).
  - Creación de operadores y asignación individual de PIN.
- **Estudio de Personalización & Marca**:
  - Configuración de logotipos (URL / SVG), favicon y aplicación web progresiva (PWA).
  - Paletas de color dinámicas para modo oscuro y claro.
  - Ajuste global de tipografía y escala de fuentes para pantallas grandes (30" a 35" 4K).
- **Red Multi-Vendor Desacoplada**:
  - Adaptadores listos para **MikroTik RouterOS (v6 y v7)**, **OLTs de Fibra Óptica (Huawei, ZTE, VSOL)** y switches de capa 2/3.
- **Facturación y Cobranza Interna**:
  - Emisión de recibos mensuales, liquidación de pagos en efectivo o transferencias bancarias y gestión de deudas.

---

## Inicio Rápido (Entorno Local)

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/networkturbo4-pixel/turboperuv3-Cesar.git
cd turboperuv3-Cesar
npm install
```

### 2. Configurar Variables de Entorno
```bash
cp .env.example .env
```

### 3. Iniciar en Modo Desarrollo
```bash
npm run dev
```
Acceder mediante navegador en `http://localhost:3000`.

**PINs de Demostración Iniciales:**
- **Superadministrador (César):** `12345678`
- **Admin de Red / NOC (Alejandro):** `87654321`
- **Cajero / Cobranzas (Ana):** `11223344`

---

## Compilación y Despliegue en Producción

### Generar Build de Producción
```bash
npm run build
```
Genera un bundle CommonJS optimizado en `dist/server.js`.

### Despliegue en cPanel:
1. Subir los archivos del proyecto a la carpeta correspondiente en el Administrador de Archivos.
2. En la herramienta **Setup Node.js App**:
   - **Node.js Version**: 18.x o superior.
   - **Application startup file**: `app.js` (o `dist/server.js`).
   - **Application mode**: `Production`.
3. Ejecutar **Run NPM Install** y pulsar **Restart**.

### Despliegue en VPS (CloudPanel / PM2):
```bash
# 1. Configurar variables de entorno
cp .env.example .env

# 2. Instalar dependencias y compilar
npm install
npm run build

# 3. Sincronizar base de datos
npm run db:push

# 4. Arrancar en segundo plano con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Actualización Rápida en VPS (1 solo paso):
Cada vez que subas cambios a GitHub, solo ejecuta en la carpeta del proyecto en el VPS:
```bash
bash deploy.sh
```
*(El script descarga cambios de GitHub, compila, sincroniza la base de datos y recarga PM2 en caliente sin interrupción de servicio).*

---

## Estructura del Código Fuente

```
turbonetwork/
├── app.js                   # Bootstrap para Phusion Passenger en cPanel
├── package.json             # Dependencias y scripts de ejecución
├── tsconfig.json            # Reglas de compilación TypeScript
├── tsup.config.ts           # Configuración de empaquetado de alto rendimiento
├── drizzle.config.ts        # Migraciones para PostgreSQL
├── public/
│   └── index.html           # Interfaz SPA profesional libre de emojis
├── src/
│   ├── config/              # Variables de entorno y validación Zod
│   ├── db/                  # Pool de PostgreSQL y esquema Drizzle
│   ├── modules/
│   │   ├── auth/            # Validación de PIN y credenciales
│   │   ├── users/           # Usuarios y catálogo de roles RBAC
│   │   ├── settings/        # API de personalización de marca y temas
│   │   ├── customers/       # Clientes y contratos
│   │   ├── invoices/        # Facturación interna y pagos
│   │   ├── network/         # Adaptadores MikroTik, OLTs Huawei, ZTE, VSOL
│   │   ├── plans/           # Planes de ancho de banda
│   │   └── dashboard/       # Métricas y telemetría
│   └── server.ts            # Servidor central Fastify
└── README.md
```

---

## Licencia

Desarrollado para **TurboNetwork**. Todos los derechos reservados.
