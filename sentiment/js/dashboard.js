const CLASS_MAP = {
  '1':  { name: 'Aprova',    color: 'rgba(34, 197, 94, 0.8)' },
  '-1': { name: 'Desaprova', color: 'rgba(239, 68, 68, 0.8)' },
  '0':  { name: 'Neutro',    color: 'rgba(107, 114, 128, 0.8)' }
};
const BOOTSTRAP_CLASS_MAP = { Aprova: '1', Desaprova: '2', Neutro: '0' };

let bootstrapData = null;
let commentsRaw   = null;     // <- usado pelo gráfico semanal
let sentimentPieChart = null; // caso precise destruir

let currentWeekISO = null;  // semana atual do drill-down
let weekCounts = null;      // {Aprova, Desaprova, Neutro, total}


async function init() {
  const params = new URLSearchParams(window.location.search);
  const datasetKey = params.get('dataset');
  if (!datasetKey) {
    document.body.innerHTML = '<h1>Erro: Nenhum dataset selecionado.</h1>';
    return;
  }

  const configResponse = await fetch('data/datasets.json');
  const datasetsConfig = await configResponse.json();
  const config = datasetsConfig[datasetKey];
  if (!config) {
    document.body.innerHTML = '<h1>Erro: Configuração não encontrada.</h1>';
    return;
  }

  document.getElementById('dashboard-title').textContent = config.title;
  document.querySelector('title').textContent = config.title;

  const [commentsResponse, bootstrapResponse] = await Promise.all([
    fetch(config.commentsFile),
    fetch(config.bootstrapFile)
  ]);

  commentsRaw   = await commentsResponse.json();
  bootstrapData = await bootstrapResponse.json();

  renderStats(commentsRaw);
  renderSentimentDistribution(commentsRaw);
  renderMetricsChart('precision');
  renderWeeklyStacked(commentsRaw); // <- NOVO: gráfico semanal empilhado

  // listeners
  document.getElementById('metric-selector').addEventListener('change', (event) => {
    renderMetricsChart(event.target.value);
  });

  const applyBtn = document.getElementById('applyWeekFilter');
  const clearBtn = document.getElementById('clearWeekFilter');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const s = document.getElementById('weekStartInput').value; // yyyy-mm-dd
      const e = document.getElementById('weekEndInput').value;
      const start = s ? new Date(`${s}T00:00:00Z`) : null;
      const end   = e ? new Date(`${e}T23:59:59Z`) : null;
      renderWeeklyStacked(commentsRaw, { start, end });
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('weekStartInput').value = '';
      document.getElementById('weekEndInput').value   = '';
      renderWeeklyStacked(commentsRaw);
    });
  }
}

function renderStats(data) {
  const counts = data.reduce((acc, item) => {
    acc[(item.new_BERT ?? 0).toString()] = (acc[(item.new_BERT ?? 0).toString()] || 0) + 1;
    return acc;
  }, {});
  const container = document.getElementById('stats-cards');
  container.innerHTML = `
    <div class="card">Total: <strong>${data.length}</strong></div>
    <div class="card">Aprova: <strong>${counts['1'] || 0}</strong></div>
    <div class="card">Desaprova: <strong>${counts['-1'] || 0}</strong></div>
    <div class="card">Neutro: <strong>${counts['0'] || 0}</strong></div>
  `;
}

/* ============================
   Distribuição (Chart.js)
   ============================ */
function renderSentimentDistribution(data) {
  const ctx = document.getElementById('sentiment-distribution-chart').getContext('2d');
  const counts = data.reduce((acc, item) => {
    const key = (item.new_BERT ?? 0).toString();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  if (sentimentPieChart) sentimentPieChart.destroy();
  sentimentPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts).map(key => CLASS_MAP[key].name),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: Object.keys(counts).map(key => CLASS_MAP[key].color)
      }]
    }
  });
}

/* ============================
   Métricas + IC95% (Plotly)
   ============================ */
function renderMetricsChart(metricType) {
  const el = document.getElementById('metrics-chart');
  if (!el) return;

  const labels = ['Aprova', 'Desaprova', 'Neutro'];
  const colors = {
    'Aprova': CLASS_MAP['1'].color,
    'Desaprova': CLASS_MAP['-1'].color,
    'Neutro': CLASS_MAP['0'].color
  };

  const means = [], errPlus = [], errMinus = [], barColors = [];
  labels.forEach(label => {
    const cls = BOOTSTRAP_CLASS_MAP[label];
    const key = `${metricType}_class_${cls}`;
    const m   = bootstrapData.find(d => d[""] === key);
    if (m) {
      means.push(m.mean);
      errPlus.push(Math.max(0, m.upper_95_ci - m.mean));
      errMinus.push(Math.max(0, m.mean - m.lower_95_ci));
    } else {
      means.push(0); errPlus.push(0); errMinus.push(0);
    }
    barColors.push(colors[label]);
  });

  const trace = {
    type: 'bar',
    x: labels,
    y: means,
    marker: { color: barColors, line: { color: 'rgba(0,0,0,0.15)', width: 1 }},
    error_y: {
      type: 'data',
      array: errPlus,
      arrayminus: errMinus,
      visible: true,
      thickness: 1.6,
      width: 8,
      color: 'rgba(30,41,59,0.95)'
    },
    hovertemplate:
      '%{x}<br>' +
      `${metricType.toUpperCase()}: %{y:.3f}<br>` +
      `IC95%: +%{customdata[0]:.3f} / -%{customdata[1]:.3f}<extra></extra>`,
    customdata: errPlus.map((p, i) => [p, errMinus[i]])
  };

  const layout = {
    margin: { t: 16, r: 16, b: 48, l: 56 },
    yaxis: { title: metricType.toUpperCase(), rangemode: 'tozero', range: [0, 1], gridcolor: 'rgba(0,0,0,0.06)' },
    xaxis: { tickangle: -5 },
    bargap: 0.35,
    showlegend: false
  };
  const config = { responsive: true, displayModeBar: false };

  Plotly.newPlot(el, [trace], layout, config);
}

/* ============================
   NOVO: Barras empilhadas por semana (Plotly)
   ============================ */
function renderWeeklyStacked(data, range = {}) {
  const el = document.getElementById('weekly-stacked-chart');
  if (!el) return;

  const { weeks, yA, yD, yN } = groupByISOWeek(data, range);
  if (!weeks.length) {
    Plotly.purge(el);
    el.innerHTML = '<p style="text-align:center;color:#666">Sem dados no período selecionado.</p>';
    return;
  }

  const traceN = {
    type: 'bar', name: 'Neutro',
    x: weeks, y: yN,
    marker: { color: CLASS_MAP['0'].color }
  };
  const traceD = {
    type: 'bar', name: 'Desaprova',
    x: weeks, y: yD,
    marker: { color: CLASS_MAP['-1'].color }
  };
  const traceA = {
    type: 'bar', name: 'Aprova',
    x: weeks, y: yA,
    marker: { color: CLASS_MAP['1'].color }
  };

  const layout = {
    barmode: 'stack',
    margin: { t: 16, r: 16, b: 92, l: 72 },
    xaxis: { title: 'Semana (início)', type: 'category', tickangle: -45 },
    yaxis: { title: 'Nº de comentários por semana por classe', rangemode: 'tozero', gridcolor: 'rgba(0,0,0,0.06)' },
    legend: { orientation: 'v' },
    hovermode: 'x unified'
  };
  const config = { responsive: true, displayModeBar: false };

  Plotly.newPlot(el, [traceN, traceD, traceA], layout, config).then(gd => {
    gd.on('plotly_click', ev => {
      const pt = ev.points?.[0];
      if (!pt) return;
      const weekStartISO = pt.x;          // label "YYYY-MM-DD"
      const klass        = pt.data.name;  // 'Aprova' | 'Desaprova' | 'Neutro'
      handleWeekClick(weekStartISO, klass);
    });
  });
}

/* ========= Helpers ========= */
function groupByISOWeek(data, { start = null, end = null } = {}) {
  const buckets = {};
  for (const item of data) {
    const ts = item.timestamp || item.data_postagem; // prefer timestamp
    if (!ts) continue;
    const d = new Date(ts);
    if (isNaN(d)) continue;

    if (start && d < start) continue;
    if (end && d > end) continue;

    const weekStart = getISOWeekStart(d); // segunda-feira (UTC) da semana
    const key = toISODate(weekStart);     // "YYYY-MM-DD"
    const label = (item.new_BERT ?? 0).toString();

    if (!buckets[key]) buckets[key] = { Aprova: 0, Desaprova: 0, Neutro: 0 };
    if (label === '1') buckets[key].Aprova++;
    else if (label === '-1') buckets[key].Desaprova++;
    else buckets[key].Neutro++;
  }

  const weeks = Object.keys(buckets).sort();
  const yA = weeks.map(w => buckets[w].Aprova);
  const yD = weeks.map(w => buckets[w].Desaprova);
  const yN = weeks.map(w => buckets[w].Neutro);
  return { weeks, yA, yD, yN };
}

function getISOWeekStart(date) {
  // 0=dom..6=sáb (UTC)
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day); // segunda-feira como início
  const monday = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff, 0, 0, 0
  ));
  return monday;
}
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}
function formatWeekRange(weekStartISO) {
  const start = new Date(`${weekStartISO}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

/* Placeholder do drill-down (será implementado na próxima etapa) */
function handleWeekClick(weekStartISO, klass) {
  currentWeekISO = weekStartISO;

  // calcula contagens da semana clicada
  weekCounts = computeWeekCounts(commentsRaw, weekStartISO);

  // abre modal e desenha gráfico (default: precisão)
  openWeekModal();
  renderWeekModalChart('precision');

  // atualiza título e stats
  const boxStats = document.getElementById('weekModalStats');
  const total = weekCounts.total;
  boxStats.textContent = `Total na semana: ${total} (Aprova: ${weekCounts.Aprova}, Desaprova: ${weekCounts.Desaprova}, Neutro: ${weekCounts.Neutro})`;
  document.getElementById('weekModalTitle').textContent =
    `Análise da semana ${formatWeekRange(weekStartISO)}`;
}

function computeWeekCounts(data, weekStartISO) {
  const start = new Date(`${weekStartISO}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7); // [start, end)

  const counts = { Aprova: 0, Desaprova: 0, Neutro: 0 };
  for (const item of data) {
    const ts = item.timestamp || item.data_postagem;
    if (!ts) continue;
    const d = new Date(ts);
    if (isNaN(d)) continue;
    if (d >= start && d < end) {
      const label = (item.new_BERT ?? 0).toString();
      if (label === '1') counts.Aprova++;
      else if (label === '-1') counts.Desaprova++;
      else counts.Neutro++;
    }
  }
  const total = counts.Aprova + counts.Desaprova + counts.Neutro;
  return { ...counts, total };
}

function getBootstrapCI(metricType, klass) {
  // klass: 'Aprova' | 'Desaprova' | 'Neutro'
  const map = { Aprova: '1', Desaprova: '2', Neutro: '0' };
  const key = `${metricType}_class_${map[klass]}`;
  const m = bootstrapData.find(d => d[""] === key);
  if (!m) return { mean: 0, plus: 0, minus: 0 };
  return {
    mean: m.mean,
    plus: Math.max(0, m.upper_95_ci - m.mean),
    minus: Math.max(0, m.mean - m.lower_95_ci)
  };
}

function openWeekModal() {
  const modal = document.getElementById('weekModal');
  modal.style.display = 'flex';

  // listeners (uma única vez é suficiente, mas deixo idempotente)
  document.getElementById('modalCloseBtn').onclick = closeWeekModal;
  modal.onclick = (e) => { if (e.target === modal) closeWeekModal(); };
  document.addEventListener('keydown', escToClose);
  const sel = document.getElementById('weekMetricSelect');
  sel.onchange = () => renderWeekModalChart(sel.value);
}
function closeWeekModal() {
  const modal = document.getElementById('weekModal');
  modal.style.display = 'none';
  document.removeEventListener('keydown', escToClose);
  // limpa gráfico
  Plotly.purge('weekModalChart');
}
function escToClose(e) { if (e.key === 'Escape') closeWeekModal(); }


function renderWeekModalChart(metricType) {
  if (!weekCounts || !currentWeekISO) return;

  const labels = ['Aprova', 'Desaprova', 'Neutro'];
  const colors = {
    'Aprova': CLASS_MAP['1'].color,
    'Desaprova': CLASS_MAP['-1'].color,
    'Neutro': CLASS_MAP['0'].color
  };

  // proporções da semana (0–1) para comparar com IC do modelo
  const total = Math.max(1, weekCounts.total);
  const props = [
    weekCounts.Aprova / total,
    weekCounts.Desaprova / total,
    weekCounts.Neutro / total
  ];

  // CIs do modelo (independentes da semana; medem incerteza do classificador)
  const plus  = labels.map(k => getBootstrapCI(metricType, k).plus);
  const minus = labels.map(k => getBootstrapCI(metricType, k).minus);

  const trace = {
    type: 'bar',
    x: labels,
    y: props,
    marker: { color: labels.map(l => colors[l]), line: { color: 'rgba(0,0,0,0.15)', width: 1 }},
    error_y: {
      type: 'data',
      array: plus,
      arrayminus: minus,
      visible: true,
      thickness: 1.6,
      width: 8,
      color: 'rgba(30,41,59,0.95)'
    },
    hovertemplate:
      '%{x}<br>' +
      `Proporção na semana: %{y:.3f}<br>` +
      `${metricType.toUpperCase()} IC95% do modelo: +%{customdata[0]:.3f} / -%{customdata[1]:.3f}<extra></extra>`,
    customdata: plus.map((p, i) => [p, minus[i]])
  };

  const layout = {
    title: { text: `Composição da semana ${formatWeekRange(currentWeekISO)}`, x: 0.02, y: 0.98, xanchor: 'left' },
    margin: { t: 48, r: 16, b: 56, l: 56 },
    yaxis: { title: 'Proporção (0–1)', range: [0,1], gridcolor: 'rgba(0,0,0,0.06)' },
    xaxis: { tickangle: -5 },
    showlegend: false,
    bargap: 0.35
  };
  const config = { responsive: true, displayModeBar: false };

  Plotly.newPlot('weekModalChart', [trace], layout, config);
}



init();
