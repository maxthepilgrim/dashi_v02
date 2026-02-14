/* ========================================
   Vision Mode — Strategic Engine (V2)
   ======================================== */

(function (global) {
    'use strict';

    const ENGINE_VERSION = '2.0.0';
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const DIMENSIONS = [
        { key: 'incomeStability', type: 'Income', label: 'Income Stability' },
        { key: 'creativeOutput', type: 'Creation', label: 'Creative Output' },
        { key: 'physicalVitality', type: 'Health', label: 'Physical Vitality' },
        { key: 'relationshipDepth', type: 'Relationships', label: 'Relationship Depth' },
        { key: 'meaningContribution', type: 'Meaning', label: 'Meaning & Contribution' }
    ];

    function clamp(value, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function round(value) {
        return Math.round(clamp(value, -1000, 1000));
    }

    function defaultTargets() {
        return {
            incomeStability: 50,
            creativeOutput: 50,
            physicalVitality: 50,
            relationshipDepth: 50,
            meaningContribution: 50
        };
    }

    function parseDate(value) {
        if (!value) return null;
        const date = new Date(value);
        const ts = date.getTime();
        return Number.isFinite(ts) ? ts : null;
    }

    function startOfDay(ts) {
        const date = new Date(ts);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    function daysBetween(targetTs, baseTs) {
        return Math.floor((targetTs - baseTs) / MS_PER_DAY);
    }

    function computeDimensionValue(target, typeCompletion, overallCompletion, commitmentProgress) {
        return clamp(
            target * 0.4 +
            typeCompletion * 0.35 +
            overallCompletion * 0.15 +
            commitmentProgress * 0.1,
            0,
            100
        );
    }

    function buildMilestoneStats(state, nowTs) {
        const list = Array.isArray(state.milestones) ? state.milestones : [];
        const commitmentIds = new Set(Array.isArray(state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : []);
        const todayStart = startOfDay(nowTs);
        const dueSoonCutoff = todayStart + (7 * MS_PER_DAY);

        let completionSum = 0;
        let completed = 0;
        let blocked = 0;
        let overdue = 0;
        let dueSoon = 0;
        let committedCount = 0;
        let committedCompletionSum = 0;

        const typeTotals = {};

        list.forEach((milestone) => {
            const completion = clamp(milestone && milestone.completionPct, 0, 100);
            const status = milestone && milestone.status === 'done' ? 'done' : (completion >= 100 ? 'done' : (completion > 0 ? 'active' : 'planned'));
            const dueTs = parseDate(milestone && milestone.date);
            const isDone = status === 'done';
            const isBlocked = !isDone && Boolean(String((milestone && milestone.blocker) || '').trim());
            const isCommitted = commitmentIds.has(milestone && milestone.id);

            completionSum += completion;
            if (isDone) completed += 1;
            if (isBlocked) blocked += 1;

            if (!isDone && dueTs != null) {
                if (dueTs < todayStart) {
                    overdue += 1;
                } else if (dueTs <= dueSoonCutoff) {
                    dueSoon += 1;
                }
            }

            if (isCommitted) {
                committedCount += 1;
                committedCompletionSum += completion;
            }

            const visionType = (milestone && milestone.visionType) || 'Custom';
            if (!typeTotals[visionType]) {
                typeTotals[visionType] = { sum: 0, count: 0 };
            }
            typeTotals[visionType].sum += completion;
            typeTotals[visionType].count += 1;
        });

        const typeCompletion = {};
        Object.keys(typeTotals).forEach((type) => {
            const value = typeTotals[type];
            typeCompletion[type] = value.count > 0 ? (value.sum / value.count) : 0;
        });

        const total = list.length;
        const overallCompletion = total > 0 ? completionSum / total : 0;
        const active = Math.max(0, total - completed);
        const committedCompletion = committedCount > 0 ? (committedCompletionSum / committedCount) : overallCompletion;

        return {
            total,
            active,
            completed,
            blocked,
            overdue,
            dueSoon,
            committedCount,
            committedCompletion,
            overallCompletion,
            typeCompletion
        };
    }

    function buildAlignment(state, milestoneStats) {
        const targets = { ...defaultTargets(), ...(state.targets || {}) };
        const alignment = {};

        DIMENSIONS.forEach((dimension) => {
            const target = clamp(targets[dimension.key], 0, 100);
            const typeCompletion = clamp(
                milestoneStats.typeCompletion[dimension.type] != null
                    ? milestoneStats.typeCompletion[dimension.type]
                    : milestoneStats.overallCompletion,
                0,
                100
            );
            alignment[dimension.key] = round(computeDimensionValue(
                target,
                typeCompletion,
                milestoneStats.overallCompletion,
                milestoneStats.committedCompletion
            ));
        });

        const total = DIMENSIONS.reduce((sum, dimension) => sum + alignment[dimension.key], 0);
        alignment.overall = DIMENSIONS.length ? clamp(Math.round(total / DIMENSIONS.length), 0, 100) : 0;
        return alignment;
    }

    function buildDrift(alignment, lastAlignment) {
        const drift = {};
        const baseline = lastAlignment || defaultTargets();

        DIMENSIONS.forEach((dimension) => {
            const lastValue = clamp((baseline && baseline[dimension.key]) || 50, -100, 100);
            drift[dimension.key] = round(alignment[dimension.key] - lastValue);
        });

        const lastOverall = clamp((baseline && baseline.overall) || 50, -100, 100);
        drift.overall = round(alignment.overall - lastOverall);
        return drift;
    }

    function buildActionQueue(state, milestoneStats, nowTs) {
        const list = Array.isArray(state.milestones) ? state.milestones : [];
        const commitmentIds = new Set(Array.isArray(state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : []);
        const todayStart = startOfDay(nowTs);
        const dueSoonCutoff = todayStart + (7 * MS_PER_DAY);

        const queue = list
            .filter((milestone) => (milestone && milestone.status) !== 'done')
            .map((milestone) => {
                const completion = clamp(milestone && milestone.completionPct, 0, 100);
                const dueTs = parseDate(milestone && milestone.date);
                const updatedTs = parseDate((milestone && (milestone.updatedAt || milestone.createdAt)) || nowTs) || 0;
                const blocked = Boolean(String((milestone && milestone.blocker) || '').trim());
                const missingNextAction = !String((milestone && milestone.nextAction) || '').trim();
                const committed = commitmentIds.has(milestone && milestone.id);
                const staleDays = Math.max(0, daysBetween(todayStart, startOfDay(updatedTs)));

                const reasons = [];
                let rawPriority = 0;

                if (dueTs != null && dueTs < todayStart) {
                    const daysLate = Math.max(1, Math.abs(daysBetween(dueTs, todayStart)));
                    reasons.push(`Overdue by ${daysLate} day${daysLate === 1 ? '' : 's'}`);
                    rawPriority += clamp(70 + (daysLate * 4), 70, 95);
                } else if (dueTs != null && dueTs <= dueSoonCutoff) {
                    const daysLeft = Math.max(0, daysBetween(dueTs, todayStart));
                    reasons.push(daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`);
                    rawPriority += clamp(32 + ((7 - daysLeft) * 4), 32, 60);
                }

                if (blocked) {
                    reasons.push('Blocked');
                    rawPriority += 34;
                }

                if (missingNextAction) {
                    reasons.push('Missing next action');
                    rawPriority += 26;
                }

                if (committed) {
                    reasons.push('Weekly commitment');
                    rawPriority += 18;
                }

                if (completion < 30) {
                    reasons.push('Low progress');
                    rawPriority += clamp(Math.round((30 - completion) * 0.45) + 6, 6, 20);
                }

                if (staleDays >= 10) {
                    reasons.push('Stale update');
                    rawPriority += 8;
                }

                if (rawPriority === 0) {
                    reasons.push('Maintain momentum');
                    rawPriority = 12;
                }

                const priority = clamp(Math.round(rawPriority), 10, 100);

                return {
                    milestoneId: milestone.id,
                    title: milestone.title || 'Untitled milestone',
                    reason: reasons.join(' · '),
                    priority,
                    dueTs,
                    updatedTs
                };
            })
            .sort((a, b) => {
                if (b.priority !== a.priority) return b.priority - a.priority;
                if (a.dueTs != null && b.dueTs != null && a.dueTs !== b.dueTs) return a.dueTs - b.dueTs;
                if (a.dueTs != null && b.dueTs == null) return -1;
                if (a.dueTs == null && b.dueTs != null) return 1;
                if (b.updatedTs !== a.updatedTs) return b.updatedTs - a.updatedTs;
                return String(a.title).localeCompare(String(b.title));
            });

        return queue.slice(0, 8).map(({ milestoneId, title, reason, priority }) => ({ milestoneId, title, reason, priority }));
    }

    function tensionSeverity(value, high, medium) {
        if (value >= high) return 'high';
        if (value >= medium) return 'medium';
        return 'low';
    }

    function buildTensionFlags(alignment, drift, milestoneStats, finance, actionQueue) {
        const flags = [];

        if (milestoneStats.blocked > 0) {
            flags.push({
                id: 'tension-blocked-milestones',
                label: 'Execution blockers active',
                severity: milestoneStats.blocked >= 2 ? 'high' : 'medium',
                detail: `${milestoneStats.blocked} milestone${milestoneStats.blocked === 1 ? '' : 's'} blocked right now.`,
                category: 'Execution'
            });
        }

        if (milestoneStats.overdue > 0) {
            flags.push({
                id: 'tension-overdue-milestones',
                label: 'Deadlines slipping',
                severity: milestoneStats.overdue >= 2 ? 'high' : 'medium',
                detail: `${milestoneStats.overdue} overdue milestone${milestoneStats.overdue === 1 ? '' : 's'} need triage.`,
                category: 'Execution'
            });
        }

        if (drift.overall < -10 && alignment.physicalVitality < 45) {
            flags.push({
                id: 'tension-burnout',
                label: 'Burnout trajectory',
                severity: 'high',
                detail: 'Vitality is low while overall drift trends down.',
                category: 'Health'
            });
        }

        if (milestoneStats.active >= 4 && milestoneStats.overallCompletion < 40) {
            flags.push({
                id: 'tension-overextension',
                label: 'Overextension',
                severity: tensionSeverity(100 - milestoneStats.overallCompletion, 60, 35),
                detail: 'Too many active milestones with limited completion.',
                category: 'Operations'
            });
        }

        if (finance) {
            const pipeline = clamp(Number(finance.pipeline) || 0, 0, 1000000);
            const runway = clamp(Number(finance.runwayMonths) || Number(finance.runway) || 0, 0, 24);
            if (runway > 0 && runway < 4) {
                flags.push({
                    id: 'tension-income-instability',
                    label: 'Runway pressure',
                    severity: runway < 2 ? 'high' : 'medium',
                    detail: `Runway is ${runway.toFixed(1)} months.`,
                    category: 'Income'
                });
            } else if (pipeline && pipeline < (Number(finance.monthlyIncome) || 1) * 0.8) {
                flags.push({
                    id: 'tension-income-pipeline',
                    label: 'Pipeline under target',
                    severity: 'medium',
                    detail: 'Pipeline is below expected monthly demand.',
                    category: 'Income'
                });
            }
        }

        if (actionQueue.length > 0 && actionQueue[0].priority >= 80) {
            flags.push({
                id: 'tension-urgent-actions',
                label: 'Urgent action queue',
                severity: 'high',
                detail: `Top action: ${actionQueue[0].title}.`,
                category: 'Execution'
            });
        }

        return flags.slice(0, 5);
    }

    function buildRiskSignals(tensionFlags) {
        if (!tensionFlags.length) {
            return [{
                id: 'risk-stable',
                label: 'Risk profile stable',
                severity: 'low',
                detail: 'No significant tension detected.'
            }];
        }

        return tensionFlags.slice(0, 3).map((flag) => ({
            id: `risk-${flag.id}`,
            label: flag.label,
            severity: flag.severity,
            detail: flag.detail
        }));
    }

    function buildDecisionMomentum(decisions, nowTs) {
        const list = Array.isArray(decisions) ? decisions : [];
        if (!list.length) return 55;

        const maxAgeDays = 56;
        const decayWindowDays = 14;
        let weightedYes = 0;
        let weightedTotal = 0;

        list.forEach((entry) => {
            const ts = parseDate(entry && entry.createdAt);
            if (ts == null) return;
            const ageDays = Math.max(0, (nowTs - ts) / MS_PER_DAY);
            if (ageDays > maxAgeDays) return;
            const weight = Math.exp(-ageDays / decayWindowDays);
            weightedTotal += weight;
            if ((entry && entry.decision) === 'yes') {
                weightedYes += weight;
            }
        });

        if (weightedTotal > 0.0001) {
            return clamp(Math.round((weightedYes / weightedTotal) * 100), 0, 100);
        }

        const fallback = list.slice(-12);
        const yesCount = fallback.filter((entry) => (entry && entry.decision) === 'yes').length;
        return clamp(Math.round((yesCount / Math.max(1, fallback.length)) * 100), 0, 100);
    }

    function buildMomentum(milestoneStats, decisions, store, nowTs) {
        const committedBase = milestoneStats.committedCount > 0
            ? milestoneStats.committedCompletion
            : milestoneStats.overallCompletion;
        const milestoneMomentum = clamp(Math.round(committedBase), 0, 100);

        const decisionMomentum = buildDecisionMomentum(decisions, nowTs);

        let habitMomentum = 55;
        if (store && typeof store.getHabitCompletionRate === 'function') {
            const rate = store.getHabitCompletionRate();
            const ratio = rate.total ? (rate.done / rate.total) : 0;
            habitMomentum = clamp(Math.round(ratio * 100), 0, 100);
        }

        const activePool = Math.max(1, milestoneStats.active || 0);
        const overdueRate = clamp(milestoneStats.overdue / activePool, 0, 1);
        const blockedRate = clamp(milestoneStats.blocked / activePool, 0, 1);
        const commitmentPressurePenalty = clamp(Math.round((((overdueRate * 0.6) + (blockedRate * 0.4)) * 30)), 0, 30);
        const overall = clamp(Math.round(((milestoneMomentum * 0.45) + (decisionMomentum * 0.3) + (habitMomentum * 0.25)) - commitmentPressurePenalty), 0, 100);

        return {
            milestones: milestoneMomentum,
            decisions: decisionMomentum,
            habits: habitMomentum,
            overall
        };
    }

    function buildSuggestions(state, milestoneStats, riskSignals, actionQueue) {
        const themes = (Array.isArray(state.themes) ? state.themes : [])
            .slice()
            .sort((a, b) => (b.weight || 0) - (a.weight || 0));

        const pillars = themes.slice(0, 3).map((theme) => theme.label);
        while (pillars.length < 3) {
            pillars.push('Re-center your direction');
        }

        const commitments = [];
        const commitmentLabels = new Set();
        const milestones = Array.isArray(state.milestones) ? state.milestones : [];
        const milestonesById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
        const queuePriorityById = new Map((actionQueue || []).map((item) => [item.milestoneId, clamp(item.priority, 0, 100)]));

        function addCommitment(label) {
            const normalized = String(label || '').trim();
            if (!normalized) return;
            const key = normalized.toLowerCase();
            if (commitmentLabels.has(key)) return;
            commitmentLabels.add(key);
            commitments.push(normalized);
        }

        const weeklyCommitments = Array.from(new Set(Array.isArray(state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : []))
            .map((id) => milestonesById.get(id))
            .filter((milestone) => milestone && milestone.status !== 'done')
            .sort((a, b) => {
                const aPriority = queuePriorityById.get(a.id) || 0;
                const bPriority = queuePriorityById.get(b.id) || 0;
                if (bPriority !== aPriority) return bPriority - aPriority;
                return String(a.title || '').localeCompare(String(b.title || ''));
            });

        weeklyCommitments.forEach((milestone) => addCommitment(`Advance ${milestone.title}`));
        (actionQueue || []).forEach((item) => addCommitment(`Advance ${item.title}`));

        if (commitments.length < 3) {
            milestones
                .filter((milestone) => milestone && milestone.status !== 'done')
                .slice()
                .sort((a, b) => clamp(a.completionPct, 0, 100) - clamp(b.completionPct, 0, 100))
                .forEach((milestone) => addCommitment(`Advance ${milestone.title}`));
        }

        while (commitments.length < 3) {
            commitments.push(`Lean into ${pillars[commitments.length] || 'core focus'}`);
        }

        const risks = riskSignals.slice(0, 3).map((signal) => `${signal.label} · ${signal.detail}`);
        while (risks.length < 3) {
            risks.push('Track blockers before adding new commitments.');
        }

        return { pillars, commitments, risks };
    }

    function buildExplainability(state, milestoneStats, alignment, actionQueue, drift) {
        const driverRows = [];
        const total = milestoneStats.total;
        const completedPct = total > 0 ? Math.round((milestoneStats.completed / total) * 100) : 0;

        function addDriver(score, text) {
            if (!text) return;
            driverRows.push({ score: clamp(score, 0, 100), text: String(text) });
        }

        if (actionQueue[0]) {
            addDriver(100, `Top priority: ${actionQueue[0].title} (${actionQueue[0].reason}).`);
        }
        if (milestoneStats.overdue > 0) {
            addDriver(92, `${milestoneStats.overdue} overdue milestone${milestoneStats.overdue === 1 ? '' : 's'} requiring immediate triage.`);
        }
        if (milestoneStats.blocked > 0) {
            addDriver(88, `${milestoneStats.blocked} blocked milestone${milestoneStats.blocked === 1 ? '' : 's'} creating execution drag.`);
        }

        if (milestoneStats.active > 0 && milestoneStats.committedCount === 0) {
            addDriver(74, 'No weekly commitments selected from active milestones.');
        } else {
            addDriver(62, `Weekly commitments: ${milestoneStats.committedCount} active.`);
        }

        if (total > 0) {
            addDriver(60, `${milestoneStats.completed}/${total} milestones completed (${completedPct}%).`);
        }
        if (Math.abs(drift.overall || 0) >= 4) {
            addDriver(58, `Overall drift ${drift.overall >= 0 ? '+' : ''}${Math.round(drift.overall || 0)} since last compute.`);
        }

        const seen = new Set();
        const overall = driverRows
            .slice()
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return String(a.text).localeCompare(String(b.text));
            })
            .filter((row) => {
                const key = row.text.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 5)
            .map((row) => row.text);

        while (overall.length < 3) {
            if (overall.length === 0) {
                overall.push(`Overall alignment: ${Math.round(alignment.overall || 0)}.`);
            } else if (overall.length === 1) {
                overall.push(`Active milestones: ${milestoneStats.active}.`);
            } else {
                overall.push('Add or update milestones to improve action quality.');
            }
        }

        const targets = { ...defaultTargets(), ...(state.targets || {}) };
        const dimensions = {};

        DIMENSIONS.forEach((dimension) => {
            const target = clamp(targets[dimension.key], 0, 100);
            const typeCompletion = clamp(
                milestoneStats.typeCompletion[dimension.type] != null
                    ? milestoneStats.typeCompletion[dimension.type]
                    : milestoneStats.overallCompletion,
                0,
                100
            );
            dimensions[dimension.key] = [
                `Target: ${Math.round(target)}.`,
                `${dimension.type} completion: ${Math.round(typeCompletion)}%.`,
                `Current alignment: ${Math.round(alignment[dimension.key] || 0)} (${drift[dimension.key] >= 0 ? '+' : ''}${Math.round(drift[dimension.key] || 0)} drift).`
            ];
        });

        return { overall, dimensions };
    }

    function applyFocusIntegration(snapshot) {
        if (!snapshot) return;
        const focus = global.FocusEngine;
        if (!focus) return;

        const payload = {
            alignment: snapshot.alignment && snapshot.alignment.overall || 0,
            drift: snapshot.drift && snapshot.drift.overall || 0,
            momentum: snapshot.momentum && snapshot.momentum.overall || 0
        };

        try {
            if (typeof focus.adjustVisionWeights === 'function') {
                focus.adjustVisionWeights(payload);
            } else if (typeof focus.applyVisionSignals === 'function') {
                focus.applyVisionSignals(payload);
            }
        } catch (err) {
            console.warn('VisionEngine: Focus integration skipped', err);
        }
    }

    function applyVisualSynthIntegration(snapshot) {
        if (!snapshot) return;
        const synth = global.VisualSynthApp;
        if (!synth) return;

        const setter = typeof synth._setModuleParam === 'function' ? synth._setModuleParam.bind(synth) : null;
        if (!setter) return;

        try {
            const alignment = clamp(snapshot.alignment && snapshot.alignment.overall || 0, 0, 100) / 100;
            const momentum = clamp(snapshot.momentum && snapshot.momentum.overall || 0, 0, 100) / 100;
            setter('auroraRibbon.driftSpeed', 0.15 + alignment * 0.6);
            setter('bloomGlow.bloomStrength', 0.2 + momentum * 0.7);
            setter('blendStack.masterContrast', 0.65 + alignment * 0.3);
        } catch (err) {
            console.warn('VisionEngine: VisualSynth integration skipped', err);
        }
    }

    function compute(state, externalSignals) {
        const payload = externalSignals || {};
        const nowTs = Number.isFinite(Number(payload.now)) ? Number(payload.now) : Date.now();
        const store = payload.store || (global.Store || null);
        const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
        const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];
        const lastSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;

        const milestoneStats = buildMilestoneStats(state || {}, nowTs);
        const alignment = buildAlignment(state || {}, milestoneStats);
        const drift = buildDrift(alignment, lastSnapshot ? lastSnapshot.alignment : null);
        const actionQueue = buildActionQueue(state || {}, milestoneStats, nowTs);
        const tensionFlags = buildTensionFlags(
            alignment,
            drift,
            milestoneStats,
            store && typeof store.getFinance === 'function' ? store.getFinance() : null,
            actionQueue
        );
        const riskSignals = buildRiskSignals(tensionFlags);
        const momentum = buildMomentum(milestoneStats, decisions, store, nowTs);
        const suggestions = buildSuggestions(state || {}, milestoneStats, riskSignals, actionQueue);
        const explainability = buildExplainability(state || {}, milestoneStats, alignment, actionQueue, drift);

        const snapshot = {
            computedAt: new Date(nowTs).toISOString(),
            alignment,
            drift,
            tensionFlags,
            riskSignals,
            momentum,
            suggestedCommitments: suggestions.commitments,
            suggestedPillars: suggestions.pillars,
            suggestedRisks: suggestions.risks,
            actionQueue,
            explainability
        };

        applyFocusIntegration(snapshot);
        applyVisualSynthIntegration(snapshot);

        return snapshot;
    }

    function getWeekBounds(referenceDate) {
        const ref = new Date(referenceDate || Date.now());
        const weekday = ref.getDay();
        const offset = (weekday + 6) % 7;
        const start = new Date(ref);
        start.setDate(ref.getDate() - offset);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    function getWeeklyInsights(decisions, snapshots, milestones, referenceDate) {
        const sortedSnapshots = Array.isArray(snapshots)
            ? snapshots.slice().sort((a, b) => new Date(a.computedAt) - new Date(b.computedAt))
            : [];
        const allMilestones = Array.isArray(milestones) ? milestones : [];
        const allDecisions = Array.isArray(decisions) ? decisions : [];

        const bounds = getWeekBounds(referenceDate);

        const weekSnapshots = sortedSnapshots.filter((snapshot) => {
            const ts = new Date(snapshot.computedAt).getTime();
            return ts >= bounds.start.getTime() && ts <= bounds.end.getTime();
        });

        const earliest = weekSnapshots[0] || weekSnapshots[weekSnapshots.length - 1] || null;
        const latest = weekSnapshots[weekSnapshots.length - 1] || earliest;

        const alignmentDelta = latest && earliest
            ? clamp(round((latest.alignment && latest.alignment.overall || 0) - (earliest.alignment && earliest.alignment.overall || 0)), -100, 100)
            : 0;

        const driftDelta = latest && earliest
            ? clamp(round((latest.drift && latest.drift.overall || 0) - (earliest.drift && earliest.drift.overall || 0)), -100, 100)
            : 0;

        const weekDecisions = allDecisions.filter((entry) => {
            const ts = new Date(entry.createdAt).getTime();
            return ts >= bounds.start.getTime() && ts <= bounds.end.getTime();
        });

        const decisionCount = weekDecisions.length;
        const alignedCount = weekDecisions.filter((entry) => entry.decision === 'yes').length;

        const weekMilestones = allMilestones.filter((milestone) => {
            const ts = new Date(milestone.updatedAt || milestone.createdAt || 0).getTime();
            return ts >= bounds.start.getTime() && ts <= bounds.end.getTime();
        });

        const milestonesCompleted = weekMilestones.filter((milestone) => milestone.status === 'done').length;

        return {
            alignmentDelta,
            driftDelta,
            decisionCount,
            alignedCount,
            milestonesMoved: weekMilestones.length,
            milestonesCompleted
        };
    }

    global.VisionEngine = {
        version: ENGINE_VERSION,
        compute,
        getWeeklyInsights
    };
})(window);
