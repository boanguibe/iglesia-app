const express  = require("express")
const cors     = require("cors")
const path     = require("path")
const db       = require("./database")
const auth     = require("./auth")

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "../frontend")))

// Archivos PWA — deben servirse desde la raíz
app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/manifest.json"))
})

app.get("/sw.js", (req, res) => {
  res.setHeader("Service-Worker-Allowed", "/")
  res.sendFile(path.join(__dirname, "../frontend/sw.js"))
})

// ─── RUTAS PÚBLICAS (no requieren login) ─────────────────────────

// POST /api/login → iniciar sesión
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña requeridos" })
  }

  const usuario = db.buscarUsuarioPorEmail(email)

  if (!usuario) {
    return res.status(401).json({ error: "Credenciales incorrectas" })
  }

  const passwordCorrecta = await auth.verificarPassword(password, usuario.password)

  if (!passwordCorrecta) {
    return res.status(401).json({ error: "Credenciales incorrectas" })
  }

  const token = auth.generarToken(usuario)
  res.json({ token, nombre: usuario.nombre })
})

// POST /api/setup → crear el primer usuario (solo si no hay ninguno)
app.post("/api/setup", async (req, res) => {
  const { nombre, email, password } = req.body

  if (db.contarUsuarios() > 0) {
    return res.status(403).json({ error: "Ya existe un usuario registrado" })
  }

  const hash = await auth.hashearPassword(password)
  db.crearUsuario(nombre, email, hash)
  res.json({ ok: true, mensaje: "Usuario creado correctamente" })
})

// ─── RUTAS PROTEGIDAS (requieren login) ──────────────────────────

app.get("/api/registros",      auth.requireAuth, (req, res) => {
  try {
    res.json(db.obtenerTodos())
  } catch (e) {
    res.status(500).json({ error: "Error al obtener registros" })
  }
})

app.post("/api/registros",     auth.requireAuth, (req, res) => {
  try {
    const resultado = db.crear(req.body)
    res.json({ ok: true, id: resultado.lastInsertRowid })
  } catch (e) {
    res.status(500).json({ error: "Error al crear registro" })
  }
})

app.put("/api/registros/:id",  auth.requireAuth, (req, res) => {
  try {
    db.actualizar(req.params.id, req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar registro" })
  }
})

app.delete("/api/registros/:id", auth.requireAuth, (req, res) => {
  try {
    db.eliminar(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar registro" })
  }
})

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
})