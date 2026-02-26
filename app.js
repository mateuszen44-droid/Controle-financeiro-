const KEY = "fmth_ultra_premium_v1";

const fmtBRL = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pad2 = (x) => String(x).padStart(2, "0");
const ymOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
};

const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[m-1]} ${y}`;
};

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

function defaults(){
  const now = new Date();
  const ym = ymOf(now);

  return {
    version: 1,
    ui: { month: ym, range: "month" },
    categories: [
      { id:"cat_fixed", name:"Gastos Fixos", emoji:"🏠", color:"#b0b7ff", budget: 1200 },
      { id:"cat_market", name:"Supermercado", emoji:"🛒", color:"#4aa3ff", budget: 800 },
      { id:"cat_food", name:"Alimentação", emoji:"🍽️", color:"#ffb35b", budget: 450 },
      { id:"cat_transport", name:"Locomoção", emoji:"🚗", color:"#7cc4ff", budget: 250 },
      { id:"cat_health", name:"Saúde", emoji:"🩺", color:"#ff6b8a", budget: 350 },
      { id:"cat_leisure", name:"Lazer", emoji:"🎮", color:"#32f5c8", budget: 300 },
      { id:"cat_other", name:"Outros", emoji:"🧩", color:"#8a7dff", budget: 200 },
    ],
    transactions: [],
    investments: [],
    goals: [
      { id: uid(), name: "Reserva Emergência", target: 3000, current: 0 },
      { id: uid(), name: "Viagem final do ano", target: 2500, current: 0 },
      { id: uid(), name: "Troca do carro", target: 8000, current: 0 }
    ]
  };
}

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaults();
    const d = JSON.parse(raw);
    if(!d?.version) return defaults();
    return d;
  }catch{
    return defaults();
  }
}

let DB = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(DB));

/* DOM */
const pages = {
  home: document.getElementById("page-home"),
  transactions: document.getElementById("page-transactions"),
  categories: document.getElementById("page-categories"),
  investments: document.getElementById("page-investments"),
  goals: document.getElementById("page-goals"),
};

const tabs = Array.from(document.querySelectorAll(".tab"));
const fabAdd = document.getElementById("fabAdd");

const balanceValue = document.getElementById("balanceValue");
const incomeValue = document.getElementById("incomeValue");
const expenseValue = document.getElementById("expenseValue");
const investedValue = document.getElementById("investedValue");
const boxesValue = document.getElementById("boxesValue");

const monthLabelEl = document.getElementById("monthLabel");
const monthSelect = document.getElementById("monthSelect");
const filterMonth = document.getElementById("filterMonth");
const filterType = document.getElementById("filterType");

const recentList = document.getElementById("recentList");
const goalsPreview = document.getElementById("goalsPreview");

const txList = document.getElementById("txList");
const catsGrid = document.getElementById("catsGrid");

const investTotalPill = document.getElementById("investTotalPill");
const invList = document.getElementById("invList");

const goalsList = document.getElementById("goalsList");

const btnGoTransactions = document.getElementById("btnGoTransactions");
const btnGoGoals = document.getElementById("btnGoGoals");
const btnAddTxTop = document.getElementById("btnAddTxTop");

const btnQuickIncome = document.getElementById("btnQuickIncome");
const btnQuickExpense = document.getElementById("btnQuickExpense");

const btnExport = document.getElementById("btnExport");
const btnImport = document.getElementById("btnImport");
const fileImport = document.getElementById("fileImport");

const btnAddCategory = document.getElementById("btnAddCategory");
const btnAddInvestment = document.getElementById("btnAddInvestment");
const btnAddGoal = document.getElementById("btnAddGoal");

/* Modals */
const modalTx = document.getElementById("modalTx");
const txType = document.getElementById("txType");
const txDate = document.getElementById("txDate");
const txDesc = document.getElementById("txDesc");
const txCategory = document.getElementById("txCategory");
const txAmount = document.getElementById("txAmount");
const txGoal = document.getElementById("txGoal");

const modalCat = document.getElementById("modalCat");
const catName = document.getElementById("catName");
const catBudget = document.getElementById("catBudget");
const catEmoji = document.getElementById("catEmoji");
const catColor = document.getElementById("catColor");

const modalGoal = document.getElementById("modalGoal");
const goalName = document.getElementById("goalName");
const goalTarget = document.getElementById("goalTarget");
const goalCurrent = document.getElementById("goalCurrent");

const modalInv = document.getElementById("modalInv");
const invDate = document.getElementById("invDate");
const invAmount = document.getElementById("invAmount");
const invDesc = document.getElementById("invDesc");

/* Helpers */
const esc = (s) => String(s||"")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");

const openModal = (m) => { m.classList.add("show"); m.setAttribute("aria-hidden","false"); };
const closeModal = (m) => { m.classList.remove("show"); m.setAttribute("aria-hidden","true"); };

document.getElementById("btnCloseTx").onclick = ()=> closeModal(modalTx);
document.getElementById("btnCancelTx").onclick = ()=> closeModal(modalTx);
document.getElementById("btnCloseCat").onclick = ()=> closeModal(modalCat);
document.getElementById("btnCancelCat").onclick = ()=> closeModal(modalCat);
document.getElementById("btnCloseGoal").onclick = ()=> closeModal(modalGoal);
document.getElementById("btnCancelGoal").onclick = ()=> closeModal(modalGoal);
document.getElementById("btnCloseInv").onclick = ()=> closeModal(modalInv);
document.getElementById("btnCancelInv").onclick = ()=> closeModal(modalInv);

function computeMonths(){
  const set = new Set();
  set.add(ymOf(new Date()));
  DB.transactions.forEach(t => set.add(t.date.slice(0,7)));
  DB.investments.forEach(i => set.add(i.date.slice(0,7)));
  return [...set].sort((a,b)=> b.localeCompare(a));
}

function fillMonths(){
  const months = computeMonths();
  monthSelect.innerHTML = "";
  filterMonth.innerHTML = "";

  months.forEach(ym=>{
    const o1 = document.createElement("option");
    o1.value = ym;
    o1.textContent = monthLabel(ym);
    monthSelect.appendChild(o1);

    const o2 = o1.cloneNode(true);
    filterMonth.appendChild(o2);
  });

  monthSelect.value = DB.ui.month;
  filterMonth.value = DB.ui.month;
  monthLabelEl.textContent = monthLabel(DB.ui.month);
}

function sumMonth(type, ym){
  return DB.transactions
    .filter(t => t.type===type && t.date.startsWith(ym))
    .reduce((a,t)=> a + Number(t.amount||0), 0);
}
function sumInvest(){
  return DB.investments.reduce((a,i)=> a + Number(i.amount||0), 0);
}
function sumBoxes(){
  return DB.goals.reduce((a,g)=> a + Number(g.current||0), 0);
}

/* NAV */
function openTab(name){
  Object.entries(pages).forEach(([k,el])=>{
    el.classList.toggle("active", k===name);
  });
  tabs.forEach(t=> t.classList.toggle("active", t.dataset.tab===name));
  if(name==="home") renderHome();
  if(name==="transactions") renderTransactions();
  if(name==="categories") renderCategories();
  if(name==="investments") renderInvestments();
  if(name==="goals") renderGoals();
}

tabs.forEach(t=> t.onclick = ()=> openTab(t.dataset.tab));

btnGoTransactions.onclick = ()=> openTab("transactions");
btnGoGoals.onclick = ()=> openTab("goals");

/* RANGE */
document.getElementById("rangeSeg").addEventListener("click", (e)=>{
  const b = e.target.closest(".segbtn");
  if(!b) return;
  document.querySelectorAll(".segbtn").forEach(x=> x.classList.remove("active"));
  b.classList.add("active");
  DB.ui.range = b.dataset.range;
  save();
  renderCharts();
});

/* TX modal open */
function populateCategorySelect(){
  txCategory.innerHTML = "";
  DB.categories.forEach(c=>{
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = `${c.emoji||"🧩"} ${c.name}`;
    txCategory.appendChild(o);
  });
}
function populateGoalsSelect(){
  txGoal.innerHTML = `<option value="">Nenhuma</option>`;
  DB.goals.forEach(g=>{
    const o = document.createElement("option");
    o.value = g.id;
    o.textContent = `🎯 ${g.name}`;
    txGoal.appendChild(o);
  });
}

function openTx(type){
  populateCategorySelect();
  populateGoalsSelect();
  txType.value = type || "expense";
  txDate.value = todayISO();
  txDesc.value = "";
  txAmount.value = "";
  txGoal.value = "";
  openModal(modalTx);
}

fabAdd.onclick = ()=> openTx("expense");
btnAddTxTop.onclick = ()=> openTx("expense");
btnQuickIncome.onclick = ()=> openTx("income");
btnQuickExpense.onclick = ()=> openTx("expense");

document.getElementById("btnSaveTx").onclick = ()=>{
  const type = txType.value;
  const date = txDate.value || todayISO();
  const desc = (txDesc.value||"").trim() || (type==="income" ? "Entrada" : "Saída");
  const categoryId = txCategory.value || DB.categories[0]?.id;
  const amount = Number(txAmount.value||0);
  const goalId = txGoal.value || "";

  if(!(amount>0)){ alert("Coloque um valor maior que 0."); return; }

  DB.transactions.unshift({ id: uid(), type, date, desc, categoryId, amount, goalId });
  save();
  closeModal(modalTx);
  fillMonths();
  renderAll();
};

/* Categories modal */
btnAddCategory.onclick = ()=>{
  catName.value = "";
  catBudget.value = "";
  catEmoji.value = "";
  catColor.value = "#4aa3ff";
  openModal(modalCat);
};

document.getElementById("btnSaveCat").onclick = ()=>{
  const name = (catName.value||"").trim();
  if(!name){ alert("Digite um nome."); return; }
  const budget = Number(catBudget.value||0);
  const emoji = (catEmoji.value||"").trim() || "🧩";
  const color = catColor.value || "#4aa3ff";

  DB.categories.unshift({ id: uid(), name, emoji, color, budget });
  save();
  closeModal(modalCat);
  renderAll();
};

/* Goals modal */
btnAddGoal.onclick = ()=>{
  goalName.value = "";
  goalTarget.value = "";
  goalCurrent.value = "";
  openModal(modalGoal);
};
document.getElementById("btnSaveGoal").onclick = ()=>{
  const name = (goalName.value||"").trim();
  const target = Number(goalTarget.value||0);
  const current = Number(goalCurrent.value||0);
  if(!name){ alert("Digite o nome."); return; }
  if(!(target>0)){ alert("Meta precisa ser maior que 0."); return; }
  DB.goals.unshift({ id: uid(), name, target, current: Math.max(0,current) });
  save();
  closeModal(modalGoal);
  renderAll();
};

/* Invest modal */
btnAddInvestment.onclick = ()=>{
  invDate.value = todayISO();
  invAmount.value = "";
  invDesc.value = "";
  openModal(modalInv);
};
document.getElementById("btnSaveInv").onclick = ()=>{
  const date = invDate.value || todayISO();
  const amount = Number(invAmount.value||0);
  const desc = (invDesc.value||"").trim() || "Aporte";
  if(!(amount>0)){ alert("Valor do aporte deve ser maior que 0."); return; }
  DB.investments.unshift({ id: uid(), date, amount, desc });
  save();
  closeModal(modalInv);
  fillMonths();
  renderAll();
};

/* Month selects */
monthSelect.onchange = ()=>{
  DB.ui.month = monthSelect.value;
  filterMonth.value = DB.ui.month;
  monthLabelEl.textContent = monthLabel(DB.ui.month);
  save();
  renderAll();
};
filterMonth.onchange = ()=>{
  DB.ui.month = filterMonth.value;
  monthSelect.value = DB.ui.month;
  monthLabelEl.textContent = monthLabel(DB.ui.month);
  save();
  renderTransactions();
  renderCharts();
};

/* Filters */
filterType.onchange = ()=> renderTransactions();

/* Export/Import */
btnExport.onclick = ()=>{
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

btnImport.onclick = ()=> fileImport.click();
fileImport.addEventListener("change", async ()=>{
  const f = fileImport.files?.[0];
  if(!f) return;
  try{
    const txt = await f.text();
    const data = JSON.parse(txt);
    if(!data?.version) throw new Error("Arquivo inválido.");
    DB = data;
    save();
    fillMonths();
    renderAll();
    alert("Importado com sucesso!");
  }catch(e){
    alert("Erro ao importar: " + e.message);
  }finally{
    fileImport.value = "";
  }
});

/* Charts (premium glow plugin) */
Chart.defaults.color = "rgba(234,240,255,.75)";
Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, "SF Pro Display", Roboto, Arial';

const glowPlugin = {
  id: "glowPlugin",
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = "rgba(138,125,255,.35)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore();
  }
};

let donutChart = null;
let lineChart = null;
let investChart = null;

function gradient(ctx){
  const g = ctx.createLinearGradient(0,0,280,0);
  g.addColorStop(0, "rgba(74,163,255,.95)");
  g.addColorStop(1, "rgba(138,125,255,.98)");
  return g;
}

function renderCharts(){
  const ym = DB.ui.month;
  const range = DB.ui.range;

  // DONUT (expenses by category)
  const expenses = DB.transactions.filter(t => t.type==="expense" && t.date.startsWith(ym));
  const byCat = new Map();
  for(const t of expenses){
    byCat.set(t.categoryId, (byCat.get(t.categoryId)||0) + Number(t.amount||0));
  }
  const cats = DB.categories
    .map(c=> ({...c, total: byCat.get(c.id)||0}))
    .filter(c=> c.total>0);

  const donutLabels = cats.length ? cats.map(c=>c.name) : ["Sem dados"];
  const donutData = cats.length ? cats.map(c=>c.total) : [1];
  const donutColors = cats.length ? cats.map(c=>c.color) : ["rgba(255,255,255,.14)"];

  const dctx = document.getElementById("donut").getContext("2d");
  if(donutChart) donutChart.destroy();
  donutChart = new Chart(dctx, {
    type:"doughnut",
    plugins:[glowPlugin],
    data:{
      labels: donutLabels,
      datasets:[{
        data: donutData,
        backgroundColor: donutColors,
        borderColor: "rgba(255,255,255,.12)",
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options:{
      cutout:"72%",
      plugins:{
        legend:{ position:"top" },
        tooltip:{ callbacks:{ label:(it)=> `${it.label}: ${fmtBRL(it.raw)}` } }
      }
    }
  });

  // LINE (income vs expense)
  let labels = [];
  let inc = [];
  let exp = [];

  if(range==="year"){
    labels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    inc = new Array(12).fill(0);
    exp = new Array(12).fill(0);
    const year = Number(ym.split("-")[0]);

    for(const t of DB.transactions){
      const d = new Date(t.date+"T00:00:00");
      if(d.getFullYear()!==year) continue;
      const i = d.getMonth();
      if(t.type==="income") inc[i]+=Number(t.amount||0);
      else exp[i]+=Number(t.amount||0);
    }
  } else {
    // month: 5 buckets (visual premium)
    labels = ["S1","S2","S3","S4","S5"];
    inc = [0,0,0,0,0];
    exp = [0,0,0,0,0];
    for(const t of DB.transactions.filter(t=> t.date.startsWith(ym))){
      const day = Number(t.date.slice(8,10));
      const b = Math.min(4, Math.floor((day-1)/6));
      if(t.type==="income") inc[b]+=Number(t.amount||0);
      else exp[b]+=Number(t.amount||0);
    }
  }

  const lctx = document.getElementById("line").getContext("2d");
  if(lineChart) lineChart.destroy();
  const grad = gradient(lctx);

  lineChart = new Chart(lctx, {
    type:"line",
    plugins:[glowPlugin],
    data:{
      labels,
      datasets:[
        {
          label:"Entradas",
          data: inc,
          borderColor: "rgba(50,245,200,.95)",
          backgroundColor: "rgba(50,245,200,.14)",
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: .38,
          fill: false
        },
        {
          label:"Saídas",
          data: exp,
          borderColor: grad,
          backgroundColor: "rgba(138,125,255,.10)",
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: .38,
          fill: false
        }
      ]
    },
    options:{
      plugins:{
        legend:{ position:"top" },
        tooltip:{ callbacks:{ label:(it)=> `${it.dataset.label}: ${fmtBRL(it.raw)}` } }
      },
      scales:{
        x:{ grid:{ color:"rgba(255,255,255,.06)" } },
        y:{ grid:{ color:"rgba(255,255,255,.06)" }, ticks:{ callback:()=>"" } }
      }
    }
  });
}

function renderInvestChart(){
  const ctx = document.getElementById("investLine").getContext("2d");
  const items = [...DB.investments].sort((a,b)=> (a.date||"").localeCompare(b.date||""));

  const labels = items.length ? items.map(i=>i.date) : ["Sem dados"];
  let acc = 0;
  const series = items.length ? items.map(i=> (acc += Number(i.amount||0))) : [0];

  if(investChart) investChart.destroy();
  investChart = new Chart(ctx, {
    type:"line",
    plugins:[glowPlugin],
    data:{
      labels,
      datasets:[{
        label:"Investido",
        data: series,
        borderColor: gradient(ctx),
        backgroundColor: "rgba(74,163,255,.14)",
        fill: true,
        tension: .38,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options:{
      plugins:{
        legend:{ display:false },
        tooltip:{ callbacks:{ label:(it)=> fmtBRL(it.raw) } }
      },
      scales:{
        x:{ grid:{ color:"rgba(255,255,255,.06)" } },
        y:{ grid:{ color:"rgba(255,255,255,.06)" }, ticks:{ callback:()=>"" } }
      }
    }
  });
}

/* Render blocks */
function renderTop(){
  const ym = DB.ui.month;
  const inc = sumMonth("income", ym);
  const exp = sumMonth("expense", ym);
  const bal = inc - exp;

  balanceValue.textContent = fmtBRL(bal);
  incomeValue.textContent = fmtBRL(inc);
  expenseValue.textContent = fmtBRL(exp);
  investedValue.textContent = fmtBRL(sumInvest());
  boxesValue.textContent = fmtBRL(sumBoxes());
  monthLabelEl.textContent = monthLabel(ym);
}

function renderRecent(){
  const ym = DB.ui.month;
  const spentByCat = new Map();
  for(const t of DB.transactions.filter(t=> t.type==="expense" && t.date.startsWith(ym))){
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId)||0) + Number(t.amount||0));
  }

  const list = DB.transactions
    .filter(t=> t.type==="expense" && t.date.startsWith(ym))
    .slice(0, 6);

  recentList.innerHTML = "";

  if(list.length===0){
    recentList.innerHTML = `<div class="row"><div style="flex:1"><div class="title">Sem gastos no mês</div><div class="sub">Toque em + para adicionar</div></div></div>`;
    return;
  }

  list.forEach(t=>{
    const cat = DB.categories.find(c=> c.id===t.categoryId) || { name:"Categoria", emoji:"🧩", budget:0, color:"#4aa3ff" };
    const spent = spentByCat.get(cat.id)||0;
    const budget = Number(cat.budget||0);
    const pct = budget>0 ? Math.min(100, Math.round((spent/budget)*100)) : 0;

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="ico">${cat.emoji||"🧩"}</div>
      <div class="mid">
        <div class="title">${esc(t.desc)}</div>
        <div class="sub">${esc(cat.name)}</div>
        <div class="bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="right">
        <div class="amount">${fmtBRL(t.amount)}</div>
        <div class="pct">${pct}%</div>
      </div>
    `;
    recentList.appendChild(el);
  });
}

function renderGoalsPreview(){
  goalsPreview.innerHTML = "";
  const g = DB.goals.slice(0, 4);
  if(g.length===0){
    goalsPreview.innerHTML = `<div class="row"><div style="flex:1"><div class="title">Sem metas</div><div class="sub">Adicione uma meta</div></div></div>`;
    return;
  }

  g.forEach(x=>{
    const pct = Math.min(100, Math.round((Number(x.current||0)/Number(x.target||1))*100));
    const el = document.createElement("div");
    el.className = "goal";
    el.innerHTML = `
      <div class="goalname">${esc(x.name)}</div>
      <div class="goalmeta">${fmtBRL(x.current)} de ${fmtBRL(x.target)}</div>
      <div class="goalrow"><span style="color:var(--muted)">Progresso</span><b>${pct}%</b></div>
      <div class="bar"><span style="width:${pct}%"></span></div>
    `;
    goalsPreview.appendChild(el);
  });
}

function renderTransactions(){
  const ym = DB.ui.month;
  const type = filterType.value;

  const list = DB.transactions
    .filter(t=> t.date.startsWith(ym))
    .filter(t=> type==="all" ? true : t.type===type)
    .slice(0, 120);

  txList.innerHTML = "";

  if(list.length===0){
    txList.innerHTML = `<div class="row"><div style="flex:1"><div class="title">Sem transações</div><div class="sub">Toque em “Adicionar”</div></div></div>`;
    return;
  }

  list.forEach(t=>{
    const cat = DB.categories.find(c=> c.id===t.categoryId) || { name:"Categoria", emoji:"🧩" };
    const badgeClass = t.type==="income" ? "badge in" : "badge out";

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="ico">${cat.emoji||"🧩"}</div>
      <div class="mid">
        <div class="title">${esc(t.desc)}</div>
        <div class="sub">${t.date} • ${esc(cat.name)}</div>
      </div>
      <div class="right">
        <div class="${badgeClass}">${fmtBRL(t.amount)}</div>
      </div>
    `;

    row.onclick = ()=>{
      const ok = confirm("Excluir esta transação?");
      if(!ok) return;
      DB.transactions = DB.transactions.filter(x=> x.id!==t.id);
      save();
      fillMonths();
      renderAll();
    };

    txList.appendChild(row);
  });
}

function renderCategories(){
  const ym = DB.ui.month;
  const spentByCat = new Map();
  for(const t of DB.transactions.filter(t=> t.type==="expense" && t.date.startsWith(ym))){
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId)||0) + Number(t.amount||0));
  }

  catsGrid.innerHTML = "";
  DB.categories.forEach(c=>{
    const spent = spentByCat.get(c.id)||0;
    const budget = Number(c.budget||0);
    const pct = budget>0 ? Math.min(100, Math.round((spent/budget)*100)) : 0;

    const el = document.createElement("div");
    el.className = "cat";
    el.innerHTML = `
      <div class="cathead">
        <div class="catleft">
          <div class="ico">${c.emoji||"🧩"}</div>
          <div>
            <div class="catname">${esc(c.name)}</div>
            <div class="catmeta">Orçamento: ${fmtBRL(budget)} • Gasto: ${fmtBRL(spent)}</div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="catbtn" data-act="edit">✎</button>
          <button class="catbtn" data-act="del">🗑</button>
        </div>
      </div>
      <div class="bar"><span style="width:${pct}%; background:linear-gradient(90deg, ${c.color}, rgba(138,125,255,.98));"></span></div>
    `;

    el.querySelector('[data-act="edit"]').onclick = (ev)=>{
      ev.stopPropagation();
      const v = prompt(`Novo orçamento para ${c.name} (R$):`, String(budget));
      if(v===null) return;
      const nb = Number(String(v).replace(",","."));
      if(Number.isNaN(nb) || nb<0){ alert("Valor inválido."); return; }
      c.budget = nb;
      save();
      renderAll();
    };

    el.querySelector('[data-act="del"]').onclick = (ev)=>{
      ev.stopPropagation();
      const ok = confirm(`Apagar categoria "${c.name}"?`);
      if(!ok) return;
      const fallback = DB.categories.find(x=> x.id!==c.id)?.id || "";
      DB.transactions = DB.transactions.map(t=> t.categoryId===c.id ? ({...t, categoryId: fallback}) : t);
      DB.categories = DB.categories.filter(x=> x.id!==c.id);
      save();
      renderAll();
    };

    catsGrid.appendChild(el);
  });
}

function renderInvestments(){
  investTotalPill.textContent = fmtBRL(sumInvest());

  invList.innerHTML = "";
  const list = [...DB.investments].sort((a,b)=> (b.date||"").localeCompare(a.date||""));

  if(list.length===0){
    invList.innerHTML = `<div class="row"><div style="flex:1"><div class="title">Sem investimentos</div><div class="sub">Toque em “Novo”</div></div></div>`;
    renderInvestChart();
    return;
  }

  list.forEach(i=>{
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="ico">📈</div>
      <div class="mid">
        <div class="title">${esc(i.desc||"Aporte")}</div>
        <div class="sub">${i.date}</div>
      </div>
      <div class="right">
        <div class="badge">${fmtBRL(i.amount)}</div>
      </div>
    `;
    row.onclick = ()=>{
      const ok = confirm("Excluir este aporte?");
      if(!ok) return;
      DB.investments = DB.investments.filter(x=> x.id!==i.id);
      save();
      fillMonths();
      renderAll();
    };
    invList.appendChild(row);
  });

  renderInvestChart();
}

function renderGoals(){
  goalsList.innerHTML = "";

  if(DB.goals.length===0){
    goalsList.innerHTML = `<div class="row"><div style="flex:1"><div class="title">Sem metas</div><div class="sub">Toque em “Adicionar”</div></div></div>`;
    return;
  }

  DB.goals.forEach(g=>{
    const pct = Math.min(100, Math.round((Number(g.current||0)/Number(g.target||1))*100));
    const el = document.createElement("div");
    el.className = "goal";
    el.innerHTML = `
      <div class="goalname">${esc(g.name)}</div>
      <div class="goalmeta">${fmtBRL(g.current)} de ${fmtBRL(g.target)}</div>
      <div class="goalrow"><span style="color:var(--muted)">Progresso</span><b>${pct}%</b></div>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div style="display:flex; gap:10px; margin-top:12px;">
        <button class="catbtn" data-act="edit">Editar</button>
        <button class="catbtn" data-act="del">Excluir</button>
      </div>
    `;

    el.querySelector('[data-act="edit"]').onclick = ()=>{
      const cur = prompt("Valor atual (R$):", String(g.current||0));
      if(cur===null) return;
      const tgt = prompt("Meta total (R$):", String(g.target||0));
      if(tgt===null) return;

      const ncur = Number(String(cur).replace(",","."));
      const ntgt = Number(String(tgt).replace(",","."));
      if(Number.isNaN(ncur) || Number.isNaN(ntgt) || ntgt<=0 || ncur<0){
        alert("Valores inválidos.");
        return;
      }
      g.current = ncur;
      g.target = ntgt;
      save();
      renderAll();
    };

    el.querySelector('[data-act="del"]').onclick = ()=>{
      const ok = confirm(`Excluir "${g.name}"?`);
      if(!ok) return;
      DB.goals = DB.goals.filter(x=> x.id!==g.id);
      // desvincula transações dessa meta
      DB.transactions = DB.transactions.map(t=> t.goalId===g.id ? ({...t, goalId:""}) : t);
      save();
      renderAll();
    };

    goalsList.appendChild(el);
  });
}

/* When saving TX, update goals if linked (simple: expense reduces, income increases) */
function applyGoalLink(tx){
  if(!tx.goalId) return;
  const g = DB.goals.find(x=> x.id===tx.goalId);
  if(!g) return;
  const v = Number(tx.amount||0);
  if(tx.type==="income") g.current += v;
  else g.current = Math.max(0, g.current - v);
}

/* Override save tx to update goal too */
const originalSaveTx = document.getElementById("btnSaveTx").onclick;
document.getElementById("btnSaveTx").onclick = ()=>{
  const type = txType.value;
  const date = txDate.value || todayISO();
  const desc = (txDesc.value||"").trim() || (type==="income" ? "Entrada" : "Saída");
  const categoryId = txCategory.value || DB.categories[0]?.id;
  const amount = Number(txAmount.value||0);
  const goalId = txGoal.value || "";

  if(!(amount>0)){ alert("Coloque um valor maior que 0."); return; }

  const tx = { id: uid(), type, date, desc, categoryId, amount, goalId };
  DB.transactions.unshift(tx);
  applyGoalLink(tx);

  save();
  closeModal(modalTx);
  fillMonths();
  renderAll();
};

/* Main render */
function renderHome(){
  renderTop();
  renderRecent();
  renderGoalsPreview();
  renderCharts();
}
function renderAll(){
  renderHome();
  renderTransactions();
  renderCategories();
  renderInvestments();
  renderGoals();
}

/* Init */
function init(){
  fillMonths();

  // segmented state
  document.querySelectorAll(".segbtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.range===DB.ui.range);
  });

  filterType.value = "all";
  renderAll();

  window.addEventListener("resize", ()=>{
    renderCharts();
    renderInvestChart();
  });
}

init();