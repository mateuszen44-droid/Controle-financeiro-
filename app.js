// ======= PWA / Offline =======
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

// ======= Storage =======
const KEY = "financeiro_mt_v1";

const fmtBRL = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function nowISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthKey(isoDate){
  // "2026-02-26" -> "2026-02"
  return isoDate.slice(0,7);
}

const defaultState = () => ({
  categorias: ["Gastos Fixos", "Saúde", "Locomoção", "Lazer", "Investimentos", "Alimentação", "Outros"],
  budgets: {
    "Gastos Fixos": 0,
    "Saúde": 0,
    "Locomoção": 0,
    "Lazer": 0,
    "Investimentos": 0,
    "Alimentação": 0,
    "Outros": 0
  },
  txs: [] // {id, type, desc, amount, date, category, method, note, createdAt}
});

function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaultState();
    const s = JSON.parse(raw);
    return { ...defaultState(), ...s };
  }catch{
    return defaultState();
  }
}

function saveState(){
  localStorage.setItem(KEY, JSON.stringify(state));
}

let state = loadState();

// ======= UI refs =======
const $ = (id) => document.getElementById(id);

const views = {
  dashboard: $("view-dashboard"),
  lancar: $("view-lancar"),
  categorias: $("view-categorias"),
  historico: $("view-historico"),
};

const kpiSaldo = $("kpiSaldo");
const kpiEntradas = $("kpiEntradas");
const kpiSaidas = $("kpiSaidas");
const mesAtual = $("mesAtual");

const formLancamento = $("formLancamento");
const desc = $("desc");
const valor = $("valor");
const data = $("data");
const categoria = $("categoria");
const forma = $("forma");
const nota = $("nota");

const latestList = $("latestList");
const histList = $("histList");
const budgetList = $("budgetList");

const formCategoria = $("formCategoria");
const novaCategoria = $("novaCategoria");
const catList = $("catList");
const budgetEditor = $("budgetEditor");
const btnSalvarBudgets = $("btnSalvarBudgets");

const filtroMes = $("filtroMes");
const filtroTipo = $("filtroTipo");
const filtroCategoria = $("filtroCategoria");

const chart = $("chart");
const ctx = chart.getContext("2d");

// Backup modal
const backupModal = $("backupModal");
const btnBackup = $("btnBackup");
const btnFecharModal = $("btnFecharModal");
const btnExportar = $("btnExportar");
const importFile = $("importFile");
const btnZerar = $("btnZerar");

// ======= Navigation =======
document.querySelectorAll(".navBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.target;
    Object.values(views).forEach(v => v.classList.remove("active"));
    views[target].classList.add("active");

    renderAll();
  });
});

// Segmented type
let currentType = "entrada";
document.querySelectorAll(".segBtn").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".segBtn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    currentType = b.dataset.type;
  });
});

// ======= Populate selects =======
function refreshCategorySelects(){
  categoria.innerHTML = "";
  filtroCategoria.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "todas";
  optAll.textContent = "Todas";
  filtroCategoria.appendChild(optAll);

  state.categorias.forEach(c => {
    const o1 = document.createElement("option");
    o1.value = c;
    o1.textContent = c;
    categoria.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = c;
    o2.textContent = c;
    filtroCategoria.appendChild(o2);
  });

  // Guarantee budgets for new categories
  state.categorias.forEach(c => {
    if(typeof state.budgets[c] !== "number") state.budgets[c] = 0;
  });

  saveState();
}

// ======= Add transaction =======
function parseBRL(input){
  // accepts "39,90" or "39.90" or "1.234,56"
  const v = String(input).trim()
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function uid(){
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

formLancamento.addEventListener("submit", (e) => {
  e.preventDefault();

  const amount = parseBRL(valor.value);
  if(!Number.isFinite(amount) || amount <= 0){
    alert("Digite um valor válido (ex: 39,90).");
    return;
  }

  const tx = {
    id: uid(),
    type: currentType,
    desc: desc.value.trim(),
    amount,
    date: data.value,
    category: categoria.value,
    method: forma.value,
    note: nota.value.trim(),
    createdAt: Date.now()
  };

  state.txs.unshift(tx);
  saveState();

  // reset
  desc.value = "";
  valor.value = "";
  nota.value = "";
  data.value = nowISODate();

  // go dashboard
  document.querySelector('[data-target="dashboard"]').click();
});

// ======= Delete =======
function deleteTx(id){
  if(!confirm("Apagar este lançamento?")) return;
  state.txs = state.txs.filter(t => t.id !== id);
  saveState();
  renderAll();
}

// ======= Filters =======
function setDefaultMonth(){
  const today = nowISODate();
  filtroMes.value = today.slice(0,7);
}
function filteredTxs(){
  const m = filtroMes.value || nowISODate().slice(0,7);
  const tipo = filtroTipo.value;
  const cat = filtroCategoria.value;

  return state.txs.filter(t => {
    if(monthKey(t.date) !== m) return false;
    if(tipo !== "todos" && t.type !== tipo) return false;
    if(cat !== "todas" && t.category !== cat) return false;
    return true;
  });
}

// ======= KPIs =======
function totalsForMonth(m){
  const txs = state.txs.filter(t => monthKey(t.date) === m);
  const entradas = txs.filter(t => t.type === "entrada").reduce((a,b)=>a+b.amount,0);
  const saidas = txs.filter(t => t.type === "saida").reduce((a,b)=>a+b.amount,0);
  return { entradas, saidas, saldo: entradas - saidas };
}

function totalsAll(){
  const entradas = state.txs.filter(t => t.type === "entrada").reduce((a,b)=>a+b.amount,0);
  const saidas = state.txs.filter(t => t.type === "saida").reduce((a,b)=>a+b.amount,0);
  return { entradas, saidas, saldo: entradas - saidas };
}

// ======= Simple chart (no library) =======
function drawChart(m){
  const w = chart.width, h = chart.height;
  ctx.clearRect(0,0,w,h);

  // Build last 6 months including current
  const [yy,mm] = m.split("-").map(Number);
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(yy, mm-1-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    months.push(key);
  }

  const series = months.map(k => {
    const { entradas, saidas } = totalsForMonth(k);
    return { k, entradas, saidas, saldo: entradas-saidas };
  });

  const maxVal = Math.max(1, ...series.map(s => Math.max(s.entradas, s.saidas)));

  // axes baseline
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.beginPath();
  ctx.moveTo(30, 12);
  ctx.lineTo(30, h-30);
  ctx.lineTo(w-12, h-30);
  ctx.stroke();

  const barW = Math.floor((w-60)/series.length);
  series.forEach((s, i) => {
    const x0 = 36 + i*barW;
    const base = h-30;

    const inH = Math.round((s.entradas/maxVal) * (h-60));
    const outH = Math.round((s.saidas/maxVal) * (h-60));

    // entradas bar
    ctx.fillStyle = "rgba(92,255,176,.85)";
    ctx.fillRect(x0, base-inH, Math.floor(barW*0.38), inH);

    // saidas bar
    ctx.fillStyle = "rgba(255,107,107,.75)";
    ctx.fillRect(x0 + Math.floor(barW*0.45), base-outH, Math.floor(barW*0.38), outH);

    // month label
    ctx.fillStyle = "rgba(234,240,255,.70)";
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(s.k.slice(5), x0+2, h-12);
  });

  // legend
  ctx.fillStyle = "rgba(92,255,176,.85)";
  ctx.fillRect(36, 12, 10, 10);
  ctx.fillStyle = "rgba(234,240,255,.80)";
  ctx.fillText("Entradas", 50, 21);

  ctx.fillStyle = "rgba(255,107,107,.75)";
  ctx.fillRect(128, 12, 10, 10);
  ctx.fillStyle = "rgba(234,240,255,.80)";
  ctx.fillText("Saídas", 142, 21);
}

// ======= Render lists =======
function renderLatest(){
  const items = state.txs.slice(0,6);
  latestList.innerHTML = items.length ? "" : `<div class="muted">Sem lançamentos ainda.</div>`;

  items.forEach(t => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="left">
        <div><strong>${escapeHtml(t.desc)}</strong></div>
        <div class="small muted">${t.date} • <span class="badge">${escapeHtml(t.category)}</span> • <span class="badge">${escapeHtml(t.method)}</span></div>
        ${t.note ? `<div class="small muted">${escapeHtml(t.note)}</div>` : ""}
        <div class="actions">
          <button class="miniBtn" data-del="${t.id}">Apagar</button>
        </div>
      </div>
      <div class="right">
        <div class="${t.type === "entrada" ? "pos" : "neg"}">${t.type === "entrada" ? "+" : "-"} ${fmtBRL(t.amount)}</div>
      </div>
    `;
    latestList.appendChild(el);
  });

  latestList.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => deleteTx(b.dataset.del));
  });
}

function renderHistory(){
  const txs = filteredTxs();
  histList.innerHTML = txs.length ? "" : `<div class="muted">Nada encontrado nesse filtro.</div>`;

  txs.forEach(t => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="left">
        <div><strong>${escapeHtml(t.desc)}</strong></div>
        <div class="small muted">${t.date} • <span class="badge">${escapeHtml(t.category)}</span> • <span class="badge">${escapeHtml(t.method)}</span></div>
        ${t.note ? `<div class="small muted">${escapeHtml(t.note)}</div>` : ""}
        <div class="actions">
          <button class="miniBtn" data-del="${t.id}">Apagar</button>
        </div>
      </div>
      <div class="right">
        <div class="${t.type === "entrada" ? "pos" : "neg"}">${t.type === "entrada" ? "+" : "-"} ${fmtBRL(t.amount)}</div>
      </div>
    `;
    histList.appendChild(el);
  });

  histList.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => deleteTx(b.dataset.del));
  });
}

// ======= Budgets =======
function spentByCategoryForMonth(m){
  const spent = {};
  state.categorias.forEach(c => spent[c] = 0);

  state.txs.forEach(t => {
    if(monthKey(t.date) !== m) return;
    if(t.type !== "saida") return;
    if(typeof spent[t.category] !== "number") spent[t.category] = 0;
    spent[t.category] += t.amount;
  });
  return spent;
}

function renderBudgetList(){
  const m = filtroMes.value || nowISODate().slice(0,7);
  const spent = spentByCategoryForMonth(m);

  budgetList.innerHTML = "";
  state.categorias.forEach(c => {
    const limit = Number(state.budgets[c] || 0);
    const used = Number(spent[c] || 0);
    const pct = limit > 0 ? Math.min(100, Math.round((used/limit)*100)) : 0;

    const row = document.createElement("div");
    row.className = "budgetRow";
    row.innerHTML = `
      <div>
        <div><strong>${escapeHtml(c)}</strong> <span class="small muted">(${fmtBRL(used)} / ${limit>0?fmtBRL(limit):"sem limite"})</span></div>
        <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
      </div>
      <div class="small ${limit>0 && used>limit ? "neg" : "muted"}">${limit>0 ? (pct + "%") : "—"}</div>
    `;
    budgetList.appendChild(row);
  });
}

function renderBudgetEditor(){
  budgetEditor.innerHTML = "";
  state.categorias.forEach(c => {
    const row = document.createElement("div");
    row.className = "budgetRow";
    row.innerHTML = `
      <div>
        <div><strong>${escapeHtml(c)}</strong></div>
        <div class="small muted">Limite mensal (R$)</div>
      </div>
      <input inputmode="decimal" data-bud="${escapeHtml(c)}" placeholder="0,00" value="${formatInputMoney(state.budgets[c] || 0)}" />
    `;
    budgetEditor.appendChild(row);
  });
}

btnSalvarBudgets.addEventListener("click", () => {
  const inputs = budgetEditor.querySelectorAll("[data-bud]");
  inputs.forEach(inp => {
    const cat = inp.getAttribute("data-bud");
    const n = parseBRL(inp.value);
    state.budgets[cat] = Number.isFinite(n) ? n : 0;
  });
  saveState();
  alert("Orçamentos salvos ✅");
  renderAll();
});

// ======= Categories =======
function renderCategories(){
  catList.innerHTML = "";
  state.categorias.forEach(c => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `
      <span>${escapeHtml(c)}</span>
      <button title="Remover" data-delcat="${escapeHtml(c)}">✕</button>
    `;
    catList.appendChild(chip);
  });

  catList.querySelectorAll("[data-delcat]").forEach(b => {
    b.addEventListener("click", () => {
      const c = b.dataset.delcat;
      if(!confirm(`Remover categoria "${c}"? (não apaga lançamentos antigos)`)) return;
      state.categorias = state.categorias.filter(x => x !== c);
      delete state.budgets[c];
      saveState();
      refreshCategorySelects();
      renderAll();
    });
  });
}

formCategoria.addEventListener("submit", (e) => {
  e.preventDefault();
  const c = (novaCategoria.value || "").trim();
  if(!c) return;
  if(state.categorias.includes(c)){
    alert("Essa categoria já existe.");
    return;
  }
  state.categorias.push(c);
  state.budgets[c] = 0;
  novaCategoria.value = "";
  saveState();
  refreshCategorySelects();
  renderAll();
});

// ======= Backup / Import =======
btnBackup.addEventListener("click", () => backupModal.showModal());
btnFecharModal.addEventListener("click", () => backupModal.close());

btnExportar.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro-mt-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if(!file) return;
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    if(!obj || typeof obj !== "object") throw new Error("invalid");
    if(!confirm("Importar e substituir seus dados atuais?")) return;
    state = { ...defaultState(), ...obj };
    saveState();
    refreshCategorySelects();
    renderAll();
    alert("Importado ✅");
    backupModal.close();
  }catch{
    alert("Arquivo inválido.");
  }finally{
    importFile.value = "";
  }
});

btnZerar.addEventListener("click", () => {
  if(!confirm("Tem certeza que deseja apagar tudo?")) return;
  state = defaultState();
  saveState();
  refreshCategorySelects();
  renderAll();
  alert("Zerado ✅");
  backupModal.close();
});

// ======= Helpers =======
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function formatInputMoney(n){
  const v = Number(n || 0);
  return v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

// ======= Render everything =======
function renderKPIs(){
  const all = totalsAll();
  kpiSaldo.textContent = fmtBRL(all.saldo);
  kpiEntradas.textContent = fmtBRL(all.entradas);
  kpiSaidas.textContent = fmtBRL(all.saidas);

  const m = filtroMes.value || nowISODate().slice(0,7);
  const [y,mo] = m.split("-");
  mesAtual.textContent = `Mês selecionado: ${mo}/${y}`;
  drawChart(m);
}

function renderAll(){
  refreshCategorySelects();
  renderKPIs();
  renderLatest();
  renderBudgetList();
  renderCategories();
  renderBudgetEditor();
  renderHistory();
}

// ======= Init =======
data.value = nowISODate();
setDefaultMonth();
refreshCategorySelects();
renderAll();

// Update history on filters change
[filtroMes, filtroTipo, filtroCategoria].forEach(el => {
  el.addEventListener("change", renderAll);
});
