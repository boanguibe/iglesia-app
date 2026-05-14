const Database = require("better-sqlite3")
const path     = require("path")
const fs       = require("fs")

// En Railway usamos el volumen persistente /app/data
// En local usamos la carpeta raíz del proyecto
const DB_DIR  = process.env.RAILWAY_ENVIRONMENT
                ? "/app/data"
                : path.join(__dirname, "..")

// Crear el directorio si no existe
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const db = new Database(path.join(DB_DIR, "iglesia.db"))

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

module.exports = { obtenerTodos, crear, actualizar, eliminar }