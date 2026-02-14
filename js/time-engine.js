/* ========================================
   Life OS - Time Intelligence Engine
   ======================================== */

(function (global) {
    'use strict';

    function clamp(value, min, max) {
        var num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function round(value, digits) {
        var factor = Math.pow(10, digits || 3);
        return Math.round((Number(value) || 0) * factor) / factor;
    }

    function safeObject(value) {
        return value && typeof value === 'object' ? value : {};
    }

    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function toDateKey(value) {
        if (!value) return null;
        var d = new Date(value);
        if (!Number.isFinite(d.getTime())) return null;
        return d.toISOString().slice(0, 10);
    }

    function getNodeScore(derivedState, nodeName, metricName, fallback) {
        var derived = safeObject(derivedState);
        var nodes = safeObject(derived.nodes);
        var metrics = safeObject(derived.metrics);

        if (nodes[nodeName] && Number.isFinite(Number(nodes[nodeName].score))) {
            return clamp(nodes[nodeName].score, 0, 1);
        }
        if (Number.isFinite(Number(metrics[metricName]))) {
            return clamp(metrics[metricName], 0, 1);
        }
        return clamp(fallback, 0, 1);
    }

    function dayRecordFromDerived(derivedState) {
        var derived = safeObject(derivedState);
        var metrics = safeObject(derived.metrics);
        var signals = safeObject(derived.signals);

        var lifePulse = clamp(Number(metrics.lifePulse), 0, 100);
        var stress = clamp(Number(signals.stress != null ? signals.stress : metrics.stressScore), 0, 1);
        var energy = getNodeScore(derived, 'health', 'healthScore', 0.5);
        var rhythm = getNodeScore(derived, 'rhythm', 'rhythmScore', 0.5);
        var creativeMomentum = getNodeScore(derived, 'creative', 'creativeMomentum', 0.5);
        var financeScore = getNodeScore(derived, 'finance', 'financeScore', 0.5);

        return {
            date: new Date().toISOString().slice(0, 10),
            lifePulse: lifePulse,
            stress: stress,
            energy: energy,
            rhythm: rhythm,
            creativeMomentum: creativeMomentum,
            financeScore: financeScore
        };
    }

    function normalizeDailySeries(history, derivedState) {
        var hist = safeObject(history);
        var out = [];

        safeArray(hist.dailySeries).forEach(function (item) {
            var record = safeObject(item);
            var dateKey = toDateKey(record.date);
            if (!dateKey) return;

            out.push({
                date: dateKey,
                lifePulse: clamp(record.lifePulse, 0, 100),
                stress: clamp(record.stress, 0, 1),
                energy: clamp(record.energy, 0, 1),
                rhythm: clamp(record.rhythm, 0, 1),
                creativeMomentum: clamp(record.creativeMomentum, 0, 1),
                financeScore: clamp(record.financeScore, 0, 1)
            });
        });

        if (!out.length) {
            out.push(dayRecordFromDerived(derivedState));
        }

        out.sort(function (a, b) {
            return a.date.localeCompare(b.date);
        });

        var today = dayRecordFromDerived(derivedState);
        if (out[out.length - 1].date !== today.date) {
            out.push(today);
        } else {
            out[out.length - 1] = {
                date: today.date,
                lifePulse: today.lifePulse,
                stress: today.stress,
                energy: today.energy,
                rhythm: today.rhythm,
                creativeMomentum: today.creativeMomentum,
                financeScore: today.financeScore
            };
        }

        return out.slice(-370);
    }

    function compositeMomentumPoint(record) {
        var lifeComponent = clamp(record.lifePulse / 100, 0, 1);
        return clamp(
            (lifeComponent * 0.38) +
            (record.creativeMomentum * 0.22) +
            (record.financeScore * 0.2) +
            ((1 - record.stress) * 0.2),
            0,
            1
        );
    }

    function sliceWindow(series, days) {
        if (!series.length) return [];
        var count = Math.max(2, Math.min(days, series.length));
        return series.slice(series.length - count);
    }

    function average(values) {
        if (!values.length) return 0;
        var total = values.reduce(function (sum, value) {
            return sum + (Number(value) || 0);
        }, 0);
        return total / values.length;
    }

    function windowSlope(windowValues) {
        if (!windowValues.length) return 0;
        if (windowValues.length < 3) {
            return clamp(windowValues[windowValues.length - 1] - windowValues[0], -1, 1);
        }

        var mid = Math.floor(windowValues.length / 2);
        var firstHalf = windowValues.slice(0, mid);
        var secondHalf = windowValues.slice(mid);

        if (!firstHalf.length || !secondHalf.length) {
            return clamp(windowValues[windowValues.length - 1] - windowValues[0], -1, 1);
        }

        return clamp(average(secondHalf) - average(firstHalf), -1, 1);
    }

    function momentumForWindow(series, days) {
        var window = sliceWindow(series, days);
        var values = window.map(compositeMomentumPoint);
        return round(windowSlope(values), 3);
    }

    function featureSlope(series, days, key) {
        var window = sliceWindow(series, days);
        var values = window.map(function (item) {
            return clamp(item[key], 0, 1);
        });
        return round(windowSlope(values), 3);
    }

    function classifyTrend(momentum30, momentum90) {
        var weighted = (momentum30 * 0.6) + (momentum90 * 0.4);
        if (weighted >= 0.08) return 'UP';
        if (weighted <= -0.08) return 'DOWN';
        return 'FLAT';
    }

    function classifyPhase(inputs) {
        if (inputs.burnoutRisk >= 0.72) return 'RECOVER';
        if (inputs.momentum30 >= 0.24 && inputs.financeNow >= 0.62) return 'HARVEST';
        if (inputs.momentum90 >= 0.1 || (inputs.momentum30 > 0.06 && inputs.lifePulseNow >= 60)) return 'BUILD';
        if (inputs.momentum30 <= -0.14 || inputs.lifePulseNow <= 42) return 'RECOVER';
        return 'EXPLORE';
    }

    function computeBurnoutRisk(series, derivedState) {
        var derived = safeObject(derivedState);
        var signals = safeObject(derived.signals);
        var metrics = safeObject(derived.metrics);

        var stressNow = clamp(Number(signals.stress != null ? signals.stress : metrics.stressScore), 0, 1);
        var energySlope = featureSlope(series, 30, 'energy');
        var rhythmSlope = featureSlope(series, 30, 'rhythm');

        var risk =
            (stressNow * 0.58) +
            (Math.max(0, -energySlope) * 0.24) +
            (Math.max(0, -rhythmSlope) * 0.18);

        return round(clamp(risk, 0, 1), 3);
    }

    function computeTimeState(v2Data, derivedState, history) {
        var series = normalizeDailySeries(history, derivedState);

        var momentum30 = momentumForWindow(series, 30);
        var momentum90 = momentumForWindow(series, 90);
        var momentum365 = momentumForWindow(series, 365);

        var burnoutRisk = computeBurnoutRisk(series, derivedState);
        var trend = classifyTrend(momentum30, momentum90);

        var latest = series[series.length - 1] || dayRecordFromDerived(derivedState);
        var phase = classifyPhase({
            burnoutRisk: burnoutRisk,
            momentum30: momentum30,
            momentum90: momentum90,
            financeNow: clamp(latest.financeScore, 0, 1),
            lifePulseNow: clamp(latest.lifePulse, 0, 100)
        });

        return {
            phase: phase,
            momentum30: round(clamp(momentum30, -1, 1), 3),
            momentum90: round(clamp(momentum90, -1, 1), 3),
            momentum365: round(clamp(momentum365, -1, 1), 3),
            burnoutRisk: round(clamp(burnoutRisk, 0, 1), 3),
            trend: trend
        };
    }

    global.TimeEngine = Object.freeze({
        version: '1.0',
        computeTimeState: computeTimeState
    });
})(window);
