// ─── Token y sesión ───────────────────────────────────────────────
function guardarToken(token, nombre, rol, permisos) {
  localStorage.setItem("token",    token)
  localStorage.setItem("usuario",  nombre)
  localStorage.setItem("rol",      rol || "musico")
  localStorage.setItem("permisos", JSON.stringify(permisos || []))
}

function obtenerToken()   { return localStorage.getItem("token") }
function obtenerRol()     { return localStorage.getItem("rol") || "musico" }
function obtenerNombre()  { return localStorage.getItem("usuario") }
function obtenerPermisos() {
  try {
    return JSON.parse(localStorage.getItem("permisos") || "[]")
  } catch { return [] }
}

function tienePermiso(pagina) {
  const rol = obtenerRol()
  if (rol === "admin") return true   // admin siempre tiene acceso
  return obtenerPermisos().includes(pagina)
}

function cerrarSesion() {
  localStorage.clear()
  window.location.href = "/login.html"
}

// ─── Mapa página → permiso ────────────────────────────────────────
const MAPA_PERMISOS = {
  "/":                  "registros",
  "/index.html":        "registros",
  "/dashboard.html":    "dashboard",
  "/miembros.html":     "miembros",
  "/estadisticas.html": "estadisticas",
  "/usuarios.html":     "usuarios"
}

// ─── Proteger páginas ─────────────────────────────────────────────
function requireLogin() {
  const token = obtenerToken()
  if (!token) {
    window.location.href = "/login.html"
    return false
  }

  const pagina  = window.location.pathname
  const permiso = MAPA_PERMISOS[pagina]

  // Si la página requiere un permiso y no lo tiene
  if (permiso && !tienePermiso(permiso)) {
    // Buscar primera página con permiso
    const permisos = obtenerPermisos()
    const rol      = obtenerRol()

    if (rol === "admin" || permisos.includes("registros")) {
      if (pagina !== "/" && pagina !== "/index.html") {
        window.location.href = "/"
      }
    } else {
      cerrarSesion()
    }
    return false
  }

  return true
}

// ─── Mostrar usuario y ocultar nav según permisos ─────────────────
function mostrarUsuario() {
  const nombre = obtenerNombre()
  const rol    = obtenerRol()

  const elNombre = document.getElementById("nombre-usuario")
  if (elNombre && nombre) elNombre.textContent = nombre

  const badge = document.getElementById("rol-badge")
  if (badge) {
    const labels = {
      admin:      "Admin",
      pastor:     "Pastor",
      secretario: "Secretario",
      musico:     "Músico"
    }
    badge.textContent   = labels[rol] || rol
    badge.style.display = "inline"
  }

  // Mostrar/ocultar links según permisos
  const mapaNav = {
    "nav-registros":    "registros",
    "nav-dashboard":    "dashboard",
    "nav-miembros":     "miembros",
    "nav-estadisticas": "estadisticas",
    "nav-usuarios":     "usuarios"
  }

  Object.entries(mapaNav).forEach(([id, permiso]) => {
    const link = document.getElementById(id)
    if (link) {
      link.style.display = tienePermiso(permiso) ? "" : "none"
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

    guardarToken(datos.token, datos.nombre, datos.rol, datos.permisos)
    window.location.href = "/"

  } catch (error) {
    console.error("Error en login:", error)
    btnLogin.textContent = "Entrar"
    btnLogin.disabled    = false
  }
}

// ─── Obtener id del usuario desde el token ────────────────────────
function obtenerIdUsuario() {
  const token = obtenerToken()
  if (!token) return null
  try {
    return JSON.parse(atob(token.split(".")[1])).id
  } catch { return null }
}