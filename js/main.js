let allData = [];
let opChartInstance = null;
let dateChartInstance = null;
let yearStackedChartInstance = null;

function showError(msg) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.className = 'error';
        statusEl.textContent = msg;
    }
    const statsCardsEl = document.getElementById('statsCards');
    if (statsCardsEl) statsCardsEl.style.display = 'none';
    const chartsEl = document.querySelector('.dashboard-charts');
    if (chartsEl) chartsEl.style.display = 'none';
}

function showDashboard() {
    document.getElementById('status').style.display = 'none';
    document.getElementById('statsCards').style.display = '';
    document.querySelector('.dashboard-charts').style.display = '';
}

function updateCharts() {
    plotOperationChart(allData);
    plotDateChart(allData);
    plotStackedYearChart(allData);
    showDashboard();
}

window.addEventListener('DOMContentLoaded', function () {
    fetch('data/videos_operations_combined.json')
        .then(response => {
            if (!response.ok) throw new Error('Arquivo não encontrado');
            return response.json();
        })
        .then(jsonData => {
            try {
                document.getElementById('status').className = 'loading';
                document.getElementById('status').textContent = "Carregando dados...";
                allData = jsonData;
                if (!allData || allData.length === 0) {
                    showError("Nenhum dado encontrado no arquivo JSON.");
                    return;
                }
                updateStats(allData);
                updateCharts();
            } catch (err) {
                showError("Erro ao ler o arquivo JSON: " + err.message);
            }
        })
        .catch(err => {
            showError("Erro ao carregar o arquivo JSON: " + err.message);
        });
    
    // Carrega métricas comparativas de heurísticas
    let metricDataCache = [];

    fetch('data/metrics_comparison.json')
        .then(resp => resp.json())
        .then(metrics => {
            metricDataCache = metrics;
            plotMetricsComparison(metricDataCache, 'pre');

            // Atualiza ao trocar o seletor
            const selector = document.getElementById('metricSelector');
            if (selector) {
                selector.addEventListener('change', (e) => {
                    const metric = e.target.value;
                    plotMetricsComparison(metricDataCache, metric);
                });
            }
        })
        .catch(err => {
            console.error("Erro ao carregar métricas de comparação:", err);
        });

});
