const query = new URLSearchParams(window.location.search);
const datasetKey = query.get('dataset');

const datasetMap = {
  todos: {
    title: "Todos eventos",
    file: "no_transcription/videos_operations_combined.json",
    metric_cenario: "Todos eventos (sem transcrição)"
  },
  esparsos: {
    title: "Eventos esparsos",
    file: "no_transcription/videos_pre_2024.json",
    metric_cenario: "Eventos esparsos (sem transcrição)"
  },
  alta: {
    title: "Alta repercussão",
    file: "no_transcription/videos_2024_onwards.json",
    metric_cenario: "Alta repercussão (sem transcrição)"
  },
};

const config = datasetMap[datasetKey];

if (!config) {
  document.body.innerHTML = "<p style='padding:20px'>Dataset não encontrado na URL. Verifique o parâmetro <code>?dataset=</code>.</p>";
  throw new Error("Dataset inválido");
}

document.getElementById("datasetTitle").textContent = config.title;

// Função auxiliar para normalizar texto (remover acentos e capitalização)
function normalize(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

fetch(`data/${config.file}`)
  .then(res => res.json())
  .then(data => {
    renderStats(data);
    renderCharts(data);

    // depois de carregar os dados, carrega também o gráfico de métricas
    fetch("data/metrics_comparison.json")
      .then(res => res.json())
      .then(metrics => {
        // controle de troca entre precisão e revocação
        const metricSelector = document.createElement("select");
        
        metricSelector.innerHTML = `
          <option value="pre">Precisão</option>
          <option value="rev">Revocação</option>
        `;
        metricSelector.addEventListener("change", () => {
          const selected = metricSelector.value;
          renderMetricChart(metrics, config.metric_cenario, selected);
        });

        const desc = document.createElement("div");
        desc.id = "metricDescription";
        desc.style.margin = "10px 0";

        const container = document.getElementById("charts");
        container.appendChild(metricSelector);
        container.appendChild(desc);

        const canvas = document.createElement("canvas");
        canvas.id = "metricsChart";
        container.appendChild(canvas);

        renderMetricChart(metrics, config.metric_cenario, "pre");
      });
  })
  .catch(err => {
    document.body.innerHTML = `<p style="padding:20px; color:red;">Erro ao carregar dados: ${err.message}</p>`;
  });

function renderStats(data) {
  const totalNoticias = data.length;
  const uniqueOps = new Set(data.map(d => d.operation)).size;
  const media = (totalNoticias / uniqueOps).toFixed(2);

  const dates = data.map(d => new Date(d.data_postagem));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  const container = document.getElementById('statsCards');
  container.innerHTML = `
    <div class="card">📰 Total de Notícias: <strong>${totalNoticias}</strong></div>
    <div class="card">📂 Operações únicas: <strong>${uniqueOps}</strong></div>
    <div class="card">📊 Média por operação: <strong>${media}</strong></div>
    <div class="card">📅 Período: <strong>${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}</strong></div>
  `;
}

function renderCharts(data) {
  const countsPorOp = {};
  const countsPorMes = {};
  const countsAnoTipo = {};

  data.forEach(d => {
    const op = d.operation;
    const date = new Date(d.data_postagem);
    const year = date.getFullYear();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    countsPorOp[op] = (countsPorOp[op] || 0) + 1;
    countsPorMes[key] = (countsPorMes[key] || 0) + 1;

    const tipo = data.filter(i => i.operation === d.operation).length > 1 ? "múltiplos" : "único";
    if (!countsAnoTipo[year]) countsAnoTipo[year] = { único: 0, múltiplos: 0 };
    countsAnoTipo[year][tipo]++;
  });

  const chartsDiv = document.getElementById('charts');

  // gráfico 1: por operação (top 20)
  const opsSorted = Object.entries(countsPorOp).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const opLabels = opsSorted.map(e => e[0]);
  const opData = opsSorted.map(e => e[1]);

  const chart1 = document.createElement('canvas');
  chartsDiv.appendChild(chart1);
  new Chart(chart1, {
    type: 'bar',
    data: {
      labels: opLabels,
      datasets: [{
        data: opData,
        backgroundColor: 'rgba(30, 64, 175, 0.7)',
        borderColor: 'rgba(30, 64, 175, 1)',
        borderWidth: 2
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      indexAxis: 'y'
    }
  });

  // gráfico 2: por mês
  const meses = Object.keys(countsPorMes).sort();
  const mesData = meses.map(m => countsPorMes[m]);

  const chart2 = document.createElement('canvas');
  chartsDiv.appendChild(chart2);
  new Chart(chart2, {
    type: 'line',
    data: {
      labels: meses,
      datasets: [{
        data: mesData,
        borderColor: '#0f79ba',
        backgroundColor: 'rgba(15,121,186,0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true
    }
  });

  // gráfico 3: empilhado por ano
  const anos = Object.keys(countsAnoTipo).sort();
  const dadosUnicos = anos.map(ano => countsAnoTipo[ano].único);
  const dadosMultiplos = anos.map(ano => countsAnoTipo[ano].múltiplos);

  const chart3 = document.createElement('canvas');
  chartsDiv.appendChild(chart3);
  new Chart(chart3, {
    type: 'bar',
    data: {
      labels: anos,
      datasets: [
        {
          label: "Eventos únicos",
          data: dadosUnicos,
          backgroundColor: "#97C6D3"
        },
        {
          label: "Eventos com múltiplos vídeos",
          data: dadosMultiplos,
          backgroundColor: "#395FA1"
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Distribuição de eventos por ano"
        }
      },
      responsive: true,
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  });
}

function renderMetricChart(metrics, cenario, tipo = "pre") {
  const metricDesc = {
    pre: "A precisão mede quantas vezes o modelo acertou entre todas as vezes que tentou acertar.",
    rev: "A revocação mede quantas vezes o modelo encontrou o que deveria encontrar."
  };
  const container = document.getElementById("metricDescription");
  container.textContent = metricDesc[tipo] || "";

  const filteredMetrics = metrics.filter(m =>
    normalize(m.cenario) === normalize(cenario)
  );

  const labels = filteredMetrics.map(m => m.tecnica);
  const values = filteredMetrics.map(m => m[tipo]);

  const canvas = document.getElementById("metricsChart");
  if (!canvas) return;

  if (window.metricChartInstance) {
    window.metricChartInstance.destroy();
  }

  window.metricChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: tipo === "pre" ? "Precisão" : "Revocação",
        data: values,
        backgroundColor: "#0f79ba"
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1
        }
      }
    }
  });
}
