// ─── Variables gráficos ───────────────────────────────────────────
let graficos = {}

// ─── Paleta de colores borgoña ────────────────────────────────────
const COLORES = [
  "#8B2635", "#C67B2F", "#5B3A6B", "#2D6A4F",
  "#B85C38", "#4A6741", "#7B4A8B", "#C0392B",
  "#8E6B3E", "#3D6B8E", "#6B8E3D", "#8E3D6B"
]

const COLORES_SUAVES = [
  "#F5E8EB", "#FDF3E7", "#EDE8F5", "#E8F5EE",
  "#F5EDE8", "#E8F5EC", "#F0E8F5", "#F5E8E8"
]

// ─── Arranque ─────────────────────────────────────────────────────
requireLogin()
mostrarUsuario()
cargarEstadisticas()

// ─── Cargar datos y construir gráficos ────────────────────────────
async function cargarEstadisticas() {
  const respuesta = await fetchAuth("/api/miembros")
  if (!respuesta) return

  const miembros = await respuesta.json()

  if (miembros.length === 0) {
    mostrarSinDatos()
    return
  }

  actualizarResumen(miembros)
  dibujarGraficoTipo(miembros)
  dibujarGraficoEstado(miembros)
  dibujarGraficoBautizados(miembros)
  dibujarGraficoAnios(miembros)
  dibujarGraficoCargos(miembros)
  dibujarGraficoDiscipulados(miembros)
}

// ─── Resumen ──────────────────────────────────────────────────────
function actualizarResumen(miembros) {
  const total      = miembros.length
  const activos    = miembros.filter(m => m.estado === "activo").length
  const bautizados = miembros.filter(m => m.bautizado === "si").length
  const discTotal  = miembros.reduce((acc, m) =>
    acc + (m.discipulados?.length || 0), 0)

  document.getElementById("stat-total").textContent       = total
  document.getElementById("stat-activos").textContent     = activos
  document.getElementById("stat-bautizados").textContent  = bautizados
  document.getElementById("stat-discipulados").textContent = discTotal
}

// ─── Gráfico 1: Tipo de membresía ────────────────────────────────
function dibujarGraficoTipo(miembros) {
  const miembrosCount   = miembros.filter(m => m.tipo === "miembro").length
  const asistentesCount = miembros.filter(m => m.tipo === "asistente").length

  destruir("grafico-tipo")
  graficos["grafico-tipo"] = new Chart(
    document.getElementById("grafico-tipo"), {
      type: "doughnut",
      data: {
        labels: ["Miembros", "Asistentes regulares"],
        datasets: [{
          data: [miembrosCount, asistentesCount],
          backgroundColor: ["#8B2635", "#C67B2F"],
          borderWidth: 0
        }]
      },
      options: opcionesTorta()
    }
  )
}

// ─── Gráfico 2: Estado ────────────────────────────────────────────
function dibujarGraficoEstado(miembros) {
  const activos   = miembros.filter(m => m.estado === "activo").length
  const inactivos = miembros.filter(m => m.estado === "inactivo").length

  destruir("grafico-estado")
  graficos["grafico-estado"] = new Chart(
    document.getElementById("grafico-estado"), {
      type: "doughnut",
      data: {
        labels: ["Activos", "Inactivos"],
        datasets: [{
          data: [activos, inactivos],
          backgroundColor: ["#2D6A4F", "#C0392B"],
          borderWidth: 0
        }]
      },
      options: opcionesTorta()
    }
  )
}

// ─── Gráfico 3: Bautizados ────────────────────────────────────────
function dibujarGraficoBautizados(miembros) {
  const si = miembros.filter(m => m.bautizado === "si").length
  const no = miembros.filter(m => m.bautizado === "no").length

  destruir("grafico-bautizados")
  graficos["grafico-bautizados"] = new Chart(
    document.getElementById("grafico-bautizados"), {
      type: "doughnut",
      data: {
        labels: ["Bautizados", "No bautizados"],
        datasets: [{
          data: [si, no],
          backgroundColor: ["#5B3A6B", "#E0D0C8"],
          borderWidth: 0
        }]
      },
      options: opcionesTorta()
    }
  )
}

// ─── Gráfico 4: Años en la iglesia ───────────────────────────────
function dibujarGraficoAnios(miembros) {
  // Agrupamos en rangos
  const rangos = {
    "0-1 años":   0,
    "2-5 años":   0,
    "6-10 años":  0,
    "11-20 años": 0,
    "20+ años":   0
  }

  for (const m of miembros) {
    const a = m.anios_iglesia || 0
    if      (a <= 1)  rangos["0-1 años"]++
    else if (a <= 5)  rangos["2-5 años"]++
    else if (a <= 10) rangos["6-10 años"]++
    else if (a <= 20) rangos["11-20 años"]++
    else              rangos["20+ años"]++
  }

  destruir("grafico-anios")
  graficos["grafico-anios"] = new Chart(
    document.getElementById("grafico-anios"), {
      type: "bar",
      data: {
        labels: Object.keys(rangos),
        datasets: [{
          label: "Miembros",
          data:  Object.values(rangos),
          backgroundColor: "#8B2635",
          borderRadius: 6
        }]
      },
      options: opcionesBarras("Cantidad de miembros")
    }
  )
}

// ─── Gráfico 5: Por cargo ─────────────────────────────────────────
function dibujarGraficoCargos(miembros) {
  const conteo = {}

  for (const m of miembros) {
    for (const c of (m.cargos || [])) {
      conteo[c.cargo] = (conteo[c.cargo] || 0) + 1
    }
  }

  // Ordenar de mayor a menor
  const ordenado = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])

  const labels = ordenado.map(e => e[0])
  const datos  = ordenado.map(e => e[1])

  destruir("grafico-cargos")
  graficos["grafico-cargos"] = new Chart(
    document.getElementById("grafico-cargos"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Miembros",
          data:  datos,
          backgroundColor: labels.map((_, i) =>
            COLORES[i % COLORES.length]
          ),
          borderRadius: 6
        }]
      },
      options: opcionesBarras("Cantidad")
    }
  )
}

// ─── Gráfico 6: Discipulados más realizados ───────────────────────
function dibujarGraficoDiscipulados(miembros) {
  const conteo = {}

  for (const m of miembros) {
    for (const d of (m.discipulados || [])) {
      const nombre = d.nombre_discipulado
      conteo[nombre] = (conteo[nombre] || 0) + 1
    }
  }

  if (Object.keys(conteo).length === 0) {
    document.getElementById("grafico-discipulados")
      .closest(".tarjeta").style.display = "none"
    return
  }

  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1])
  const labels   = ordenado.map(e => e[0])
  const datos    = ordenado.map(e => e[1])

  destruir("grafico-discipulados")
  graficos["grafico-discipulados"] = new Chart(
    document.getElementById("grafico-discipulados"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Veces realizado",
          data:  datos,
          backgroundColor: "#C67B2F",
          borderRadius: 6
        }]
      },
      options: opcionesBarras("Veces realizado")
    }
  )
}

// ─── Opciones reutilizables ───────────────────────────────────────
function opcionesTorta() {
  return {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 20,
          font: { family: "Poppins", size: 12 }
        }
      }
    }
  }
}

function opcionesBarras(labelY = "") {
  return {
    responsive: true,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: { family: "Poppins" }
        },
        title: {
          display: !!labelY,
          text: labelY,
          font: { family: "Poppins", size: 12 }
        }
      },
      x: {
        ticks: { font: { family: "Poppins" } }
      }
    }
  }
}

// ─── Destruir gráfico anterior ────────────────────────────────────
function destruir(id) {
  if (graficos[id]) {
    graficos[id].destroy()
    delete graficos[id]
  }
}

// ─── Sin datos ────────────────────────────────────────────────────
function mostrarSinDatos() {
  document.querySelector("main").innerHTML += `
    <div style="text-align:center; padding:60px; color:var(--texto-suave);">
      <div style="font-size:48px; margin-bottom:16px;">📈</div>
      <p style="font-size:16px; font-weight:500;">
        Aún no hay miembros registrados.
      </p>
      <a href="/miembros.html"
        style="color:var(--primario); font-weight:600;">
        ← Ir a registrar miembros
      </a>
    </div>
  `
}