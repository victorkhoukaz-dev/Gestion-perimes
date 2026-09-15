// Canvas labels need a redraw: CSS alone cannot change Chart.js text.
(() => {
    let restoreCharts = [];
    window.addEventListener('beforeprint', () => {
        if (restoreCharts.length || !window.Chart) return;
        document.querySelectorAll('canvas').forEach(canvas => {
            const chart = Chart.getChart(canvas);
            if (!chart) return;
            chart.stop();
            const original = chart.config.options;
            const options = { ...original, animation: false };
            if (original.plugins?.legend?.labels) {
                options.plugins = { ...original.plugins, legend: {
                    ...original.plugins.legend,
                    labels: { ...original.plugins.legend.labels, color: '#334155' }
                } };
            }
            if (original.scales) {
                options.scales = Object.fromEntries(Object.entries(original.scales).map(([id, scale]) => [id, {
                    ...scale,
                    ticks: { ...scale.ticks, color: '#334155' },
                    grid: { ...scale.grid, color: '#cbd5e1' }
                }]));
            }
            chart.config.options = options;
            restoreCharts.push(() => {
                chart.config.options = original;
                chart.resize();
                chart.update('none');
            });
            const bounds = canvas.parentElement.getBoundingClientRect();
            chart.resize(bounds.width, bounds.height);
            chart.update('none');
        });
    });
    window.addEventListener('afterprint', () => {
        restoreCharts.forEach(restore => restore());
        restoreCharts = [];
    });
})();
