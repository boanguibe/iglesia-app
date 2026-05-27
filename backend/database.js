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

// ─── Migración: agregar columna rol a usuarios ────────────────────
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN rol TEXT NOT NULL DEFAULT 'musico'")
  console.log("✅ Migración: columna rol agregada a usuarios")
} catch (e) {
  // columna ya existe
}

// ─── Migración: agregar columna permisos ──────────────────────────
try {
  db.exec("ALTER TABLE usuarios ADD COLUMN permisos TEXT DEFAULT '[]'")
  console.log("✅ Migración: columna permisos agregada")
} catch (e) {
  // ya existe
}

// Admin tiene todos los permisos por defecto
db.prepare(`
  UPDATE usuarios
  SET permisos = '["registros","dashboard","miembros","estadisticas","usuarios"]'
  WHERE rol = 'admin' AND (permisos = '[]' OR permisos IS NULL)
`).run()

// Actualizar el primer usuario (Boris) a admin
db.prepare(`
  UPDATE usuarios SET rol = 'admin' WHERE id = 1
`).run()

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
function crearUsuario(nombre, email, passwordHash, rol = "musico", permisos = []) {
  const stmt = db.prepare(`
    INSERT INTO usuarios (nombre, email, password, rol, permisos)
    VALUES (?, ?, ?, ?, ?)
  `)
  return stmt.run(nombre, email, passwordHash, rol, JSON.stringify(permisos))
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

// ─── Tabla tipos de cargo ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tipos_cargo (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT    NOT NULL UNIQUE
  )
`)

// Poblar con valores por defecto si está vacía
const countCargos = db.prepare("SELECT COUNT(*) as total FROM tipos_cargo").get()
if (countCargos.total === 0) {
  const insertCargo = db.prepare("INSERT INTO tipos_cargo (nombre) VALUES (?)")
  const cargosPredefinidos = [
    "Pastor", "Líder MNI", "Líder JNI", "Líder DNI",
    "Concilio JNI", "Concilio MNI", "Concilio DNI",
    "Delegado", "Ecónomo", "Mayordomo", "Líder Música",
    "Músico", "Maestro", "Predicador", "Tesorero",
    "Secretario", "Líder MAM", "Sin cargo"
  ]
  for (const cargo of cargosPredefinidos) {
    insertCargo.run(cargo)
  }
}

// ─── Tabla tipos de discipulado ───────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tipos_discipulado (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT    NOT NULL UNIQUE
  )
`)

const countDisc = db.prepare("SELECT COUNT(*) as total FROM tipos_discipulado").get()
if (countDisc.total === 0) {
  const insertDisc = db.prepare("INSERT INTO tipos_discipulado (nombre) VALUES (?)")
  const discipuladosPredefinidos = [
    "Discipulado Básico", "Discipulado Avanzado",
    "Escuela de Líderes", "Fundamentos de Fe",
    "Estudio Bíblico", "Preparación Bautismal"
  ]
  for (const d of discipuladosPredefinidos) {
    insertDisc.run(d)
  }
}

// ─── Funciones tipos cargo ────────────────────────────────────────
function obtenerTiposCargo() {
  return db.prepare("SELECT * FROM tipos_cargo ORDER BY nombre ASC").all()
}

function crearTipoCargo(nombre) {
  return db.prepare("INSERT INTO tipos_cargo (nombre) VALUES (?)").run(nombre)
}

function eliminarTipoCargo(id) {
  return db.prepare("DELETE FROM tipos_cargo WHERE id = ?").run(id)
}

// ─── Funciones tipos discipulado ──────────────────────────────────
function obtenerTiposDiscipulado() {
  return db.prepare("SELECT * FROM tipos_discipulado ORDER BY nombre ASC").all()
}

function crearTipoDiscipulado(nombre) {
  return db.prepare("INSERT INTO tipos_discipulado (nombre) VALUES (?)").run(nombre)
}

function eliminarTipoDiscipulado(id) {
  return db.prepare("DELETE FROM tipos_discipulado WHERE id = ?").run(id)
}

// ─── Funciones gestión de usuarios ───────────────────────────────
function obtenerTodosUsuarios() {
  const usuarios = db.prepare(
    "SELECT id, nombre, email, rol, permisos FROM usuarios ORDER BY nombre ASC"
  ).all()
  return usuarios.map(u => ({
    ...u,
    permisos: JSON.parse(u.permisos || "[]")
  }))
}

function actualizarUsuario(id, nombre, email, rol, permisos = []) {
  return db.prepare(`
    UPDATE usuarios
    SET nombre = ?, email = ?, rol = ?, permisos = ?
    WHERE id = ?
  `).run(nombre, email, rol, JSON.stringify(permisos), id)
}

function actualizarPasswordUsuario(id, hash) {
  return db.prepare(
    "UPDATE usuarios SET password = ? WHERE id = ?"
  ).run(hash, id)
}

function eliminarUsuario(id) {
  return db.prepare("DELETE FROM usuarios WHERE id = ?").run(id)
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO TESORERÍA — Tablas
// ═══════════════════════════════════════════════════════════════════

// ─── Entidades (Iglesia, MNI, DNI, JNI) ──────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tesoro_entidades (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre              TEXT    NOT NULL UNIQUE,
    porcentaje_distrito REAL    DEFAULT 0,
    activa              INTEGER DEFAULT 1
  )
`)

// Poblar entidades por defecto si están vacías
const countEntidades = db.prepare(
  "SELECT COUNT(*) as total FROM tesoro_entidades"
).get()
if (countEntidades.total === 0) {
  const ins = db.prepare(
    "INSERT INTO tesoro_entidades (nombre, porcentaje_distrito) VALUES (?, ?)"
  )
  ins.run("Iglesia", 16)
  ins.run("MNI",     10)
  ins.run("DNI",     10)
  ins.run("JNI",     10)
}

// ─── Cuentas (Efectivo, Banco) ────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tesoro_cuentas (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT    NOT NULL,
    tipo   TEXT    NOT NULL DEFAULT 'efectivo',
    activa INTEGER DEFAULT 1
  )
`)

const countCuentas = db.prepare(
  "SELECT COUNT(*) as total FROM tesoro_cuentas"
).get()
if (countCuentas.total === 0) {
  const ins = db.prepare(
    "INSERT INTO tesoro_cuentas (nombre, tipo) VALUES (?, ?)"
  )
  ins.run("Efectivo", "efectivo")
  ins.run("Banco",    "banco")
}

// ─── Conceptos (Ofrenda Culto, Diezmos, Gastos Locales...) ────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tesoro_conceptos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre              TEXT    NOT NULL,
    tipo                TEXT    NOT NULL,
    entidad_id          INTEGER,
    aplica_distrito     INTEGER DEFAULT 0,
    porcentaje_distrito REAL    DEFAULT 0,
    activo              INTEGER DEFAULT 1
  )
`)

const countConceptos = db.prepare(
  "SELECT COUNT(*) as total FROM tesoro_conceptos"
).get()
if (countConceptos.total === 0) {
  const ins = db.prepare(`
    INSERT INTO tesoro_conceptos
      (nombre, tipo, entidad_id, aplica_distrito, porcentaje_distrito)
    VALUES (?, ?, ?, ?, ?)
  `)

  // Ingresos Iglesia
  const iglesia = db.prepare(
    "SELECT id FROM tesoro_entidades WHERE nombre = 'Iglesia'"
  ).get()
  const mni = db.prepare(
    "SELECT id FROM tesoro_entidades WHERE nombre = 'MNI'"
  ).get()
  const dni = db.prepare(
    "SELECT id FROM tesoro_entidades WHERE nombre = 'DNI'"
  ).get()
  const jni = db.prepare(
    "SELECT id FROM tesoro_entidades WHERE nombre = 'JNI'"
  ).get()

  ins.run("Ofrenda Culto",       "ingreso", iglesia.id, 1, 16)
  ins.run("Diezmos",             "ingreso", iglesia.id, 1, 16)
  ins.run("Ofrenda de Amor",     "ingreso", iglesia.id, 0, 0)
  ins.run("Ofrenda Especial",    "ingreso", iglesia.id, 0, 0)
  ins.run("Ofrendas MNI",        "ingreso", mni.id,     1, 10)
  ins.run("Ofrendas DNI",        "ingreso", dni.id,     1, 10)
  ins.run("Ofrendas JNI",        "ingreso", jni.id,     1, 10)

  // Egresos (generales)
  ins.run("Gastos Locales",        "egreso", null, 0, 0)
  ins.run("Gastos Comunes Iglesia","egreso", null, 0, 0)
  ins.run("Reparación/Construcción","egreso", null, 0, 0)
  ins.run("Aporte Distrital",      "egreso", null, 0, 0)
  ins.run("Préstamo Iglesia",      "egreso", null, 0, 0)
}

// ─── Movimientos (ingresos y egresos) ─────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tesoro_movimientos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha       TEXT    NOT NULL,
    tipo        TEXT    NOT NULL,
    concepto_id INTEGER NOT NULL,
    entidad_id  INTEGER,
    cuenta_id   INTEGER NOT NULL,
    monto       REAL    NOT NULL,
    referencia  TEXT,
    observacion TEXT,
    mes         INTEGER NOT NULL,
    anio        INTEGER NOT NULL,
    FOREIGN KEY (concepto_id) REFERENCES tesoro_conceptos(id),
    FOREIGN KEY (entidad_id)  REFERENCES tesoro_entidades(id),
    FOREIGN KEY (cuenta_id)   REFERENCES tesoro_cuentas(id)
  )
`)

// ─── Saldos Iniciales (por entidad, cuenta y mes) ─────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tesoro_saldos_iniciales (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad_id INTEGER NOT NULL,
    cuenta_id  INTEGER NOT NULL,
    mes        INTEGER NOT NULL,
    anio       INTEGER NOT NULL,
    monto      REAL    DEFAULT 0,
    UNIQUE(entidad_id, cuenta_id, mes, anio),
    FOREIGN KEY (entidad_id) REFERENCES tesoro_entidades(id),
    FOREIGN KEY (cuenta_id)  REFERENCES tesoro_cuentas(id)
  )
`)

// ─── Aportes Distritales ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tesoro_aportes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    mes            INTEGER NOT NULL,
    anio           INTEGER NOT NULL,
    detalle        TEXT    NOT NULL DEFAULT '[]',
    fem_mensual    REAL    DEFAULT 0,
    total          REAL    DEFAULT 0,
    pagado         INTEGER DEFAULT 0,
    fecha_pago     TEXT,
    transferido_por TEXT,
    transferido_a   TEXT,
    UNIQUE(mes, anio)
  )
`)

// ─── Configuración global (FEM, etc.) ─────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tesoro_config (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  )
`)

// Valores por defecto
const configDefaults = [
  ["fem_anual",             "0"],
  ["anio_eclesiastico",     "2025"],
  ["porcentaje_iglesia",    "16"],
  ["porcentaje_ministerios","10"]
]
const insConfig = db.prepare(
  "INSERT OR IGNORE INTO tesoro_config (clave, valor) VALUES (?, ?)"
)
for (const [clave, valor] of configDefaults) {
  insConfig.run(clave, valor)
}

// ════════════════════════════════════════════════════════════════════
// FUNCIONES TESORERÍA
// ════════════════════════════════════════════════════════════════════

// ─── Entidades ────────────────────────────────────────────────────
function tesObtenerEntidades() {
  return db.prepare(
    "SELECT * FROM tesoro_entidades ORDER BY id ASC"
  ).all()
}
function tesCrearEntidad(nombre, porcentaje) {
  return db.prepare(
    "INSERT INTO tesoro_entidades (nombre, porcentaje_distrito) VALUES (?, ?)"
  ).run(nombre, porcentaje)
}
function tesActualizarEntidad(id, nombre, porcentaje) {
  return db.prepare(
    "UPDATE tesoro_entidades SET nombre=?, porcentaje_distrito=? WHERE id=?"
  ).run(nombre, porcentaje, id)
}

// ─── Cuentas ──────────────────────────────────────────────────────
function tesObtenerCuentas() {
  return db.prepare(
    "SELECT * FROM tesoro_cuentas WHERE activa = 1 ORDER BY tipo, nombre"
  ).all()
}
function tesCrearCuenta(nombre, tipo) {
  return db.prepare(
    "INSERT INTO tesoro_cuentas (nombre, tipo) VALUES (?, ?)"
  ).run(nombre, tipo)
}
function tesEliminarCuenta(id) {
  return db.prepare(
    "UPDATE tesoro_cuentas SET activa = 0 WHERE id = ?"
  ).run(id)
}

// ─── Conceptos ────────────────────────────────────────────────────
function tesObtenerConceptos(tipo = null) {
  if (tipo) {
    return db.prepare(
      "SELECT * FROM tesoro_conceptos WHERE tipo=? AND activo=1 ORDER BY nombre"
    ).all(tipo)
  }
  return db.prepare(
    "SELECT * FROM tesoro_conceptos WHERE activo=1 ORDER BY tipo, nombre"
  ).all()
}
function tesCrearConcepto(nombre, tipo, entidad_id, aplica, porcentaje) {
  return db.prepare(`
    INSERT INTO tesoro_conceptos
      (nombre, tipo, entidad_id, aplica_distrito, porcentaje_distrito)
    VALUES (?, ?, ?, ?, ?)
  `).run(nombre, tipo, entidad_id || null, aplica ? 1 : 0, porcentaje)
}
function tesActualizarConcepto(id, nombre, aplica, porcentaje) {
  return db.prepare(`
    UPDATE tesoro_conceptos
    SET nombre=?, aplica_distrito=?, porcentaje_distrito=?
    WHERE id=?
  `).run(nombre, aplica ? 1 : 0, porcentaje, id)
}
function tesEliminarConcepto(id) {
  return db.prepare(
    "UPDATE tesoro_conceptos SET activo = 0 WHERE id = ?"
  ).run(id)
}

// ─── Movimientos ──────────────────────────────────────────────────
function tesObtenerMovimientos(filtros = {}) {
  let sql = `
    SELECT
      m.*,
      c.nombre  AS concepto_nombre,
      c.aplica_distrito,
      c.porcentaje_distrito AS concepto_porcentaje,
      e.nombre  AS entidad_nombre,
      cu.nombre AS cuenta_nombre,
      cu.tipo   AS cuenta_tipo
    FROM tesoro_movimientos m
    JOIN tesoro_conceptos   c  ON m.concepto_id = c.id
    LEFT JOIN tesoro_entidades e  ON m.entidad_id  = e.id
    JOIN tesoro_cuentas     cu ON m.cuenta_id   = cu.id
    WHERE 1=1
  `
  const params = []

  if (filtros.mes)  { sql += " AND m.mes  = ?"; params.push(filtros.mes) }
  if (filtros.anio) { sql += " AND m.anio = ?"; params.push(filtros.anio) }
  if (filtros.tipo) { sql += " AND m.tipo = ?"; params.push(filtros.tipo) }
  if (filtros.entidad_id) {
    sql += " AND m.entidad_id = ?"
    params.push(filtros.entidad_id)
  }
  if (filtros.concepto_id) {
    sql += " AND m.concepto_id = ?"
    params.push(filtros.concepto_id)
  }
  if (filtros.fecha_desde) {
    sql += " AND m.fecha >= ?"
    params.push(filtros.fecha_desde)
  }
  if (filtros.fecha_hasta) {
    sql += " AND m.fecha <= ?"
    params.push(filtros.fecha_hasta)
  }

  sql += " ORDER BY m.fecha DESC, m.id DESC"
  return db.prepare(sql).all(...params)
}

function tesCrearMovimiento(datos) {
  return db.prepare(`
    INSERT INTO tesoro_movimientos
      (fecha, tipo, concepto_id, entidad_id, cuenta_id,
       monto, referencia, observacion, mes, anio)
    VALUES
      (@fecha, @tipo, @concepto_id, @entidad_id, @cuenta_id,
       @monto, @referencia, @observacion, @mes, @anio)
  `).run(datos)
}

function tesActualizarMovimiento(id, datos) {
  return db.prepare(`
    UPDATE tesoro_movimientos SET
      fecha       = @fecha,
      tipo        = @tipo,
      concepto_id = @concepto_id,
      entidad_id  = @entidad_id,
      cuenta_id   = @cuenta_id,
      monto       = @monto,
      referencia  = @referencia,
      observacion = @observacion,
      mes         = @mes,
      anio        = @anio
    WHERE id = @id
  `).run({ ...datos, id })
}

function tesEliminarMovimiento(id) {
  return db.prepare(
    "DELETE FROM tesoro_movimientos WHERE id = ?"
  ).run(id)
}

// ─── Saldos iniciales ─────────────────────────────────────────────
function tesObtenerSaldoInicial(entidad_id, cuenta_id, mes, anio) {
  return db.prepare(`
    SELECT * FROM tesoro_saldos_iniciales
    WHERE entidad_id=? AND cuenta_id=? AND mes=? AND anio=?
  `).get(entidad_id, cuenta_id, mes, anio)
}

function tesGuardarSaldoInicial(entidad_id, cuenta_id, mes, anio, monto) {
  return db.prepare(`
    INSERT INTO tesoro_saldos_iniciales
      (entidad_id, cuenta_id, mes, anio, monto)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(entidad_id, cuenta_id, mes, anio)
    DO UPDATE SET monto = excluded.monto
  `).run(entidad_id, cuenta_id, mes, anio, monto)
}

// ─── Calcular saldo de un período ─────────────────────────────────
function tesCalcularSaldo(entidad_id, cuenta_id, mes, anio) {
  const saldoInicial = tesObtenerSaldoInicial(
    entidad_id, cuenta_id, mes, anio
  )
  const inicio = saldoInicial ? saldoInicial.monto : 0

  const ingresos = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM tesoro_movimientos
    WHERE tipo='ingreso' AND entidad_id=?
      AND cuenta_id=? AND mes=? AND anio=?
  `).get(entidad_id, cuenta_id, mes, anio).total

  const egresos = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM tesoro_movimientos
    WHERE tipo='egreso' AND (entidad_id=? OR entidad_id IS NULL)
      AND cuenta_id=? AND mes=? AND anio=?
  `).get(entidad_id, cuenta_id, mes, anio).total

  return {
    saldo_inicial: inicio,
    ingresos,
    egresos,
    saldo_final: inicio + ingresos - egresos
  }
}

// ─── Aportes distritales ──────────────────────────────────────────
function tesCalcularAporte(mes, anio) {
  const entidades  = tesObtenerEntidades()
  const femAnual   = Number(
    db.prepare("SELECT valor FROM tesoro_config WHERE clave='fem_anual'")
      .get()?.valor || 0
  )
  const femMensual = femAnual / 12

  const detalle = []
  let total = 0

  for (const entidad of entidades) {
    // Suma de ingresos que aplican al distrito para esta entidad
    const suma = db.prepare(`
      SELECT COALESCE(SUM(m.monto), 0) AS total
      FROM tesoro_movimientos m
      JOIN tesoro_conceptos c ON m.concepto_id = c.id
      WHERE m.tipo='ingreso' AND m.entidad_id=?
        AND m.mes=? AND m.anio=?
        AND c.aplica_distrito=1
    `).get(entidad.id, mes, anio).total

    const aporte = suma * (entidad.porcentaje_distrito / 100)
    detalle.push({
      entidad:    entidad.nombre,
      porcentaje: entidad.porcentaje_distrito,
      base:       suma,
      aporte:     Math.round(aporte)
    })
    total += aporte
  }

  return {
    mes, anio,
    detalle,
    fem_mensual: Math.round(femMensual),
    total: Math.round(total + femMensual)
  }
}

function tesGuardarAporte(mes, anio, datos) {
  return db.prepare(`
    INSERT INTO tesoro_aportes
      (mes, anio, detalle, fem_mensual, total,
       pagado, fecha_pago, transferido_por, transferido_a)
    VALUES
      (@mes, @anio, @detalle, @fem_mensual, @total,
       @pagado, @fecha_pago, @transferido_por, @transferido_a)
    ON CONFLICT(mes, anio) DO UPDATE SET
      detalle        = excluded.detalle,
      fem_mensual    = excluded.fem_mensual,
      total          = excluded.total,
      pagado         = excluded.pagado,
      fecha_pago     = excluded.fecha_pago,
      transferido_por = excluded.transferido_por,
      transferido_a   = excluded.transferido_a
  `).run({
    ...datos,
    mes, anio,
    detalle: JSON.stringify(datos.detalle)
  })
}

function tesObtenerAporte(mes, anio) {
  const aporte = db.prepare(
    "SELECT * FROM tesoro_aportes WHERE mes=? AND anio=?"
  ).get(mes, anio)
  if (!aporte) return null
  return {
    ...aporte,
    detalle: JSON.parse(aporte.detalle || "[]")
  }
}

// ─── Configuración ────────────────────────────────────────────────
function tesObtenerConfig() {
  const rows = db.prepare("SELECT * FROM tesoro_config").all()
  const config = {}
  for (const row of rows) config[row.clave] = row.valor
  return config
}

function tesActualizarConfig(clave, valor) {
  return db.prepare(
    "INSERT OR REPLACE INTO tesoro_config (clave, valor) VALUES (?, ?)"
  ).run(clave, String(valor))
}

module.exports = {
  // Asistencia
  obtenerTodos, crear, actualizar, eliminar,
  // Usuarios
  crearUsuario, buscarUsuarioPorEmail, contarUsuarios,
  obtenerTodosUsuarios, actualizarUsuario,
  actualizarPasswordUsuario, eliminarUsuario,
  // Miembros
  obtenerTodosMiembros, obtenerMiembroPorId,
  crearMiembro, actualizarMiembro, eliminarMiembro,
  // Tipos dinámicos
  obtenerTiposCargo, crearTipoCargo, eliminarTipoCargo,
  obtenerTiposDiscipulado, crearTipoDiscipulado, eliminarTipoDiscipulado,
  // Tesorería
  tesObtenerEntidades, tesCrearEntidad, tesActualizarEntidad,
  tesObtenerCuentas, tesCrearCuenta, tesEliminarCuenta,
  tesObtenerConceptos, tesCrearConcepto, tesActualizarConcepto, tesEliminarConcepto,
  tesObtenerMovimientos, tesCrearMovimiento, tesActualizarMovimiento, tesEliminarMovimiento,
  tesObtenerSaldoInicial, tesGuardarSaldoInicial, tesCalcularSaldo,
  tesCalcularAporte, tesGuardarAporte, tesObtenerAporte,
  tesObtenerConfig, tesActualizarConfig
}