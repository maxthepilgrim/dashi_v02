/* ========================================
   Life OS - Cognitive Rules (Deterministic)
   ======================================== */

(function (global) {
    'use strict';

    function clamp(value, min, max) {
        var num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function deficit(value) {
        return clamp(1 - clamp(value, 0, 1), 0, 1);
    }

    function reason(signal, direction, weight, text) {
        return {
            signal: signal,
            direction: direction,
            weight: clamp(weight, 0, 1),
            text: String(text || '')
        };
    }

    function friction(id, title, description) {
        return {
            id: id,
            title: title,
            description: description
        };
    }

    var RULES = [
        // 1) Energy constraints
        {
            id: 'LOW_ENERGY_HIGH_STRESS',
            category: 'energy',
            when: function (signals) {
                return signals.energy <= 0.38 && signals.stress >= 0.62;
            },
            severity: function (signals) {
                return clamp((deficit(signals.energy) * 0.62) + (signals.stress * 0.38), 0, 1);
            },
            produces: {
                stateTags: ['ENERGY_LIMITED', 'RECOVERY_NEEDED'],
                frictions: [
                    friction('energy-debt', 'Energy Debt', 'Current effort is exceeding available energy.')
                ],
                recommendationBoosts: {
                    RECOVERY_RESET_5: 0.24,
                    WALK_RESET_10: 0.16,
                    CLARIFY_NEXT_STEP_5: 0.1
                },
                recommendationBlocks: {
                    CREATIVE_SPRINT_45: true,
                    DEEP_WORK_25: true
                },
                focusBias: {
                    type: 'RECOVERY',
                    weight: 0.44
                }
            },
            reasons: function (signals) {
                return [
                    reason('energy', 'LOW', 0.82, 'Energy is low for the current task load.'),
                    reason('stress', 'HIGH', 0.68, 'Stress is high, so recovery gives faster stabilization.')
                ];
            }
        },
        {
            id: 'LOW_ENERGY_MODERATE_STRESS',
            category: 'energy',
            when: function (signals) {
                return signals.energy <= 0.48 && signals.stress >= 0.45 && signals.stress < 0.62;
            },
            severity: function (signals) {
                return clamp((deficit(signals.energy) * 0.72) + (signals.stress * 0.28), 0, 1);
            },
            produces: {
                stateTags: ['PACE_DOWN'],
                frictions: [
                    friction('paced-output', 'Output Pacing', 'Sustained output may dip without a brief reset.')
                ],
                recommendationBoosts: {
                    CLARIFY_NEXT_STEP_5: 0.16,
                    RECOVERY_RESET_5: 0.12,
                    ADMIN_WINDOW_15: 0.05
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'MAINTENANCE',
                    weight: 0.18
                }
            },
            reasons: function () {
                return [
                    reason('energy', 'LOW', 0.63, 'A smaller action preserves consistency while energy recovers.')
                ];
            }
        },

        // 2) Stress / overload
        {
            id: 'STRESS_OVERLOAD_SPIKE',
            category: 'stress',
            when: function (signals) {
                return signals.stress >= 0.78;
            },
            severity: function (signals) {
                return clamp((signals.stress - 0.58) / 0.42, 0, 1);
            },
            produces: {
                stateTags: ['OVERLOAD'],
                frictions: [
                    friction('overload', 'Cognitive Overload', 'High stress is reducing execution quality and clarity.')
                ],
                recommendationBoosts: {
                    RECOVERY_RESET_5: 0.22,
                    CLARIFY_NEXT_STEP_5: 0.2,
                    WALK_RESET_10: 0.14
                },
                recommendationBlocks: {
                    CREATIVE_SPRINT_45: true
                },
                focusBias: {
                    type: 'RECOVERY',
                    weight: 0.35
                }
            },
            reasons: function (signals) {
                return [
                    reason('stress', 'HIGH', 0.9, 'Stress is above a safe execution threshold.'),
                    reason('clarity', 'LOW', 0.62, 'Task selection should prioritize reduction of load.')
                ];
            }
        },
        {
            id: 'STRESS_RHYTHM_COLLISION',
            category: 'stress',
            when: function (signals) {
                return signals.stress >= 0.64 && signals.rhythm <= 0.46;
            },
            severity: function (signals) {
                return clamp((signals.stress * 0.52) + (deficit(signals.rhythm) * 0.48), 0, 1);
            },
            produces: {
                stateTags: ['LOOP_RISK_NEGATIVE'],
                frictions: [
                    friction('stress-rhythm-collision', 'Stress-Rhythm Collision', 'Rhythm breakdown is amplifying stress and decision cost.')
                ],
                recommendationBoosts: {
                    ADMIN_WINDOW_15: 0.12,
                    CLARIFY_NEXT_STEP_5: 0.14,
                    RECOVERY_RESET_5: 0.1
                },
                recommendationBlocks: {
                    DEEP_WORK_25: true
                },
                focusBias: {
                    type: 'MAINTENANCE',
                    weight: 0.22
                }
            },
            reasons: function () {
                return [
                    reason('stress', 'HIGH', 0.72, 'Stress is elevated while rhythm completion is low.')
                ];
            }
        },

        // 3) Rhythm breakdown
        {
            id: 'RHYTHM_BREAKDOWN',
            category: 'rhythm',
            when: function (signals) {
                return signals.rhythm <= 0.34;
            },
            severity: function (signals) {
                return clamp(deficit(signals.rhythm) * 0.95, 0, 1);
            },
            produces: {
                stateTags: ['RHYTHM_BROKEN', 'TIME_SCATTERED'],
                frictions: [
                    friction('rhythm-breakdown', 'Rhythm Breakdown', 'Core daily steps are not getting completed reliably.')
                ],
                recommendationBoosts: {
                    ADMIN_WINDOW_15: 0.16,
                    CLARIFY_NEXT_STEP_5: 0.14,
                    RECOVERY_RESET_5: 0.08
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'MAINTENANCE',
                    weight: 0.26
                }
            },
            reasons: function (signals) {
                return [
                    reason('rhythm', 'LOW', 0.84, 'Daily rhythm completion is below stable operating range.'),
                    reason('time', 'LOW', 0.58, 'Time structure is likely the limiting factor.')
                ];
            }
        },
        {
            id: 'RHYTHM_STREAK_DROP',
            category: 'rhythm',
            when: function (signals, v2, ctx) {
                return ctx && ctx.trends && ctx.trends.rhythmDrop >= 0.15;
            },
            severity: function (signals, v2, ctx) {
                var drop = ctx && ctx.trends ? ctx.trends.rhythmDrop : 0;
                return clamp(drop * 2.2, 0, 1);
            },
            produces: {
                stateTags: ['RHYTHM_DECAYING'],
                frictions: [
                    friction('streak-drop', 'Streak Drop', 'Recent completion trend is slipping versus baseline.')
                ],
                recommendationBoosts: {
                    ADMIN_WINDOW_15: 0.1,
                    CLARIFY_NEXT_STEP_5: 0.12
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'MAINTENANCE',
                    weight: 0.18
                }
            },
            reasons: function (signals, v2, ctx) {
                var drop = ctx && ctx.trends ? ctx.trends.rhythmDrop : 0;
                return [
                    reason('rhythm', 'DOWN', clamp(drop * 1.5, 0.2, 0.8), 'Rhythm trend dropped against your recent baseline.')
                ];
            }
        },

        // 4) Finance instability
        {
            id: 'FINANCE_INSTABILITY_HIGH',
            category: 'finance',
            when: function (signals) {
                return signals.finance <= 0.34;
            },
            severity: function (signals) {
                return clamp(deficit(signals.finance) * 0.95, 0, 1);
            },
            produces: {
                stateTags: ['FINANCE_CONSTRAINT'],
                frictions: [
                    friction('finance-instability', 'Finance Instability', 'Runway and cash reliability are below comfort range.')
                ],
                recommendationBoosts: {
                    FINANCE_CHECKIN_15: 0.26,
                    ADMIN_WINDOW_15: 0.08
                },
                recommendationBlocks: {
                    CREATIVE_SPRINT_45: true
                },
                focusBias: {
                    type: 'BUSINESS',
                    weight: 0.34
                }
            },
            reasons: function () {
                return [
                    reason('finance', 'LOW', 0.86, 'Financial stability is low and needs immediate containment.')
                ];
            }
        },
        {
            id: 'FINANCE_WARNING',
            category: 'finance',
            when: function (signals) {
                return signals.finance > 0.34 && signals.finance <= 0.5;
            },
            severity: function (signals) {
                return clamp((0.55 - signals.finance) * 1.45, 0, 1);
            },
            produces: {
                stateTags: ['FINANCE_PRESSURE'],
                frictions: [
                    friction('finance-pressure', 'Finance Pressure', 'Finance metrics are trending near unstable range.')
                ],
                recommendationBoosts: {
                    FINANCE_CHECKIN_15: 0.16,
                    CLARIFY_NEXT_STEP_5: 0.05
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'BUSINESS',
                    weight: 0.2
                }
            },
            reasons: function () {
                return [
                    reason('finance', 'LOW', 0.58, 'A short finance review can prevent drift.')
                ];
            }
        },

        // 5) Creative stagnation
        {
            id: 'CREATIVE_STAGNATION_LONG',
            category: 'creative',
            when: function (signals, v2, ctx) {
                return signals.creativeMomentum <= 0.36 && ctx && ctx.meta && ctx.meta.creativeInactivityDays >= 7;
            },
            severity: function (signals, v2, ctx) {
                var idleDays = ctx && ctx.meta ? ctx.meta.creativeInactivityDays : 0;
                return clamp((deficit(signals.creativeMomentum) * 0.6) + (Math.min(idleDays, 14) / 14 * 0.4), 0, 1);
            },
            produces: {
                stateTags: ['CREATIVE_STALLED'],
                frictions: [
                    friction('creative-stagnation', 'Creative Stagnation', 'Creative motion has been inactive for multiple days.')
                ],
                recommendationBoosts: {
                    DEEP_WORK_25: 0.2,
                    CLARIFY_NEXT_STEP_5: 0.15,
                    CREATIVE_SPRINT_45: 0.08
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'CREATIVE',
                    weight: 0.28
                }
            },
            reasons: function (signals, v2, ctx) {
                var idleDays = ctx && ctx.meta ? ctx.meta.creativeInactivityDays : 0;
                return [
                    reason('creativeMomentum', 'LOW', 0.78, 'Creative momentum is low with inactivity of ' + idleDays + ' days.')
                ];
            }
        },
        {
            id: 'CREATIVE_SLOWDOWN',
            category: 'creative',
            when: function (signals, v2, ctx) {
                return signals.creativeMomentum <= 0.5 && ctx && ctx.meta && ctx.meta.creativeInactivityDays >= 3;
            },
            severity: function (signals, v2, ctx) {
                var idleDays = ctx && ctx.meta ? ctx.meta.creativeInactivityDays : 0;
                return clamp((deficit(signals.creativeMomentum) * 0.55) + (Math.min(idleDays, 7) / 7 * 0.45), 0, 1);
            },
            produces: {
                stateTags: ['CREATIVE_DRIFT'],
                frictions: [
                    friction('creative-drift', 'Creative Drift', 'The creative loop is slowing and needs re-entry friction reduction.')
                ],
                recommendationBoosts: {
                    CLARIFY_NEXT_STEP_5: 0.12,
                    DEEP_WORK_25: 0.12,
                    ADMIN_WINDOW_15: 0.04
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'CREATIVE',
                    weight: 0.16
                }
            },
            reasons: function () {
                return [
                    reason('creativeMomentum', 'LOW', 0.6, 'Creative throughput is below your expected cadence.')
                ];
            }
        },

        // 6) Relationship neglect
        {
            id: 'RELATIONSHIP_NEGLECT_HIGH',
            category: 'relationship',
            when: function (signals, v2, ctx) {
                return signals.relationshipWarmth <= 0.36 || (ctx && ctx.meta && ctx.meta.relationshipInactivityDays >= 10);
            },
            severity: function (signals, v2, ctx) {
                var inactivity = ctx && ctx.meta ? ctx.meta.relationshipInactivityDays : 0;
                return clamp((deficit(signals.relationshipWarmth) * 0.72) + (Math.min(inactivity, 14) / 14 * 0.28), 0, 1);
            },
            produces: {
                stateTags: ['SOCIAL_CONSTRAINT'],
                frictions: [
                    friction('relationship-neglect', 'Relationship Neglect', 'Core relationships appear under-maintained recently.')
                ],
                recommendationBoosts: {
                    RELATIONSHIP_PING_10: 0.24,
                    WALK_RESET_10: 0.06
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'MAINTENANCE',
                    weight: 0.14
                }
            },
            reasons: function () {
                return [
                    reason('relationshipWarmth', 'LOW', 0.76, 'Relationship warmth is below stable range.')
                ];
            }
        },
        {
            id: 'RELATIONSHIP_COOLING',
            category: 'relationship',
            when: function (signals) {
                return signals.relationshipWarmth <= 0.52 && signals.stress >= 0.56;
            },
            severity: function (signals) {
                return clamp((deficit(signals.relationshipWarmth) * 0.58) + (signals.stress * 0.42), 0, 1);
            },
            produces: {
                stateTags: ['SOCIAL_BUFFER_LOW'],
                frictions: [
                    friction('social-buffer-low', 'Social Buffer Low', 'Stress is up while connection signals are cooling.')
                ],
                recommendationBoosts: {
                    RELATIONSHIP_PING_10: 0.16,
                    RECOVERY_RESET_5: 0.08
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'MAINTENANCE',
                    weight: 0.1
                }
            },
            reasons: function () {
                return [
                    reason('relationshipWarmth', 'DOWN', 0.55, 'Connection maintenance helps reduce stress loops.')
                ];
            }
        },

        // 7) Misalignment with Vision (optional signal)
        {
            id: 'VISION_MISALIGNMENT',
            category: 'vision',
            when: function (signals) {
                return signals.visionAlignment <= 0.44;
            },
            severity: function (signals) {
                return clamp(deficit(signals.visionAlignment) * 0.86, 0, 1);
            },
            produces: {
                stateTags: ['CLARITY_CONSTRAINT'],
                frictions: [
                    friction('vision-misalignment', 'Vision Misalignment', 'Current actions are weakly aligned to stated direction.')
                ],
                recommendationBoosts: {
                    CLARIFY_NEXT_STEP_5: 0.24,
                    DEEP_WORK_25: 0.06
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'MAINTENANCE',
                    weight: 0.2
                }
            },
            reasons: function () {
                return [
                    reason('clarity', 'LOW', 0.71, 'Direction is unclear relative to current priorities.')
                ];
            }
        },

        // 8) Positive momentum loop detection
        {
            id: 'POSITIVE_LOOP_FLOW',
            category: 'momentum',
            when: function (signals) {
                return signals.lifePulse >= 72 && signals.stress <= 0.42 && signals.rhythm >= 0.6;
            },
            severity: function (signals) {
                return clamp((signals.lifePulse / 100 * 0.4) + ((1 - signals.stress) * 0.35) + (signals.rhythm * 0.25), 0, 1);
            },
            produces: {
                stateTags: ['POSITIVE_LOOP'],
                frictions: [],
                recommendationBoosts: {
                    DEEP_WORK_25: 0.2,
                    CREATIVE_SPRINT_45: 0.14
                },
                recommendationBlocks: {
                    ADMIN_WINDOW_15: true
                },
                focusBias: {
                    type: 'CREATIVE',
                    weight: 0.28
                }
            },
            reasons: function () {
                return [
                    reason('lifePulse', 'HIGH', 0.72, 'System momentum is positive and supports focused execution.'),
                    reason('stress', 'LOW', 0.6, 'Stress is controlled enough for depth.')
                ];
            }
        },
        {
            id: 'POSITIVE_BUSINESS_WINDOW',
            category: 'momentum',
            when: function (signals, v2, ctx) {
                var mode = ctx && ctx.mode ? ctx.mode : 'personal';
                return mode === 'business' && signals.finance >= 0.55 && signals.stress <= 0.5;
            },
            severity: function (signals) {
                return clamp((signals.finance * 0.6) + ((1 - signals.stress) * 0.4), 0, 1);
            },
            produces: {
                stateTags: ['BUSINESS_WINDOW'],
                frictions: [],
                recommendationBoosts: {
                    FINANCE_CHECKIN_15: 0.1,
                    DEEP_WORK_25: 0.12
                },
                recommendationBlocks: {},
                focusBias: {
                    type: 'BUSINESS',
                    weight: 0.26
                }
            },
            reasons: function () {
                return [
                    reason('finance', 'HIGH', 0.52, 'Finance stability supports offensive business actions.')
                ];
            }
        }
    ];

    global.CognitiveRules = Object.freeze({
        version: '1.0',
        rules: RULES,
        reason: reason,
        clamp: clamp
    });
})(window);
