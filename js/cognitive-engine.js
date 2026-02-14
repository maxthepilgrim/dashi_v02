/* ========================================
   Life OS - Cognitive Engine (Deterministic Inference)
   ======================================== */

(function (global) {
    'use strict';

    var ENGINE_VERSION = '1.0';

    function clamp(value, min, max) {
        var num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function round(value, digits) {
        var factor = Math.pow(10, digits || 2);
        return Math.round((Number(value) || 0) * factor) / factor;
    }

    function safeObject(value) {
        return value && typeof value === 'object' ? value : {};
    }

    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function toTimestamp(value) {
        if (!value) return null;
        var ts = new Date(value).getTime();
        return Number.isFinite(ts) ? ts : null;
    }

    function daysSince(value, nowTs) {
        var ts = toTimestamp(value);
        if (ts == null) return null;
        return Math.max(0, Math.floor((nowTs - ts) / (24 * 60 * 60 * 1000)));
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function getMode() {
        try {
            if (global.ModeManager && typeof global.ModeManager.getMode === 'function') {
                return global.ModeManager.getMode();
            }
            var stored = localStorage.getItem('lifeos-mode');
            if (stored === 'personal' || stored === 'business' || stored === 'vision' || stored === 'ritual') {
                return stored;
            }
        } catch (e) {
            // no-op
        }
        return 'personal';
    }

    function normalizeSignal(value) {
        return round(clamp(value, 0, 1), 3);
    }

    function normalizePulse(value) {
        return Math.round(clamp(value, 0, 100));
    }

    function createReason(signal, direction, weight, text) {
        return {
            signal: signal,
            direction: direction,
            weight: round(clamp(weight, 0, 1), 3),
            text: String(text || '')
        };
    }

    function emptyCognitiveState(mode, timestampIso) {
        var ts = timestampIso || nowIso();
        return {
            version: '1.0',
            timestamp: ts,
            mode: mode || 'personal',
            signals: {
                lifePulse: 0,
                stress: 0,
                energy: 0,
                rhythm: 0,
                finance: 0,
                creativeMomentum: 0,
                relationshipWarmth: 0
            },
            states: {
                systemMode: 'EXPLORE',
                riskLevel: 'LOW',
                primaryConstraint: 'CLARITY',
                dominantLoop: 'NEUTRAL',
                friction: []
            },
            recommendations: {
                top: [],
                secondary: [],
                avoid: []
            },
            focusDecision: {
                suggestedProjectId: null,
                suggestionType: 'MAINTENANCE',
                why: ['No strong focus signal yet.']
            },
            alerts: [],
            explainability: {
                narrative: 'Data is still sparse. Start with one small maintenance action.',
                keyDrivers: ['Insufficient signals']
            }
        };
    }

    function computeVisionAlignment(v2) {
        var northStar = safeObject(v2.northStar);
        var reflection = safeObject(v2.reflection);

        var focusScore = String(northStar.focus || '').trim() ? 1 : 0;
        var intentionScore = String(northStar.intention || '').trim() ? 1 : 0;
        var priorities = safeArray(northStar.priorities).filter(function (item) {
            return String(item || '').trim().length > 0;
        }).length;
        var prioritiesScore = clamp(priorities / 3, 0, 1);

        var reflectionFields = [reflection.win, reflection.lesson, reflection.nextShift]
            .filter(function (value) {
                return String(value || '').trim().length > 0;
            }).length;
        var reflectionScore = clamp(reflectionFields / 3, 0, 1);

        return normalizeSignal(
            (focusScore * 0.35) +
            (intentionScore * 0.2) +
            (prioritiesScore * 0.25) +
            (reflectionScore * 0.2)
        );
    }

    function computeCreativeInactivityDays(v2, nowTs) {
        var compass = safeObject(v2.creativeCompass);
        var latestTs = null;

        safeArray(compass.dailyLog).forEach(function (entry) {
            var ts = toTimestamp(entry && entry.date);
            if (ts != null && (latestTs == null || ts > latestTs)) latestTs = ts;
        });

        safeArray(compass.projects).forEach(function (project) {
            var ts = toTimestamp(project && project.lastActivityDate);
            if (ts != null && (latestTs == null || ts > latestTs)) latestTs = ts;
        });

        if (latestTs == null) return 30;
        return Math.max(0, Math.floor((nowTs - latestTs) / (24 * 60 * 60 * 1000)));
    }

    function computeRelationshipInactivityDays(v2, nowTs) {
        var people = safeArray(v2.people);
        var dateKeys = ['lastContact', 'lastContactAt', 'lastInteraction', 'updatedAt', 'date'];
        var freshestTs = null;

        people.forEach(function (person) {
            var personObj = safeObject(person);
            dateKeys.some(function (key) {
                var ts = toTimestamp(personObj[key]);
                if (ts != null) {
                    if (freshestTs == null || ts > freshestTs) freshestTs = ts;
                    return true;
                }
                return false;
            });
        });

        if (freshestTs == null) return 14;
        return Math.max(0, Math.floor((nowTs - freshestTs) / (24 * 60 * 60 * 1000)));
    }

    function resolveSignals(derived, v2) {
        var nodes = safeObject(derived.nodes);
        var metrics = safeObject(derived.metrics);
        var derivedSignals = safeObject(derived.signals);

        var lifePulse = normalizePulse(metrics.lifePulse);
        var stress = normalizeSignal(derivedSignals.stress != null ? derivedSignals.stress : metrics.stressScore);
        var energy = normalizeSignal((safeObject(nodes.health).score != null ? nodes.health.score : metrics.healthScore));
        var rhythm = normalizeSignal(metrics.rhythmScore);
        var finance = normalizeSignal(metrics.financeScore);
        var creativeMomentum = normalizeSignal(metrics.creativeMomentum);
        var relationshipWarmth = normalizeSignal(metrics.relationshipScore);
        var recovery = normalizeSignal(derivedSignals.recovery);

        return {
            lifePulse: lifePulse,
            stress: stress,
            energy: energy,
            rhythm: rhythm,
            finance: finance,
            creativeMomentum: creativeMomentum,
            relationshipWarmth: relationshipWarmth,
            recovery: recovery,
            visionAlignment: computeVisionAlignment(v2)
        };
    }

    function collectInputs(storeOverride) {
        var store = storeOverride || global.Store;
        var mode = getMode();
        var timestampIso = nowIso();

        if (!store || typeof store.getV2Data !== 'function' || typeof store.getDerivedState !== 'function') {
            return {
                timestamp: timestampIso,
                mode: mode,
                v2: {},
                derived: {},
                signals: resolveSignals({}, {}),
                baselines: { lifePulseAvg7d: 50, stressAvg7d: 0.5 },
                trends: {
                    rhythmDrop: 0,
                    stressAboveBaseline: 0,
                    lifePulseVsBaseline: 0
                },
                meta: {
                    creativeInactivityDays: 30,
                    relationshipInactivityDays: 14,
                    repeatedConstraint: 'CLARITY'
                }
            };
        }

        var v2 = safeObject(store.getV2Data());
        var derived = safeObject(store.getDerivedState());
        var signals = resolveSignals(derived, v2);

        var baselines = { lifePulseAvg7d: 50, stressAvg7d: 0.5 };
        var repeatedConstraint = 'CLARITY';
        var lastState = null;

        if (global.CognitiveMemory) {
            try {
                if (typeof global.CognitiveMemory.getBaselines === 'function') {
                    baselines = safeObject(global.CognitiveMemory.getBaselines());
                }
                if (typeof global.CognitiveMemory.getMostRepeatedConstraint === 'function') {
                    repeatedConstraint = global.CognitiveMemory.getMostRepeatedConstraint() || 'CLARITY';
                }
                if (typeof global.CognitiveMemory.readLastState === 'function') {
                    lastState = global.CognitiveMemory.readLastState();
                }
            } catch (e) {
                // no-op
            }
        }

        var prevRhythm = lastState && lastState.signals ? Number(lastState.signals.rhythm) : null;
        var rhythmDrop = prevRhythm == null ? 0 : clamp(prevRhythm - signals.rhythm, 0, 1);

        return {
            timestamp: timestampIso,
            mode: mode,
            v2: v2,
            derived: derived,
            signals: signals,
            baselines: {
                lifePulseAvg7d: normalizePulse(baselines.lifePulseAvg7d),
                stressAvg7d: normalizeSignal(baselines.stressAvg7d)
            },
            trends: {
                rhythmDrop: normalizeSignal(rhythmDrop),
                stressAboveBaseline: round(signals.stress - normalizeSignal(baselines.stressAvg7d), 3),
                lifePulseVsBaseline: round(signals.lifePulse - normalizePulse(baselines.lifePulseAvg7d), 2)
            },
            meta: {
                creativeInactivityDays: computeCreativeInactivityDays(v2, Date.now()),
                relationshipInactivityDays: computeRelationshipInactivityDays(v2, Date.now()),
                repeatedConstraint: repeatedConstraint
            }
        };
    }

    function detectPrimaryConstraint(signals, mode) {
        var deficits = {
            ENERGY: clamp(1 - signals.energy, 0, 1),
            TIME: clamp(1 - signals.rhythm, 0, 1),
            MONEY: clamp(1 - signals.finance, 0, 1),
            CLARITY: clamp((signals.stress * 0.6) + ((1 - signals.creativeMomentum) * 0.4), 0, 1),
            SOCIAL: clamp(1 - signals.relationshipWarmth, 0, 1)
        };

        if (mode === 'business') deficits.MONEY = clamp(deficits.MONEY + 0.05, 0, 1);
        if (mode === 'ritual') deficits.ENERGY = clamp(deficits.ENERGY + 0.05, 0, 1);

        var winner = 'CLARITY';
        var best = -1;

        Object.keys(deficits).forEach(function (key) {
            if (deficits[key] > best) {
                best = deficits[key];
                winner = key;
            }
        });

        return {
            primary: winner,
            deficits: deficits
        };
    }

    function detectSystemMode(signals, riskScore) {
        if (signals.stress >= 0.85 && signals.energy <= 0.35) return 'SURVIVE';
        if (riskScore >= 0.68 || signals.energy <= 0.34) return 'RECOVER';
        if (signals.lifePulse >= 72 && signals.stress <= 0.42 && signals.rhythm >= 0.6) return 'FLOW';
        if ((signals.creativeMomentum >= 0.55 || signals.finance >= 0.55) && signals.stress <= 0.6 && signals.energy >= 0.45) {
            return 'BUILD';
        }
        return 'EXPLORE';
    }

    function detectStates(input) {
        var signals = input.signals;
        var constraint = detectPrimaryConstraint(signals, input.mode);

        var riskScore = clamp(
            (signals.stress * 0.42) +
            ((1 - signals.finance) * 0.25) +
            ((1 - signals.energy) * 0.18) +
            ((1 - signals.rhythm) * 0.15),
            0,
            1
        );

        var riskLevel = 'LOW';
        if (riskScore >= 0.67) riskLevel = 'HIGH';
        else if (riskScore >= 0.38) riskLevel = 'MEDIUM';

        var systemMode = detectSystemMode(signals, riskScore);

        var dominantLoop = 'NEUTRAL';
        if (signals.lifePulse >= 70 && signals.stress <= 0.45) dominantLoop = 'POSITIVE';
        if (riskLevel === 'HIGH' || (signals.stress >= 0.7 && signals.rhythm <= 0.45)) dominantLoop = 'NEGATIVE';

        return {
            systemMode: systemMode,
            riskLevel: riskLevel,
            primaryConstraint: constraint.primary,
            dominantLoop: dominantLoop,
            friction: [],
            _constraintDeficits: constraint.deficits,
            _riskScore: riskScore
        };
    }

    function addBoost(effects, actionId, boostValue) {
        var current = effects.recommendationBoosts[actionId] || 0;
        effects.recommendationBoosts[actionId] = round(current + boostValue, 4);
    }

    function addReasonForAction(effects, actionId, reasonObj, scale) {
        if (!effects.actionReasons[actionId]) effects.actionReasons[actionId] = [];
        effects.actionReasons[actionId].push({
            signal: reasonObj.signal,
            direction: reasonObj.direction,
            weight: round(clamp(reasonObj.weight * scale, 0, 1), 3),
            text: reasonObj.text
        });
    }

    function detectFrictions(input, states) {
        var rules = global.CognitiveRules && Array.isArray(global.CognitiveRules.rules)
            ? global.CognitiveRules.rules
            : [];

        var frictionMap = {};
        var effects = {
            stateTags: {},
            recommendationBoosts: {},
            recommendationBlocks: {},
            focusBias: {
                RECOVERY: 0,
                CREATIVE: 0,
                BUSINESS: 0,
                MAINTENANCE: 0
            },
            actionReasons: {}
        };

        var matches = [];
        var context = {
            mode: input.mode,
            meta: input.meta,
            trends: input.trends,
            states: states
        };

        rules.forEach(function (rule) {
            if (!rule || typeof rule.when !== 'function') return;

            var matched = false;
            try {
                matched = !!rule.when(input.signals, input.v2, context);
            } catch (e) {
                matched = false;
            }
            if (!matched) return;

            var severity = 0;
            try {
                severity = clamp(rule.severity ? rule.severity(input.signals, input.v2, context) : 0.5, 0, 1);
            } catch (e) {
                severity = 0.5;
            }
            if (severity <= 0.01) return;

            var reasons = [];
            try {
                reasons = safeArray(rule.reasons ? rule.reasons(input.signals, input.v2, context) : []);
            } catch (e) {
                reasons = [];
            }

            matches.push({
                id: String(rule.id || 'rule'),
                severity: round(severity, 3),
                reasons: reasons
            });

            var produces = safeObject(rule.produces);

            safeArray(produces.stateTags).forEach(function (tag) {
                effects.stateTags[String(tag)] = true;
            });

            safeArray(produces.frictions).forEach(function (item) {
                var entry = safeObject(item);
                var id = String(entry.id || rule.id || 'friction');
                var weightedSeverity = round(clamp(severity * clamp(entry.weight != null ? entry.weight : 1, 0, 1), 0, 1), 3);
                if (!frictionMap[id] || weightedSeverity > frictionMap[id].severity) {
                    frictionMap[id] = {
                        id: id,
                        severity: weightedSeverity,
                        title: String(entry.title || 'System Friction'),
                        description: String(entry.description || 'A constraint was detected in the current system state.')
                    };
                }
            });

            var boosts = safeObject(produces.recommendationBoosts);
            Object.keys(boosts).forEach(function (actionId) {
                var boost = clamp(boosts[actionId], -1, 1);
                if (boost === 0) return;
                addBoost(effects, actionId, boost * severity);
                reasons.forEach(function (reasonObj) {
                    addReasonForAction(effects, actionId, safeObject(reasonObj), severity);
                });
            });

            var blocks = safeObject(produces.recommendationBlocks);
            Object.keys(blocks).forEach(function (actionId) {
                if (!blocks[actionId]) return;
                if (severity < 0.35) return;
                effects.recommendationBlocks[actionId] = true;
            });

            var focusBias = safeObject(produces.focusBias);
            if (focusBias.type && effects.focusBias[focusBias.type] != null) {
                effects.focusBias[focusBias.type] = round(
                    effects.focusBias[focusBias.type] + clamp(focusBias.weight, 0, 1) * severity,
                    3
                );
            }
        });

        var frictions = Object.keys(frictionMap)
            .map(function (id) { return frictionMap[id]; })
            .sort(function (a, b) { return b.severity - a.severity; })
            .slice(0, 8);

        return {
            frictions: frictions,
            effects: effects,
            matches: matches
        };
    }

    var ACTION_LIBRARY = [
        {
            id: 'RECOVERY_RESET_5',
            type: 'RITUAL',
            title: '5-minute recovery reset',
            instruction: 'Close loops for 5 minutes: two deep breaths, drink water, and define one next action.',
            durationMin: 5,
            difficulty: 0.15,
            baseScore: 0.5,
            tags: { RECOVERY: true, CLARITY: true, MAINTENANCE: true },
            relatedWidgets: ['dailyRhythm', 'dailyState', 'creativeCompass'],
            eligible: function () { return true; },
            impact: function (signals) {
                return {
                    lifePulseDelta: round(2 + (signals.stress * 4), 1),
                    stressDelta: round(-0.08 - (signals.stress * 0.08), 2)
                };
            }
        },
        {
            id: 'DEEP_WORK_25',
            type: 'FOCUS',
            title: '25-minute deep work sprint',
            instruction: 'Run one Pomodoro on the single highest-leverage task with notifications off.',
            durationMin: 25,
            difficulty: 0.52,
            baseScore: 0.52,
            tags: { CREATIVE: true, BUILD: true, REVENUE: true },
            relatedWidgets: ['creativeCompass', 'northStar', 'dailyRhythm'],
            eligible: function (signals) {
                return signals.energy >= 0.32 && signals.stress <= 0.82;
            },
            impact: function (signals) {
                var stressShift = signals.stress <= 0.6 ? -0.04 : 0.02;
                return {
                    lifePulseDelta: round(5 + (signals.creativeMomentum * 3), 1),
                    stressDelta: round(stressShift, 2)
                };
            }
        },
        {
            id: 'FINANCE_CHECKIN_15',
            type: 'FINANCE',
            title: '15-minute finance check-in',
            instruction: 'Review balance, runway, and upcoming invoices, then choose one concrete money move.',
            durationMin: 15,
            difficulty: 0.34,
            baseScore: 0.44,
            tags: { FINANCE: true, MAINTENANCE: true },
            relatedWidgets: ['financeOverview', 'revenueEngine', 'bizFinance'],
            eligible: function () { return true; },
            impact: function (signals) {
                var financeDeficit = 1 - signals.finance;
                return {
                    lifePulseDelta: round(2 + (financeDeficit * 4), 1),
                    stressDelta: round(-0.03 - (financeDeficit * 0.07), 2)
                };
            }
        },
        {
            id: 'RELATIONSHIP_PING_10',
            type: 'RELATIONSHIP',
            title: '10-minute relationship ping',
            instruction: 'Send one genuine check-in message to someone important and suggest a concrete follow-up.',
            durationMin: 10,
            difficulty: 0.25,
            baseScore: 0.37,
            tags: { SOCIAL: true, MAINTENANCE: true },
            relatedWidgets: ['people', 'dailyRhythm'],
            eligible: function () { return true; },
            impact: function (signals) {
                return {
                    lifePulseDelta: round(1.5 + ((1 - signals.relationshipWarmth) * 3), 1),
                    stressDelta: round(-0.02 - ((1 - signals.relationshipWarmth) * 0.04), 2)
                };
            }
        },
        {
            id: 'CLARIFY_NEXT_STEP_5',
            type: 'RITUAL',
            title: '5-minute clarify-next-step ritual',
            instruction: 'Write the next physical action, success criterion, and first 2-minute starter move.',
            durationMin: 5,
            difficulty: 0.18,
            baseScore: 0.46,
            tags: { CLARITY: true, MAINTENANCE: true },
            relatedWidgets: ['creativeCompass', 'northStar', 'dailyRhythm'],
            eligible: function () { return true; },
            impact: function (signals) {
                return {
                    lifePulseDelta: round(2 + (signals.stress * 2.5), 1),
                    stressDelta: round(-0.05 - (signals.stress * 0.04), 2)
                };
            }
        },
        {
            id: 'ADMIN_WINDOW_15',
            type: 'ACTION',
            title: '15-minute admin window',
            instruction: 'Clear one inbox cluster or operational task batch to reduce hidden friction.',
            durationMin: 15,
            difficulty: 0.3,
            baseScore: 0.39,
            tags: { MAINTENANCE: true, TIME: true },
            relatedWidgets: ['dailyRhythm', 'systemHealth'],
            eligible: function () { return true; },
            impact: function () {
                return {
                    lifePulseDelta: 2,
                    stressDelta: -0.04
                };
            }
        },
        {
            id: 'CREATIVE_SPRINT_45',
            type: 'CREATIVE',
            title: '45-minute creative sprint',
            instruction: 'Ship one meaningful creative chunk without context switching.',
            durationMin: 45,
            difficulty: 0.7,
            baseScore: 0.35,
            tags: { CREATIVE: true, BUILD: true },
            relatedWidgets: ['creativeCompass', 'northStar'],
            eligible: function (signals) {
                return signals.energy >= 0.5 && signals.stress <= 0.68;
            },
            impact: function (signals) {
                return {
                    lifePulseDelta: round(6 + (signals.creativeMomentum * 3), 1),
                    stressDelta: round(signals.stress > 0.55 ? 0.03 : -0.02, 2)
                };
            }
        },
        {
            id: 'WALK_RESET_10',
            type: 'RITUAL',
            title: '10-minute reset walk',
            instruction: 'Take a short outside walk with no phone multitasking and return with one intent.',
            durationMin: 10,
            difficulty: 0.22,
            baseScore: 0.36,
            tags: { RECOVERY: true, MAINTENANCE: true },
            relatedWidgets: ['dailyRhythm', 'sport', 'dailyState'],
            eligible: function () { return true; },
            impact: function (signals) {
                return {
                    lifePulseDelta: round(2.5 + (signals.stress * 2), 1),
                    stressDelta: round(-0.04 - (signals.stress * 0.06), 2)
                };
            }
        }
    ];

    function modeBias(action, mode) {
        if (mode === 'business') {
            if (action.tags.FINANCE || action.tags.REVENUE) return 0.14;
            if (action.tags.BUILD) return 0.08;
            if (action.tags.SOCIAL) return -0.02;
        }
        if (mode === 'vision') {
            if (action.tags.CLARITY || action.tags.CREATIVE) return 0.1;
            if (action.tags.MAINTENANCE && !action.tags.CLARITY) return -0.02;
        }
        if (mode === 'ritual') {
            if (action.tags.RECOVERY || action.type === 'RITUAL') return 0.11;
        }
        return 0;
    }

    function constraintBias(action, primaryConstraint) {
        if (primaryConstraint === 'ENERGY') {
            if (action.tags.RECOVERY) return 0.2;
            if (action.difficulty >= 0.6) return -0.14;
        }
        if (primaryConstraint === 'TIME') {
            if (action.tags.MAINTENANCE || action.tags.CLARITY) return 0.12;
            if (action.durationMin >= 45) return -0.08;
        }
        if (primaryConstraint === 'MONEY') {
            if (action.tags.FINANCE || action.tags.REVENUE) return 0.22;
            if (action.tags.CREATIVE && !action.tags.REVENUE) return -0.07;
        }
        if (primaryConstraint === 'CLARITY') {
            if (action.tags.CLARITY) return 0.2;
        }
        if (primaryConstraint === 'SOCIAL') {
            if (action.tags.SOCIAL) return 0.2;
        }
        return 0;
    }

    function systemModeBias(action, systemMode) {
        if (systemMode === 'SURVIVE' || systemMode === 'RECOVER') {
            if (action.tags.RECOVERY || action.tags.CLARITY) return 0.2;
            if (action.difficulty >= 0.5) return -0.12;
        }
        if (systemMode === 'FLOW' || systemMode === 'BUILD') {
            if (action.tags.BUILD || action.tags.CREATIVE || action.tags.REVENUE) return 0.1;
            if (action.tags.MAINTENANCE && !action.tags.CLARITY) return -0.04;
        }
        return 0;
    }

    function estimateConfidence(score, reasons, difficulty) {
        var avgReason = 0;
        if (reasons.length) {
            avgReason = reasons.reduce(function (sum, item) {
                return sum + clamp(item.weight, 0, 1);
            }, 0) / reasons.length;
        }
        return round(clamp((score * 0.65) + (avgReason * 0.25) + ((1 - difficulty) * 0.1), 0, 1), 3);
    }

    function normalizeImpact(impact) {
        var safeImpact = safeObject(impact);
        return {
            lifePulseDelta: round(clamp(safeImpact.lifePulseDelta, -10, 10), 1),
            stressDelta: round(clamp(safeImpact.stressDelta, -0.2, 0.2), 2)
        };
    }

    function selectRecommendations(input, states, frictionBundle) {
        var effects = frictionBundle.effects;
        var topCandidates = [];
        var avoid = [];

        ACTION_LIBRARY.forEach(function (action) {
            if (!action.eligible(input.signals, input.v2, input)) return;

            if (effects.recommendationBlocks[action.id]) {
                avoid.push({
                    id: action.id,
                    type: action.type,
                    title: action.title,
                    instruction: 'Avoid this right now; it conflicts with your current system constraints.',
                    reasons: [createReason('risk', 'HIGH', 0.65, 'Current state suggests a lower-intensity action first.')],
                    relatedWidgets: action.relatedWidgets
                });
                return;
            }

            var reasons = [];
            var score = action.baseScore;

            var boost = effects.recommendationBoosts[action.id] || 0;
            if (boost !== 0) {
                score += boost;
                safeArray(effects.actionReasons[action.id]).forEach(function (item) {
                    reasons.push(item);
                });
            }

            var mBias = modeBias(action, input.mode);
            if (mBias !== 0) {
                score += mBias;
                reasons.push(createReason('mode', mBias > 0 ? 'MATCH' : 'MISMATCH', Math.abs(mBias), 'Adjusted for current mode context.'));
            }

            var cBias = constraintBias(action, states.primaryConstraint);
            if (cBias !== 0) {
                score += cBias;
                reasons.push(createReason('constraint', cBias > 0 ? 'PRIORITY' : 'DEPRIORITY', Math.abs(cBias), 'Adjusted for current primary constraint.'));
            }

            var sBias = systemModeBias(action, states.systemMode);
            if (sBias !== 0) {
                score += sBias;
                reasons.push(createReason('systemMode', sBias > 0 ? 'FIT' : 'MISMATCH', Math.abs(sBias), 'Adjusted for current system mode.'));
            }

            if (input.trends.stressAboveBaseline > 0.12 && action.tags.RECOVERY) {
                score += 0.12;
                reasons.push(createReason('stress', 'ABOVE_BASELINE', 0.56, 'Stress is above your baseline, so recovery gets priority.'));
            }

            var memoryBoost = 0;
            var memoryPenalty = 0;
            if (global.CognitiveMemory) {
                try {
                    if (typeof global.CognitiveMemory.getActionScoreAdjustment === 'function') {
                        memoryBoost = global.CognitiveMemory.getActionScoreAdjustment(action.id);
                    }
                    if (typeof global.CognitiveMemory.getRecentRecommendationPenalty === 'function') {
                        memoryPenalty = global.CognitiveMemory.getRecentRecommendationPenalty(action.id);
                    }
                } catch (e) {
                    memoryBoost = 0;
                    memoryPenalty = 0;
                }
            }

            score += memoryBoost;
            score += memoryPenalty;

            if (memoryBoost > 0) {
                reasons.push(createReason('feedback', 'ACCEPTED', Math.abs(memoryBoost), 'You tend to accept this action type.'));
            }
            if (memoryPenalty < 0) {
                reasons.push(createReason('feedback', 'IGNORED', Math.abs(memoryPenalty), 'This action was recently recommended or ignored.'));
            }

            score = round(clamp(score, 0, 1), 4);
            if (score <= 0.05) return;

            var sortedReasons = reasons
                .filter(function (item) {
                    return item && item.text;
                })
                .sort(function (a, b) {
                    return (b.weight || 0) - (a.weight || 0);
                })
                .slice(0, 4);

            topCandidates.push({
                id: action.id,
                type: action.type,
                title: action.title,
                instruction: action.instruction,
                durationMin: action.durationMin,
                difficulty: round(clamp(action.difficulty, 0, 1), 3),
                expectedImpact: normalizeImpact(action.impact(input.signals, states, input)),
                reasons: sortedReasons,
                relatedWidgets: action.relatedWidgets,
                confidence: estimateConfidence(score, sortedReasons, action.difficulty),
                _score: score,
                _tags: action.tags
            });
        });

        topCandidates.sort(function (a, b) {
            if (b._score !== a._score) return b._score - a._score;
            if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
            return a.id.localeCompare(b.id);
        });

        var top = topCandidates.slice(0, 3).map(function (item) {
            delete item._score;
            delete item._tags;
            return item;
        });

        var secondary = topCandidates.slice(3, 6).map(function (item) {
            delete item._score;
            delete item._tags;
            return item;
        });

        return {
            top: top,
            secondary: secondary,
            avoid: avoid.slice(0, 3),
            _rawRanked: topCandidates
        };
    }

    function chooseCreativeProject(v2, input, states, focusBias) {
        var projects = safeArray(safeObject(v2.creativeCompass).projects)
            .filter(function (project) { return !project.archived; });

        if (!projects.length) return null;

        var stageWeights = {
            SEED: 0.45,
            GROWING: 0.58,
            FORMING: 0.68,
            RELEASING: 0.78,
            RESTING: 0.2
        };

        var nowTs = Date.now();
        var winner = null;

        projects.forEach(function (project) {
            var priority = clamp((Number(project.priorityWeight) || 0) / 10, 0, 1);
            var inactivity = clamp((daysSince(project.lastActivityDate, nowTs) || 0) / 21, 0, 1);
            var stage = stageWeights[String(project.stage || '').toUpperCase()] || 0.5;

            var score = (stage * 0.45) + (priority * 0.3) + (inactivity * 0.25);
            if (input.mode !== 'business') score += 0.05;
            if (states.primaryConstraint === 'MONEY') score -= 0.08;
            score += clamp(focusBias.CREATIVE, 0, 1);

            if (!winner || score > winner.score) {
                winner = {
                    id: project.id || null,
                    name: project.name || 'Creative Project',
                    score: score,
                    inactivityDays: Math.round(inactivity * 21)
                };
            }
        });

        return winner;
    }

    function chooseBusinessProject(v2, input, states, focusBias) {
        var projects = safeArray(v2.bizProjects);
        if (!projects.length) return null;

        var winner = null;
        projects.forEach(function (project) {
            var leverage = clamp((Number(project.leverage) || 0) / 10, 0, 1);
            var status = String(project.status || '').toLowerCase();
            var active = status.indexOf('active') !== -1 ? 1 : 0.55;

            var score = (leverage * 0.55) + (active * 0.25);
            score += input.mode === 'business' ? 0.2 : 0.05;
            if (states.primaryConstraint === 'MONEY') score += 0.18;
            score += clamp(focusBias.BUSINESS, 0, 1);

            if (!winner || score > winner.score) {
                winner = {
                    id: project.id || null,
                    name: project.name || 'Business Project',
                    score: score
                };
            }
        });

        return winner;
    }

    function focusDecision(input, states, frictionBundle, recommendations) {
        var bias = frictionBundle.effects.focusBias;

        if (states.systemMode === 'SURVIVE' || states.systemMode === 'RECOVER' || bias.RECOVERY >= 0.45) {
            return {
                suggestedProjectId: null,
                suggestionType: 'RECOVERY',
                why: [
                    'Stress and recovery signals indicate stabilizing first.',
                    'A short reset before project work will improve decision quality.'
                ]
            };
        }

        var creative = chooseCreativeProject(input.v2, input, states, bias);
        var business = chooseBusinessProject(input.v2, input, states, bias);

        if (states.primaryConstraint === 'MONEY' && business && business.id) {
            return {
                suggestedProjectId: business.id,
                suggestionType: 'BUSINESS',
                why: [
                    'Money is the primary constraint right now.',
                    'Best leverage business project: ' + business.name + '.'
                ]
            };
        }

        if (creative && creative.id && (!business || creative.score >= (business.score - 0.05) || input.mode !== 'business')) {
            return {
                suggestedProjectId: creative.id,
                suggestionType: 'CREATIVE',
                why: [
                    'Creative focus has the strongest expected system impact.',
                    'Selected project: ' + creative.name + '.'
                ]
            };
        }

        if (business && business.id) {
            return {
                suggestedProjectId: business.id,
                suggestionType: 'BUSINESS',
                why: [
                    'Business focus is currently favored by your constraints.',
                    'Selected project: ' + business.name + '.'
                ]
            };
        }

        if (safeArray(recommendations.top).length) {
            return {
                suggestedProjectId: null,
                suggestionType: 'MAINTENANCE',
                why: [
                    'No project has a clear lead right now.',
                    'Start with: ' + recommendations.top[0].title + '.'
                ]
            };
        }

        return {
            suggestedProjectId: null,
            suggestionType: 'MAINTENANCE',
            why: ['No strong focus signal yet.']
        };
    }

    function buildAlerts(input, states, recommendations) {
        var alerts = [];
        var signals = input.signals;

        if (states.riskLevel === 'HIGH' && signals.stress >= 0.88 && signals.energy <= 0.33) {
            alerts.push({
                id: 'alert-overload-critical',
                severity: 'CRITICAL',
                title: 'Overload risk is high',
                message: 'Pause for a brief recovery action before high-friction tasks.',
                relatedSignals: ['stress', 'energy'],
                suggestedActionId: recommendations.top[0] ? recommendations.top[0].id : null
            });
        }

        if (signals.finance <= 0.2) {
            alerts.push({
                id: 'alert-finance-instability',
                severity: alerts.some(function (a) { return a.severity === 'CRITICAL'; }) ? 'WARN' : 'CRITICAL',
                title: 'Finance stability is low',
                message: 'Run a short finance check-in and lock one cash-protecting move.',
                relatedSignals: ['finance', 'stress'],
                suggestedActionId: 'FINANCE_CHECKIN_15'
            });
        } else if (signals.finance <= 0.34) {
            alerts.push({
                id: 'alert-finance-warning',
                severity: 'WARN',
                title: 'Finance pressure detected',
                message: 'Keep today financials visible to avoid drift.',
                relatedSignals: ['finance'],
                suggestedActionId: 'FINANCE_CHECKIN_15'
            });
        }

        if (signals.rhythm <= 0.3 && signals.stress >= 0.65) {
            alerts.push({
                id: 'alert-rhythm-breakdown',
                severity: 'WARN',
                title: 'Rhythm is unstable',
                message: 'Use a small admin or clarity block to restore cadence.',
                relatedSignals: ['rhythm', 'stress'],
                suggestedActionId: 'ADMIN_WINDOW_15'
            });
        }

        if (signals.relationshipWarmth <= 0.32) {
            alerts.push({
                id: 'alert-relationship-cool',
                severity: 'INFO',
                title: 'Connection warmth is low',
                message: 'A short relationship ping can reduce social drift.',
                relatedSignals: ['relationshipWarmth'],
                suggestedActionId: 'RELATIONSHIP_PING_10'
            });
        }

        var criticalCount = 0;
        alerts.forEach(function (alert) {
            if (alert.severity === 'CRITICAL') {
                criticalCount += 1;
                if (criticalCount > 1) {
                    alert.severity = 'WARN';
                }
            }
        });

        var severityRank = { CRITICAL: 3, WARN: 2, INFO: 1 };
        alerts.sort(function (a, b) {
            return severityRank[b.severity] - severityRank[a.severity];
        });

        return alerts.slice(0, 4);
    }

    function resolveDominantLoop(signals, states, frictionBundle) {
        var topFriction = frictionBundle.frictions[0];
        if (signals.lifePulse >= 70 && signals.stress <= 0.45 && (!topFriction || topFriction.severity < 0.45)) {
            return 'POSITIVE';
        }
        if (states.riskLevel === 'HIGH' || (signals.stress >= 0.7 && signals.rhythm <= 0.45)) {
            return 'NEGATIVE';
        }
        return 'NEUTRAL';
    }

    function buildKeyDrivers(input, states, recommendations, frictionBundle) {
        var drivers = [];

        if (input.signals.stress >= 0.65) {
            drivers.push('Stress is elevated.');
        }
        if (input.signals.energy <= 0.45) {
            drivers.push('Energy is constrained.');
        }
        if (states.primaryConstraint === 'MONEY') {
            drivers.push('Money is the primary constraint.');
        }
        if (input.trends.stressAboveBaseline > 0.12) {
            drivers.push('Stress is above your 7-day baseline.');
        }

        if (frictionBundle.frictions.length) {
            drivers.push(frictionBundle.frictions[0].title + '.');
        }

        if (!drivers.length && recommendations.top.length) {
            drivers.push('Best immediate move is ' + recommendations.top[0].title.toLowerCase() + '.');
        }

        if (!drivers.length) drivers.push('Signals are currently neutral.');

        return drivers.slice(0, 3);
    }

    function generateNarrative(input, states, recommendations, frictionBundle, focus) {
        var drivers = buildKeyDrivers(input, states, recommendations, frictionBundle);
        var topRec = recommendations.top[0];

        var sentenceA =
            'Mode ' + states.systemMode +
            ': stress ' + Math.round(input.signals.stress * 100) +
            '%, energy ' + Math.round(input.signals.energy * 100) +
            '%, primary constraint ' + states.primaryConstraint.toLowerCase() + '.';

        var sentenceB = topRec
            ? (' Next best action is "' + topRec.title + '" for ' + topRec.durationMin + 'm.')
            : ' Next best action is one small maintenance step.';

        var sentenceC = focus && safeArray(focus.why).length
            ? (' Focus reason: ' + focus.why[0])
            : '';

        var narrative = (sentenceA + sentenceB + sentenceC).trim();
        if (narrative.length > 240) {
            narrative = narrative.slice(0, 237).trim() + '...';
        }

        return {
            narrative: narrative,
            keyDrivers: drivers
        };
    }

    function persistMemory(cognitiveState) {
        if (!global.CognitiveMemory || typeof global.CognitiveMemory.persistState !== 'function') return;
        try {
            global.CognitiveMemory.persistState(cognitiveState);
        } catch (e) {
            // no-op
        }
    }

    function compute(options) {
        var input;
        var states;
        var frictionBundle;
        var recommendations;
        var focus;
        var alerts;
        var explainability;

        try {
            // 1) collectInputs()
            input = collectInputs(options && options.store);

            // 2) detectStates()
            states = detectStates(input);

            // 3) detectFrictions()
            frictionBundle = detectFrictions(input, states);
            states.friction = frictionBundle.frictions;
            states.dominantLoop = resolveDominantLoop(input.signals, states, frictionBundle);

            // 4) selectRecommendations()
            recommendations = selectRecommendations(input, states, frictionBundle);

            // 5) focusDecision()
            focus = focusDecision(input, states, frictionBundle, recommendations);

            // Alerts are computed from final states/recommendations
            alerts = buildAlerts(input, states, recommendations);

            // 6) generateNarrative()
            explainability = generateNarrative(input, states, recommendations, frictionBundle, focus);

            var output = {
                version: '1.0',
                timestamp: input.timestamp,
                mode: input.mode,
                signals: {
                    lifePulse: normalizePulse(input.signals.lifePulse),
                    stress: normalizeSignal(input.signals.stress),
                    energy: normalizeSignal(input.signals.energy),
                    rhythm: normalizeSignal(input.signals.rhythm),
                    finance: normalizeSignal(input.signals.finance),
                    creativeMomentum: normalizeSignal(input.signals.creativeMomentum),
                    relationshipWarmth: normalizeSignal(input.signals.relationshipWarmth)
                },
                states: {
                    systemMode: states.systemMode,
                    riskLevel: states.riskLevel,
                    primaryConstraint: states.primaryConstraint,
                    dominantLoop: states.dominantLoop,
                    friction: states.friction
                },
                recommendations: {
                    top: safeArray(recommendations.top).slice(0, 3),
                    secondary: safeArray(recommendations.secondary),
                    avoid: safeArray(recommendations.avoid)
                },
                focusDecision: {
                    suggestedProjectId: focus.suggestedProjectId || null,
                    suggestionType: focus.suggestionType,
                    why: safeArray(focus.why).slice(0, 3)
                },
                alerts: alerts,
                explainability: {
                    narrative: explainability.narrative,
                    keyDrivers: explainability.keyDrivers
                }
            };

            // 7) persistMemory()
            persistMemory(output);

            return output;
        } catch (err) {
            var fallback = emptyCognitiveState(getMode(), nowIso());
            fallback.explainability.narrative = 'Cognitive engine fallback mode due to sparse or invalid inputs.';
            return fallback;
        }
    }

    global.CognitiveEngine = Object.freeze({
        version: ENGINE_VERSION,
        compute: compute,
        emptyState: emptyCognitiveState
    });
})(window);
