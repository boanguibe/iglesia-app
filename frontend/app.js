// ─── Estado de la aplicación ──────────────────────────────────────
let registros      = []
let indiceEditando = -1
let idEditando     = null   // NUEVO: guardamos el id real de la BD

// ─── Cargar registros desde el servidor ──────────────────────────
async function cargarRegistros() {
  try {
    const respuesta = await fetch("/api/registros")
    registros       = await respuesta.json()
    actualizarTabla()
    actualizarResumen()
  } catch (error) {
    console.error("Error al cargar registros:", error)
  }
}

// ─── Calcular total en tiempo real ───────────────────────────────
function calcularTotal() {
  const hombres = Number(document.getElementById("hombres").value)
  const mujeres = Number(document.getElementById("mujeres").value)
  const ninos   = Number(document.getElementById("ninos").value)
  document.getElementById("total").textContent = hombres + mujeres + ninos
}

// ─── Guardar o Actualizar ─────────────────────────────────────────
async function guardarRegistro() {

  const fecha      = document.getElementById("fecha").value
  const hombres    = Number(document.getElementById("hombres").value)
  const mujeres    = Number(document.getElementById("mujeres").value)
  const ninos      = Number(document.getElementById("ninos").value)
  const predicador = document.getElementById("predicador").value
  const mensaje    = document.getElementById("mensaje").value

  if (!fecha || !predicador || !mensaje) {
    document.getElementById("error").style.display = "block"
    return
  }

  document.getElementById("error").style.display = "none"

  const registro = {
    fecha, hombres, mujeres, ninos,
    total: hombres + mujeres + ninos,
    predicador, mensaje
  }

  try {

    if (idEditando === null) {
      // ── Modo nuevo: POST a la API ────────────────────────────
      await fetch("/api/registros", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(registro)
      })

    } else {
      // ── Modo edición: PUT a la API ───────────────────────────
      await fetch(`/api/registros/${idEditando}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(registro)
      })
      idEditando     = null
      indiceEditando = -1
    }

    // Recarga los registros desde el servidor
    await cargarRegistros()
    limpiarFormulario()
    modoNuevo()

  } catch (error) {
    console.error("Error al guardar:", error)
  }
}

// ─── Cargar registro en formulario para editar ────────────────────
function editarRegistro(indice) {
  const r = registros[indice]

  document.getElementById("fecha").value       = r.fecha
  document.getElementById("hombres").value     = r.hombres
  document.getElementById("mujeres").value     = r.mujeres
  document.getElementById("ninos").value       = r.ninos
  document.getElementById("predicador").value  = r.predicador
  document.getElementById("mensaje").value     = r.mensaje
  document.getElementById("total").textContent = r.total

  indiceEditando = indice
  idEditando     = r.id    // guardamos el id real de la base de datos

  modoEdicion()
  actualizarTabla()
  window.scrollTo({ top: 0, behavior: "smooth" })
}

// ─── Eliminar un registro ─────────────────────────────────────────
async function eliminarRegistro(indice) {
  const confirmar = confirm("¿Estás seguro de eliminar este registro?")
  if (!confirmar) return

  const id = registros[indice].id

  try {
    await fetch(`/api/registros/${id}`, { method: "DELETE" })
    await cargarRegistros()
  } catch (error) {
    console.error("Error al eliminar:", error)
  }
}

// ─── Cancelar edición ────────────────────────────────────────────
function cancelarEdicion() {
  idEditando     = null
  indiceEditando = -1
  limpiarFormulario()
  modoNuevo()
  actualizarTabla()
}

// ─── Modo edición / modo nuevo ────────────────────────────────────
function modoEdicion() {
  document.getElementById("titulo-formulario").textContent = "✏️ Editando Registro"
  const btn = document.getElementById("btn-principal")
  btn.textContent = "Actualizar Registro"
  btn.classList.add("editando")
  document.getElementById("btn-cancelar").style.display = "flex"
}

function modoNuevo() {
  document.getElementById("titulo-formulario").textContent = "Nueva Entrada"
  const btn = document.getElementById("btn-principal")
  btn.textContent = "💾 Guardar Registro"
  btn.classList.remove("editando")
  document.getElementById("btn-cancelar").style.display = "none"
}

// ─── Actualizar tabla en pantalla ─────────────────────────────────
function actualizarTabla() {
  const tbody = document.getElementById("cuerpo-tabla")
  tbody.innerHTML = ""

  if (registros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="sin-registros">✝️ No hay registros aún. ¡Agrega el primero!</td></tr>`
    return
  }

  for (let i = 0; i < registros.length; i++) {
    const r           = registros[i]
    const filaActiva  = (i === indiceEditando) ? "editando-fila" : ""

    tbody.innerHTML += `
      <tr class="${filaActiva}">
        <td>${r.fecha}</td>
        <td>${r.hombres}</td>
        <td>${r.mujeres}</td>
        <td>${r.ninos}</td>
        <td><strong>${r.total}</strong></td>
        <td>${r.predicador}</td>
        <td>${r.mensaje}</td>
        <td>
          <button class="btn-editar"   onclick="editarRegistro(${i})">✏️ Editar</button>
          <button class="btn-eliminar" onclick="eliminarRegistro(${i})">🗑️ Eliminar</button>
        </td>
      </tr>
    `
  }
}

// ─── Actualizar tarjetas de resumen ──────────────────────────────
function actualizarResumen() {
  const totalCultos   = registros.length
  let   totalPersonas = 0

  for (let i = 0; i < registros.length; i++) {
    totalPersonas += registros[i].total
  }

  const promedio = totalCultos > 0 ? Math.round(totalPersonas / totalCultos) : 0

  document.getElementById("total-cultos").textContent      = totalCultos
  document.getElementById("total-personas").textContent    = totalPersonas
  document.getElementById("promedio-asistencia").textContent = promedio
}

// ─── Exportar a Excel ─────────────────────────────────────────────
function exportarExcel() {
  if (registros.length === 0) {
    alert("No hay registros para exportar.")
    return
  }

  let datos = [
    ["Fecha", "Hombres", "Mujeres", "Niños", "Total", "Predicador", "Tema del mensaje"]
  ]

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i]
    datos.push([r.fecha, r.hombres, r.mujeres, r.ninos, r.total, r.predicador, r.mensaje])
  }

  let totalGeneral = 0
  for (let i = 0; i < registros.length; i++) {
    totalGeneral += registros[i].total
  }
  datos.push(["TOTAL GENERAL", "", "", "", totalGeneral, "", ""])

  const hoja  = XLSX.utils.aoa_to_sheet(datos)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, "Asistencia")

  const fechaHoy      = new Date().toISOString().split("T")[0]
  const nombreArchivo = `asistencia-iglesia-${fechaHoy}.xlsx`
  XLSX.writeFile(libro, nombreArchivo)
}

// ─── Imprimir informe ─────────────────────────────────────────────
function imprimirInforme() {
  if (registros.length === 0) {
    alert("No hay registros para imprimir.")
    return
  }

  const hoy         = new Date()
  const opciones    = { year: "numeric", month: "long", day: "numeric" }
  const fechaFormato = hoy.toLocaleDateString("es-CL", opciones)

  let fechaEl = document.getElementById("fecha-emision")
  if (!fechaEl) {
    fechaEl           = document.createElement("p")
    fechaEl.id        = "fecha-emision"
    fechaEl.className = "fecha-emision"
    document.querySelector(".tabla-wrapper").before(fechaEl)
  }

  fechaEl.textContent = `Emitido el ${fechaFormato}`
  window.print()
}

// ─── Limpiar formulario ───────────────────────────────────────────
function limpiarFormulario() {
  document.getElementById("fecha").value       = ""
  document.getElementById("hombres").value     = ""
  document.getElementById("mujeres").value     = ""
  document.getElementById("ninos").value       = ""
  document.getElementById("predicador").value  = ""
  document.getElementById("mensaje").value     = ""
  document.getElementById("total").textContent = "0"
}

// ─── Arranque ─────────────────────────────────────────────────────
cargarRegistros()