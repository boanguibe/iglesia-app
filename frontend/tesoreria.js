// ─── Estado global ────────────────────────────────────────────────
let entidades      = []
let cuentas        = []
let conceptos      = []
let movimientos    = []
let idMovEditando  = null
let configGlobal   = {}

// ─── Arranque ─────────────────────────────────────────────────────
requireLogin()
mostrarUsuario()
iniciarTesoreria()

async function iniciarTesoreria() {
  poblarSelectoresFecha()
  await Promise.all([
    cargarEntidades(),
    cargarCuentas(),
    cargarConceptos(),
    cargarConfig()
  ])
  cargarMovimientos()
}

// ─── Poblar selectores de mes/año ────────────────────────────────
const MESES = [
  "", "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
]

function poblarSelectoresFecha() {
  const hoy   = new Date()
  const mesAct = hoy.getMonth() + 1
  const anioAct = hoy.getFullYear()

  const ids = ["mov-mes","sal-mes","apo-mes"]
  ids.forEach(id => {
    const sel = document.getElementById(id)
    if (!sel) return
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option")
      opt.value = m
      opt.textContent = MESES[m]
      if (m === mesAct) opt.selected = true
      sel.appendChild(opt)
    }
  })

  const anioIds = ["mov-anio","sal-anio","apo-anio"]
  anioIds.forEach(id => {
    const sel = document.getElementById(id)
    if (!sel) return
    for (let a = anioAct - 2; a <= anioAct + 1; a++) {
      const opt = document.createElement("option")
      opt.value = a
      opt.textContent = a
      if (a === anioAct) opt.selected = true
      sel.appendChild(opt)
    }
  })
}

// ─── Cargar entidades ─────────────────────────────────────────────
async function cargarEntidades() {
  const r = await fetchAuth("/api/tesoro/entidades")
  if (!r) return
  entidades = await r.json()
  renderizarEntidades()
  poblarSelectoresEntidad()
}

function poblarSelectoresEntidad() {
  // Selector de entidad en formulario de movimiento
  const sel = document.getElementById("mov-entidad")
  if (sel) {
    sel.innerHTML = '<option value="">General</option>'
    for (const e of entidades) {
      sel.innerHTML += `<option value="${e.id}">${e.nombre}</option>`
    }
  }

  // Selector de filtro de movimientos
  const filtro = document.getElementById("mov-filtro-entidad")
  if (filtro) {
    filtro.innerHTML = '<option value="">Todas</option>'
    for (const e of entidades) {
      filtro.innerHTML += `<option value="${e.id}">${e.nombre}</option>`
    }
  }

  // Selector de entidad en nuevo concepto de ingreso
  const selCi = document.getElementById("nuevo-ci-entidad")
  if (selCi) {
    selCi.innerHTML = '<option value="">General</option>'
    for (const e of entidades) {
      selCi.innerHTML += `<option value="${e.id}">${e.nombre}</option>`
    }
  }
}

function renderizarEntidades() {
  const lista = document.getElementById("lista-entidades")
  if (!lista) return
  lista.innerHTML = entidades.map(e => `
    <div class="tipo-item" style="margin-bottom:8px;">
      <span><strong>${e.nombre}</strong></span>
      <div style="display:flex; align-items:center; gap:8px;">
        <label style="font-size:12px; color:var(--texto-suave);">% Distrito:</label>
        <input type="number" value="${e.porcentaje_distrito}" min="0" max="100"
          id="pct-entidad-${e.id}"
          style="width:70px; padding:4px 8px; border:1.5px solid var(--borde);
                 border-radius:6px; font-size:13px; text-align:center;">
        <button class="btn-editar" onclick="actualizarPorcentajeEntidad(${e.id})">
          💾 Guardar
        </button>
      </div>
    </div>
  `).join("")
}

async function actualizarPorcentajeEntidad(id) {
  const entidad = entidades.find(e => e.id === id)
  const pct     = Number(document.getElementById(`pct-entidad-${id}`).value)
  await fetchAuth(`/api/tesoro/entidades/${id}`, {
    method: "PUT",
    body:   JSON.stringify({ nombre: entidad.nombre, porcentaje: pct })
  })
  await cargarEntidades()
  alert("✅ Porcentaje actualizado")
}

// ─── Cargar cuentas ───────────────────────────────────────────────
async function cargarCuentas() {
  const r = await fetchAuth("/api/tesoro/cuentas")
  if (!r) return
  cuentas = await r.json()
  renderizarCuentas()

  const sel = document.getElementById("mov-cuenta")
  if (sel) {
    sel.innerHTML = ""
    for (const c of cuentas) {
      sel.innerHTML += `<option value="${c.id}">${c.nombre} (${c.tipo})</option>`
    }
  }
}

function renderizarCuentas() {
  const lista = document.getElementById("lista-cuentas")
  if (!lista) return
  lista.innerHTML = cuentas.map(c => `
    <div class="tipo-item" style="margin-bottom:6px;">
      <span>${c.nombre} — <em style="color:var(--texto-suave)">${c.tipo}</em></span>
      <button class="btn-quitar-tipo" onclick="eliminarCuenta(${c.id})">
        ✕ Eliminar
      </button>
    </div>
  `).join("") || '<p style="color:#aaa; font-size:13px;">No hay cuentas definidas.</p>'
}

async function agregarCuenta() {
  const nombre = document.getElementById("nueva-cuenta-nombre").value.trim()
  const tipo   = document.getElementById("nueva-cuenta-tipo").value
  if (!nombre) return
  await fetchAuth("/api/tesoro/cuentas", {
    method: "POST",
    body:   JSON.stringify({ nombre, tipo })
  })
  document.getElementById("nueva-cuenta-nombre").value = ""
  await cargarCuentas()
}

async function eliminarCuenta(id) {
  if (!confirm("¿Eliminar esta cuenta?")) return
  await fetchAuth(`/api/tesoro/cuentas/${id}`, { method: "DELETE" })
  await cargarCuentas()
}

// ─── Cargar conceptos ─────────────────────────────────────────────
async function cargarConceptos() {
  const r = await fetchAuth("/api/tesoro/conceptos")
  if (!r) return
  conceptos = await r.json()
  renderizarConceptos()
  actualizarConceptos()
}

function actualizarConceptos() {
  const tipo = document.getElementById("mov-tipo")?.value || "ingreso"
  const sel  = document.getElementById("mov-concepto")
  if (!sel) return

  const filtrados = conceptos.filter(c => c.tipo === tipo)
  sel.innerHTML = filtrados.map(c =>
    `<option value="${c.id}">${c.nombre}${c.aplica_distrito ? ` (${c.porcentaje_distrito}% dist.)` : ""}</option>`
  ).join("")
}

function actualizarEntidades() {
  const tipo = document.getElementById("mov-tipo")?.value
  const sel  = document.getElementById("mov-entidad")
  if (!sel) return
  sel.disabled = tipo === "egreso"
}

function renderizarConceptos() {
  const ingreso = conceptos.filter(c => c.tipo === "ingreso")
  const egreso  = conceptos.filter(c => c.tipo === "egreso")

  const listaI = document.getElementById("lista-conceptos-ingreso")
  if (listaI) {
    listaI.innerHTML = ingreso.map(c => `
      <div class="tipo-item" style="margin-bottom:6px;">
        <div>
          <strong>${c.nombre}</strong>
          ${c.aplica_distrito
            ? `<span class="cargo-tag" style="margin-left:6px;">${c.porcentaje_distrito}% distrito</span>`
            : ""}
        </div>
        <button class="btn-quitar-tipo" onclick="eliminarConcepto(${c.id})">
          ✕
        </button>
      </div>
    `).join("") || '<p style="color:#aaa; font-size:13px;">Sin conceptos.</p>'
  }

  const listaE = document.getElementById("lista-conceptos-egreso")
  if (listaE) {
    listaE.innerHTML = egreso.map(c => `
      <div class="tipo-item" style="margin-bottom:6px;">
        <strong>${c.nombre}</strong>
        <button class="btn-quitar-tipo" onclick="eliminarConcepto(${c.id})">✕</button>
      </div>
    `).join("") || '<p style="color:#aaa; font-size:13px;">Sin conceptos.</p>'
  }
}

async function agregarConcepto(tipo) {
  if (tipo === "ingreso") {
    const nombre     = document.getElementById("nuevo-ci-nombre").value.trim()
    const entidad_id = document.getElementById("nuevo-ci-entidad").value || null
    const porcentaje = Number(document.getElementById("nuevo-ci-porcentaje").value) || 0
    if (!nombre) return
    await fetchAuth("/api/tesoro/conceptos", {
      method: "POST",
      body:   JSON.stringify({
        nombre, tipo: "ingreso", entidad_id,
        aplica_distrito: porcentaje > 0,
        porcentaje_distrito: porcentaje
      })
    })
    document.getElementById("nuevo-ci-nombre").value     = ""
    document.getElementById("nuevo-ci-porcentaje").value = ""
  } else {
    const nombre = document.getElementById("nuevo-ce-nombre").value.trim()
    if (!nombre) return
    await fetchAuth("/api/tesoro/conceptos", {
      method: "POST",
      body:   JSON.stringify({
        nombre, tipo: "egreso", entidad_id: null,
        aplica_distrito: false, porcentaje_distrito: 0
      })
    })
    document.getElementById("nuevo-ce-nombre").value = ""
  }
  await cargarConceptos()
}

async function eliminarConcepto(id) {
  if (!confirm("¿Eliminar este concepto?")) return
  await fetchAuth(`/api/tesoro/conceptos/${id}`, { method: "DELETE" })
  await cargarConceptos()
}

// ─── Configuración ────────────────────────────────────────────────
async function cargarConfig() {
  const r = await fetchAuth("/api/tesoro/config")
  if (!r) return
  configGlobal = await r.json()

  const femInput = document.getElementById("config-fem")
  const anioInput = document.getElementById("config-anio-ecl")
  if (femInput)  femInput.value  = configGlobal.fem_anual || 0
  if (anioInput) anioInput.value = configGlobal.anio_eclesiastico || 2025
  actualizarInfoFEM()
}

function actualizarInfoFEM() {
  const fem      = Number(document.getElementById("config-fem")?.value || 0)
  const infoEl   = document.getElementById("fem-mensual-info")
  if (infoEl) {
    const mensual = Math.round(fem / 12)
    infoEl.textContent = fem > 0
      ? `Aporte mensual FEM: $${formatMonto(mensual)}`
      : ""
  }
}

async function guardarConfig() {
  const fem  = document.getElementById("config-fem").value
  const anio = document.getElementById("config-anio-ecl").value
  await fetchAuth("/api/tesoro/config", {
    method: "POST",
    body:   JSON.stringify({ fem_anual: fem, anio_eclesiastico: anio })
  })
  await cargarConfig()
  alert("✅ Configuración guardada")
}

// ─── Movimientos ──────────────────────────────────────────────────
async function cargarMovimientos() {
  const mes    = document.getElementById("mov-mes")?.value
  const anio   = document.getElementById("mov-anio")?.value
  const entidad = document.getElementById("mov-filtro-entidad")?.value
  const tipo   = document.getElementById("mov-filtro-tipo")?.value

  const params = new URLSearchParams({ mes, anio })
  if (entidad) params.append("entidad_id", entidad)
  if (tipo)    params.append("tipo", tipo)

  const r = await fetchAuth(`/api/tesoro/movimientos?${params}`)
  if (!r) return
  movimientos = await r.json()
  renderizarMovimientos()
  actualizarResumenMovimientos()
}

function actualizarResumenMovimientos() {
  let totalIngresos = 0
  let totalEgresos  = 0

  for (const m of movimientos) {
    if (m.tipo === "ingreso") totalIngresos += m.monto
    else                       totalEgresos  += m.monto
  }

  document.getElementById("resumen-ingresos").textContent =
    `$${formatMonto(totalIngresos)}`
  document.getElementById("resumen-egresos").textContent =
    `$${formatMonto(totalEgresos)}`
  document.getElementById("resumen-diferencia").textContent =
    `$${formatMonto(totalIngresos - totalEgresos)}`
}

function renderizarMovimientos() {
  const tbody = document.getElementById("tabla-movimientos")
  if (!tbody) return
  tbody.innerHTML = ""

  if (movimientos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="sin-registros">
      No hay movimientos en este período.</td></tr>`
    return
  }

  for (const m of movimientos) {
    tbody.innerHTML += `
      <tr>
        <td>${m.fecha}</td>
        <td>
          <span class="tipo-badge ${m.tipo}">
            ${m.tipo === "ingreso" ? "💚 Ingreso" : "❤️ Egreso"}
          </span>
        </td>
        <td>${m.concepto_nombre}</td>
        <td>${m.entidad_nombre || "General"}</td>
        <td>${m.cuenta_nombre}</td>
        <td class="monto-${m.tipo}">$${formatMonto(m.monto)}</td>
        <td>${m.referencia || "—"}</td>
        <td>${m.observacion || "—"}</td>
        <td>
          <button class="btn-editar" onclick="editarMovimiento(${m.id})">
            ✏️
          </button>
          <button class="btn-eliminar" onclick="eliminarMovimiento(${m.id})">
            🗑️
          </button>
        </td>
      </tr>
    `
  }
}

// ─── Guardar movimiento ───────────────────────────────────────────
async function guardarMovimiento() {
  const fecha      = document.getElementById("mov-fecha").value
  const tipo       = document.getElementById("mov-tipo").value
  const concepto   = document.getElementById("mov-concepto").value
  const cuenta     = document.getElementById("mov-cuenta").value
  const monto      = Number(document.getElementById("mov-monto").value)
  const entidad    = document.getElementById("mov-entidad").value || null
  const referencia = document.getElementById("mov-referencia").value
  const observacion= document.getElementById("mov-observacion").value

  const errorEl = document.getElementById("mov-error")

  if (!fecha || !concepto || !cuenta || !monto) {
    errorEl.style.display = "block"
    return
  }
  errorEl.style.display = "none"

  const payload = {
    fecha, tipo,
    concepto_id: Number(concepto),
    entidad_id:  entidad ? Number(entidad) : null,
    cuenta_id:   Number(cuenta),
    monto, referencia, observacion
  }

  if (idMovEditando === null) {
    await fetchAuth("/api/tesoro/movimientos", {
      method: "POST",
      body:   JSON.stringify(payload)
    })
  } else {
    await fetchAuth(`/api/tesoro/movimientos/${idMovEditando}`, {
      method: "PUT",
      body:   JSON.stringify(payload)
    })
    idMovEditando = null
  }

  limpiarFormMovimiento()
  await cargarMovimientos()
}

function editarMovimiento(id) {
  const m = movimientos.find(m => m.id === id)
  if (!m) return

  document.getElementById("mov-fecha").value       = m.fecha
  document.getElementById("mov-tipo").value        = m.tipo
  document.getElementById("mov-monto").value       = m.monto
  document.getElementById("mov-referencia").value  = m.referencia  || ""
  document.getElementById("mov-observacion").value = m.observacion || ""

  actualizarConceptos()
  actualizarEntidades()

  document.getElementById("mov-concepto").value = m.concepto_id
  document.getElementById("mov-cuenta").value   = m.cuenta_id
  if (m.entidad_id) document.getElementById("mov-entidad").value = m.entidad_id

  idMovEditando = id
  document.getElementById("titulo-mov-form").textContent = "✏️ Editando Movimiento"
  document.getElementById("btn-guardar-mov").textContent = "Actualizar"
  document.getElementById("btn-cancelar-mov").style.display = "flex"

  // Scroll al formulario
  document.getElementById("tab-movimientos").scrollIntoView({ behavior: "smooth" })
}

async function eliminarMovimiento(id) {
  if (!confirm("¿Eliminar este movimiento?")) return
  await fetchAuth(`/api/tesoro/movimientos/${id}`, { method: "DELETE" })
  await cargarMovimientos()
}

function cancelarMovimiento() {
  idMovEditando = null
  limpiarFormMovimiento()
}

function limpiarFormMovimiento() {
  document.getElementById("mov-fecha").value        = ""
  document.getElementById("mov-tipo").value         = "ingreso"
  document.getElementById("mov-monto").value        = ""
  document.getElementById("mov-referencia").value   = ""
  document.getElementById("mov-observacion").value  = ""
  document.getElementById("titulo-mov-form").textContent  = "➕ Nuevo Movimiento"
  document.getElementById("btn-guardar-mov").textContent  = "💾 Guardar Movimiento"
  document.getElementById("btn-cancelar-mov").style.display = "none"
  document.getElementById("mov-error").style.display = "none"
  actualizarConceptos()
  actualizarEntidades()
}

// ─── Saldos ───────────────────────────────────────────────────────
async function cargarSaldos() {
  const mes  = document.getElementById("sal-mes").value
  const anio = document.getElementById("sal-anio").value

  const r = await fetchAuth(`/api/tesoro/saldos?mes=${mes}&anio=${anio}`)
  if (!r) return
  const saldos = await r.json()
  renderizarSaldos(saldos, mes, anio)
}

function renderizarSaldos(saldos, mes, anio) {
  const contenedor = document.getElementById("contenido-saldos")
  if (!contenedor) return

  let totalEfectivo = 0
  let totalBanco    = 0
  let html          = ""

  for (const s of saldos) {
    let efRow = ""
    let bkRow = ""
    let totRow = ""

    for (const c of s.cuentas) {
      if (c.tipo === "efectivo") {
        efRow += `
          <div class="saldo-cuenta">
            <div class="sc-label">💵 ${c.cuenta}</div>
            <div class="sc-monto">$${formatMonto(c.saldo_final)}</div>
            <div class="sc-detalle">
              Inicial: $${formatMonto(c.saldo_inicial)}<br>
              +$${formatMonto(c.ingresos)} / -$${formatMonto(c.egresos)}
            </div>
          </div>
        `
        totalEfectivo += c.saldo_final
      } else {
        bkRow += `
          <div class="saldo-cuenta">
            <div class="sc-label">🏦 ${c.cuenta}</div>
            <div class="sc-monto">$${formatMonto(c.saldo_final)}</div>
            <div class="sc-detalle">
              Inicial: $${formatMonto(c.saldo_inicial)}<br>
              +$${formatMonto(c.ingresos)} / -$${formatMonto(c.egresos)}
            </div>
          </div>
        `
        totalBanco += c.saldo_final
      }
    }

    html += `
      <div class="saldo-entidad">
        <div class="saldo-entidad-header">
          <span>${s.entidad}</span>
          <span>Total: $${formatMonto(s.total)}</span>
        </div>
        <div class="saldo-entidad-body">
          ${efRow}${bkRow}
          <div class="saldo-cuenta" style="background:var(--primario-claro)">
            <div class="sc-label">📊 Total ${s.entidad}</div>
            <div class="sc-monto">$${formatMonto(s.total)}</div>
            <div class="sc-detalle">
              Ef: $${formatMonto(s.total_efectivo)}<br>
              Banco: $${formatMonto(s.total_banco)}
            </div>
          </div>
        </div>
      </div>
    `
  }

  // Consolidado total
  html += `
    <div class="saldo-entidad" style="border-color:var(--primario)">
      <div class="saldo-entidad-header" style="background:linear-gradient(135deg,#4A2020,#8B2635)">
        <span>🏛️ CONSOLIDADO TOTAL — ${MESES[mes]} ${anio}</span>
        <span>$${formatMonto(totalEfectivo + totalBanco)}</span>
      </div>
      <div class="saldo-entidad-body">
        <div class="saldo-cuenta">
          <div class="sc-label">💵 Total Efectivo</div>
          <div class="sc-monto">$${formatMonto(totalEfectivo)}</div>
        </div>
        <div class="saldo-cuenta">
          <div class="sc-label">🏦 Total Banco</div>
          <div class="sc-monto">$${formatMonto(totalBanco)}</div>
        </div>
        <div class="saldo-cuenta" style="background:var(--primario-claro)">
          <div class="sc-label">📊 Gran Total</div>
          <div class="sc-monto" style="font-size:22px;">
            $${formatMonto(totalEfectivo + totalBanco)}
          </div>
        </div>
      </div>
    </div>
  `

  contenedor.innerHTML = html
}

// ─── Modal saldo inicial ──────────────────────────────────────────
function abrirModalSaldoInicial() {
  const mes  = document.getElementById("sal-mes").value
  const anio = document.getElementById("sal-anio").value

  let html = `<p style="font-size:13px; color:var(--texto-suave); margin-bottom:16px;">
    Ingresa los saldos iniciales para <strong>${MESES[mes]} ${anio}</strong>
  </p>`

  for (const entidad of entidades) {
    for (const cuenta of cuentas) {
      html += `
        <div class="campo" style="margin-bottom:12px;">
          <label>${entidad.nombre} — ${cuenta.nombre} (${cuenta.tipo})</label>
          <input type="number" min="0" placeholder="0"
            id="si-${entidad.id}-${cuenta.id}"
            style="padding:8px 12px; border:1.5px solid var(--borde);
                   border-radius:8px; font-family:'Poppins',sans-serif; font-size:14px; width:100%;">
        </div>
      `
    }
  }

  document.getElementById("modal-saldo-contenido").innerHTML = html
  document.getElementById("modal-saldo").style.display = "flex"
}

async function guardarSaldosIniciales() {
  const mes  = document.getElementById("sal-mes").value
  const anio = document.getElementById("sal-anio").value

  for (const entidad of entidades) {
    for (const cuenta of cuentas) {
      const input = document.getElementById(`si-${entidad.id}-${cuenta.id}`)
      if (!input) continue
      const monto = Number(input.value) || 0
      await fetchAuth("/api/tesoro/saldos-iniciales", {
        method: "POST",
        body:   JSON.stringify({
          entidad_id: entidad.id,
          cuenta_id:  cuenta.id,
          mes, anio, monto
        })
      })
    }
  }

  cerrarModalSaldo()
  await cargarSaldos()
  alert("✅ Saldos iniciales guardados")
}

function cerrarModalSaldo() {
  document.getElementById("modal-saldo").style.display = "none"
}

// ─── Aportes distritales ──────────────────────────────────────────
async function cargarAportes() {
  const mes  = document.getElementById("apo-mes").value
  const anio = document.getElementById("apo-anio").value
  const r    = await fetchAuth(`/api/tesoro/aportes/${anio}/${mes}`)
  if (!r) return
  const aporte = await r.json()
  renderizarAportes(aporte)
}

async function calcularAportes() {
  await cargarAportes()
}

function renderizarAportes(aporte) {
  const contenedor = document.getElementById("contenido-aportes")
  if (!contenedor) return

  const letras = ["C-1","C-2","C-3","C-4"]
  let filas = ""
  let letraIdx = 0

  for (const d of aporte.detalle) {
    filas += `
      <tr>
        <td>${letras[letraIdx++] || "C-?"}</td>
        <td>${d.porcentaje}%</td>
        <td>${d.entidad} — Diezmos y Ofrendas</td>
        <td>$${formatMonto(d.base)}</td>
        <td><strong>$${formatMonto(d.aporte)}</strong></td>
      </tr>
    `
  }

  // FEM
  filas += `
    <tr>
      <td>D-1</td>
      <td>—</td>
      <td>FEM Gran Comisión (${MESES[aporte.mes]} ${aporte.anio})</td>
      <td>—</td>
      <td><strong>$${formatMonto(aporte.fem_mensual)}</strong></td>
    </tr>
  `

  const pagadoHtml = aporte.pagado
    ? `<span class="cargo-tag">✅ Pagado el ${aporte.fecha_pago}</span>`
    : `<span style="color:var(--naranja); font-weight:600;">⏳ Pendiente de pago</span>`

  contenedor.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div>
        <h3 style="font-size:15px; font-weight:600;">
          Aportes Distritales — ${MESES[aporte.mes]} ${aporte.anio}
        </h3>
        <p style="font-size:12px; color:var(--texto-suave);">
          Iglesia del Nazareno "Los Lobos" — Talcahuano
        </p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn-excel" onclick="exportarAporteExcel()">📥 Excel</button>
        <button class="btn-imprimir" onclick="imprimirAporte()">🖨️ Imprimir</button>
      </div>
    </div>

    <table class="aporte-tabla">
      <thead>
        <tr>
          <th>N°</th>
          <th>% Aporte</th>
          <th>Descripción</th>
          <th>Base</th>
          <th>Monto $</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
        <tr class="aporte-total">
          <td colspan="4" style="text-align:right; padding-right:16px;">
            TOTAL A PAGAR AL DISTRITO
          </td>
          <td>$${formatMonto(aporte.total)}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:20px; padding:16px; background:#FAF6F0;
      border-radius:10px; border:1px solid var(--borde);">
      <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">
        📝 Registro de Pago
      </h4>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; flex-wrap:wrap;">
        <div class="campo">
          <label>Cancelado / Transferido por</label>
          <input type="text" id="apo-transferido-por"
            value="${aporte.transferido_por || ""}"
            placeholder="Nombre del responsable">
        </div>
        <div class="campo">
          <label>Fecha de transferencia</label>
          <input type="date" id="apo-fecha-pago"
            value="${aporte.fecha_pago || ""}">
        </div>
        <div class="campo">
          <label>Transferido a</label>
          <input type="text" id="apo-transferido-a"
            value="${aporte.transferido_a || ""}"
            placeholder="Destino del pago">
        </div>
      </div>
      <div style="margin-top:14px; display:flex; gap:10px; align-items:center;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="apo-pagado"
            ${aporte.pagado ? "checked" : ""}
            style="width:auto; accent-color:var(--primario);">
          <span style="font-size:13px; font-weight:500;">Marcar como pagado</span>
        </label>
        <button class="btn-guardar"
          onclick="guardarAporte(${aporte.mes}, ${aporte.anio})"
          style="padding:8px 20px; width:auto; flex:none;">
          💾 Guardar registro
        </button>
        <span>${pagadoHtml}</span>
      </div>
    </div>
  `
}

async function guardarAporte(mes, anio) {
  const r = await fetchAuth(`/api/tesoro/aportes/${anio}/${mes}`)
  if (!r) return
  const actual = await r.json()

  const datos = {
    ...actual,
    detalle:        actual.detalle,
    transferido_por: document.getElementById("apo-transferido-por").value,
    fecha_pago:     document.getElementById("apo-fecha-pago").value,
    transferido_a:  document.getElementById("apo-transferido-a").value,
    pagado:         document.getElementById("apo-pagado").checked ? 1 : 0
  }

  await fetchAuth(`/api/tesoro/aportes/${anio}/${mes}`, {
    method: "POST",
    body:   JSON.stringify(datos)
  })

  await cargarAportes()
  alert("✅ Registro de aporte guardado")
}

// ─── Exportar movimientos a Excel ─────────────────────────────────
function exportarMovimientosExcel() {
  if (movimientos.length === 0) {
    alert("No hay movimientos para exportar.")
    return
  }

  const mes  = document.getElementById("mov-mes").value
  const anio = document.getElementById("mov-anio").value

  const datos = [
    ["Fecha","Tipo","Concepto","Entidad","Cuenta","Monto","Referencia","Observación"]
  ]

  let totalIngresos = 0
  let totalEgresos  = 0

  for (const m of movimientos) {
    datos.push([
      m.fecha,
      m.tipo === "ingreso" ? "Ingreso" : "Egreso",
      m.concepto_nombre,
      m.entidad_nombre || "General",
      m.cuenta_nombre,
      m.monto,
      m.referencia  || "",
      m.observacion || ""
    ])
    if (m.tipo === "ingreso") totalIngresos += m.monto
    else                       totalEgresos  += m.monto
  }

  datos.push([])
  datos.push(["Total Ingresos","","","","",totalIngresos,"",""])
  datos.push(["Total Egresos", "","","","",totalEgresos, "",""])
  datos.push(["Diferencia",    "","","","",totalIngresos-totalEgresos,"",""])

  const hoja  = XLSX.utils.aoa_to_sheet(datos)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, "Movimientos")
  XLSX.writeFile(libro, `tesoreria-${MESES[mes]}-${anio}.xlsx`)
}

// ─── Exportar aporte a Excel ──────────────────────────────────────
function exportarAporteExcel() {
  const mes  = document.getElementById("apo-mes").value
  const anio = document.getElementById("apo-anio").value

  const datos = [
    ["APORTE DISTRITALES IGLESIA DEL NAZARENO"],
    [],
    ["IGLESIA:", "DNI LOS LOBOS"],
    ["MES:", MESES[mes]],
    ["AÑO:", anio],
    [],
    ["N°","ITEM","% APORTE","DESCRIPCIÓN","MONTO $"]
  ]

  const letras = ["C-1","C-2","C-3","C-4"]
  const filas  = document.querySelectorAll(".aporte-tabla tbody tr")

  filas.forEach((fila, i) => {
    const celdas = fila.querySelectorAll("td")
    if (celdas.length >= 5) {
      datos.push([
        celdas[0].textContent.trim(),
        celdas[1].textContent.trim(),
        celdas[2].textContent.trim(),
        celdas[3].textContent.trim(),
        celdas[4].textContent.trim()
      ])
    }
  })

  datos.push([])
  datos.push(["CANCELADO / TRANSFERIDO POR:", document.getElementById("apo-transferido-por")?.value || ""])
  datos.push(["FECHA TRANSFERENCIA:", document.getElementById("apo-fecha-pago")?.value || ""])
  datos.push(["TRANSFERIDO A:", document.getElementById("apo-transferido-a")?.value || ""])

  const hoja  = XLSX.utils.aoa_to_sheet(datos)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, "Aportes")
  XLSX.writeFile(libro, `aportes-distrito-${MESES[mes]}-${anio}.xlsx`)
}

// ─── Imprimir ─────────────────────────────────────────────────────
function imprimirMovimientos() {
  window.print()
}

function imprimirAporte() {
  window.print()
}

// ─── Pestañas ─────────────────────────────────────────────────────
function mostrarTab(tab) {
  document.querySelectorAll(".tab-content").forEach(el => {
    el.classList.remove("activo")
  })
  document.querySelectorAll(".tab-btn").forEach(el => {
    el.classList.remove("activo")
  })

  document.getElementById(`tab-${tab}`).classList.add("activo")

  const btns = document.querySelectorAll(".tab-btn")
  const orden = ["movimientos","saldos","aportes","configuracion"]
  btns[orden.indexOf(tab)]?.classList.add("activo")

  // Cargar datos de la pestaña seleccionada
  if (tab === "saldos")       cargarSaldos()
  if (tab === "aportes")      cargarAportes()
  if (tab === "configuracion") cargarConfig()
}

// ─── Formatear monto ──────────────────────────────────────────────
function formatMonto(num) {
  return Math.round(num).toLocaleString("es-CL")
}