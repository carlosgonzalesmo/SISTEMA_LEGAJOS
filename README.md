# 📂 Legajos – File Management System (Full Stack)

Sistema integral para la **gestión de legajos físicos** que permite registrar, solicitar, prestar y devolver carpetas documentarias mediante workflows controlados por roles, con auditoría completa y sincronización en tiempo real.

Este repositorio contiene la solución **end-to-end**:

* 🖥️ Frontend web (React + Vite)
* 🔌 Backend API (Node.js + Express + Prisma)
* 🗄️ Base de datos PostgreSQL
* 📡 Eventos en tiempo real con Socket.IO

---

## 🧭 Arquitectura General

**Flujo lógico:**

1. Usuario interactúa desde el frontend.
2. Frontend consume API REST autenticada (JWT).
3. Backend ejecuta lógica de negocio + Prisma ORM.
4. PostgreSQL persiste datos.
5. Socket.IO emite eventos en tiempo real a clientes conectados.

---

## 📦 Estructura del repositorio

```text
legajos-system/
├─ frontend/           # SPA React + Vite
│  └─ README.md        # Documentación específica frontend
│
├─ backend_legajos/   # API Node + Express + Prisma
│  └─ README.md        # Documentación específica backend
│
├─ docker-compose.yml  # (opcional) DB / servicios
└─ README.md           # (este archivo)
```

---

## 🚀 Puesta en marcha local

### 1️⃣ Clonar repositorio

```bash
git clone <repo-url>
cd legajos-system
```

---

### 2️⃣ Levantar Base de Datos

Desde backend:

```bash
cd backend_legajos
docker compose up -d
```

Esto levanta PostgreSQL local.

---

### 3️⃣ Configurar Backend

```bash
cd backend_legajos
cp .env.example .env
```

Variables mínimas:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/legajos
JWT_SECRET=supersecret
PORT=3001
CORS_ORIGIN=http://localhost:5000
```

Inicializar Prisma:

```bash
npx prisma generate
npx prisma db push
```

Levantar API:

```bash
npm run dev
```

Backend disponible en:

```
http://localhost:3001/api
```

---

### 4️⃣ Configurar Frontend

```bash
cd ../frontend
```

Crear `.env.local`:

```env
VITE_API_URL=http://localhost:3001/api
```

Levantar frontend:

```bash
npm install
npm run dev
```

Disponible en:

```
http://localhost:5000
```

---

## 🔐 Autenticación

* JWT almacenado en `localStorage`.
* Backend valida token en middleware.
* Socket.IO re-autentica al cambiar sesión.

---

## 🔄 Workflow Operativo

```
Solicitud →
Preparación/Aprobación →
Confirmación Recepción →
Préstamo Activo →
Inicio Devolución →
Confirmación Devolución
```

Estados de legajo:

* `available`
* `requested`
* `on-loan`
* `pending-return`
* `blocked`

---

## 👥 Roles del sistema

| Rol      | Capacidades                            |
| -------- | -------------------------------------- |
| admin    | Gestión completa de legajos y workflow |
| sysadmin | Usuarios, roles y configuración        |
| user     | Solicitudes y devoluciones             |

**Reglas:**

* No eliminar último admin.
* Sysadmin no opera legajos.
* Auditorías solo admin.

---

## 📡 Tiempo Real

Eventos emitidos:

* `legajo:created`
* `legajo:updated`
* `legajo:deleted`
* `solicitud:created`
* `solicitud:updated`
* `devolucion:created`
* `devolucion:updated`
* `user:created`
* `user:updated`
* `workflow:cleared`

Permiten sincronización UI sin recarga.

---

## 🧪 Testing

| Capa     | Estado                       |
| -------- | ---------------------------- |
| Backend  | ✅ Jest (imports / servicios) |
| Frontend | ⏳ Pendiente                  |

---

## 📥 Importaciones masivas

Soportado desde backend:

* Google Sheets
* Excel (.xlsx)
* CSV

Incluye preview, validación y commit.

---

## 🧰 Stack Tecnológico

| Capa       | Tecnologías               |
| ---------- | ------------------------- |
| Frontend   | React + TypeScript + Vite |
| UI         | Tailwind + shadcn/ui      |
| Backend    | Node.js + Express         |
| ORM        | Prisma                    |
| DB         | PostgreSQL                |
| Auth       | JWT + bcrypt              |
| Realtime   | Socket.IO                 |
| Validación | Zod                       |

---

## 📚 Documentación detallada

Para mayor detalle revisa:

* `frontend/README.md`
* `backend_legajos/README.md`

Cada uno incluye:

* Scripts
* Variables
* Arquitectura interna
* Endpoints
* Hooks / servicios

---

## 🗺️ Roadmap resumido

* Exportación de auditorías
* Tests frontend
* Eliminación fallback memoria
* Stress tests realtime
* Filtros avanzados UI

---

## 📜 Licencia

MIT License
