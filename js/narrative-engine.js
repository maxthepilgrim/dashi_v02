/* ========================================
   Life OS - Narrative Engine
   ======================================== */

(function (global) {
    'use strict';

    function clamp(value, min, max) {
        var num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function safeObject(value) {
        return value && typeof value === 'object' ? value : {};
    }

    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function pickTrajectory(timeState, alignmentState, derivedState) {
        var time = safeObject(timeState);
        var alignment = safeObject(alignmentState);
        var derived = safeObject(derivedState);

        var stress = clamp(
            Number(safeObject(derived.signals).stress != null
                ? safeObject(derived.signals).stress
                : safeObject(derived.metrics).stressScore),
            0,
            1
        );

        if (time.trend === 'UP' && alignment.mode === 'ALIGNED') return 'RISING';
        if (time.trend === 'DOWN' && stress >= 0.62) return 'FALLING';
        if (alignment.mode === 'SURVIVAL' || alignment.mode === 'OVERLOAD') return 'TURNING';
        return 'STABLE';
    }

    function buildThemes(v2Data, context) {
        var themes = [];
        var v2 = safeObject(v2Data);
        var ctx = safeObject(context);
        var timeState = safeObject(ctx.timeState);
        var alignment = safeObject(ctx.alignmentState);
        var attention = safeObject(ctx.attentionState);
        var relationship = safeObject(ctx.relationshipState);

        if (timeState.phase === 'RECOVER') themes.push('recovery');
        if (timeState.phase === 'BUILD') themes.push('building');
        if (alignment.mode === 'SURVIVAL') themes.push('stability');
        if (alignment.mode === 'ALIGNED') themes.push('alignment');
        if (attention.leakSource === 'CONTEXT') themes.push('focus integrity');
        if (attention.leakSource === 'STIMULUS') themes.push('stimulus hygiene');
        if ((relationship.neglectedCount || 0) > 0) themes.push('connection repair');

        var reflection = safeObject(v2.reflection);
        if (String(reflection.win || '').trim()) themes.push('wins');
        if (String(reflection.lesson || '').trim()) themes.push('lessons');

        var seen = Object.create(null);
        return themes.filter(function (theme) {
            var key = String(theme || '').toLowerCase();
            if (!key || seen[key]) return false;
            seen[key] = true;
            return true;
        }).slice(0, 4);
    }

    function chapterLabel(timeState, trajectory) {
        var phase = safeObject(timeState).phase || 'EXPLORE';

        if (phase === 'RECOVER' && trajectory === 'TURNING') return 'Reset and Reframe';
        if (phase === 'RECOVER') return 'Recovery Arc';
        if (phase === 'BUILD' && trajectory === 'RISING') return 'Compounding Build';
        if (phase === 'HARVEST') return 'Harvest Window';
        if (trajectory === 'FALLING') return 'Stabilization Needed';
        return 'Exploration Season';
    }

    function compactSummary(raw) {
        var text = String(raw || '').replace(/\s+/g, ' ').trim();
        if (text.length <= 200) return text;
        return text.slice(0, 197).trim() + '...';
    }

    function computeNarrativeState(v2Data, derivedState, context) {
        var v2 = safeObject(v2Data);
        var ctx = safeObject(context);

        var timeState = safeObject(ctx.timeState);
        var alignment = safeObject(ctx.alignmentState);

        var trajectory = pickTrajectory(timeState, alignment, derivedState);
        var keyThemes = buildThemes(v2Data, context);

        var reflection = safeObject(v2.reflection);
        var win = String(reflection.win || '').trim();
        var lesson = String(reflection.lesson || '').trim();

        var chapter = chapterLabel(timeState, trajectory);

        var summary = compactSummary(
            chapter + ': ' +
            (timeState.trend === 'UP' ? 'Momentum is improving. ' : timeState.trend === 'DOWN' ? 'Momentum is under pressure. ' : 'Momentum is stable. ') +
            (alignment.mode === 'ALIGNED' ? 'Work remains aligned with North Star. ' : 'Alignment needs correction. ') +
            (win ? 'Win: ' + win + '. ' : '') +
            (lesson ? 'Lesson: ' + lesson + '.' : '')
        );

        return {
            chapterLabel: chapter,
            trajectory: trajectory,
            keyThemes: keyThemes,
            summary: summary
        };
    }

    global.NarrativeEngine = Object.freeze({
        version: '1.0',
        computeNarrativeState: computeNarrativeState
    });
})(window);
