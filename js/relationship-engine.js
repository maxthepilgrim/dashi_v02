/* ========================================
   Life OS - Relationship Field Engine
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

    function daysSince(value, nowTs) {
        var ts = new Date(value).getTime();
        if (!Number.isFinite(ts)) return null;
        return Math.max(0, Math.floor((nowTs - ts) / (24 * 60 * 60 * 1000)));
    }

    function median(list) {
        var arr = safeArray(list).slice().sort(function (a, b) { return a - b; });
        if (!arr.length) return 0;
        var mid = Math.floor(arr.length / 2);
        if (arr.length % 2 === 0) return (arr[mid - 1] + arr[mid]) / 2;
        return arr[mid];
    }

    function extractContactDays(people, nowTs) {
        var keys = ['lastContact', 'lastContactAt', 'lastInteraction', 'date', 'updatedAt'];
        var out = [];

        safeArray(people).forEach(function (person) {
            var entry = safeObject(person);
            var found = null;

            keys.some(function (key) {
                var val = entry[key];
                var days = daysSince(val, nowTs);
                if (days == null) return false;
                found = days;
                return true;
            });

            out.push(found == null ? 30 : found);
        });

        return out;
    }

    function derivedMood(derivedState) {
        var derived = safeObject(derivedState);
        var nodes = safeObject(derived.nodes);

        if (nodes.mood && Number.isFinite(Number(nodes.mood.score))) {
            return clamp(nodes.mood.score, 0, 1);
        }

        var daily = safeArray(safeObject(derivedState).dailyStateEntries);
        if (daily.length > 0) return 0.5;
        return 0.5;
    }

    function inferWorkIntensity(derivedState, history) {
        var derived = safeObject(derivedState);
        var momentum = safeObject(derived.momentum);
        var hist = safeObject(history);

        if (Number.isFinite(Number(hist.workIntensity))) {
            return clamp(hist.workIntensity, 0, 1);
        }

        var context = Number(momentum.contextAware);
        var creative = Number(momentum.creative);
        var revenue = Number(momentum.revenue);

        if ([context, creative, revenue].some(function (v) { return Number.isFinite(v); })) {
            return clamp(
                ((Number.isFinite(context) ? context : 0.5) * 0.5) +
                ((Number.isFinite(creative) ? creative : 0.5) * 0.3) +
                ((Number.isFinite(revenue) ? revenue : 0.5) * 0.2),
                0,
                1
            );
        }

        return 0.5;
    }

    function computeRelationshipState(v2Data, derivedState, history) {
        var nowTs = Date.now();
        var v2 = safeObject(v2Data);

        var contactDays = extractContactDays(v2.people, nowTs);
        if (!contactDays.length) contactDays = [21];

        var warmthScores = contactDays.map(function (days) {
            return Math.exp(-Math.max(0, days) / 14);
        });

        var warmth = clamp(
            warmthScores.reduce(function (sum, value) { return sum + value; }, 0) / warmthScores.length,
            0,
            1
        );

        var neglectedCount = contactDays.filter(function (days) {
            return days >= 21;
        }).length;

        var lastContactDaysMedian = median(contactDays);

        var mood = derivedMood(derivedState);
        var workIntensity = inferWorkIntensity(derivedState, history);

        var isolationRisk = clamp(
            ((1 - warmth) * 0.58) +
            ((1 - mood) * 0.2) +
            (workIntensity * 0.22),
            0,
            1
        );

        if (warmth < 0.34 && mood < 0.42 && workIntensity > 0.62) {
            isolationRisk = clamp(isolationRisk + 0.08, 0, 1);
        }

        return {
            warmth: round(warmth, 3),
            isolationRisk: round(isolationRisk, 3),
            neglectedCount: neglectedCount,
            lastContactDaysMedian: round(lastContactDaysMedian, 2)
        };
    }

    global.RelationshipEngine = Object.freeze({
        version: '1.0',
        computeRelationshipState: computeRelationshipState
    });
})(window);
