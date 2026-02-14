/* ========================================
   Life OS - Alignment Engine
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

    function toKeywords(v2Data) {
        var v2 = safeObject(v2Data);
        var northStar = safeObject(v2.northStar);
        var base = [];

        var focus = String(northStar.focus || '').toLowerCase();
        if (focus) base.push(focus);

        safeArray(northStar.priorities).forEach(function (entry) {
            var text = String(entry || '').toLowerCase();
            if (text) base.push(text);
        });

        return base
            .join(' ')
            .split(/[^a-z0-9]+/)
            .map(function (token) { return token.trim(); })
            .filter(function (token) { return token.length >= 4; })
            .slice(0, 24);
    }

    function isProjectAligned(project, keywords) {
        if (!project) return false;
        if (!keywords.length) {
            return String(project.stage || '').toUpperCase() !== 'RESTING';
        }

        var text = (
            String(project.name || '') + ' ' +
            String(project.stage || '') + ' ' +
            String(project.notes || '')
        ).toLowerCase();

        return keywords.some(function (keyword) {
            return keyword && text.indexOf(keyword) !== -1;
        });
    }

    function deriveCreativeMinutes(v2Data, history, keywords) {
        var v2 = safeObject(v2Data);
        var hist = safeObject(history);
        var projectsById = {};

        safeArray(safeObject(v2.creativeCompass).projects).forEach(function (project) {
            if (!project || !project.id) return;
            projectsById[project.id] = project;
        });

        var aligned = 0;
        var nonAligned = 0;

        safeArray(hist.compassDailyLog).forEach(function (entry) {
            var minutes = 0;
            var outcome = String(entry && entry.outcome || '').toLowerCase();
            if (outcome === 'yes') minutes = 25;
            else if (outcome === 'little') minutes = 10;

            if (!minutes) return;

            var project = projectsById[entry.projectId] || null;
            if (isProjectAligned(project, keywords)) aligned += minutes;
            else nonAligned += minutes;
        });

        if ((aligned + nonAligned) === 0) {
            var fallback = Math.max(0, Number(safeObject(v2.bizContent).minutesCreated) || 0);
            aligned = Math.round(fallback * 0.6);
            nonAligned = fallback - aligned;
        }

        return {
            aligned: aligned,
            nonAligned: nonAligned
        };
    }

    function deriveRevenueMinutes(v2Data, history) {
        var v2 = safeObject(v2Data);
        var hist = safeObject(history);
        var revenue = safeObject(v2.revenueEngine);

        var invoiceMoves = Math.max(0, Number(revenue.invoices) || 0) * 10;
        var dealMoves = Math.max(0, Number(revenue.deals) || 0) * 10;
        var pipelineMoves = Math.max(0, Number(revenue.pipeline) || 0) / 200;

        var histRevenue = Math.max(0, Number(hist.revenueWorkMinutes7d) || 0);

        return Math.round(invoiceMoves + dealMoves + pipelineMoves + histRevenue);
    }

    function deriveMaintenanceMinutes(v2Data, history) {
        var hist = safeObject(history);
        var v2 = safeObject(v2Data);

        var fromHistory = Math.max(0, Number(hist.adminMinutes7d) || 0);

        var rhythm = safeArray(v2.dailyRhythm);
        var adminDone = 0;
        rhythm.forEach(function (phase) {
            safeArray(phase && phase.items).forEach(function (item) {
                var text = String(item && item.text || '').toLowerCase();
                if (!item || !item.done) return;
                if (text.indexOf('admin') !== -1 || text.indexOf('inbox') !== -1 || text.indexOf('clear') !== -1) {
                    adminDone += 15;
                }
            });
        });

        return Math.round(fromHistory + adminDone);
    }

    function getStress(derivedState) {
        var derived = safeObject(derivedState);
        var signals = safeObject(derived.signals);
        var metrics = safeObject(derived.metrics);

        if (Number.isFinite(Number(signals.stress))) return clamp(signals.stress, 0, 1);
        if (Number.isFinite(Number(metrics.stressScore))) return clamp(metrics.stressScore, 0, 1);
        return 0.5;
    }

    function computeAlignmentState(v2Data, derivedState, history) {
        var keywords = toKeywords(v2Data);
        var creative = deriveCreativeMinutes(v2Data, history, keywords);
        var revenueOnly = deriveRevenueMinutes(v2Data, history);
        var maintenance = deriveMaintenanceMinutes(v2Data, history);

        var alignedMinutes = creative.aligned;
        var totalMinutes = alignedMinutes + creative.nonAligned + revenueOnly + maintenance;
        if (totalMinutes <= 0) totalMinutes = 1;

        var northStarTimeRatio = clamp(alignedMinutes / totalMinutes, 0, 1);
        var revenueOnlyRatio = clamp(revenueOnly / totalMinutes, 0, 1);
        var maintenanceRatio = clamp(maintenance / totalMinutes, 0, 1);

        var stress = getStress(derivedState);

        var mode = 'ALIGNED';
        if (revenueOnlyRatio >= 0.55 && northStarTimeRatio <= 0.24) {
            mode = 'SURVIVAL';
        } else if (northStarTimeRatio < 0.2 && revenueOnlyRatio < 0.25 && maintenanceRatio < 0.25) {
            mode = 'DRIFT';
        } else if (northStarTimeRatio >= 0.3 && revenueOnlyRatio >= 0.2 && maintenanceRatio >= 0.2 && stress >= 0.68) {
            mode = 'OVERLOAD';
        }

        var imbalancePenalty = clamp(
            Math.max(0, revenueOnlyRatio - 0.5) * 0.7 +
            Math.max(0, maintenanceRatio - 0.45) * 0.7,
            0,
            1
        );

        var score = clamp(
            (northStarTimeRatio * 0.72) +
            ((1 - imbalancePenalty) * 0.18) +
            ((1 - stress) * 0.1),
            0,
            1
        );

        return {
            score: round(score, 3),
            mode: mode,
            northStarTimeRatio: round(northStarTimeRatio, 3),
            revenueOnlyRatio: round(revenueOnlyRatio, 3),
            maintenanceRatio: round(maintenanceRatio, 3)
        };
    }

    global.AlignmentEngine = Object.freeze({
        version: '1.0',
        computeAlignmentState: computeAlignmentState
    });
})(window);
