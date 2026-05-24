// ─── Token y sesión ───────────────────────────────────────────────
function guardarToken(token, nombre, rol) {
  localStorage.setItem("token",   token)
  localStorage.setItem("usuario", nombre)
  localStorage.setItem("rol",     rol || "admin")
}

function obtenerToken()  { return localStorage.getItem("token") }
function obtenerRol()    { return localStorage.getItem("rol") || "admin" }
function obtenerNombre() { return localStorage.getItem("usuario") }

function cerrarSesion() {
  localStorage.clear()
  window.location.href = "/login.html"
}

// ─── Proteger páginas — solo verifica que haya sesión ────────────
function requireLogin() {
  const token = obtenerToken()
  if (!token) {
    window.location.href = "/login.html"
    return false
  }
  return true
}

// ─── Mostrar nombre y rol en el header ───────────────────────────
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
    badge.textContent  = labels[rol] || rol
    badge.style.display = "inline"
  }

  // Ocultar links según rol
  ocultarNavSegunRol(rol)
}

// ─── Ocultar nav según rol ────────────────────────────────────────
function ocultarNavSegunRol(rol) {
  const restricciones = {
    "nav-dashboard":    ["admin", "pastor"],
    "nav-miembros":     ["admin", "pastor", "secretario"],
    "nav-estadisticas": ["admin", "pastor"],
    "nav-usuarios":     ["admin"]
  }

  Object.entries(restricciones).forEach(([id, rolesPermitidos]) => {
    const link = document.getElementById(id)
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

// ─── Obtener id del usuario desde token ───────────────────────────
function obtenerIdUsuario() {
  const token = obtenerToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.id
  } catch { return null }
}