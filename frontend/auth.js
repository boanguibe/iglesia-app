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
  if (rol === "admin") return true
  return obtenerPermisos().includes(pagina)
}

function cerrarSesion() {
  localStorage.clear()
  window.location.href = "/login.html"
}

// ─── Primera ruta accesible según permisos ────────────────────────
function obtenerPrimeraRuta() {
  const rol      = obtenerRol()
  if (rol === "admin") return "/"

  const orden = [
    { permiso: "registros",    ruta: "/" },
    { permiso: "miembros",     ruta: "/miembros.html" },
    { permiso: "dashboard",    ruta: "/dashboard.html" },
    { permiso: "estadisticas", ruta: "/estadisticas.html" },
    { permiso: "tesoreria",    ruta: "/tesoreria.html" },
    { permiso: "usuarios",     ruta: "/usuarios.html" }
  ]

  for (const item of orden) {
    if (tienePermiso(item.permiso)) return item.ruta
  }

  return null  // sin ningún permiso
}

// ─── Mapa página → permiso ────────────────────────────────────────
const MAPA_PERMISOS = {
  "/":                  "registros",
  "/index.html":        "registros",
  "/dashboard.html":    "dashboard",
  "/miembros.html":     "miembros",
  "/estadisticas.html": "estadisticas",
  "/tesoreria.html":    "tesoreria", // ← nuevo
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

  if (permiso && !tienePermiso(permiso)) {
    // No tiene permiso para esta página
    // Buscar la primera página a la que sí tiene acceso
    const primeraRuta = obtenerPrimeraRuta()

    if (primeraRuta && pagina !== primeraRuta) {
      window.location.href = primeraRuta
    } else if (!primeraRuta) {
      // No tiene ningún permiso → logout
      cerrarSesion()
    }
    return false
  }

  return true
}

// ─── Mostrar usuario y nav según permisos ─────────────────────────
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

  const mapaNav = {
    "nav-registros":    "registros",
    "nav-dashboard":    "dashboard",
    "nav-miembros":     "miembros",
    "nav-estadisticas": "estadisticas",
    "nav-tesoreria":    "tesoreria",
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

    // Redirigir a la primera página con permiso
    const primeraRuta = obtenerPrimeraRuta()
    window.location.href = primeraRuta || "/login.html"

  } catch (error) {
    console.error("Error en login:", error)
    btnLogin.textContent = "Entrar"
    btnLogin.disabled    = false
  }
}

// ─── Obtener id del token ─────────────────────────────────────────
function obtenerIdUsuario() {
  const token = obtenerToken()
  if (!token) return null
  try {
    return JSON.parse(atob(token.split(".")[1])).id
  } catch { return null }
}