# ⚡ TurboNetwork SaaS Engine

> **Plataforma Integral de Alto Rendimiento para Proveedores de Servicios de Internet (ISP / WISP)**  
> Desarrollada en **TypeScript**, **Node.js**, **Fastify** y **PostgreSQL** con arquitectura desacoplada y diseño moderno inspirado en el ecosistema Apple.

---

## 🌟 Características Principales

- **Compatibilidad Dual Total**:
  - **cPanel**: Ejecución optimizada mediante *Phusion Passenger* con consumo basal `< 80MB` de RAM y arranque automático a través de `app.js`.
  - **VPS / Bare-Metal**: Soporte de alta concurrencia con *PM2*, *Docker* o *systemd*.
- **Cero Tiempos Muertos de Compilación**:
  - **Desarrollo**: Hot-reload instantáneo con `tsx` (sin compilar manualmente).
  - **Producción**: Empaquetado ultrarrápido con `tsup` (*esbuild*) en menos de **30 milisegundos**.
- **Autenticación Estilo Apple**:
  - Teclado numérico táctil y físico de **8 dígitos**.
  - Transición con saludo dinámico y avatar del operador.
- **Módulo de Configuración & Roles Granulares**:
  - Matriz de permisos RBAC para Clientes, Facturación, Red/OLTs, Planes y Sistema.
  - Registro de operadores con generación de PIN seguro.
- **Red Multi-Vendor Desacoplada**:
  - Adaptadores modulares listos para **MikroTik RouterOS (v6 y v7)**, **OLTs de Fibra Óptica (Huawei, ZTE, VSOL)** y switches genéricos.
- **Facturación Interna Nativa**:
  - Control de recibos, liquidación en efectivo, transferencias bancarias y cortes administrativos por mora sin depender de pasarelas externas obligatorias.

---

## 🚀 Inicio Rápido (Desarrollo Local)

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/networkturbo4-pixel/turboperuv3-Cesar.git
cd turboperuv3-Cesar
npm install
```

### 2. Configurar Variables de Entorno
Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

### 3. Iniciar Servidor de Desarrollo
```bash
npm run dev
```
Abre tu navegador en `http://localhost:3000`.

**PINs de Demostración Iniciales:**
- **Superadministrador (César):** `12345678`
- **Admin de Red / NOC (Alejandro):** `87654321`
- **Cajero / Cobranzas (Ana):** `11223344`

---

## 📦 Compilación para Producción (cPanel o VPS)

Ejecuta el empaquetador ultrarrápido:
```bash
npm run build
```
Esto generará un archivo único y optimizado en `dist/server.js`.

### Despliegue en cPanel:
1. Sube los archivos del proyecto a tu directorio en cPanel (ej. `public_html` o subcarpeta).
2. En la sección **Setup Node.js App** de cPanel:
   - **Node.js Version**: 18.x o superior.
   - **Application startup file**: `app.js` (o `dist/server.js`).
   - **Application mode**: `Production`.
3. Haz clic en **Run NPM Install** y luego en **Restart Application**.

### Despliegue en VPS (con PM2):
```bash
npm run build
pm2 start dist/server.js --name turbonetwork -i max
pm2 save
```

---

## 🛠️ Estructura del Proyecto

```
turbonetwork/
├── app.js                   # Bootstrap de compatibilidad para Phusion Passenger en cPanel
├── package.json             # Dependencias y scripts de ejecución
├── tsconfig.json            # Reglas estrictas de TypeScript (ES2022)
├── tsup.config.ts           # Configuración de compilación ultrarrápida
├── drizzle.config.ts        # Configuración de migraciones PostgreSQL
├── public/
│   └── index.html           # Panel Frontend estilo Apple (SPA reactivo)
├── src/
│   ├── config/              # Validación Zod de variables de entorno
│   ├── db/                  # Conexión Drizzle ORM y esquema PostgreSQL
│   ├── modules/
│   │   ├── auth/            # Rutas de autenticación por PIN
│   │   ├── users/           # Usuarios y catálogo de roles granulares
│   │   ├── customers/       # Directorio de clientes y contratos
│   │   ├── invoices/        # Facturación interna y registro de pagos
│   │   ├── network/         # Adaptadores MikroTik, OLTs Huawei, ZTE, VSOL
│   │   ├── plans/           # Planes de internet y ráfagas
│   │   └── dashboard/       # Métricas y estadísticas en tiempo real
│   └── server.ts            # Motor Fastify central
└── README.md
```

---

## 🔒 Seguridad & Roles

El sistema implementa un modelo de control de acceso basado en roles (RBAC) con permisos granulares:
- `customers:view`, `customers:create`, `customers:edit`, `customers:suspend`
- `billing:view`, `billing:collect`, `billing:generate`
- `network:view`, `network:control`, `network:manage`
- `plans:manage`
- `users:manage`, `roles:manage`
- `system:config`

---

## 📄 Licencia

Desarrollado para **TurboNetwork**. Todos los derechos reservados.
