const bcrypt = require("bcryptjs")
const jwt    = require("jsonwebtoken")

// Clave secreta para firmar los tokens
// En producción esto debería estar en una variable de entorno
const SECRET = process.env.JWT_SECRET || "iglesia-nazareno-secret-2024"

// ─── Hashear una contraseña ───────────────────────────────────────
async function hashearPassword(password) {
  return await bcrypt.hash(password, 10)
}

// ─── Verificar contraseña contra su hash ─────────────────────────
async function verificarPassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

// ─── Generar un token JWT ─────────────────────────────────────────
function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
    SECRET,
    { expiresIn: "8h" }   // el token expira en 8 horas
  )
}

// ─── Verificar un token JWT ───────────────────────────────────────
function verificarToken(token) {
  return jwt.verify(token, SECRET)
}

// ─── Middleware: protege rutas que requieren login ─────────────────
// Un middleware es una función que corre ANTES de que llegue al handler
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"]

  if (!authHeader) {
    return res.status(401).json({ error: "No autorizado" })
  }

  // El header viene como "Bearer TOKEN" — extraemos solo el token
  const token = authHeader.split(" ")[1]

  try {
    const usuario = verificarToken(token)
    req.usuario   = usuario   // guardamos el usuario en la petición
    next()                    // continúa al handler de la ruta
  } catch (e) {
    res.status(401).json({ error: "Token inválido o expirado" })
  }
}

module.exports = { hashearPassword, verificarPassword, generarToken, requireAuth }