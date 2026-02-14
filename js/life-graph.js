/* ========================================
   Life OS - Neural Derived State (LifeGraph)
   ======================================== */

(function (global) {
    'use strict';

    const Store = global.Store || null;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    // Required node domains for the neural graph.
    const NODES = Object.freeze({
        rhythm: 'rhythm',
        health: 'health',
        mood: 'mood',
        creative: 'creative',
        output: 'output',
        revenue: 'revenue',
        finance: 'finance',
        stress: 'stress',
        relationships: 'relationships',
        reflection: 'reflection',
        goals: 'goals'
    });

    // Lightweight fixed edge map (phase 1) for cross-domain influence tracing.
    const INFLUENCE_WEIGHTS = Object.freeze({
        creative: Object.freeze({ rhythm: 0.4, health: 0.4, mood: 0.2 }),
        revenue: Object.freeze({ creative: 0.45, output: 0.35, finance: 0.2 }),
        stress: Object.freeze({ finance: -0.4, health: -0.35, relationships: -0.25 }),
        goals: Object.freeze({ rhythm: 0.35, reflection: 0.35, output: 0.3 }),
        mood: Object.freeze({ health: 0.5, relationships: 0.3, rhythm: 0.2 })
    });

    function clamp(value, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function toNumber(value, fallback) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function safeObject(value) {
        return value && typeof value === 'object' ? value : {};
    }

    function toTimestamp(value) {
        if (value == null) return null;
        const date = new Date(value);
        const ts = date.getTime();
        return Number.isFinite(ts) ? ts : null;
    }

    function daysSince(value, nowMs) {
        const ts = toTimestamp(value);
        if (!ts) return null;
        return Math.max(0, Math.floor((nowMs - ts) / MS_PER_DAY));
    }

    function weightedAverage(entries, fallback) {
        let totalWeight = 0;
        let total = 0;
        safeArray(entries).forEach((entry) => {
            if (!entry) return;
            if (entry.value == null) return;
            const weight = toNumber(entry.weight, 0);
            if (weight <= 0) return;
            const value = clamp(entry.value, 0, 1);
            total += value * weight;
            totalWeight += weight;
        });
        if (totalWeight <= 0) return clamp(fallback, 0, 1);
        return clamp(total / totalWeight, 0, 1);
    }

    function normalizeEnergy(value) {
        if (typeof value === 'number') {
            // Supports 1..10 and 0..1 scales.
            if (value <= 1) return clamp(value, 0, 1);
            return clamp(value / 10, 0, 1);
        }
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return null;
        if (lower === 'low') return 0.3;
        if (lower === 'medium') return 0.6;
        if (lower === 'high') return 0.9;
        if (lower.includes('🔥')) return 0.9;
        if (lower.includes('🙂')) return 0.65;
        if (lower.includes('😐')) return 0.45;
        if (lower.includes('😫')) return 0.2;
        return null;
    }

    function normalizeMood(value) {
        if (typeof value === 'number') {
            if (value <= 1) return clamp(value, 0, 1);
            return clamp(value / 10, 0, 1);
        }
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return null;
        if (lower.includes('great') || lower.includes('high')) return 0.85;
        if (lower.includes('good') || lower.includes('🙂')) return 0.7;
        if (lower.includes('neutral') || lower.includes('😐')) return 0.5;
        if (lower.includes('low') || lower.includes('😫')) return 0.25;
        return null;
    }

    function normalizeSleep(value) {
        const hrs = toNumber(value, null);
        if (hrs == null) return null;
        // 8h maps to 1.0 and is clamped for outliers.
        return clamp(hrs / 8, 0, 1);
    }

    function countRhythm(rhythm) {
        let total = 0;
        let done = 0;
        safeArray(rhythm).forEach((phase) => {
            safeArray(phase && phase.items).forEach((item) => {
                total += 1;
                if (item && item.done) done += 1;
            });
        });
        return { total, done, score: total > 0 ? done / total : 0 };
    }

    function computeMovementSignal(rhythm, activities, nowMs) {
        const movementTerms = ['movement', 'gym', 'walk', 'run', 'exercise', 'workout', 'daylight', 'outside'];
        const movementItems = [];

        safeArray(rhythm).forEach((phase) => {
            safeArray(phase && phase.items).forEach((item) => {
                const text = String(item && item.text || '').toLowerCase();
                const isMovement = movementTerms.some((term) => text.includes(term));
                if (isMovement) movementItems.push(item);
            });
        });

        if (movementItems.length > 0) {
            const done = movementItems.filter((item) => item && item.done).length;
            return {
                score: clamp(done / movementItems.length, 0, 1),
                confidence: 0.95
            };
        }

        const recentActivities = safeArray(activities).filter((activity) => {
            const days = daysSince(activity && activity.date, nowMs);
            return days != null && days <= 3;
        }).length;

        return {
            score: clamp(recentActivities / 3, 0, 1),
            confidence: recentActivities > 0 ? 0.75 : 0.25
        };
    }

    function latestDailyState(entries, nowMs) {
        const valid = safeArray(entries)
            .map((entry) => ({ entry, ts: toTimestamp(entry && entry.date) }))
            .filter((item) => item.ts != null)
            .sort((a, b) => b.ts - a.ts);

        if (valid.length > 0) return valid[0].entry;

        // Fallback object keeps downstream parsing simple.
        return { date: new Date(nowMs).toISOString() };
    }

    function latestCreativeTimestamp(compass, nowMs) {
        let latestTs = null;
        safeArray(compass && compass.dailyLog).forEach((log) => {
            const ts = toTimestamp(log && log.date);
            if (ts != null && (latestTs == null || ts > latestTs)) latestTs = ts;
        });
        safeArray(compass && compass.projects).forEach((project) => {
            const ts = toTimestamp(project && project.lastActivityDate);
            if (ts != null && (latestTs == null || ts > latestTs)) latestTs = ts;
        });
        if (latestTs == null) {
            // 30 day fallback keeps momentum low but non-zero.
            return nowMs - (30 * MS_PER_DAY);
        }
        return latestTs;
    }

    function computeCreativeOutputScore(v2) {
        const bizContent = safeObject(v2 && v2.bizContent);
        const minutes = clamp(toNumber(bizContent.minutesCreated, 0) / 180, 0, 1);
        const pieces = clamp(toNumber(bizContent.piecesFinished, 0) / 3, 0, 1);
        const audience = clamp(toNumber(bizContent.audienceGrowth, 0) / 100, 0, 1);
        return weightedAverage([
            { value: minutes, weight: 0.4 },
            { value: pieces, weight: 0.4 },
            { value: audience, weight: 0.2 }
        ], 0);
    }

    function computePipelineScore(v2, finance, invoices) {
        const revenue = safeObject(v2 && v2.revenueEngine);
        const projectedPipeline = Math.max(
            toNumber(revenue.pipeline, 0),
            safeArray(invoices)
                .filter((inv) => String(inv && inv.status || '').toLowerCase() !== 'paid')
                .reduce((sum, inv) => sum + toNumber(inv && inv.amount, 0), 0)
        );
        const target = Math.max(
            toNumber(v2 && v2.financialReality && v2.financialReality.monthlyTarget, 0),
            toNumber(finance && finance.monthlyIncome, 0),
            1000
        );
        return clamp(projectedPipeline / (target * 2), 0, 1);
    }

    function computeInvoicesSignal(v2, invoices) {
        const revenue = safeObject(v2 && v2.revenueEngine);
        const sent = Math.max(
            toNumber(revenue.invoices, 0),
            safeArray(invoices).filter((inv) => String(inv && inv.status || '').toLowerCase() === 'sent').length
        );
        return clamp(sent / 5, 0, 1);
    }

    function computeFinanceScore(v2, finance) {
        const reality = safeObject(v2 && v2.financialReality);
        const runwayMonths = toNumber(reality.runwayMonths, null);
        const income = Math.max(
            toNumber(reality.monthlyIncome, 0),
            toNumber(finance && finance.monthlyIncome, 0)
        );
        const burn = Math.max(
            toNumber(reality.monthlyBurn, 0),
            toNumber(finance && finance.monthlyExpenses, 0)
        );

        // Required baseline: runway contribution.
        const runwayScore = runwayMonths == null ? 0 : clamp(runwayMonths / 6, 0, 1);
        const incomeVsBurn = burn > 0 ? clamp(income / burn, 0, 1) : (income > 0 ? 1 : 0.5);

        const score = weightedAverage([
            { value: runwayScore, weight: 0.75 },
            { value: incomeVsBurn, weight: 0.25 }
        ], runwayScore || 0);

        return {
            score,
            confidence: runwayMonths == null && burn <= 0 && income <= 0 ? 0.25 : 0.9
        };
    }

    function computeRelationshipSignal(people, nowMs) {
        const dateKeys = ['lastContact', 'lastContactAt', 'lastInteraction', 'date', 'updatedAt'];
        const scores = [];
        let freshestTs = null;

        safeArray(people).forEach((person) => {
            let ts = null;
            dateKeys.some((key) => {
                const candidateTs = toTimestamp(person && person[key]);
                if (candidateTs != null) {
                    ts = candidateTs;
                    return true;
                }
                return false;
            });
            if (ts == null) return;
            if (freshestTs == null || ts > freshestTs) freshestTs = ts;
            const days = Math.max(0, Math.floor((nowMs - ts) / MS_PER_DAY));
            // Required relationship decay model.
            scores.push(Math.exp(-days / 14));
        });

        if (scores.length === 0) {
            return {
                score: 0.5,
                confidence: 0.2,
                lastUpdated: nowMs
            };
        }

        const total = scores.reduce((sum, value) => sum + value, 0);
        return {
            score: clamp(total / scores.length, 0, 1),
            confidence: clamp(scores.length / Math.max(3, safeArray(people).length), 0.35, 1),
            lastUpdated: freshestTs || nowMs
        };
    }

    function computeReflectionScore(v2, journalEntries, nowMs) {
        const reflection = safeObject(v2 && v2.reflection);
        const reflectionFields = [reflection.win, reflection.lesson, reflection.nextShift]
            .filter((text) => String(text || '').trim().length > 0).length;
        const reflectionCompleteness = clamp(reflectionFields / 3, 0, 1);

        const recentJournalCount = safeArray(journalEntries).filter((entry) => {
            const days = daysSince(entry && entry.date, nowMs);
            return days != null && days <= 7;
        }).length;
        const journalingConsistency = clamp(recentJournalCount / 5, 0, 1);

        return weightedAverage([
            { value: reflectionCompleteness, weight: 0.65 },
            { value: journalingConsistency, weight: 0.35 }
        ], 0);
    }

    function computeGoalsScore(goals) {
        const list = safeArray(goals);
        if (list.length === 0) return 0;
        const sum = list.reduce((acc, goal) => acc + clamp(toNumber(goal && goal.progress, 0) / 100, 0, 1), 0);
        return clamp(sum / list.length, 0, 1);
    }

    function makeNode(score, confidence, lastUpdated) {
        return {
            score: clamp(score, 0, 1),
            confidence: clamp(confidence, 0, 1),
            lastUpdated: toNumber(lastUpdated, Date.now())
        };
    }

    function computeInfluence(nodes) {
        const influence = {};
        Object.keys(INFLUENCE_WEIGHTS).forEach((target) => {
            const edgeMap = INFLUENCE_WEIGHTS[target];
            const contributions = {};
            let total = 0;
            Object.keys(edgeMap).forEach((source) => {
                const sourceNode = nodes[source] || { score: 0 };
                const contribution = clamp(sourceNode.score, 0, 1) * edgeMap[source];
                contributions[source] = contribution;
                total += contribution;
            });
            influence[target] = {
                score: clamp(total, -1, 1),
                contributions
            };
        });
        return influence;
    }

    function createEmptyDerivedState(nowMs) {
        const ts = toNumber(nowMs, Date.now());
        const nodes = {};
        Object.keys(NODES).forEach((key) => {
            nodes[key] = makeNode(0, 0, ts);
        });
        return {
            version: '1.0.0',
            computedAt: ts,
            nodes,
            metrics: {
                rhythmScore: 0,
                healthScore: 0,
                creativeMomentum: 0,
                revenueMomentum: 0,
                financeScore: 0,
                stressScore: 0,
                relationshipScore: 0,
                lifePulse: 0
            },
            momentum: {
                contextAware: 0,
                creative: 0,
                revenue: 0
            },
            signals: {
                stress: 0,
                recovery: 0
            },
            influence: {
                weights: INFLUENCE_WEIGHTS,
                targets: {}
            }
        };
    }

    function readStoreFallbackInput() {
        if (!Store || typeof Store.getV2Data !== 'function') return {};
        return {
            v2: Store.getV2Data(),
            dailyStateEntries: typeof Store.getDailyStateEntries === 'function' ? Store.getDailyStateEntries() : [],
            finance: typeof Store.getFinance === 'function' ? Store.getFinance() : {},
            fitness: typeof Store.getFitness === 'function' ? Store.getFitness() : {},
            invoices: typeof Store.getInvoices === 'function' ? Store.getInvoices() : [],
            goals: typeof Store.getGoals === 'function' ? Store.getGoals() : [],
            journalEntries: typeof Store.getJournalEntries === 'function' ? Store.getJournalEntries() : [],
            now: Date.now()
        };
    }

    function computeDerivedState(rawInput) {
        const input = rawInput && typeof rawInput === 'object' ? rawInput : readStoreFallbackInput();
        const nowMs = toNumber(input.now, Date.now());
        const v2 = safeObject(input.v2);
        const dailyState = input.todayState || latestDailyState(input.dailyStateEntries, nowMs);
        const finance = safeObject(input.finance);
        const fitness = safeObject(input.fitness);
        const invoices = safeArray(input.invoices);
        const goals = safeArray(input.goals);
        const journalEntries = safeArray(input.journalEntries);

        // 5.1 Rhythm Score = completion ratio of daily rhythm.
        const rhythmStats = countRhythm(v2.dailyRhythm);
        const rhythmScore = clamp(rhythmStats.score, 0, 1);

        // 5.2 Health Score = weighted average of energy + movement + optional sleep.
        const energyScore = normalizeEnergy(dailyState.energy);
        const sleepScore = normalizeSleep(dailyState.sleep);
        const movement = computeMovementSignal(v2.dailyRhythm, fitness.activities, nowMs);
        const healthWeights = [
            { value: energyScore, weight: 0.45 },
            { value: movement.score, weight: 0.35 }
        ];
        if (sleepScore != null) healthWeights.push({ value: sleepScore, weight: 0.2 });
        const healthScore = weightedAverage(healthWeights, 0.5);

        // 5.3 Creative Momentum = rhythm*0.4 + health*0.4 + recencyFactor*0.2.
        const creativeTs = latestCreativeTimestamp(v2.creativeCompass, nowMs);
        const creativeDays = Math.max(0, Math.floor((nowMs - creativeTs) / MS_PER_DAY));
        const recencyFactor = clamp(Math.exp(-creativeDays / 10), 0, 1);
        const creativeMomentum = clamp((rhythmScore * 0.4) + (healthScore * 0.4) + (recencyFactor * 0.2), 0, 1);

        // 5.4 Revenue Momentum = creative output + pipeline + invoices sent.
        const outputScore = computeCreativeOutputScore(v2);
        const pipelineScore = computePipelineScore(v2, finance, invoices);
        const invoicesScore = computeInvoicesSignal(v2, invoices);
        const revenueMomentum = clamp(
            (outputScore * 0.4) + (pipelineScore * 0.35) + (invoicesScore * 0.25),
            0,
            1
        );

        // 5.5 Financial Stability with runway baseline and income-vs-burn support.
        const financeSignal = computeFinanceScore(v2, finance);
        const financeScore = financeSignal.score;

        // 5.7 Relationship score = exp(-daysSinceContact / 14).
        const relationshipSignal = computeRelationshipSignal(v2.people, nowMs);
        const relationshipScore = relationshipSignal.score;

        // 5.6 Stress score = inverse weighted average of finance + health + relationships.
        const stressScore = clamp(
            1 - weightedAverage([
                { value: financeScore, weight: 0.4 },
                { value: healthScore, weight: 0.35 },
                { value: relationshipScore, weight: 0.25 }
            ], 0.5),
            0,
            1
        );

        const moodScore = normalizeMood(dailyState.mood);
        const reflectionScore = computeReflectionScore(v2, journalEntries, nowMs);
        const goalsScore = computeGoalsScore(goals);

        // 5.8 Daily Pulse global metric (0..100 integer).
        const lifePulseRaw =
            (rhythmScore * 0.25) +
            (healthScore * 0.2) +
            (creativeMomentum * 0.2) +
            (financeScore * 0.15) +
            (relationshipScore * 0.1) +
            ((1 - stressScore) * 0.1);
        const lifePulse = Math.round(clamp(lifePulseRaw, 0, 1) * 100);

        const contextAwareMomentum = clamp(
            ((creativeMomentum * 0.5) + (revenueMomentum * 0.35) + (rhythmScore * 0.15)) * (1 - (stressScore * 0.35)),
            0,
            1
        );

        const recoverySignal = weightedAverage([
            { value: 1 - stressScore, weight: 0.5 },
            { value: healthScore, weight: 0.3 },
            { value: relationshipScore, weight: 0.2 }
        ], 0.5);

        const nodes = {
            rhythm: makeNode(rhythmScore, rhythmStats.total > 0 ? 1 : 0.2, nowMs),
            health: makeNode(
                healthScore,
                weightedAverage([
                    { value: energyScore, weight: 0.45 },
                    { value: movement.confidence, weight: 0.35 },
                    { value: sleepScore == null ? 0.4 : 1, weight: 0.2 }
                ], 0.5),
                toTimestamp(dailyState.date) || nowMs
            ),
            mood: makeNode(moodScore == null ? 0.5 : moodScore, moodScore == null ? 0.2 : 0.8, toTimestamp(dailyState.date) || nowMs),
            creative: makeNode(creativeMomentum, 0.85, creativeTs),
            output: makeNode(outputScore, 0.75, nowMs),
            revenue: makeNode(revenueMomentum, 0.8, nowMs),
            finance: makeNode(financeScore, financeSignal.confidence, nowMs),
            stress: makeNode(stressScore, 0.9, nowMs),
            relationships: makeNode(relationshipScore, relationshipSignal.confidence, relationshipSignal.lastUpdated),
            reflection: makeNode(reflectionScore, 0.7, nowMs),
            goals: makeNode(goalsScore, goals.length > 0 ? 0.95 : 0.2, nowMs)
        };

        return {
            version: '1.0.0',
            computedAt: nowMs,
            nodes,
            metrics: {
                rhythmScore: nodes.rhythm.score,
                healthScore: nodes.health.score,
                creativeMomentum: nodes.creative.score,
                revenueMomentum: nodes.revenue.score,
                financeScore: nodes.finance.score,
                stressScore: nodes.stress.score,
                relationshipScore: nodes.relationships.score,
                lifePulse
            },
            momentum: {
                contextAware: contextAwareMomentum,
                creative: nodes.creative.score,
                revenue: nodes.revenue.score
            },
            signals: {
                stress: nodes.stress.score,
                recovery: recoverySignal
            },
            influence: {
                weights: INFLUENCE_WEIGHTS,
                targets: computeInfluence(nodes)
            }
        };
    }

    global.LifeGraph = Object.freeze({
        NODES,
        INFLUENCE_WEIGHTS,
        createEmptyDerivedState,
        computeDerivedState
    });
})(window);
