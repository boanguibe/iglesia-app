let usuarios   = []
let idEditando = null

requireLogin()
mostrarUsuario()
cargarUsuarios()

// ─── Cargar usuarios ──────────────────────────────────────────────
async function cargarUsuarios() {
  const r = await fetchAuth("/api/usuarios")
  if (!r) return
  usuarios = await r.json()
  renderizarTabla()
}

// ─── Renderizar tabla ─────────────────────────────────────────────
function renderizarTabla() {
  const tbody = document.getElementById("cuerpo-tabla-usuarios")
  tbody.innerHTML = ""

  if (usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="sin-registros">
      No hay usuarios registrados.</td></tr>`
    return
  }

  const rolLabels = {
    admin:      "⚙️ Admin",
    pastor:     "⛪ Pastor",
    secretario: "📋 Secretario",
    musico:     "🎵 Músico"
  }

  const permisoLabels = {
    registros:    "📋",
    dashboard:    "📊",
    miembros:     "👥",
    estadisticas: "📈",
    usuarios:     "⚙️"
  }

  for (const u of usuarios) {
    const esMiMismo    = u.id === obtenerIdUsuario()
    const permisosHtml = u.permisos.length > 0
      ? u.permisos.map(p =>
          `<span class="cargo-tag">${permisoLabels[p] || p}</span>`
        ).join("")
      : '<span style="color:#aaa; font-size:12px;">Sin acceso</span>'

    tbody.innerHTML += `
      <tr>
        <td>
          <strong>${u.nombre}</strong>
          ${esMiMismo ? '<span class="cargo-tag">Tú</span>' : ""}
        </td>
        <td>${u.email}</td>
        <td>${rolLabels[u.rol] || u.rol}</td>
        <td>${permisosHtml}</td>
        <td>
          <button class="btn-editar" onclick="editarUsuario(${u.id})">
            ✏️ Editar
          </button>
          ${!esMiMismo ? `
          <button class="btn-eliminar"
            onclick="eliminarUsuario(${u.id}, '${u.nombre}')">
            🗑️ Eliminar
          </button>` : ""}
        </td>
      </tr>
    `
  }
}

// ─── Leer permisos seleccionados ──────────────────────────────────
function leerPermisos() {
  return Array.from(
    document.querySelectorAll("input[name='permiso']:checked")
  ).map(cb => cb.value)
}

// ─── Marcar permisos ──────────────────────────────────────────────
function marcarPermisos(permisos) {
  document.querySelectorAll("input[name='permiso']").forEach(cb => {
    cb.checked = permisos.includes(cb.value)
  })
}

// ─── Guardar o actualizar ─────────────────────────────────────────
async function guardarUsuario() {
  const nombre   = document.getElementById("u-nombre").value.trim()
  const email    = document.getElementById("u-email").value.trim()
  const password = document.getElementById("u-password").value
  const rol      = document.getElementById("u-rol").value
  const permisos = leerPermisos()

  const errorEl  = document.getElementById("u-error")
  const errorTxt = document.getElementById("u-error-texto")

  if (!nombre || !email || !rol) {
    errorTxt.textContent  = "Nombre, email y rol son obligatorios."
    errorEl.style.display = "block"
    return
  }

  if (idEditando === null && !password) {
    errorTxt.textContent  = "La contraseña es obligatoria para usuarios nuevos."
    errorEl.style.display = "block"
    return
  }

  if (permisos.length === 0 && rol !== "admin") {
    errorTxt.textContent  = "Debes asignar al menos un permiso."
    errorEl.style.display = "block"
    return
  }

  errorEl.style.display = "none"

  // Admin siempre tiene todos los permisos
  const permisosFinales = rol === "admin"
    ? ["registros", "dashboard", "miembros", "estadisticas", "usuarios"]
    : permisos

  const payload = { nombre, email, rol, permisos: permisosFinales }
  if (password) payload.password = password

  if (idEditando === null) {
    const r = await fetchAuth("/api/usuarios", {
      method: "POST",
      body:   JSON.stringify(payload)
    })
    if (!r) return
    const data = await r.json()
    if (data.error) {
      errorTxt.textContent  = data.error
      errorEl.style.display = "block"
      return
    }
  } else {
    await fetchAuth(`/api/usuarios/${idEditando}`, {
      method: "PUT",
      body:   JSON.stringify(payload)
    })
    idEditando = null
  }

  await cargarUsuarios()
  limpiarFormulario()
  modoNuevo()
}

// ─── Editar usuario ───────────────────────────────────────────────
function editarUsuario(id) {
  const u = usuarios.find(u => u.id === id)
  if (!u) return

  document.getElementById("u-nombre").value   = u.nombre
  document.getElementById("u-email").value    = u.email
  document.getElementById("u-rol").value      = u.rol
  document.getElementById("u-password").value = ""
  document.getElementById("u-password").placeholder = "Dejar vacío para no cambiar"

  marcarPermisos(u.permisos)

  idEditando = id
  modoEdicion()
  window.scrollTo({ top: 0, behavior: "smooth" })
}

// ─── Eliminar ─────────────────────────────────────────────────────
async function eliminarUsuario(id, nombre) {
  if (!confirm(`¿Eliminar al usuario "${nombre}"?`)) return
  await fetchAuth(`/api/usuarios/${id}`, { method: "DELETE" })
  await cargarUsuarios()
}

// ─── Limpiar formulario ───────────────────────────────────────────
function limpiarFormulario() {
  document.getElementById("u-nombre").value   = ""
  document.getElementById("u-email").value    = ""
  document.getElementById("u-password").value = ""
  document.getElementById("u-rol").value      = "musico"
  document.getElementById("u-password").placeholder = "Mínimo 6 caracteres"
  document.getElementById("u-error").style.display  = "none"
  document.querySelectorAll("input[name='permiso']")
    .forEach(cb => cb.checked = false)
}

// ─── Modos ────────────────────────────────────────────────────────
function modoEdicion() {
  document.getElementById("titulo-formulario").textContent = "✏️ Editando Usuario"
  const btn = document.getElementById("btn-principal")
  btn.textContent = "Actualizar Usuario"
  btn.classList.add("editando")
  document.getElementById("btn-cancelar").style.display = "flex"
}

function modoNuevo() {
  document.getElementById("titulo-formulario").textContent = "➕ Nuevo Usuario"
  const btn = document.getElementById("btn-principal")
  btn.textContent = "💾 Crear Usuario"
  btn.classList.remove("editando")
  document.getElementById("btn-cancelar").style.display = "none"
}

function cancelarEdicion() {
  idEditando = null
  limpiarFormulario()
  modoNuevo()
}