const express = require("express")
const cors    = require("cors")
const path    = require("path")
const db      = require("./database")

const app  = express()
const PORT = process.env.PORT || 3000

// ─── Middlewares ──────────────────────────────────────────────────
// Middlewares son funciones que procesan cada petición antes de llegar a las rutas

app.use(cors())                    // permite peticiones desde el frontend
app.use(express.json())            // permite leer JSON en las peticiones
app.use(express.static(           // sirve los archivos del frontend
  path.join(__dirname, "../frontend")
))

// ─── RUTAS DE LA API ──────────────────────────────────────────────

// GET /api/registros → obtener todos los registros
app.get("/api/registros", (req, res) => {
  try {
    const registros = db.obtenerTodos()
    res.json(registros)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener registros" })
  }
})

// POST /api/registros → crear un nuevo registro
app.post("/api/registros", (req, res) => {
  try {
    const resultado = db.crear(req.body)
    res.json({ ok: true, id: resultado.lastInsertRowid })
  } catch (error) {
    res.status(500).json({ error: "Error al crear registro" })
  }
})

// PUT /api/registros/:id → actualizar un registro existente
app.put("/api/registros/:id", (req, res) => {
  try {
    db.actualizar(req.params.id, req.body)
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar registro" })
  }
})

// DELETE /api/registros/:id → eliminar un registro
app.delete("/api/registros/:id", (req, res) => {
  try {
    db.eliminar(req.params.id)
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar registro" })
  }
})

// ─── Iniciar el servidor ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
})