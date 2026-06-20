const LS_BACKEND = "co_backend_url";

function getBackendUrl() { return localStorage.getItem(LS_BACKEND) || ""; }
function setBackendUrl(v) { localStorage.setItem(LS_BACKEND, v); }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

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

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-save-backend").addEventListener("click", onSaveBackend);
  document.getElementById("btn-crear").addEventListener("click", onCrear);
  document.getElementById("btn-change-backend").addEventListener("click", () => showScreen("screen-setup"));
  document.getElementById("btn-ir-eliminar").addEventListener("click", onIrAEliminar);
  document.getElementById("btn-ir-crear").addEventListener("click", () => showScreen("screen-admin"));
  document.getElementById("btn-eliminar").addEventListener("click", onEliminar);

  if (!getBackendUrl()) {
    showScreen("screen-setup");
  } else {
    showScreen("screen-admin");
  }
});

function onSaveBackend() {
  const val = document.getElementById("input-backend-url").value.trim();
  const errEl = document.getElementById("setup-error");
  errEl.textContent = "";
  if (!val.startsWith("https://script.google.com/")) {
    errEl.textContent = "Pega la URL completa que termina en /exec";
    return;
  }
  setBackendUrl(val);
  showScreen("screen-admin");
}

async function onCrear() {
  const nombre = document.getElementById("input-nombre-proyecto").value.trim();
  const clave = document.getElementById("input-clave").value;
  const errEl = document.getElementById("admin-error");
  errEl.textContent = "";
  if (!nombre || !clave) {
    errEl.textContent = "Completa el nombre y la clave";
    return;
  }
  const btn = document.getElementById("btn-crear");
  btn.disabled = true;
  btn.textContent = "Creando…";
  try {
    const result = await apiPost("crearProyecto", { nombre, clave });
    document.getElementById("admin-success").classList.remove("hidden");
    document.getElementById("link-nuevo-sheet").href = result.url;
    document.getElementById("input-nombre-proyecto").value = "";
    document.getElementById("input-clave").value = "";
    toast("Proyecto creado correctamente");
  } catch (e) {
    errEl.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear proyecto";
  }
}

async function onIrAEliminar() {
  showScreen("screen-delete");
  const select = document.getElementById("select-eliminar");
  select.innerHTML = '<option value="">Cargando...</option>';
  try {
    const proyectos = await apiGet("listProjects");
    if (!proyectos.length) {
      select.innerHTML = '<option value="">No hay proyectos creados</option>';
      return;
    }
    select.innerHTML = proyectos.map((p) => `<option value="${p}">${p}</option>`).join("");
  } catch (e) {
    select.innerHTML = '<option value="">No se pudo cargar la lista</option>';
  }
}

async function onEliminar() {
  const nombre = document.getElementById("select-eliminar").value;
  const clave = document.getElementById("input-clave-eliminar").value;
  const errEl = document.getElementById("delete-error");
  errEl.textContent = "";
  if (!nombre || !clave) {
    errEl.textContent = "Selecciona un proyecto y escribe la clave";
    return;
  }
  if (!confirm(`¿Seguro que quieres eliminar "${nombre}"? El Sheet va a la papelera de Drive (recuperable 30 días).`)) return;
  const btn = document.getElementById("btn-eliminar");
  btn.disabled = true;
  btn.textContent = "Eliminando…";
  try {
    await apiPost("eliminarProyecto", { nombre, clave });
    toast("Proyecto eliminado");
    document.getElementById("input-clave-eliminar").value = "";
    onIrAEliminar();
  } catch (e) {
    errEl.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Eliminar proyecto";
  }
}
