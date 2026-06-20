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
