/* ============================================================
   app.js — navegação entre as seções + utilitários comuns
   ============================================================ */

const VIEWS = ["apresentacao", "missao", "questionario", "analise"];

function showView(name){
  if (!VIEWS.includes(name)) name = "apresentacao";
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("active", a.dataset.view === name));
  if (name !== "apresentacao" && window.Deck) Deck.stopAutoplay();
  if (name === "missao" && window.Missao) Missao.init();
  if (name === "questionario" && window.Quiz) Quiz.init();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}
window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
document.addEventListener("DOMContentLoaded", () => showView(location.hash.slice(1) || "apresentacao"));

/* ---------- comunicação com o Google Apps Script ---------- */
const API = {
  ativo(){ return typeof WEBAPP_URL === "string" && WEBAPP_URL.trim().startsWith("https://"); },
  async post(payload){
    // text/plain evita o "preflight" de CORS, que o Apps Script não responde
    const r = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    return r.json();
  },
  async get(params){
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(WEBAPP_URL + (WEBAPP_URL.includes("?") ? "&" : "?") + qs);
    return r.json();
  }
};

/* ---------- carregamento sob demanda de bibliotecas ---------- */
function loadScript(src){
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("Falha ao carregar " + src));
    document.head.appendChild(s);
  });
}

const RDKIT_VER = "2025.3.4-1.0.0";
const RDKIT_BASE = `https://unpkg.com/@rdkit/rdkit@${RDKIT_VER}/dist/`;
let _rdkitPromise = null;
function getRDKit(){
  if (!_rdkitPromise){
    _rdkitPromise = loadScript(RDKIT_BASE + "RDKit_minimal.js")
      .then(() => window.initRDKitModule({ locateFile: () => RDKIT_BASE + "RDKit_minimal.wasm" }))
      .catch(err => { _rdkitPromise = null; throw err; });
  }
  return _rdkitPromise;
}

let _chartPromise = null;
function getChart(){
  if (!_chartPromise) _chartPromise = loadScript("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js");
  return _chartPromise;
}

/* ---------- pequenos utilitários ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const normTxt = v => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
function shake(el){ el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
function confetti(n = 90){
  const colors = ["#4f8cff", "#7c5cff", "#22d3c7", "#ffcf8a", "#ff8adc", "#c6f35b"];
  for (let i = 0; i < n; i++){
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = (2 + Math.random() * 2.5) + "s";
    c.style.animationDelay = (Math.random() * 0.6) + "s";
    c.style.borderRadius = Math.random() > .5 ? "50%" : "2px";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5500);
  }
}
