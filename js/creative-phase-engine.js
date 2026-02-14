/* ========================================
   Life OS - Creative Phase Detector
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
        var ts = new Date(value).getTime();
        if (!Number.isFinite(ts)) return null;
        return new Date(ts).toISOString().slice(0, 10);
    }

    function daysSince(value, nowTs) {
        var ts = new Date(value).getTime();
        if (!Number.isFinite(ts)) return null;
        return Math.max(0, Math.floor((nowTs - ts) / (24 * 60 * 60 * 1000)));
    }

    function normalizeSeries(history, derivedState) {
        var hist = safeObject(history);
        var map = Object.create(null);

        safeArray(hist.compassDailyLog).forEach(function (entry) {
            var key = toDateKey(entry && entry.date);
            if (!key) return;
            if (!map[key]) {
                map[key] = { date: key, output: 0, journal: 0 };
            }

            var outcome = String(entry && entry.outcome || '').toLowerCase();
            if (outcome === 'yes') map[key].output += 1;
            else if (outcome === 'little') map[key].output += 0.45;
        });

        safeArray(hist.journalEntries).forEach(function (entry) {
            var key = toDateKey(entry && entry.date);
            if (!key) return;
            if (!map[key]) {
                map[key] = { date: key, output: 0, journal: 0 };
            }
            map[key].journal += 1;
        });

        var out = Object.keys(map).sort().map(function (key) {
            return {
                date: key,
                output: clamp(map[key].output, 0, 5),
                journal: clamp(map[key].journal, 0, 10)
            };
        });

        if (!out.length) {
            out.push({
                date: new Date().toISOString().slice(0, 10),
                output: clamp(Number(safeObject(derivedState).metrics && safeObject(derivedState).metrics.creativeMomentum) * 1.2, 0, 2),
                journal: 0
            });
        }

        return out.slice(-120);
    }

    function slope(series, key, days) {
        if (!series.length) return 0;
        var count = Math.max(2, Math.min(days, series.length));
        var window = series.slice(series.length - count);
        var mid = Math.floor(window.length / 2);
        var first = window.slice(0, mid);
        var second = window.slice(mid);

        var firstAvg = first.length
            ? first.reduce(function (sum, item) { return sum + (Number(item[key]) || 0); }, 0) / first.length
            : 0;
        var secondAvg = second.length
            ? second.reduce(function (sum, item) { return sum + (Number(item[key]) || 0); }, 0) / second.length
            : 0;

        return clamp(secondAvg - firstAvg, -1, 1);
    }

    function mean(series, key, days) {
        if (!series.length) return 0;
        var count = Math.max(1, Math.min(days, series.length));
        var window = series.slice(series.length - count);
        return window.reduce(function (sum, item) {
            return sum + (Number(item[key]) || 0);
        }, 0) / window.length;
    }

    function hasReleaseSignal(v2Data, history) {
        var v2 = safeObject(v2Data);
        var releasing = safeArray(safeObject(v2.creativeCompass).projects).some(function (project) {
            var stage = String(project && project.stage || '').toUpperCase();
            return stage === 'RELEASING';
        });
        if (releasing) return true;

        var bizContent = safeObject(v2.bizContent);
        if ((Number(bizContent.piecesFinished) || 0) > 0) return true;

        return safeArray(history.compassDailyLog).some(function (entry) {
            return String(entry && entry.outcome || '').toLowerCase() === 'yes';
        });
    }

    function computeCreativePhaseState(v2Data, derivedState, history) {
        var nowTs = Date.now();
        var series = normalizeSeries(history, derivedState);

        var outputVelocity = round(clamp(slope(series, 'output', 30), -1, 1), 3);
        var outputRecent = clamp(mean(series, 'output', 14) / 1.2, 0, 1);
        var journalRecent = clamp(mean(series, 'journal', 14) / 2, 0, 1);
        var ideaDensity = round(clamp((journalRecent * 0.62) + (outputRecent * 0.38), 0, 1), 3);

        var lastOutputDays = null;
        for (var i = series.length - 1; i >= 0; i -= 1) {
            if ((Number(series[i].output) || 0) > 0) {
                lastOutputDays = daysSince(series[i].date, nowTs);
                break;
            }
        }
        if (lastOutputDays == null) lastOutputDays = 30;

        var stagnationRisk = clamp(
            ((1 - outputRecent) * 0.5) +
            (Math.min(30, lastOutputDays) / 30 * 0.35) +
            (Math.max(0, -outputVelocity) * 0.15),
            0,
            1
        );

        var phase = 'EXPLORATION';
        var releaseSignal = hasReleaseSignal(v2Data, history);

        if (stagnationRisk >= 0.78) {
            phase = 'REST';
        } else if (outputRecent <= 0.25 && journalRecent >= 0.5) {
            phase = 'INCUBATION';
        } else if (releaseSignal && outputRecent >= 0.5 && outputVelocity >= 0) {
            phase = 'RELEASE';
        } else if (outputVelocity >= 0.2 && outputRecent >= 0.48) {
            phase = 'PRODUCTION';
        } else if (outputRecent >= 0.45 && outputVelocity > -0.05 && outputVelocity < 0.2) {
            phase = 'REFINEMENT';
        } else if (journalRecent >= 0.35) {
            phase = 'EXPLORATION';
        }

        return {
            phase: phase,
            stagnationRisk: round(stagnationRisk, 3),
            outputVelocity: outputVelocity,
            ideaDensity: ideaDensity
        };
    }

    global.CreativePhaseEngine = Object.freeze({
        version: '1.0',
        computeCreativePhaseState: computeCreativePhaseState
    });
})(window);
