// ─── Guardar y leer el token ──────────────────────────────────────
function guardarToken(token, nombre) {
  localStorage.setItem("token",   token)
  localStorage.setItem("usuario", nombre)
}

function obtenerToken() {
  return localStorage.getItem("token")
}

function cerrarSesion() {
  localStorage.removeItem("token")
  localStorage.removeItem("usuario")
  window.location.href = "/login.html"
}

// ─── Proteger páginas: si no hay token, redirige al login ─────────
function requireLogin() {
  const token = obtenerToken()
  if (!token) {
    window.location.href = "/login.html"
    return false
  }
  return true
}

// ─── Mostrar nombre del usuario en el header ──────────────────────
function mostrarUsuario() {
  const nombre = localStorage.getItem("usuario")
  const el     = document.getElementById("nombre-usuario")
  if (el && nombre) el.textContent = nombre
}

// ─── fetch protegido: agrega el token automáticamente ────────────
async function fetchAuth(url, opciones = {}) {
  const token = obtenerToken()

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...opciones.headers
  }

  const respuesta = await fetch(url, { ...opciones, headers })

  // Si el servidor responde 401, la sesión expiró
  if (respuesta.status === 401) {
    cerrarSesion()
    return null
  }

  return respuesta
}

// ─── Lógica del formulario de login ──────────────────────────────
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

    guardarToken(datos.token, datos.nombre)
    window.location.href = "/"

  } catch (error) {
    console.error("Error en login:", error)
    btnLogin.textContent = "Entrar"
    btnLogin.disabled    = false
  }
}