const Database = require("better-sqlite3")
const path     = require("path")
const fs       = require("fs")

// Railway provee RAILWAY_VOLUME_MOUNT_PATH automáticamente
// cuando hay un volumen conectado al servicio.
// En local, usamos la carpeta raíz del proyecto.
const DB_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
               ? process.env.RAILWAY_VOLUME_MOUNT_PATH
               : path.join(__dirname, "..")

// Crear el directorio si no existe
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const dbPath = path.join(DB_DIR, "iglesia.db")
console.log(`📂 Base de datos en: ${dbPath}`)

const db = new Database(dbPath)

// ─── Crear la tabla si no existe ─────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS registros (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha        TEXT    NOT NULL,
    hombres      INTEGER DEFAULT 0,
    mujeres      INTEGER DEFAULT 0,
    ninos        INTEGER DEFAULT 0,
    total        INTEGER DEFAULT 0,
    dirigido_por TEXT    NOT NULL DEFAULT '',
    predicador   TEXT    NOT NULL,
    mensaje      TEXT    NOT NULL
  )
`)

// ─── Tabla de usuarios ────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT    NOT NULL,
    email    TEXT    NOT NULL UNIQUE,
    password TEXT    NOT NULL
  )
`)

// ─── Migración: agregar columna si no existe ──────────────────────
try {
  db.exec("ALTER TABLE registros ADD COLUMN dirigido_por TEXT NOT NULL DEFAULT ''")
  console.log("✅ Migración aplicada: columna dirigido_por agregada")
} catch (e) {
  // La columna ya existe — no hay nada que hacer
}

// ─── Funciones de la base de datos ───────────────────────────────
function obtenerTodos() {
  return db.prepare("SELECT * FROM registros ORDER BY fecha DESC").all()
}

function crear(registro) {
  const stmt = db.prepare(`
    INSERT INTO registros (fecha, hombres, mujeres, ninos, total, dirigido_por, predicador, mensaje)
    VALUES (@fecha, @hombres, @mujeres, @ninos, @total, @dirigido_por, @predicador, @mensaje)
  `)
  return stmt.run(registro)
}

function actualizar(id, registro) {
  const stmt = db.prepare(`
    UPDATE registros
    SET fecha        = @fecha,
        hombres      = @hombres,
        mujeres      = @mujeres,
        ninos        = @ninos,
        total        = @total,
        dirigido_por = @dirigido_por,
        predicador   = @predicador,
        mensaje      = @mensaje
    WHERE id = @id
  `)
  return stmt.run({ ...registro, id })
}

function eliminar(id) {
  return db.prepare("DELETE FROM registros WHERE id = ?").run(id)
}

// ─── Funciones de usuarios ────────────────────────────────────────
function crearUsuario(nombre, email, passwordHash) {
  const stmt = db.prepare(`
    INSERT INTO usuarios (nombre, email, password)
    VALUES (?, ?, ?)
  `)
  return stmt.run(nombre, email, passwordHash)
}

function buscarUsuarioPorEmail(email) {
  return db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email)
}

function contarUsuarios() {
  return db.prepare("SELECT COUNT(*) as total FROM usuarios").get().total
}


// ─── Tablas del módulo de membresía ──────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS miembros (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_registro   TEXT    NOT NULL,
    nombre           TEXT    NOT NULL,
    fecha_nacimiento TEXT,
    direccion        TEXT,
    telefono         TEXT,
    correo           TEXT,
    tipo             TEXT    DEFAULT 'miembro',
    estado           TEXT    DEFAULT 'activo',
    anios_iglesia    INTEGER DEFAULT 0,
    bautizado        TEXT    DEFAULT 'no',
    otros_datos      TEXT
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS miembro_cargos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    miembro_id INTEGER NOT NULL,
    cargo      TEXT    NOT NULL,
    FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS discipulados (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    miembro_id         INTEGER NOT NULL,
    nombre_discipulado TEXT    NOT NULL,
    fecha_inicio       TEXT,
    fecha_fin          TEXT,
    FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE
  )
`)

// Activar claves foráneas en SQLite
db.exec("PRAGMA foreign_keys = ON")

// ─── Funciones de miembros ────────────────────────────────────────

function obtenerTodosMiembros() {
  const miembros = db.prepare("SELECT * FROM miembros ORDER BY nombre ASC").all()

  // Para cada miembro, traemos sus cargos y discipulados
  return miembros.map(m => {
    m.cargos = db.prepare(
      "SELECT * FROM miembro_cargos WHERE miembro_id = ?"
    ).all(m.id)

    m.discipulados = db.prepare(
      "SELECT * FROM discipulados WHERE miembro_id = ?"
    ).all(m.id)

    return m
  })
}

function obtenerMiembroPorId(id) {
  const miembro = db.prepare("SELECT * FROM miembros WHERE id = ?").get(id)
  if (!miembro) return null

  miembro.cargos = db.prepare(
    "SELECT * FROM miembro_cargos WHERE miembro_id = ?"
  ).all(id)

  miembro.discipulados = db.prepare(
    "SELECT * FROM discipulados WHERE miembro_id = ?"
  ).all(id)

  return miembro
}

function crearMiembro(datos, cargos = [], discipulados = []) {
  // Usamos una transacción para garantizar que todo se guarde o nada
  const transaccion = db.transaction(() => {

    const stmt = db.prepare(`
      INSERT INTO miembros
        (fecha_registro, nombre, fecha_nacimiento, direccion, telefono,
         correo, tipo, estado, anios_iglesia, bautizado, otros_datos)
      VALUES
        (@fecha_registro, @nombre, @fecha_nacimiento, @direccion, @telefono,
         @correo, @tipo, @estado, @anios_iglesia, @bautizado, @otros_datos)
    `)

    const resultado   = stmt.run(datos)
    const miembro_id  = resultado.lastInsertRowid

    // Insertar cargos
    const stmtCargo = db.prepare(
      "INSERT INTO miembro_cargos (miembro_id, cargo) VALUES (?, ?)"
    )
    for (const cargo of cargos) {
      stmtCargo.run(miembro_id, cargo)
    }

    // Insertar discipulados
    const stmtDisc = db.prepare(`
      INSERT INTO discipulados (miembro_id, nombre_discipulado, fecha_inicio, fecha_fin)
      VALUES (?, ?, ?, ?)
    `)
    for (const d of discipulados) {
      stmtDisc.run(miembro_id, d.nombre_discipulado, d.fecha_inicio, d.fecha_fin)
    }

    return miembro_id
  })

  return transaccion()
}

function actualizarMiembro(id, datos, cargos = [], discipulados = []) {
  const transaccion = db.transaction(() => {

    db.prepare(`
      UPDATE miembros SET
        fecha_registro   = @fecha_registro,
        nombre           = @nombre,
        fecha_nacimiento = @fecha_nacimiento,
        direccion        = @direccion,
        telefono         = @telefono,
        correo           = @correo,
        tipo             = @tipo,
        estado           = @estado,
        anios_iglesia    = @anios_iglesia,
        bautizado        = @bautizado,
        otros_datos      = @otros_datos
      WHERE id = @id
    `).run({ ...datos, id })

    // Borramos los cargos y discipulados anteriores y los reinsertamos
    db.prepare("DELETE FROM miembro_cargos WHERE miembro_id = ?").run(id)
    db.prepare("DELETE FROM discipulados    WHERE miembro_id = ?").run(id)

    const stmtCargo = db.prepare(
      "INSERT INTO miembro_cargos (miembro_id, cargo) VALUES (?, ?)"
    )
    for (const cargo of cargos) {
      stmtCargo.run(id, cargo)
    }

    const stmtDisc = db.prepare(`
      INSERT INTO discipulados (miembro_id, nombre_discipulado, fecha_inicio, fecha_fin)
      VALUES (?, ?, ?, ?)
    `)
    for (const d of discipulados) {
      stmtDisc.run(id, d.nombre_discipulado, d.fecha_inicio, d.fecha_fin)
    }
  })

  transaccion()
}

function eliminarMiembro(id) {
  // ON DELETE CASCADE elimina automáticamente cargos y discipulados
  return db.prepare("DELETE FROM miembros WHERE id = ?").run(id)
}




module.exports = {
  // Registros de asistencia
  obtenerTodos, crear, actualizar, eliminar,
  // Usuarios
  crearUsuario, buscarUsuarioPorEmail, contarUsuarios,
  // Miembros
  obtenerTodosMiembros, obtenerMiembroPorId,
  crearMiembro, actualizarMiembro, eliminarMiembro
}