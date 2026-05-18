let miembros       = []
let idEditando     = null
let contadorDisc   = 0

// ─── Arranque ─────────────────────────────────────────────────────
requireLogin()
mostrarUsuario()
cargarMiembros()

// ─── Cargar miembros ──────────────────────────────────────────────
async function cargarMiembros() {
  const respuesta = await fetchAuth("/api/miembros")
  if (!respuesta) return
  miembros = await respuesta.json()
  actualizarResumen()
  renderizarTabla(miembros)
}

// ─── Resumen estadístico ──────────────────────────────────────────
function actualizarResumen() {
  const total      = miembros.length
  const activos    = miembros.filter(m => m.estado === "activo").length
  const bautizados = miembros.filter(m => m.bautizado === "si").length
  const discTotal  = miembros.reduce((acc, m) => acc + (m.discipulados?.length || 0), 0)

  document.getElementById("total-miembros").textContent   = total
  document.getElementById("total-activos").textContent    = activos
  document.getElementById("total-bautizados").textContent = bautizados
  document.getElementById("total-discipulados").textContent = discTotal
}

// ─── Renderizar tabla ─────────────────────────────────────────────
function renderizarTabla(lista) {
  const tbody = document.getElementById("cuerpo-tabla-miembros")
  tbody.innerHTML = ""

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="sin-registros">
      No hay miembros que coincidan.</td></tr>`
    return
  }

  for (const m of lista) {
    const cargosHtml = m.cargos.length > 0
      ? m.cargos.map(c => `<span class="cargo-tag">${c.cargo}</span>`).join("")
      : '<span style="color:#aaa; font-size:12px;">Sin cargo</span>'

    const estadoBadge = m.estado === "activo"
      ? `<span style="color:#10b981; font-weight:600;">● Activo</span>`
      : `<span style="color:#ef4444; font-weight:600;">● Inactivo</span>`

    const tipoBadge = m.tipo === "miembro"
      ? "Miembro"
      : "Asistente"

    tbody.innerHTML += `
      <tr>
        <td><strong>${m.nombre}</strong></td>
        <td>${tipoBadge}</td>
        <td>${estadoBadge}</td>
        <td>${cargosHtml}</td>
        <td>${m.bautizado === "si" ? "💧 Sí" : "No"}</td>
        <td style="text-align:center;">${m.discipulados?.length || 0}</td>
        <td>${m.telefono || "—"}</td>
        <td>
          <button class="btn-editar"   onclick="editarMiembro(${m.id})">✏️ Editar</button>
          <button class="btn-eliminar" onclick="eliminarMiembro(${m.id})">🗑️ Eliminar</button>
        </td>
      </tr>
    `
  }
}

// ─── Filtrar miembros ─────────────────────────────────────────────
function filtrarMiembros() {
  const texto  = document.getElementById("filtro-miembros").value.toLowerCase()
  const estado = document.getElementById("filtro-estado").value

  const resultado = miembros.filter(m => {
    const coincideTexto  = !texto  || m.nombre.toLowerCase().includes(texto)
    const coincideEstado = !estado || m.estado === estado
    return coincideTexto && coincideEstado
  })

  renderizarTabla(resultado)
}

// ─── Guardar miembro ──────────────────────────────────────────────
async function guardarMiembro() {
  const nombre          = document.getElementById("nombre").value.trim()
  const fecha_registro  = document.getElementById("fecha_registro").value

  if (!nombre || !fecha_registro) {
    document.getElementById("error").style.display = "block"
    return
  }

  document.getElementById("error").style.display = "none"

  const datos = {
    nombre,
    fecha_registro,
    fecha_nacimiento: document.getElementById("fecha_nacimiento").value,
    direccion:        document.getElementById("direccion").value,
    telefono:         document.getElementById("telefono").value,
    correo:           document.getElementById("correo").value,
    tipo:             document.getElementById("tipo").value,
    estado:           document.getElementById("estado").value,
    anios_iglesia:    Number(document.getElementById("anios_iglesia").value) || 0,
    bautizado:        document.getElementById("bautizado").value,
    otros_datos:      document.getElementById("otros_datos").value
  }

  // Leer cargos seleccionados
  const cargos = Array.from(
    document.querySelectorAll(".cargos-grid input[type=checkbox]:checked")
  ).map(cb => cb.value)

  // Leer discipulados
  const discipulados = []
  document.querySelectorAll(".discipulado-item").forEach(item => {
    const nombre_discipulado = item.querySelector(".disc-nombre").value.trim()
    const fecha_inicio       = item.querySelector(".disc-inicio").value
    const fecha_fin          = item.querySelector(".disc-fin").value
    if (nombre_discipulado) {
      discipulados.push({ nombre_discipulado, fecha_inicio, fecha_fin })
    }
  })

  const payload = { ...datos, cargos, discipulados }

  if (idEditando === null) {
    await fetchAuth("/api/miembros", {
      method: "POST",
      body:   JSON.stringify(payload)
    })
  } else {
    await fetchAuth(`/api/miembros/${idEditando}`, {
      method: "PUT",
      body:   JSON.stringify(payload)
    })
    idEditando = null
  }

  await cargarMiembros()
  limpiarFormulario()
  modoNuevo()
  window.scrollTo({ top: 0, behavior: "smooth" })
}

// ─── Editar miembro ───────────────────────────────────────────────
async function editarMiembro(id) {
  const respuesta = await fetchAuth(`/api/miembros/${id}`)
  if (!respuesta) return
  const m = await respuesta.json()

  document.getElementById("nombre").value          = m.nombre
  document.getElementById("fecha_registro").value  = m.fecha_registro
  document.getElementById("fecha_nacimiento").value = m.fecha_nacimiento || ""
  document.getElementById("direccion").value       = m.direccion || ""
  document.getElementById("telefono").value        = m.telefono || ""
  document.getElementById("correo").value          = m.correo || ""
  document.getElementById("tipo").value            = m.tipo
  document.getElementById("estado").value          = m.estado
  document.getElementById("anios_iglesia").value   = m.anios_iglesia
  document.getElementById("bautizado").value       = m.bautizado
  document.getElementById("otros_datos").value     = m.otros_datos || ""

  // Marcar cargos
  document.querySelectorAll(".cargos-grid input[type=checkbox]").forEach(cb => {
    cb.checked = m.cargos.some(c => c.cargo === cb.value)
  })

  // Cargar discipulados
  document.getElementById("lista-discipulados").innerHTML = ""
  contadorDisc = 0
  for (const d of m.discipulados) {
    agregarDiscipulado(d.nombre_discipulado, d.fecha_inicio, d.fecha_fin)
  }

  idEditando = id
  modoEdicion()
  window.scrollTo({ top: 0, behavior: "smooth" })
}

// ─── Eliminar miembro ─────────────────────────────────────────────
async function eliminarMiembro(id) {
  if (!confirm("¿Estás seguro de eliminar este miembro?")) return
  await fetchAuth(`/api/miembros/${id}`, { method: "DELETE" })
  await cargarMiembros()
}

// ─── Agregar fila de discipulado ──────────────────────────────────
function agregarDiscipulado(nombre = "", inicio = "", fin = "") {
  const id       = contadorDisc++
  const lista    = document.getElementById("lista-discipulados")
  const div      = document.createElement("div")
  div.className  = "discipulado-item"
  div.id         = `disc-${id}`
  div.innerHTML  = `
    <div class="campo">
      <label>Nombre del discipulado</label>
      <input type="text" class="disc-nombre" value="${nombre}"
        placeholder="Ej: Discipulado Básico">
    </div>
    <div class="campo">
      <label>Fecha inicio</label>
      <input type="date" class="disc-inicio" value="${inicio}">
    </div>
    <div class="campo">
      <label>Fecha fin</label>
      <input type="date" class="disc-fin" value="${fin}">
    </div>
    <button class="btn-quitar-disc" onclick="quitarDiscipulado('disc-${id}')">
      ✕
    </button>
  `
  lista.appendChild(div)
}

function quitarDiscipulado(id) {
  document.getElementById(id)?.remove()
}

// ─── Limpiar formulario ───────────────────────────────────────────
function limpiarFormulario() {
  document.getElementById("nombre").value           = ""
  document.getElementById("fecha_registro").value   = ""
  document.getElementById("fecha_nacimiento").value = ""
  document.getElementById("direccion").value        = ""
  document.getElementById("telefono").value         = ""
  document.getElementById("correo").value           = ""
  document.getElementById("anios_iglesia").value    = ""
  document.getElementById("otros_datos").value      = ""
  document.getElementById("tipo").value             = "miembro"
  document.getElementById("estado").value           = "activo"
  document.getElementById("bautizado").value        = "no"
  document.querySelectorAll(".cargos-grid input[type=checkbox]")
    .forEach(cb => cb.checked = false)
  document.getElementById("lista-discipulados").innerHTML = ""
  contadorDisc = 0
}

// ─── Modos ────────────────────────────────────────────────────────
function modoEdicion() {
  document.getElementById("titulo-formulario").textContent = "✏️ Editando Miembro"
  const btn = document.getElementById("btn-principal")
  btn.textContent = "Actualizar Miembro"
  btn.classList.add("editando")
  document.getElementById("btn-cancelar").style.display = "flex"
}

function modoNuevo() {
  document.getElementById("titulo-formulario").textContent = "➕ Nuevo Miembro"
  const btn = document.getElementById("btn-principal")
  btn.textContent = "💾 Guardar Miembro"
  btn.classList.remove("editando")
  document.getElementById("btn-cancelar").style.display = "none"
}

function cancelarEdicion() {
  idEditando = null
  limpiarFormulario()
  modoNuevo()
}