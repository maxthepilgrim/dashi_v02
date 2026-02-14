/* ========================================
   Life OS - Master System State
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

    function mapCognitiveRisk(riskLevel) {
        var level = String(riskLevel || 'LOW').toUpperCase();
        if (level === 'HIGH') return 0.82;
        if (level === 'MEDIUM') return 0.52;
        return 0.22;
    }

    function pickConstraint(payload) {
        var cognitive = safeObject(payload.cognitiveState);
        var states = safeObject(cognitive.states);
        if (states.primaryConstraint) {
            return String(states.primaryConstraint).toUpperCase();
        }

        var derived = safeObject(payload.derivedState);
        var metrics = safeObject(derived.metrics);
        var attention = safeObject(payload.attentionState);
        var relationship = safeObject(payload.relationshipState);
        var alignment = safeObject(payload.alignmentState);

        var deficits = {
            ENERGY: clamp(1 - Number(metrics.healthScore), 0, 1),
            TIME: clamp(1 - Number(metrics.rhythmScore), 0, 1),
            MONEY: clamp(1 - Number(metrics.financeScore), 0, 1),
            CLARITY: clamp(Number(attention.contextSwitchRisk), 0, 1),
            SOCIAL: clamp(Number(relationship.isolationRisk), 0, 1)
        };

        if (alignment.mode === 'SURVIVAL') deficits.MONEY = clamp(deficits.MONEY + 0.1, 0, 1);

        var winner = 'CLARITY';
        var best = -1;
        Object.keys(deficits).forEach(function (key) {
            if (deficits[key] > best) {
                best = deficits[key];
                winner = key;
            }
        });

        return winner;
    }

    function pickSystemMode(payload) {
        var cognitive = safeObject(payload.cognitiveState);
        var states = safeObject(cognitive.states);
        if (states.systemMode) return states.systemMode;

        var time = safeObject(payload.timeState);
        var derived = safeObject(payload.derivedState);
        var stress = clamp(Number(safeObject(derived.signals).stress), 0, 1);

        if (time.phase === 'RECOVER' || stress >= 0.8) return 'RECOVER';
        if (time.phase === 'BUILD') return 'BUILD';
        if (time.phase === 'HARVEST') return 'FLOW';
        return 'EXPLORE';
    }

    function pickDirection(payload) {
        var time = safeObject(payload.timeState);
        var narrative = safeObject(payload.narrativeState);

        if (time.trend === 'UP' || narrative.trajectory === 'RISING') return 'UP';
        if (time.trend === 'DOWN' || narrative.trajectory === 'FALLING') return 'DOWN';
        return 'FLAT';
    }

    function computeOverallRisk(payload) {
        var derived = safeObject(payload.derivedState);
        var cognitive = safeObject(payload.cognitiveState);
        var time = safeObject(payload.timeState);
        var attention = safeObject(payload.attentionState);
        var alignment = safeObject(payload.alignmentState);
        var relationship = safeObject(payload.relationshipState);
        var creative = safeObject(payload.creativePhaseState);

        var stress = clamp(Number(safeObject(derived.signals).stress), 0, 1);
        var cognitiveRisk = mapCognitiveRisk(safeObject(cognitive.states).riskLevel);
        var burnoutRisk = clamp(Number(time.burnoutRisk), 0, 1);
        var attentionRisk = clamp(
            (Number(attention.contextSwitchRisk) * 0.55) +
            (Number(attention.lateStimulusRisk) * 0.45),
            0,
            1
        );
        var isolationRisk = clamp(Number(relationship.isolationRisk), 0, 1);
        var stagnationRisk = clamp(Number(creative.stagnationRisk), 0, 1);

        var alignmentRisk = 0.2;
        if (alignment.mode === 'SURVIVAL') alignmentRisk = 0.6;
        else if (alignment.mode === 'OVERLOAD') alignmentRisk = 0.7;
        else if (alignment.mode === 'DRIFT') alignmentRisk = 0.45;

        var overall =
            (cognitiveRisk * 0.28) +
            (burnoutRisk * 0.22) +
            (stress * 0.16) +
            (attentionRisk * 0.14) +
            (alignmentRisk * 0.1) +
            (isolationRisk * 0.06) +
            (stagnationRisk * 0.04);

        return round(clamp(overall, 0, 1), 3);
    }

    function computeSystemState(payload) {
        var safePayload = safeObject(payload);

        return {
            systemMode: pickSystemMode(safePayload),
            dominantConstraint: pickConstraint(safePayload),
            overallRisk: computeOverallRisk(safePayload),
            lifeDirection: pickDirection(safePayload)
        };
    }

    global.SystemStateEngine = Object.freeze({
        version: '1.0',
        computeSystemState: computeSystemState
    });
})(window);
