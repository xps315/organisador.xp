// ── State ─────────────────────────────────────────────
let currentUser    = null;
let pdfsExtraidos  = [];
let zipName        = '';
let editUserId     = null;
let invData        = [];
let modalGender    = 'female'; // género seleccionado en modal de usuario

// ── Theme system ──────────────────────────────────────
/**
 * applyTheme(role, gender)
 *  role:   'admin' | 'usuario'
 *  gender: 'female' | 'male' | 'admin'
 */
function applyTheme(role, gender) {
  let theme;
  if (role === 'admin') {
    theme = 'admin';
  } else {
    theme = gender === 'male' ? 'male' : 'female';
  }
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
}

// ── Sidebar móvil ─────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Tema por defecto: female
  applyTheme('usuario', 'female');

  try {
    const r = await fetch('/api/me');
    if (r.ok) {
      const u = await r.json();
      setUser(u);
      showApp();
    }
  } catch (e) {
    console.log('No hay sesión activa');
  }

  document.getElementById('login-user').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-pass').focus();
  });
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

function setUser(u) {
  currentUser = u;
  document.getElementById('sidebar-name').textContent = u.nombre || u.username;
  document.getElementById('sidebar-role').textContent = u.rol;
  document.getElementById('sidebar-avatar').textContent =
    (u.nombre || u.username).charAt(0).toUpperCase();

  // Aplicar tema según rol y género guardado
  const gender = u.genero || 'female';
  applyTheme(u.rol, gender);

  if (u.rol === 'admin')
    document.querySelectorAll('.nav-admin').forEach(el => el.style.display = 'flex');
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  cargarStats();
  setupDrop();
}

// ── Auth ──────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.textContent   = 'Por favor ingresa usuario y contraseña.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const d = await r.json();

    if (r.ok) {
      setUser(d);
      showApp();
    } else {
      errEl.textContent   = d.error || 'Error al iniciar sesión';
      errEl.style.display = 'block';
    }
  } catch (e) {
    errEl.textContent   = 'No se pudo conectar al servidor. ¿Está corriendo?';
    errEl.style.display = 'block';
  }
}

async function doLogout() {
  await fetch('/api/logout', { method: 'POST' });
  location.reload();
}

// ── Navigation ────────────────────────────────────────
function goPage(pageId, e) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (e && e.currentTarget) e.currentTarget.classList.add('active');

  // Cerrar sidebar en móvil al navegar
  closeSidebar();

  if (pageId === 'page-inventory') cargarInventario();
  if (pageId === 'page-users')     cargarUsuarios();
}

// ── Stats ─────────────────────────────────────────────
async function cargarStats() {
  try {
    const r = await fetch('/api/stats');
    if (!r.ok) return;
    const d = await r.json();
    document.getElementById('stat-total').textContent = d.total_operaciones;
    document.getElementById('stat-pdfs').textContent  = d.total_pdfs;
    document.getElementById('stat-hoy').textContent   = d.operaciones_hoy;
  } catch (e) {
    console.error('Error cargando stats:', e);
  }
}

// ── Drop zone ─────────────────────────────────────────
function setupDrop() {
  const zona   = document.getElementById('zona-drop');
  const zinput = document.getElementById('zinput');

  zona.addEventListener('dragover', e => {
    e.preventDefault();
    zona.classList.add('over');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('over'));
  zona.addEventListener('drop', e => {
    e.preventDefault();
    zona.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith('.zip')) {
      procesarZip(f);
    } else {
      document.getElementById('drop-error').style.display = 'block';
    }
  });

  zinput.addEventListener('change', e => {
    if (e.target.files[0]) procesarZip(e.target.files[0]);
    zinput.value = '';
  });
}

async function procesarZip(file) {
  document.getElementById('drop-error').style.display = 'none';
  zipName = file.name.replace(/\.zip$/i, '');
  document.getElementById('zip-name-label').textContent = file.name;

  let zipData;
  try {
    zipData = await file.arrayBuffer();
  } catch (e) {
    toast('No se pudo leer el archivo.', 'error');
    return;
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(zipData);
  } catch (e) {
    toast('El ZIP está dañado o no es válido.', 'error');
    return;
  }

  pdfsExtraidos = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir && path.toLowerCase().endsWith('.pdf')) {
      const nombre    = path.split('/').pop();
      const contenido = await entry.async('arraybuffer');
      pdfsExtraidos.push({ nombre, contenido });
    }
  }

  pdfsExtraidos.sort((a, b) => a.nombre.localeCompare(b.nombre));

  renderPDFList();
  document.getElementById('drop-card').style.display    = 'none';
  document.getElementById('process-card').style.display = 'block';
}

function renderPDFList() {
  const lista = document.getElementById('pdf-list');
  const stats = document.getElementById('proc-stats');
  const btn   = document.getElementById('btn-generar');

  if (!pdfsExtraidos.length) {
    lista.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-soft); font-size:13px;">No se encontraron PDFs en el ZIP.</div>';
    btn.disabled = true;
    return;
  }

  btn.disabled = false;
  lista.innerHTML = pdfsExtraidos.map(f => {
    const carpeta = f.nombre.replace(/\.pdf$/i, '');
    return `<div class="pdf-item">
      <div class="pdf-item-left">
        <span class="tag-pdf">PDF</span>
        <span class="pdf-name">${f.nombre}</span>
      </div>
      <span class="pdf-dest">→ ${carpeta}/</span>
    </div>`;
  }).join('');

  const totalKB = (pdfsExtraidos.reduce((s, f) => s + f.contenido.byteLength, 0) / 1024).toFixed(1);
  stats.innerHTML = `
    <div class="proc-stat"><div class="proc-stat-val">${pdfsExtraidos.length}</div><div class="proc-stat-label">PDFs encontrados</div></div>
    <div class="proc-stat"><div class="proc-stat-val">${pdfsExtraidos.length}</div><div class="proc-stat-label">Carpetas a crear</div></div>
    <div class="proc-stat"><div class="proc-stat-val">${totalKB}</div><div class="proc-stat-label">KB totales</div></div>`;
}

async function generarZip() {
  if (!pdfsExtraidos.length) return;

  const btn     = document.getElementById('btn-generar');
  const wrap    = document.getElementById('progress-wrap');
  const fill    = document.getElementById('progress-fill');
  const msg     = document.getElementById('progress-msg');
  const totalKB = (pdfsExtraidos.reduce((s, f) => s + f.contenido.byteLength, 0) / 1024).toFixed(1);

  btn.disabled       = true;
  wrap.style.display = 'block';

  const zipSalida = new JSZip();

  for (let i = 0; i < pdfsExtraidos.length; i++) {
    const f = pdfsExtraidos[i];
    zipSalida.folder(f.nombre.replace(/\.pdf$/i, '')).file(f.nombre, f.contenido);
    fill.style.width = Math.round(((i + 1) / pdfsExtraidos.length) * 80) + '%';
    msg.textContent  = `Empaquetando ${i + 1} de ${pdfsExtraidos.length}...`;
    await new Promise(r => setTimeout(r, 8));
  }

  msg.textContent  = 'Generando ZIP final...';
  fill.style.width = '90%';

  const blob = await zipSalida.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  fill.style.width = '100%';

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = zipName + '_ORGANIZADO.zip';
  a.click();
  URL.revokeObjectURL(url);

  msg.textContent = '✓ ZIP descargado correctamente';

  try {
    const detalles = pdfsExtraidos.map(f => f.nombre).join(', ');
    await fetch('/api/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_zip:       zipName + '.zip',
        pdfs_procesados:  pdfsExtraidos.length,
        carpetas_creadas: pdfsExtraidos.length,
        tamano_kb:        parseFloat(totalKB),
        detalles
      })
    });
  } catch (e) {
    console.error('Error guardando inventario:', e);
  }

  toast('¡ZIP organizado y guardado en el inventario!', 'success');
  cargarStats();
  btn.disabled = false;
}

function reiniciarOrganizer() {
  pdfsExtraidos = [];
  zipName       = '';
  document.getElementById('process-card').style.display  = 'none';
  document.getElementById('drop-card').style.display     = 'block';
  document.getElementById('progress-wrap').style.display = 'none';
  document.getElementById('progress-fill').style.width   = '0%';
  document.getElementById('pdf-list').innerHTML   = '';
  document.getElementById('proc-stats').innerHTML = '';
}

// ── Inventory ─────────────────────────────────────────
async function cargarInventario() {
  try {
    const r = await fetch('/api/inventario?limite=200');
    if (!r.ok) return;
    invData = await r.json();
    renderInventario(invData);
  } catch (e) {
    console.error('Error cargando inventario:', e);
  }
}

function renderInventario(data) {
  const tbody = document.getElementById('inv-tbody');

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-soft);">No hay registros aún</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => {
    const fecha = r.fecha ? new Date(r.fecha).toLocaleDateString('es-PE') : '—';
    const hora  = r.hora  ? r.hora.slice(0, 8) : '—';
    return `<tr>
      <td style="color:var(--text-soft); font-size:12px;">${r.id}</td>
      <td><strong style="color:var(--plum);">${r.nombre_zip || '—'}</strong></td>
      <td><span class="badge badge-ok">${r.pdfs_procesados}</span></td>
      <td>${r.carpetas_creadas}</td>
      <td style="color:var(--text-soft);">${r.tamano_kb ? r.tamano_kb + ' KB' : '—'}</td>
      <td><strong>${r.usuario_nombre || '—'}</strong></td>
      <td>${fecha}</td>
      <td style="color:var(--text-soft);">${hora}</td>
    </tr>`;
  }).join('');
}

function filtrarInventario() {
  const q = document.getElementById('inv-search').value.toLowerCase();
  const filtrado = invData.filter(r =>
    (r.nombre_zip     || '').toLowerCase().includes(q) ||
    (r.usuario_nombre || '').toLowerCase().includes(q)
  );
  renderInventario(filtrado);
}

// ── Users ─────────────────────────────────────────────
async function cargarUsuarios() {
  try {
    const r = await fetch('/api/usuarios');
    if (!r.ok) return;
    const data = await r.json();
    renderUsuarios(data);
  } catch (e) {
    console.error('Error cargando usuarios:', e);
  }
}

function renderUsuarios(data) {
  const tbody = document.getElementById('users-tbody');

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-soft);">Sin usuarios registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(u => {
    const fecha   = u.creado_en ? new Date(u.creado_en).toLocaleDateString('es-PE') : '—';
    const nombre   = (u.nombre || '').replace(/'/g, "\\'");
    const username = (u.username || '').replace(/'/g, "\\'");
    const genero   = u.genero || 'female';

    // Badge de género
    let genderBadge = '';
    if (genero === 'male') {
      genderBadge = `<span class="badge badge-male"><i class="ti ti-gender-male" style="font-size:11px;vertical-align:-1px"></i> Masculino</span>`;
    } else if (genero === 'admin') {
      genderBadge = `<span class="badge badge-admin"><i class="ti ti-shield-check" style="font-size:11px;vertical-align:-1px"></i> Admin</span>`;
    } else {
      genderBadge = `<span class="badge badge-female"><i class="ti ti-gender-female" style="font-size:11px;vertical-align:-1px"></i> Femenino</span>`;
    }

    return `<tr>
      <td><strong style="color:var(--plum);">@${u.username}</strong></td>
      <td>${u.nombre || '—'}</td>
      <td><span class="badge ${u.rol === 'admin' ? 'badge-admin' : 'badge-user'}">${u.rol === 'admin' ? 'Admin' : 'Usuaria'}</span></td>
      <td>${genderBadge}</td>
      <td><span class="badge ${u.activo ? 'badge-ok' : ''}" style="${!u.activo ? 'background:#f5f5f5;color:#999;border:1px solid #ddd;' : ''}">${u.activo ? 'Activa' : 'Inactiva'}</span></td>
      <td style="color:var(--text-soft);">${fecha}</td>
      <td>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" onclick="editarUsuario(${u.id},'${username}','${nombre}','${u.rol}',${u.activo},'${genero}')">
            <i class="ti ti-edit" style="font-size:13px"></i> Editar
          </button>
          <button class="btn btn-danger btn-sm" onclick="eliminarUsuario(${u.id},'${username}')">
            <i class="ti ti-trash" style="font-size:13px"></i> Eliminar
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Selector de género en modal ────────────────────────
function selectModalGender(g) {
  modalGender = g;
  ['female', 'male', 'admin'].forEach(id => {
    const btn = document.getElementById('mbg-' + id);
    if (btn) btn.classList.toggle('active', id === g);
  });

  // Si selecciona admin en el selector de género, también cambia el rol
  if (g === 'admin') {
    const rolSelect = document.getElementById('mu-rol');
    if (rolSelect) rolSelect.value = 'admin';
  }
}

// Sincronizar: si cambia el rol a admin, marcar admin en género
function syncRolGenero() {
  const rol = document.getElementById('mu-rol').value;
  if (rol === 'admin') {
    selectModalGender('admin');
  } else {
    // Si deja de ser admin y el género era admin, resetear a female
    if (modalGender === 'admin') {
      selectModalGender('female');
    }
  }
}

function abrirModalUsuario() {
  editUserId  = null;
  modalGender = 'female';
  document.getElementById('modal-titulo').textContent  = 'Nuevo usuario';
  document.getElementById('mu-user').value             = '';
  document.getElementById('mu-nombre').value           = '';
  document.getElementById('mu-pass').value             = '';
  document.getElementById('mu-rol').value              = 'usuario';
  document.getElementById('mu-user').disabled          = false;
  document.getElementById('modal-error').style.display = 'none';
  selectModalGender('female');
  document.getElementById('modal-usuario').classList.add('open');
}

function editarUsuario(id, username, nombre, rol, activo, genero) {
  editUserId  = id;
  modalGender = genero || 'female';
  document.getElementById('modal-titulo').textContent  = 'Editar usuario';
  document.getElementById('mu-user').value             = username;
  document.getElementById('mu-nombre').value           = nombre;
  document.getElementById('mu-pass').value             = '';
  document.getElementById('mu-rol').value              = rol;
  document.getElementById('mu-user').disabled          = true;
  document.getElementById('modal-error').style.display = 'none';
  selectModalGender(genero || (rol === 'admin' ? 'admin' : 'female'));
  document.getElementById('modal-usuario').classList.add('open');
}

function cerrarModal() {
  document.getElementById('modal-usuario').classList.remove('open');
}

async function guardarUsuario() {
  const errEl = document.getElementById('modal-error');
  const body  = {
    username: document.getElementById('mu-user').value.trim(),
    nombre:   document.getElementById('mu-nombre').value.trim(),
    password: document.getElementById('mu-pass').value,
    rol:      document.getElementById('mu-rol').value,
    genero:   modalGender,
    activo:   true
  };
  errEl.style.display = 'none';

  if (!editUserId && (!body.username || !body.password)) {
    errEl.textContent   = 'Usuario y contraseña son obligatorios.';
    errEl.style.display = 'block';
    return;
  }

  try {
    let r;
    if (editUserId) {
      r = await fetch('/api/usuarios/' + editUserId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } else {
      r = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    const d = await r.json();
    if (r.ok) {
      cerrarModal();
      toast(editUserId ? 'Usuario actualizado ✓' : 'Usuario creado ✓', 'success');
      cargarUsuarios();
    } else {
      errEl.textContent   = d.error || 'Error al guardar';
      errEl.style.display = 'block';
    }
  } catch (e) {
    errEl.textContent   = 'Error de conexión con el servidor';
    errEl.style.display = 'block';
  }
}

async function eliminarUsuario(id, username) {
  if (!confirm(`¿Eliminar a @${username}? Esta acción no se puede deshacer.`)) return;
  try {
    const r = await fetch('/api/usuarios/' + id, { method: 'DELETE' });
    const d = await r.json();
    if (r.ok) {
      toast('Usuario eliminado', 'success');
      cargarUsuarios();
    } else {
      toast(d.error || 'Error al eliminar', 'error');
    }
  } catch (e) {
    toast('Error de conexión', 'error');
  }
}

// ── Toast ─────────────────────────────────────────────
let toastTimer;
function toast(msg, type = '') {
  const el    = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3200);
}