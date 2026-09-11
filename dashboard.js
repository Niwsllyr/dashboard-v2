import { processCSV } from './csvReader.js';
import { renderCharts } from './charts.js';
import { calculateMetrics } from './metrics.js';
import { resolveCepsToCities } from './cepresolver.js';

const input = document.getElementById('csvInput');
const dsInput = document.getElementById('dsInput');
const driverSelect = document.getElementById('driverSelect');
const citySelect = document.getElementById('citySelect');
const statusSelect = document.getElementById('statusSelect');
const cityTableBody = document.getElementById('cityTableBody');
const cepStatus = document.getElementById('cepStatus');

const btnGeneral = document.getElementById('btnGeneral');
const btnSLA = document.getElementById('btnSLA');
const btnDS = document.getElementById('btnDS');
const btnCity = document.getElementById('btnCity');

const homePage = document.getElementById('homePage');
const cityPage = document.getElementById('cityPage');

let rawData = [];
let dsData = [];

// 🔥 Mapa dinâmico { cep: "Cidade - UF" }, resolvido via API ViaCEP
// em vez do dicionário fixo que existia antes
let cepToCity = {};

// 📲 Mapa dinâmico { "Nome do Entregador": "telefone bruto vindo da coluna O" }
let driverPhones = {};

let currentMode = 'GENERAL';

const META_SLA = 98;

function getSlaClass(sla) {
  const v = parseFloat(sla);
  if (v >= 98) return 'sla-green';
  if (v >= 95) return 'sla-yellow';
  return 'sla-red';
}

/* =========================
   📲 TELEFONE DO ENTREGADOR (coluna O do CSV)
========================= */

// Coluna O = índice 14 (A=0, B=1, C=2 ... O=14)
const PHONE_COLUMN_INDEX = 14;

function updateDriverPhones(data, fields) {
  if (!fields || fields.length <= PHONE_COLUMN_INDEX) return;

  const phoneKey = fields[PHONE_COLUMN_INDEX];

  data.forEach(row => {
    const driver = row['Driver Name'];
    const phone = row[phoneKey];

    if (driver && phone && !driverPhones[driver]) {
      driverPhones[driver] = phone;
    }
  });
}

function normalizePhoneForWhatsApp(rawPhone) {
  if (!rawPhone) return null;

  let digits = rawPhone.toString().replace(/\D/g, '');
  if (!digits) return null;

  digits = digits.replace(/^0+/, '');

  // já vem com DDI 55 (Brasil)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // número local com DDD (10 ou 11 dígitos) -> adiciona DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }

  return digits;
}

function getFirstName(fullName) {
  if (!fullName) return '';
  return fullName.toString().trim().split(/\s+/)[0];
}

function buildWhatsAppMessage(driver) {
  return `⚠️ ATENÇÃO – ACOMPANHAMENTO DE DESEMPENHO\n\n${getFirstName(driver.name)}, identificamos que, dos ${driver.total} pacotes atribuídos a você, ${driver.delivered} foram entregues e ${driver.pending} permanecem pendentes, resultando atualmente em um SLA de ${driver.sla}%.`;
}

function createNotifyButtonCell(driver) {
  const td = document.createElement('td');

  const phoneRaw = driverPhones[driver.name];
  const numero = normalizePhoneForWhatsApp(phoneRaw);

  if (!numero) {
    td.innerHTML = '<span style="color:#999;font-size:12px;">Sem contato</span>';
    return td;
  }

  const btn = document.createElement('button');
  btn.innerText = '📲 Notificar';
  btn.style.cssText = 'background:#25D366;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;';

  btn.onclick = () => {
    const mensagem = buildWhatsAppMessage(driver);
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  td.appendChild(btn);
  return td;
}

/* =========================
   🔥 RESOLVE CEPs (ViaCEP)
========================= */
async function refreshCepMap() {

  const allCeps = [
    ...rawData.map(r => r['Postal Code']),
    ...dsData.map(r => r['Postal Code'])
  ].filter(Boolean);

  if (!allCeps.length) return;

  if (cepStatus) {
    cepStatus.style.display = 'inline-block';
    cepStatus.innerText = `Resolvendo CEPs... 0/${new Set(allCeps).size}`;
  }

  const resolved = await resolveCepsToCities(allCeps, (done, total) => {
    if (cepStatus) {
      cepStatus.innerText = `Resolvendo CEPs... ${done}/${total}`;
    }
  });

  // Junta o que já tínhamos com o que acabou de ser resolvido
  cepToCity = { ...cepToCity, ...resolved };

  if (cepStatus) {
    cepStatus.innerText = `CEPs resolvidos: ${Object.keys(cepToCity).length}`;
    setTimeout(() => { cepStatus.style.display = 'none'; }, 2500);
  }

  rebuildCitySelect();
}

function rebuildCitySelect() {
  const cities = [...new Set(Object.values(cepToCity))]
    .filter(c => c && c !== 'CEP não encontrado')
    .sort();

  const current = citySelect.value;

  citySelect.innerHTML = '<option value="">Todas as Cidades</option>';
  cities.forEach(c => citySelect.innerHTML += `<option value="${c}">${c}</option>`);

  if (cities.includes(current)) {
    citySelect.value = current;
  }
}

/* =========================
   FILTROS
========================= */
function applyFilters() {

  let filteredSLA = [...rawData];
  let filteredDS = [...dsData];

  if (driverSelect.value) {
    filteredSLA = filteredSLA.filter(r => r['Driver Name'] === driverSelect.value);
    filteredDS = filteredDS.filter(r => r['Driver Name'] === driverSelect.value);
  }

  if (citySelect.value) {
    filteredSLA = filteredSLA.filter(r => cepToCity[r['Postal Code']] === citySelect.value);
    filteredDS = filteredDS.filter(r => cepToCity[r['Postal Code']] === citySelect.value);
  }

  if (statusSelect.value) {
    filteredSLA = filteredSLA.filter(r => r['Status'] === statusSelect.value);
    filteredDS = filteredDS.filter(r => r['Status'] === statusSelect.value);
  }

  updateByMode({ sla: filteredSLA, ds: filteredDS });
}

/* =========================
   ATUALIZA DASHBOARD
========================= */
function updateByMode({ sla, ds }) {

  const baseRaw = currentMode === 'DS' ? ds : sla;

  const cardMeta = document.getElementById('cardMeta');
  const cardDiff = document.getElementById('cardDiff');
  const cardScore = document.getElementById('cardScore');

  /* ===== GENERAL ===== */
  if (currentMode === 'GENERAL') {

    cardMeta.style.display = 'none';
    cardDiff.style.display = 'none';
    cardScore.style.display = 'none';

    const slaResult = calculateMetrics(sla, 'SLA', cepToCity);
    const dsResult = calculateMetrics(ds, 'DS', cepToCity);

    const slaVal = parseFloat(slaResult.sla) || 0;
    const dsVal = parseFloat(dsResult.sla) || 0;

    document.getElementById('kpiTotal').innerText = slaResult.total;
    document.getElementById('kpiDelivered').innerText = slaResult.delivered;
    document.getElementById('kpiPending').innerText = slaResult.pending;
    document.getElementById('kpiSla').innerText = slaVal + '%';

    document.getElementById('kpiSlaCard').className =
      'kpi ' + getSlaClass(slaVal);

    document.getElementById('kpiDs').innerText = dsVal + '%';
    document.getElementById('kpiDsCard').className =
      'kpi ' + getSlaClass(dsVal);

    const diff = (dsVal - slaVal).toFixed(2);
    document.getElementById('kpiDiff').innerText =
      (diff > 0 ? '+' : '') + diff + '%';

    let alerta = '';

    if (slaVal >= META_SLA && dsVal >= META_SLA) {
      alerta = '✅ Meta batida (SLA e DS)';
    } 
    else if (slaVal >= META_SLA && dsVal < META_SLA) {
      alerta = '⚠️ SLA OK, mas DS abaixo da meta';
    } 
    else if (slaVal < META_SLA && dsVal >= META_SLA) {
      alerta = '⚠️ DS OK, mas SLA abaixo da meta';
    } 
    else {
      alerta = '🚨 SLA e DS abaixo da meta';
    }

    document.getElementById('kpiAlert').innerText = alerta;

    document.getElementById('kpiForecast').innerText = '-';

    renderCharts(
      { ...slaResult, driverSLA: slaResult.driverSLA, citySLA: slaResult.citySLA },
      currentMode,
      { status: statusSelect.value, rawData: baseRaw, cepToCity }
    );

    renderDriverRanking(sla);
    return;
  }

  /* ===== SLA / DS ===== */

  // 🔥 ESCONDE CARDS DESNECESSÁRIOS
  cardMeta.style.display = 'none';
  cardDiff.style.display = 'none';
  cardScore.style.display = 'block';

  let result;
  if (currentMode === 'SLA') result = calculateMetrics(sla, 'SLA', cepToCity);
  if (currentMode === 'DS') result = calculateMetrics(ds, 'DS', cepToCity);

  document.getElementById('kpiTotal').innerText = result.total;
  document.getElementById('kpiDelivered').innerText = result.delivered;
  document.getElementById('kpiPending').innerText = result.pending;

  if (currentMode === 'SLA') {

    document.getElementById('kpiSla').innerText = result.sla + '%';
    document.getElementById('kpiSlaCard').className =
      'kpi ' + getSlaClass(result.sla);

    document.getElementById('kpiSlaCard').style.display = 'block';
    document.getElementById('kpiDsCard').style.display = 'none';

  } else {

    document.getElementById('kpiDs').innerText = result.sla + '%';
    document.getElementById('kpiDsCard').className =
      'kpi ' + getSlaClass(result.sla);

    document.getElementById('kpiDsCard').style.display = 'block';
    document.getElementById('kpiSlaCard').style.display = 'none';
  }

  let alerta = parseFloat(result.sla) < META_SLA
    ? '🚨 Abaixo da meta (98%)'
    : '✅ Meta batida';

  document.getElementById('kpiAlert').innerText = alerta;

  document.getElementById('kpiScore').innerText = result.sla;

  renderCharts(
    { ...result, driverSLA: result.driverSLA, citySLA: result.citySLA },
    currentMode,
    { status: statusSelect.value, rawData: baseRaw, cepToCity }
  );

  renderDriverTable(baseRaw);
}

/* =========================
   RANKING
========================= */
function renderDriverRanking(data) {

  cityTableBody.innerHTML = '';

  const result = calculateMetrics(data, 'SLA', cepToCity);

result.driverSLA
  .sort((a, b) => b.total - a.total) // 🔥 AQUI A MUDANÇA
  .forEach((driver, index) => {

    const tr = document.createElement('tr');

    let medal = '';
    if (index === 0) medal = '🥇';
    else if (index === 1) medal = '🥈';
    else if (index === 2) medal = '🥉';

    tr.innerHTML = `
      <td>${medal} ${driver.name}</td>
      <td>${driver.total}</td>
      <td>${driver.delivered}</td>
      <td>${driver.pending}</td>
      <td class="${getSlaClass(driver.sla)}">${driver.sla}%</td>
    `;

    tr.appendChild(createNotifyButtonCell(driver));

    cityTableBody.appendChild(tr);
  });
}

/* =========================
   TABELA NORMAL
========================= */
function renderDriverTable(data) {

  cityTableBody.innerHTML = '';

  const result = calculateMetrics(data, currentMode, cepToCity);

  result.driverSLA.forEach(driver => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${driver.name}</td>
      <td>${driver.total}</td>
      <td>${driver.delivered}</td>
      <td>${driver.pending}</td>
      <td class="${getSlaClass(driver.sla)}">${driver.sla}%</td>
    `;

    tr.appendChild(createNotifyButtonCell(driver));

    cityTableBody.appendChild(tr);
  });
}

/* =========================
   LOAD CSV
========================= */
input.addEventListener('change', async (e) => {

  const file = e.target.files[0];
  if (!file) return;

  const parsed = await processCSV(file);
  rawData = parsed.data;
  updateDriverPhones(rawData, parsed.fields);

  const drivers = [...new Set(rawData.map(r => r['Driver Name']).filter(Boolean))];
  driverSelect.innerHTML = '<option value="">Todos os Entregadores</option>';
  drivers.forEach(d => driverSelect.innerHTML += `<option value="${d}">${d}</option>`);

  const statuses = [...new Set(rawData.map(r => r['Status']).filter(Boolean))];
  statusSelect.innerHTML = '<option value="">Todos Status</option>';
  statuses.forEach(s => statusSelect.innerHTML += `<option value="${s}">${s}</option>`);

  // 🔥 resolve os CEPs desse arquivo (e do DS, se já carregado) via ViaCEP
  await refreshCepMap();

  applyFilters();
});

dsInput.addEventListener('change', async (e) => {
  const parsedDs = await processCSV(e.target.files[0]);
  dsData = parsedDs.data;
  updateDriverPhones(dsData, parsedDs.fields);

  // 🔥 resolve também os CEPs do arquivo DS
  await refreshCepMap();

  applyFilters();
});

driverSelect.addEventListener('change', applyFilters);
citySelect.addEventListener('change', applyFilters);
statusSelect.addEventListener('change', applyFilters);

/* =========================
   NAV
========================= */
function setActiveButton(btn) {
  [btnGeneral, btnSLA, btnDS, btnCity].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

btnGeneral.onclick = () => {
  currentMode = 'GENERAL';

  document.getElementById('kpiSlaCard').style.display = 'block';
  document.getElementById('kpiDsCard').style.display = 'block';

  homePage.style.display = 'grid';
  cityPage.style.display = 'none';
  setActiveButton(btnGeneral);
  applyFilters();
};

btnSLA.onclick = () => {
  currentMode = 'SLA';

  document.getElementById('kpiSlaCard').style.display = 'block';
  document.getElementById('kpiDsCard').style.display = 'none';

  homePage.style.display = 'grid';
  cityPage.style.display = 'none';
  setActiveButton(btnSLA);
  applyFilters();
};

btnDS.onclick = () => {
  currentMode = 'DS';

  document.getElementById('kpiDsCard').style.display = 'block';
  document.getElementById('kpiSlaCard').style.display = 'none';

  homePage.style.display = 'grid';
  cityPage.style.display = 'none';
  setActiveButton(btnDS);
  applyFilters();
};

btnCity.onclick = () => {
  homePage.style.display = 'none';
  cityPage.style.display = 'block';
  setActiveButton(btnCity);
};

function exportDashboard() {
  const element = document.getElementById('homePage');

  // ativa modo exportação (remove sombras)
  document.body.classList.add('export-mode');

  html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  }).then(canvas => {

    document.body.classList.remove('export-mode');

    const link = document.createElement('a');
    link.download = 'dashboard.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

window.handleStatusClick = function(status) {

  const dataBase = currentMode === 'DS' ? dsData : rawData;

  const filtrados = dataBase.filter(r => r['Status'] === status);

  const agrupado = {};

  filtrados.forEach(row => {
    const driver = row['Driver Name'] || 'Sem nome';
    const br = row['Order ID'] || 'Sem código';
    if (!agrupado[driver]) {
      agrupado[driver] = [];
    }

    agrupado[driver].push(br);
  });

  renderStatusPage(status, agrupado);
};

function renderStatusPage(status, data) {

  homePage.style.display = 'none';
  cityPage.style.display = 'none';

  let page = document.getElementById('statusPage');

  if (!page) {
    page = document.createElement('section');
    page.id = 'statusPage';
    page.className = 'table-page';

    page.innerHTML = `
      <div class="card table-card">
        <h2 id="statusTitle"></h2>
        <button onclick="voltarDashboard()">⬅ Voltar</button>
        <div id="statusContent"></div>
      </div>
    `;

    document.querySelector('.dashboard').appendChild(page);
  }

  page.style.display = 'block';

  document.getElementById('statusTitle').innerText =
    `Status: ${status}`;

  const container = document.getElementById('statusContent');
  container.innerHTML = '';

  Object.entries(data).forEach(([driver, brs]) => {

    const div = document.createElement('div');
    div.className = 'driver-block';

    div.innerHTML = `
      <h3>${driver}</h3>
      <p>${brs.join('<br>')}</p>
    `;

    container.appendChild(div);
  });
}

window.voltarDashboard = function() {
  document.getElementById('statusPage').style.display = 'none';
  homePage.style.display = 'grid';
};