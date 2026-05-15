// ─── Variables para los gráficos ──────────────────────────────────
// Las guardamos para poder destruirlas antes de redibujar
let graficoAsistencia    = null
let graficoDistribucion  = null
let graficoPredicadores  = null

// ─── Cargar datos y construir todo ────────────────────────────────
async function iniciarDashboard() {
  try {
    const respuesta = await fetch("/api/registros")
    const registros = await respuesta.json()

    if (registros.length === 0) {
      mostrarMensajeVacio()
      return
    }

    // Los registros vienen ordenados por fecha DESC — los invertimos
    // para que el gráfico de línea vaya de más antiguo a más reciente
    const ordenados = [...registros].reverse()

    actualizarResumen(registros)
    dibujarGraficoAsistencia(ordenados)
    dibujarGraficoDistribucion(registros)
    dibujarGraficoPredicadores(registros)

  } catch (error) {
    console.error("Error al cargar datos:", error)
  }
}

// ─── Tarjetas de resumen ──────────────────────────────────────────
function actualizarResumen(registros) {
  const totalCultos   = registros.length
  let   totalPersonas = 0
  let   mayorAsistencia = 0

  for (let i = 0; i < registros.length; i++) {
    totalPersonas += registros[i].total
    if (registros[i].total > mayorAsistencia) {
      mayorAsistencia = registros[i].total
    }
  }

  const promedio = Math.round(totalPersonas / totalCultos)

  document.getElementById("total-cultos").textContent      = totalCultos
  document.getElementById("total-personas").textContent    = totalPersonas
  document.getElementById("promedio-asistencia").textContent = promedio
  document.getElementById("mejor-culto").textContent       = mayorAsistencia
}

// ─── Gráfico 1: Línea de asistencia en el tiempo ─────────────────
function dibujarGraficoAsistencia(registros) {
  const labels = registros.map(r => r.fecha)
  const data   = registros.map(r => r.total)

  if (graficoAsistencia) graficoAsistencia.destroy()

  graficoAsistencia = new Chart(
    document.getElementById("grafico-asistencia"),
    {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Total asistentes",
          data,
          borderColor:     "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.1)",
          borderWidth: 2,
          pointBackgroundColor: "#3b82f6",
          pointRadius: 5,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 5 }
          }
        }
      }
    }
  )
}

// ─── Gráfico 2: Torta de distribución ─────────────────────────────
function dibujarGraficoDistribucion(registros) {
  let hombres = 0
  let mujeres = 0
  let ninos   = 0

  for (let i = 0; i < registros.length; i++) {
    hombres += registros[i].hombres
    mujeres += registros[i].mujeres
    ninos   += registros[i].ninos
  }

  if (graficoDistribucion) graficoDistribucion.destroy()

  graficoDistribucion = new Chart(
    document.getElementById("grafico-distribucion"),
    {
      type: "doughnut",
      data: {
        labels: ["Hombres", "Mujeres", "Niños"],
        datasets: [{
          data: [hombres, mujeres, ninos],
          backgroundColor: ["#3b82f6", "#ec4899", "#f59e0b"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 20, font: { family: "Poppins" } }
          }
        }
      }
    }
  )
}

// ─── Gráfico 3: Barras por predicador ────────────────────────────
function dibujarGraficoPredicadores(registros) {

  // Agrupar registros por predicador
  const porPredicador = {}

  for (let i = 0; i < registros.length; i++) {
    const nombre = registros[i].predicador

    if (!porPredicador[nombre]) {
      porPredicador[nombre] = { total: 0, cultos: 0 }
    }

    porPredicador[nombre].total  += registros[i].total
    porPredicador[nombre].cultos += 1
  }

  // Calcular promedio por predicador y ordenar de mayor a menor
  const predicadores = Object.keys(porPredicador)
  const promedios    = predicadores.map(nombre => {
    const p = porPredicador[nombre]
    return Math.round(p.total / p.cultos)
  })

  // Ordenar por promedio descendente
  const indices  = promedios.map((_, i) => i).sort((a, b) => promedios[b] - promedios[a])
  const labelsOrdenados   = indices.map(i => predicadores[i])
  const promOrdenados     = indices.map(i => promedios[i])

  if (graficoPredicadores) graficoPredicadores.destroy()

  graficoPredicadores = new Chart(
    document.getElementById("grafico-predicadores"),
    {
      type: "bar",
      data: {
        labels: labelsOrdenados,
        datasets: [{
          label: "Promedio asistentes",
          data: promOrdenados,
          backgroundColor: "rgba(59,130,246,0.8)",
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 5 }
          }
        }
      }
    }
  )
}

// ─── Mensaje cuando no hay datos ──────────────────────────────────
function mostrarMensajeVacio() {
  document.querySelector(".graficos-grid").innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #64748b;">
      <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
      <p style="font-size: 16px;">Aún no hay registros suficientes para mostrar gráficos.</p>
      <a href="/" style="color: #3b82f6; font-weight: 600;">← Ir a ingresar registros</a>
    </div>
  `
}

// ─── Arranque ─────────────────────────────────────────────────────
iniciarDashboard()