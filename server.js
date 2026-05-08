const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();

// ─── Database ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_QCRLS8jpV1Dm@ep-billowing-pond-apfhimh3-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'organizador-dani-secreto-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── Init DB ──────────────────────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id          SERIAL PRIMARY KEY,
        username    VARCHAR(50)  UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        nombre      VARCHAR(100),
        rol         VARCHAR(20)  DEFAULT 'usuario',
        creado_en   TIMESTAMP    DEFAULT NOW(),
        activo      BOOLEAN      DEFAULT TRUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventario (
        id               SERIAL PRIMARY KEY,
        usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        usuario_nombre   VARCHAR(50),
        nombre_zip       VARCHAR(255),
        pdfs_procesados  INTEGER  DEFAULT 0,
        carpetas_creadas INTEGER  DEFAULT 0,
        tamano_kb        NUMERIC(12,2) DEFAULT 0,
        detalles         TEXT,
        fecha            DATE      DEFAULT CURRENT_DATE,
        hora             TIME      DEFAULT CURRENT_TIME,
        creado_en        TIMESTAMP DEFAULT NOW()
      )
    `);

    // Crear admin si no existe
    const check = await client.query("SELECT id FROM usuarios WHERE username = 'dani'");
    if (check.rows.length === 0) {
      const hash = await bcrypt.hash('7012024jyD', 12);
      await client.query(
        "INSERT INTO usuarios (username, password, nombre, rol) VALUES ('dani', $1, 'Administradora', 'admin')",
        [hash]
      );
      console.log('✓ Usuario admin "dani" creado');
    }

    console.log('✓ Base de datos inicializada');
  } finally {
    client.release();
  }
}

initDB().catch(err => console.error('Error inicializando DB:', err));

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  return res.status(401).json({ error: 'No autenticado' });
}

function requireAdmin(req, res, next) {
  if (req.session.rol === 'admin') return next();
  return res.status(403).json({ error: 'Se requieren permisos de administradora' });
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Ingresa usuario y contraseña' });

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE username = $1 AND activo = TRUE', [username]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    req.session.userId   = user.id;
    req.session.username = user.username;
    req.session.nombre   = user.nombre || user.username;
    req.session.rol      = user.rol;

    res.json({
      success:  true,
      username: user.username,
      nombre:   user.nombre || user.username,
      rol:      user.rol
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    username: req.session.username,
    nombre:   req.session.nombre,
    rol:      req.session.rol
  });
});

// ─── Users Routes ─────────────────────────────────────────────────────────────
app.get('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, nombre, rol, activo, creado_en FROM usuarios ORDER BY creado_en DESC'
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

app.post('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, nombre, rol } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO usuarios (username, password, nombre, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, nombre, rol, creado_en`,
      [username.toLowerCase().trim(), hash, nombre || username, rol || 'usuario']
    );
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505')
      return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
    console.error(e);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.put('/api/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, rol, activo, password } = req.body;
  try {
    if (password && password.trim()) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE usuarios SET nombre=$1, rol=$2, activo=$3, password=$4 WHERE id=$5',
        [nombre, rol, activo, hash, id]
      );
    } else {
      await pool.query(
        'UPDATE usuarios SET nombre=$1, rol=$2, activo=$3 WHERE id=$4',
        [nombre, rol, activo, id]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.delete('/api/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.session.userId)
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// ─── Inventory Routes ─────────────────────────────────────────────────────────
app.get('/api/inventario', requireAuth, async (req, res) => {
  const { limite = 100 } = req.query;
  let query = 'SELECT * FROM inventario';
  const params = [];

  if (req.session.rol !== 'admin') {
    query += ' WHERE usuario_id = $1';
    params.push(req.session.userId);
  }

  query += ` ORDER BY creado_en DESC LIMIT ${parseInt(limite)}`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

app.post('/api/inventario', requireAuth, async (req, res) => {
  const { nombre_zip, pdfs_procesados, carpetas_creadas, tamano_kb, detalles } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO inventario
         (usuario_id, usuario_nombre, nombre_zip, pdfs_procesados, carpetas_creadas, tamano_kb, detalles)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.session.userId, req.session.username, nombre_zip,
       pdfs_procesados, carpetas_creadas, tamano_kb || 0, detalles]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al guardar en inventario' });
  }
});

// ─── Stats ───────────────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.session.rol === 'admin' ? null : req.session.userId;
    const filter = userId ? 'WHERE usuario_id = $1' : '';
    const params = userId ? [userId] : [];

    const [total, pdfs, hoy] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM inventario ${filter}`, params),
      pool.query(`SELECT COALESCE(SUM(pdfs_procesados),0) FROM inventario ${filter}`, params),
      pool.query(
        `SELECT COUNT(*) FROM inventario ${filter ? filter + ' AND' : 'WHERE'} fecha = CURRENT_DATE`,
        params
      )
    ]);

    res.json({
      total_operaciones: parseInt(total.rows[0].count),
      total_pdfs:        parseInt(pdfs.rows[0].coalesce),
      operaciones_hoy:   parseInt(hoy.rows[0].count)
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✦ Servidor corriendo en http://localhost:${PORT}\n`);
});
require('dotenv').config();
const connectionString = process.env.DATABASE_URL;