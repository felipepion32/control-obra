// ---------- Almacenamiento local ----------
const LS_BACKEND = "co_backend_url";
const LS_PROYECTO = "co_proyecto";
const LS_NOMBRE = "co_nombre";

function getBackendUrl() { return localStorage.getItem(LS_BACKEND) || ""; }
function setBackendUrl(v) { localStorage.setItem(LS_BACKEND, v); }
function getSession() {
  return { proyecto: localStorage.getItem(LS_PROYECTO) || "", nombre: localStorage.getItem(LS_NOMBRE) || "" };
}
function setSession(proyecto, nombre) {
  localStorage.setItem(LS_PROYECTO, proyecto);
  localStorage.setItem(LS_NOMBRE, nombre);
}
function clearSession() {
  localStorage.removeItem(LS_PROYECTO);
  localStorage.removeItem(LS_NOMBRE);
}

// ---------- API ----------
async function apiGet(action, extraParams) {
  const url = new URL(getBackendUrl());
  url.searchParams.set("action", action);
  Object.entries(extraParams || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function apiPost(action, payload) {
  const res = await fetch(getBackendUrl(), {
    method: "POST",
    body: JSON.stringify(Object.assign({ action }, payload))
  });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

// ---------- Toast ----------
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- Navegación entre pantallas ----------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

let CURRENT_TAB = "proyecto";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  document.getElementById("btn-save-backend").addEventListener("click", onSaveBackend);
  document.getElementById("btn-login").addEventListener("click", onLogin);
  document.getElementById("btn-settings").addEventListener("click", onSettings);
  document.getElementById("select-proyecto").addEventListener("change", onProyectoChangeInLogin);
  document.querySelectorAll("#bottom-nav button").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  if (!getBackendUrl()) {
    showScreen("screen-setup");
    return;
  }
  const session = getSession();
  if (!session.proyecto || !session.nombre) {
    await prepareLoginScreen();
    showScreen("screen-login");
    return;
  }
  enterMain();
}

async function onSaveBackend() {
  const val = document.getElementById("input-backend-url").value.trim();
  const errEl = document.getElementById("setup-error");
  errEl.textContent = "";
  if (!val.startsWith("https://script.google.com/")) {
    errEl.textContent = "Pega la URL completa que termina en /exec";
    return;
  }
  setBackendUrl(val);
  try {
    await prepareLoginScreen();
    showScreen("screen-login");
  } catch (e) {
    errEl.textContent = "No se pudo conectar: " + e.message;
  }
}

async function prepareLoginScreen() {
  const select = document.getElementById("select-proyecto");
  select.innerHTML = '<option value="">Cargando...</option>';
  const proyectos = await apiGet("listProjects");
  select.innerHTML = '<option value="">Selecciona un proyecto</option>' + proyectos.map((p) => `<option value="${p}">${p}</option>`).join("");
  const session = getSession();
  if (session.proyecto) {
    select.value = session.proyecto;
    await onProyectoChangeInLogin();
    const nombreSelect = document.getElementById("select-nombre");
    if (session.nombre) nombreSelect.value = session.nombre;
  }
}

async function onProyectoChangeInLogin() {
  const proyecto = document.getElementById("select-proyecto").value;
  const nombreSelect = document.getElementById("select-nombre");
  if (!proyecto) {
    nombreSelect.innerHTML = '<option value="">Selecciona un proyecto primero</option>';
    return;
  }
  nombreSelect.innerHTML = '<option value="">Cargando...</option>';
  try {
    const equipo = await apiGet("getEquipo", { proyecto });
    nombreSelect.innerHTML = '<option value="">Selecciona tu nombre</option>' + equipo.map((e) => `<option value="${e.nombre}">${e.nombre}</option>`).join("");
  } catch (e) {
    nombreSelect.innerHTML = '<option value="">No se pudo cargar el equipo</option>';
  }
}

async function onLogin() {
  const proyecto = document.getElementById("select-proyecto").value;
  const nombre = document.getElementById("select-nombre").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  if (!proyecto || !nombre) {
    errEl.textContent = "Selecciona un proyecto y tu nombre";
    return;
  }
  setSession(proyecto, nombre);
  enterMain();
}

function onSettings() {
  if (confirm("¿Cerrar sesión y volver a la pantalla de inicio?")) {
    clearSession();
    init();
  }
}

function enterMain() {
  const session = getSession();
  document.getElementById("header-proj").textContent = session.proyecto;
  document.getElementById("header-user").textContent = session.nombre;
  showScreen("screen-main");
  switchTab("proyecto");
}

function switchTab(tab) {
  CURRENT_TAB = tab;
  document.querySelectorAll("#bottom-nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  if (tab === "proyecto") loadProyecto();
  if (tab === "fases") loadFases();
  if (tab === "materiales") loadMateriales();
  if (tab === "contratistas") loadContratistas();
  if (tab === "bitacora") loadBitacora();
}

// ---------- UTILIDADES ----------
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDateEs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${String(d.getUTCDate()).padStart(2,"0")}-${meses[d.getUTCMonth()]}`;
}

// ---------- TAB: PROYECTO ----------
async function loadProyecto() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="spinner">Cargando proyecto…</div>';
  try {
    const [resumen, documentos] = await Promise.all([
      apiGet("getResumen", { proyecto: getSession().proyecto }),
      apiGet("getDocumentos", { proyecto: getSession().proyecto })
    ]);
    renderProyecto(resumen, documentos);
  } catch (e) {
    content.innerHTML = `<div class="empty-state">No se pudo cargar el proyecto.<br>${e.message}</div>`;
  }
}

function renderProyecto(r, documentos) {
  const content = document.getElementById("content");
  const avancePct = Math.round((Number(r.avance) || 0) * 100);
  content.innerHTML = `
    <div class="proj-card">
      <h2>${escapeHtml(r.nombreProyecto)}</h2>
      <div class="proj-row"><span class="proj-label">Cliente</span><span>${escapeHtml(r.cliente)}</span></div>
      <div class="proj-row"><span class="proj-label">Ubicación</span><span>${escapeHtml(r.ubicacion)}</span></div>
      ${r.mapsLink ? `<a class="btn-maps" href="${r.mapsLink}" target="_blank">📍 Abrir en Google Maps</a>` : ""}
      <div class="proj-row"><span class="proj-label">Supervisor</span><span>${escapeHtml(r.supervisor)}</span></div>
      <div class="proj-row"><span class="proj-label">Inicio</span><span>${formatDateEs(r.fechaInicio)}</span></div>
      <div class="proj-row"><span class="proj-label">Fin estimado</span><span>${formatDateEs(r.fechaFinEstimada)}</span></div>
      <div class="proj-row"><span class="proj-label">Estado</span><span>${escapeHtml(r.estadoGeneral)}</span></div>
      <div class="progress-wrap">
        <div class="progress-label"><span>Avance de fases</span><span>${avancePct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${avancePct}%"></div></div>
      </div>
    </div>
    <div class="section-title"><h2>Documentos</h2><span class="count">${documentos.length}</span></div>
    <div id="doc-cards"></div>
  `;
  const docsEl = document.getElementById("doc-cards");
  if (!documentos.length) {
    docsEl.innerHTML = '<div class="empty-state">Sin documentos cargados todavía.</div>';
    return;
  }
  documentos.forEach((d) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cursor = "default";
    card.innerHTML = `
      <div class="row1"><div class="title">${escapeHtml(d.nombre)}</div><span class="badge pendiente">${escapeHtml(d.tipo || "")}</span></div>
      <div class="sub">${formatDateEs(d.fecha)}</div>
      ${d.notas ? `<div class="dates">${escapeHtml(d.notas)}</div>` : ""}
      ${d.link ? `<a class="contact-row-link" href="${d.link}" target="_blank">📄 Ver documento</a>` : ""}
    `;
    docsEl.appendChild(card);
  });
}

// ---------- TAB: FASES ----------
function estadoBadgeClass(estado, alerta) {
  if (alerta === "VENCIDA") return "vencida";
  if (estado === "Completada") return "completada";
  if (estado === "En Proceso") return "en-proceso";
  return "pendiente";
}
function estadoBadgeLabel(estado, alerta) {
  if (alerta === "VENCIDA") return "Vencida";
  return estado || "Pendiente";
}

async function loadFases() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="spinner">Cargando fases…</div>';
  try {
    const fases = await apiGet("getFases", { proyecto: getSession().proyecto });
    renderFases(fases);
  } catch (e) {
    content.innerHTML = `<div class="empty-state">No se pudo cargar el cronograma.<br>${e.message}</div>`;
  }
}

function renderFases(fases) {
  const content = document.getElementById("content");
  if (!fases.length) {
    content.innerHTML = '<div class="empty-state">Aún no hay fases registradas en este proyecto.</div>';
    return;
  }
  content.innerHTML = `
    <div class="section-title"><h2>Fases de Obra</h2><span class="count">${fases.length}</span></div>
    <div class="gantt-wrap"><div class="gantt-inner" id="gantt-inner"></div></div>
    <div id="fase-cards"></div>
  `;
  buildGantt(fases);
  const cardsEl = document.getElementById("fase-cards");
  fases.forEach((t) => {
    const cls = estadoBadgeClass(t.estado, t.alerta);
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="row1">
        <div class="title">${escapeHtml(t.orden)}. ${escapeHtml(t.fase)}</div>
        <span class="badge ${cls}">${estadoBadgeLabel(t.estado, t.alerta)}</span>
      </div>
      <div class="sub">${escapeHtml(t.contratista || "Sin asignar")}</div>
      <div class="dates">${formatDateEs(t.fechaInicio)} → ${formatDateEs(t.fechaFin)} · ${t.diasAsignados || 0} día(s)</div>
      ${t.instrucciones ? `<div class="instrucciones">${escapeHtml(t.instrucciones)}</div>` : ""}
      ${Number(t.retraso) > 0 ? `<div class="retraso-tag">⚠ Retraso de ${t.retraso} día(s)${t.motivoRetraso ? ": " + escapeHtml(t.motivoRetraso) : ""}</div>` : ""}
    `;
    card.addEventListener("click", () => openFaseModal(t));
    cardsEl.appendChild(card);
  });
}

function buildGantt(tasks) {
  const PX_DAY = 20;
  const valid = tasks.filter((t) => t.fechaInicio && t.fechaFin);
  if (!valid.length) {
    document.getElementById("gantt-inner").innerHTML = '<div class="empty-state">Sin fechas suficientes para el Gantt.</div>';
    return;
  }
  const starts = valid.map((t) => new Date(t.fechaInicio));
  const ends = valid.map((t) => new Date(t.fechaFin));
  const minDate = new Date(Math.min(...starts));
  const maxDate = new Date(Math.max(...ends));
  const totalDays = Math.max(1, Math.round((maxDate - minDate) / 86400000)) + 2;

  let rulerHtml = "";
  for (let d = 0; d <= totalDays; d += 7) {
    const dt = new Date(minDate.getTime() + d * 86400000);
    rulerHtml += `<div class="gantt-tick" style="left:${d * PX_DAY}px">${formatDateEs(dt.toISOString().slice(0,10))}</div>`;
  }

  let rowsHtml = "";
  tasks.forEach((t) => {
    if (!t.fechaInicio || !t.fechaFin) { rowsHtml += `<div class="gantt-row"></div>`; return; }
    const s = new Date(t.fechaInicio);
    const e = new Date(t.fechaFin);
    const left = Math.round((s - minDate) / 86400000) * PX_DAY;
    const width = Math.max(1, Math.round((e - s) / 86400000) + 1) * PX_DAY;
    const cls = estadoBadgeClass(t.estado, t.alerta);
    const color = { pendiente: "#9A968A", "en-proceso": "#B8852B", completada: "#3C8C5C", vencida: "#C84B31" }[cls];
    rowsHtml += `<div class="gantt-row"><div class="gantt-bar" style="left:${left}px;width:${width}px;background:${color}" data-id="${t.id}">${escapeHtml(t.fase)}</div></div>`;
  });

  const inner = document.getElementById("gantt-inner");
  inner.style.minWidth = (totalDays * PX_DAY + 20) + "px";
  inner.innerHTML = `<div class="gantt-ruler">${rulerHtml}</div>${rowsHtml}`;
  inner.querySelectorAll(".gantt-bar").forEach((bar) => {
    bar.addEventListener("click", () => {
      const t = tasks.find((tk) => String(tk.id) === bar.dataset.id);
      if (t) openFaseModal(t);
    });
  });
}

function openFaseModal(fase) {
  const opciones = ["Pendiente", "En Proceso", "Completada"];
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>${escapeHtml(fase.fase)}</h3>
      ${opciones.map((o) => `<button class="status-option sel-${o.toLowerCase().replace(" ", "-")}" data-estado="${o}">${o}${fase.estado === o ? " ✓" : ""}</button>`).join("")}
      <button class="status-option sel-retraso" id="btn-abrir-retraso">⚠ Reportar retraso</button>
      <button class="btn-secondary" id="btn-cancel-modal">Cancelar</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll(".status-option[data-estado]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      backdrop.remove();
      try {
        await apiPost("updateFaseEstado", { proyecto: getSession().proyecto, id: fase.id, estado: btn.dataset.estado });
        toast("Fase actualizada");
        loadFases();
      } catch (e) {
        toast("Error: " + e.message);
      }
    });
  });
  backdrop.querySelector("#btn-abrir-retraso").addEventListener("click", () => {
    backdrop.remove();
    openDelayModal(fase);
  });
  backdrop.querySelector("#btn-cancel-modal").addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) backdrop.remove(); });
}

function openDelayModal(fase) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <h3>Reportar retraso — ${escapeHtml(fase.fase)}</h3>
      <p class="desc-modal">Los días de retraso se calculan solos según la fecha planeada. Aquí solo explica el motivo.</p>
      <div class="field">
        <label>Motivo</label>
        <textarea id="input-motivo-retraso" placeholder="Ej. Lluvia, falta de material...">${escapeHtml(fase.motivoRetraso || "")}</textarea>
      </div>
      <button class="btn-primary" id="btn-guardar-retraso">Guardar</button>
      <button class="btn-secondary" id="btn-cancel-modal" style="margin-top:8px;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector("#btn-guardar-retraso").addEventListener("click", async () => {
    const motivo = document.getElementById("input-motivo-retraso").value;
    backdrop.remove();
    try {
      await apiPost("reportarRetraso", { proyecto: getSession().proyecto, id: fase.id, motivo });
      toast("Motivo guardado");
      loadFases();
    } catch (e) {
      toast("Error: " + e.message);
    }
  });
  backdrop.querySelector("#btn-cancel-modal").addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) backdrop.remove(); });
}

// ---------- TAB: MATERIALES ----------
async function loadMateriales() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="spinner">Cargando materiales…</div>';
  try {
    const list = await apiGet("getMateriales", { proyecto: getSession().proyecto });
    renderMateriales(list);
  } catch (e) {
    content.innerHTML = `<div class="empty-state">No se pudo cargar la lista.<br>${e.message}</div>`;
  }
}

function renderMateriales(list) {
  const content = document.getElementById("content");
  if (!list.length) {
    content.innerHTML = '<div class="empty-state">Aún no hay materiales registrados.</div>';
    return;
  }
  content.innerHTML = `<div class="section-title"><h2>Materiales</h2><span class="count">${list.length}</span></div><div id="mat-cards"></div>`;
  const cardsEl = document.getElementById("mat-cards");
  list.forEach((m) => {
    const comprado = m.comprado === "Sí";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="row1">
        <div class="title">${escapeHtml(m.material)}</div>
        <span class="badge ${comprado ? "completada" : "pendiente"}">${comprado ? "Comprado" : "Pendiente"}</span>
      </div>
      <div class="sub">${escapeHtml(m.fase || "")}</div>
      <div class="dates">${escapeHtml(m.cantidad)} ${escapeHtml(m.unidad || "")} · Suplidor: ${escapeHtml(m.suplidor || "—")}</div>
    `;
    card.addEventListener("click", async () => {
      try {
        await apiPost("toggleComprado", { proyecto: getSession().proyecto, id: m.id, comprado: comprado ? "No" : "Sí" });
        toast(comprado ? "Marcado como pendiente" : "Marcado como comprado");
        loadMateriales();
      } catch (e) {
        toast("Error: " + e.message);
      }
    });
    cardsEl.appendChild(card);
  });
}

// ---------- TAB: CONTRATISTAS ----------
async function loadContratistas() {
  const content = document.getElementById("content");
  content.innerHTML = '<div class="spinner">Cargando contratistas…</div>';
  try {
    const list = await apiGet("getContratistas", { proyecto: getSession().proyecto });
    renderContratistas(list);
  } catch (e) {
    content.innerHTML = `<div class="empty-state">No se pudo cargar la lista.<br>${e.message}</div>`;
  }
}

function renderContratistas(list) {
  const content = document.getElementById("content");
  if (!list.length) {
    content.innerHTML = '<div class="empty-state">Aún no hay contratistas registrados.</div>';
    return;
  }
  content.innerHTML = `<div class="section-title"><h2>Contratistas</h2><span class="count">${list.length}</span></div><div id="contr-cards"></div>`;
  const cardsEl = document.getElementById("contr-cards");
  list.forEach((c) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cursor = "default";
    let contactRow = "";
    if (c.contacto || c.email) {
      contactRow = '<div class="contact-row">';
      if (c.contacto) contactRow += `<a href="tel:${c.contacto}">📞 Llamar</a>`;
      if (c.email) contactRow += `<a href="mailto:${c.email}">✉ Email</a>`;
      contactRow += "</div>";
    }
    card.innerHTML = `
      <div class="row1"><div class="title">${escapeHtml(c.nombre)}</div></div>
      <div class="sub">${escapeHtml(c.especialidad || "")}</div>
      ${c.fasesAsignadas ? `<div class="dates">Fases: ${escapeHtml(String(c.fasesAsignadas))}</div>` : ""}
      ${contactRow}
    `;
    cardsEl.appendChild(card);
  });
}

// ---------- TAB: BITACORA ----------
let SELECTED_PHOTO_BASE64 = null;
let SELECTED_PHOTO_MIME = null;
let SELECTED_PHOTO_NAME = null;

async function loadBitacora() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="section-title"><h2>Bitácora</h2></div>
    <div class="bitacora-form">
      <div class="field"><label>Actividad del día</label><textarea id="bit-actividad" placeholder="Ej. Montaje de membrana en zona norte"></textarea></div>
      <div class="field"><label>Incidencias (opcional)</label><textarea id="bit-incidencias" placeholder="Ej. Retraso por lluvia"></textarea></div>
      <input type="file" id="bit-photo-input" accept="image/*" capture="environment" style="display:none">
      <div class="photo-btn" id="bit-photo-btn">📷 Agregar foto de avance</div>
      <img class="photo-preview" id="bit-photo-preview">
      <button class="btn-primary" id="bit-submit">Guardar entrada</button>
    </div>
    <div id="bit-list"><div class="spinner">Cargando historial…</div></div>
  `;
  document.getElementById("bit-photo-btn").addEventListener("click", () => document.getElementById("bit-photo-input").click());
  document.getElementById("bit-photo-input").addEventListener("change", onPhotoSelected);
  document.getElementById("bit-submit").addEventListener("click", onSubmitBitacora);
  refreshBitacoraList();
}

async function onPhotoSelected(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  SELECTED_PHOTO_MIME = file.type;
  SELECTED_PHOTO_NAME = file.name;
  SELECTED_PHOTO_BASE64 = await fileToBase64(file);
  const preview = document.getElementById("bit-photo-preview");
  preview.src = "data:" + SELECTED_PHOTO_MIME + ";base64," + SELECTED_PHOTO_BASE64;
  preview.style.display = "block";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function onSubmitBitacora() {
  const actividad = document.getElementById("bit-actividad").value.trim();
  const incidencias = document.getElementById("bit-incidencias").value.trim();
  if (!actividad) { toast("Escribe la actividad del día"); return; }
  const btn = document.getElementById("bit-submit");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    let fotoUrl = "";
    if (SELECTED_PHOTO_BASE64) {
      const up = await apiPost("uploadPhoto", {
        proyecto: getSession().proyecto,
        filename: SELECTED_PHOTO_NAME,
        mimeType: SELECTED_PHOTO_MIME,
        base64: SELECTED_PHOTO_BASE64
      });
      fotoUrl = up.url;
    }
    await apiPost("addBitacora", {
      proyecto: getSession().proyecto,
      actividad, incidencias,
      responsable: getSession().nombre,
      fotoUrl
    });
    toast("Entrada guardada");
    SELECTED_PHOTO_BASE64 = null;
    loadBitacora();
  } catch (e) {
    toast("Error: " + e.message);
    btn.disabled = false;
    btn.textContent = "Guardar entrada";
  }
}

async function refreshBitacoraList() {
  const listEl = document.getElementById("bit-list");
  try {
    const entries = await apiGet("getBitacora", { proyecto: getSession().proyecto });
    if (!entries.length) {
      listEl.innerHTML = '<div class="empty-state">Sin entradas todavía.</div>';
      return;
    }
    listEl.innerHTML = entries.map((e) => `
      <div class="bitacora-entry">
        <div class="fecha">${formatDateEs(e.fecha)} — ${escapeHtml(e.responsable || "")}</div>
        <div class="act">${escapeHtml(e.actividad || "")}</div>
        ${e.incidencias ? `<div class="inc">⚠ ${escapeHtml(e.incidencias)}</div>` : ""}
        ${e.fotoUrl ? `<a href="${e.fotoUrl}" target="_blank"><img src="${e.fotoUrl}" loading="lazy"></a>` : ""}
      </div>
    `).join("");
  } catch (e) {
    listEl.innerHTML = `<div class="empty-state">No se pudo cargar el historial.</div>`;
  }
}
