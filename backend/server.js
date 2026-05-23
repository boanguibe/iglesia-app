require("dotenv").config()
const express = require("express")
const cors    = require("cors")
const path    = require("path")
const db      = require("./database")
const auth    = require("./auth")

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "../frontend")))

// ─── Archivos PWA ─────────────────────────────────────────────────
app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/manifest.json"))
})

app.get("/sw.js", (req, res) => {
  res.setHeader("Service-Worker-Allowed", "/")
  res.sendFile(path.join(__dirname, "../frontend/sw.js"))
})

// ─── Enviar notificación por email ────────────────────────────────
async function enviarNotificacion(registro) {
  if (!process.env.RESEND_API_KEY) {
    console.log("⚠️ RESEND_API_KEY no configurada — email no enviado")
    return
  }

  const { Resend }    = require("resend")
  const clienteResend = new Resend(process.env.RESEND_API_KEY)

  try {
    await clienteResend.emails.send({
      from:    "Iglesia App <onboarding@resend.dev>",
      to:      process.env.EMAIL_DESTINO,
      subject: `📋 Nuevo registro — ${registro.fecha}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1d4ed8, #3b82f6);
                      padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">✝️ Iglesia del Nazareno</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">
              Los Lobos — Talcahuano
            </p>
          </div>
          <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px;
                      border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; font-size: 16px; margin-top: 0;">
              Nuevo registro de asistencia
            </h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #64748b; width: 40%;">📅 Fecha</td>
                <td style="padding: 10px 0; color: #1e293b; font-weight: 600;">${registro.fecha}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #64748b;">🎤 Dirigido por</td>
                <td style="padding: 10px 0; color: #1e293b;">${registro.dirigido_por}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #64748b;">📖 Predicador</td>
                <td style="padding: 10px 0; color: #1e293b;">${registro.predicador}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #64748b;">💬 Mensaje</td>
                <td style="padding: 10px 0; color: #1e293b;">${registro.mensaje}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #64748b;">👨 Hombres</td>
                <td style="padding: 10px 0; color: #1e293b;">${registro.hombres}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #64748b;">👩 Mujeres</td>
                <td style="padding: 10px 0; color: #1e293b;">${registro.mujeres}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; color: #64748b;">👧 Niños</td>
                <td style="padding: 10px 0; color: #1e293b;">${registro.ninos}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;">👥 Total</td>
                <td style="padding: 10px 0; color: #3b82f6; font-weight: 700;
                            font-size: 18px;">${registro.total}</td>
              </tr>
            </table>
          </div>
        </div>
      `
    })
    console.log(`📧 Email enviado para registro del ${registro.fecha}`)
  } catch (error) {
    console.error("❌ Error enviando email:", error)
  }
}

// ─── RUTAS PÚBLICAS ───────────────────────────────────────────────
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

app.post("/api/setup", async (req, res) => {
  const { nombre, email, password } = req.body
  if (db.contarUsuarios() > 0) {
    return res.status(403).json({ error: "Ya existe un usuario registrado" })
  }
  const hash = await auth.hashearPassword(password)
  db.crearUsuario(nombre, email, hash, "admin")  // ← primer usuario siempre es admin
  res.json({ ok: true, mensaje: "Usuario admin creado correctamente" })
})

// ─── RUTAS PROTEGIDAS ─────────────────────────────────────────────
app.get("/api/registros", auth.requireAuth, (req, res) => {
  try {
    res.json(db.obtenerTodos())
  } catch (e) {
    res.status(500).json({ error: "Error al obtener registros" })
  }
})

app.post("/api/registros", auth.requireAuth, async (req, res) => {
  try {
    const resultado = db.crear(req.body)
    await enviarNotificacion(req.body)
    res.json({ ok: true, id: resultado.lastInsertRowid })
  } catch (e) {
    res.status(500).json({ error: "Error al crear registro" })
  }
})

app.put("/api/registros/:id", auth.requireAuth, (req, res) => {
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


// ─── RUTAS DE MIEMBROS (protegidas) ──────────────────────────────

app.get("/api/miembros", auth.requireAuth, (req, res) => {
  try {
    res.json(db.obtenerTodosMiembros())
  } catch (e) {
    res.status(500).json({ error: "Error al obtener miembros" })
  }
})

app.get("/api/miembros/:id", auth.requireAuth, (req, res) => {
  try {
    const miembro = db.obtenerMiembroPorId(req.params.id)
    if (!miembro) return res.status(404).json({ error: "Miembro no encontrado" })
    res.json(miembro)
  } catch (e) {
    res.status(500).json({ error: "Error al obtener miembro" })
  }
})

app.post("/api/miembros", auth.requireAuth, (req, res) => {
  try {
    const { cargos, discipulados, ...datos } = req.body
    const id = db.crearMiembro(datos, cargos || [], discipulados || [])
    res.json({ ok: true, id })
  } catch (e) {
    res.status(500).json({ error: "Error al crear miembro" })
  }
})

app.put("/api/miembros/:id", auth.requireAuth, (req, res) => {
  try {
    const { cargos, discipulados, ...datos } = req.body
    db.actualizarMiembro(req.params.id, datos, cargos || [], discipulados || [])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar miembro" })
  }
})

app.delete("/api/miembros/:id", auth.requireAuth, (req, res) => {
  try {
    db.eliminarMiembro(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar miembro" })
  }
})

// ─── TIPOS DE CARGO ───────────────────────────────────────────────
app.get("/api/tipos-cargo", auth.requireAuth, (req, res) => {
  try { res.json(db.obtenerTiposCargo()) }
  catch (e) { res.status(500).json({ error: "Error al obtener tipos de cargo" }) }
})

app.post("/api/tipos-cargo", auth.requireAuth, (req, res) => {
  try {
    db.crearTipoCargo(req.body.nombre)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: "Ya existe ese cargo" }) }
})

app.delete("/api/tipos-cargo/:id", auth.requireAuth, (req, res) => {
  try {
    db.eliminarTipoCargo(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: "Error al eliminar cargo" }) }
})

// ─── TIPOS DE DISCIPULADO ─────────────────────────────────────────
app.get("/api/tipos-discipulado", auth.requireAuth, (req, res) => {
  try { res.json(db.obtenerTiposDiscipulado()) }
  catch (e) { res.status(500).json({ error: "Error al obtener tipos de discipulado" }) }
})

app.post("/api/tipos-discipulado", auth.requireAuth, (req, res) => {
  try {
    db.crearTipoDiscipulado(req.body.nombre)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: "Ya existe ese discipulado" }) }
})

app.delete("/api/tipos-discipulado/:id", auth.requireAuth, (req, res) => {
  try {
    db.eliminarTipoDiscipulado(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: "Error al eliminar discipulado" }) }
})

// ─── GESTIÓN DE USUARIOS (solo admin) ────────────────────────────

// Obtener todos los usuarios
app.get("/api/usuarios",
  auth.requireAuth,
  auth.requireRol("admin"),
  (req, res) => {
    try {
      res.json(db.obtenerTodosUsuarios())
    } catch (e) {
      res.status(500).json({ error: "Error al obtener usuarios" })
    }
  }
)

// Crear nuevo usuario
app.post("/api/usuarios",
  auth.requireAuth,
  auth.requireRol("admin"),
  async (req, res) => {
    try {
      const { nombre, email, password, rol } = req.body
      if (!nombre || !email || !password || !rol) {
        return res.status(400).json({ error: "Todos los campos son requeridos" })
      }
      const usuarioExistente = db.buscarUsuarioPorEmail(email)
      if (usuarioExistente) {
        return res.status(400).json({ error: "Ese email ya está registrado" })
      }
      const hash = await auth.hashearPassword(password)
      db.crearUsuario(nombre, email, hash, rol)
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: "Error al crear usuario" })
    }
  }
)

// Actualizar usuario
app.put("/api/usuarios/:id",
  auth.requireAuth,
  auth.requireRol("admin"),
  async (req, res) => {
    try {
      const { nombre, email, rol, password } = req.body
      db.actualizarUsuario(req.params.id, nombre, email, rol)
      if (password) {
        const hash = await auth.hashearPassword(password)
        db.actualizarPasswordUsuario(req.params.id, hash)
      }
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: "Error al actualizar usuario" })
    }
  }
)

// Eliminar usuario
app.delete("/api/usuarios/:id",
  auth.requireAuth,
  auth.requireRol("admin"),
  (req, res) => {
    try {
      if (Number(req.params.id) === req.usuario.id) {
        return res.status(400).json({ error: "No puedes eliminarte a ti mismo" })
      }
      db.eliminarUsuario(req.params.id)
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: "Error al eliminar usuario" })
    }
  }
)

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
})