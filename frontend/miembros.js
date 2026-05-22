let miembros     = []
let idEditando   = null
let contadorDisc = 0
let tiposCargo   = []
let tiposDisc    = []

// ─── Arranque ─────────────────────────────────────────────────────
requireLogin()
mostrarUsuario()
iniciar()

async function iniciar() {
  await Promise.all([
    cargarTiposCargo(),
    cargarTiposDiscipulado(),
    cargarMiembros()
  ])
}

// ─── Cargar tipos de cargo ────────────────────────────────────────
async function cargarTiposCargo() {
  const r = await fetchAuth("/api/tipos-cargo")
  if (!r) return
  tiposCargo = await r.json()
  renderizarCargosGrid()
  renderizarListaTiposCargo()
}

function renderizarCargosGrid() {
  const grid = document.getElementById("cargos-grid")
  grid.innerHTML = tiposCargo.map(t => `
    <label class="cargo-opcion">
      <input type="checkbox" value="${t.nombre}"> ${t.nombre}
    </label>
  `).join("")
}

function renderizarListaTiposCargo() {
  const lista = document.getElementById("lista-tipos-cargo")
  if (!lista) return
  lista.innerHTML = tiposCargo.map(t => `
    <div class="tipo-item">
      <span>${t.nombre}</span>
      <button class="btn-quitar-tipo" onclick="eliminarTipoCargo(${t.id}, '${t.nombre}')">
        ✕ Eliminar
      </button>
    </div>
  `).join("") || '<p style="color:#aaa; font-size:13px;">No hay tipos definidos.</p>'
}

async function agregarTipoCargo() {
  const input  = document.getElementById("nuevo-cargo")
  const nombre = input.value.trim()
  if (!nombre) return

  await fetchAuth("/api/tipos-cargo", {
    method: "POST",
    body:   JSON.stringify({ nombre })
  })

  input.value = ""
  await cargarTiposCargo()
}

async function eliminarTipoCargo(id, nombre) {
  if (!confirm(`¿Eliminar el cargo "${nombre}"?`)) return
  await fetchAuth(`/api/tipos-cargo/${id}`, { method: "DELETE" })
  await cargarTiposCargo()
}

// ─── Cargar tipos de discipulado ──────────────────────────────────
async function cargarTiposDiscipulado() {
  const r = await fetchAuth("/api/tipos-discipulado")
  if (!r) return
  tiposDisc = await r.json()
  renderizarListaTiposDiscipulado()
}

function renderizarListaTiposDiscipulado() {
  const lista = document.getElementById("lista-tipos-discipulado")
  if (!lista) return
  lista.innerHTML = tiposDisc.map(t => `
    <div class="tipo-item">
      <span>${t.nombre}</span>
      <button class="btn-quitar-tipo" onclick="eliminarTipoDiscipulado(${t.id}, '${t.nombre}')">
        ✕ Eliminar
      </button>
    </div>
  `).join("") || '<p style="color:#aaa; font-size:13px;">No hay tipos definidos.</p>'
}

async function agregarTipoDiscipulado() {
  const input  = document.getElementById("nuevo-discipulado")
  const nombre = input.value.trim()
  if (!nombre) return

  await fetchAuth("/api/tipos-discipulado", {
    method: "POST",
    body:   JSON.stringify({ nombre })
  })

  input.value = ""
  await cargarTiposDiscipulado()
}

async function eliminarTipoDiscipulado(id, nombre) {
  if (!confirm(`¿Eliminar el tipo de discipulado "${nombre}"?`)) return
  await fetchAuth(`/api/tipos-discipulado/${id}`, { method: "DELETE" })
  await cargarTiposDiscipulado()
}

// ─── Toggle panel gestión ─────────────────────────────────────────
function toggleGestionar(panelId) {
  const panel = document.getElementById(panelId)
  panel.style.display = panel.style.display === "none" ? "block" : "none"
}

// ─── Calcular años en la iglesia ──────────────────────────────────
function calcularAniosIglesia() {
  const fechaReg = document.getElementById("fecha_registro").value
  if (!fechaReg) return
  const hoy    = new Date()
  const inicio = new Date(fechaReg)
  const anios  = Math.floor((hoy - inicio) / (365.25 * 24 * 60 * 60 * 1000))
  document.getElementById("anios_iglesia").value = anios < 0 ? 0 : anios
}

// ─── Cargar miembros ──────────────────────────────────────────────
async function cargarMiembros() {
  const r = await fetchAuth("/api/miembros")
  if (!r) return
  miembros = await r.json()
  actualizarResumen()
  renderizarTabla(miembros)
  dibujarGraficos()        // ← agrega esta línea
}

// ─── Resumen estadístico ──────────────────────────────────────────
function actualizarResumen() {
  const total      = miembros.length
  const activos    = miembros.filter(m => m.estado === "activo").length
  const bautizados = miembros.filter(m => m.bautizado === "si").length
  const discTotal  = miembros.reduce((acc, m) => acc + (m.discipulados?.length || 0), 0)

  document.getElementById("total-miembros").textContent    = total
  document.getElementById("total-activos").textContent     = activos
  document.getElementById("total-bautizados").textContent  = bautizados
  document.getElementById("total-discipulados").textContent = discTotal
}

// ─── Dibujar todos los gráficos ───────────────────────────────────
let graficos = {}

function dibujarGraficos() {
  if (miembros.length === 0) return

  dibujarDonaEstado()
  dibujarDonaTipo()
  dibujarDonaBautizados()
  dibujarBarrasCargos()
  dibujarLineaCrecimiento()
}

// ─── Colores paleta borgoña ───────────────────────────────────────
const COLORES = {
  borgoña:    "#8B2635",
  borgoñaClaro: "#F5E8EB",
  dorado:     "#C67B2F",
  doradoClaro: "#FDF3E7",
  verde:      "#2D6A4F",
  verdeClaro: "#D8F3DC",
  morado:     "#5B3A6B",
  moradoClaro: "#EDE0F5",
  gris:       "#7A6058",
  grisClaro:  "#F5EFE6"
}

// ─── Gráfico 1: Estado (Activo/Inactivo) ─────────────────────────
function dibujarDonaEstado() {
  const activos   = miembros.filter(m => m.estado === "activo").length
  const inactivos = miembros.length - activos

  if (graficos.estado) graficos.estado.destroy()

  graficos.estado = new Chart(
    document.getElementById("grafico-estado"), {
      type: "doughnut",
      data: {
        labels: ["Activos", "Inactivos"],
        datasets: [{
          data: [activos, inactivos],
          backgroundColor: [COLORES.verde, COLORES.gris],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 16, font: { family: "Poppins", size: 12 } }
          }
        }
      }
    }
  )
}

// ─── Gráfico 2: Tipo (Miembro/Asistente) ─────────────────────────
function dibujarDonaTipo() {
  const miembrosCount   = miembros.filter(m => m.tipo === "miembro").length
  const asistentesCount = miembros.length - miembrosCount

  if (graficos.tipo) graficos.tipo.destroy()

  graficos.tipo = new Chart(
    document.getElementById("grafico-tipo"), {
      type: "doughnut",
      data: {
        labels: ["Miembros", "Asistentes"],
        datasets: [{
          data: [miembrosCount, asistentesCount],
          backgroundColor: [COLORES.borgoña, COLORES.dorado],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 16, font: { family: "Poppins", size: 12 } }
          }
        }
      }
    }
  )
}

// ─── Gráfico 3: Bautizados ────────────────────────────────────────
function dibujarDonaBautizados() {
  const bautizados    = miembros.filter(m => m.bautizado === "si").length
  const noBautizados  = miembros.length - bautizados

  if (graficos.bautizados) graficos.bautizados.destroy()

  graficos.bautizados = new Chart(
    document.getElementById("grafico-bautizados"), {
      type: "doughnut",
      data: {
        labels: ["Bautizados", "No bautizados"],
        datasets: [{
          data: [bautizados, noBautizados],
          backgroundColor: [COLORES.morado, COLORES.gris],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 16, font: { family: "Poppins", size: 12 } }
          }
        }
      }
    }
  )
}

// ─── Gráfico 4: Cargos más frecuentes ────────────────────────────
function dibujarBarrasCargos() {
  const conteo = {}

  for (const m of miembros) {
    for (const c of m.cargos) {
      conteo[c.cargo] = (conteo[c.cargo] || 0) + 1
    }
  }

  // Ordenar de mayor a menor y tomar los top 8
  const ordenados = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const labels = ordenados.map(([cargo]) => cargo)
  const data   = ordenados.map(([, count]) => count)

  if (graficos.cargos) graficos.cargos.destroy()

  graficos.cargos = new Chart(
    document.getElementById("grafico-cargos"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Cantidad",
          data,
          backgroundColor: COLORES.borgoña,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: "Poppins" }
            }
          },
          x: {
            ticks: {
              font: { family: "Poppins", size: 11 },
              maxRotation: 45
            }
          }
        }
      }
    }
  )
}

// ─── Gráfico 5: Crecimiento por año ──────────────────────────────
function dibujarLineaCrecimiento() {
  const porAnio = {}

  for (const m of miembros) {
    if (!m.fecha_registro) continue
    const anio = m.fecha_registro.substring(0, 4)
    porAnio[anio] = (porAnio[anio] || 0) + 1
  }

  const aniosOrdenados = Object.keys(porAnio).sort()
  const labels         = aniosOrdenados
  const data           = aniosOrdenados.map(a => porAnio[a])

  // Acumulado
  const dataAcumulado = []
  let acum = 0
  for (const d of data) {
    acum += d
    dataAcumulado.push(acum)
  }

  if (graficos.crecimiento) graficos.crecimiento.destroy()

  graficos.crecimiento = new Chart(
    document.getElementById("grafico-crecimiento"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Nuevos registros",
            data,
            borderColor: COLORES.dorado,
            backgroundColor: COLORES.doradoClaro,
            borderWidth: 2,
            pointBackgroundColor: COLORES.dorado,
            pointRadius: 5,
            fill: true,
            tension: 0.3
          },
          {
            label: "Total acumulado",
            data: dataAcumulado,
            borderColor: COLORES.borgoña,
            backgroundColor: "rgba(139,38,53,0.08)",
            borderWidth: 2,
            pointBackgroundColor: COLORES.borgoña,
            pointRadius: 5,
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 16, font: { family: "Poppins", size: 12 } }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { family: "Poppins" } }
          }
        }
      }
    }
  )
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

    tbody.innerHTML += `
      <tr>
        <td><strong>${m.nombre}</strong></td>
        <td>${m.tipo === "miembro" ? "Miembro" : "Asistente"}</td>
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

// ─── Filtrar ──────────────────────────────────────────────────────
function filtrarMiembros() {
  const texto  = document.getElementById("filtro-miembros").value.toLowerCase()
  const estado = document.getElementById("filtro-estado").value

  renderizarTabla(miembros.filter(m => {
    const coincideTexto  = !texto  || m.nombre.toLowerCase().includes(texto)
    const coincideEstado = !estado || m.estado === estado
    return coincideTexto && coincideEstado
  }))
}

// ─── Guardar miembro ──────────────────────────────────────────────
async function guardarMiembro() {
  const nombre         = document.getElementById("nombre").value.trim()
  const fecha_registro = document.getElementById("fecha_registro").value

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

  const cargos = Array.from(
    document.querySelectorAll(".cargos-grid input[type=checkbox]:checked")
  ).map(cb => cb.value)

  const discipulados = []
  document.querySelectorAll(".discipulado-item").forEach(item => {
    const nombre_discipulado = item.querySelector(".disc-nombre").value
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
  const r = await fetchAuth(`/api/miembros/${id}`)
  if (!r) return
  const m = await r.json()

  document.getElementById("nombre").value           = m.nombre
  document.getElementById("fecha_registro").value   = m.fecha_registro
  document.getElementById("fecha_nacimiento").value = m.fecha_nacimiento || ""
  document.getElementById("direccion").value        = m.direccion || ""
  document.getElementById("telefono").value         = m.telefono || ""
  document.getElementById("correo").value           = m.correo || ""
  document.getElementById("tipo").value             = m.tipo
  document.getElementById("estado").value           = m.estado
  document.getElementById("anios_iglesia").value    = m.anios_iglesia
  document.getElementById("bautizado").value        = m.bautizado
  document.getElementById("otros_datos").value      = m.otros_datos || ""

  document.querySelectorAll(".cargos-grid input[type=checkbox]").forEach(cb => {
    cb.checked = m.cargos.some(c => c.cargo === cb.value)
  })

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

// ─── Agregar discipulado ──────────────────────────────────────────
function agregarDiscipulado(nombre = "", inicio = "", fin = "") {
  const id      = contadorDisc++
  const lista   = document.getElementById("lista-discipulados")
  const div     = document.createElement("div")
  div.className = "discipulado-item"
  div.id        = `disc-${id}`

  // Opciones del select desde los tipos cargados
  const opciones = tiposDisc.map(t =>
    `<option value="${t.nombre}" ${t.nombre === nombre ? "selected" : ""}>${t.nombre}</option>`
  ).join("")

  div.innerHTML = `
    <div class="campo">
      <label>Tipo de discipulado</label>
      <select class="disc-nombre"
        style="padding:10px; border:1.5px solid var(--borde); border-radius:8px;
               font-family:'Poppins',sans-serif; font-size:14px; width:100%;">
        <option value="">Seleccionar...</option>
        ${opciones}
      </select>
    </div>
    <div class="campo">
      <label>Fecha inicio</label>
      <input type="date" class="disc-inicio" value="${inicio}">
    </div>
    <div class="campo">
      <label>Fecha fin</label>
      <input type="date" class="disc-fin" value="${fin}">
    </div>
    <button class="btn-quitar-disc" onclick="quitarDiscipulado('disc-${id}')">✕</button>
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

// ─── Exportar miembros a Excel ────────────────────────────────────
function exportarMiembrosExcel() {
  if (miembros.length === 0) {
    alert("No hay miembros para exportar.")
    return
  }

  // Encabezados
  const datos = [[
    "Nombre", "Tipo", "Estado", "Fecha Registro",
    "Fecha Nacimiento", "Años Iglesia", "Bautizado",
    "Cargos", "Discipulados", "Teléfono", "Correo",
    "Dirección", "Otros datos"
  ]]

  // Filas
  for (const m of miembros) {
    const cargos      = m.cargos.map(c => c.cargo).join(", ")
    const discipulados = m.discipulados
      .map(d => d.nombre_discipulado).join(", ")

    datos.push([
      m.nombre,
      m.tipo === "miembro" ? "Miembro" : "Asistente regular",
      m.estado === "activo" ? "Activo" : "Inactivo",
      m.fecha_registro     || "",
      m.fecha_nacimiento   || "",
      m.anios_iglesia      || 0,
      m.bautizado === "si" ? "Sí" : "No",
      cargos               || "Sin cargo",
      discipulados         || "Ninguno",
      m.telefono           || "",
      m.correo             || "",
      m.direccion          || "",
      m.otros_datos        || ""
    ])
  }

  // Fila resumen al final
  const activos    = miembros.filter(m => m.estado === "activo").length
  const bautizados = miembros.filter(m => m.bautizado === "si").length
  datos.push([])
  datos.push([
    `Total: ${miembros.length} miembros`,
    `Activos: ${activos}`,
    `Inactivos: ${miembros.length - activos}`,
    `Bautizados: ${bautizados}`,
    "", "", "", "", "", "", "", "", ""
  ])

  // Crear Excel
  const hoja  = XLSX.utils.aoa_to_sheet(datos)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, "Miembros")

  const fecha         = new Date().toISOString().split("T")[0]
  const nombreArchivo = `miembros-nazarapp-${fecha}.xlsx`
  XLSX.writeFile(libro, nombreArchivo)
}

// ─── Imprimir lista de miembros ───────────────────────────────────
function imprimirMiembros() {
  if (miembros.length === 0) {
    alert("No hay miembros para imprimir.")
    return
  }

  const hoy        = new Date()
  const opciones   = { year: "numeric", month: "long", day: "numeric" }
  const fechaTexto = hoy.toLocaleDateString("es-CL", opciones)

  // Insertar o actualizar fecha de emisión
  let fechaEl = document.getElementById("fecha-emision-miembros")
  if (!fechaEl) {
    fechaEl           = document.createElement("p")
    fechaEl.id        = "fecha-emision-miembros"
    fechaEl.className = "fecha-emision"
    document.querySelector(".tabla-wrapper").before(fechaEl)
  }
  fechaEl.textContent = `Emitido el ${fechaTexto} — Total: ${miembros.length} miembros`

  window.print()
}