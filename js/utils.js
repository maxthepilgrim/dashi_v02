/* ========================================
   Life Dashboard - Utilities
   ======================================== */

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function animateNumber(el, target, suffix = '', duration = 1200) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
        const value = Math.round(start + (target - start) * eased);
        el.textContent = value.toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function animateFloat(el, target, decimals = 1, suffix = '', duration = 1200) {
    if (!el) return;
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = (target * eased).toFixed(decimals);
        el.textContent = value + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function getCategoryColor(cat) {
    const colors = {
        fitness: '#ff8a8a',
        finance: '#ffd700',
        growth: '#a8e6cf',
        mindfulness: '#a0c4ff',
        health: '#ffb3c6',
        work: '#ffffff'
    };
    return colors[cat?.toLowerCase()] || '#a8e6cf';
}
