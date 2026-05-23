const bcrypt = require("bcryptjs")
const jwt    = require("jsonwebtoken")

const SECRET = process.env.JWT_SECRET || "nazarapp-secret-2024"

async function hashearPassword(password) {
  return await bcrypt.hash(password, 10)
}

async function verificarPassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

function generarToken(usuario) {
  return jwt.sign(
    {
      id:     usuario.id,
      email:  usuario.email,
      nombre: usuario.nombre,
      rol:    usuario.rol        // ← incluimos el rol en el token
    },
    SECRET,
    { expiresIn: "8h" }
  )
}

function verificarToken(token) {
  return jwt.verify(token, SECRET)
}

// ─── Middleware: requiere autenticación ───────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"]
  if (!authHeader) {
    return res.status(401).json({ error: "No autorizado" })
  }

  const token = authHeader.split(" ")[1]
  try {
    req.usuario = verificarToken(token)
    next()
  } catch (e) {
    res.status(401).json({ error: "Token inválido o expirado" })
  }
}

// ─── Middleware: requiere rol específico ──────────────────────────
function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "No autenticado" })
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "Sin permisos para esta acción" })
    }
    next()
  }
}

module.exports = {
  hashearPassword, verificarPassword,
  generarToken, verificarToken,
  requireAuth, requireRol
}