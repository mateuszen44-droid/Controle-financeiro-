/* ========= DADOS (salva só no iPhone) ========= */
const KEY = "fmth_v2";

const CATS = [
  { id:"fixos", label:"Gastos Fixos", sub:"Gastos Fixos", emoji:"🛒", grad:["rgba(255,168,92,.24)","rgba(255,121,87,.18)"] },
  { id:"invest", label:"Investimentos", sub:"Investimentos", emoji:"🧬", grad:["rgba(110,240,196,.22)","rgba(91,132,255,.18)"] },
  { id:"saude", label:"Saúde", sub:"Saúde", emoji:"🍴", grad:["rgba(168,108,255,.26)","rgba(91,132,255,.16)"] },
  { id:"lazer", label:"Lazer", sub:"Lazer", emoji:"🎮", grad:["rgba(91,132,255,.30)","rgba(168,108,255,.18)"] },
  { id:"transporte", label:"Locomoção", sub:"Locomoção", emoji:"🚗", grad:["rgba(255,168,92,.20)","rgba(110,240,196,.14)"] },
  { id:"outros", label:"Outros", sub:"Outros", emoji:"💳", grad:["rgba(255,255,255,.12)","rgba(255,255,255,.06)"] },
];

const defaultState = {
  tx: [], // {id, type:'entrada'|'saida', catId, desc, cents, dateISO}
  budgets: { fixos:0, invest:0, saude:0, lazer:0, transporte:0, outros:0 },
  ui: { range:"month" }
};

let state = load();

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  }catch{
    return structuredClone(defaultState);
  }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }

/* ========= UTIL ========= */
const brl = (cents) => ((cents||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const pad2 = (n)=> String(n).padStart(2,"0");
const todayISO = ()=>{
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
};
const monthKey = (iso)=> iso.slice(0,7); // YYYY-MM
const monthLabel = (k)=> {
  const [y,m] = k.split("-");
  return `${m}/${y}`;
};
function toCents(str){
  if(!str) return 0;
  const s = String(str).trim().replace(/\./g,"").replace(",",".");
  const num = Number(s);
  if(Number.isNaN(num)) return 0;
  return Math.round(num*100);
}
function uid(){
  return (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
}
function catById(id){ return CATS.find(c=>c.id===id) || CATS[CATS.length-1]; }

/* ========= DOM ========= */
const uiTotal = document.getElementById("uiTotal");
const uiIn = document.getElementById("uiIn");
const uiOut = document.getElementById("uiOut");
const recentList = document.getElementById("recentList");

const btnQuickIn = document.getElementById("btnQuickIn");
const btnQuickOut = document.getElementById("btnQuickOut");
const btnAddFromHome = document.getElementById("btnAddFromHome");
const btnAddBig = document.getElementById("btnAddBig");
const btnAddFromTx = document.getElementById("btnAddFromTx");

const navItems = Array.from(document.querySelectorAll(".navItem"));
const screens = {
  home: document.getElementById("screen-home"),
  transactions: document.getElementById("screen-transactions"),
  budget: document.getElementById("screen-budget"),
  more: document.getElementById("screen-more"),
};

const filterType = document.getElementById("filterType");
const filterMonth = document.getElementById("filterMonth");
const txList = document.getElementById("txList");

const uiSpentMonth = document.getElementById("uiSpentMonth");
const uiBudgetTotal = document.getElementById("uiBudgetTotal");
const budgetList = document.getElementById("budgetList");
const btnGoBudget = document.getElementById("btnGoBudget");

/* Modal TX */
const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const btnClose = document.getElementById("btnClose");
const modalTitle = document.getElementById("modalTitle");
const txForm = document.getElementById("txForm");
const editId = document.getElementById("editId");
const selCategory = document.getElementById("category");
const inpDesc = document.getElementById("desc");
const inpAmount = document.getElementById("amount");
const inpDate = document.getElementById("date");
const btnDelete = document.getElementById("btnDelete");

const chipBtns = Array.from(document.querySelectorAll(".chip"));
let currentType = "entrada";

/* Budget modal */
const btnBudgetEdit = document.getElementById("btnBudgetEdit");
const budgetModal = document.getElementById("budgetModal");
const budgetBackdrop = document.getElementById("budgetBackdrop");
const btnBudgetClose = document.getElementById("btnBudgetClose");
const budgetForm = document.getElementById("budgetForm");
const budgetInputs = document.getElementById("budgetInputs");

/* More */
const btnReset = document.getElementById("btnReset");
const btnExport = document.getElementById("btnExport");
const importFile = document.getElementById("importFile");
const btnDemo = document.getElementById("btnDemo");
const btnAbout = document.getElementById("btnAbout");
const aboutBox = document.getElementById("aboutBox");

/* Range segmented */
const segBtns = Array.from(document.querySelectorAll(".segBtn"));

/* ========= CATEGORIAS NO SELECT ========= */
function fillCategorySelect(){
  selCategory.innerHTML = CATS.map(c=>`<option value="${c.id}">${c.label}</option>`).join("");
}

/* ========= NAVEGAÇÃO ========= */
function go(screen){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  screens[screen].classList.add("active");

  navItems.forEach(b=>b.classList.toggle("active", b.dataset.target===screen));

  // render conforme tela
  if(screen==="transactions") renderTransactions();
  if(screen==="budget") renderBudget();
}
navItems.forEach(b=>{
  b.addEventListener("click", ()=> go(b.dataset.target));
});
btnGoBudget.addEventListener("click", ()=> go("budget"));

/* ========= MODAL TX ========= */
function openModal({type="entrada", tx=null}={}){
  currentType = type;
  chipBtns.forEach(x=> x.classList.toggle("active", x.dataset.type===type));

  if(tx){
    modalTitle.textContent = "Editar transação";
    editId.value = tx.id;
    selCategory.value = tx.catId;
    inpDesc.value = tx.desc || "";
    inpAmount.value = ((tx.cents||0)/100).toFixed(2).replace(".",",");
    inpDate.value = tx.dateISO;
    btnDelete.hidden = false;
  }else{
    modalTitle.textContent = "Nova transação";
    editId.value = "";
    selCategory.value = "fixos";
    inpDesc.value = "";
    inpAmount.value = "";
    inpDate.value = todayISO();
    btnDelete.hidden = true;
  }

  modal.hidden = false;
  modalBackdrop.hidden = false;
  setTimeout(()=> inpAmount.focus(), 80);
}
function closeModal(){
  modal.hidden = true;
  modalBackdrop.hidden = true;
}
btnClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);

btnQuickIn.addEventListener("click", ()=> openModal({type:"entrada"}));
btnQuickOut.addEventListener("click", ()=> openModal({type:"saida"}));
btnAddFromHome.addEventListener("click", ()=> openModal({type:"saida"}));
btnAddBig.addEventListener("click", ()=> openModal({type:"saida"}));
btnAddFromTx.addEventListener("click", ()=> openModal({type:"saida"}));

chipBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    chipBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
  });
});

txForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const cents = toCents(inpAmount.value);
  if(!cents || cents<=0) return alert("Coloque um valor maior que zero.");

  const tx = {
    id: editId.value || uid(),
    type: currentType,
    catId: selCategory.value,
    desc: inpDesc.value.trim(),
    cents,
    dateISO: inpDate.value || todayISO()
  };

  if(editId.value){
    const i = state.tx.findIndex(t=>t.id===editId.value);
    if(i>=0) state.tx[i] = tx;
  }else{
    state.tx.push(tx);
  }

  save();
  closeModal();
  renderAll();
});

btnDelete.addEventListener("click", ()=>{
  const id = editId.value;
  if(!id) return;
  if(!confirm("Excluir esta transação?")) return;
  state.tx = state.tx.filter(t=>t.id!==id);
  save();
  closeModal();
  renderAll();
});

/* ========= FILTROS TRANSAÇÕES ========= */
function buildMonthFilter(){
  const months = Array.from(new Set(state.tx.map(t=>monthKey(t.dateISO)))).sort().reverse();
  const now = monthKey(todayISO());
  const options = ["all", now, ...months.filter(m=>m!==now)];
  filterMonth.innerHTML = options.map(m=>{
    const label = (m==="all") ? "Todos os meses" : monthLabel(m);
    return `<option value="${m}">${label}</option>`;
  }).join("");
}
filterType.addEventListener("change", renderTransactions);
filterMonth.addEventListener("change", renderTransactions);

/* ========= CÁLCULOS ========= */
function totals(){
  const inC = state.tx.filter(t=>t.type==="entrada").reduce((a,t)=>a+t.cents,0);
  const outC = state.tx.filter(t=>t.type==="saida").reduce((a,t)=>a+t.cents,0);
  return { inC, outC, total: inC - outC };
}

function monthSpent(yyyyMM){
  return state.tx
    .filter(t=>t.type==="saida" && monthKey(t.dateISO)===yyyyMM)
    .reduce((a,t)=>a+t.cents,0);
}

function monthCatSpent(yyyyMM){
  const map = {};
  for(const c of CATS) map[c.id]=0;
  for(const t of state.tx){
    if(t.type!=="saida") continue;
    if(monthKey(t.dateISO)!==yyyyMM) continue;
    map[t.catId] = (map[t.catId]||0) + t.cents;
  }
  return map;
}

/* ========= RENDER HOME ========= */
function renderHome(){
  const { inC, outC, total } = totals();
  uiTotal.textContent = brl(total);
  uiIn.textContent = brl(inC);
  uiOut.textContent = brl(outC);

  // Recentes (últimos 4)
  const items = [...state.tx].sort((a,b)=> b.dateISO.localeCompare(a.dateISO)).slice(0,4);

  if(items.length===0){
    recentList.innerHTML = `
      <div class="item" style="opacity:.86;">
        <div class="badge" style="background:rgba(255,255,255,.06);"><div class="emoji">🧾</div></div>
        <div class="itemMain">
          <div class="itemTitle">Sem lançamentos</div>
          <div class="itemSub">Toque em “Adicionar Nova”</div>
        </div>
        <div class="itemRight">
          <div class="itemValue">R$ 0,00</div>
          <div class="bar"><div style="width:0%"></div></div>
        </div>
      </div>
    `;
    return;
  }

  const maxAbs = Math.max(...items.map(t=>t.cents), 1);

  recentList.innerHTML = items.map(t=>{
    const c = catById(t.catId);
    const pct = Math.min(100, Math.round((t.cents/maxAbs)*100));
    const sign = (t.type==="saida") ? "-" : "";
    const value = `${sign}${brl(t.cents)}`;
    return `
      <div class="item" onclick="window.__openEdit('${t.id}')">
        <div class="badge" style="background:linear-gradient(135deg, ${c.grad[0]}, ${c.grad[1]});">
          <div class="emoji">${c.emoji}</div>
        </div>
        <div class="itemMain">
          <div class="itemTitle">${t.desc || c.label}</div>
          <div class="itemSub">${c.sub}</div>
        </div>
        <div class="itemRight">
          <div class="itemValue">${value}</div>
          <div class="bar"><div style="width:${pct}%"></div></div>
        </div>
      </div>
    `;
  }).join("");
}

/* ========= RENDER TRANSAÇÕES ========= */
function renderTransactions(){
  buildMonthFilter();

  let items = [...state.tx].sort((a,b)=> b.dateISO.localeCompare(a.dateISO));

  const ft = filterType.value;
  const fm = filterMonth.value;

  if(ft!=="all") items = items.filter(t=>t.type===ft);
  if(fm!=="all") items = items.filter(t=>monthKey(t.dateISO)===fm);

  if(items.length===0){
    txList.innerHTML = `<div class="muted" style="padding:10px 2px;">Sem transações neste filtro.</div>`;
    return;
  }

  txList.innerHTML = items.map(t=>{
    const c = catById(t.catId);
    const sign = (t.type==="saida") ? "-" : "+";
    const amt = `${sign} ${brl(t.cents)}`;
    const color = (t.type==="saida") ? "rgba(255,107,107,.92)" : "rgba(103,242,200,.92)";
    return `
      <div class="txRow" onclick="window.__openEdit('${t.id}')">
        <div class="badge" style="width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg, ${c.grad[0]}, ${c.grad[1]});">
          <div class="emoji" style="font-size:20px;">${c.emoji}</div>
        </div>
        <div class="txMeta">
          <div class="txTitle">${t.desc || c.label}</div>
          <div class="txSub">${c.label} • ${t.dateISO.split("-").reverse().join("/")}</div>
        </div>
        <div class="txAmt" style="color:${color}">${amt}</div>
      </div>
    `;
  }).join("");
}

/* ========= ORÇAMENTO ========= */
function renderBudget(){
  const m = monthKey(todayISO());
  const spent = monthSpent(m);
  const totalBudget = Object.values(state.budgets).reduce((a,v)=>a+Math.round((v||0)*100),0); // budgets guardados em reais? vamos tratar como reais
  // Melhor: guardar budgets em CENTAVOS
}

/* ========= BUDGET (CENTAVOS) ========= */
function budgetsToCents(){
  // state.budgets guarda centavos
  const out = {};
  for(const c of CATS) out[c.id] = state.budgets[c.id] || 0;
  return out;
}
function budgetTotalCents(){
  const b = budgetsToCents();
  return Object.values(b).reduce((a,v)=>a+(v||0),0);
}

function renderBudgetReal(){
  const m = monthKey(todayISO());
  const spent = monthSpent(m);
  const bTotal = budgetTotalCents();

  uiSpentMonth.textContent = brl(spent);
  uiBudgetTotal.textContent = brl(bTotal);

  const perCat = monthCatSpent(m);
  const b = budgetsToCents();

  budgetList.innerHTML = CATS.map(c=>{
    const used = perCat[c.id] || 0;
    const limit = b[c.id] || 0;
    const pct = limit>0 ? Math.min(100, Math.round((used/limit)*100)) : (used>0 ? 100 : 0);
    return `
      <div class="budgetItem">
        <div class="budgetLine">
          <div class="budgetName">${c.label}</div>
          <div class="budgetNums">${brl(used)} / ${brl(limit)}</div>
        </div>
        <div class="progress"><div style="width:${pct}%"></div></div>
      </div>
    `;
  }).join("");

  updateDonut(perCat);
}

/* ========= Charts ========= */
let chartLine, chartDonut;

function ensureCharts(){
  if(typeof Chart==="undefined") return;

  // LINE (igual visual, mostra 4 linhas por categoria)
  const ctxL = document.getElementById("chartLine");
  if(ctxL && !chartLine){
    chartLine = new Chart(ctxL, {
      type:"line",
      data:{
        labels:["Jan","Fev","Mar","Abr","Mai"],
        datasets:[
          { label:"Gastos Fixos", data:[0,0,0,0,0], tension:.35, borderWidth:2, pointRadius:3 },
          { label:"Investimentos", data:[0,0,0,0,0], tension:.35, borderWidth:2, pointRadius:3 },
          { label:"Saúde", data:[0,0,0,0,0], tension:.35, borderWidth:2, pointRadius:3 },
          { label:"Lazer", data:[0,0,0,0,0], tension:.35, borderWidth:2, pointRadius:3 },
        ]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ ticks:{ color:"rgba(255,255,255,.55)" }, grid:{ color:"rgba(255,255,255,.06)" } },
          y:{ ticks:{ color:"rgba(255,255,255,.55)" }, grid:{ color:"rgba(255,255,255,.06)" } },
        }
      }
    });
  }

  // DONUT (Orçamento)
  const ctxD = document.getElementById("chartDonut");
  if(ctxD && !chartDonut){
    chartDonut = new Chart(ctxD, {
      type:"doughnut",
      data:{
        labels: CATS.map(c=>c.label),
        datasets:[{ data: CATS.map(()=>0), borderWidth:0 }]
      },
      options:{
        cutout:"70%",
        plugins:{
          legend:{ labels:{ color:"rgba(255,255,255,.65)" } }
        }
      }
    });
  }

  updateLineDemo();
}

function updateLineDemo(){
  if(!chartLine) return;

  // deixa bonito igual print: pega totais e espalha em pontos
  const m = monthKey(todayISO());
  const per = monthCatSpent(m);

  const a = per["fixos"]||0;
  const b = per["invest"]||0;
  const c = per["saude"]||0;
  const d = per["lazer"]||0;

  const spread = (v)=> [v*.15,v*.35,v*.55,v*.70,v*.85].map(x=>Math.round(x/100));

  chartLine.data.datasets[0].data = spread(a);
  chartLine.data.datasets[1].data = spread(b);
  chartLine.data.datasets[2].data = spread(c);
  chartLine.data.datasets[3].data = spread(d);

  chartLine.update();
}

function updateDonut(perCat){
  if(!chartDonut) return;
  const data = CATS.map(c=> Math.round((perCat[c.id]||0)/100)); // reais
  chartDonut.data.datasets[0].data = data;
  chartDonut.update();
}

/* ========= Range segmented ========= */
segBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    segBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    state.ui.range = btn.dataset.range;
    save();
    // visual (depois podemos fazer cálculo real por semana/ano)
    updateLineDemo();
  });
});

/* ========= BUDGET MODAL ========= */
function openBudgetModal(){
  budgetInputs.innerHTML = CATS.map(c=>{
    const v = (state.budgets[c.id]||0)/100;
    const vv = v.toFixed(2).replace(".",",");
    return `
      <div class="formRow">
        <label>${c.label}</label>
        <input data-bid="${c.id}" inputmode="decimal" placeholder="0,00" value="${vv}" />
      </div>
    `;
  }).join("");
  budgetModal.hidden = false;
  budgetBackdrop.hidden = false;
}
function closeBudgetModal(){
  budgetModal.hidden = true;
  budgetBackdrop.hidden = true;
}
btnBudgetEdit.addEventListener("click", openBudgetModal);
btnBudgetClose.addEventListener("click", closeBudgetModal);
budgetBackdrop.addEventListener("click", closeBudgetModal);

budgetForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const inputs = Array.from(budgetInputs.querySelectorAll("input[data-bid]"));
  for(const inp of inputs){
    const id = inp.getAttribute("data-bid");
    state.budgets[id] = toCents(inp.value);
  }
  save();
  closeBudgetModal();
  renderAll();
});

/* ========= MAIS ========= */
btnAbout.addEventListener("click", ()=>{ aboutBox.hidden = !aboutBox.hidden; });

btnReset.addEventListener("click", ()=>{
  if(!confirm("Zerar tudo?")) return;
  state = structuredClone(defaultState);
  save();
  renderAll();
});

btnExport.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "financeiro-matheus-thais-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async ()=>{
  const file = importFile.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const parsed = JSON.parse(text);
    state = { ...structuredClone(defaultState), ...parsed };
    save();
    renderAll();
    alert("Backup importado!");
  }catch{
    alert("Arquivo inválido.");
  }finally{
    importFile.value = "";
  }
});

btnDemo.addEventListener("click", ()=>{
  const d = todayISO();
  state.tx.push(
    {id:uid(), type:"entrada", catId:"invest", desc:"Salário", cents:820000, dateISO:d},
    {id:uid(), type:"saida", catId:"fixos", desc:"Supermercado", cents:32000, dateISO:d},
    {id:uid(), type:"saida", catId:"saude", desc:"Saúde", cents:5990, dateISO:d},
    {id:uid(), type:"saida", catId:"lazer", desc:"Jantar com Amigos", cents:4500, dateISO:d},
  );
  // limites default
  state.budgets.fixos = 120000;
  state.budgets.invest = 200000;
  state.budgets.saude = 50000;
  state.budgets.lazer = 30000;
  state.budgets.transporte = 40000;
  state.budgets.outros = 30000;

  save();
  renderAll();
  alert("Exemplos adicionados!");
});

/* ========= EDIT from click ========= */
window.__openEdit = (id)=>{
  const tx = state.tx.find(t=>t.id===id);
  if(!tx) return;
  openModal({type: tx.type, tx});
};

/* ========= RENDER ALL ========= */
function renderAll(){
  fillCategorySelect();
  renderHome();
  ensureCharts();
  updateLineDemo();
  renderTransactions();
  renderBudgetReal();
}
renderAll();

/* default go home */
go("home");