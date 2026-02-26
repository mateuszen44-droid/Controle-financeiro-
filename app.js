/* Financeiro Matheus e Thaís (PRO)
   - Chart.js (gráficos reais)
   - Categorias completas + orçamento
   - Investimentos (tela separada)
   - Metas e Caixinhas
   - Dados no aparelho (LocalStorage)
*/

const STORAGE_KEY = "fmth_pro_v1";

const state = {
  selectedMonth: ymNow(),
  catFilter: "expense",
  goalFilter: "all",
  txType: "expense",
  categories: [],
  transactions: [],
  goals: [] // metas e caixinhas
};

const el = {};
let charts = { expenses:null, balance:null, invest:null };

init();

function init(){
  cacheEls();
  loadOrSeed();
  bindUI();
  refreshAll();
}

function cacheEls(){
  el.balanceValue = qs("#balanceValue");
  el.sumIncome = qs("#sumIncome");
  el.sumExpense = qs("#sumExpense");
  el.sumInvest = qs("#sumInvest");
  el.sumBoxes = qs("#sumBoxes");
  el.monthBadge = qs("#monthBadge");

  el.selectMonth = qs("#selectMonth");

  el.recentList = qs("#recentList");
  el.catList = qs("#catList");
  el.investList = qs("#investList");
  el.goalList = qs("#goalList");

  el.investTotal = qs("#investTotal");
  el.investMonth = qs("#investMonth");

  el.txAmount = qs("#txAmount");
  el.txDate = qs("#txDate");
  el.txCategory = qs("#txCategory");
  el.txNote = qs("#txNote");
  el.badgeType = qs("#badgeType");

  el.fileImport = qs("#fileImport");
}

function bindUI(){
  // nav
  qsa(".navBtn").forEach(b=>{
    b.addEventListener("click", ()=>{
      const go = b.dataset.go;
      navigate(go);
    });
  });

  // month
  el.selectMonth.addEventListener("change", ()=>{
    state.selectedMonth = el.selectMonth.value;
    save();
    refreshAll();
  });

  // type toggle (add tx)
  qsa(".typeBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setTxType(btn.dataset.type);
    });
  });

  // segmented filters
  qsa("#view-categories .segBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      qsa("#view-categories .segBtn").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      state.catFilter = btn.dataset.catfilter;
      save();
      renderCategories();
      fillTxCategoryOptions(state.txType);
    });
  });

  qsa("#view-goals .segBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      qsa("#view-goals .segBtn").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      state.goalFilter = btn.dataset.goalfilter;
      save();
      renderGoals();
      renderSummary();
    });
  });

  // quick add
  qs("#btnAddFromHome").addEventListener("click", ()=>{ setTxType("expense"); navigate("add"); });
  qs("#pillIncome").addEventListener("click", ()=>{ setTxType("income"); navigate("add"); });
  qs("#pillExpense").addEventListener("click", ()=>{ setTxType("expense"); navigate("add"); });

  // invest add
  qs("#btnAddInvest").addEventListener("click", ()=>{ setTxType("investment"); navigate("add"); });

  // save/cancel tx
  qs("#btnSaveTx").addEventListener("click", saveTx);
  qs("#btnCancelTx").addEventListener("click", ()=>{
    clearTxForm();
    navigate("home");
  });

  // categories add
  qs("#btnAddCategory").addEventListener("click", addCategoryFlow);

  // goals add
  qs("#btnAddGoal").addEventListener("click", addGoalFlow);

  // backup buttons
  qs("#btnExport").addEventListener("click", exportBackup);
  qs("#btnImport").addEventListener("click", ()=> el.fileImport.click());
  el.fileImport.addEventListener("change", importBackup);

  qs("#btnReset").addEventListener("click", ()=>{
    if(confirm("Quer zerar tudo? Isso apaga dados, categorias e metas.")){
      localStorage.removeItem(STORAGE_KEY);
      loadOrSeed();
      refreshAll();
      toast("Zerado.");
    }
  });

  qs("#btnBackup").addEventListener("click", exportBackup);
  qs("#btnMoreTop").addEventListener("click", ()=> navigate("more"));

  // init date
  el.txDate.value = todayISO();
  setTxType(state.txType);
}

function navigate(view){
  qsa(".navBtn").forEach(b=> b.classList.remove("active"));
  const navBtn = qsa(".navBtn").find(b=>b.dataset.go===view);
  if(navBtn) navBtn.classList.add("active");

  qsa(".view").forEach(v=>v.classList.remove("active"));
  qs(`#view-${view}`).classList.add("active");

  // redraw charts when entering
  if(view==="home"){
    renderCharts();
  }
  if(view==="invest"){
    renderInvest();
  }
}

function refreshAll(){
  fillMonthSelect();
  ensureCoreData();

  renderSummary();
  renderRecent();
  renderCategories();
  renderInvest();
  renderGoals();
  renderCharts();

  fillTxCategoryOptions(state.txType);
  el.monthBadge.textContent = monthLabel(state.selectedMonth);
}

function renderSummary(){
  const ym = state.selectedMonth;

  const income = sum(monthTx(ym).filter(t=>t.type==="income"));
  const expense = sum(monthTx(ym).filter(t=>t.type==="expense"));
  const invest = sum(monthTx(ym).filter(t=>t.type==="investment"));
  const balance = income - expense - invest;

  el.balanceValue.textContent = money(balance);
  el.sumIncome.textContent = money(income);
  el.sumExpense.textContent = money(expense);
  el.sumInvest.textContent = money(invest);

  // caixinhas (saldo guardado)
  const boxesTotal = state.goals
    .filter(g=>g.kind==="box")
    .reduce((a,g)=> a + Number(g.current||0), 0);
  el.sumBoxes.textContent = money(boxesTotal);
}

function renderRecent(){
  const ym = state.selectedMonth;
  const tx = monthTx(ym).slice().sort((a,b)=> b.date.localeCompare(a.date));
  const last = tx.slice(0,5);

  el.recentList.innerHTML = "";
  if(last.length===0){
    el.recentList.innerHTML = `<div class="hint">Sem transações neste mês.</div>`;
    return;
  }

  last.forEach(t=>{
    const cat = catById(t.categoryId) || {name:"(sem categoria)", icon:"•", color:"#55a8ff", kind:t.type};
    const title = t.note?.trim() ? t.note.trim() : cat.name;

    let pctText = "";
    let pct = 0;

    if(t.type==="expense"){
      const budget = Number(cat.monthlyBudget||0);
      if(budget>0){
        const spentInCat = sum(monthTx(ym).filter(x=>x.type==="expense" && x.categoryId===cat.id));
        pct = Math.min(100, Math.round((spentInCat/budget)*100));
        pctText = `${pct}%`;
      }
    } else if(t.type==="investment"){
      pctText = "Invest.";
      pct = 75;
    } else {
      pctText = "Entrada";
      pct = 0;
    }

    const row = document.createElement("div");
    row.className = "row";
    const iconBg = `color-mix(in srgb, ${cat.color} 22%, rgba(255,255,255,.06))`;
    const barBg = `linear-gradient(90deg, ${cat.color}, color-mix(in srgb, ${cat.color} 35%, rgba(255,255,255,.12)))`;

    row.innerHTML = `
      <div class="rowIcon" style="background:${iconBg};">${cat.icon}</div>
      <div class="rowMain">
        <div class="rowTitle">${escapeHtml(title)}</div>
        <div class="rowSub">${labelType(t.type)} • ${escapeHtml(cat.name)} • ${formatDateBR(t.date)}</div>
        ${pctText && t.type!=="income" ? `<div class="progress"><div style="width:${pct}%;background:${barBg}"></div></div>` : ``}
      </div>
      <div class="rowRight">
        <div class="rowValue">${money(t.amount)}</div>
        <div class="rowPct">${pctText}</div>
      </div>
    `;

    row.addEventListener("click", ()=> editOrDeleteTx(t.id));
    el.recentList.appendChild(row);
  });
}

/* ---------------- CATEGORIES ---------------- */

function renderCategories(){
  const ym = state.selectedMonth;
  const list = state.categories.filter(c=>c.kind===state.catFilter);

  el.catList.innerHTML = "";
  if(list.length===0){
    el.catList.innerHTML = `<div class="hint">Sem categorias deste tipo.</div>`;
    return;
  }

  list.forEach(cat=>{
    const spent = sum(monthTx(ym).filter(t=>t.type==="expense" && t.categoryId===cat.id));
    const invest = sum(monthTx(ym).filter(t=>t.type==="investment" && t.categoryId===cat.id));
    const budget = Number(cat.monthlyBudget||0);

    let pct = 0, pctText = "";
    if(cat.kind==="expense" && budget>0){
      pct = Math.min(100, Math.round((spent/budget)*100));
      pctText = `${pct}%`;
    }
    if(cat.kind==="investment"){
      pct = invest>0 ? 80 : 0;
      pctText = invest>0 ? "Invest." : "";
    }

    const row = document.createElement("div");
    row.className = "row";
    const iconBg = `color-mix(in srgb, ${cat.color} 22%, rgba(255,255,255,.06))`;
    const barBg = `linear-gradient(90deg, ${cat.color}, color-mix(in srgb, ${cat.color} 35%, rgba(255,255,255,.12)))`;

    row.innerHTML = `
      <div class="rowIcon" style="background:${iconBg};">${cat.icon}</div>
      <div class="rowMain">
        <div class="rowTitle">${escapeHtml(cat.name)}</div>
        <div class="rowSub">
          ${cat.kind==="expense"
            ? `Orçamento: ${budget?money(budget):"—"} • Gasto: ${money(spent)}`
            : cat.kind==="investment"
              ? `Aportes: ${money(invest)}`
              : `Entradas: ${money(sum(monthTx(ym).filter(t=>t.type==="income" && t.categoryId===cat.id)))}`
          }
        </div>
        ${pctText ? `<div class="progress"><div style="width:${pct}%;background:${barBg}"></div></div>` : ``}
      </div>
      <div class="rowRight">
        <div class="rowValue">${cat.kind==="expense" ? money(spent) : cat.kind==="investment" ? money(invest) : ""}</div>
        <div class="rowPct">${pctText}</div>
      </div>
    `;

    row.addEventListener("click", ()=> editCategoryFlow(cat.id));
    el.catList.appendChild(row);
  });
}

function addCategoryFlow(){
  const kind = prompt("Tipo da categoria: expense (saída) | income (entrada) | investment (invest.)", state.catFilter);
  if(!kind || !["expense","income","investment"].includes(kind)) return;

  const name = prompt("Nome da categoria (ex: Mercado, Aluguel, Salário, Tesouro):");
  if(!name) return;

  const icon = (prompt("Ícone (emoji). Ex: 🛒 🏠 💼 📈", defaultIcon(kind)) || defaultIcon(kind)).trim().slice(0,2);
  const color = prompt("Cor (hex). Ex: #55a8ff", defaultColor(kind)) || defaultColor(kind);

  let monthlyBudget = 0;
  if(kind==="expense"){
    monthlyBudget = Number(prompt("Orçamento mensal (R$) (opcional). Ex: 800", "0") || 0);
  }

  state.categories.push({ id: uid(), kind, name: name.trim(), icon, color, monthlyBudget });
  save();
  renderCategories();
  fillTxCategoryOptions(state.txType);
  toast("Categoria criada.");
}

function editCategoryFlow(id){
  const cat = state.categories.find(c=>c.id===id);
  if(!cat) return;

  const action = prompt(
    `Categoria: ${cat.name}\n\nDigite:\n1 = Editar\n2 = Apagar\n(ou Cancelar)`
  );

  if(action==="2"){
    if(confirm("Apagar categoria? (transações ficam sem categoria)")){
      state.categories = state.categories.filter(c=>c.id!==id);
      state.transactions = state.transactions.map(t=> t.categoryId===id ? ({...t, categoryId:""}) : t );
      save();
      refreshAll();
      toast("Apagada.");
    }
    return;
  }

  if(action==="1"){
    cat.name = (prompt("Nome:", cat.name) || cat.name).trim();
    cat.icon = (prompt("Ícone:", cat.icon) || cat.icon).trim().slice(0,2);
    cat.color = (prompt("Cor (hex):", cat.color) || cat.color);

    if(cat.kind==="expense"){
      cat.monthlyBudget = Number(prompt("Orçamento mensal:", String(cat.monthlyBudget||0)) || cat.monthlyBudget);
    }

    save();
    refreshAll();
    toast("Editada.");
  }
}

/* ---------------- INVEST ---------------- */

function renderInvest(){
  const ym = state.selectedMonth;

  const totalInvest = sum(state.transactions.filter(t=>t.type==="investment"));
  const monthInvest = sum(monthTx(ym).filter(t=>t.type==="investment"));

  el.investTotal.textContent = money(totalInvest);
  el.investMonth.textContent = money(monthInvest);

  // list (últimos 8)
  const list = state.transactions
    .filter(t=>t.type==="investment")
    .slice()
    .sort((a,b)=> b.date.localeCompare(a.date))
    .slice(0,8);

  el.investList.innerHTML = "";
  if(list.length===0){
    el.investList.innerHTML = `<div class="hint">Sem investimentos ainda.</div>`;
  } else {
    list.forEach(t=>{
      const cat = catById(t.categoryId) || {name:"Invest.", icon:"📈", color:"#35f0c6"};
      const title = t.note?.trim() ? t.note.trim() : cat.name;

      const row = document.createElement("div");
      row.className = "row";
      const iconBg = `color-mix(in srgb, ${cat.color} 22%, rgba(255,255,255,.06))`;

      row.innerHTML = `
        <div class="rowIcon" style="background:${iconBg};">${cat.icon}</div>
        <div class="rowMain">
          <div class="rowTitle">${escapeHtml(title)}</div>
          <div class="rowSub">${escapeHtml(cat.name)} • ${formatDateBR(t.date)}</div>
        </div>
        <div class="rowRight">
          <div class="rowValue">${money(t.amount)}</div>
          <div class="rowPct">Aporte</div>
        </div>
      `;
      row.addEventListener("click", ()=> editOrDeleteTx(t.id));
      el.investList.appendChild(row);
    });
  }

  renderCharts(); // atualiza chartInvest também
}

/* ---------------- GOALS / BOXES ---------------- */

function renderGoals(){
  const filter = state.goalFilter;
  const list = state.goals.filter(g=> filter==="all" ? true : g.kind===filter);

  el.goalList.innerHTML = "";
  if(list.length===0){
    el.goalList.innerHTML = `<div class="hint">Sem metas/caixinhas ainda. Clique em “Criar”.</div>`;
    return;
  }

  list.forEach(g=>{
    const pct = g.target>0 ? Math.min(100, Math.round((g.current/g.target)*100)) : 0;

    const row = document.createElement("div");
    row.className = "row";
    const iconBg = `color-mix(in srgb, ${g.color} 22%, rgba(255,255,255,.06))`;
    const barBg = `linear-gradient(90deg, ${g.color}, color-mix(in srgb, ${g.color} 35%, rgba(255,255,255,.12)))`;

    row.innerHTML = `
      <div class="rowIcon" style="background:${iconBg};">${g.icon}</div>
      <div class="rowMain">
        <div class="rowTitle">${escapeHtml(g.name)}</div>
        <div class="rowSub">${g.kind==="box" ? "Caixinha" : "Meta"} • ${money(g.current)} / ${money(g.target)}</div>
        <div class="progress"><div style="width:${pct}%;background:${barBg}"></div></div>
      </div>
      <div class="rowRight">
        <div class="rowValue">${pct}%</div>
        <div class="rowPct">${g.kind==="box" ? "Guardar" : "Meta"}</div>
      </div>
    `;

    row.addEventListener("click", ()=> editGoalFlow(g.id));
    el.goalList.appendChild(row);
  });
}

function addGoalFlow(){
  const kind = prompt("Tipo: box (caixinha) | goal (meta)", "box");
  if(!kind || !["box","goal"].includes(kind)) return;

  const name = prompt("Nome (ex: Reserva de Emergência / Viagem fim do ano / Troca do carro):");
  if(!name) return;

  const target = Number(prompt("Valor alvo (R$). Ex: 5000", "1000") || 0);
  const current = Number(prompt("Quanto já tem (R$). Ex: 200", "0") || 0);

  const icon = (prompt("Ícone (emoji). Ex: 🧰 ✈️ 🚗 🏦", kind==="box"?"🏦":"🎯") || (kind==="box"?"🏦":"🎯")).trim().slice(0,2);
  const color = prompt("Cor (hex). Ex: #b69cff", kind==="box" ? "#35f0c6" : "#55a8ff") || (kind==="box" ? "#35f0c6" : "#55a8ff");

  state.goals.push({ id: uid(), kind, name: name.trim(), target, current, icon, color });
  save();
  renderGoals();
  renderSummary();
  toast("Criado.");
}

function editGoalFlow(id){
  const g = state.goals.find(x=>x.id===id);
  if(!g) return;

  const action = prompt(
    `${g.name}\n\nDigite:\n1 = Somar dinheiro\n2 = Retirar dinheiro\n3 = Editar\n4 = Apagar\n(ou Cancelar)`
  );

  if(action==="1"){
    const v = Number(prompt("Quanto quer adicionar (R$)?", "100") || 0);
    if(v>0){ g.current += v; save(); refreshAll(); toast("Adicionado."); }
    return;
  }
  if(action==="2"){
    const v = Number(prompt("Quanto quer retirar (R$)?", "100") || 0);
    if(v>0){ g.current = Math.max(0, g.current - v); save(); refreshAll(); toast("Retirado."); }
    return;
  }
  if(action==="3"){
    g.name = (prompt("Nome:", g.name) || g.name).trim();
    g.target = Number(prompt("Alvo (R$):", String(g.target||0)) || g.target);
    g.current = Number(prompt("Atual (R$):", String(g.current||0)) || g.current);
    g.icon = (prompt("Ícone:", g.icon) || g.icon).trim().slice(0,2);
    g.color = (prompt("Cor:", g.color) || g.color);
    save(); refreshAll(); toast("Editado.");
    return;
  }
  if(action==="4"){
    if(confirm("Apagar?")){
      state.goals = state.goals.filter(x=>x.id!==id);
      save(); refreshAll(); toast("Apagado.");
    }
  }
}

/* ---------------- TX ---------------- */

function setTxType(type){
  state.txType = type;
  qsa(".typeBtn").forEach(b=> b.classList.toggle("active", b.dataset.type===type));
  el.badgeType.textContent = labelType(type);
  fillTxCategoryOptions(type);

  if(!el.txDate.value) el.txDate.value = todayISO();
}

function fillTxCategoryOptions(type){
  const kind = type; // income/expense/investment
  const list = state.categories.filter(c=>c.kind===kind);

  // fallback if no category
  if(list.length===0){
    el.txCategory.innerHTML = `<option value="">(crie uma categoria)</option>`;
    return;
  }

  el.txCategory.innerHTML = list.map(c=>`
    <option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>
  `).join("");
}

function saveTx(){
  const amount = parseMoney(el.txAmount.value);
  if(!(amount>0)){ toast("Informe um valor."); return; }

  const date = el.txDate.value || todayISO();
  const categoryId = el.txCategory.value || "";
  const note = (el.txNote.value||"").trim();

  const editingId = el.txAmount.dataset.editingId || "";
  if(editingId){
    const t = state.transactions.find(x=>x.id===editingId);
    if(!t) return;
    t.type = state.txType;
    t.amount = amount;
    t.date = date;
    t.categoryId = categoryId;
    t.note = note;
    el.txAmount.dataset.editingId = "";
    toast("Editado.");
  } else {
    state.transactions.push({ id: uid(), type: state.txType, amount, date, categoryId, note });
    toast("Salvo!");
  }

  save();
  clearTxForm();
  refreshAll();
  navigate("home");
}

function clearTxForm(){
  el.txAmount.value = "";
  el.txNote.value = "";
  el.txAmount.dataset.editingId = "";
  el.txDate.value = todayISO();
}

function editOrDeleteTx(id){
  const t = state.transactions.find(x=>x.id===id);
  if(!t) return;

  const action = prompt(
    `Transação:\n${money(t.amount)} • ${formatDateBR(t.date)}\n\nDigite:\n1 = Editar\n2 = Apagar\n(ou Cancelar)`
  );

  if(action==="2"){
    if(confirm("Apagar esta transação?")){
      state.transactions = state.transactions.filter(x=>x.id!==id);
      save();
      refreshAll();
      toast("Apagado.");
    }
    return;
  }

  if(action==="1"){
    navigate("add");
    setTxType(t.type);
    el.txAmount.value = String(t.amount).replace(".", ",");
    el.txDate.value = t.date;
    fillTxCategoryOptions(t.type);
    el.txCategory.value = t.categoryId;
    el.txNote.value = t.note || "";
    el.txAmount.dataset.editingId = t.id;
  }
}

/* ---------------- CHARTS (Chart.js) ---------------- */

function renderCharts(){
  const ym = state.selectedMonth;
  const tx = monthTx(ym);

  // 1) Donut despesas por categoria
  const expByCat = groupSum(tx.filter(t=>t.type==="expense"), t=> t.categoryId || "nocat");
  const expLabels = Object.keys(expByCat).map(id => (catById(id)?.name || "Sem categoria"));
  const expValues = Object.values(expByCat);
  const expColors = Object.keys(expByCat).map(id => (catById(id)?.color || "#55a8ff"));

  charts.expenses = mountChart(charts.expenses, "chartExpenses", "doughnut", {
    labels: expLabels,
    datasets: [{ data: expValues, backgroundColor: expColors, borderWidth: 0 }]
  }, {
    plugins:{ legend:{ display:false } },
    cutout:"68%"
  });

  // 2) Linha saldo acumulado ao longo do mês
  const days = daysInMonth(ym);
  const daily = Array(days).fill(0);

  for(let d=1; d<=days; d++){
    const dayStr = String(d).padStart(2,"0");
    const date = `${ym}-${dayStr}`;
    const income = sum(tx.filter(t=>t.type==="income" && t.date===date));
    const expense = sum(tx.filter(t=>t.type==="expense" && t.date===date));
    const invest = sum(tx.filter(t=>t.type==="investment" && t.date===date));
    daily[d-1] = income - expense - invest;
  }
  // acumulado
  for(let i=1;i<daily.length;i++) daily[i]+=daily[i-1];

  charts.balance = mountChart(charts.balance, "chartBalance", "line", {
    labels: Array.from({length:days}, (_,i)=> String(i+1)),
    datasets: [{
      label:"Saldo",
      data: daily,
      tension: 0.35,
      fill: true
    }]
  }, {
    plugins:{ legend:{ display:false } },
    scales:{
      x:{ grid:{ display:false }, ticks:{ display:false } },
      y:{ grid:{ color:"rgba(255,255,255,.08)" }, ticks:{ display:false } }
    }
  });

  // 3) Investimentos por categoria (barra)
  const invByCat = groupSum(tx.filter(t=>t.type==="investment"), t=> t.categoryId || "nocat");
  const invLabels = Object.keys(invByCat).map(id => (catById(id)?.name || "Sem categoria"));
  const invValues = Object.values(invByCat);
  const invColors = Object.keys(invByCat).map(id => (catById(id)?.color || "#35f0c6"));

  charts.invest = mountChart(charts.invest, "chartInvest", "bar", {
    labels: invLabels,
    datasets: [{ data: invValues, backgroundColor: invColors, borderRadius: 10 }]
  }, {
    plugins:{ legend:{ display:false } },
    scales:{
      x:{ grid:{ display:false }, ticks:{ color:"rgba(255,255,255,.65)", font:{ weight:"700" } } },
      y:{ grid:{ color:"rgba(255,255,255,.08)" }, ticks:{ display:false } }
    }
  });
}

function mountChart(existing, canvasId, type, data, extraOptions){
  const ctx = qs(`#${canvasId}`);
  if(!ctx) return existing;

  const base = {
    type,
    data,
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ tooltip:{ enabled:true } },
      elements:{
        line:{ borderWidth: 4, borderColor:"rgba(85,168,255,.95)" },
        point:{ radius: 0 }
      }
    }
  };

  // merge options
  base.options = deepMerge(base.options, extraOptions || {});
  // special line fill
  if(type==="line"){
    base.data.datasets[0].backgroundColor = "rgba(85,168,255,.14)";
    base.data.datasets[0].borderColor = "rgba(85,168,255,.95)";
  }

  if(existing){
    existing.destroy();
  }
  return new Chart(ctx, base);
}

/* ---------------- BACKUP ---------------- */

function exportBackup(){
  const data = JSON.stringify({ v:1, ...state }, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro_backup_${state.selectedMonth}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exportado.");
}

function importBackup(){
  const file = el.fileImport.files?.[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(!obj || !obj.categories || !obj.transactions || !obj.goals) throw new Error("inv");
      state.selectedMonth = obj.selectedMonth || ymNow();
      state.catFilter = obj.catFilter || "expense";
      state.goalFilter = obj.goalFilter || "all";
      state.txType = obj.txType || "expense";
      state.categories = obj.categories;
      state.transactions = obj.transactions;
      state.goals = obj.goals;

      save();
      refreshAll();
      toast("Importado!");
      el.fileImport.value = "";
    }catch(e){
      toast("Backup inválido.");
    }
  };
  reader.readAsText(file);
}

/* ---------------- STORAGE / SEED ---------------- */

function loadOrSeed(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{
      const obj = JSON.parse(raw);
      Object.assign(state, obj);
      return;
    }catch(e){}
  }
  // seed
  state.selectedMonth = ymNow();
  state.catFilter = "expense";
  state.goalFilter = "all";
  state.txType = "expense";
  state.categories = [];
  state.transactions = [];
  state.goals = [];
  save();
}

function ensureCoreData(){
  // categories essenciais
  const wanted = [
    {name:"Gastos Fixos", kind:"expense", icon:"🏠", color:"#ff6b3d", monthlyBudget:0},
    {name:"Saúde", kind:"expense", icon:"🩺", color:"#b69cff", monthlyBudget:0},
    {name:"Lazer", kind:"expense", icon:"🎮", color:"#55a8ff", monthlyBudget:0},
    {name:"Mercado", kind:"expense", icon:"🛒", color:"#ff7bd2", monthlyBudget:0},

    {name:"Salário", kind:"income", icon:"💼", color:"#35f0c6", monthlyBudget:0},
    {name:"Pix/Outros", kind:"income", icon:"💸", color:"#55a8ff", monthlyBudget:0},

    {name:"Investimentos", kind:"investment", icon:"📈", color:"#35f0c6", monthlyBudget:0},
    {name:"Renda fixa", kind:"investment", icon:"🏦", color:"#55a8ff", monthlyBudget:0},
  ];

  wanted.forEach(w=>{
    if(!state.categories.some(c=>c.name===w.name && c.kind===w.kind)){
      state.categories.push({ id: uid(), ...w });
    }
  });

  // metas/caixinhas padrão
  const gWanted = [
    {name:"Reserva de Emergência", kind:"box", icon:"🏦", color:"#35f0c6", target: 5000, current: 0},
    {name:"Viagem fim do ano", kind:"goal", icon:"✈️", color:"#55a8ff", target: 3000, current: 0},
    {name:"Troca do carro", kind:"goal", icon:"🚗", color:"#b69cff", target: 20000, current: 0}
  ];

  gWanted.forEach(g=>{
    if(!state.goals.some(x=>x.name===g.name && x.kind===g.kind)){
      state.goals.push({ id: uid(), ...g });
    }
  });

  save();
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------- MONTH SELECT ---------------- */

function fillMonthSelect(){
  const months = buildMonthList(18); // 18 meses
  el.selectMonth.innerHTML = months.map(m=>`
    <option value="${m}" ${m===state.selectedMonth?"selected":""}>${monthLabel(m)}</option>
  `).join("");
}

/* ---------------- HELPERS ---------------- */

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function uid(){
  return "id_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function money(n){
  const v = Number(n||0);
  return v.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
}

function parseMoney(s){
  if(!s) return 0;
  const v = String(s).replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,"");
  return Number(v||0);
}

function sum(list){
  return list.reduce((a,x)=> a + Number(x.amount||0), 0);
}

function monthTx(ym){
  return state.transactions.filter(t => t.date?.startsWith(ym));
}

function ymNow(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function monthLabel(ym){
  const [y,m] = ym.split("-").map(Number);
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${months[m-1]} / ${y}`;
}

function formatDateBR(iso){
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function labelType(t){
  if(t==="income") return "Entrada";
  if(t==="investment") return "Investimento";
  return "Saída";
}

function catById(id){
  return state.categories.find(c=>c.id===id);
}

function defaultIcon(kind){
  return kind==="income" ? "💼" : kind==="investment" ? "📈" : "🧾";
}
function defaultColor(kind){
  return kind==="income" ? "#35f0c6" : kind==="investment" ? "#55a8ff" : "#ff6b3d";
}

function escapeHtml(str){
  return String(str||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toast(msg){
  // simples e rápido
  console.log(msg);
}

function buildMonthList(count){
  const out = [];
  const now = new Date();
  for(let i=0;i<count;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    out.push(ym);
  }
  return out;
}

function daysInMonth(ym){
  const [y,m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function groupSum(list, keyFn){
  const map = {};
  list.forEach(item=>{
    const k = keyFn(item);
    map[k] = (map[k]||0) + Number(item.amount||0);
  });
  return map;
}

function deepMerge(target, source){
  const out = {...target};
  for(const k in source){
    if(source[k] && typeof source[k]==="object" && !Array.isArray(source[k])){
      out[k] = deepMerge(out[k]||{}, source[k]);
    }else{
      out[k] = source[k];
    }
  }
  return out;
}