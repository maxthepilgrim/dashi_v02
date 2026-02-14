/* ========================================
   Life OS - Attention Engine
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

    function countLateEvents(timestamps, dayWindow) {
        var now = Date.now();
        var minTs = now - (Math.max(1, dayWindow) * 24 * 60 * 60 * 1000);

        var late = 0;
        safeArray(timestamps).forEach(function (value) {
            var ts = new Date(value).getTime();
            if (!Number.isFinite(ts) || ts < minTs || ts > now) return;
            var hour = new Date(ts).getHours();
            if (hour >= 22 || hour <= 4) late += 1;
        });

        return late;
    }

    function getDerivedEnergy(derivedState) {
        var derived = safeObject(derivedState);
        var nodes = safeObject(derived.nodes);
        var metrics = safeObject(derived.metrics);

        if (nodes.health && Number.isFinite(Number(nodes.health.score))) {
            return clamp(nodes.health.score, 0, 1);
        }
        if (Number.isFinite(Number(metrics.healthScore))) {
            return clamp(metrics.healthScore, 0, 1);
        }
        return 0.5;
    }

    function getDerivedStress(derivedState) {
        var derived = safeObject(derivedState);
        var signals = safeObject(derived.signals);
        var metrics = safeObject(derived.metrics);
        if (Number.isFinite(Number(signals.stress))) return clamp(signals.stress, 0, 1);
        if (Number.isFinite(Number(metrics.stressScore))) return clamp(metrics.stressScore, 0, 1);
        return 0.5;
    }

    function getDerivedRhythm(derivedState) {
        var derived = safeObject(derivedState);
        var metrics = safeObject(derived.metrics);
        if (Number.isFinite(Number(metrics.rhythmScore))) return clamp(metrics.rhythmScore, 0, 1);
        return 0.5;
    }

    function sumRecent(values, daysWindow) {
        var now = Date.now();
        var minTs = now - (Math.max(1, daysWindow) * 24 * 60 * 60 * 1000);
        var total = 0;

        safeArray(values).forEach(function (item) {
            var rec = safeObject(item);
            var ts = new Date(rec.date || rec.timestamp || rec.day).getTime();
            if (!Number.isFinite(ts)) return;
            if (ts < minTs || ts > now) return;
            total += Math.max(0, Number(rec.minutes) || Number(rec.value) || 0);
        });

        return total;
    }

    function deriveDeepWorkFromCompass(history) {
        var total = 0;

        safeArray(history.compassDailyLog).forEach(function (entry) {
            var outcome = String(entry && entry.outcome || '').toLowerCase();
            if (outcome === 'yes') total += 25;
            else if (outcome === 'little') total += 10;
        });

        return total;
    }

    function computeAttentionState(v2Data, derivedState, history) {
        var hist = safeObject(history);

        var deepWorkMinutes = Number(hist.deepWorkMinutes7d);
        if (!Number.isFinite(deepWorkMinutes) || deepWorkMinutes < 0) {
            deepWorkMinutes = sumRecent(hist.deepWorkEntries, 7);
        }
        if (!Number.isFinite(deepWorkMinutes) || deepWorkMinutes < 0) {
            deepWorkMinutes = deriveDeepWorkFromCompass(hist);
        }
        deepWorkMinutes = Math.max(0, deepWorkMinutes);

        var adminMinutes = Number(hist.adminMinutes7d);
        if (!Number.isFinite(adminMinutes) || adminMinutes < 0) {
            adminMinutes = sumRecent(hist.adminEntries, 7);
        }
        adminMinutes = Math.max(0, adminMinutes);

        var denominator = deepWorkMinutes + adminMinutes;
        if (denominator <= 0) denominator = 1;

        var deepWorkRatio = clamp(deepWorkMinutes / denominator, 0, 1);
        var adminRatio = clamp(adminMinutes / denominator, 0, 1);

        var contextSwitchRisk = clamp(((1 - deepWorkRatio) * 0.62) + (adminRatio * 0.38), 0, 1);

        var energy = getDerivedEnergy(derivedState);
        var stress = getDerivedStress(derivedState);
        var rhythm = getDerivedRhythm(derivedState);

        var lateCount = countLateEvents(hist.lateActivityTimestamps, 7);
        var lateRate = clamp(lateCount / 7, 0, 1);
        var lateStimulusRisk = clamp((lateRate * 0.72) + ((1 - energy) * 0.28), 0, 1);

        var fatigueRisk = clamp(((1 - energy) * 0.57) + (stress * 0.3) + ((1 - rhythm) * 0.13), 0, 1);

        var integrity = clamp(
            (deepWorkRatio * 0.44) +
            ((1 - contextSwitchRisk) * 0.24) +
            ((1 - lateStimulusRisk) * 0.16) +
            ((1 - fatigueRisk) * 0.16),
            0,
            1
        );

        var leakSource = 'NONE';
        var strongest = 0.45;

        if (contextSwitchRisk > strongest) {
            leakSource = 'CONTEXT';
            strongest = contextSwitchRisk;
        }
        if (lateStimulusRisk > strongest) {
            leakSource = 'STIMULUS';
            strongest = lateStimulusRisk;
        }
        if (fatigueRisk > strongest) {
            leakSource = 'FATIGUE';
            strongest = fatigueRisk;
        }

        return {
            integrity: round(integrity, 3),
            deepWorkRatio: round(deepWorkRatio, 3),
            contextSwitchRisk: round(contextSwitchRisk, 3),
            lateStimulusRisk: round(lateStimulusRisk, 3),
            leakSource: leakSource
        };
    }

    global.AttentionEngine = Object.freeze({
        version: '1.0',
        computeAttentionState: computeAttentionState
    });
})(window);
