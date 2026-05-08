# 🌸 Floresca — Organizadora de PDFs

Aplicación web con login, base de datos Neon PostgreSQL e inventario de actividad.

---

## Requisitos

- **Node.js** versión 16 o superior
- Conexión a internet (para Neon PostgreSQL)

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor
npm start
```

Luego abre tu navegador en: **http://localhost:3000**

---

## Acceso

| Campo      | Valor       |
|------------|-------------|
| Usuario    | `dani`      |
| Contraseña | `7012024jyD`|
| Rol        | Admin       |

---

## Funciones

### 🗂️ Organizar PDFs
- Sube un archivo `.zip` con PDFs
- Cada PDF se coloca automáticamente en su propia carpeta
- Descarga el ZIP reorganizado
- La operación queda registrada en el inventario

### 📋 Inventario
- Historial completo de todos los ZIPs procesados
- Muestra: nombre del archivo, PDFs, carpetas, tamaño, usuario, fecha y hora
- Filtro de búsqueda en tiempo real

### 👥 Usuarias (solo Admin)
- Crear nuevas cuentas
- Editar nombre, rol y contraseña
- Activar / desactivar o eliminar cuentas

---

## Base de datos (Neon PostgreSQL)

Tablas creadas automáticamente al iniciar:

- **`usuarios`** — cuentas del sistema
- **`inventario`** — registro de todas las operaciones

---

## Estructura del proyecto

```
organizador-dani/
├── server.js          ← Backend Express + API
├── package.json
├── public/
│   └── index.html     ← Frontend (SPA)
└── README.md
```
# organisador.xp
