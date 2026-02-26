/* Financeiro Matheus e Thaís - Local Only (iPhone) */
const STORE_KEY = "fmth_data_v7";

const money = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
};
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const todayISO = () => new Date().toISOString().slice(0,10);
const monthKey = (isoDate) => (isoDate || todayISO()).slice(0,7); // YYYY-MM

const DEFAULT_CATEGORIES = {
  expense: [
    { id: "exp_fixos", name: "Gastos Fixos", icon:"🛒", budget: 1200 },
    { id: "exp_saude", name: "Saúde", icon:"🩺", budget: 350 },
    { id: "exp_lazer", name: "Lazer", icon:"🎮", budget: 300 },
    { id: "exp_loc", name: "Locomoção", icon:"🚗", budget: 250 },
    { id: "exp_alim", name: "Alimentação", icon:"🍽️", budget: 600 },
    { id: "exp_contas", name: "Contas", icon:"🧾", budget: 500 },
    { id: "exp_outros", name: "Outros", icon:"📦", budget: 200 }
  ],
  income: [
    { id: "inc_sal", name: "Salário", icon:"💼" },
    { id: "inc_extra", name: "Extra", icon:"✨" },
    { id: "inc_outros", name: "Outros", icon:"📥" }
  ],
  investment: [
    { id: "inv_rf", name: "Renda Fixa", icon:"📈" },
    { id: "inv_rv", name: "Renda Variável", icon:"🧠" },
    { id: "inv_crypto", name: "Cripto", icon:"🪙" },
    { id: "inv_outros", name: "Outros", icon:"💎" }
  ],
  box: [
    { id: "box_reserva", name: "Reserva", icon:"🧰", target: 5000, saved: 0 },
    { id: "box_viagem", name: "Viagem", icon:"✈️", target: 3000, saved: 0 }
  ]
};

const DEFAULT_STATE = {
  categories: DEFAULT_CATEGORIES,
  txs: [],
  goals: [
    { id: "goal_iphone", type:"goal", name:"Meta: Emergência", target: 10000, saved: 0, icon:"🎯" }
  ]
};

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return structuredClone(DEFAULT_STATE);
    const st = JSON.parse(raw);
    // merge defensivo:
    st.categories ||= structuredClone(DEFAULT_CATEGORIES);
    st.txs ||= [];
    st.goals ||= [];
    // garantir arrays
    ["expense","income","investment","box"].forEach(k=>{
      st.categories[k] ||= structuredClone(DEFAULT_CATEGORIES[k]);
    });
    return st;
  }catch(e){
    return structuredClone(DEFAULT_STATE);
  }
}
function saveState(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

let state = loadState();

// -------- NAV --------
const views = {
  home: document.getElementById("view-home"),
  add: document.getElementById("view-add"),
  categories: document.getElementById("view-categories"),
  invest: document.getElementById("view-invest"),
  goals: document.getElementById("view-goals"),
  more: document.getElementById("view-more"),
};

function go(view){
  Object.values(views).forEach(v=>v.classList.remove("active"));
  views[view].classList.add("active");

  document.querySelectorAll(".navBtn").forEach(b=>b.classList.remove("active"));
  const btn = document.querySelector(`.navBtn[data-go="${view}"]`);
  if(btn) btn.classList.add("active");

  if(view === "home") renderHome();
  if(view === "categories") renderCategories();
  if(view === "invest") renderInvest();
  if(view === "goals") renderGoals();
}

document.querySelectorAll(".navBtn").forEach(btn=>{
  btn.addEventListener("click", ()=>go(btn.dataset.go));
});

document.getElementById("btnMoreTop").addEventListener("click", ()=>go("more"));
document.getElementById("btnBackup").addEventListener("click", ()=>go("more"));
document.getElementById("btnAddFromHome").addEventListener("click", ()=>{
  setTxType("expense");
  go("add");
});

// -------- ADD FORM --------
const txAmount = document.getElementById("txAmount");
const txDate = document.getElementById("txDate");
const txCategory = document.getElementById("txCategory");
const txNote = document.getElementById("txNote");
const badgeType = document.getElementById("badgeType");

let currentType = "expense";

function setTxType(t){
  currentType = t;
  badgeType.textContent =
    t === "income" ? "Entrada" :
    t === "expense" ? "Saída" :
    t === "investment" ? "Invest." : "Caixinha";

  document.querySelectorAll(".typeBtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.type === t);
  });

  fillCategorySelect();
}

document.querySelectorAll(".typeBtn").forEach(b=>{
  b.addEventListener("click", ()=>setTxType(b.dataset.type));
});

function fillCategorySelect(){
  txCategory.innerHTML = "";
  const arr = state.categories[currentType] || [];
  arr.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.icon || "•"} ${c.name}`;
    txCategory.appendChild(opt);
  });
}

document.getElementById("btnCancelTx").addEventListener("click", ()=>go("home"));

document.getElementById("btnSaveTx").addEventListener("click", ()=>{
  const val = parseBRL(txAmount.value);
  if(!val || val <= 0){
    alert("Coloque um valor válido.");
    return;
  }
  const date = txDate.value || todayISO();
  const catId = txCategory.value;
  const note = (txNote.value || "").trim();

  const tx = { id: uid(), type: currentType, amount: val, date, catId, note };
  state.txs.unshift(tx);

  // se for caixinha: soma no saved da caixinha escolhida
  if(currentType === "box"){
    const bx = state.categories.box.find(b=>b.id===catId);
    if(bx){ bx.saved = Number(bx.saved||0) + val; }
  }

  saveState();
  resetAddForm();
  go("home");
});

function resetAddForm(){
  txAmount.value = "";
  txDate.value = todayISO();
  txNote.value = "";
}

// parse pt-BR
function parseBRL(s){
  if(!s) return 0;
  const t = String(s).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"");
  return Number(t || 0);
}

// -------- MONTH SELECT --------
const monthBadge = document.getElementById("monthBadge");
const selectMonth = document.getElementById("selectMonth");

function buildMonths(){
  const months = new Set(state.txs.map(t=>monthKey(t.date)));
  months.add(monthKey(todayISO()));
  const arr = Array.from(months).sort().reverse(); // newest first

  selectMonth.innerHTML = "";
  arr.forEach(m=>{
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = formatMonth(m);
    selectMonth.appendChild(opt);
  });
  selectMonth.value = arr[0];
  monthBadge.textContent = formatMonth(arr[0]);
}
selectMonth.addEventListener("change", ()=>{
  monthBadge.textContent = formatMonth(selectMonth.value);
  renderHome();
});

function formatMonth(m){
  const [y,mo] = m.split("-");
  const pt = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${pt[Number(mo)-1]} ${y}`;
}

// -------- CALCS --------
function txsByMonth(m){
  return state.txs.filter(t=>monthKey(t.date)===m);
}

function sumByType(list, type){
  return list.filter(t=>t.type===type).reduce((a,t)=>a+Number(t.amount||0),0);
}

function catById(type, id){
  return (state.categories[type]||[]).find(c=>c.id===id);
}

function totalBoxes(){
  return (state.categories.box||[]).reduce((a,b)=>a+Number(b.saved||0),0);
}

// -------- CHARTS --------
let chartExpenses, chartBalance, chartInvest;

function ensureCharts(){
  // Expenses (doughnut)
  const ctxE = document.getElementById("chartExpenses");
  const ctxB = document.getElementById("chartBalance");
  const ctxI = document.getElementById("chartInvest");

  if(ctxE && !chartExpenses){
    chartExpenses = new Chart(ctxE, {
      type: "doughnut",
      data: { labels: [], datasets: [{ data: [] }] },
      options: {
        responsive: true,
        plugins:{
          legend:{ position:"bottom", labels:{ color:"rgba(234,240,255,.75)", font:{ weight:"700" } } }
        },
        cutout: "65%"
      }
    });
  }

  if(ctxB && !chartBalance){
    chartBalance = new Chart(ctxB, {
      type: "line",
      data: { labels: [], datasets: [{ label:"Saldo", data: [], tension:.35, fill:false }] },
      options: {
        responsive:true,
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ ticks:{ color:"rgba(234,240,255,.65)", font:{ weight:"700" } }, grid:{ color:"rgba(255,255,255,.06)" } },
          y:{ ticks:{ color:"rgba(234,240,255,.65)", font:{ weight:"700" } }, grid:{ color:"rgba(255,255,255,.06)" } }
        }
      }
    });
  }

  if(ctxI && !chartInvest){
    chartInvest = new Chart(ctxI, {
      type: "bar",
      data: { labels: [], datasets: [{ label:"Aportes", data: [] }] },
      options: {
        responsive:true,
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ ticks:{ color:"rgba(234,240,255,.65)", font:{ weight:"700" } }, grid:{ color:"rgba(255,255,255,.06)" } },
          y:{ ticks:{ color:"rgba(234,240,255,.65)", font:{ weight:"700" } }, grid:{ color:"rgba(255,255,255,.06)" } }
        }
      }
    });
  }
}

function updateCharts(m){
  ensureCharts();
  const list = txsByMonth(m);

  // Expenses by category
  const expenseMap = new Map();
  list.filter(t=>t.type==="expense").forEach(t=>{
    const c = catById("expense", t.catId);
    const name = c ? c.name : "Outros";
    expenseMap.set(name, (expenseMap.get(name)||0) + Number(t.amount||0));
  });
  const eLabels = Array.from(expenseMap.keys());
  const eData = Array.from(expenseMap.values());

  chartExpenses.data.labels = eLabels.length ? eLabels : ["—"];
  chartExpenses.data.datasets[0].data = eData.length ? eData : [1];
  chartExpenses.update();

  // Balance across month (simple day points)
  const days = Array.from({length:31}, (_,i)=>String(i+1).padStart(2,"0"));
  let running = 0;
  const daily = {};
  list.forEach(t=>{
    const d = t.date.slice(8,10);
    const sign = (t.type==="expense") ? -1 : (t.type==="income" ? 1 : 0);
    if(t.type==="box") return; // caixinha não é gasto/receita (só reserva)
    if(t.type==="investment") return; // investimento separado do saldo do mês (se quiser contar, me fala)
    daily[d] = (daily[d]||0) + sign*Number(t.amount||0);
  });
  const points = [];
  days.forEach(d=>{
    running += (daily[d]||0);
    points.push(running);
  });

  chartBalance.data.labels = days;
  chartBalance.data.datasets[0].data = points;
  chartBalance.update();
}

// -------- HOME RENDER --------
const balanceValue = document.getElementById("balanceValue");
const sumIncomeEl = document.getElementById("sumIncome");
const sumExpenseEl = document.getElementById("sumExpense");
const sumInvestEl = document.getElementById("sumInvest");
const sumBoxesEl = document.getElementById("sumBoxes");
const recentList = document.getElementById("recentList");

document.getElementById("pillIncome").addEventListener("click", ()=>{
  setTxType("income"); go("add");
});
document.getElementById("pillExpense").addEventListener("click", ()=>{
  setTxType("expense"); go("add");
});

function renderHome(){
  buildMonths();
  const m = selectMonth.value;

  const list = txsByMonth(m);
  const inc = sumByType(list, "income");
  const exp = sumByType(list, "expense");
  const inv = sumByType(list, "investment");
  const boxes = totalBoxes();
  const balance = inc - exp; // saldo do mês

  balanceValue.textContent = money(balance);
  sumIncomeEl.textContent = money(inc);
  sumExpenseEl.textContent = money(exp);
  sumInvestEl.textContent = money(inv);
  sumBoxesEl.textContent = money(boxes);

  renderRecent(m);
  updateCharts(m);
}

function renderRecent(m){
  const list = txsByMonth(m).filter(t=>t.type==="expense").slice(0,8);
  recentList.innerHTML = "";

  const totalsByCat = new Map();
  txsByMonth(m).filter(t=>t.type==="expense").forEach(t=>{
    totalsByCat.set(t.catId, (totalsByCat.get(t.catId)||0) + Number(t.amount||0));
  });

  list.forEach(tx=>{
    const c = catById("expense", tx.catId) || { name:"Outros", icon:"📦", budget:0 };
    const catTotal = totalsByCat.get(tx.catId) || 0;
    const budget = Number(c.budget||0);
    const pct = budget > 0 ? Math.min(100, Math.round((catTotal/budget)*100)) : 0;

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="itemIcon">${c.icon || "🛒"}</div>
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(tx.note || c.name)}</div>
        <div class="itemSub">${c.name} • ${tx.date.split("-").reverse().join("/")}</div>
        <div class="barWrap"><div class="barFill" style="width:${pct}%;"></div></div>
      </div>
      <div class="itemRight">
        <div class="itemValue">${money(tx.amount)}</div>
        <div class="itemMeta">${budget>0 ? `${pct}%` : ""}</div>
      </div>
    `;

    // editar/apagar
    el.addEventListener("click", ()=>editTx(tx.id));
    recentList.appendChild(el);
  });

  if(list.length === 0){
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Nenhuma saída neste mês. Clique em “Adicionar”.";
    recentList.appendChild(empty);
  }
}

function editTx(id){
  const tx = state.txs.find(t=>t.id===id);
  if(!tx) return;

  const action = prompt("Digite:\n1 = editar valor/descrição\n2 = apagar\n(qualquer outra coisa cancela)");
  if(action === "2"){
    if(confirm("Tem certeza que quer apagar?")){
      state.txs = state.txs.filter(t=>t.id!==id);
      saveState();
      renderHome();
    }
    return;
  }
  if(action !== "1") return;

  const newVal = parseBRL(prompt("Novo valor (R$):", String(tx.amount).replace(".",",")));
  if(!newVal || newVal<=0){ alert("Valor inválido."); return; }
  const newNote = prompt("Nova descrição:", tx.note||"") || tx.note || "";
  tx.amount = newVal;
  tx.note = newNote.trim();

  saveState();
  renderHome();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

// -------- CATEGORIES --------
const catList = document.getElementById("catList");
let catFilter = "expense";

document.querySelectorAll(".segBtn[data-catfilter]").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".segBtn[data-catfilter]").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    catFilter = b.dataset.catfilter;
    renderCategories();
  });
});

document.getElementById("btnAddCategory").addEventListener("click", ()=>{
  const name = prompt("Nome da categoria:");
  if(!name) return;
  const icon = prompt("Ícone (emoji):", "🧩") || "🧩";
  const budget = (catFilter==="expense") ? parseBRL(prompt("Orçamento mensal (R$) (opcional):", "0")) : 0;

  state.categories[catFilter].push({
    id: uid(),
    name: name.trim(),
    icon,
    budget: budget || 0
  });
  saveState();
  renderCategories();
});

function renderCategories(){
  const m = selectMonth.value || monthKey(todayISO());
  const monthTx = txsByMonth(m);

  catList.innerHTML = "";
  const arr = state.categories[catFilter] || [];

  const spendByCat = new Map();
  monthTx.filter(t=>t.type===catFilter).forEach(t=>{
    spendByCat.set(t.catId, (spendByCat.get(t.catId)||0) + Number(t.amount||0));
  });

  arr.forEach(c=>{
    const used = spendByCat.get(c.id) || 0;
    const budget = Number(c.budget||0);
    const pct = budget > 0 ? Math.min(100, Math.round((used/budget)*100)) : 0;

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="itemIcon">${c.icon || "•"}</div>
      <div class="itemMain">
        <div class="itemTitle">${c.name}</div>
        <div class="itemSub">${
          catFilter==="expense" && budget>0
            ? `Orçamento ${money(budget)} • Usado ${money(used)}`
            : (catFilter==="box" ? `Guardado ${money(c.saved||0)} • Meta ${money(c.target||0)}` : `Total no mês ${money(used)}`)
        }</div>

        ${
          (catFilter==="expense" && budget>0)
            ? `<div class="barWrap"><div class="barFill" style="width:${pct}%;"></div></div>`
            : (catFilter==="box" && Number(c.target||0)>0)
              ? `<div class="barWrap"><div class="barFill" style="width:${Math.min(100, Math.round((Number(c.saved||0)/Number(c.target||0))*100))}%; background:linear-gradient(90deg, rgba(60,244,193,.85), rgba(106,168,255,.7));"></div></div>`
              : ``
        }
      </div>
      <div class="itemRight">
        <div class="itemValue">${
          catFilter==="expense" ? (budget>0 ? `${pct}%` : "")
          : ""
        }</div>
        <div class="itemMeta">Toque p/ editar</div>
      </div>
    `;

    el.addEventListener("click", ()=>{
      if(confirm("Editar esta categoria? (OK) / Apagar? (Cancelar)")){
        const newName = prompt("Nome:", c.name) || c.name;
        const newIcon = prompt("Ícone:", c.icon || "•") || c.icon;
        c.name = newName.trim();
        c.icon = newIcon;

        if(catFilter==="expense"){
          const newBudget = parseBRL(prompt("Orçamento mensal (R$):", String(c.budget||0).replace(".",",")));
          c.budget = newBudget || 0;
        }
        if(catFilter==="box"){
          const newTarget = parseBRL(prompt("Meta (R$):", String(c.target||0).replace(".",",")));
          c.target = newTarget || 0;
        }

        saveState();
        renderCategories();
        fillCategorySelect();
      }else{
        if(confirm("Apagar mesmo?")){
          state.categories[catFilter] = state.categories[catFilter].filter(x=>x.id!==c.id);
          // remove txs daquela categoria
          state.txs = state.txs.filter(t=>t.catId!==c.id);
          saveState();
          renderCategories();
          renderHome();
          fillCategorySelect();
        }
      }
    });

    catList.appendChild(el);
  });

  if(arr.length === 0){
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Sem categorias aqui. Clique em “Nova”.";
    catList.appendChild(empty);
  }
}

// -------- INVEST --------
const investTotalEl = document.getElementById("investTotal");
const investMonthEl = document.getElementById("investMonth");
const investList = document.getElementById("investList");

document.getElementById("btnAddInvest").addEventListener("click", ()=>{
  setTxType("investment"); go("add");
});

function renderInvest(){
  buildMonths();
  const m = selectMonth.value;

  const monthTx = txsByMonth(m).filter(t=>t.type==="investment");
  const allInv = state.txs.filter(t=>t.type==="investment");

  const total = allInv.reduce((a,t)=>a+Number(t.amount||0),0);
  const monthSum = monthTx.reduce((a,t)=>a+Number(t.amount||0),0);

  investTotalEl.textContent = money(total);
  investMonthEl.textContent = money(monthSum);

  // chart invest by category
  ensureCharts();
  const map = new Map();
  monthTx.forEach(t=>{
    const c = catById("investment", t.catId) || { name:"Outros" };
    map.set(c.name, (map.get(c.name)||0) + Number(t.amount||0));
  });
  const labels = Array.from(map.keys());
  const data = Array.from(map.values());
  chartInvest.data.labels = labels.length?labels:["—"];
  chartInvest.data.datasets[0].data = data.length?data:[1];
  chartInvest.update();

  investList.innerHTML = "";
  monthTx.slice(0,10).forEach(tx=>{
    const c = catById("investment", tx.catId) || { name:"Outros", icon:"📈" };
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="itemIcon">${c.icon || "📈"}</div>
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(tx.note || c.name)}</div>
        <div class="itemSub">${c.name} • ${tx.date.split("-").reverse().join("/")}</div>
      </div>
      <div class="itemRight">
        <div class="itemValue">${money(tx.amount)}</div>
        <div class="itemMeta">toque p/ editar</div>
      </div>
    `;
    el.addEventListener("click", ()=>editTx(tx.id));
    investList.appendChild(el);
  });

  if(monthTx.length===0){
    const empty = document.createElement("div");
    empty.className="hint";
    empty.textContent="Sem aportes neste mês.";
    investList.appendChild(empty);
  }
}

// -------- GOALS / BOXES --------
const goalList = document.getElementById("goalList");
let goalFilter = "all";

document.querySelectorAll(".segBtn[data-goalfilter]").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".segBtn[data-goalfilter]").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    goalFilter = b.dataset.goalfilter;
    renderGoals();
  });
});

document.getElementById("btnAddGoal").addEventListener("click", ()=>{
  const type = prompt("Digite:\n1 = Meta\n2 = Caixinha");
  const isBox = (type==="2");
  const name = prompt(isBox ? "Nome da caixinha:" : "Nome da meta:");
  if(!name) return;
  const icon = prompt("Ícone (emoji):", isBox ? "🧰" : "🎯") || (isBox ? "🧰" : "🎯");
  const target = parseBRL(prompt("Valor alvo (R$):", "1000"));
  if(!target || target<=0){ alert("Valor alvo inválido."); return; }

  if(isBox){
    state.categories.box.push({ id: uid(), name:name.trim(), icon, target, saved:0 });
  }else{
    state.goals.push({ id: uid(), type:"goal", name:name.trim(), icon, target, saved:0 });
  }
  saveState();
  renderGoals();
  renderHome();
  fillCategorySelect();
});

function renderGoals(){
  goalList.innerHTML = "";

  const boxes = (state.categories.box||[]).map(b=>({
    id:b.id, type:"box", name:b.name, icon:b.icon, target:b.target||0, saved:b.saved||0
  }));
  const goals = (state.goals||[]).map(g=>({
    id:g.id, type:"goal", name:g.name, icon:g.icon, target:g.target||0, saved:g.saved||0
  }));

  let all = [...boxes, ...goals];
  if(goalFilter !== "all") all = all.filter(x=>x.type===goalFilter);

  all.forEach(g=>{
    const pct = g.target>0 ? Math.min(100, Math.round((g.saved/g.target)*100)) : 0;

    const el = document.createElement("div");
    el.className="item";
    el.innerHTML = `
      <div class="itemIcon">${g.icon || (g.type==="box"?"🧰":"🎯")}</div>
      <div class="itemMain">
        <div class="itemTitle">${g.name}</div>
        <div class="itemSub">${money(g.saved)} de ${money(g.target)}</div>
        <div class="barWrap"><div class="barFill" style="width:${pct}%; background:linear-gradient(90deg, rgba(60,244,193,.85), rgba(176,124,255,.70));"></div></div>
      </div>
      <div class="itemRight">
        <div class="itemValue">${pct}%</div>
        <div class="itemMeta">toque p/ ações</div>
      </div>
    `;

    el.addEventListener("click", ()=>{
      const act = prompt("Digite:\n1 = adicionar valor\n2 = editar\n3 = apagar");
      if(act==="1"){
        const val = parseBRL(prompt("Quanto adicionar (R$)?", "0"));
        if(!val || val<=0) return;
        if(g.type==="box"){
          const bx = state.categories.box.find(x=>x.id===g.id);
          if(bx) bx.saved = Number(bx.saved||0) + val;
        }else{
          const gg = state.goals.find(x=>x.id===g.id);
          if(gg) gg.saved = Number(gg.saved||0) + val;
        }
        saveState();
        renderGoals();
        renderHome();
        return;
      }
      if(act==="2"){
        const newName = prompt("Nome:", g.name) || g.name;
        const newIcon = prompt("Ícone:", g.icon) || g.icon;
        const newTarget = parseBRL(prompt("Alvo (R$):", String(g.target).replace(".",","))) || g.target;

        if(g.type==="box"){
          const bx = state.categories.box.find(x=>x.id===g.id);
          if(bx){ bx.name=newName.trim(); bx.icon=newIcon; bx.target=newTarget; }
        }else{
          const gg = state.goals.find(x=>x.id===g.id);
          if(gg){ gg.name=newName.trim(); gg.icon=newIcon; gg.target=newTarget; }
        }
        saveState();
        renderGoals();
        renderHome();
        return;
      }
      if(act==="3"){
        if(!confirm("Apagar mesmo?")) return;
        if(g.type==="box"){
          state.categories.box = state.categories.box.filter(x=>x.id!==g.id);
          state.txs = state.txs.filter(t=>t.catId!==g.id);
        }else{
          state.goals = state.goals.filter(x=>x.id!==g.id);
        }
        saveState();
        renderGoals();
        renderHome();
        fillCategorySelect();
      }
    });

    goalList.appendChild(el);
  });

  if(all.length===0){
    const empty=document.createElement("div");
    empty.className="hint";
    empty.textContent="Sem metas/caixinhas. Clique em “Criar”.";
    goalList.appendChild(empty);
  }
}

// -------- MORE / BACKUP --------
document.getElementById("btnExport").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "financeiro-matheus-thais-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

const fileImport = document.getElementById("fileImport");
document.getElementById("btnImport").addEventListener("click", ()=>fileImport.click());
fileImport.addEventListener("change", async ()=>{
  const f = fileImport.files?.[0];
  if(!f) return;
  const txt = await f.text();
  try{
    const obj = JSON.parse(txt);
    state = obj;
    saveState();
    alert("Importado com sucesso!");
    go("home");
  }catch(e){
    alert("Arquivo inválido.");
  }finally{
    fileImport.value = "";
  }
});

document.getElementById("btnReset").addEventListener("click", ()=>{
  if(!confirm("Vai zerar tudo. Tem certeza?")) return;
  state = structuredClone(DEFAULT_STATE);
  saveState();
  go("home");
});

// -------- INIT --------
(function init(){
  txDate.value = todayISO();
  fillCategorySelect();
  buildMonths();
  renderHome();
})();