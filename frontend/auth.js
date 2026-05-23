// ─── Token y sesión ───────────────────────────────────────────────
function guardarToken(token, nombre, rol) {
  localStorage.setItem("token",   token)
  localStorage.setItem("usuario", nombre)
  localStorage.setItem("rol",     rol)
}

function obtenerToken()  { return localStorage.getItem("token") }
function obtenerRol()    { return localStorage.getItem("rol") }
function obtenerNombre() { return localStorage.getItem("usuario") }

function cerrarSesion() {
  localStorage.removeItem("token")
  localStorage.removeItem("usuario")
  localStorage.removeItem("rol")
  window.location.href = "/login.html"
}

// ─── Proteger páginas ─────────────────────────────────────────────
const PERMISOS = {
  "/":                 ["admin", "pastor", "secretario", "musico"],
  "/index.html":       ["admin", "pastor", "secretario", "musico"],
  "/dashboard.html":   ["admin", "pastor"],
  "/miembros.html":    ["admin", "pastor", "secretario"],
  "/estadisticas.html":["admin", "pastor"],
  "/usuarios.html":    ["admin"]
}

function requireLogin() {
  const token = obtenerToken()
  if (!token) {
    window.location.href = "/login.html"
    return false
  }

  // Verificar permiso para esta página
  const pagina  = window.location.pathname
  const rol     = obtenerRol()
  const permitidos = PERMISOS[pagina] || ["admin"]

  if (!permitidos.includes(rol)) {
    window.location.href = "/"
    return false
  }

  return true
}

// ─── Mostrar nombre y ocultar nav según rol ───────────────────────
function mostrarUsuario() {
  const nombre = obtenerNombre()
  const rol    = obtenerRol()
  const el     = document.getElementById("nombre-usuario")
  if (el && nombre) el.textContent = nombre

  // Mostrar badge de rol
  const badge = document.getElementById("rol-badge")
  if (badge) {
    const labels = {
      admin:      "Admin",
      pastor:     "Pastor",
      secretario: "Secretario",
      musico:     "Músico"
    }
    badge.textContent = labels[rol] || rol
    badge.style.display = "inline"
  }

  // Ocultar links de nav según rol
  ocultarNavSegunRol(rol)
}

function ocultarNavSegunRol(rol) {
  const restricciones = {
    dashboard:    ["admin", "pastor"],
    miembros:     ["admin", "pastor", "secretario"],
    estadisticas: ["admin", "pastor"],
    usuarios:     ["admin"]
  }

  Object.entries(restricciones).forEach(([pagina, rolesPermitidos]) => {
    const link = document.getElementById(`nav-${pagina}`)
    if (link) {
      link.style.display = rolesPermitidos.includes(rol) ? "" : "none"
    }
  })
}

// ─── fetch con autenticación ──────────────────────────────────────
async function fetchAuth(url, opciones = {}) {
  const token = obtenerToken()

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...opciones.headers
  }

  const respuesta = await fetch(url, { ...opciones, headers })

  if (respuesta.status === 401) {
    cerrarSesion()
    return null
  }

  if (respuesta.status === 403) {
    alert("No tienes permisos para realizar esta acción.")
    return null
  }

  return respuesta
}

// ─── Login ────────────────────────────────────────────────────────
async function iniciarSesion() {
  const email    = document.getElementById("email").value
  const password = document.getElementById("password").value
  const btnLogin = document.getElementById("btn-login")

  if (!email || !password) {
    document.getElementById("error").style.display = "block"
    return
  }

  btnLogin.textContent = "Verificando..."
  btnLogin.disabled    = true

  try {
    const respuesta = await fetch("/api/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password })
    })

    const datos = await respuesta.json()

    if (!respuesta.ok) {
      document.getElementById("error").style.display = "block"
      btnLogin.textContent = "Entrar"
      btnLogin.disabled    = false
      return
    }

    guardarToken(datos.token, datos.nombre, datos.rol)
    window.location.href = "/"

  } catch (error) {
    console.error("Error en login:", error)
    btnLogin.textContent = "Entrar"
    btnLogin.disabled    = false
  }
}