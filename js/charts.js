function plotOperationChart(data) {
    const opCounts = {};
    data.forEach(row => {
        const op = row.operation;
        if (op) opCounts[op] = (opCounts[op] || 0) + 1;
    });

    const opsSorted = Object.entries(opCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const ops = opsSorted.map(([op]) => op);
    const counts = opsSorted.map(([_, count]) => count);

    const ctx = document.getElementById('opChart').getContext('2d');
    if (window.opChartInstance) window.opChartInstance.destroy();
    window.opChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ops,
            datasets: [{
                label: '',
                data: counts,
                backgroundColor: 'rgba(30, 64, 175, 0.7)',
                borderColor: 'rgba(30, 64, 175, 1)',
                borderWidth: 2,
                hoverBackgroundColor: 'rgba(16, 185, 129, 0.7)',
                hoverBorderColor: 'rgba(16, 185, 129, 1)'
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    title: { display: false },
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#334155' }
                },
                y: {
                    title: { display: false },
                    grid: { color: '#e2e8f0' },
                    ticks: {
                        color: '#334155',
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

function plotDateChart(data) {
    const dateCounts = {};
    data.forEach(row => {
        const dateStr = row.data_postagem;
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d)) {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                dateCounts[key] = (dateCounts[key] || 0) + 1;
            }
        }
    });

    const dates = Object.keys(dateCounts).sort();
    const counts = dates.map(d => dateCounts[d]);

    const ctx = document.getElementById('dateChart').getContext('2d');
    if (window.dateChartInstance) window.dateChartInstance.destroy();
    window.dateChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: '',
                data: counts,
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: 'rgba(30, 64, 175, 1)',
                pointBorderColor: 'rgba(30, 64, 175, 1)',
                pointRadius: 5
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            responsive: true,
            scales: {
                x: {
                    title: { display: false },
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#334155' }
                },
                y: {
                    title: { display: false },
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#334155' }
                }
            }
        }
    });
}

function plotStackedYearChart(data) {
    const opMap = {}; // operação → [datas de postagem]
    data.forEach(row => {
        const op = row.operation;
        const dateStr = row.data_postagem;
        if (!op || !dateStr) return;
        if (!opMap[op]) opMap[op] = [];
        opMap[op].push(new Date(dateStr));
    });

    const yearStats = {};
    for (const op in opMap) {
        const dates = opMap[op];
        const isMultiple = dates.length > 1;
        dates.forEach(d => {
            if (isNaN(d)) return;
            const year = d.getFullYear();
            if (!yearStats[year]) yearStats[year] = { únicos: 0, múltiplos: 0 };
            if (isMultiple) yearStats[year].múltiplos += 1;
            else yearStats[year].únicos += 1;
        });
    }

    const years = Object.keys(yearStats).sort();
    const uniques = years.map(y => yearStats[y].únicos);
    const multiples = years.map(y => yearStats[y].múltiplos);

    const ctx = document.getElementById("yearStackedChart").getContext("2d");
    if (window.yearStackedChartInstance) window.yearStackedChartInstance.destroy();
    window.yearStackedChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Únicos',
                    data: uniques,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    stack: 'videos'
                },
                {
                    label: 'Múltiplos',
                    data: multiples,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    stack: 'videos'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Distribuição de Vídeos por Ano' }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: '#334155' },
                    grid: { color: '#e2e8f0' }
                },
                y: {
                    stacked: true,
                    ticks: { color: '#334155' },
                    grid: { color: '#e2e8f0' }
                }
            }
        }
    });
}

function plotMetricsComparison(metricsData, metricName = 'pre') {
    const labels = {
        pre: 'Precisão por técnica e cenário',
        rev: 'Revocação por técnica e cenário'
    };

    const explicacoes = {
        pre: 'A precisão mede quantas vezes o modelo acertou em relação ao total de vezes que ele tentou acertar.',
        rev: 'A revocação mede quantos acertos o modelo teve em relação ao total de acertos que ele deveria ter feito.'
    };

    const cenarios = [...new Set(metricsData.map(d => d.cenario))];
    const tecnicas = ['HT', 'HS', 'GPT'];

    const datasets = tecnicas.map((tec, idx) => {
        return {
            label: tec,
            data: cenarios.map(cen => {
                const row = metricsData.find(d => d.cenario === cen && d.tecnica === tec);
                return row ? row[metricName] : 0;
            }),
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'][idx]
        };
    });

    const ctx = document.getElementById("metricsChart").getContext("2d");
    if (window.metricsChartInstance) window.metricsChartInstance.destroy();
    window.metricsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: cenarios,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: labels[metricName]
                }
            },
            scales: {
                x: {
                    stacked: false,
                    ticks: { color: '#334155' },
                    grid: { color: '#e2e8f0' }
                },
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: { color: '#334155' },
                    grid: { color: '#e2e8f0' }
                }
            }
        }
    });

    // Exibe o texto explicativo
    const descEl = document.getElementById("metricDescription");
    if (descEl) descEl.textContent = explicacoes[metricName];
}
