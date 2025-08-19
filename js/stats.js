function updateStats(data) {
    const total = data.length;
    const statTotalEl = document.getElementById('statTotal');
    if (statTotalEl) statTotalEl.textContent = total;

    const opSet = new Set();
    data.forEach(row => {
        const op = row.operation;
        if (op) opSet.add(op);
    });

    const statOpsEl = document.getElementById('statOps');
    if (statOpsEl) statOpsEl.textContent = opSet.size;

    const media = opSet.size ? (total / opSet.size).toFixed(2) : '-';
    const statMediaEl = document.getElementById('statMedia');
    if (statMediaEl) statMediaEl.textContent = media;

    let minDate = null, maxDate = null;
    data.forEach(row => {
        const dt = row.data_postagem;
        if (dt) {
            const d = new Date(dt);
            if (!isNaN(d)) {
                if (!minDate || d < minDate) minDate = d;
                if (!maxDate || d > maxDate) maxDate = d;
            }
        }
    });

    const period = minDate && maxDate
        ? `${minDate.toLocaleDateString()} a ${maxDate.toLocaleDateString()}`
        : '-';

    const statPeriodEl = document.getElementById('statPeriod');
    if (statPeriodEl) statPeriodEl.textContent = period;

    // Duração média das operações
    const opDurations = [];
    const opMap = {};

    data.forEach(row => {
        const op = row.operation;
        const dtStr = row.data_postagem;
        if (!op || !dtStr) return;
        const d = new Date(dtStr);
        if (isNaN(d)) return;

        if (!opMap[op]) opMap[op] = { min: d, max: d };
        else {
            if (d < opMap[op].min) opMap[op].min = d;
            if (d > opMap[op].max) opMap[op].max = d;
        }
    });

    for (const op in opMap) {
        const diffDays = Math.round((opMap[op].max - opMap[op].min) / (1000 * 60 * 60 * 24));
        opDurations.push(diffDays);
    }

    let avgDuration = "-";
    if (opDurations.length > 0) {
        avgDuration = (opDurations.reduce((a, b) => a + b, 0) / opDurations.length).toFixed(1);
    }

    const statDuracaoEl = document.getElementById('statDuracaoMedia');
    if (statDuracaoEl) statDuracaoEl.textContent = avgDuration;
}
