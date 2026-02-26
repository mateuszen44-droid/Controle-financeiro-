/* Financeiro Matheus e Thaís — PWA Local (sem servidor)
   - Dados ficam só no aparelho (localStorage)
   - Tipos: income | expense | investment
   - Categorias com orçamento mensal opcional (p/ barras)
*/

const STORE_KEY = "fmth_v2";

const money = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const todayISO = () => {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const monthKey = (isoDate) => isoDate.slice(0,7); // YYYY-MM
const monthLabel = (ym) => {
  const [y,m] = ym.split("-");
  return `${m}/${y}`;
};

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

const DEFAULT_CATEGORIES = [
  { id: "fixos", name: "Gastos Fixos", color: "#ff6b3d", icon: "🛒", monthlyBudget: 1200 },
  { id: "invest", name: "Investimentos", color: "#35f0c6", icon: "💹", monthlyBudget: 0 },
  { id: "saude", name: "Saúde", color: "#b69cff", icon: "🩺", monthlyBudget: 300 },
  { id: "lazer", name: "Lazer", color: "#55a8ff", icon: "🎮", monthlyBudget: 250 },
];

const state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){
      const s = JSON.parse(raw);
      // migração simples / garantir campos
      s.categories ??= DEFAULT_CATEGORIES;
      s.transactions ??= [];
      s.selectedMonth ??= monthKey(todayISO());
      return s;
    }
  }catch(e){}
  return {
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    selectedMonth: monthKey(todayISO()),
  };
}

function saveState(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/* ---------- Routing (views) ---------- */
const views = ["home","add","categories","history","more"];

function go(view){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelector(`#view-${view}`).classList.add("active");

  document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(`.navBtn[data-go="${view}"]`).forEach(b => b.classList.add("active"));

  if(view === "home") renderHome();
  if(view === "add") renderAddForm();
  if(view === "categories") renderCategories();
  if(view === "history") renderHistory();
}

document.querySelectorAll(".navBtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const v = btn.dataset.go;
    go(v);
  });
});

/* ---------- Elements ---------- */
const el = {
  homeBalance: document.getElementById("home-balance"),
  homeIncome: document.getElementById("home-income"),
  homeExpense: document.getElementById("home-expense"),
  recentList: document.getElementById("recentList"),
  legend: document.getElementById("legend"),

  lineChart: document.getElementById("lineChart"),
  segBtns: document.querySelectorAll(".segBtn"),

  // add form
  typeToggle: document.getElementById("typeToggle"),
  fAmount: document.getElementById("fAmount"),
  fDate: document.getElementById("fDate"),
  fCategory: document.getElementById("fCategory"),
  fNote: document.getElementById("fNote"),
  btnSave: document.getElementById("btnSave"),
  btnClear: document.getElementById("btnClear"),

  // categories
  catList: document.getElementById("catList"),
  btnNewCategory: document.getElementById("btnNewCategory"),

  // history
  hMonth: document.getElementById("hMonth"),
  hType: document.getElementById("hType"),
  historyList: document.getElementById("historyList"),

  // actions
  btnQuickAdd: document.getElementById("btnQuickAdd"),
  btnAddBottom: document.getElementById("btnAddBottom"),
  chipIncome: document.getElementById("chip-income"),
  chipExpense: document.getElementById("chip-expense"),
  btnSeeAll: document.getElementById("btnSeeAll"),
  btnExport: document.getElementById("btnExport"),
  btnReset: document.getElementById("btnReset"),
};

let currentAddType = "income";
let chartRange = "month";

/* ---------- Init ---------- */
function init(){
  // default date
  el.fDate.value = todayISO();

  // range switch
  el.segBtns.forEach(b=>{
    b.addEventListener("click", ()=>{
      el.segBtns.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      chartRange = b.dataset.range;
      renderHome();
    });
  });

  // add type toggle
  el.typeToggle.querySelectorAll(".typeBtn").forEach(b=>{
    b.addEventListener("click", ()=>{
      el.typeToggle.querySelectorAll(".typeBtn").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      currentAddType = b.dataset.type;
      renderAddForm();
    });
  });

  el.btnSave.addEventListener("click", onSave);
  el.btnClear.addEventListener("click", clearForm);

  el.btnQuickAdd.addEventListener("click", ()=> go("add"));
  el.btnAddBottom.addEventListener("click", ()=> go("add"));
  el.btnSeeAll.addEventListener("click", ()=> go("history"));

  el.chipIncome.addEventListener("click", ()=>{
    go("history");
    el.hType.value = "income";
    renderHistory();
  });
  el.chipExpense.addEventListener("click", ()=>{
    go("history");
    el.hType.value = "expense";
    renderHistory();
  });

  el.btnNewCategory.addEventListener("click", newCategoryPrompt);

  el.hMonth.addEventListener("change", ()=>{
    state.selectedMonth = el.hMonth.value;
    saveState();
    renderHistory();
    renderHome();
  });
  el.hType.addEventListener("change", renderHistory);

  el.btnExport.addEventListener("click", exportJSON);
  el.btnReset.addEventListener("click", resetAll);

  // PWA SW
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  // first render
  go("home");
}

init();

/* ---------- Compute helpers ---------- */
function monthTransactions(ym){
  return state.transactions.filter(t => monthKey(t.date) === ym);
}

function totalsForMonth(ym){
  const tx = monthTransactions(ym);
  const income = sum(tx.filter(t=>t.type==="income"));
  const expense = sum(tx.filter(t=>t.type==="expense"));
  const invest = sum(tx.filter(t=>t.type==="investment"));
  const balance = income - expense - invest;
  return { income, expense, invest, balance };
}

function sum(list){
  return list.reduce((a,b)=> a + Number(b.amount||0), 0);
}

function catById(id){
  return state.categories.find(c=>c.id===id) || state.categories[0];
}

/* ---------- Render: Home ---------- */
function renderHome(){
  const ym = state.selectedMonth;
  const { income, expense, invest, balance } = totalsForMonth(ym);

  // Top cards (igual ao modelo)
  el.homeBalance.textContent = money(balance);
  el.homeIncome.textContent = money(income);
  el.homeExpense.textContent = money(expense);

  // legend (4 bolinhas como no modelo)
  el.legend.innerHTML = "";
  const legendCats = ["Gastos Fixos", "Investimentos", "Saúde", "Lazer"];
  legendCats.forEach(name=>{
    const c = state.categories.find(x=>x.name===name);
    if(!c) return;
    const item = document.createElement("div");
    item.className = "legendItem";
    item.innerHTML = `<span class="dot" style="background:${c.color}"></span> ${c.name}`;
    el.legend.appendChild(item);
  });

  renderLineChart();
  renderRecent();
}

function renderRecent(){
  const ym = state.selectedMonth;
  const tx = monthTransactions(ym)
    .filter(t=> t.type !== "income") // mostrar gastos/invest
    .slice()
    .sort((a,b)=> (b.date.localeCompare(a.date)));

  // pegar últimos 4 (como na foto)
  const last = tx.slice(0,4);

  el.recentList.innerHTML = "";
  if(last.length === 0){
    el.recentList.innerHTML = `<div class="hint">Ainda não tem lançamentos neste mês.</div>`;
    return;
  }

  last.forEach(t=>{
    const cat = catById(t.categoryId);
    const title = t.note?.trim() || cat.name;
    const sub = cat.name;

    // % vs orçamento (se tiver)
    let pctText = "";
    let pct = 0;
    if(t.type === "expense" && Number(cat.monthlyBudget) > 0){
      const spentInCat = sum(monthTransactions(ym).filter(x=> x.type==="expense" && x.categoryId===cat.id));
      pct = Math.min(100, Math.round((spentInCat / Number(cat.monthlyBudget)) * 100));
      pctText = `${pct}%`;
    }else if(t.type === "investment"){
      pctText = "Invest.";
      pct = 75;
    }else{
      pctText = "";
      pct = 0;
    }

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="rowIcon" style="background: color-mix(in srgb, ${cat.color} 22%, rgba(255,255,255,.06));">
        ${cat.icon || "•"}
      </div>
      <div class="rowMain">
        <div class="rowTitle">${escapeHtml(title)}</div>
        <div class="rowSub">${escapeHtml(sub)}</div>
        ${pctText ? `<div class="progress"><div style="width:${pct}%"></div></div>` : ``}
      </div>
      <div class="rowRight">
        <div class="rowValue">${money(t.amount)}</div>
        <div class="rowPct">${pctText}</div>
      </div>
    `;
    row.addEventListener("click", ()=> editOrDeleteTransaction(t.id));
    el.recentList.appendChild(row);
  });
}

/* ---------- Chart (canvas) ---------- */
function renderLineChart(){
  const c = el.lineChart;
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;

  // background
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "rgba(0,0,0,.20)";
  ctx.fillRect(0,0,W,H);

  // grid
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 2;
  for(let i=1;i<=4;i++){
    const y = (H/5)*i;
    ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(W-20,y); ctx.stroke();
  }

  const ym = state.selectedMonth;
  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // pega séries (por categoria) só das 4 principais
  const catNames = ["Gastos Fixos","Investimentos","Saúde","Lazer"];
  const series = catNames.map(n=>{
    const cat = state.categories.find(c=>c.name===n);
    if(!cat) return null;
    const arr = Array(daysInMonth).fill(0);
    monthTransactions(ym).forEach(t=>{
      if(t.type !== "expense" && t.type !== "investment") return;
      if(t.categoryId !== cat.id) return;
      const day = Number(t.date.slice(8,10));
      arr[day-1] += Number(t.amount||0);
    });
    // acumula (curva bonita)
    for(let i=1;i<arr.length;i++) arr[i] += arr[i-1];
    return { cat, arr };
  }).filter(Boolean);

  // escala
  const max = Math.max(10, ...series.flatMap(s=>s.arr));
  const padL = 30, padR = 20, padT = 20, padB = 40;
  const x = (i)=> padL + (i/(daysInMonth-1))*(W-padL-padR);
  const y = (v)=> padT + (1 - v/max)*(H-padT-padB);

  // labels (Jan/Feb style)
  ctx.fillStyle = "rgba(255,255,255,.50)";
  ctx.font = "24px system-ui";
  ctx.fillText(monthLabel(ym), padL, H-12);

  // draw lines
  series.forEach(s=>{
    ctx.strokeStyle = s.cat.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    s.arr.forEach((v,i)=>{
      const px = x(i), py = y(v);
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    });
    ctx.stroke();

    // dots (3 pontos)
    const marks = [Math.floor(daysInMonth*0.25), Math.floor(daysInMonth*0.55), daysInMonth-1];
    ctx.fillStyle = s.cat.color;
    marks.forEach(mi=>{
      const px=x(mi), py=y(s.arr[mi]);
      ctx.beginPath(); ctx.arc(px,py,7,0,Math.PI*2); ctx.fill();
    });
  });
}

/* ---------- Render: Add form ---------- */
function renderAddForm(){
  // preencher categorias
  el.fCategory.innerHTML = "";
  state.categories.forEach(c=>{
    const op = document.createElement("option");
    op.value = c.id;
    op.textContent = `${c.icon || "•"}  ${c.name}`;
    el.fCategory.appendChild(op);
  });

  // default category by type
  if(currentAddType === "investment"){
    const inv = state.categories.find(c=>c.name==="Investimentos") || state.categories[0];
    el.fCategory.value = inv.id;
  }else{
    el.fCategory.value = state.categories[0].id;
  }
}

/* ---------- Render: Categories ---------- */
function renderCategories(){
  el.catList.innerHTML = "";
  state.categories.forEach(cat=>{
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="rowIcon" style="background: color-mix(in srgb, ${cat.color} 22%, rgba(255,255,255,.06));">
        ${cat.icon || "•"}
      </div>
      <div class="rowMain">
        <div class="rowTitle">${escapeHtml(cat.name)}</div>
        <div class="rowSub">Orçamento mensal: ${money(cat.monthlyBudget || 0)}</div>
      </div>
      <div class="rowRight">
        <button class="pillBtn" style="padding:10px 12px">Editar</button>
      </div>
    `;
    row.querySelector("button").addEventListener("click", ()=> editCategory(cat.id));
    el.catList.appendChild(row);
  });
}

/* ---------- Render: History ---------- */
function renderHistory(){
  // month select (últimos 12 meses com base no hoje)
  const now = new Date();
  const months = [];
  for(let i=0;i<12;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    months.push(ym);
  }
  el.hMonth.innerHTML = months.map(m=> `<option value="${m}">${monthLabel(m)}</option>`).join("");
  el.hMonth.value = state.selectedMonth;

  const ym = el.hMonth.value;
  const type = el.hType.value;

  let list = monthTransactions(ym).slice().sort((a,b)=> b.date.localeCompare(a.date));
  if(type !== "all") list = list.filter(t=> t.type === type);

  el.historyList.innerHTML = "";
  if(list.length === 0){
    el.historyList.innerHTML = `<div class="hint">Sem registros para esse filtro.</div>`;
    return;
  }

  list.forEach(t=>{
    const cat = catById(t.categoryId);
    const title = t.note?.trim() || cat.name;
    const sub = `${t.type === "income" ? "Entrada" : (t.type==="expense" ? "Saída" : "Investimento")} • ${cat.name} • ${formatDateBR(t.date)}`;

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="rowIcon" style="background: color-mix(in srgb, ${cat.color} 22%, rgba(255,255,255,.06));">
        ${cat.icon || "•"}
      </div>
      <div class="rowMain">
        <div class="rowTitle">${escapeHtml(title)}</div>
        <div class="rowSub">${escapeHtml(sub)}</div>
      </div>
      <div class="rowRight">
        <div class="rowValue">${money(t.amount)}</div>
      </div>
    `;
    row.addEventListener("click", ()=> editOrDeleteTransaction(t.id));
    el.historyList.appendChild(row);
  });
}

/* ---------- Actions: Save transaction ---------- */
function onSave(){
  const raw = (el.fAmount.value || "").replace(/\./g,"").replace(",",".").trim();
  const amount = Number(raw);
  if(!amount || amount <= 0){
    alert("Informe um valor válido. Ex: 59,90");
    return;
  }

  const date = el.fDate.value || todayISO();
  const categoryId = el.fCategory.value;
  const note = (el.fNote.value || "").trim();

  const tx = {
    id: uid(),
    type: currentAddType,
    amount,
    date,
    categoryId,
    note,
    createdAt: Date.now()
  };

  state.transactions.unshift(tx);
  saveState();

  clearForm();
  go("home");
}

function clearForm(){
  el.fAmount.value = "";
  el.fDate.value = todayISO();
  el.fNote.value = "";
  renderAddForm();
}

/* ---------- Edit/Delete transaction ---------- */
function editOrDeleteTransaction(id){
  const t = state.transactions.find(x=>x.id===id);
  if(!t) return;

  const action = prompt(
    `Transação:\n${formatDateBR(t.date)} • ${money(t.amount)}\n\nDigite:\n1 = Editar\n2 = Apagar\n(ou cancelar)`
  );
  if(action === "2"){
    if(confirm("Tem certeza que deseja apagar?")){
      state.transactions = state.transactions.filter(x=>x.id!==id);
      saveState();
      renderHome();
      renderHistory();
    }
    return;
  }
  if(action !== "1") return;

  // carregar no formulário
  currentAddType = t.type;
  el.typeToggle.querySelectorAll(".typeBtn").forEach(x=>{
    x.classList.toggle("active", x.dataset.type===currentAddType);
  });
  go("add");
  el.fAmount.value = String(t.amount).replace(".", ",");
  el.fDate.value = t.date;
  el.fCategory.value = t.categoryId;
  el.fNote.value = t.note || "";

  // ao salvar, substituir
  el.btnSave.onclick = ()=>{
    const raw = (el.fAmount.value || "").replace(/\./g,"").replace(",",".").trim();
    const amount = Number(raw);
    if(!amount || amount <= 0){
      alert("Informe um valor válido.");
      return;
    }
    t.type = currentAddType;
    t.amount = amount;
    t.date = el.fDate.value || todayISO();
    t.categoryId = el.fCategory.value;
    t.note = (el.fNote.value || "").trim();
    saveState();

    // restaurar botão salvar padrão
    el.btnSave.onclick = onSave;
    clearForm();
    go("home");
  };
}

/* ---------- Categories: create/edit ---------- */
function newCategoryPrompt(){
  const name = prompt("Nome da categoria (ex: Transporte):");
  if(!name) return;

  const icon = prompt("Ícone (pode ser emoji) (ex: 🚗):", "📌") || "📌";
  const color = prompt("Cor HEX (ex: #55a8ff):", "#55a8ff") || "#55a8ff";
  const budgetRaw = prompt("Orçamento mensal (opcional). Ex: 300", "0") || "0";
  const monthlyBudget = Number(String(budgetRaw).replace(",","."));

  state.categories.push({
    id: uid(),
    name: name.trim(),
    icon,
    color,
    monthlyBudget: isFinite(monthlyBudget) ? monthlyBudget : 0
  });

  saveState();
  renderCategories();
  renderAddForm();
  renderHome();
}

function editCategory(catId){
  const c = state.categories.find(x=>x.id===catId);
  if(!c) return;

  const name = prompt("Nome:", c.name);
  if(!name) return;

  const icon = prompt("Ícone (emoji):", c.icon || "📌") || "📌";
  const color = prompt("Cor HEX:", c.color || "#55a8ff") || "#55a8ff";
  const budgetRaw = prompt("Orçamento mensal:", String(c.monthlyBudget || 0));
  const monthlyBudget = Number(String(budgetRaw||"0").replace(",","."));

  c.name = name.trim();
  c.icon = icon;
  c.color = color;
  c.monthlyBudget = isFinite(monthlyBudget) ? monthlyBudget : 0;

  saveState();
  renderCategories();
  renderAddForm();
  renderHome();
}

/* ---------- Export / Reset ---------- */
function exportJSON(){
  const data = JSON.stringify(state, null, 2);
  // iPhone: abrir em nova aba
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "financeiro-matheus-thais.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

function resetAll(){
  if(!confirm("Apagar tudo? Isso remove lançamentos e categorias personalizadas.")) return;
  localStorage.removeItem(STORE_KEY);
  location.reload();
}

/* ---------- Utils ---------- */
function formatDateBR(iso){
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}