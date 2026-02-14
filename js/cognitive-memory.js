/* ========================================
   Life OS - Cognitive Memory (Lightweight)
   ======================================== */

(function (global) {
    'use strict';

    var MEMORY_KEY = 'lifeos-cog-memory';
    var FEEDBACK_KEY = 'lifeos-cog-feedback';
    var LAST_STATE_KEY = 'lifeos-cog-laststate';

    var MAX_FEEDBACK = 300;
    var MAX_RECENT_RECOMMENDATIONS = 21;
    var MAX_DAILY_SAMPLES = 7;

    var VALID_STATUSES = {
        helpful: true,
        not_helpful: true,
        ignored: true,
        accepted: true
    };

    function nowIso() {
        return new Date().toISOString();
    }

    function clamp(value, min, max) {
        var num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function toTimestamp(value) {
        if (!value) return null;
        var ts = new Date(value).getTime();
        return Number.isFinite(ts) ? ts : null;
    }

    function todayKeyFromIso(isoValue) {
        return String(isoValue || nowIso()).slice(0, 10);
    }

    function safeParseJson(text, fallback) {
        if (!text) return fallback;
        try {
            var parsed = JSON.parse(text);
            return parsed == null ? fallback : parsed;
        } catch (e) {
            return fallback;
        }
    }

    function readRaw(key, fallback) {
        try {
            return localStorage.getItem(key) || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function writeRaw(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    function createDefaultMemory() {
        return {
            version: '1.0',
            updatedAt: nowIso(),
            baselines: {
                lifePulseAvg7d: 50,
                stressAvg7d: 0.5
            },
            dailySamples: [],
            constraintCounts: {
                ENERGY: 0,
                TIME: 0,
                MONEY: 0,
                CLARITY: 0,
                SOCIAL: 0
            },
            lastConstraintDate: null,
            actionStats: {},
            recentRecommendations: []
        };
    }

    function sanitizeMemory(memory) {
        var base = createDefaultMemory();
        var src = memory && typeof memory === 'object' ? memory : {};
        var srcPulseBaseline = Number(src.baselines && src.baselines.lifePulseAvg7d);
        var srcStressBaseline = Number(src.baselines && src.baselines.stressAvg7d);

        var merged = {
            version: '1.0',
            updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : base.updatedAt,
            baselines: {
                lifePulseAvg7d: Number.isFinite(srcPulseBaseline)
                    ? clamp(srcPulseBaseline, 0, 100)
                    : base.baselines.lifePulseAvg7d,
                stressAvg7d: Number.isFinite(srcStressBaseline)
                    ? clamp(srcStressBaseline, 0, 1)
                    : base.baselines.stressAvg7d
            },
            dailySamples: Array.isArray(src.dailySamples) ? src.dailySamples.slice(-MAX_DAILY_SAMPLES) : [],
            constraintCounts: {
                ENERGY: clamp(src.constraintCounts && src.constraintCounts.ENERGY, 0, 9999),
                TIME: clamp(src.constraintCounts && src.constraintCounts.TIME, 0, 9999),
                MONEY: clamp(src.constraintCounts && src.constraintCounts.MONEY, 0, 9999),
                CLARITY: clamp(src.constraintCounts && src.constraintCounts.CLARITY, 0, 9999),
                SOCIAL: clamp(src.constraintCounts && src.constraintCounts.SOCIAL, 0, 9999)
            },
            lastConstraintDate: typeof src.lastConstraintDate === 'string' ? src.lastConstraintDate : null,
            actionStats: src.actionStats && typeof src.actionStats === 'object' ? src.actionStats : {},
            recentRecommendations: Array.isArray(src.recentRecommendations)
                ? src.recentRecommendations.slice(-MAX_RECENT_RECOMMENDATIONS)
                : []
        };

        merged.dailySamples = merged.dailySamples
            .map(function (sample) {
                return {
                    date: String(sample && sample.date || ''),
                    lifePulse: clamp(sample && sample.lifePulse, 0, 100),
                    stress: clamp(sample && sample.stress, 0, 1)
                };
            })
            .filter(function (sample) {
                return /^\d{4}-\d{2}-\d{2}$/.test(sample.date);
            });

        merged.recentRecommendations = merged.recentRecommendations
            .map(function (item) {
                return {
                    date: String(item && item.date || ''),
                    timestamp: (item && typeof item.timestamp === 'string') ? item.timestamp : nowIso(),
                    actionIds: Array.isArray(item && item.actionIds)
                        ? item.actionIds.map(function (id) { return String(id || ''); }).filter(Boolean).slice(0, 5)
                        : []
                };
            })
            .filter(function (item) {
                return /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.actionIds.length > 0;
            });

        return merged;
    }

    function readMemory() {
        var raw = readRaw(MEMORY_KEY, null);
        var parsed = safeParseJson(raw, null);
        return sanitizeMemory(parsed);
    }

    function writeMemory(memory) {
        var safeMemory = sanitizeMemory(memory);
        safeMemory.updatedAt = nowIso();
        writeRaw(MEMORY_KEY, JSON.stringify(safeMemory));
        return safeMemory;
    }

    function readFeedbackLog() {
        var raw = readRaw(FEEDBACK_KEY, '[]');
        var parsed = safeParseJson(raw, []);
        if (!Array.isArray(parsed)) return [];
        return parsed;
    }

    function writeFeedbackLog(entries) {
        var list = Array.isArray(entries) ? entries.slice(-MAX_FEEDBACK) : [];
        writeRaw(FEEDBACK_KEY, JSON.stringify(list));
        return list;
    }

    function normalizeStatus(status) {
        var raw = String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
        if (raw === 'nothelpful') raw = 'not_helpful';
        if (VALID_STATUSES[raw]) return raw;
        return 'ignored';
    }

    function ensureActionStats(memory, actionId) {
        if (!memory.actionStats[actionId]) {
            memory.actionStats[actionId] = {
                total: 0,
                accepted: 0,
                ignored: 0,
                helpful: 0,
                notHelpful: 0,
                lastStatus: null,
                lastFeedbackAt: null
            };
        }
        return memory.actionStats[actionId];
    }

    function updateActionStats(memory, entry) {
        if (!entry || !entry.actionId) return;
        var stats = ensureActionStats(memory, entry.actionId);
        stats.total += 1;

        if (entry.status === 'accepted') stats.accepted += 1;
        if (entry.status === 'ignored') stats.ignored += 1;
        if (entry.status === 'helpful') stats.helpful += 1;
        if (entry.status === 'not_helpful') stats.notHelpful += 1;

        stats.lastStatus = entry.status;
        stats.lastFeedbackAt = entry.timestamp;
    }

    function saveFeedback(payload) {
        var safePayload = payload && typeof payload === 'object' ? payload : {};
        var actionId = String(
            safePayload.actionId ||
            safePayload.recommendationId ||
            safePayload.suggestedActionId ||
            ''
        ).trim();

        var entry = {
            id: String(safePayload.id || ('cfb-' + Date.now() + '-' + Math.floor(Math.random() * 10000))),
            actionId: actionId,
            status: normalizeStatus(safePayload.status),
            timestamp: typeof safePayload.timestamp === 'string' ? safePayload.timestamp : nowIso(),
            mode: safePayload.mode ? String(safePayload.mode) : null,
            note: String(safePayload.note || '').slice(0, 280)
        };

        var feedback = readFeedbackLog();
        feedback.push(entry);
        writeFeedbackLog(feedback);

        if (actionId) {
            var memory = readMemory();
            updateActionStats(memory, entry);
            writeMemory(memory);
        }

        return entry;
    }

    function computeAverage(list, key, fallback) {
        if (!Array.isArray(list) || list.length === 0) return fallback;
        var total = 0;
        var count = 0;
        list.forEach(function (item) {
            var val = Number(item && item[key]);
            if (!Number.isFinite(val)) return;
            total += val;
            count += 1;
        });
        if (!count) return fallback;
        return total / count;
    }

    function upsertDailySample(memory, dateKey, lifePulse, stress) {
        var idx = memory.dailySamples.findIndex(function (sample) {
            return sample.date === dateKey;
        });

        var item = {
            date: dateKey,
            lifePulse: clamp(lifePulse, 0, 100),
            stress: clamp(stress, 0, 1)
        };

        if (idx >= 0) {
            memory.dailySamples[idx] = item;
        } else {
            memory.dailySamples.push(item);
        }

        memory.dailySamples.sort(function (a, b) {
            return a.date.localeCompare(b.date);
        });

        if (memory.dailySamples.length > MAX_DAILY_SAMPLES) {
            memory.dailySamples = memory.dailySamples.slice(memory.dailySamples.length - MAX_DAILY_SAMPLES);
        }
    }

    function recordConstraint(memory, constraint, dateKey) {
        if (!constraint) return;
        if (memory.lastConstraintDate === dateKey) return;
        if (memory.constraintCounts[constraint] == null) {
            memory.constraintCounts[constraint] = 0;
        }
        memory.constraintCounts[constraint] += 1;
        memory.lastConstraintDate = dateKey;
    }

    function recordRecommendationSet(memory, actionIds, dateKey, timestamp) {
        var ids = Array.isArray(actionIds)
            ? actionIds.map(function (id) { return String(id || '').trim(); }).filter(Boolean)
            : [];

        if (!ids.length) return;

        memory.recentRecommendations.push({
            date: dateKey,
            timestamp: timestamp,
            actionIds: ids.slice(0, 5)
        });

        if (memory.recentRecommendations.length > MAX_RECENT_RECOMMENDATIONS) {
            memory.recentRecommendations = memory.recentRecommendations.slice(
                memory.recentRecommendations.length - MAX_RECENT_RECOMMENDATIONS
            );
        }
    }

    function persistState(cognitiveState) {
        if (!cognitiveState || typeof cognitiveState !== 'object') return readMemory();

        var timestamp = typeof cognitiveState.timestamp === 'string' ? cognitiveState.timestamp : nowIso();
        var dateKey = todayKeyFromIso(timestamp);

        var lifePulse = clamp(cognitiveState.signals && cognitiveState.signals.lifePulse, 0, 100);
        var stress = clamp(cognitiveState.signals && cognitiveState.signals.stress, 0, 1);

        var memory = readMemory();
        upsertDailySample(memory, dateKey, lifePulse, stress);

        memory.baselines.lifePulseAvg7d = clamp(
            computeAverage(memory.dailySamples, 'lifePulse', memory.baselines.lifePulseAvg7d),
            0,
            100
        );
        memory.baselines.stressAvg7d = clamp(
            computeAverage(memory.dailySamples, 'stress', memory.baselines.stressAvg7d),
            0,
            1
        );

        var constraint = cognitiveState.states && cognitiveState.states.primaryConstraint
            ? String(cognitiveState.states.primaryConstraint)
            : null;
        recordConstraint(memory, constraint, dateKey);

        var topActionIds = Array.isArray(cognitiveState.recommendations && cognitiveState.recommendations.top)
            ? cognitiveState.recommendations.top.map(function (item) { return item && item.id; }).filter(Boolean)
            : [];
        recordRecommendationSet(memory, topActionIds, dateKey, timestamp);

        memory = writeMemory(memory);

        writeRaw(LAST_STATE_KEY, JSON.stringify({
            timestamp: timestamp,
            mode: cognitiveState.mode || 'personal',
            signals: cognitiveState.signals || {},
            states: cognitiveState.states || {},
            recommendations: {
                topIds: topActionIds
            }
        }));

        return memory;
    }

    function readLastState() {
        var raw = readRaw(LAST_STATE_KEY, null);
        return safeParseJson(raw, null);
    }

    function getBaselines() {
        var memory = readMemory();
        return {
            lifePulseAvg7d: clamp(memory.baselines.lifePulseAvg7d, 0, 100),
            stressAvg7d: clamp(memory.baselines.stressAvg7d, 0, 1)
        };
    }

    function getConstraintCounts() {
        return readMemory().constraintCounts;
    }

    function getMostRepeatedConstraint() {
        var counts = getConstraintCounts();
        var winner = 'CLARITY';
        var maxCount = -1;
        Object.keys(counts).forEach(function (key) {
            var val = Number(counts[key]);
            if (!Number.isFinite(val)) return;
            if (val > maxCount) {
                maxCount = val;
                winner = key;
            }
        });
        return winner;
    }

    function getActionStats(actionId) {
        if (!actionId) return null;
        var memory = readMemory();
        var stats = memory.actionStats && memory.actionStats[actionId];
        return stats && typeof stats === 'object' ? stats : null;
    }

    function getActionScoreAdjustment(actionId) {
        var stats = getActionStats(actionId);
        if (!stats) return 0;

        var total = Math.max(0, Number(stats.total) || 0);
        if (total === 0) return 0;

        var accepted = Math.max(0, Number(stats.accepted) || 0);
        var ignored = Math.max(0, Number(stats.ignored) || 0);
        var helpful = Math.max(0, Number(stats.helpful) || 0);
        var notHelpful = Math.max(0, Number(stats.notHelpful) || 0);

        var acceptanceRate = accepted / total;
        var ignoredRate = ignored / total;
        var usefulRate = (accepted + helpful) / total;

        var adjustment = 0;

        if (total >= 3) {
            if (acceptanceRate >= 0.65) adjustment += 0.1;
            else if (acceptanceRate <= 0.2) adjustment -= 0.08;

            if (usefulRate >= 0.6) adjustment += 0.04;
            if (notHelpful > helpful && total >= 4) adjustment -= 0.05;
            if (ignoredRate >= 0.5) adjustment -= 0.09;
        }

        var lastTs = toTimestamp(stats.lastFeedbackAt);
        var ageDays = lastTs == null ? null : Math.floor((Date.now() - lastTs) / (24 * 60 * 60 * 1000));
        if (ageDays != null && ageDays <= 7) {
            if (stats.lastStatus === 'ignored') adjustment -= 0.06;
            if (stats.lastStatus === 'accepted') adjustment += 0.04;
        }

        return clamp(adjustment, -0.25, 0.2);
    }

    function getRecentRecommendationPenalty(actionId) {
        if (!actionId) return 0;

        var memory = readMemory();
        var now = Date.now();

        var recentCount = memory.recentRecommendations.reduce(function (count, item) {
            var ts = toTimestamp(item.timestamp) || toTimestamp(item.date);
            if (ts == null) return count;
            var ageDays = (now - ts) / (24 * 60 * 60 * 1000);
            if (ageDays > 2) return count;
            if (Array.isArray(item.actionIds) && item.actionIds.indexOf(actionId) !== -1) {
                return count + 1;
            }
            return count;
        }, 0);

        var basePenalty = -Math.min(0.12, recentCount * 0.03);

        var feedback = readFeedbackLog();
        var ignoredCount = 0;
        feedback.forEach(function (entry) {
            if (!entry || entry.actionId !== actionId || entry.status !== 'ignored') return;
            var ts = toTimestamp(entry.timestamp);
            if (ts == null) return;
            var ageDays = (now - ts) / (24 * 60 * 60 * 1000);
            if (ageDays <= 5) ignoredCount += 1;
        });

        var feedbackPenalty = -Math.min(0.12, ignoredCount * 0.04);
        return clamp(basePenalty + feedbackPenalty, -0.25, 0);
    }

    global.CognitiveMemory = Object.freeze({
        version: '1.0',
        keys: Object.freeze({
            memory: MEMORY_KEY,
            feedback: FEEDBACK_KEY,
            lastState: LAST_STATE_KEY
        }),
        readMemory: readMemory,
        writeMemory: writeMemory,
        readFeedbackLog: readFeedbackLog,
        saveFeedback: saveFeedback,
        readLastState: readLastState,
        persistState: persistState,
        getBaselines: getBaselines,
        getConstraintCounts: getConstraintCounts,
        getMostRepeatedConstraint: getMostRepeatedConstraint,
        getActionStats: getActionStats,
        getActionScoreAdjustment: getActionScoreAdjustment,
        getRecentRecommendationPenalty: getRecentRecommendationPenalty,
        clamp: clamp
    });
})(window);
