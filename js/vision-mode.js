/* ========================================
   Vision Mode — Storage, Scheduler & UI (V2)
   ======================================== */

(function (global) {
    'use strict';

    const DIMENSION_LABELS = {
        incomeStability: 'Income Stability',
        creativeOutput: 'Creative Output',
        physicalVitality: 'Physical Vitality',
        relationshipDepth: 'Relationship Depth',
        meaningContribution: 'Meaning & Contribution'
    };

    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    function nowIso() {
        return new Date().toISOString();
    }

    function clamp(value, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function safeParse(value, fallback) {
        if (!value) return fallback;
        try {
            const parsed = JSON.parse(value);
            return parsed == null ? fallback : parsed;
        } catch (err) {
            console.warn('VisionStorage: invalid JSON payload', err);
            return fallback;
        }
    }

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function formatTimestamp(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '—';
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatSigned(value) {
        const num = Number(value) || 0;
        return `${num >= 0 ? '+' : ''}${Math.round(num)}`;
    }

    function toInputDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
    }

    function addDaysInputDate(value, days) {
        const base = value ? new Date(value) : new Date();
        if (!Number.isFinite(base.getTime())) return '';
        base.setDate(base.getDate() + days);
        return base.toISOString().slice(0, 10);
    }

    function startOfTodayTs() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    function parseDateTs(value) {
        if (!value) return null;
        const date = new Date(value);
        const ts = date.getTime();
        return Number.isFinite(ts) ? ts : null;
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const VisionStorage = (function () {
        const KEY_STATE = 'visionModeState';
        const KEY_SNAPSHOTS = 'visionModeSnapshots';
        const KEY_DECISIONS = 'visionDecisionLog';
        const KEY_THEMES = 'visionThemes';
        const KEY_MILESTONES = 'visionMilestones';
        const KEY_TELEMETRY = 'visionEngineTelemetry';
        const KEY_MIGRATION = 'visionModeMigrationV2Done';

        const LEGACY_KEYS = {
            northStar: 'lifeOS.vision.northStar',
            timeHorizons: 'lifeOS.vision.timeHorizons',
            themes: 'lifeOS.vision.lifeThemes',
            milestones: 'lifeOS.vision.milestones',
            decisions: 'lifeOS.vision.decisions'
        };

        function defaultTargets() {
            return {
                incomeStability: 50,
                creativeOutput: 50,
                physicalVitality: 50,
                relationshipDepth: 50,
                meaningContribution: 50
            };
        }

        const DEFAULT_STATE = {
            version: 2,
            updatedAt: nowIso(),
            northStar: '',
            oneYearDirection: '',
            fiveYearDirection: '',
            themes: [],
            milestones: [],
            weeklyCommitmentIds: [],
            targets: defaultTargets(),
            lastCompute: null
        };

        let cachedState = null;

        function generateId(prefix) {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return `${prefix}-${window.crypto.randomUUID()}`;
            }
            return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
        }

        function normalizeTheme(entry) {
            const timestamp = nowIso();
            const label = String(entry && entry.label || entry || '').trim();
            if (!label) return null;
            return {
                id: (entry && entry.id) || generateId('theme'),
                label,
                weight: clamp((entry && entry.weight) != null ? entry.weight : 3, 1, 10),
                createdAt: (entry && entry.createdAt) || timestamp,
                updatedAt: (entry && entry.updatedAt) || timestamp
            };
        }

        function normalizeMilestoneStatus(milestone) {
            const completion = clamp(milestone.completionPct || 0, 0, 100);
            if (completion >= 100) return 'done';
            if (completion > 0) return 'active';
            return 'planned';
        }

        function normalizeMilestone(entry) {
            const timestamp = nowIso();
            const completionPct = clamp(entry && entry.completionPct || 0, 0, 100);
            const status = completionPct >= 100 ? 'done' : normalizeMilestoneStatus({ completionPct });
            const nextActionRaw = String(entry && entry.nextAction || '').trim();
            const nextAction = status === 'done'
                ? ''
                : (nextActionRaw || 'Define next action');

            return {
                id: (entry && entry.id) || generateId('ms'),
                title: String(entry && entry.title || 'New milestone').trim() || 'New milestone',
                date: toInputDate(entry && entry.date),
                visionType: String(entry && entry.visionType || 'Custom').trim() || 'Custom',
                completionPct,
                status,
                nextAction,
                blocker: String(entry && entry.blocker || '').trim(),
                notes: String(entry && entry.notes || '').trim(),
                linkedProjectId: entry && entry.linkedProjectId ? entry.linkedProjectId : null,
                createdAt: (entry && entry.createdAt) || timestamp,
                updatedAt: (entry && entry.updatedAt) || timestamp
            };
        }

        function sanitizeState(raw) {
            const base = raw && typeof raw === 'object' ? raw : {};
            const state = {
                version: 2,
                updatedAt: base.updatedAt || nowIso(),
                northStar: String(base.northStar || ''),
                oneYearDirection: String(base.oneYearDirection || ''),
                fiveYearDirection: String(base.fiveYearDirection || ''),
                themes: [],
                milestones: [],
                weeklyCommitmentIds: [],
                targets: { ...defaultTargets(), ...(base.targets || {}) },
                lastCompute: base.lastCompute || null
            };

            const themes = Array.isArray(base.themes) ? base.themes : [];
            state.themes = themes
                .map(normalizeTheme)
                .filter(Boolean);

            const milestones = Array.isArray(base.milestones) ? base.milestones : [];
            state.milestones = milestones.map(normalizeMilestone);

            const milestoneIdSet = new Set(state.milestones.map((item) => item.id));
            const doneMilestoneIdSet = new Set(state.milestones.filter((item) => item.status === 'done').map((item) => item.id));
            const weekly = Array.isArray(base.weeklyCommitmentIds) ? base.weeklyCommitmentIds : [];
            state.weeklyCommitmentIds = Array.from(new Set(weekly))
                .filter((id) => milestoneIdSet.has(id) && !doneMilestoneIdSet.has(id))
                .slice(0, 3);

            return state;
        }

        function mapLegacyMilestone(entry) {
            const completionPct = entry && entry.completed
                ? 100
                : clamp(entry && entry.completionPct || entry && entry.progress || 0, 0, 100);
            const status = completionPct >= 100 ? 'done' : (completionPct > 0 ? 'active' : 'planned');
            const blocker = String(entry && entry.blocker || '').trim() ||
                (Array.isArray(entry && entry.blockedBy) ? entry.blockedBy.join(', ').trim() : '');
            const nextActionRaw = String(entry && entry.nextAction || '').trim();

            return normalizeMilestone({
                id: entry && entry.id,
                title: entry && entry.title,
                date: entry && entry.date,
                visionType: entry && entry.visionType,
                completionPct,
                status,
                nextAction: status === 'done' ? '' : (nextActionRaw || 'Define next action'),
                blocker,
                linkedProjectId: entry && entry.linkedProjectId || null,
                createdAt: entry && entry.createdAt,
                updatedAt: entry && entry.updatedAt
            });
        }

        function mapLegacyDecision(entry) {
            return {
                id: generateId('decision'),
                createdAt: (entry && (entry.createdAt || entry.timestamp)) || nowIso(),
                decision: entry && entry.decision === 'no' ? 'no' : 'yes',
                contextMode: entry && entry.contextMode || 'vision',
                energyState: entry && entry.energyState ? String(entry.energyState) : null,
                note: entry && entry.note ? String(entry.note) : null,
                alignmentAtDecision: clamp(entry && entry.alignmentAtDecision != null ? entry.alignmentAtDecision : 50, 0, 100),
                driftAtDecision: clamp(entry && entry.driftAtDecision != null ? entry.driftAtDecision : 0, -100, 100),
                visionType: entry && entry.visionType ? String(entry.visionType) : 'Custom'
            };
        }

        function migrateLegacyVisionDataIfNeeded() {
            if (localStorage.getItem(KEY_MIGRATION) === '1') {
                return;
            }

            const existingStateRaw = safeParse(localStorage.getItem(KEY_STATE), null);
            const existingState = sanitizeState(existingStateRaw || DEFAULT_STATE);

            const legacyNorthStar = String(localStorage.getItem(LEGACY_KEYS.northStar) || '').trim();
            const legacyHorizons = safeParse(localStorage.getItem(LEGACY_KEYS.timeHorizons), {});
            const legacyThemes = safeParse(localStorage.getItem(LEGACY_KEYS.themes), []);
            const legacyMilestones = safeParse(localStorage.getItem(LEGACY_KEYS.milestones), []);
            const legacyDecisions = safeParse(localStorage.getItem(LEGACY_KEYS.decisions), []);

            const migrated = deepClone(existingState);

            if (!migrated.northStar && legacyNorthStar) {
                migrated.northStar = legacyNorthStar;
            }
            if (!migrated.oneYearDirection && legacyHorizons && legacyHorizons.oneYear) {
                migrated.oneYearDirection = String(legacyHorizons.oneYear);
            }
            if (!migrated.fiveYearDirection && legacyHorizons && legacyHorizons.fiveYear) {
                migrated.fiveYearDirection = String(legacyHorizons.fiveYear);
            }

            if (!migrated.themes.length && Array.isArray(legacyThemes) && legacyThemes.length) {
                migrated.themes = legacyThemes
                    .map((theme) => normalizeTheme(theme))
                    .filter(Boolean);
            }

            if (!migrated.milestones.length && Array.isArray(legacyMilestones) && legacyMilestones.length) {
                migrated.milestones = legacyMilestones.map(mapLegacyMilestone);
            }

            const decisionLog = safeParse(localStorage.getItem(KEY_DECISIONS), []);
            if ((!Array.isArray(decisionLog) || !decisionLog.length) && Array.isArray(legacyDecisions) && legacyDecisions.length) {
                const mappedDecisions = legacyDecisions
                    .map(mapLegacyDecision)
                    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                localStorage.setItem(KEY_DECISIONS, JSON.stringify(mappedDecisions.slice(-200)));
            }

            const sanitized = sanitizeState(migrated);
            localStorage.setItem(KEY_STATE, JSON.stringify(sanitized));
            localStorage.setItem(KEY_THEMES, JSON.stringify(sanitized.themes));
            localStorage.setItem(KEY_MILESTONES, JSON.stringify(sanitized.milestones));
            localStorage.setItem(KEY_MIGRATION, '1');
        }

        function loadState() {
            if (cachedState) return cachedState;

            migrateLegacyVisionDataIfNeeded();

            const parsed = safeParse(localStorage.getItem(KEY_STATE), DEFAULT_STATE);
            const state = sanitizeState(parsed);
            cachedState = state;
            return state;
        }

        function persistState(nextState) {
            const sanitized = sanitizeState(nextState);
            try {
                localStorage.setItem(KEY_STATE, JSON.stringify(sanitized));
                localStorage.setItem(KEY_THEMES, JSON.stringify(sanitized.themes));
                localStorage.setItem(KEY_MILESTONES, JSON.stringify(sanitized.milestones));
            } catch (err) {
                console.error('VisionStorage: failed to persist state', err);
            }
            cachedState = sanitized;
        }

        function mutateState(mutator) {
            const current = deepClone(loadState());
            mutator(current);
            current.updatedAt = nowIso();
            current.version = 2;
            persistState(current);
            return deepClone(current);
        }

        function getState() {
            return deepClone(loadState());
        }

        function updateNorthStar(text) {
            return mutateState((state) => {
                state.northStar = String(text || '');
            });
        }

        function updateTimeHorizons(oneYear, fiveYear) {
            return mutateState((state) => {
                state.oneYearDirection = String(oneYear || '');
                state.fiveYearDirection = String(fiveYear || '');
            });
        }

        function getThemes() {
            return deepClone(loadState().themes);
        }

        function addTheme(label) {
            const trimmed = String(label || '').trim();
            if (!trimmed) return getThemes();
            return mutateState((state) => {
                const exists = state.themes.some((theme) => theme.label.toLowerCase() === trimmed.toLowerCase());
                if (exists) return;
                state.themes.push(normalizeTheme({ label: trimmed }));
            }).themes;
        }

        function removeTheme(id) {
            return mutateState((state) => {
                state.themes = state.themes.filter((theme) => theme.id !== id);
            }).themes;
        }

        function getMilestones() {
            return deepClone(loadState().milestones);
        }

        function addMilestone(payload) {
            return mutateState((state) => {
                const title = String(payload && payload.title || '').trim();
                if (!title) return;

                const completionPct = clamp(payload && payload.completionPct || 0, 0, 100);
                const status = completionPct >= 100 ? 'done' : (completionPct > 0 ? 'active' : 'planned');
                const nextActionRaw = String(payload && payload.nextAction || '').trim();
                if (status !== 'done' && !nextActionRaw) return;

                state.milestones.push(normalizeMilestone({
                    title,
                    date: payload && payload.date,
                    visionType: payload && payload.visionType,
                    completionPct,
                    status,
                    nextAction: nextActionRaw,
                    blocker: String(payload && payload.blocker || '').trim(),
                    notes: String(payload && payload.notes || '').trim(),
                    linkedProjectId: payload && payload.linkedProjectId || null
                }));
            }).milestones;
        }

        function updateMilestone(id, updates) {
            return mutateState((state) => {
                const milestone = state.milestones.find((item) => item.id === id);
                if (!milestone) return;

                if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
                    const title = String(updates.title || '').trim();
                    if (title) milestone.title = title;
                }

                if (Object.prototype.hasOwnProperty.call(updates, 'date')) {
                    milestone.date = toInputDate(updates.date);
                }

                if (Object.prototype.hasOwnProperty.call(updates, 'visionType')) {
                    const type = String(updates.visionType || '').trim();
                    milestone.visionType = type || 'Custom';
                }

                if (Object.prototype.hasOwnProperty.call(updates, 'completionPct')) {
                    milestone.completionPct = clamp(updates.completionPct, 0, 100);
                }

                if (Object.prototype.hasOwnProperty.call(updates, 'nextAction')) {
                    milestone.nextAction = String(updates.nextAction || '').trim();
                }

                if (Object.prototype.hasOwnProperty.call(updates, 'blocker')) {
                    milestone.blocker = String(updates.blocker || '').trim();
                }

                if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
                    milestone.notes = String(updates.notes || '').trim();
                }

                if (Object.prototype.hasOwnProperty.call(updates, 'linkedProjectId')) {
                    milestone.linkedProjectId = updates.linkedProjectId || null;
                }

                milestone.status = normalizeMilestoneStatus(milestone);
                if (milestone.status !== 'done' && !milestone.nextAction) {
                    milestone.nextAction = 'Define next action';
                }
                if (milestone.status === 'done') {
                    milestone.nextAction = '';
                    state.weeklyCommitmentIds = state.weeklyCommitmentIds.filter((itemId) => itemId !== id);
                }

                milestone.updatedAt = nowIso();
            }).milestones;
        }

        function removeMilestone(id) {
            return mutateState((state) => {
                state.milestones = state.milestones.filter((item) => item.id !== id);
                state.weeklyCommitmentIds = state.weeklyCommitmentIds.filter((itemId) => itemId !== id);
            }).milestones;
        }

        function toggleWeeklyCommitment(id) {
            return mutateState((state) => {
                const exists = state.milestones.some((item) => item.id === id && item.status !== 'done');
                if (!exists) return;

                const current = state.weeklyCommitmentIds || [];
                const index = current.indexOf(id);
                if (index >= 0) {
                    current.splice(index, 1);
                } else if (current.length < 3) {
                    current.push(id);
                }
                state.weeklyCommitmentIds = current.slice(0, 3);
            }).weeklyCommitmentIds;
        }

        function getDecisionLog() {
            const parsed = safeParse(localStorage.getItem(KEY_DECISIONS), []);
            const list = Array.isArray(parsed) ? parsed : [];
            return list.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }

        function logDecision(entry) {
            const log = getDecisionLog();
            const record = {
                id: generateId('decision'),
                createdAt: nowIso(),
                decision: entry && entry.decision === 'no' ? 'no' : 'yes',
                contextMode: entry && entry.contextMode || 'vision',
                energyState: entry && entry.energyState || null,
                note: entry && entry.note || null,
                alignmentAtDecision: clamp(entry && entry.alignmentAtDecision != null ? entry.alignmentAtDecision : 50, 0, 100),
                driftAtDecision: clamp(entry && entry.driftAtDecision != null ? entry.driftAtDecision : 0, -100, 100),
                visionType: entry && entry.visionType || 'Custom'
            };

            log.push(record);
            const limited = log.slice(-200);
            localStorage.setItem(KEY_DECISIONS, JSON.stringify(limited));
            return limited;
        }

        function getSnapshots() {
            const parsed = safeParse(localStorage.getItem(KEY_SNAPSHOTS), []);
            const list = Array.isArray(parsed) ? parsed : [];
            return list.slice().sort((a, b) => new Date(a.computedAt) - new Date(b.computedAt));
        }

        function saveSnapshot(snapshot, metadata) {
            const history = getSnapshots();
            const copy = deepClone(snapshot);
            if (metadata) {
                copy.metadata = metadata;
            }
            history.push(copy);
            while (history.length > 96) {
                history.shift();
            }
            localStorage.setItem(KEY_SNAPSHOTS, JSON.stringify(history));

            const state = deepClone(loadState());
            state.lastCompute = copy;
            state.updatedAt = nowIso();
            persistState(state);

            return deepClone(copy);
        }

        function getTelemetry() {
            return safeParse(localStorage.getItem(KEY_TELEMETRY), null);
        }

        function saveTelemetry(payload) {
            if (!payload || typeof payload !== 'object') return;
            localStorage.setItem(KEY_TELEMETRY, JSON.stringify({ ...payload, updatedAt: nowIso() }));
        }

        function getLastCompute() {
            const state = loadState();
            return deepClone(state.lastCompute);
        }

        return {
            migrateLegacyVisionDataIfNeeded,
            getState,
            updateNorthStar,
            updateTimeHorizons,
            getThemes,
            addTheme,
            removeTheme,
            getMilestones,
            addMilestone,
            updateMilestone,
            removeMilestone,
            toggleWeeklyCommitment,
            getDecisionLog,
            logDecision,
            getSnapshots,
            saveSnapshot,
            getTelemetry,
            saveTelemetry,
            getLastCompute
        };
    })();

    const VisionComputeScheduler = (function () {
        let config = {};
        let timer = null;
        let running = false;
        let pendingFields = new Set();

        function init(options) {
            config = options || {};
        }

        function requestCompute(fields) {
            (fields || []).forEach((field) => pendingFields.add(field));
            if (running) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(triggerCompute, config.delay || 850);
        }

        function triggerCompute() {
            if (running) return;
            running = true;
            timer = null;

            if (typeof config.onStatusChange === 'function') {
                config.onStatusChange('computing');
            }
            if (typeof config.onComputeStart === 'function') {
                config.onComputeStart();
            }

            const state = VisionStorage.getState();
            const snapshots = VisionStorage.getSnapshots();
            const decisions = VisionStorage.getDecisionLog();

            const startedAt = performance.now();
            const snapshot = VisionEngine.compute(state, {
                store: global.Store || null,
                snapshots,
                decisions,
                now: Date.now()
            });
            const duration = Math.round(performance.now() - startedAt);

            const changedFields = Array.from(pendingFields);
            pendingFields.clear();

            const metadata = {
                computeDurationMs: duration,
                inputChangedFields: changedFields,
                engineVersion: VisionEngine.version
            };

            const persisted = VisionStorage.saveSnapshot(snapshot, metadata);
            VisionStorage.saveTelemetry({
                ...metadata,
                lastRun: nowIso()
            });

            if (typeof config.onComputeComplete === 'function') {
                config.onComputeComplete(persisted);
            }
            if (typeof config.onStatusChange === 'function') {
                config.onStatusChange('completed');
            }

            running = false;
            if (pendingFields.size > 0) {
                timer = setTimeout(triggerCompute, config.delay || 850);
            }
        }

        function runImmediate(fields) {
            (fields || []).forEach((field) => pendingFields.add(field));
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            triggerCompute();
        }

        return {
            init,
            scheduleCompute: requestCompute,
            runImmediate
        };
    })();

    const VisionUI = (function () {
        const LAYERS = {
            pulse: 'pulse',
            signals: 'signals',
            planning: 'planning',
            history: 'history'
        };

        const elements = {};
        const mountedLayers = {
            pulse: true,
            signals: false,
            planning: false,
            history: false
        };

        let initialized = false;
        let lastSnapshot = null;
        let statusTimer = null;
        let markerTimer = null;
        let focusTimer = null;
        let activeLayer = LAYERS.pulse;
        let recommendedActionMilestoneId = null;
        let milestoneModalState = {
            open: false,
            id: null,
            source: null,
            baseline: null,
            lastFocusedElement: null
        };

        function collectElements() {
            elements.dashboard = document.getElementById('dashboard-vision');
            elements.pulseLayer = document.getElementById('vision-pulse-layer');
            elements.signalsLayer = document.getElementById('vision-signals-layer');
            elements.planningLayer = document.getElementById('vision-planning-layer');
            elements.historyLayer = document.getElementById('vision-history-layer');

            elements.pulseNorthStar = document.getElementById('vision-pulse-north-star');
            elements.pulseOneYear = document.getElementById('vision-pulse-one-year');
            elements.pulseCommitments = document.getElementById('vision-pulse-commitments');
            elements.pulseNextAction = document.getElementById('vision-pulse-next-action');
            elements.pulseNextActionContext = document.getElementById('vision-pulse-next-action-context');
            elements.pulseDeepIcon = document.getElementById('vision-pulse-deep-icon');
            elements.pulseAlignmentTrigger = document.getElementById('vision-pulse-alignment-trigger');
            elements.pulseAlignmentScore = document.getElementById('vision-pulse-alignment-score');
            elements.pulseAlignmentState = document.getElementById('vision-pulse-alignment-state');
            elements.pulseAlignmentExplainer = document.getElementById('vision-pulse-alignment-explainer');
            elements.pulseStartBtn = document.getElementById('vision-pulse-start-btn');
            elements.pulseViewPlanBtn = document.getElementById('vision-pulse-view-plan');

            elements.signalsBackBtn = document.getElementById('vision-signals-back-btn');
            elements.signalsToggleIcon = document.getElementById('vision-signals-toggle-icon');
            elements.planningBackBtn = document.getElementById('vision-planning-back-btn');
            elements.openHistoryBtn = document.getElementById('vision-open-history-btn');
            elements.historyBackBtn = document.getElementById('vision-history-back-btn');

            elements.directionWidget = document.getElementById('vision-direction-widget');
            elements.weekWidget = document.getElementById('vision-week-widget');
            elements.actionsWidget = document.getElementById('vision-actions-widget');

            elements.statusPill = document.getElementById('vision-status-pill');
            elements.statusState = document.getElementById('vision-status-state');
            elements.statusDetail = document.getElementById('vision-status-detail');
            elements.saveStatus = document.getElementById('vision-save-status');
            elements.lastCompute = document.getElementById('vision-last-compute');
            elements.snapshotMarker = document.getElementById('vision-snapshot-marker');

            elements.refreshSignals = document.getElementById('vision-refresh-signals');
            elements.calculating = document.getElementById('vision-calculating-indicator');

            elements.northStar = document.getElementById('vision-ns-text');
            elements.oneYear = document.getElementById('vision-1yr');
            elements.fiveYear = document.getElementById('vision-5yr');

            elements.themeInput = document.getElementById('vision-theme-input');
            elements.themeAddBtn = document.getElementById('vision-theme-add-btn');
            elements.themeList = document.getElementById('vision-themes-list');

            elements.weeklySummary = document.getElementById('vision-weekly-summary');
            elements.weeklyCommitmentsList = document.getElementById('vision-weekly-commitments-list');

            elements.milestoneTitle = document.getElementById('vision-ms-title');
            elements.milestoneDate = document.getElementById('vision-ms-date');
            elements.milestoneType = document.getElementById('vision-ms-type');
            elements.milestoneNextAction = document.getElementById('vision-ms-next-action');
            elements.milestoneBlocker = document.getElementById('vision-ms-blocker');
            elements.milestoneAddBtn = document.getElementById('vision-ms-add-btn');
            elements.milestoneList = document.getElementById('vision-milestone-list');

            elements.actionQueue = document.getElementById('vision-action-queue');

            elements.signalsPanel = document.getElementById('vision-signals-panel');
            elements.historyPanel = document.getElementById('vision-history-panel');

            elements.overallAlignment = document.getElementById('vision-overall-alignment');
            elements.alignmentRadar = document.getElementById('vision-alignment-radar');
            elements.driftSummary = document.getElementById('vision-drift-summary');
            elements.tensionList = document.getElementById('vision-tension-list');
            elements.explainabilityOverall = document.getElementById('vision-explainability-overall');
            elements.pillarsList = document.getElementById('vision-breakdown-pillars');
            elements.risksList = document.getElementById('vision-breakdown-risks');
            elements.commitmentsList = document.getElementById('vision-breakdown-commitments');
            elements.momentumStrip = document.getElementById('vision-momentum-strip');

            elements.decisionContext = document.getElementById('vision-decision-context');
            elements.decisionType = document.getElementById('vision-decision-type');
            elements.decisionTypeCustom = document.getElementById('vision-decision-type-custom');
            elements.decisionEnergy = document.getElementById('vision-decision-energy');
            elements.decisionNote = document.getElementById('vision-decision-note');
            elements.decisionYes = document.getElementById('vision-dec-yes');
            elements.decisionNo = document.getElementById('vision-dec-no');

            elements.weeklyAlignment = document.getElementById('vision-weekly-alignment');
            elements.weeklyDecisions = document.getElementById('vision-weekly-decisions');
            elements.weeklyMilestones = document.getElementById('vision-weekly-milestones');
            elements.decisionLog = document.getElementById('vision-decision-log');
            elements.driftHistory = document.getElementById('vision-drift-history');
        }

        function getLayerElement(layerName) {
            if (layerName === LAYERS.pulse) return elements.pulseLayer;
            if (layerName === LAYERS.signals) return elements.signalsLayer;
            if (layerName === LAYERS.planning) return elements.planningLayer;
            if (layerName === LAYERS.history) return elements.historyLayer;
            return null;
        }

        function setLayerVisibility(layerName, visible) {
            const layer = getLayerElement(layerName);
            if (!layer) return;
            layer.hidden = !visible;
            layer.style.display = visible ? '' : 'none';
            layer.classList.toggle('vision-layer-active', visible);
            layer.classList.toggle('vision-layer-hidden', !visible);
            layer.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }

        function syncAnalyticsToggleState() {
            const analyticsOpen = activeLayer === LAYERS.signals;
            if (elements.pulseDeepIcon) {
                elements.pulseDeepIcon.setAttribute('aria-pressed', analyticsOpen ? 'true' : 'false');
            }
            if (elements.signalsToggleIcon) {
                elements.signalsToggleIcon.setAttribute('aria-pressed', analyticsOpen ? 'true' : 'false');
            }
        }

        function mountLayer(layerName) {
            if (mountedLayers[layerName]) return;
            mountedLayers[layerName] = true;

            const layer = getLayerElement(layerName);
            if (layer) {
                layer.dataset.mounted = 'true';
            }

            const state = VisionStorage.getState();
            const snapshot = state.lastCompute || null;

            if (layerName === LAYERS.planning) {
                renderDirection(state);
                renderThemes(state.themes || []);
                renderWeeklyCommitments(state);
                renderMilestones(state);
                renderActionQueue(snapshot, state);
            } else if (layerName === LAYERS.signals) {
                renderSignals(snapshot);
            } else if (layerName === LAYERS.history) {
                renderDecisionLog();
                renderDriftHistory();
                renderWeeklyInsights();
            }
        }

        function showLayer(layerName) {
            const next = Object.values(LAYERS).includes(layerName) ? layerName : LAYERS.pulse;
            if (next !== LAYERS.pulse) {
                mountLayer(next);
            }

            // Enforce a strict single-layer state to avoid mixed layouts.
            [LAYERS.pulse, LAYERS.signals, LAYERS.planning, LAYERS.history].forEach((layer) => {
                setLayerVisibility(layer, false);
            });
            setLayerVisibility(next, true);

            activeLayer = next;
            syncAnalyticsToggleState();

            if (elements.dashboard) {
                elements.dashboard.dataset.activeLayer = next;
            }
            if (typeof window.scrollTo === 'function') {
                window.scrollTo(0, 0);
            }
            if (elements.dashboard) {
                elements.dashboard.scrollTop = 0;
            }
        }

        function initializeLayers() {
            mountedLayers.pulse = true;
            mountedLayers.signals = false;
            mountedLayers.planning = false;
            mountedLayers.history = false;

            if (elements.signalsLayer) elements.signalsLayer.dataset.mounted = 'false';
            if (elements.planningLayer) elements.planningLayer.dataset.mounted = 'false';
            if (elements.historyLayer) elements.historyLayer.dataset.mounted = 'false';

            showLayer(LAYERS.pulse);
        }

        function setStatus(state, detail) {
            if (!elements.statusPill) return;

            ['state-idle', 'state-active', 'state-completed'].forEach((cls) => {
                elements.statusPill.classList.remove(cls);
            });

            const classMap = {
                idle: 'state-idle',
                active: 'state-active',
                computing: 'state-active',
                completed: 'state-completed'
            };

            const cssClass = classMap[state] || 'state-idle';
            elements.statusPill.classList.add(cssClass);

            if (elements.statusState) {
                elements.statusState.textContent = state.charAt(0).toUpperCase() + state.slice(1);
            }
            if (elements.statusDetail) {
                elements.statusDetail.textContent = detail || 'Ready';
            }

            if (statusTimer) {
                clearTimeout(statusTimer);
                statusTimer = null;
            }

            if (state === 'completed') {
                statusTimer = setTimeout(() => {
                    setStatus('idle', 'Ready');
                }, 2000);
            }
        }

        function updateSaveStatus(message) {
            if (!elements.saveStatus) return;
            const timeText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            elements.saveStatus.textContent = `${message || 'Saved'} · ${timeText}`;
        }

        function updateLastCompute(timestamp) {
            if (!elements.lastCompute) return;
            elements.lastCompute.textContent = timestamp ? `Last compute: ${formatTimestamp(timestamp)}` : 'Last compute: —';
        }

        function showCalculating(visible) {
            if (!elements.calculating) return;
            elements.calculating.style.opacity = visible ? '0.9' : '0';
        }

        function showSnapshotMarker(message) {
            if (!elements.snapshotMarker) return;
            if (markerTimer) {
                clearTimeout(markerTimer);
                markerTimer = null;
            }
            elements.snapshotMarker.textContent = message || '';
            if (message) {
                markerTimer = setTimeout(() => {
                    elements.snapshotMarker.textContent = '';
                }, 3000);
            }
        }

        function truncateLine(text, limit) {
            const collapsed = String(text || '').replace(/\s+/g, ' ').trim();
            if (!collapsed) return '';
            if (collapsed.length <= limit) return collapsed;
            return `${collapsed.slice(0, Math.max(0, limit - 1)).trim()}…`;
        }

        function getAlignmentState(score) {
            if (score < 45) return { key: 'low', label: 'Low alignment' };
            if (score < 70) return { key: 'medium', label: 'Medium alignment' };
            return { key: 'high', label: 'High alignment' };
        }

        function buildAlignmentExplanation(state, driftValue) {
            if (state.key === 'low') {
                return `The path feels unsettled (${formatSigned(driftValue)} drift). Breathe, then choose one gentle next step.`;
            }
            if (state.key === 'medium') {
                return `The direction is alive (${formatSigned(driftValue)} drift). Keep your attention on this week’s commitments.`;
            }
            return `The path is clear (${formatSigned(driftValue)} drift). Begin with the next action while momentum is warm.`;
        }

        function deriveRecommendedAction(snapshot, state) {
            const queue = snapshot && Array.isArray(snapshot.actionQueue) ? snapshot.actionQueue : [];
            if (queue.length) {
                const entry = queue[0];
                return {
                    title: entry.title || 'Advance the top action',
                    reason: entry.reason || 'A clear next move surfaced from your current direction.',
                    milestoneId: entry.milestoneId || null
                };
            }

            const ids = Array.isArray(state && state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : [];
            const milestonesById = new Map((state && state.milestones || []).map((milestone) => [milestone.id, milestone]));
            const nextMilestone = ids.map((id) => milestonesById.get(id)).find((milestone) => milestone && milestone.status !== 'done');

            if (nextMilestone) {
                return {
                    title: nextMilestone.nextAction || nextMilestone.title || 'Advance weekly commitment',
                    reason: `From commitment: ${nextMilestone.title || 'Untitled milestone'}`,
                    milestoneId: nextMilestone.id || null
                };
            }

            return {
                title: 'Name the next meaningful step',
                reason: 'Add a milestone and the engine will shape the clearest next move.',
                milestoneId: null
            };
        }

        function renderPulse(state, snapshot) {
            if (!elements.pulseLayer) return;

            const northStar = truncateLine(state && state.northStar, 130);
            const oneYear = truncateLine(state && state.oneYearDirection, 130);
            const milestonesById = new Map((state && state.milestones || []).map((milestone) => [milestone.id, milestone]));
            const commitmentIds = Array.isArray(state && state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : [];
            const commitmentCount = commitmentIds
                .map((id) => milestonesById.get(id))
                .filter((milestone) => milestone && milestone.status !== 'done')
                .length;
            const commitmentLabel = `${commitmentCount} commitment${commitmentCount === 1 ? '' : 's'} active`;

            if (elements.pulseNorthStar) {
                elements.pulseNorthStar.textContent = northStar || 'Write one sentence that feels like a true direction.';
            }
            if (elements.pulseOneYear) {
                elements.pulseOneYear.textContent = oneYear || 'Sketch the next year as a living horizon.';
            }
            if (elements.pulseCommitments) {
                elements.pulseCommitments.textContent = commitmentLabel;
            }

            const recommended = deriveRecommendedAction(snapshot, state);
            recommendedActionMilestoneId = recommended.milestoneId;

            if (elements.pulseNextAction) {
                elements.pulseNextAction.textContent = recommended.title;
            }
            if (elements.pulseNextActionContext) {
                elements.pulseNextActionContext.textContent = recommended.reason;
            }
            if (elements.pulseStartBtn) {
                const hasConcreteTarget = Boolean(recommendedActionMilestoneId);
                elements.pulseStartBtn.disabled = false;
                elements.pulseStartBtn.classList.toggle('is-disabled', !hasConcreteTarget);
            }

            const score = Math.round(snapshot && snapshot.alignment ? snapshot.alignment.overall || 0 : 0);
            const stateMeta = getAlignmentState(score);
            const driftOverall = snapshot && snapshot.drift ? snapshot.drift.overall || 0 : 0;

            if (elements.pulseAlignmentScore) {
                elements.pulseAlignmentScore.textContent = `${score}`;
            }
            if (elements.pulseAlignmentState) {
                elements.pulseAlignmentState.textContent = stateMeta.label;
            }
            if (elements.pulseAlignmentExplainer) {
                elements.pulseAlignmentExplainer.textContent = buildAlignmentExplanation(stateMeta, driftOverall);
            }
            if (elements.pulseAlignmentTrigger) {
                elements.pulseAlignmentTrigger.classList.remove('state-low', 'state-medium', 'state-high');
                elements.pulseAlignmentTrigger.classList.add(`state-${stateMeta.key}`);
            }
        }

        function refreshMilestoneViews(fields) {
            const state = VisionStorage.getState();
            if (mountedLayers.planning) {
                renderMilestones(state);
                renderWeeklyCommitments(state);
            }
            renderPulse(state, state.lastCompute || lastSnapshot);
            VisionComputeScheduler.scheduleCompute(fields || ['milestones']);
            return state;
        }

        function getMilestoneById(id) {
            const milestones = VisionStorage.getMilestones();
            return milestones.find((item) => item.id === id) || null;
        }

        function focusMilestone(id) {
            if (!id || !elements.milestoneList) return;
            const target = Array.from(elements.milestoneList.querySelectorAll('.vision-milestone-item'))
                .find((item) => item.dataset && item.dataset.id === id);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('is-focused');
            const openTrigger = target.querySelector('.vision-milestone-open-trigger');
            if (openTrigger) openTrigger.focus({ preventScroll: true });
            if (focusTimer) {
                clearTimeout(focusTimer);
                focusTimer = null;
            }
            focusTimer = setTimeout(() => {
                target.classList.remove('is-focused');
            }, 1600);
        }

        function getMilestonePhase(milestone) {
            const completion = Math.round(clamp(milestone && milestone.completionPct || 0, 0, 100));
            if ((milestone && milestone.status) === 'done' || completion >= 100) return 'done';
            if (completion > 0) return 'active';
            return 'creation';
        }

        function getMilestoneModalData() {
            const titleInput = elements.milestoneModalTitle || elements.milestoneModalHeaderTitle;
            const headerTitleInput = elements.milestoneModalHeaderTitle || elements.milestoneModalTitle;
            const nextActionInput = elements.milestoneModalNextAction;
            const blockerInput = elements.milestoneModalBlocker;
            const dateInput = elements.milestoneModalDate;
            const progressInput = elements.milestoneModalProgress;
            const phaseInput = elements.milestoneModalPhase;
            const notesInput = elements.milestoneModalNotes;

            return {
                title: String(titleInput && titleInput.value || '').trim(),
                nextAction: String(nextActionInput && nextActionInput.value || '').trim(),
                blocker: String(blockerInput && blockerInput.value || '').trim(),
                date: String(dateInput && dateInput.value || ''),
                completionPct: clamp(parseInt(progressInput && progressInput.value, 10) || 0, 0, 100),
                phase: String(phaseInput && phaseInput.value || 'creation'),
                notes: String(notesInput && notesInput.value || '').trim(),
                headerTitle: String(headerTitleInput && headerTitleInput.value || '').trim()
            };
        }

        function normalizeMilestoneModalData(payload) {
            return {
                title: String(payload && payload.title || '').trim(),
                nextAction: String(payload && payload.nextAction || '').trim(),
                blocker: String(payload && payload.blocker || '').trim(),
                date: String(payload && payload.date || ''),
                completionPct: clamp(payload && payload.completionPct, 0, 100),
                phase: String(payload && payload.phase || 'creation'),
                notes: String(payload && payload.notes || '').trim()
            };
        }

        function isMilestoneModalDirty() {
            if (!milestoneModalState.open || !milestoneModalState.baseline) return false;
            const current = normalizeMilestoneModalData(getMilestoneModalData());
            return JSON.stringify(current) !== JSON.stringify(milestoneModalState.baseline);
        }

        function syncMilestoneModalTitles(value, source) {
            if (source !== 'header' && elements.milestoneModalHeaderTitle) {
                elements.milestoneModalHeaderTitle.value = value;
            }
            if (source !== 'body' && elements.milestoneModalTitle) {
                elements.milestoneModalTitle.value = value;
            }
        }

        function syncMilestoneModalPhaseFromProgress() {
            if (!elements.milestoneModalProgress || !elements.milestoneModalPhase) return;
            const completion = clamp(parseInt(elements.milestoneModalProgress.value, 10) || 0, 0, 100);
            if (completion >= 100) {
                elements.milestoneModalPhase.value = 'done';
            } else if (completion > 0) {
                elements.milestoneModalPhase.value = 'active';
            } else {
                elements.milestoneModalPhase.value = 'creation';
            }
        }

        function syncMilestoneModalProgressLabel() {
            if (!elements.milestoneModalProgressValue || !elements.milestoneModalProgress) return;
            const completion = clamp(parseInt(elements.milestoneModalProgress.value, 10) || 0, 0, 100);
            elements.milestoneModalProgressValue.textContent = `${Math.round(completion)}%`;
        }

        function updateMilestoneFromModal(id, payload) {
            if (!id) return false;
            const normalized = normalizeMilestoneModalData(payload);
            const completion = normalized.phase === 'done'
                ? 100
                : (normalized.phase === 'creation'
                    ? 0
                    : clamp(Math.max(1, normalized.completionPct), 1, 99));

            VisionStorage.updateMilestone(id, {
                title: normalized.title,
                nextAction: normalized.nextAction,
                blocker: normalized.blocker,
                date: normalized.date,
                completionPct: completion,
                notes: normalized.notes
            });
            return true;
        }

        function focusTrapMilestoneModal(event) {
            if (!milestoneModalState.open || !elements.milestoneModalOverlay || !elements.milestoneModalOverlay.classList.contains('active')) return;
            if (event.key !== 'Tab') return;
            const focusable = Array.from(elements.milestoneModalOverlay.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
            )).filter((node) => node.offsetParent !== null);
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
                return;
            }

            if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        function closeMilestoneModal(forceClose) {
            if (!elements.milestoneModalOverlay) return false;
            if (!forceClose && isMilestoneModalDirty()) {
                const discard = window.confirm('Discard unsaved milestone changes?');
                if (!discard) return false;
            }

            elements.milestoneModalOverlay.classList.remove('active');
            elements.milestoneModalOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('vision-ms-modal-open');

            milestoneModalState.open = false;
            milestoneModalState.id = null;
            milestoneModalState.source = null;
            milestoneModalState.baseline = null;

            if (milestoneModalState.lastFocusedElement && typeof milestoneModalState.lastFocusedElement.focus === 'function') {
                milestoneModalState.lastFocusedElement.focus({ preventScroll: true });
            }
            milestoneModalState.lastFocusedElement = null;
            return true;
        }

        function ensureMilestoneModal() {
            if (elements.milestoneModalOverlay) return;

            const modalHost = document.createElement('div');
            modalHost.className = 'vision-ms-modal-overlay';
            modalHost.id = 'vision-ms-modal-overlay';
            modalHost.setAttribute('aria-hidden', 'true');
            modalHost.innerHTML = `
                <div class="vision-ms-modal" role="dialog" aria-modal="true" aria-labelledby="vision-ms-modal-header-title">
                    <div class="vision-ms-modal-header">
                        <input id="vision-ms-modal-header-title" class="vision-ms-modal-header-title" type="text" placeholder="Milestone title">
                        <button type="button" class="vision-ms-modal-close" id="vision-ms-modal-close" aria-label="Close milestone editor">×</button>
                    </div>
                    <div class="vision-ms-modal-body">
                        <div class="vision-ms-modal-grid">
                            <label class="vision-ms-modal-field">
                                <span>Title</span>
                                <input id="vision-ms-modal-title" type="text" placeholder="Milestone title">
                            </label>
                            <label class="vision-ms-modal-field">
                                <span>Status / Phase</span>
                                <select id="vision-ms-modal-phase">
                                    <option value="creation">Creation</option>
                                    <option value="active">Active</option>
                                    <option value="done">Done</option>
                                </select>
                            </label>
                            <label class="vision-ms-modal-field">
                                <span>Next Action</span>
                                <input id="vision-ms-modal-next-action" type="text" placeholder="Required">
                            </label>
                            <label class="vision-ms-modal-field">
                                <span>Blocker</span>
                                <input id="vision-ms-modal-blocker" type="text" placeholder="Optional">
                            </label>
                            <label class="vision-ms-modal-field">
                                <span>Due Date</span>
                                <input id="vision-ms-modal-date" type="date">
                            </label>
                            <label class="vision-ms-modal-field vision-ms-modal-field--slider">
                                <span>Completion</span>
                                <div class="vision-ms-modal-slider-row">
                                    <input id="vision-ms-modal-progress" type="range" min="0" max="100" step="1">
                                    <output id="vision-ms-modal-progress-value">0%</output>
                                </div>
                            </label>
                            <label class="vision-ms-modal-field vision-ms-modal-field--full">
                                <span>Notes / Description</span>
                                <textarea id="vision-ms-modal-notes" rows="4" placeholder="Context and details"></textarea>
                            </label>
                        </div>
                    </div>
                    <div class="vision-ms-modal-footer">
                        <button type="button" id="vision-ms-modal-save" class="ui-btn ui-btn--primary">Save</button>
                        <button type="button" id="vision-ms-modal-cancel" class="ui-btn ui-btn--secondary">Cancel</button>
                        <button type="button" id="vision-ms-modal-done" class="ui-btn ui-btn--secondary">Mark Done</button>
                        <button type="button" id="vision-ms-modal-snooze" class="ui-btn ui-btn--secondary">Snooze 7d</button>
                        <button type="button" id="vision-ms-modal-blocker-set" class="ui-btn ui-btn--secondary">Set Blocker</button>
                        <button type="button" id="vision-ms-modal-secondary" class="vision-ms-modal-secondary">Uncommit / Delete</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalHost);

            elements.milestoneModalOverlay = modalHost;
            elements.milestoneModal = modalHost.querySelector('.vision-ms-modal');
            elements.milestoneModalClose = modalHost.querySelector('#vision-ms-modal-close');
            elements.milestoneModalHeaderTitle = modalHost.querySelector('#vision-ms-modal-header-title');
            elements.milestoneModalTitle = modalHost.querySelector('#vision-ms-modal-title');
            elements.milestoneModalPhase = modalHost.querySelector('#vision-ms-modal-phase');
            elements.milestoneModalNextAction = modalHost.querySelector('#vision-ms-modal-next-action');
            elements.milestoneModalBlocker = modalHost.querySelector('#vision-ms-modal-blocker');
            elements.milestoneModalDate = modalHost.querySelector('#vision-ms-modal-date');
            elements.milestoneModalProgress = modalHost.querySelector('#vision-ms-modal-progress');
            elements.milestoneModalProgressValue = modalHost.querySelector('#vision-ms-modal-progress-value');
            elements.milestoneModalNotes = modalHost.querySelector('#vision-ms-modal-notes');
            elements.milestoneModalSave = modalHost.querySelector('#vision-ms-modal-save');
            elements.milestoneModalCancel = modalHost.querySelector('#vision-ms-modal-cancel');
            elements.milestoneModalDone = modalHost.querySelector('#vision-ms-modal-done');
            elements.milestoneModalSnooze = modalHost.querySelector('#vision-ms-modal-snooze');
            elements.milestoneModalSetBlocker = modalHost.querySelector('#vision-ms-modal-blocker-set');
            elements.milestoneModalSecondary = modalHost.querySelector('#vision-ms-modal-secondary');

            elements.milestoneModalOverlay.addEventListener('click', (event) => {
                if (event.target === elements.milestoneModalOverlay) {
                    closeMilestoneModal(false);
                }
            });

            elements.milestoneModalOverlay.addEventListener('keydown', (event) => {
                if (!milestoneModalState.open) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeMilestoneModal(false);
                    return;
                }
                focusTrapMilestoneModal(event);
            });

            if (elements.milestoneModalClose) {
                elements.milestoneModalClose.addEventListener('click', () => closeMilestoneModal(false));
            }
            if (elements.milestoneModalCancel) {
                elements.milestoneModalCancel.addEventListener('click', () => closeMilestoneModal(false));
            }

            if (elements.milestoneModalHeaderTitle) {
                elements.milestoneModalHeaderTitle.addEventListener('input', () => {
                    syncMilestoneModalTitles(elements.milestoneModalHeaderTitle.value, 'header');
                });
            }
            if (elements.milestoneModalTitle) {
                elements.milestoneModalTitle.addEventListener('input', () => {
                    syncMilestoneModalTitles(elements.milestoneModalTitle.value, 'body');
                });
            }

            if (elements.milestoneModalProgress) {
                elements.milestoneModalProgress.addEventListener('input', () => {
                    syncMilestoneModalProgressLabel();
                    syncMilestoneModalPhaseFromProgress();
                });
            }

            if (elements.milestoneModalPhase) {
                elements.milestoneModalPhase.addEventListener('change', () => {
                    if (!elements.milestoneModalProgress) return;
                    if (elements.milestoneModalPhase.value === 'done') {
                        elements.milestoneModalProgress.value = '100';
                    } else if (elements.milestoneModalPhase.value === 'creation') {
                        elements.milestoneModalProgress.value = '0';
                    } else if (clamp(parseInt(elements.milestoneModalProgress.value, 10) || 0, 0, 100) <= 0) {
                        elements.milestoneModalProgress.value = '1';
                    }
                    syncMilestoneModalProgressLabel();
                });
            }

            if (elements.milestoneModalSave) {
                elements.milestoneModalSave.addEventListener('click', () => {
                    if (!milestoneModalState.id) return;
                    const payload = getMilestoneModalData();
                    if (!payload.title) {
                        setStatus('active', 'Milestone needs a title.');
                        return;
                    }
                    if (payload.phase !== 'done' && !payload.nextAction) {
                        setStatus('active', 'Next action is required.');
                        return;
                    }
                    updateMilestoneFromModal(milestoneModalState.id, payload);
                    updateSaveStatus('Milestone saved');
                    refreshMilestoneViews(['milestones', 'weeklyCommitments']);
                    closeMilestoneModal(true);
                });
            }

            if (elements.milestoneModalDone) {
                elements.milestoneModalDone.addEventListener('click', () => {
                    if (!milestoneModalState.id) return;
                    applyMilestoneAction('queue-mark-done', milestoneModalState.id, 'modal');
                    closeMilestoneModal(true);
                });
            }

            if (elements.milestoneModalSnooze) {
                elements.milestoneModalSnooze.addEventListener('click', () => {
                    if (!milestoneModalState.id) return;
                    applyMilestoneAction('snooze-milestone', milestoneModalState.id, 'modal');
                    closeMilestoneModal(true);
                });
            }

            if (elements.milestoneModalSetBlocker) {
                elements.milestoneModalSetBlocker.addEventListener('click', () => {
                    if (!milestoneModalState.id || !elements.milestoneModalBlocker) return;
                    const blockerText = String(elements.milestoneModalBlocker.value || '').trim();
                    VisionStorage.updateMilestone(milestoneModalState.id, { blocker: blockerText });
                    updateSaveStatus(blockerText ? 'Blocker set' : 'Blocker cleared');
                    refreshMilestoneViews(['milestones']);
                    milestoneModalState.baseline = normalizeMilestoneModalData(getMilestoneModalData());
                });
            }

            if (elements.milestoneModalSecondary) {
                elements.milestoneModalSecondary.addEventListener('click', () => {
                    if (!milestoneModalState.id) return;
                    const state = VisionStorage.getState();
                    const commitmentSet = new Set(Array.isArray(state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : []);
                    const isCommitted = commitmentSet.has(milestoneModalState.id);
                    if (isCommitted) {
                        VisionStorage.toggleWeeklyCommitment(milestoneModalState.id);
                        updateSaveStatus('Milestone uncommitted');
                        refreshMilestoneViews(['weeklyCommitments', 'milestones']);
                        closeMilestoneModal(true);
                        return;
                    }
                    const confirmed = window.confirm('Delete this milestone?');
                    if (!confirmed) return;
                    VisionStorage.removeMilestone(milestoneModalState.id);
                    updateSaveStatus('Milestone removed');
                    refreshMilestoneViews(['milestones', 'weeklyCommitments']);
                    closeMilestoneModal(true);
                });
            }
        }

        function openMilestoneModal(id, source) {
            ensureMilestoneModal();
            const milestone = getMilestoneById(id);
            if (!milestone || !elements.milestoneModalOverlay) return false;

            const state = VisionStorage.getState();
            const commitmentSet = new Set(Array.isArray(state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : []);
            const committed = commitmentSet.has(id);
            const phase = getMilestonePhase(milestone);

            milestoneModalState.open = true;
            milestoneModalState.id = id;
            milestoneModalState.source = source || 'milestones';
            milestoneModalState.lastFocusedElement = document.activeElement;

            syncMilestoneModalTitles(milestone.title || '', '');
            if (elements.milestoneModalNextAction) elements.milestoneModalNextAction.value = milestone.nextAction || '';
            if (elements.milestoneModalBlocker) elements.milestoneModalBlocker.value = milestone.blocker || '';
            if (elements.milestoneModalDate) elements.milestoneModalDate.value = toInputDate(milestone.date);
            if (elements.milestoneModalPhase) elements.milestoneModalPhase.value = phase;
            if (elements.milestoneModalProgress) elements.milestoneModalProgress.value = String(Math.round(clamp(milestone.completionPct || 0, 0, 100)));
            if (elements.milestoneModalNotes) elements.milestoneModalNotes.value = String(milestone.notes || '');
            if (elements.milestoneModalSecondary) elements.milestoneModalSecondary.textContent = committed ? 'Uncommit' : 'Delete';

            syncMilestoneModalProgressLabel();

            milestoneModalState.baseline = normalizeMilestoneModalData(getMilestoneModalData());

            elements.milestoneModalOverlay.classList.add('active');
            elements.milestoneModalOverlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('vision-ms-modal-open');

            const focusTarget = elements.milestoneModalTitle || elements.milestoneModalHeaderTitle || elements.milestoneModalClose;
            if (focusTarget) {
                window.setTimeout(() => {
                    focusTarget.focus({ preventScroll: true });
                    if (focusTarget.select) focusTarget.select();
                }, 20);
            }

            if (source === 'queue') {
                updateSaveStatus('Opened milestone from queue');
            } else if (source === 'weekly') {
                updateSaveStatus('Opened weekly commitment');
            } else {
                updateSaveStatus('Opened milestone');
            }
            return true;
        }

        function applyMilestoneAction(action, id, source) {
            const milestone = getMilestoneById(id);
            if (!milestone && action !== 'remove-milestone') return false;

            if (action === 'remove-milestone') {
                VisionStorage.removeMilestone(id);
                updateSaveStatus('Milestone removed');
                refreshMilestoneViews(['milestones', 'weeklyCommitments']);
                return true;
            }

            if (!milestone) return false;

            if (action === 'toggle-milestone' || action === 'queue-mark-done') {
                const done = milestone.status === 'done';
                const completionPct = action === 'queue-mark-done' ? 100 : (done ? 0 : 100);
                VisionStorage.updateMilestone(id, { completionPct });
                updateSaveStatus(done && action !== 'queue-mark-done' ? 'Milestone reopened' : 'Milestone completed');
                refreshMilestoneViews(['milestones', 'weeklyCommitments']);
                return true;
            }

            if (action === 'snooze-milestone' || action === 'queue-snooze') {
                if (milestone.status === 'done') return false;
                const nextDate = addDaysInputDate(milestone.date, 7);
                VisionStorage.updateMilestone(id, { date: nextDate });
                updateSaveStatus('Milestone snoozed by 7 days');
                refreshMilestoneViews(['milestones']);
                return true;
            }

            if (action === 'set-blocker' || action === 'queue-set-blocker') {
                if (milestone.status === 'done') return false;
                const current = milestone.blocker || '';
                const next = window.prompt('Set blocker (leave blank to clear):', current);
                if (next == null) return false;
                VisionStorage.updateMilestone(id, { blocker: next.trim() });
                updateSaveStatus(next.trim() ? 'Blocker set' : 'Blocker cleared');
                refreshMilestoneViews(['milestones']);
                return true;
            }

            if (action === 'toggle-commitment' || action === 'weekly-uncommit') {
                VisionStorage.toggleWeeklyCommitment(id);
                updateSaveStatus('Weekly commitments updated');
                refreshMilestoneViews(['weeklyCommitments', 'milestones']);
                return true;
            }

            if (action === 'queue-open' || action === 'weekly-open') {
                return openMilestoneModal(id, source);
            }

            if (action === 'open-milestone-modal') {
                return openMilestoneModal(id, source || 'milestones');
            }

            return false;
        }

        function startRecommendedAction() {
            showLayer(LAYERS.planning);
            if (recommendedActionMilestoneId) {
                applyMilestoneAction('queue-open', recommendedActionMilestoneId, 'queue');
                return;
            }
            if (elements.milestoneTitle) {
                elements.milestoneTitle.focus({ preventScroll: true });
            }
        }

        function attachAutoSave(element, updater, fieldName) {
            if (!element || typeof updater !== 'function') return;
            let timer = null;
            element.addEventListener('input', () => {
                setStatus('active', 'Editing...');
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    updater(element.value);
                    const state = VisionStorage.getState();
                    renderPulse(state, state.lastCompute || lastSnapshot);
                    updateSaveStatus('Auto-saved');
                    VisionComputeScheduler.scheduleCompute([fieldName]);
                }, 400);
            });
        }

        function attachEventListeners() {
            if (elements.pulseDeepIcon) {
                elements.pulseDeepIcon.addEventListener('click', () => {
                    if (activeLayer === LAYERS.signals) {
                        showLayer(LAYERS.pulse);
                    } else {
                        showLayer(LAYERS.signals);
                    }
                });
            }
            if (elements.signalsToggleIcon) {
                elements.signalsToggleIcon.addEventListener('click', () => {
                    if (activeLayer === LAYERS.signals) {
                        showLayer(LAYERS.pulse);
                    } else {
                        showLayer(LAYERS.signals);
                    }
                });
            }
            if (elements.pulseViewPlanBtn) {
                elements.pulseViewPlanBtn.addEventListener('click', () => {
                    showLayer(LAYERS.planning);
                });
            }
            if (elements.pulseStartBtn) {
                elements.pulseStartBtn.addEventListener('click', () => {
                    startRecommendedAction();
                });
            }
            if (elements.signalsBackBtn) {
                elements.signalsBackBtn.addEventListener('click', () => {
                    showLayer(LAYERS.pulse);
                });
            }
            if (elements.planningBackBtn) {
                elements.planningBackBtn.addEventListener('click', () => {
                    showLayer(LAYERS.pulse);
                });
            }
            if (elements.openHistoryBtn) {
                elements.openHistoryBtn.addEventListener('click', () => {
                    showLayer(LAYERS.history);
                });
            }
            if (elements.historyBackBtn) {
                elements.historyBackBtn.addEventListener('click', () => {
                    showLayer(LAYERS.pulse);
                });
            }

            attachAutoSave(elements.northStar, (value) => VisionStorage.updateNorthStar(value), 'northStar');
            attachAutoSave(
                elements.oneYear,
                (value) => VisionStorage.updateTimeHorizons(value, elements.fiveYear ? elements.fiveYear.value : ''),
                'oneYearDirection'
            );
            attachAutoSave(
                elements.fiveYear,
                (value) => VisionStorage.updateTimeHorizons(elements.oneYear ? elements.oneYear.value : '', value),
                'fiveYearDirection'
            );

            if (elements.themeAddBtn) {
                elements.themeAddBtn.addEventListener('click', () => {
                    const label = elements.themeInput ? elements.themeInput.value.trim() : '';
                    if (!label) return;
                    VisionStorage.addTheme(label);
                    if (elements.themeInput) elements.themeInput.value = '';
                    updateSaveStatus('Theme saved');
                    renderThemes(VisionStorage.getThemes());
                    VisionComputeScheduler.scheduleCompute(['themes']);
                });
            }

            if (elements.themeInput) {
                elements.themeInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        elements.themeAddBtn && elements.themeAddBtn.click();
                    }
                });
            }

            if (elements.themeList) {
                elements.themeList.addEventListener('click', (event) => {
                    const action = event.target && event.target.dataset && event.target.dataset.action;
                    const id = event.target && event.target.dataset && event.target.dataset.id;
                    if (action === 'remove-theme' && id) {
                        VisionStorage.removeTheme(id);
                        updateSaveStatus('Theme removed');
                        renderThemes(VisionStorage.getThemes());
                        VisionComputeScheduler.scheduleCompute(['themes']);
                    }
                });
            }

            if (elements.milestoneAddBtn) {
                elements.milestoneAddBtn.addEventListener('click', () => {
                    const title = elements.milestoneTitle ? elements.milestoneTitle.value.trim() : '';
                    const nextAction = elements.milestoneNextAction ? elements.milestoneNextAction.value.trim() : '';
                    if (!title || !nextAction) {
                        setStatus('active', 'Milestones need a title and next action.');
                        return;
                    }

                    VisionStorage.addMilestone({
                        title,
                        date: elements.milestoneDate ? elements.milestoneDate.value : '',
                        visionType: elements.milestoneType ? elements.milestoneType.value : 'Custom',
                        nextAction,
                        blocker: elements.milestoneBlocker ? elements.milestoneBlocker.value.trim() : ''
                    });

                    if (elements.milestoneTitle) elements.milestoneTitle.value = '';
                    if (elements.milestoneDate) elements.milestoneDate.value = '';
                    if (elements.milestoneNextAction) elements.milestoneNextAction.value = '';
                    if (elements.milestoneBlocker) elements.milestoneBlocker.value = '';

                    updateSaveStatus('Milestone added');
                    refreshMilestoneViews(['milestones']);
                });
            }

            if (elements.milestoneList) {
                elements.milestoneList.addEventListener('click', (event) => {
                    const actionNode = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
                    const action = actionNode && actionNode.dataset ? actionNode.dataset.action : '';
                    const id = actionNode && actionNode.dataset ? actionNode.dataset.id : '';
                    if (!action || !id) return;
                    applyMilestoneAction(action, id, 'milestones');
                });
            }

            if (elements.actionQueue) {
                elements.actionQueue.addEventListener('click', (event) => {
                    const actionNode = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
                    const action = actionNode && actionNode.dataset ? actionNode.dataset.action : '';
                    const id = actionNode && actionNode.dataset ? actionNode.dataset.id : '';
                    if (!action || !id) return;
                    applyMilestoneAction(action, id, 'queue');
                });
            }

            if (elements.weeklyCommitmentsList) {
                elements.weeklyCommitmentsList.addEventListener('click', (event) => {
                    const actionNode = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
                    const action = actionNode && actionNode.dataset ? actionNode.dataset.action : '';
                    const id = actionNode && actionNode.dataset ? actionNode.dataset.id : '';
                    if (!action || !id) return;
                    applyMilestoneAction(action, id, 'weekly');
                });
            }

            if (elements.decisionType) {
                elements.decisionType.addEventListener('change', () => {
                    if (!elements.decisionTypeCustom) return;
                    elements.decisionTypeCustom.classList.toggle('hidden', elements.decisionType.value !== 'Custom');
                });
            }

            const logDecision = (decision) => {
                const context = elements.decisionContext ? elements.decisionContext.value : 'vision';
                const baseType = elements.decisionType ? elements.decisionType.value : 'Custom';
                const customType = elements.decisionTypeCustom ? elements.decisionTypeCustom.value.trim() : '';
                const visionType = baseType === 'Custom' ? (customType || 'Custom') : baseType;
                const energyState = elements.decisionEnergy ? elements.decisionEnergy.value.trim() : '';
                const note = elements.decisionNote ? elements.decisionNote.value.trim() : '';

                VisionStorage.logDecision({
                    decision,
                    contextMode: context,
                    visionType,
                    energyState: energyState || null,
                    note: note || null,
                    alignmentAtDecision: lastSnapshot && lastSnapshot.alignment ? lastSnapshot.alignment.overall : 50,
                    driftAtDecision: lastSnapshot && lastSnapshot.drift ? lastSnapshot.drift.overall : 0
                });

                updateSaveStatus('Decision logged');
                renderDecisionLog();
                VisionComputeScheduler.scheduleCompute(['decisions']);
            };

            if (elements.decisionYes) {
                elements.decisionYes.addEventListener('click', () => logDecision('yes'));
            }
            if (elements.decisionNo) {
                elements.decisionNo.addEventListener('click', () => logDecision('no'));
            }

            if (elements.refreshSignals) {
                elements.refreshSignals.addEventListener('click', () => {
                    setStatus('active', 'Refreshing signals...');
                    VisionComputeScheduler.runImmediate(['manualRefresh']);
                });
            }
        }

        function renderDirection(state) {
            if (!mountedLayers.planning) return;
            if (elements.northStar) elements.northStar.value = state.northStar || '';
            if (elements.oneYear) elements.oneYear.value = state.oneYearDirection || '';
            if (elements.fiveYear) elements.fiveYear.value = state.fiveYearDirection || '';
        }

        function renderThemes(themes) {
            if (!mountedLayers.planning || !elements.themeList) return;
            if (!themes.length) {
                elements.themeList.innerHTML = '<div class="state-placeholder">Add a theme to anchor this plan.</div>';
                return;
            }

            elements.themeList.innerHTML = themes.map((theme) => `
                <span class="vision-theme-tag">
                    ${escapeHtml(theme.label)}
                    <button type="button" data-action="remove-theme" data-id="${theme.id}">×</button>
                </span>
            `).join('');
        }

        function sortMilestones(list) {
            const today = startOfTodayTs();
            const soonCutoff = today + (7 * MS_PER_DAY);

            function bucket(item) {
                if (item.status === 'done') return 4;
                const dueTs = parseDateTs(item.date);
                if (dueTs != null && dueTs < today) return 0;
                if (dueTs != null && dueTs <= soonCutoff) return 1;
                if (item.status === 'active') return 2;
                return 3;
            }

            return list.slice().sort((a, b) => {
                const aBucket = bucket(a);
                const bBucket = bucket(b);
                if (aBucket !== bBucket) return aBucket - bBucket;

                const aDue = parseDateTs(a.date);
                const bDue = parseDateTs(b.date);
                if (aDue != null && bDue != null && aDue !== bDue) return aDue - bDue;
                if (aDue != null && bDue == null) return -1;
                if (aDue == null && bDue != null) return 1;

                const aUpdated = parseDateTs(a.updatedAt || a.createdAt || 0) || 0;
                const bUpdated = parseDateTs(b.updatedAt || b.createdAt || 0) || 0;
                if (bUpdated !== aUpdated) return bUpdated - aUpdated;

                return String(a.title).localeCompare(String(b.title));
            });
        }

        function renderWeeklyCommitments(state) {
            if (!mountedLayers.planning || !elements.weeklySummary || !elements.weeklyCommitmentsList) return;
            const ids = Array.isArray(state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : [];
            const milestonesById = new Map((state.milestones || []).map((milestone) => [milestone.id, milestone]));
            const committed = ids
                .map((id) => milestonesById.get(id))
                .filter((milestone) => milestone && milestone.status !== 'done');

            elements.weeklySummary.textContent = `${committed.length} of 3 weekly commitments selected.`;

            if (!committed.length) {
                elements.weeklyCommitmentsList.innerHTML = '<div class="state-placeholder">Select up to three commitments from milestones.</div>';
                return;
            }

            elements.weeklyCommitmentsList.innerHTML = committed.map((milestone) => `
                <div class="vision-commitment-item" data-id="${escapeHtml(milestone.id)}">
                    <strong>${escapeHtml(milestone.title)}</strong>
                    <div>${escapeHtml(milestone.nextAction || 'No next action')}</div>
                    <div class="vision-commitment-meta">${escapeHtml(milestone.visionType)} · ${Math.round(milestone.completionPct || 0)}%</div>
                    <div class="vision-commitment-actions">
                        <button type="button" data-action="weekly-open" data-id="${escapeHtml(milestone.id)}">Open</button>
                        <button type="button" data-action="weekly-uncommit" data-id="${escapeHtml(milestone.id)}">Uncommit</button>
                    </div>
                </div>
            `).join('');
        }

        function renderActionQueue(snapshot, state) {
            if (!mountedLayers.planning || !elements.actionQueue) return;
            const queue = snapshot && Array.isArray(snapshot.actionQueue) ? snapshot.actionQueue : [];

            if (!queue.length) {
                elements.actionQueue.innerHTML = '<div class="state-placeholder">Top actions will show after compute.</div>';
                return;
            }

            const sourceState = state || VisionStorage.getState();
            const milestonesById = new Map((sourceState.milestones || []).map((milestone) => [milestone.id, milestone]));
            const todayTs = startOfTodayTs();

            elements.actionQueue.innerHTML = queue.map((entry) => {
                const milestone = milestonesById.get(entry.milestoneId);
                const dueTs = parseDateTs(milestone && milestone.date);
                const isOverdue = milestone && milestone.status !== 'done' && dueTs != null && dueTs < todayTs;
                const isBlocked = milestone && milestone.status !== 'done' && Boolean(String(milestone.blocker || '').trim());
                const missingNextAction = (milestone && milestone.status !== 'done' && !String(milestone.nextAction || '').trim())
                    || /missing next action/i.test(String(entry.reason || ''));
                const badges = [];
                if (isOverdue) badges.push('<span class="vision-action-badge is-overdue">Overdue</span>');
                if (isBlocked) badges.push('<span class="vision-action-badge is-blocked">Blocked</span>');
                if (missingNextAction) badges.push('<span class="vision-action-badge is-next-action">Needs Next Action</span>');
                const disabled = !milestone || milestone.status === 'done';

                return `
                <div class="vision-action-item" data-id="${escapeHtml(entry.milestoneId)}">
                    <div class="vision-action-head">
                        <strong>${escapeHtml(entry.title)}</strong>
                        <span>P${Math.round(entry.priority || 0)}</span>
                    </div>
                    ${badges.length ? `<div class="vision-action-badges">${badges.join('')}</div>` : ''}
                    <div class="vision-action-reason">${escapeHtml(entry.reason || '')}</div>
                    <div class="vision-action-controls">
                        <button type="button" data-action="queue-open" data-id="${escapeHtml(entry.milestoneId)}">Open</button>
                        <button type="button" data-action="queue-mark-done" data-id="${escapeHtml(entry.milestoneId)}" ${disabled ? 'disabled' : ''}>Done</button>
                        <button type="button" data-action="queue-snooze" data-id="${escapeHtml(entry.milestoneId)}" ${disabled ? 'disabled' : ''}>Snooze 7d</button>
                        <button type="button" data-action="queue-set-blocker" data-id="${escapeHtml(entry.milestoneId)}" ${disabled ? 'disabled' : ''}>Set Blocker</button>
                    </div>
                </div>
                `;
            }).join('');
        }

        function renderMilestones(state) {
            if (!mountedLayers.planning || !elements.milestoneList) return;

            const milestones = sortMilestones(Array.isArray(state.milestones) ? state.milestones : []);
            if (!milestones.length) {
                elements.milestoneList.innerHTML = '<div class="state-placeholder">Add your first milestone.</div>';
                return;
            }

            const commitmentSet = new Set(Array.isArray(state.weeklyCommitmentIds) ? state.weeklyCommitmentIds : []);
            const today = startOfTodayTs();

            elements.milestoneList.innerHTML = milestones.map((milestone) => {
                const dueTs = parseDateTs(milestone.date);
                const overdue = milestone.status !== 'done' && dueTs != null && dueTs < today;
                const committed = commitmentSet.has(milestone.id);
                const completion = Math.round(clamp(milestone.completionPct || 0, 0, 100));
                const phaseLabel = milestone.status === 'done' ? 'Done' : (completion > 0 ? 'Active' : 'Creation');
                const dueLabel = milestone.date
                    ? escapeHtml(new Date(milestone.date + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }))
                    : 'No date';

                const classes = [
                    'vision-milestone-item',
                    milestone.status === 'done' ? 'is-done' : '',
                    overdue ? 'is-overdue' : '',
                    committed ? 'is-committed' : ''
                ].filter(Boolean).join(' ');

                return `
                    <div class="${classes}" data-id="${milestone.id}" data-action="open-milestone-modal">
                        <div class="vision-milestone-header">
                            <strong class="vision-milestone-open-trigger" data-action="open-milestone-modal" data-id="${milestone.id}" role="button" tabindex="0">${escapeHtml(milestone.title)}</strong>
                            <span class="vision-milestone-open-hint">Open</span>
                        </div>
                        <div class="vision-milestone-meta">
                            <span>${escapeHtml(phaseLabel)}</span>
                            <span>${escapeHtml(milestone.visionType || 'Custom')}</span>
                            <span>${dueLabel}</span>
                        </div>
                        <div class="vision-milestone-summary-line"><span>Next action</span>${escapeHtml(milestone.nextAction || 'Define next action')}</div>
                        <div class="vision-milestone-progress-display"><span style="--milestone-progress:${completion}%;"></span></div>
                        <div class="vision-milestone-meta">
                            <span>Completion: ${completion}%</span>
                            ${milestone.blocker ? `<span>Blocker: ${escapeHtml(milestone.blocker)}</span>` : '<span>No blocker</span>'}
                            ${committed ? '<span>Weekly commitment</span>' : ''}
                        </div>
                    </div>
                `;
            }).join('');

            elements.milestoneList.querySelectorAll('.vision-milestone-open-trigger').forEach((node) => {
                node.addEventListener('keydown', (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    const id = node.dataset && node.dataset.id;
                    if (!id) return;
                    applyMilestoneAction('open-milestone-modal', id, 'milestones');
                });
            });
        }

        function renderDecisionLog() {
            if (!mountedLayers.history || !elements.decisionLog) return;
            const decisions = VisionStorage.getDecisionLog().slice().reverse();

            if (!decisions.length) {
                elements.decisionLog.innerHTML = '<div class="state-placeholder">No decisions logged yet.</div>';
                return;
            }

            elements.decisionLog.innerHTML = decisions.map((entry) => `
                <div class="vision-log-entry">
                    <div><strong>${escapeHtml(String(entry.decision || '').toUpperCase())}</strong> · ${formatTimestamp(entry.createdAt)}</div>
                    <div>${escapeHtml(entry.contextMode || 'vision')} · Alignment ${Math.round(entry.alignmentAtDecision || 0)} · Drift ${Math.round(entry.driftAtDecision || 0)}</div>
                    ${entry.note ? `<div>${escapeHtml(entry.note)}</div>` : ''}
                </div>
            `).join('');
        }

        function renderDriftHistory() {
            if (!mountedLayers.history || !elements.driftHistory) return;
            const snapshots = VisionStorage.getSnapshots().slice(-12).reverse();

            if (!snapshots.length) {
                elements.driftHistory.innerHTML = '<div class="state-placeholder">Compute history appears here.</div>';
                return;
            }

            elements.driftHistory.innerHTML = snapshots.map((snapshot) => `
                <div class="vision-log-entry">
                    <div>${formatTimestamp(snapshot.computedAt)}</div>
                    <div>Alignment ${Math.round(snapshot.alignment && snapshot.alignment.overall || 0)} · Drift ${Math.round(snapshot.drift && snapshot.drift.overall || 0)}</div>
                    <div>${snapshot.actionQueue && snapshot.actionQueue[0] ? escapeHtml(snapshot.actionQueue[0].title) : 'No urgent action'}</div>
                </div>
            `).join('');
        }

        function renderAlignmentRadar(snapshot) {
            if (!elements.alignmentRadar) return;
            const alignment = snapshot && snapshot.alignment ? snapshot.alignment : {};
            const explainability = snapshot && snapshot.explainability && snapshot.explainability.dimensions
                ? snapshot.explainability.dimensions
                : {};

            const rows = Object.keys(DIMENSION_LABELS).map((key) => {
                const value = Math.round(alignment[key] || 0);
                const details = Array.isArray(explainability[key]) ? explainability[key] : [];
                const detailsText = details.length ? details.join(' ') : '';
                return `
                    <div class="vision-alignment-row" title="${escapeHtml(detailsText)}">
                        <span class="vision-alignment-label">${DIMENSION_LABELS[key]}</span>
                        <span class="vision-alignment-value">${value}</span>
                        <div class="vision-alignment-bar" style="--alignment-value:${value}%;"></div>
                    </div>
                `;
            });

            elements.alignmentRadar.innerHTML = rows.join('');
        }

        function renderTensionList(snapshot) {
            if (!elements.tensionList) return;
            const flags = snapshot && Array.isArray(snapshot.tensionFlags) ? snapshot.tensionFlags : [];

            if (!flags.length) {
                elements.tensionList.innerHTML = '<div class="state-placeholder">Risk signals appear after compute.</div>';
                return;
            }

            elements.tensionList.innerHTML = flags.map((flag) => `
                <div class="vision-tension-item severity-${escapeHtml(flag.severity || 'low')}">
                    <div><strong>${escapeHtml(flag.label)}</strong> (${escapeHtml(flag.severity || 'low')})</div>
                    <div>${escapeHtml(flag.detail || '')}</div>
                </div>
            `).join('');
        }

        function renderBreakdownList(target, values) {
            if (!target) return;
            if (!values || !values.length) {
                target.innerHTML = '<li class="state-placeholder">Awaiting compute.</li>';
                return;
            }
            target.innerHTML = values.map((value) => `<li>${escapeHtml(value)}</li>`).join('');
        }

        function renderExplainability(snapshot) {
            if (!elements.explainabilityOverall) return;
            const list = snapshot && snapshot.explainability && Array.isArray(snapshot.explainability.overall)
                ? snapshot.explainability.overall
                : [];

            if (!list.length) {
                elements.explainabilityOverall.innerHTML = '<li class="state-placeholder">Explanation appears after compute.</li>';
                return;
            }

            elements.explainabilityOverall.innerHTML = list.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
        }

        function renderDriftSummary(snapshot) {
            if (!elements.driftSummary) return;
            const drift = snapshot && snapshot.drift ? snapshot.drift : {};

            const sorted = Object.keys(drift)
                .filter((key) => key !== 'overall')
                .sort((a, b) => Math.abs(drift[b]) - Math.abs(drift[a]))
                .slice(0, 2);

            const top = sorted[0] ? `${DIMENSION_LABELS[sorted[0]]}: ${formatSigned(drift[sorted[0]])}` : 'No drift';
            const second = sorted[1] ? `${DIMENSION_LABELS[sorted[1]]}: ${formatSigned(drift[sorted[1]])}` : '';

            elements.driftSummary.textContent = `Overall drift ${formatSigned(drift.overall)} · ${top}${second ? ' · ' + second : ''}`;
        }

        function renderWeeklyInsights() {
            if (!mountedLayers.history || !elements.weeklyAlignment || !elements.weeklyDecisions || !elements.weeklyMilestones) return;
            const insights = VisionEngine.getWeeklyInsights(
                VisionStorage.getDecisionLog(),
                VisionStorage.getSnapshots(),
                VisionStorage.getMilestones()
            );

            elements.weeklyAlignment.textContent = `This week: Alignment ${formatSigned(insights.alignmentDelta)} · Drift ${formatSigned(insights.driftDelta)}`;
            elements.weeklyDecisions.textContent = `Decisions: ${insights.decisionCount} · Aligned: ${insights.alignedCount}`;
            elements.weeklyMilestones.textContent = `Milestones moved: ${insights.milestonesMoved} · Completed: ${insights.milestonesCompleted}`;
        }

        function renderSignals(snapshot) {
            if (!mountedLayers.signals) return;

            if (!snapshot) {
                if (elements.overallAlignment) elements.overallAlignment.textContent = '0';
                if (elements.momentumStrip) {
                    elements.momentumStrip.style.setProperty('--vision-momentum', '0%');
                }
                renderAlignmentRadar(null);
                renderTensionList(null);
                renderExplainability(null);
                renderBreakdownList(elements.pillarsList, []);
                renderBreakdownList(elements.risksList, []);
                renderBreakdownList(elements.commitmentsList, []);
                renderDriftSummary({});
                return;
            }

            if (elements.overallAlignment) {
                elements.overallAlignment.textContent = `${Math.round(snapshot.alignment && snapshot.alignment.overall || 0)}`;
            }
            if (elements.momentumStrip) {
                elements.momentumStrip.style.setProperty('--vision-momentum', `${snapshot.momentum && snapshot.momentum.overall || 0}%`);
            }

            renderAlignmentRadar(snapshot);
            renderTensionList(snapshot);
            renderExplainability(snapshot);
            renderBreakdownList(elements.pillarsList, snapshot.suggestedPillars || []);
            renderBreakdownList(elements.risksList, snapshot.suggestedRisks || []);
            renderBreakdownList(elements.commitmentsList, snapshot.suggestedCommitments || []);
            renderDriftSummary(snapshot);
        }

        function renderComputed(snapshot, sourceState) {
            const state = sourceState || VisionStorage.getState();
            lastSnapshot = snapshot || null;

            renderPulse(state, snapshot);

            if (mountedLayers.planning) {
                renderActionQueue(snapshot, state);
            }
            renderSignals(snapshot);
            if (mountedLayers.history) {
                renderWeeklyInsights();
            }
        }

        function handleComputeStart() {
            showCalculating(true);
            setStatus('computing', 'Computing signals...');
        }

        function handleComputeComplete(snapshot) {
            showCalculating(false);
            const state = VisionStorage.getState();
            renderComputed(snapshot, state);
            if (mountedLayers.history) {
                renderDriftHistory();
            }
            if (window.UIManager && typeof window.UIManager.recalculate === 'function') {
                window.UIManager.recalculate();
            }
            updateLastCompute(snapshot && snapshot.computedAt);
            showSnapshotMarker('Snapshot saved');
            setStatus('completed', 'Signals updated');
        }

        function init() {
            if (initialized) return;

            collectElements();
            if (!elements.pulseLayer) return;

            VisionStorage.migrateLegacyVisionDataIfNeeded();

            VisionComputeScheduler.init({
                delay: 850,
                onComputeStart: handleComputeStart,
                onComputeComplete: handleComputeComplete,
                onStatusChange: function () { }
            });

            attachEventListeners();
            initializeLayers();

            const state = VisionStorage.getState();
            lastSnapshot = state.lastCompute || null;
            renderPulse(state, state.lastCompute);
            updateLastCompute(state.lastCompute && state.lastCompute.computedAt);
            updateSaveStatus('Loaded');
            setStatus('idle', 'Ready');

            VisionComputeScheduler.scheduleCompute(['init']);
            initialized = true;
        }

        function render() {
            const state = VisionStorage.getState();
            showLayer(LAYERS.pulse);
            renderPulse(state, state.lastCompute);
            if (mountedLayers.planning) {
                renderDirection(state);
                renderThemes(state.themes || []);
                renderWeeklyCommitments(state);
                renderMilestones(state);
                renderActionQueue(state.lastCompute, state);
            }
            renderSignals(state.lastCompute);
            if (mountedLayers.history) {
                renderDecisionLog();
                renderDriftHistory();
                renderWeeklyInsights();
            }
            updateLastCompute(state.lastCompute && state.lastCompute.computedAt);
        }

        return {
            init,
            render
        };
    })();

    global.VisionStorage = VisionStorage;
    global.VisionComputeScheduler = VisionComputeScheduler;
    global.VisionUI = VisionUI;
})(window);
