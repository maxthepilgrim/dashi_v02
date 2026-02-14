(function (global) {
    'use strict';

    var DENSITY_LEVELS = ['minimal', 'adaptive', 'full'];
    var MODES = ['personal', 'business', 'vision', 'ritual', 'feed', 'library'];
    var CATEGORIES = ['stability', 'direction', 'execution', 'reflection', 'risk'];
    var TIME_BUCKETS = ['morning', 'work', 'evening', 'night', 'deepNight', 'any'];

    var MODE_PRIORITIES = {
        personal: ['stability', 'direction', 'reflection'],
        business: ['execution', 'stability', 'risk'],
        vision: ['execution', 'risk', 'direction', 'stability', 'reflection'],
        ritual: ['reflection', 'direction'],
        feed: ['reflection', 'direction', 'stability'],
        library: ['reflection', 'direction', 'stability']
    };

    var SURFACE_SELECTORS = {
        dashboard: '#dashboard',
        vision: '#dashboard-vision',
        ritual: '#dashboard-ritual',
        feed: '#dashboard-feed',
        library: '#dashboard-library'
    };

    var SHARED_MODE_DEFAULTS = {
        topbar: 'personal',
        'creative-pulse': 'personal',
        'north-star': 'vision',
        'system-health-widget': 'personal',
        'active-worlds': 'vision',
        'quick-capture-widget': 'business',
        'year-compass-widget': 'vision',
        'calendar-widget': 'personal'
    };

    function alwaysFalse() { return false; }

    function criticalFinance(context) {
        return toNumber(context && context.financialRiskLevel, 0) >= 0.65;
    }

    function criticalAlignment(context) {
        return toNumber(context && context.alignmentScore, 1) <= 0.45;
    }

    function criticalVisionUrgency(context) {
        return toNumber(context && context.visionUrgency, 0) >= 0.55;
    }

    function criticalVisionSignals(context) {
        return criticalAlignment(context) || criticalVisionUrgency(context);
    }

    function criticalWalk(context) {
        return toNumber(context && context.daysSinceLastWalk, 0) >= 2;
    }

    function criticalOpenLoops(context) {
        return toNumber(context && context.openLoopsCount, 0) >= 5;
    }

    var WIDGET_METADATA_DEFAULTS = {
        'journal-widget': { category: 'reflection', energyDemand: 2, timeRelevance: ['any'] },
        'sport-widget': { category: 'stability', energyDemand: 3, timeRelevance: ['morning', 'work', 'evening'] },
        'people-widget': { category: 'reflection', energyDemand: 2, timeRelevance: ['evening', 'night', 'any'] },
        'finance-overview': { category: 'risk', energyDemand: 3, timeRelevance: ['morning', 'work', 'evening'], criticalCheck: criticalFinance },
        'biz-finance-widget': { category: 'risk', energyDemand: 3, timeRelevance: ['work'], criticalCheck: criticalFinance },
        'revenue-engine': { category: 'execution', energyDemand: 4, timeRelevance: ['work'] },
        'biz-content-widget': { category: 'execution', energyDemand: 3, timeRelevance: ['work', 'evening'] },
        topbar: { category: 'direction', energyDemand: 1, timeRelevance: ['any'] },
        'creative-pulse': { category: 'execution', energyDemand: 4, timeRelevance: ['morning', 'work', 'evening'] },
        'north-star': { category: 'direction', energyDemand: 2, timeRelevance: ['morning', 'work'], criticalCheck: criticalAlignment },
        'system-health-widget': { category: 'stability', energyDemand: 2, timeRelevance: ['any'] },
        'daily-state': { category: 'stability', energyDemand: 2, timeRelevance: ['morning', 'evening'] },
        'weekly-reflection': { category: 'reflection', energyDemand: 2, timeRelevance: ['evening', 'night'] },
        'goals-widget': { category: 'direction', energyDemand: 3, timeRelevance: ['morning', 'work'] },
        'biz-projects-widget': { category: 'execution', energyDemand: 4, timeRelevance: ['work'] },
        'active-worlds': { category: 'direction', energyDemand: 3, timeRelevance: ['work', 'evening'] },
        'quick-capture-widget': { category: 'execution', energyDemand: 2, timeRelevance: ['any'], criticalCheck: criticalOpenLoops },
        'vices-widget': { category: 'risk', energyDemand: 1, timeRelevance: ['evening', 'night'] },
        'year-compass-widget': { category: 'direction', energyDemand: 2, timeRelevance: ['any'] },
        'daily-rhythm-widget': { category: 'stability', energyDemand: 2, timeRelevance: ['morning', 'evening', 'night'] },
        'calendar-widget': { category: 'stability', energyDemand: 2, timeRelevance: ['any'] },
        'vision-direction-widget': { category: 'direction', energyDemand: 3, timeRelevance: ['any'] },
        'vision-week-widget': { category: 'direction', energyDemand: 2, timeRelevance: ['any'] },
        'vision-actions-widget': { category: 'execution', energyDemand: 2, timeRelevance: ['any'], criticalCheck: criticalVisionUrgency },
        'vision-signals-panel': { category: 'risk', energyDemand: 3, timeRelevance: ['any'], criticalCheck: criticalVisionSignals },
        'vision-history-panel': { category: 'reflection', energyDemand: 2, timeRelevance: ['any'] },
        'ritual-vinyl': { category: 'reflection', energyDemand: 2, timeRelevance: ['evening', 'night'] },
        'ritual-journal': { category: 'reflection', energyDemand: 2, timeRelevance: ['evening', 'night'] },
        'ritual-gratitude': { category: 'reflection', energyDemand: 1, timeRelevance: ['evening', 'night'] },
        'ritual-walk': { category: 'stability', energyDemand: 3, timeRelevance: ['morning', 'evening'], criticalCheck: criticalWalk },
        'ritual-slow-days': { category: 'reflection', energyDemand: 1, timeRelevance: ['evening', 'night'] },
        'ritual-gatherings': { category: 'reflection', energyDemand: 2, timeRelevance: ['evening', 'night'] },
        'feed-shell-widget': { category: 'reflection', energyDemand: 2, timeRelevance: ['any'] },
        'library-shell-widget': { category: 'reflection', energyDemand: 2, timeRelevance: ['any'] }
    };

    var UIState = {
        density: 'full'
    };

    var registry = new Map();
    var lastContext = null;
    var lastScores = [];
    var recalcQueued = false;
    var intervalHandle = null;
    var storeUnsubscribe = null;
    var lastContextSignature = '';
    var idCollisions = Object.create(null);

    function toNumber(value, fallback) {
        var num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, toNumber(value, min)));
    }

    function normalizeDensity(value) {
        var next = String(value || '').toLowerCase();
        return DENSITY_LEVELS.indexOf(next) >= 0 ? next : 'full';
    }

    function normalizeMode(value) {
        var next = String(value || '').toLowerCase();
        return MODES.indexOf(next) >= 0 ? next : 'personal';
    }

    function normalizeCategory(value) {
        var next = String(value || '').toLowerCase();
        return CATEGORIES.indexOf(next) >= 0 ? next : 'stability';
    }

    function normalizeTimeRelevance(value) {
        var list = Array.isArray(value) ? value : ['any'];
        var mapped = list
            .map(function (entry) { return String(entry || '').trim(); })
            .filter(function (entry) { return TIME_BUCKETS.indexOf(entry) >= 0; });
        return mapped.length ? mapped : ['any'];
    }

    function escapeSelectorValue(value) {
        var raw = String(value == null ? '' : value);
        if (global.CSS && typeof global.CSS.escape === 'function') {
            return global.CSS.escape(raw);
        }
        return raw.replace(/"/g, '\\"');
    }

    function getMode() {
        try {
            if (global.ModeManager && typeof global.ModeManager.getMode === 'function') {
                return normalizeMode(global.ModeManager.getMode());
            }
        } catch (error) {
            console.warn('[UI Density] Mode read failed:', error);
        }

        var body = document.body;
        if (!body) return 'personal';
        if (body.classList.contains('mode-business')) return 'business';
        if (body.classList.contains('mode-vision')) return 'vision';
        if (body.classList.contains('mode-ritual')) return 'ritual';
        if (body.classList.contains('mode-feed')) return 'feed';
        if (body.classList.contains('mode-library')) return 'library';
        return 'personal';
    }

    function getTimeBucket(date) {
        var d = date instanceof Date ? date : new Date();
        var hour = d.getHours();
        if (hour >= 6 && hour < 11) return 'morning';
        if (hour >= 11 && hour < 17) return 'work';
        if (hour >= 17 && hour < 22) return 'evening';
        if (hour >= 22 || hour < 2) return 'night';
        return 'deepNight';
    }

    function inferEnergyByTimeBucket(timeBucket) {
        if (timeBucket === 'morning') return 4;
        if (timeBucket === 'work') return 4;
        if (timeBucket === 'evening') return 3;
        if (timeBucket === 'night') return 2;
        return 1;
    }

    function readStore(methodName, fallback) {
        var args = Array.prototype.slice.call(arguments, 2);
        try {
            if (global.Store && typeof global.Store[methodName] === 'function') {
                return global.Store[methodName].apply(global.Store, args);
            }
        } catch (error) {
            console.warn('[UI Density] Store read failed for', methodName, error);
        }
        return fallback;
    }

    function getDensityForMode(mode) {
        var normalizedMode = normalizeMode(mode);
        var fromSettings = readStore('getSetting', null, 'density.' + normalizedMode, null);
        return normalizeDensity(fromSettings);
    }

    function persistDensityForMode(mode, density, options) {
        var opts = options || {};
        if (opts.persist === false) return;
        if (!global.Store || typeof global.Store.setSetting !== 'function') return;
        try {
            global.Store.setSetting('density.' + normalizeMode(mode), normalizeDensity(density), {
                persist: opts.persist !== false
            });
        } catch (error) {
            console.warn('[UI Density] Failed to persist density', error);
        }
    }

    function safeParseJson(text, fallback) {
        if (!text) return fallback;
        try {
            var parsed = JSON.parse(text);
            return parsed == null ? fallback : parsed;
        } catch (error) {
            return fallback;
        }
    }

    function computeEnergyEstimate(timeOfDay) {
        var todayState = readStore('getTodayState', null);
        var rawEnergy = toNumber(todayState && todayState.energy, NaN);
        if (Number.isFinite(rawEnergy)) {
            var normalized = clamp(Math.round(rawEnergy / 2), 1, 5);
            return normalized;
        }
        return inferEnergyByTimeBucket(timeOfDay);
    }

    function computeFinancialRiskLevel() {
        var derived = readStore('getDerivedState', null) || {};
        var metrics = derived.metrics || {};
        var financeScore = toNumber(metrics.financeScore, NaN);
        if (Number.isFinite(financeScore)) {
            return clamp(1 - financeScore, 0, 1);
        }

        var v2 = readStore('getV2Data', {}) || {};
        var finance = readStore('getFinance', {}) || {};
        var fr = v2.financialReality || {};
        var runway = toNumber(fr.runwayMonths, NaN);
        if (!Number.isFinite(runway)) runway = toNumber(finance.runwayMonths, NaN);
        if (!Number.isFinite(runway)) runway = toNumber(finance.runway, NaN);
        if (Number.isFinite(runway) && runway > 0) {
            return clamp(1 - (runway / 6), 0, 1);
        }

        return 0.5;
    }

    function computeAlignmentScore() {
        var alignment = readStore('getAlignmentState', null) || {};
        var score = toNumber(alignment.score, NaN);
        return Number.isFinite(score) ? clamp(score, 0, 1) : 0.5;
    }

    function computeMomentumScore() {
        var derived = readStore('getDerivedState', null) || {};
        var momentum = derived.momentum || {};
        var contextAware = clamp(momentum.contextAware, 0, 1);
        var creative = clamp(momentum.creative, 0, 1);
        var revenue = clamp(momentum.revenue, 0, 1);
        return clamp((contextAware * 0.45) + (creative * 0.35) + (revenue * 0.2), 0, 1);
    }

    function computeVisionUrgency() {
        var rawState = null;
        try {
            rawState = global.localStorage ? global.localStorage.getItem('visionModeState') : null;
        } catch (error) {
            rawState = null;
        }
        var state = safeParseJson(rawState, null) || {};
        var snapshot = state && state.lastCompute ? state.lastCompute : null;
        if (!snapshot) return 0;

        var queue = Array.isArray(snapshot.actionQueue) ? snapshot.actionQueue : [];
        var tensionFlags = Array.isArray(snapshot.tensionFlags) ? snapshot.tensionFlags : [];
        var topPriority = toNumber(queue[0] && queue[0].priority, 0);
        var queueIntensity = queue.length
            ? (queue.filter(function (item) { return toNumber(item && item.priority, 0) >= 70; }).length / Math.min(queue.length, 5))
            : 0;
        var hasBlocked = tensionFlags.some(function (flag) { return flag && flag.id === 'tension-blocked-milestones'; });
        var hasOverdue = tensionFlags.some(function (flag) { return flag && flag.id === 'tension-overdue-milestones'; });
        var drift = Math.abs(toNumber(snapshot.drift && snapshot.drift.overall, 0));
        var driftPressure = clamp(drift / 20, 0, 1);

        return clamp(
            (clamp(topPriority / 100, 0, 1) * 0.45) +
            (queueIntensity * 0.25) +
            ((hasBlocked ? 1 : 0) * 0.15) +
            ((hasOverdue ? 1 : 0) * 0.1) +
            (driftPressure * 0.05),
            0,
            1
        );
    }

    function computeOpenLoopsCount() {
        var v2 = readStore('getV2Data', {}) || {};
        var strikeTeam = Array.isArray(v2.strikeTeam) ? v2.strikeTeam : [];
        return strikeTeam.reduce(function (sum, task) {
            var text = String(task && task.text || '').trim();
            var done = !!(task && task.done);
            return text && !done ? sum + 1 : sum;
        }, 0);
    }

    function computeDaysSinceLastWalk() {
        var latestDateIso = null;

        var entries = readStore('getWalkLogEntries', null);
        if (Array.isArray(entries) && entries.length) {
            latestDateIso = entries[0].endTime || entries[0].createdAt || entries[0].startTime || null;
        }

        if (!latestDateIso) {
            var summary = readStore('getRitualWalkLog', null);
            latestDateIso = summary && summary.lastDate ? summary.lastDate : null;
        }

        if (!latestDateIso) return 999;
        var ts = new Date(latestDateIso).getTime();
        if (!Number.isFinite(ts)) return 999;
        var deltaMs = Date.now() - ts;
        return Math.max(0, Math.floor(deltaMs / (24 * 60 * 60 * 1000)));
    }

    function createContext() {
        var mode = getMode();
        var timeOfDay = getTimeBucket(new Date());
        return {
            timeOfDay: timeOfDay,
            mode: mode,
            energyEstimate: computeEnergyEstimate(timeOfDay),
            financialRiskLevel: computeFinancialRiskLevel(),
            alignmentScore: computeAlignmentScore(),
            openLoopsCount: computeOpenLoopsCount(),
            momentumScore: computeMomentumScore(),
            daysSinceLastWalk: computeDaysSinceLastWalk(),
            visionUrgency: computeVisionUrgency()
        };
    }

    function getAdaptiveVisibleCount() {
        var viewport = Math.max(0, window.innerHeight || 0);
        if (viewport < 760) return 6;
        if (viewport < 980) return 7;
        return 8;
    }

    function getModePriority(mode) {
        return MODE_PRIORITIES[mode] || MODE_PRIORITIES.personal;
    }

    function scoreWidget(meta, context) {
        var score = 0;
        var modePriority = getModePriority(context.mode);
        var timeMatches = meta.timeRelevance.indexOf(context.timeOfDay) >= 0 || meta.timeRelevance.indexOf('any') >= 0;
        var categoryMatches = modePriority.indexOf(meta.category) >= 0;
        var critical = false;

        try {
            critical = !!meta.criticalCheck(context);
        } catch (error) {
            critical = false;
            console.warn('[UI Density] criticalCheck failed for', meta.id, error);
        }

        if (meta.mode === context.mode) score += 2;
        if (timeMatches) score += 2;
        if (categoryMatches) score += 2;
        if (critical) score += 5;
        if (meta.energyDemand > context.energyEstimate) score -= 2;

        return {
            id: meta.id,
            score: score,
            critical: critical,
            modeMatch: meta.mode === context.mode,
            timeMatch: timeMatches,
            categoryMatch: categoryMatches,
            energyPenalty: meta.energyDemand > context.energyEstimate,
            meta: meta
        };
    }

    function getSurfaceForElement(element) {
        if (!element || !(element instanceof HTMLElement)) return 'dashboard';
        if (element.closest(SURFACE_SELECTORS.vision)) return 'vision';
        if (element.closest(SURFACE_SELECTORS.ritual)) return 'ritual';
        if (element.closest(SURFACE_SELECTORS.feed)) return 'feed';
        if (element.closest(SURFACE_SELECTORS.library)) return 'library';
        return 'dashboard';
    }

    function getSurfaceForMode(mode) {
        if (mode === 'vision') return 'vision';
        if (mode === 'ritual') return 'ritual';
        if (mode === 'feed') return 'feed';
        if (mode === 'library') return 'library';
        return 'dashboard';
    }

    function deriveIdFromElement(element) {
        if (element.id) return element.id;

        var dataWidget = String(element.getAttribute('data-widget') || '').trim();
        if (dataWidget) return dataWidget + '-widget';

        var className = '';
        if (element.classList && element.classList.length) {
            className = Array.from(element.classList).find(function (name) {
                return /-widget$/.test(name) &&
                    name !== 'widget' &&
                    name !== 'vision-widget' &&
                    name !== 'ritual-widget' &&
                    name !== 'walk-widget';
            }) || '';
        }
        if (!className) className = element.className ? String(element.className).split(/\s+/)[0] : 'widget';

        var base = className || 'widget';
        if (!idCollisions[base]) {
            idCollisions[base] = 1;
            return base;
        }
        idCollisions[base] += 1;
        return base + '-' + idCollisions[base];
    }

    function inferWidgetMode(element, id) {
        var surface = getSurfaceForElement(element);
        if (surface === 'vision') return 'vision';
        if (surface === 'ritual') return 'ritual';
        if (surface === 'feed') return 'feed';
        if (surface === 'library') return 'library';

        var rawMode = String(element.getAttribute('data-mode') || '').toLowerCase().trim();
        if (MODES.indexOf(rawMode) >= 0) return rawMode;
        if (rawMode === 'shared' || rawMode === 'both' || !rawMode) {
            return SHARED_MODE_DEFAULTS[id] || 'personal';
        }
        return 'personal';
    }

    function getDefaultMetadata(id, mode) {
        var preset = WIDGET_METADATA_DEFAULTS[id] || {};
        return {
            id: id,
            mode: normalizeMode(mode),
            category: normalizeCategory(preset.category || 'stability'),
            energyDemand: clamp(preset.energyDemand, 1, 5),
            timeRelevance: normalizeTimeRelevance(preset.timeRelevance || ['any']),
            criticalCheck: typeof preset.criticalCheck === 'function' ? preset.criticalCheck : alwaysFalse
        };
    }

    function registerElement(element) {
        if (!(element instanceof HTMLElement)) return null;
        var id = deriveIdFromElement(element);
        var mode = inferWidgetMode(element, id);
        var defaults = getDefaultMetadata(id, mode);
        var merged = Object.assign({}, defaults, {
            id: id,
            element: element
        });
        WidgetRegistry.register(merged);
        element.dataset.uiWidgetId = id;
        return id;
    }

    function autoRegisterWidgets() {
        idCollisions = Object.create(null);

        document.querySelectorAll('#dashboard .widget').forEach(registerElement);
        document.querySelectorAll('#dashboard-vision .vision-widget').forEach(registerElement);

        var vinyl = document.getElementById('ritual-vinyl');
        if (vinyl) registerElement(vinyl);

        document.querySelectorAll('#dashboard-ritual .ritual-widget').forEach(registerElement);

        var feedShell = document.getElementById('feed-shell');
        if (feedShell) {
            registerElement(feedShell);
            var feedRecord = registry.get(feedShell.dataset.uiWidgetId);
            if (feedRecord) {
                var previousFeedId = feedRecord.id;
                feedRecord.meta.id = 'feed-shell-widget';
                feedRecord.meta.mode = 'feed';
                feedRecord.id = 'feed-shell-widget';
                feedShell.dataset.uiWidgetId = 'feed-shell-widget';
                registry.delete(previousFeedId);
                registry.set('feed-shell-widget', feedRecord);
            }
        }

        var libraryShell = document.getElementById('library-shell');
        if (libraryShell) {
            registerElement(libraryShell);
            var record = registry.get(libraryShell.dataset.uiWidgetId);
            if (record) {
                var previousId = record.id;
                record.meta.id = 'library-shell-widget';
                record.meta.mode = 'library';
                record.id = 'library-shell-widget';
                libraryShell.dataset.uiWidgetId = 'library-shell-widget';
                registry.delete(previousId);
                registry.set('library-shell-widget', record);
            }
        }

        registry.forEach(function (record, id) {
            if (!record.element || !record.element.isConnected) {
                registry.delete(id);
            } else {
                record.element.classList.add('ui-density-managed');
            }
        });
    }

    function getDashboardAssignmentVisibility(widgetId, mode) {
        var vis = readStore('getWidgetVisibility', {}) || {};
        var assignment = String(vis[widgetId] || 'both');
        if (assignment === 'hidden') return false;
        if (assignment === 'personal' && mode !== 'personal') return false;
        if (assignment === 'business' && mode !== 'business') return false;
        return true;
    }

    function isBaseVisible(record, mode) {
        var surface = getSurfaceForElement(record.element);
        if (surface === 'dashboard') {
            return getDashboardAssignmentVisibility(record.meta.id, mode);
        }
        if (surface === 'vision') return mode === 'vision';
        if (surface === 'ritual') return mode === 'ritual';
        if (surface === 'feed') return mode === 'feed';
        if (surface === 'library') return mode === 'library';
        return true;
    }

    function getModeCandidates(mode) {
        var activeSurface = getSurfaceForMode(mode);
        var out = [];
        registry.forEach(function (record) {
            var surface = getSurfaceForElement(record.element);
            if (surface !== activeSurface) return;
            out.push(record);
        });
        return out;
    }

    function applyBodyDensityClass() {
        var body = document.body;
        if (!body) return;
        body.classList.remove('ui-density-minimal', 'ui-density-adaptive', 'ui-density-full');
        body.classList.add('ui-density-' + UIState.density);
        body.setAttribute('data-ui-density', UIState.density);
    }

    function applyClasses(records, mode, selectedSet, criticalSet) {
        var density = UIState.density;

        records.forEach(function (record) {
            var element = record.element;
            var id = record.meta.id;
            var baseVisible = isBaseVisible(record, mode);

            var shouldShow = baseVisible;
            var shouldCollapse = false;

            if (baseVisible && density === 'minimal') {
                shouldShow = selectedSet.has(id) || criticalSet.has(id);
                shouldCollapse = false;
            } else if (baseVisible && density === 'adaptive') {
                shouldShow = true;
                shouldCollapse = !(selectedSet.has(id) || criticalSet.has(id));
            } else if (baseVisible && density === 'full') {
                shouldShow = true;
                shouldCollapse = false;
            }

            element.classList.toggle('hidden', !shouldShow);
            element.classList.toggle('collapsed', shouldShow && shouldCollapse);
            element.classList.toggle('visible-priority', shouldShow && (selectedSet.has(id) || criticalSet.has(id)));
        });
    }

    function applyStackOrder(scoredRows, mode) {
        var body = document.body;
        if (!body) return;

        var isMinimal = UIState.density === 'minimal';
        if (!isMinimal) {
            registry.forEach(function (record) {
                if (record.element && record.element.style) {
                    record.element.style.removeProperty('--ui-order');
                }
            });
            return;
        }

        scoredRows.forEach(function (row, index) {
            if (!row || !row.meta) return;
            var record = registry.get(row.meta.id);
            if (!record || !record.element || !record.element.style) return;
            record.element.style.setProperty('--ui-order', String(index + 1));
        });
    }

    function buildContextSignature(context) {
        return JSON.stringify({
            mode: context.mode,
            timeOfDay: context.timeOfDay,
            energyEstimate: context.energyEstimate,
            financialRiskLevel: Number(context.financialRiskLevel || 0).toFixed(3),
            alignmentScore: Number(context.alignmentScore || 0).toFixed(3),
            openLoopsCount: context.openLoopsCount,
            momentumScore: Number(context.momentumScore || 0).toFixed(3),
            daysSinceLastWalk: context.daysSinceLastWalk,
            visionUrgency: Number(context.visionUrgency || 0).toFixed(3)
        });
    }

    function recalculate() {
        var context = createContext();
        var mode = context.mode;
        var modeDensity = getDensityForMode(mode);
        if (UIState.density !== modeDensity) {
            UIState.density = modeDensity;
        }
        applyBodyDensityClass();
        var candidates = getModeCandidates(mode);

        var scored = candidates
            .filter(function (record) { return isBaseVisible(record, mode); })
            .map(function (record) { return scoreWidget(record.meta, context); });

        scored.sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            if (a.critical !== b.critical) return a.critical ? -1 : 1;
            return String(a.id).localeCompare(String(b.id));
        });

        var criticalSet = new Set(
            scored
                .filter(function (row) { return row.critical; })
                .map(function (row) { return row.id; })
        );

        var selectedSet = new Set();
        if (UIState.density === 'minimal') {
            scored.slice(0, 3).forEach(function (row) { selectedSet.add(row.id); });
        } else if (UIState.density === 'adaptive') {
            scored.slice(0, getAdaptiveVisibleCount()).forEach(function (row) { selectedSet.add(row.id); });
        } else {
            scored.forEach(function (row) { selectedSet.add(row.id); });
        }

        criticalSet.forEach(function (id) { selectedSet.add(id); });
        if (mode === 'vision') {
            selectedSet.add('vision-actions-widget');
        }

        applyClasses(candidates, mode, selectedSet, criticalSet);
        applyStackOrder(scored, mode);

        lastContext = context;
        lastScores = scored.map(function (row, index) {
            return {
                rank: index + 1,
                id: row.id,
                score: row.score,
                critical: row.critical,
                mode: row.meta.mode,
                category: row.meta.category,
                energyDemand: row.meta.energyDemand,
                timeRelevance: row.meta.timeRelevance.slice()
            };
        });
        lastContextSignature = buildContextSignature(context);
    }

    function queueRecalc() {
        if (recalcQueued) return;
        recalcQueued = true;
        requestAnimationFrame(function () {
            recalcQueued = false;
            recalculate();
        });
    }

    function initRecalcTriggers() {
        window.addEventListener('mode-changed', function (event) {
            var mode = normalizeMode(event && event.detail && event.detail.mode);
            UIState.density = getDensityForMode(mode);
            applyBodyDensityClass();
            setTimeout(queueRecalc, 0);
        });

        window.addEventListener('resize', queueRecalc);
        window.addEventListener('storage', queueRecalc);

        if (global.Store && typeof global.Store.subscribe === 'function') {
            storeUnsubscribe = global.Store.subscribe(function () {
                var context = createContext();
                var signature = buildContextSignature(context);
                if (signature !== lastContextSignature) {
                    queueRecalc();
                }
            });
        }

        if (intervalHandle) clearInterval(intervalHandle);
        intervalHandle = setInterval(queueRecalc, 15 * 60 * 1000);
    }

    var WidgetRegistry = {
        register: function (meta) {
            if (!meta || typeof meta !== 'object') return null;

            var id = String(meta.id || '').trim();
            if (!id) return null;

            var element = meta.element instanceof HTMLElement
                ? meta.element
                : document.getElementById(id) || document.querySelector('[data-ui-widget-id="' + escapeSelectorValue(id) + '"]');
            if (!(element instanceof HTMLElement)) return null;

            var defaults = getDefaultMetadata(id, inferWidgetMode(element, id));
            var normalized = {
                id: id,
                mode: normalizeMode(meta.mode || defaults.mode),
                category: normalizeCategory(meta.category || defaults.category),
                energyDemand: clamp(meta.energyDemand != null ? meta.energyDemand : defaults.energyDemand, 1, 5),
                timeRelevance: normalizeTimeRelevance(meta.timeRelevance || defaults.timeRelevance),
                criticalCheck: typeof meta.criticalCheck === 'function'
                    ? meta.criticalCheck
                    : (typeof defaults.criticalCheck === 'function' ? defaults.criticalCheck : alwaysFalse)
            };

            registry.set(id, {
                id: id,
                meta: normalized,
                element: element
            });
            element.dataset.uiWidgetId = id;
            element.classList.add('ui-density-managed');
            return normalized;
        },

        getAll: function () {
            return Array.from(registry.values()).map(function (record) {
                return Object.assign({}, record.meta);
            });
        },

        get: function (id) {
            var key = String(id || '').trim();
            var record = registry.get(key);
            return record ? Object.assign({}, record.meta) : null;
        }
    };

    var UIContextEngine = {
        getContext: function () {
            if (!lastContext) lastContext = createContext();
            return Object.assign({}, lastContext);
        },
        getWidgetScores: function () {
            return lastScores.map(function (row) { return Object.assign({}, row); });
        }
    };

    var UIManager = {
        setDensity: function (level, options) {
            var opts = options || {};
            var mode = getMode();
            var next = normalizeDensity(level);
            persistDensityForMode(mode, next, opts);
            if (UIState.density === next) return UIState.density;
            UIState.density = next;
            applyBodyDensityClass();
            if (!opts.silent) queueRecalc();
            return UIState.density;
        },

        getDensity: function () {
            return UIState.density;
        },

        recalculate: function () {
            queueRecalc();
        },

        init: function () {
            autoRegisterWidgets();
            UIState.density = getDensityForMode(getMode());
            initRecalcTriggers();
            applyBodyDensityClass();
            queueRecalc();
            setTimeout(queueRecalc, 140);
        },

        destroy: function () {
            if (intervalHandle) clearInterval(intervalHandle);
            intervalHandle = null;
            if (typeof storeUnsubscribe === 'function') {
                storeUnsubscribe();
                storeUnsubscribe = null;
            }
        }
    };

    global.UIState = UIState;
    global.WidgetRegistry = WidgetRegistry;
    global.UIContextEngine = UIContextEngine;
    global.UIManager = UIManager;

    document.addEventListener('DOMContentLoaded', function () {
        UIManager.init();
    });
})(window);
