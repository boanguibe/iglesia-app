// Importamos la librería para conectarnos a SQLite
const Database = require("better-sqlite3")
const path     = require("path")

// Creamos o abrimos el archivo de base de datos
// Si iglesia.db no existe, lo crea automáticamente
const db = new Database(path.join(__dirname, "../iglesia.db"))

// ─── Crear la tabla si no existe ─────────────────────────────────
// Esta instrucción corre cada vez que arranca el servidor
// pero solo crea la tabla si aún no existe — no borra datos
db.exec(`
  CREATE TABLE IF NOT EXISTS registros (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha      TEXT    NOT NULL,
    hombres    INTEGER DEFAULT 0,
    mujeres    INTEGER DEFAULT 0,
    ninos      INTEGER DEFAULT 0,
    total      INTEGER DEFAULT 0,
    predicador TEXT    NOT NULL,
    mensaje    TEXT    NOT NULL
  )
`)

// ─── Funciones de la base de datos ───────────────────────────────

// OBTENER todos los registros ordenados por fecha
function obtenerTodos() {
  return db.prepare("SELECT * FROM registros ORDER BY fecha DESC").all()
}

// CREAR un nuevo registro
function crear(registro) {
  const stmt = db.prepare(`
    INSERT INTO registros (fecha, hombres, mujeres, ninos, total, predicador, mensaje)
    VALUES (@fecha, @hombres, @mujeres, @ninos, @total, @predicador, @mensaje)
  `)
  return stmt.run(registro)
}

// ACTUALIZAR un registro existente por su id
function actualizar(id, registro) {
  const stmt = db.prepare(`
    UPDATE registros
    SET fecha = @fecha,
        hombres = @hombres,
        mujeres = @mujeres,
        ninos = @ninos,
        total = @total,
        predicador = @predicador,
        mensaje = @mensaje
    WHERE id = @id
  `)
  return stmt.run({ ...registro, id })
}

// ELIMINAR un registro por su id
function eliminar(id) {
  return db.prepare("DELETE FROM registros WHERE id = ?").run(id)
}

// Exportamos las funciones para usarlas en server.js
module.exports = { obtenerTodos, crear, actualizar, eliminar }