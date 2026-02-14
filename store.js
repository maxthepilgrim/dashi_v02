/* ========================================
   Shared Data Store (localStorage)
   ======================================== */

const Store = {
    // Keys
    GOALS_KEY: 'lifeos-goals',
    HABITS_KEY: 'lifeos-habits-config',
    HABITS_STATUS_KEY: 'lifeos-habits',
    PROFILE_KEY: 'lifeos-profile',
    FINANCE_KEY: 'lifeos-finance',
    FITNESS_KEY: 'lifeos-fitness',
    EVENTS_KEY: 'lifeos-events',
    JOURNAL_KEY: 'lifeos-journal',
    MOOD_KEY: 'lifeos-mood',
    VISUAL_KEY: 'lifeos-visual-config',
    FOCUS_LOG_KEY: 'lifeos-focus-log',
    WIDGET_VIS_KEY: 'lifeos-widget-visibility',
    DAILY_STATE_KEY: 'lifeos-daily-state',
    SEASONS_KEY: 'lifeos-seasons',
    INPUT_LOG_KEY: 'lifeos-input-log',
    V2_KEY: 'lifeos-v2',
    PINNED_WIDGETS_KEY: 'lifeos-pinned-widgets',
    HABITS_HISTORY_KEY: 'lifeos-habits-history',
    LAYOUT_KEY: 'lifeos-layout',
    COG_MEMORY_KEY: 'lifeos-cog-memory',
    COG_FEEDBACK_KEY: 'lifeos-cog-feedback',
    COG_LAST_STATE_KEY: 'lifeos-cog-laststate',
    WALK_LOG_ENTRIES_KEY: 'walkLogEntries',
    VISUALIZER_MODE_KEY: 'lifeos-visualizer-mode',
    SETTINGS_KEY: 'lifeos-settings-v1',

    // Session cache for computed neural/derived state.
    _derivedStateCache: null,
    _derivedStateRevision: 0,
    _cognitiveStateCache: null,
    _cognitiveStateRevision: 0,
    _timeStateCache: null,
    _attentionStateCache: null,
    _alignmentStateCache: null,
    _relationshipStateCache: null,
    _creativePhaseStateCache: null,
    _narrativeStateCache: null,
    _systemStateCache: null,
    _systemHistoryCache: null,
    _settingsCache: null,
    _stateSubscribers: new Set(),
    _derivedMutationTrackingInstalled: false,



    // Defaults
    defaultGoals: [
        { id: 'g1', name: 'Save €10K', progress: 72, icon: '💰', category: 'finance', target: '€10,000' },
        { id: 'g2', name: 'Run a half marathon', progress: 45, icon: '🏃', category: 'fitness', target: '21 km' },
        { id: 'g3', name: 'Read 24 books', progress: 17, icon: '📚', category: 'growth', target: '24 books' },
        { id: 'g4', name: 'Learn German B2', progress: 60, icon: '🇩🇪', category: 'growth', target: 'B2 Exam' },
        { id: 'g5', name: 'Meditate 100 days', progress: 38, icon: '🧘', category: 'mindfulness', target: '100 days' },
    ],

    defaultHabits: [
        { id: 'h1', name: 'Deep Work Block', icon: '🧠', category: 'work' },
        { id: 'h2', name: 'Stop w/ Energy', icon: '🔋', category: 'work' },
        { id: 'h3', name: 'Light Meal < 14:00', icon: '🥗', category: 'health' },
        { id: 'h4', name: 'Admin Window', icon: '📥', category: 'work' },
        { id: 'h5', name: 'Daylight / Outside', icon: '☀️', category: 'health' },
        { id: 'h6', name: 'Movement / Gym', icon: '💪', category: 'fitness' },
    ],

    defaultProfile: {
        name: 'Guest User',
        avatar: 'G'
    },

    defaultFinance: {
        balance: 5000.00,
        monthlyIncome: 3000,
        monthlyExpenses: 2000,
        history: [
            { income: 3000, expense: 2100 },
            { income: 3100, expense: 2000 },
            { income: 2900, expense: 2200 }
        ],
        transactions: [
            { name: 'Sample Expense', icon: '🛒', amount: -50.00, date: 'Today' },
            { name: 'Sample Income', icon: '💰', amount: 3000, date: 'Feb 1' }
        ],
        invoices: [
            { id: 'inv1', client: 'Example Client', amount: 1000, status: 'Sent', expectedDate: '2026-02-25' }
        ]
    },

    defaultFitness: {
        activities: [
            { id: 'act-sample', type: 'Run', distance: '5km', duration: '30m', date: new Date().toISOString() }
        ],
        // Legacy stats kept for safe migration, but not used in new UI
        caloriesBurned: 0,
        steps: 0
    },

    defaultEvents: [
        { date: '2026-02-12', time: '10:00', name: 'Sample Event', type: 'work', description: 'This is a placeholder event' }
    ],

    // V2 Strategic & Reflective Data
    defaultV2: {
        northStar: {
            month: 'Current Month',
            focus: 'Strategic focus goes here',
            priorities: ['Priority One', 'Priority Two', 'Priority Three'],
            intention: 'Generic intention.'
        },
        creativeCompass: {
            projects: [
                { id: 'cp1', name: 'Sample Project 1', stage: 'GROWING', lastActivityDate: new Date().toISOString().split('T')[0], priorityWeight: 0, archived: false },
                { id: 'cp2', name: 'Sample Project 2', stage: 'SEED', lastActivityDate: new Date().toISOString().split('T')[0], priorityWeight: 0, archived: false }
            ],
            settings: {
                inactivityFactor: 2,
                stageWeights: { SEED: 10, GROWING: 20, FORMING: 35, RELEASING: 50, RESTING: 0 },
                showResting: true
            },
            dailyOverride: { date: null, projectId: null },
            dailyLog: []
        },
        financialReality: {
            debtLeft: 0,
            runwayMonths: 6.0,
            monthlyIncome: 3000,
            monthlyTarget: 3000
        },
        people: [
            { role: 'Connection', name: 'Sample Name', prompt: 'Sample prompt or subline' }
        ],
        reflection: {
            win: 'Completed the core financial migration logic.',
            lesson: 'Rest is not a reward, it is a requirement.',
            nextShift: 'Tighter focus on deep work blocks.'
        },
        activeWorlds: [
            { name: 'Active Project 1', state: 'Current state', nextAction: 'Next logical step' }
        ],
        // Legacy-only source for one-time migration into libraryMediaItems.
        inputLog: [],
        revenueEngine: {
            today: 0,
            pipeline: 0,
            invoices: 0,
            deals: 0
        },
        bizProjects: [
            { id: 'bp1', name: 'Product Launch', leverage: 8, status: 'Active' },
            { id: 'bp2', name: 'Marketing Automation', leverage: 6, status: 'Delayed' }
        ],
        bizContent: {
            minutesCreated: 0,
            piecesFinished: 0,
            audienceGrowth: 0,
            stage: 'Initial'
        },
        quickCapture: 'Finalize the roadmap implementation by EOD. \nLook into more aurora gradients.',
        dailyRhythm: [
            {
                id: 'p1',
                title: 'Morning',
                subtitle: 'Enter the Day',
                items: [
                    { id: 'm1', text: 'No phone (20m)', done: false },
                    { id: 'm2', text: 'Light + Water', done: false },
                    { id: 'm3', text: 'Gentle Movement', done: false },
                    { id: 'm4', text: 'Set Direction', done: false }
                ]
            },
            {
                id: 'p2',
                title: 'Creation',
                subtitle: 'Protect the Work',
                items: [
                    { id: 'c1', text: 'Deep Work Block', done: false },
                    { id: 'c2', text: 'Stop w/ Energy', done: false }
                ]
            },
            {
                id: 'p3',
                title: 'Stability',
                subtitle: 'Keep the System Calm',
                items: [
                    { id: 's1', text: 'Light Meal < 14:00', done: false },
                    { id: 's2', text: 'Admin Window', done: false },
                    { id: 's3', text: 'Daylight / Outside', done: false }
                ]
            },
            {
                id: 'p4',
                title: 'Body',
                subtitle: 'Maintain the Vessel',
                items: [
                    { id: 'b1', text: 'Movement (Gym/Walk)', done: false }
                ]
            },
            {
                id: 'p5',
                title: 'Evening',
                subtitle: 'Close the Day',
                items: [
                    { id: 'e1', text: 'Clear Shutdown', done: false },
                    { id: 'e2', text: 'Real Connection', done: false },
                    { id: 'e3', text: 'Low Stimulus', done: false }
                ]
            },
            {
                id: 'p6',
                title: 'Integration',
                subtitle: 'Keep Meaning Alive',
                items: [
                    { id: 'i1', text: '2-min Reflection', done: false },
                    { id: 'i2', text: 'Sleep Window', done: false }
                ]
            }
        ],
        visibility: {
            'topbar': 'both',
            'finance-overview': 'personal',
            'sport-widget': 'personal',
            'north-star': 'both',
            'journal-widget': 'personal',
            'creative-pulse': 'both',
            'calendar-widget': 'both',
            'active-worlds': 'both',
            'weekly-reflection': 'personal',
            'goals-widget': 'personal',
            'people-widget': 'personal',
            'daily-rhythm-widget': 'personal',
            'quick-capture-widget': 'both',
            'daily-state': 'personal',
            'revenue-engine': 'business',
            'biz-finance-widget': 'business',
            'biz-projects-widget': 'business',
            'biz-content-widget': 'business',
            'year-compass-widget': 'business',
            'system-health-widget': 'personal'
        }
    },

    VISUAL_KEY: 'lifeos.atmosphere',

    defaultVisual: {
        // Existing sliders
        hue: 0,
        brightness: 80,
        saturation: 100,
        grain: 0,
        speed: 25,

        // New UI controls
        temperature: 0,      // -100 to +100
        contrast: 40,        // 0 to 100
        calmness: 35,        // 0 to 100
        accentHue: 0,       // -180 to 180 (typography highlight)
        syncWithTimeOfDay: false,

        // Internal / Derived
        opacity: 0.9,
        grainSoftness: 0.5,
        turbulence: 0.15,
        vignette: 0.2,
        lightDirection: 0,
        motionPhase: Math.random(),
        reducedMotion: false,
        version: 1
    },

    defaultSeasons: [
        { id: 's1', name: 'Winter of Building', focus: 'Laying the foundation for the new year.', start: '2025-12-21', end: '2026-03-20', active: true }
    ],

    defaultDailyState: [], // Array of entries

    SETTINGS_MODES: ['personal', 'business', 'vision', 'ritual', 'feed', 'library'],
    SETTINGS_DENSITIES: ['minimal', 'adaptive', 'full'],
    SETTINGS_DATE_STYLES: ['system', 'iso', 'short', 'long'],
    SETTINGS_HOUR_CYCLES: ['system', 'h12', 'h24'],
    SETTINGS_WEEK_STARTS: ['monday', 'sunday'],
    SETTINGS_INTRO_ANIMATION: ['once-per-session', 'disabled'],
    SETTINGS_VISIBILITY_ASSIGNMENTS: ['both', 'personal', 'business', 'hidden'],

    _isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    },

    _deepClone(value) {
        if (value === undefined) return undefined;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (e) {
            return value;
        }
    },

    _deepMerge(base, patch) {
        const source = this._isPlainObject(base) ? base : {};
        const incoming = this._isPlainObject(patch) ? patch : {};
        const out = { ...source };
        Object.keys(incoming).forEach((key) => {
            const nextValue = incoming[key];
            const currentValue = out[key];
            if (this._isPlainObject(currentValue) && this._isPlainObject(nextValue)) {
                out[key] = this._deepMerge(currentValue, nextValue);
            } else {
                out[key] = this._deepClone(nextValue);
            }
        });
        return out;
    },

    _normalizeMode(value, fallback = 'personal') {
        const mode = String(value || '').trim().toLowerCase();
        if (this.SETTINGS_MODES.includes(mode)) return mode;
        return this.SETTINGS_MODES.includes(fallback) ? fallback : 'personal';
    },

    _normalizeDensity(value, fallback = 'full') {
        const density = String(value || '').trim().toLowerCase();
        if (this.SETTINGS_DENSITIES.includes(density)) return density;
        return this.SETTINGS_DENSITIES.includes(fallback) ? fallback : 'full';
    },

    _normalizeWeekStartsOn(value, fallback = 'monday') {
        const next = String(value || '').trim().toLowerCase();
        if (this.SETTINGS_WEEK_STARTS.includes(next)) return next;
        return this.SETTINGS_WEEK_STARTS.includes(fallback) ? fallback : 'monday';
    },

    _normalizeDateStyle(value, fallback = 'system') {
        const next = String(value || '').trim().toLowerCase();
        if (this.SETTINGS_DATE_STYLES.includes(next)) return next;
        return this.SETTINGS_DATE_STYLES.includes(fallback) ? fallback : 'system';
    },

    _normalizeHourCycle(value, fallback = 'system') {
        const next = String(value || '').trim().toLowerCase();
        if (this.SETTINGS_HOUR_CYCLES.includes(next)) return next;
        return this.SETTINGS_HOUR_CYCLES.includes(fallback) ? fallback : 'system';
    },

    _normalizeIntroAnimation(value, fallback = 'once-per-session') {
        const next = String(value || '').trim().toLowerCase();
        if (this.SETTINGS_INTRO_ANIMATION.includes(next)) return next;
        return this.SETTINGS_INTRO_ANIMATION.includes(fallback) ? fallback : 'once-per-session';
    },

    _normalizeVisibilityAssignment(value, fallback = 'both') {
        if (value === true) return 'both';
        if (value === false) return 'hidden';
        const next = String(value || '').trim().toLowerCase();
        if (this.SETTINGS_VISIBILITY_ASSIGNMENTS.includes(next)) return next;
        return this.SETTINGS_VISIBILITY_ASSIGNMENTS.includes(fallback) ? fallback : 'both';
    },

    _normalizeModeVisibilityValue(value, fallback = true) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
            const next = value.trim().toLowerCase();
            if (['true', '1', 'yes', 'on'].includes(next)) return true;
            if (['false', '0', 'no', 'off'].includes(next)) return false;
        }
        return fallback !== false;
    },

    _normalizeModeVisibilityMap(rawMap) {
        const source = this._isPlainObject(rawMap) ? rawMap : {};
        const out = {};
        this.SETTINGS_MODES.forEach((mode) => {
            out[mode] = this._normalizeModeVisibilityValue(source[mode], true);
        });

        // Ensure at least one mode is visible so the app always has a valid surface.
        if (!Object.values(out).some(Boolean)) {
            out.personal = true;
        }
        return out;
    },

    _getVisibleModesFromMap(modeVisibilityMap) {
        const normalizedMap = this._normalizeModeVisibilityMap(modeVisibilityMap);
        return this.SETTINGS_MODES.filter((mode) => normalizedMap[mode] !== false);
    },

    _getDefaultWidgetVisibility() {
        return this._deepClone((this.defaultV2 && this.defaultV2.visibility) ? this.defaultV2.visibility : {});
    },

    _normalizeProfile(rawProfile) {
        const src = this._isPlainObject(rawProfile) ? rawProfile : {};
        const fallbackName = this.defaultProfile && this.defaultProfile.name ? this.defaultProfile.name : 'Guest User';
        const fallbackAvatar = this.defaultProfile && this.defaultProfile.avatar ? this.defaultProfile.avatar : 'G';

        const name = String(src.name || fallbackName).trim().slice(0, 80) || fallbackName;
        const avatarRaw = String(src.avatar || '').trim();
        const avatar = (avatarRaw ? avatarRaw.slice(0, 2) : (name.charAt(0) || fallbackAvatar)).toUpperCase();
        return { name, avatar };
    },

    _normalizeWidgetVisibilityMap(rawMap) {
        const source = this._isPlainObject(rawMap) ? rawMap : {};
        const defaults = this._getDefaultWidgetVisibility();
        const out = {};

        Object.keys(defaults).forEach((id) => {
            out[id] = this._normalizeVisibilityAssignment(source[id], defaults[id]);
        });

        Object.keys(source).forEach((id) => {
            if (!id || out[id] !== undefined) return;
            out[id] = this._normalizeVisibilityAssignment(source[id], 'both');
        });

        return out;
    },

    getDefaultSettings() {
        return {
            version: 1,
            profile: this._normalizeProfile(this.defaultProfile),
            startup: {
                policy: 'remember-last',
                fixedMode: 'personal',
                allowUrlOverride: true,
                lastMode: 'personal'
            },
            modeVisibility: {
                personal: true,
                business: true,
                vision: true,
                ritual: true,
                feed: true,
                library: true
            },
            density: {
                personal: 'full',
                business: 'full',
                vision: 'full',
                ritual: 'full',
                feed: 'full',
                library: 'full'
            },
            dateTime: {
                weekStartsOn: 'monday',
                dateStyle: 'system',
                hourCycle: 'system'
            },
            accessibility: {
                reducedMotion: false,
                introAnimation: 'once-per-session'
            },
            visualizer: {
                mode: 'pro'
            },
            widgetVisibility: this._getDefaultWidgetVisibility()
        };
    },

    _normalizeSettings(rawSettings) {
        const defaults = this.getDefaultSettings();
        const src = this._isPlainObject(rawSettings) ? rawSettings : {};

        const profile = this._normalizeProfile(src.profile);
        const modeVisibility = this._normalizeModeVisibilityMap(src.modeVisibility);
        const visibleModes = this._getVisibleModesFromMap(modeVisibility);
        const firstVisibleMode = visibleModes[0] || defaults.startup.fixedMode;

        const startupSrc = this._isPlainObject(src.startup) ? src.startup : {};
        const candidateFixedMode = this._normalizeMode(startupSrc.fixedMode, defaults.startup.fixedMode);
        const fixedMode = visibleModes.includes(candidateFixedMode) ? candidateFixedMode : firstVisibleMode;
        const startupPolicy = startupSrc.policy === 'fixed-default' ? 'fixed-default' : 'remember-last';
        const candidateLastMode = this._normalizeMode(startupSrc.lastMode, fixedMode);
        const lastMode = visibleModes.includes(candidateLastMode) ? candidateLastMode : fixedMode;
        const startup = {
            policy: startupPolicy,
            fixedMode,
            allowUrlOverride: startupSrc.allowUrlOverride !== false,
            lastMode
        };

        const densitySrc = this._isPlainObject(src.density) ? src.density : {};
        const density = {};
        this.SETTINGS_MODES.forEach((mode) => {
            density[mode] = this._normalizeDensity(densitySrc[mode], defaults.density[mode]);
        });

        const dateTimeSrc = this._isPlainObject(src.dateTime) ? src.dateTime : {};
        const dateTime = {
            weekStartsOn: this._normalizeWeekStartsOn(dateTimeSrc.weekStartsOn, defaults.dateTime.weekStartsOn),
            dateStyle: this._normalizeDateStyle(dateTimeSrc.dateStyle, defaults.dateTime.dateStyle),
            hourCycle: this._normalizeHourCycle(dateTimeSrc.hourCycle, defaults.dateTime.hourCycle)
        };

        const accessibilitySrc = this._isPlainObject(src.accessibility) ? src.accessibility : {};
        const accessibility = {
            reducedMotion: Boolean(accessibilitySrc.reducedMotion),
            introAnimation: this._normalizeIntroAnimation(accessibilitySrc.introAnimation, defaults.accessibility.introAnimation)
        };

        const visualizerSrc = this._isPlainObject(src.visualizer) ? src.visualizer : {};
        const visualizer = {
            mode: visualizerSrc.mode === 'normal' ? 'normal' : 'pro'
        };

        return {
            version: 1,
            profile,
            startup,
            modeVisibility,
            density,
            dateTime,
            accessibility,
            visualizer,
            widgetVisibility: this._normalizeWidgetVisibilityMap(src.widgetVisibility)
        };
    },

    _loadLegacyProfile() {
        const raw = localStorage.getItem(this.PROFILE_KEY);
        if (!raw) return this.defaultProfile;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return this.defaultProfile;
        }
    },

    _loadLegacyVisualizerMode() {
        const stored = localStorage.getItem(this.VISUALIZER_MODE_KEY);
        return stored === 'normal' ? 'normal' : 'pro';
    },

    _loadLegacyLastMode() {
        const stored = localStorage.getItem('lifeos-mode');
        return this._normalizeMode(stored, 'personal');
    },

    _loadLegacyWidgetVisibility() {
        const visRaw = this._safeParseJson(localStorage.getItem(this.WIDGET_VIS_KEY), null);
        if (this._isPlainObject(visRaw)) {
            return this._normalizeWidgetVisibilityMap(visRaw);
        }

        // Legacy compatibility: some builds stored visibility under a dedicated key.
        const legacyDedicated = this._safeParseJson(localStorage.getItem('lifeos-v2.visibility'), null);
        if (this._isPlainObject(legacyDedicated)) {
            return this._normalizeWidgetVisibilityMap(legacyDedicated);
        }

        const v2Raw = this._safeParseJson(localStorage.getItem(this.V2_KEY), null);
        if (v2Raw && this._isPlainObject(v2Raw.visibility)) {
            return this._normalizeWidgetVisibilityMap(v2Raw.visibility);
        }

        return this._getDefaultWidgetVisibility();
    },

    migrateLegacySettingsToV1() {
        const stored = localStorage.getItem(this.SETTINGS_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const normalized = this._normalizeSettings(parsed);
                this._settingsCache = normalized;
                if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
                    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(normalized));
                }
                return this._deepClone(normalized);
            } catch (e) {
                console.warn('Store: settings parse failed, falling back to legacy migration', e);
            }
        }

        const migrated = this._normalizeSettings({
            profile: this._loadLegacyProfile(),
            startup: {
                policy: 'remember-last',
                fixedMode: 'personal',
                allowUrlOverride: true,
                lastMode: this._loadLegacyLastMode()
            },
            density: this.getDefaultSettings().density,
            dateTime: this.getDefaultSettings().dateTime,
            accessibility: this.getDefaultSettings().accessibility,
            visualizer: { mode: this._loadLegacyVisualizerMode() },
            widgetVisibility: this._loadLegacyWidgetVisibility()
        });
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(migrated));
        this._settingsCache = migrated;
        return this._deepClone(migrated);
    },

    getSettings(options = {}) {
        if (!options.fresh && this._settingsCache) {
            return this._deepClone(this._settingsCache);
        }

        const stored = localStorage.getItem(this.SETTINGS_KEY);
        if (!stored) {
            return this.migrateLegacySettingsToV1();
        }

        try {
            const parsed = JSON.parse(stored);
            const normalized = this._normalizeSettings(parsed);
            this._settingsCache = normalized;
            if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
                localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(normalized));
            }
            return this._deepClone(normalized);
        } catch (e) {
            console.warn('Store: settings payload was invalid, re-migrating from legacy values', e);
            return this.migrateLegacySettingsToV1();
        }
    },

    saveSettings(settings, options = {}) {
        const normalized = this._normalizeSettings(settings);
        this._settingsCache = normalized;
        if (options.persist !== false) {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(normalized));
        }
        return this._deepClone(normalized);
    },

    updateSettings(partial, options = {}) {
        const current = this.getSettings();
        const merged = this._deepMerge(current, partial);
        return this.saveSettings(merged, options);
    },

    getSetting(path, fallback = undefined) {
        const steps = Array.isArray(path)
            ? path.map((entry) => String(entry).trim()).filter(Boolean)
            : String(path || '').split('.').map((entry) => entry.trim()).filter(Boolean);
        if (!steps.length) return fallback;

        let current = this.getSettings();
        for (const step of steps) {
            if (!this._isPlainObject(current) && !Array.isArray(current)) return fallback;
            if (!(step in current)) return fallback;
            current = current[step];
        }
        return current == null ? fallback : this._deepClone(current);
    },

    setSetting(path, value, options = {}) {
        const steps = Array.isArray(path)
            ? path.map((entry) => String(entry).trim()).filter(Boolean)
            : String(path || '').split('.').map((entry) => entry.trim()).filter(Boolean);
        if (!steps.length) return this.getSettings();

        const patch = {};
        let cursor = patch;
        steps.forEach((step, index) => {
            if (index === steps.length - 1) {
                cursor[step] = value;
                return;
            }
            cursor[step] = {};
            cursor = cursor[step];
        });
        return this.updateSettings(patch, options);
    },

    // --- DERIVED / NEURAL STATE ---
    _invalidateDerivedState() {
        this._derivedStateCache = null;
        this._derivedStateRevision += 1;
    },

    _buildDerivedInputSnapshot() {
        return {
            v2: this.getV2Data(),
            todayState: this.getTodayState(),
            dailyStateEntries: this.getDailyStateEntries(),
            finance: this.getFinance(),
            fitness: this.getFitness(),
            invoices: this.getInvoices(),
            goals: this.getGoals(),
            journalEntries: this.getJournalEntries(),
            now: Date.now()
        };
    },

    _safeComputeDerivedState() {
        try {
            if (window.LifeGraph && typeof window.LifeGraph.computeDerivedState === 'function') {
                return window.LifeGraph.computeDerivedState(this._buildDerivedInputSnapshot());
            }
        } catch (e) {
            console.error('Store: LifeGraph compute failed', e);
        }

        if (window.LifeGraph && typeof window.LifeGraph.createEmptyDerivedState === 'function') {
            return window.LifeGraph.createEmptyDerivedState(Date.now());
        }

        return {
            version: '1.0.0',
            computedAt: Date.now(),
            nodes: {},
            metrics: { lifePulse: 0 },
            momentum: { contextAware: 0, creative: 0, revenue: 0 },
            signals: { stress: 0, recovery: 0 },
            influence: { weights: {}, targets: {} }
        };
    },

    getDerivedState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._derivedStateCache) {
            return this._derivedStateCache;
        }

        this._derivedStateCache = this._safeComputeDerivedState();
        return this._derivedStateCache;
    },

    invalidateCognitiveCache() {
        this._cognitiveStateCache = null;
        this._cognitiveStateRevision += 1;
    },

    _safeComputeCognitiveState() {
        try {
            if (window.CognitiveEngine && typeof window.CognitiveEngine.compute === 'function') {
                return window.CognitiveEngine.compute({ store: this });
            }
        } catch (e) {
            console.error('Store: Cognitive compute failed', e);
        }

        const mode = (window.ModeManager && typeof window.ModeManager.getMode === 'function')
            ? window.ModeManager.getMode()
            : 'personal';
        const ts = new Date().toISOString();
        return {
            version: '1.0',
            timestamp: ts,
            mode,
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
    },

    getCognitiveState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._cognitiveStateCache) {
            return this._cognitiveStateCache;
        }

        this._cognitiveStateCache = this._safeComputeCognitiveState();
        return this._cognitiveStateCache;
    },

    saveCognitiveFeedback(payload = {}) {
        if (window.CognitiveMemory && typeof window.CognitiveMemory.saveFeedback === 'function') {
            return window.CognitiveMemory.saveFeedback(payload);
        }

        const list = JSON.parse(localStorage.getItem(this.COG_FEEDBACK_KEY) || '[]');
        const entry = {
            id: payload.id || ('cfb-' + Date.now()),
            actionId: payload.actionId || payload.recommendationId || null,
            status: payload.status || 'ignored',
            note: payload.note || '',
            timestamp: payload.timestamp || new Date().toISOString()
        };
        list.push(entry);
        localStorage.setItem(this.COG_FEEDBACK_KEY, JSON.stringify(list.slice(-300)));
        return entry;
    },

    invalidateSystemLayerCaches() {
        this._timeStateCache = null;
        this._attentionStateCache = null;
        this._alignmentStateCache = null;
        this._relationshipStateCache = null;
        this._creativePhaseStateCache = null;
        this._narrativeStateCache = null;
        this._systemStateCache = null;
        this._systemHistoryCache = null;
    },

    _safeParseJson(text, fallback) {
        if (!text) return fallback;
        try {
            const parsed = JSON.parse(text);
            return parsed == null ? fallback : parsed;
        } catch (e) {
            return fallback;
        }
    },

    _toDateKey(value) {
        if (!value) return null;
        const ts = new Date(value).getTime();
        if (!Number.isFinite(ts)) return null;
        return new Date(ts).toISOString().slice(0, 10);
    },

    _normalizeEnergy(value) {
        if (typeof value === 'number') {
            if (value <= 1) return Math.min(1, Math.max(0, value));
            return Math.min(1, Math.max(0, value / 10));
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
    },

    _normalizeMood(value) {
        if (typeof value === 'number') {
            if (value <= 1) return Math.min(1, Math.max(0, value));
            return Math.min(1, Math.max(0, value / 10));
        }
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return null;
        if (lower.includes('great') || lower.includes('high')) return 0.85;
        if (lower.includes('good') || lower.includes('🙂')) return 0.7;
        if (lower.includes('neutral') || lower.includes('😐')) return 0.5;
        if (lower.includes('low') || lower.includes('😫')) return 0.25;
        return null;
    },

    _extractCognitiveDailySamples() {
        const raw = localStorage.getItem(this.COG_MEMORY_KEY);
        const parsed = this._safeParseJson(raw, {});
        const samples = parsed && Array.isArray(parsed.dailySamples) ? parsed.dailySamples : [];
        return samples
            .map((sample) => ({
                date: this._toDateKey(sample && sample.date),
                lifePulse: Number(sample && sample.lifePulse),
                stress: Number(sample && sample.stress)
            }))
            .filter((sample) => sample.date)
            .slice(-365);
    },

    _buildSystemHistorySnapshot(forceRecompute = false) {
        if (!forceRecompute && this._systemHistoryCache) {
            return this._systemHistoryCache;
        }

        const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
        const v2 = this.getV2Data();
        const derived = this.getDerivedState();
        const dailyStates = this.getDailyStateEntries();
        const archive = this.getDailyArchive();
        const journalEntries = this.getJournalEntries();
        const compass = this.getCompassData();
        const fitness = this.getFitness();
        const focusLog = this.getFocusLog();

        const metrics = derived && derived.metrics ? derived.metrics : {};
        const signals = derived && derived.signals ? derived.signals : {};
        const momentum = derived && derived.momentum ? derived.momentum : {};

        const financeScoreNow = clamp(metrics.financeScore, 0, 1);
        const stressNow = clamp(signals.stress != null ? signals.stress : metrics.stressScore, 0, 1);
        const rhythmNow = clamp(metrics.rhythmScore, 0, 1);
        const energyNow = clamp(
            derived && derived.nodes && derived.nodes.health ? derived.nodes.health.score : metrics.healthScore,
            0,
            1
        );
        const creativeNow = clamp(metrics.creativeMomentum, 0, 1);
        const lifePulseNow = clamp(metrics.lifePulse, 0, 100);

        const dayMap = Object.create(null);
        const ensureDay = (dateKey) => {
            if (!dateKey) return null;
            if (!dayMap[dateKey]) {
                dayMap[dateKey] = {
                    date: dateKey,
                    lifePulse: null,
                    stress: null,
                    energy: null,
                    mood: null,
                    rhythm: null,
                    financeScore: null,
                    creativeMomentum: null,
                    outputPoints: 0,
                    journalCount: 0,
                    deepWorkMinutes: 0,
                    adminMinutes: 0
                };
            }
            return dayMap[dateKey];
        };

        const classifyRhythmItem = (text) => {
            const lower = String(text || '').toLowerCase();
            return {
                isAdmin: lower.includes('admin') || lower.includes('inbox') || lower.includes('shutdown') || lower.includes('clear'),
                isDeep: lower.includes('deep work') || lower.includes('creation') || lower.includes('focus')
            };
        };

        Object.keys(archive || {}).forEach((dateKey) => {
            const entry = archive[dateKey] || {};
            const day = ensureDay(this._toDateKey(dateKey));
            if (!day) return;

            const rhythmPct = Number(entry && entry.rhythm && entry.rhythm.completionPct);
            if (Number.isFinite(rhythmPct)) day.rhythm = clamp(rhythmPct / 100, 0, 1);

            const dayState = entry && entry.dailyState ? entry.dailyState : null;
            if (dayState) {
                const energy = this._normalizeEnergy(dayState.energy);
                const mood = this._normalizeMood(dayState.mood);
                if (energy != null) day.energy = clamp(energy, 0, 1);
                if (mood != null) day.mood = clamp(mood, 0, 1);
            }

            const phases = Array.isArray(entry && entry.rhythm && entry.rhythm.phases) ? entry.rhythm.phases : [];
            phases.forEach((phase) => {
                (Array.isArray(phase && phase.items) ? phase.items : []).forEach((item) => {
                    if (!item || !item.done) return;
                    const flags = classifyRhythmItem(item.text);
                    if (flags.isAdmin) day.adminMinutes += 15;
                    if (flags.isDeep) day.deepWorkMinutes += 25;
                });
            });

            const archivedJournal = Array.isArray(entry && entry.journal) ? entry.journal : [];
            day.journalCount += archivedJournal.length;
        });

        (Array.isArray(dailyStates) ? dailyStates : []).forEach((entry) => {
            const day = ensureDay(this._toDateKey(entry && entry.date));
            if (!day) return;
            const energy = this._normalizeEnergy(entry && entry.energy);
            const mood = this._normalizeMood(entry && entry.mood);
            if (energy != null) day.energy = clamp(energy, 0, 1);
            if (mood != null) day.mood = clamp(mood, 0, 1);
        });

        const lateActivityTimestamps = [];
        (Array.isArray(journalEntries) ? journalEntries : []).forEach((entry) => {
            const ts = entry && entry.date ? new Date(entry.date) : null;
            const dateKey = this._toDateKey(ts);
            const day = ensureDay(dateKey);
            if (day) day.journalCount += 1;
            if (ts && Number.isFinite(ts.getTime())) {
                const hour = ts.getHours();
                if (hour >= 22 || hour <= 4) lateActivityTimestamps.push(ts.toISOString());
            }
        });

        const compassDailyLog = Array.isArray(compass && compass.dailyLog) ? compass.dailyLog : [];
        compassDailyLog.forEach((entry) => {
            const dateKey = this._toDateKey(entry && entry.date);
            const day = ensureDay(dateKey);
            if (!day) return;

            const outcome = String(entry && entry.outcome || '').toLowerCase();
            if (outcome === 'yes') {
                day.outputPoints += 1;
                day.deepWorkMinutes += 25;
            } else if (outcome === 'little') {
                day.outputPoints += 0.45;
                day.deepWorkMinutes += 10;
            }

            const ts = entry && entry.date ? new Date(entry.date) : null;
            if (ts && Number.isFinite(ts.getTime())) {
                const hour = ts.getHours();
                if (hour >= 22 || hour <= 4) lateActivityTimestamps.push(ts.toISOString());
            }
        });

        const activities = Array.isArray(fitness && fitness.activities) ? fitness.activities : [];
        activities.forEach((act) => {
            const ts = act && act.date ? new Date(act.date) : null;
            if (!ts || !Number.isFinite(ts.getTime())) return;
            const hour = ts.getHours();
            if (hour >= 22 || hour <= 4) lateActivityTimestamps.push(ts.toISOString());
        });

        const cognitiveSamples = this._extractCognitiveDailySamples();
        cognitiveSamples.forEach((sample) => {
            const day = ensureDay(sample.date);
            if (!day) return;
            if (Number.isFinite(sample.lifePulse)) day.lifePulse = clamp(sample.lifePulse, 0, 100);
            if (Number.isFinite(sample.stress)) day.stress = clamp(sample.stress, 0, 1);
        });

        const focusEntries = [];
        if (focusLog && typeof focusLog === 'object') {
            Object.keys(focusLog).forEach((key) => {
                const val = focusLog[key];
                let minutes = 0;
                if (Number.isFinite(Number(val))) minutes = Number(val);
                else if (val && typeof val === 'object') {
                    minutes = Number(val.minutes || val.total || val.duration || 0);
                }
                if (!Number.isFinite(minutes) || minutes <= 0) return;
                const dateKey = this._toDateKey(key);
                const day = ensureDay(dateKey);
                if (!day) return;
                day.deepWorkMinutes += minutes;
                focusEntries.push({ date: dateKey, minutes });
            });
        }

        const todayKey = this._toDateKey(new Date());
        const today = ensureDay(todayKey);
        if (today) {
            today.lifePulse = lifePulseNow;
            today.stress = stressNow;
            today.energy = energyNow;
            today.rhythm = rhythmNow;
            today.financeScore = financeScoreNow;
            today.creativeMomentum = creativeNow;

            const phases = Array.isArray(v2 && v2.dailyRhythm) ? v2.dailyRhythm : [];
            phases.forEach((phase) => {
                (Array.isArray(phase && phase.items) ? phase.items : []).forEach((item) => {
                    if (!item || !item.done) return;
                    const flags = classifyRhythmItem(item.text);
                    if (flags.isAdmin) today.adminMinutes += 15;
                    if (flags.isDeep) today.deepWorkMinutes += 25;
                });
            });
        }

        const dailySeries = Object.keys(dayMap)
            .sort()
            .map((dateKey) => {
                const day = dayMap[dateKey];
                const energy = day.energy != null ? clamp(day.energy, 0, 1) : energyNow;
                const mood = day.mood != null ? clamp(day.mood, 0, 1) : 0.5;
                const rhythm = day.rhythm != null ? clamp(day.rhythm, 0, 1) : rhythmNow;
                const financeScore = day.financeScore != null ? clamp(day.financeScore, 0, 1) : financeScoreNow;
                const creativeMomentum = day.creativeMomentum != null
                    ? clamp(day.creativeMomentum, 0, 1)
                    : clamp((day.outputPoints * 0.78) + (Math.min(2, day.journalCount) * 0.11), 0, 1);
                const stress = day.stress != null
                    ? clamp(day.stress, 0, 1)
                    : clamp(1 - ((financeScore * 0.4) + (energy * 0.35) + (rhythm * 0.25) + (mood * 0.1)), 0, 1);
                const lifePulse = day.lifePulse != null
                    ? clamp(day.lifePulse, 0, 100)
                    : clamp(
                        ((rhythm * 0.25) + (energy * 0.2) + (creativeMomentum * 0.2) + (financeScore * 0.15) + ((1 - stress) * 0.2)) * 100,
                        0,
                        100
                    );

                return {
                    date: dateKey,
                    lifePulse: Math.round(lifePulse),
                    stress: clamp(stress, 0, 1),
                    energy: clamp(energy, 0, 1),
                    mood: clamp(mood, 0, 1),
                    rhythm: clamp(rhythm, 0, 1),
                    financeScore: clamp(financeScore, 0, 1),
                    creativeMomentum: clamp(creativeMomentum, 0, 1),
                    outputPoints: clamp(day.outputPoints, 0, 5),
                    journalCount: clamp(day.journalCount, 0, 20),
                    deepWorkMinutes: Math.max(0, Number(day.deepWorkMinutes) || 0),
                    adminMinutes: Math.max(0, Number(day.adminMinutes) || 0)
                };
            })
            .slice(-365);

        const deepWorkEntries = dailySeries.map((item) => ({ date: item.date, minutes: item.deepWorkMinutes }));
        const adminEntries = dailySeries.map((item) => ({ date: item.date, minutes: item.adminMinutes }));

        const trailing = dailySeries.slice(-7);
        const deepWorkMinutes7d = trailing.reduce((sum, item) => sum + item.deepWorkMinutes, 0);
        const adminMinutes7d = trailing.reduce((sum, item) => sum + item.adminMinutes, 0);

        const revenueEngine = v2 && v2.revenueEngine ? v2.revenueEngine : {};
        const revenueWorkMinutes7d = Math.round(
            (Number(revenueEngine.invoices) || 0) * 10 +
            (Number(revenueEngine.deals) || 0) * 10 +
            ((Number(revenueEngine.pipeline) || 0) / 300)
        );

        const workIntensity = clamp(
            ((deepWorkMinutes7d + adminMinutes7d) / 420) * 0.58 +
            (clamp(momentum.contextAware, 0, 1) * 0.42),
            0,
            1
        );

        this._systemHistoryCache = {
            generatedAt: new Date().toISOString(),
            dailySeries,
            deepWorkEntries,
            adminEntries,
            deepWorkMinutes7d,
            adminMinutes7d,
            revenueWorkMinutes7d,
            workIntensity,
            compassDailyLog,
            focusEntries,
            journalEntries: Array.isArray(journalEntries) ? journalEntries : [],
            lateActivityTimestamps
        };

        return this._systemHistoryCache;
    },

    _safeComputeTimeState() {
        try {
            if (window.TimeEngine && typeof window.TimeEngine.computeTimeState === 'function') {
                return window.TimeEngine.computeTimeState(
                    this.getV2Data(),
                    this.getDerivedState(),
                    this._buildSystemHistorySnapshot()
                );
            }
        } catch (e) {
            console.error('Store: Time engine compute failed', e);
        }

        return {
            phase: 'EXPLORE',
            momentum30: 0,
            momentum90: 0,
            momentum365: 0,
            burnoutRisk: 0,
            trend: 'FLAT'
        };
    },

    getTimeState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._timeStateCache) return this._timeStateCache;
        this._timeStateCache = this._safeComputeTimeState();
        return this._timeStateCache;
    },

    _safeComputeAttentionState() {
        try {
            if (window.AttentionEngine && typeof window.AttentionEngine.computeAttentionState === 'function') {
                return window.AttentionEngine.computeAttentionState(
                    this.getV2Data(),
                    this.getDerivedState(),
                    this._buildSystemHistorySnapshot()
                );
            }
        } catch (e) {
            console.error('Store: Attention engine compute failed', e);
        }

        return {
            integrity: 0.5,
            deepWorkRatio: 0.5,
            contextSwitchRisk: 0.5,
            lateStimulusRisk: 0.5,
            leakSource: 'NONE'
        };
    },

    getAttentionState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._attentionStateCache) return this._attentionStateCache;
        this._attentionStateCache = this._safeComputeAttentionState();
        return this._attentionStateCache;
    },

    _safeComputeAlignmentState() {
        try {
            if (window.AlignmentEngine && typeof window.AlignmentEngine.computeAlignmentState === 'function') {
                return window.AlignmentEngine.computeAlignmentState(
                    this.getV2Data(),
                    this.getDerivedState(),
                    this._buildSystemHistorySnapshot()
                );
            }
        } catch (e) {
            console.error('Store: Alignment engine compute failed', e);
        }

        return {
            score: 0.5,
            mode: 'DRIFT',
            northStarTimeRatio: 0,
            revenueOnlyRatio: 0,
            maintenanceRatio: 0
        };
    },

    getAlignmentState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._alignmentStateCache) return this._alignmentStateCache;
        this._alignmentStateCache = this._safeComputeAlignmentState();
        return this._alignmentStateCache;
    },

    _safeComputeRelationshipState() {
        try {
            if (window.RelationshipEngine && typeof window.RelationshipEngine.computeRelationshipState === 'function') {
                return window.RelationshipEngine.computeRelationshipState(
                    this.getV2Data(),
                    this.getDerivedState(),
                    this._buildSystemHistorySnapshot()
                );
            }
        } catch (e) {
            console.error('Store: Relationship engine compute failed', e);
        }

        return {
            warmth: 0.5,
            isolationRisk: 0.5,
            neglectedCount: 0,
            lastContactDaysMedian: 14
        };
    },

    getRelationshipState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._relationshipStateCache) return this._relationshipStateCache;
        this._relationshipStateCache = this._safeComputeRelationshipState();
        return this._relationshipStateCache;
    },

    _safeComputeCreativePhaseState() {
        try {
            if (window.CreativePhaseEngine && typeof window.CreativePhaseEngine.computeCreativePhaseState === 'function') {
                return window.CreativePhaseEngine.computeCreativePhaseState(
                    this.getV2Data(),
                    this.getDerivedState(),
                    this._buildSystemHistorySnapshot()
                );
            }
        } catch (e) {
            console.error('Store: Creative phase engine compute failed', e);
        }

        return {
            phase: 'EXPLORATION',
            stagnationRisk: 0.5,
            outputVelocity: 0,
            ideaDensity: 0.5
        };
    },

    getCreativePhaseState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._creativePhaseStateCache) return this._creativePhaseStateCache;
        this._creativePhaseStateCache = this._safeComputeCreativePhaseState();
        return this._creativePhaseStateCache;
    },

    _safeComputeNarrativeState() {
        try {
            if (window.NarrativeEngine && typeof window.NarrativeEngine.computeNarrativeState === 'function') {
                return window.NarrativeEngine.computeNarrativeState(
                    this.getV2Data(),
                    this.getDerivedState(),
                    {
                        timeState: this.getTimeState(),
                        attentionState: this.getAttentionState(),
                        alignmentState: this.getAlignmentState(),
                        relationshipState: this.getRelationshipState(),
                        creativePhaseState: this.getCreativePhaseState()
                    }
                );
            }
        } catch (e) {
            console.error('Store: Narrative engine compute failed', e);
        }

        return {
            chapterLabel: 'Exploration Season',
            trajectory: 'STABLE',
            keyThemes: ['continuity'],
            summary: 'System is stable with limited historical narrative context.'
        };
    },

    getNarrativeState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._narrativeStateCache) return this._narrativeStateCache;
        this._narrativeStateCache = this._safeComputeNarrativeState();
        return this._narrativeStateCache;
    },

    _safeComputeSystemState() {
        try {
            if (window.SystemStateEngine && typeof window.SystemStateEngine.computeSystemState === 'function') {
                return window.SystemStateEngine.computeSystemState({
                    derivedState: this.getDerivedState(),
                    cognitiveState: this.getCognitiveState(),
                    timeState: this.getTimeState(),
                    attentionState: this.getAttentionState(),
                    alignmentState: this.getAlignmentState(),
                    relationshipState: this.getRelationshipState(),
                    creativePhaseState: this.getCreativePhaseState(),
                    narrativeState: this.getNarrativeState()
                });
            }
        } catch (e) {
            console.error('Store: System state compute failed', e);
        }

        return {
            systemMode: 'EXPLORE',
            dominantConstraint: 'CLARITY',
            overallRisk: 0.5,
            lifeDirection: 'FLAT'
        };
    },

    getSystemState(forceRecompute = false) {
        this._installDerivedMutationTracking();
        if (!forceRecompute && this._systemStateCache) return this._systemStateCache;
        this._systemStateCache = this._safeComputeSystemState();
        return this._systemStateCache;
    },

    subscribe(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        this._stateSubscribers.add(listener);
        return () => this.unsubscribe(listener);
    },

    unsubscribe(listener) {
        this._stateSubscribers.delete(listener);
    },

    _emitStateChanged(payload) {
        if (!this._stateSubscribers || this._stateSubscribers.size === 0) return;
        this._stateSubscribers.forEach((listener) => {
            try {
                listener(payload || {});
            } catch (e) {
                console.warn('Store subscriber error:', e);
            }
        });
    },

    _installDerivedMutationTracking() {
        if (this._derivedMutationTrackingInstalled) return;

        const mutatingPrefixes = [
            'save', 'add', 'update', 'delete', 'toggle', 'reset',
            'set', 'append', 'log', 'remove', 'archive', 'restore',
            'clear', 'seed'
        ];
        const excluded = new Set([
            'getDerivedState',
            'getCognitiveState',
            'getTimeState',
            'getAttentionState',
            'getAlignmentState',
            'getRelationshipState',
            'getCreativePhaseState',
            'getNarrativeState',
            'getSystemState',
            '_invalidateDerivedState',
            'invalidateCognitiveCache',
            'invalidateSystemLayerCaches',
            '_buildDerivedInputSnapshot',
            '_buildSystemHistorySnapshot',
            '_safeComputeDerivedState',
            '_safeComputeCognitiveState',
            '_safeComputeTimeState',
            '_safeComputeAttentionState',
            '_safeComputeAlignmentState',
            '_safeComputeRelationshipState',
            '_safeComputeCreativePhaseState',
            '_safeComputeNarrativeState',
            '_safeComputeSystemState',
            'subscribe',
            'unsubscribe',
            '_emitStateChanged',
            '_installDerivedMutationTracking'
        ]);

        Object.keys(this).forEach((key) => {
            const candidate = this[key];
            if (typeof candidate !== 'function') return;
            if (excluded.has(key)) return;
            if (key.startsWith('_')) return;
            if (key.startsWith('get') || key.startsWith('is') || key.startsWith('has')) return;
            if (!mutatingPrefixes.some((prefix) => key.startsWith(prefix))) return;

            this[key] = (...args) => {
                const result = candidate.apply(this, args);
                this._invalidateDerivedState();
                this.invalidateCognitiveCache();
                this.invalidateSystemLayerCaches();
                this._emitStateChanged({
                    source: key,
                    timestamp: Date.now()
                });
                return result;
            };
        });

        this._derivedMutationTrackingInstalled = true;
    },

    // --- GOALS ---
    getGoals() {
        const stored = localStorage.getItem(this.GOALS_KEY);
        if (stored) return JSON.parse(stored);
        this.saveGoals(this.defaultGoals);
        return [...this.defaultGoals];
    },

    saveGoals(goals) {
        localStorage.setItem(this.GOALS_KEY, JSON.stringify(goals));
    },

    addGoal(goal) {
        const goals = this.getGoals();
        goal.id = 'g' + Date.now();
        goals.push(goal);
        this.saveGoals(goals);
        return goal;
    },

    updateGoal(id, updates) {
        const goals = this.getGoals();
        const idx = goals.findIndex(g => g.id === id);
        if (idx !== -1) {
            goals[idx] = { ...goals[idx], ...updates };
            this.saveGoals(goals);
        }
        return goals[idx];
    },

    deleteGoal(id) {
        const goals = this.getGoals().filter(g => g.id !== id);
        this.saveGoals(goals);
    },

    // --- HABITS ---
    getHabits() {
        const stored = localStorage.getItem(this.HABITS_KEY);
        if (stored) {
            const habits = JSON.parse(stored);
            // Migration: Core Habits Update
            if (habits.length > 0 && habits[0].name === 'Morning workout') {
                console.log("Migrating habits to Core Habits list...");
                this.saveHabits(this.defaultHabits);
                return [...this.defaultHabits];
            }
            return habits;
        }
        this.saveHabits(this.defaultHabits);
        return [...this.defaultHabits];
    },

    saveHabits(habits) {
        localStorage.setItem(this.HABITS_KEY, JSON.stringify(habits));
    },

    addHabit(habit) {
        const habits = this.getHabits();
        habit.id = 'h' + Date.now();
        habits.push(habit);
        this.saveHabits(habits);
        return habit;
    },

    updateHabit(id, updates) {
        const habits = this.getHabits();
        const idx = habits.findIndex(h => h.id === id);
        if (idx !== -1) {
            habits[idx] = { ...habits[idx], ...updates };
            this.saveHabits(habits);
        }
        return habits[idx];
    },

    deleteHabit(id) {
        const habits = this.getHabits().filter(h => h.id !== id);
        this.saveHabits(habits);
    },

    // Habit Daily Tracking
    // Habit Daily Tracking
    getHabitStatus() {
        const stored = JSON.parse(localStorage.getItem(this.HABITS_STATUS_KEY) || '{}');
        const today = new Date().toDateString();

        if (stored._date !== today) {
            const fresh = { _date: today };
            localStorage.setItem(this.HABITS_STATUS_KEY, JSON.stringify(fresh));
            return fresh;
        }
        return stored;
    },

    HABITS_HISTORY_KEY: 'lifeos-habits-history',

    getHabitHistory() {
        const stored = localStorage.getItem(this.HABITS_HISTORY_KEY);
        if (stored) return JSON.parse(stored);
        return {}; // { "YYYY-MM-DD": ["h1", "h2"] }
    },

    saveHabitHistory(history) {
        localStorage.setItem(this.HABITS_HISTORY_KEY, JSON.stringify(history));
    },

    toggleHabit(id) {
        const status = this.getHabitStatus();
        let isComplete = false;

        if (status[id]) {
            delete status[id];
            isComplete = false;
        } else {
            status[id] = true;
            isComplete = true;
        }

        localStorage.setItem(this.HABITS_STATUS_KEY, JSON.stringify(status));

        // Update streak in habit definition
        const habits = this.getHabits();
        const habit = habits.find(h => h.id === id);
        if (habit) {
            if (isComplete) {
                habit.streak = (habit.streak || 0) + 1;
            } else {
                habit.streak = Math.max(0, (habit.streak || 1) - 1);
            }
            this.saveHabits(habits);
        }

        // Update History Log
        const history = this.getHabitHistory();
        const todayIso = new Date().toISOString().split('T')[0];
        if (!history[todayIso]) history[todayIso] = [];

        if (isComplete) {
            if (!history[todayIso].includes(id)) history[todayIso].push(id);
        } else {
            history[todayIso] = history[todayIso].filter(hid => hid !== id);
        }
        this.saveHabitHistory(history);

        return isComplete;
    },

    getHabitCompletionRate() {
        const status = this.getHabitStatus();
        const habits = this.getHabits();
        // Filter out internal keys like _date
        const completedCount = Object.keys(status).filter(k => k !== '_date').length;
        return { done: completedCount, total: habits.length };
    },

    // --- DATA GETTERS / SETTERS ---

    // Profile
    getProfile() {
        // Deprecated legacy key fallback remains for one release cycle.
        const canonical = this.getSetting('profile', null);
        if (canonical) return this._normalizeProfile(canonical);

        try {
            const stored = localStorage.getItem(this.PROFILE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) {
            console.error("Error parsing profile:", e);
        }
        return this._normalizeProfile(this.defaultProfile);
    },
    saveProfile(data) {
        // Canonical write path: settings.v1 only.
        const normalized = this._normalizeProfile(data);
        this.setSetting('profile', normalized);
        return normalized;
    },

    // Finance
    getFinance() {
        const stored = localStorage.getItem(this.FINANCE_KEY);
        if (stored) return JSON.parse(stored);
        this.saveFinance(this.defaultFinance);
        return this.defaultFinance;
    },
    saveFinance(data) {
        localStorage.setItem(this.FINANCE_KEY, JSON.stringify(data));
    },

    // Fitness
    getFitness() {
        const stored = localStorage.getItem(this.FITNESS_KEY);
        if (stored) return JSON.parse(stored);
        this.saveFitness(this.defaultFitness);
        return this.defaultFitness;
    },
    saveFitness(data) {
        localStorage.setItem(this.FITNESS_KEY, JSON.stringify(data));
    },

    // --- Activity Log Helpers ---
    getActivities() {
        const fitness = this.getFitness();
        return fitness.activities || [];
    },
    saveActivities(activities) {
        const fitness = this.getFitness();
        fitness.activities = activities;
        this.saveFitness(fitness);
    },
    addActivity(activity) {
        const activities = this.getActivities();
        activity.id = 'act-' + Date.now();
        activities.unshift(activity); // Newest first
        this.saveActivities(activities);
        return activity;
    },
    deleteActivity(id) {
        const activities = this.getActivities().filter(a => a.id !== id);
        this.saveActivities(activities);
    },

    // Events
    getEvents() {
        const stored = localStorage.getItem(this.EVENTS_KEY);
        if (stored) return JSON.parse(stored);
        this.saveEvents(this.defaultEvents);
        return this.defaultEvents;
    },
    saveEvents(data) {
        localStorage.setItem(this.EVENTS_KEY, JSON.stringify(data));
    },

    // Journal Feed
    getJournalEntries() {
        const stored = localStorage.getItem(this.JOURNAL_KEY);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // Handle migration from old object/string format if necessary
                if (Array.isArray(data)) return data;
            } catch (e) {
                console.warn('Journal data parsing error', e);
            }
        }
        return [];
    },

    saveJournalEntries(entries) {
        localStorage.setItem(this.JOURNAL_KEY, JSON.stringify(entries));
    },

    addJournalEntry(text) {
        if (!text || !text.trim()) return;
        const entries = this.getJournalEntries();

        // Smart Context: Get today's state if available
        const todayState = this.getTodayState();

        const newEntry = {
            id: 'j' + Date.now(),
            text: text.trim(),
            date: new Date().toISOString(),
            mood: todayState ? todayState.mood : null,
            energy: todayState ? todayState.energy : null
        };
        entries.unshift(newEntry); // Add to top
        this.saveJournalEntries(entries);
        return newEntry;
    },

    deleteJournalEntry(id) {
        const entries = this.getJournalEntries().filter(e => e.id !== id);
        this.saveJournalEntries(entries);
    },

    // V2 Data
    getV2Data() {
        const stored = localStorage.getItem(this.V2_KEY);
        if (stored) {
            let data;
            try {
                data = JSON.parse(stored);
            } catch (e) {
                console.error("Error parsing V2 data:", e);
                return this.defaultV2;
            }
            let updated = false;
            // Simple top-level merge of missing keys from defaultV2
            for (const key in this.defaultV2) {
                if (data[key] === undefined) {
                    data[key] = this.defaultV2[key];
                    updated = true;
                }
            }

            // Deep merge visibility to ensure new widgets are assigned correctly
            if (data.visibility) {
                for (const key in this.defaultV2.visibility) {
                    if (data.visibility[key] === undefined) {
                        data.visibility[key] = this.defaultV2.visibility[key];
                        updated = true;
                    }
                }
            }

            // Migration: Creative Pulse -> Creative Compass
            if (data.creativePulse && !data.creativeCompass) {
                console.log("Migrating Creative Pulse to Creative Compass...");
                data.creativeCompass = JSON.parse(JSON.stringify(this.defaultV2.creativeCompass));
                if (data.creativePulse.worlds) {
                    data.creativeCompass.projects = data.creativePulse.worlds.map((w, i) => ({
                        id: 'cp' + i + '-' + Date.now(),
                        name: w.name,
                        stage: 'GROWING',
                        lastActivityDate: new Date().toISOString().split('T')[0],
                        priorityWeight: 0,
                        archived: false
                    }));
                }
                delete data.creativePulse;
                updated = true;
            }

            // Migration: Core Rituals Update -> Daily Rhythm
            if (!data.dailyRhythm) {
                console.log("Migrating to Phased Daily Rhythm...");
                data.dailyRhythm = JSON.parse(JSON.stringify(this.defaultV2.dailyRhythm));
                updated = true;
            }

            // Migration: Boolean Visibility -> Mode Assignment Strings
            if (data.visibility) {
                let visMigrated = false;
                for (const key in data.visibility) {
                    if (typeof data.visibility[key] === 'boolean') {
                        data.visibility[key] = data.visibility[key] ? 'both' : 'hidden';
                        visMigrated = true;
                    }
                }
                if (visMigrated) updated = true;
            }

            // Canonical source of truth: keep V2 visibility in sync with Settings V1.
            const settingsVisibility = this.getSetting('widgetVisibility', this._getDefaultWidgetVisibility());
            if (JSON.stringify(data.visibility || {}) !== JSON.stringify(settingsVisibility || {})) {
                data.visibility = this._deepClone(settingsVisibility);
                updated = true;
            }

            if (updated) this.saveV2Data(data);
            return data;
        }
        const seeded = this._deepClone(this.defaultV2);
        seeded.visibility = this._deepClone(this.getSetting('widgetVisibility', this._getDefaultWidgetVisibility()));
        this.saveV2Data(seeded);
        return seeded;
    },

    saveV2Data(data) {
        const payload = this._deepClone(this._isPlainObject(data) ? data : this.defaultV2);
        payload.visibility = this._deepClone(this.getSetting('widgetVisibility', this._getDefaultWidgetVisibility()));
        localStorage.setItem(this.V2_KEY, JSON.stringify(payload));
    },

    // --- Active Worlds Helpers ---
    addWorld(world) {
        const data = this.getV2Data();
        data.activeWorlds.push(world);
        this.saveV2Data(data);
    },
    deleteWorld(index) {
        const data = this.getV2Data();
        data.activeWorlds.splice(index, 1);
        this.saveV2Data(data);
    },

    // --- People Helpers ---
    addPerson(person) {
        const data = this.getV2Data();
        data.people.push(person);
        this.saveV2Data(data);
    },
    deletePerson(index) {
        const data = this.getV2Data();
        data.people.splice(index, 1);
        this.saveV2Data(data);
    },

    // Layout Persistence
    LAYOUT_KEY: 'lifeos-layout-v0.9-aurora',
    getLayout() {
        const stored = localStorage.getItem(this.LAYOUT_KEY);
        if (stored) return JSON.parse(stored);
        return null; // Default layout is the HTML structure
    },
    saveLayout(layout) {
        localStorage.setItem(this.LAYOUT_KEY, JSON.stringify(layout));
    },

    // --- Visual Config ---
    getVisual() {
        const stored = localStorage.getItem(this.VISUAL_KEY);
        if (!stored) return { ...this.defaultVisual };

        try {
            const parsed = JSON.parse(stored);
            // Check for new schema wrapper
            let settings = parsed.settings || parsed;

            // Migration: Version 0 (old style) -> Version 1
            if (!settings.version) {
                console.log("Creating default atmosphere settings (Migration v0->v1)");
                settings = { ...this.defaultVisual, ...settings, version: 1 };
                this.saveVisual(settings);
            }

            return settings;
        } catch (e) {
            console.error("Error loading atmosphere settings", e);
            return { ...this.defaultVisual };
        }
    },
    saveVisual(config) {
        const payload = {
            settings: config,
            updatedAt: Date.now()
        };
        localStorage.setItem(this.VISUAL_KEY, JSON.stringify(payload));
    },
    resetVisual() {
        localStorage.removeItem(this.VISUAL_KEY);
        // Also remove old key if it exists
        localStorage.removeItem('lifeos-visual-config');
        return { ...this.defaultVisual };
    },
    getVisualizerMode() {
        // Deprecated legacy key fallback remains for one release cycle.
        const canonical = this.getSetting('visualizer.mode', null);
        if (canonical === 'normal' || canonical === 'pro') return canonical;
        const stored = localStorage.getItem(this.VISUALIZER_MODE_KEY);
        if (stored === 'normal' || stored === 'pro') return stored;
        return this.getDefaultSettings().visualizer.mode;
    },
    saveVisualizerMode(mode) {
        const nextMode = mode === 'normal' ? 'normal' : 'pro';
        // Canonical write path: settings.v1 only.
        this.setSetting('visualizer.mode', nextMode);
        return nextMode;
    },

    // --- Focus Log & Creative Pulse Helpers ---
    // (Legacy focus log methods kept for historic references if needed, but project logic moves to Compass)
    getFocusLog() {
        const stored = localStorage.getItem(this.FOCUS_LOG_KEY);
        if (stored) return JSON.parse(stored);
        return {};
    },
    // --- Creative Compass Helpers ---
    getCompassData() {
        const v2 = this.getV2Data();
        return v2.creativeCompass || this.defaultV2.creativeCompass;
    },
    saveCompassData(compass) {
        const v2 = this.getV2Data();
        v2.creativeCompass = compass;
        this.saveV2Data(v2);
    },
    updateCompassProject(id, patch) {
        const compass = this.getCompassData();
        const idx = compass.projects.findIndex(p => p.id === id);
        if (idx !== -1) {
            compass.projects[idx] = { ...compass.projects[idx], ...patch };
            this.saveCompassData(compass);
        }
    },
    setDailyOverride(projectId) {
        const compass = this.getCompassData();
        compass.dailyOverride = {
            date: new Date().toDateString(),
            projectId: projectId
        };
        this.saveCompassData(compass);
    },
    appendDailyLog(entry) {
        const compass = this.getCompassData();
        if (!compass.dailyLog) compass.dailyLog = [];
        compass.dailyLog.push({
            date: new Date().toISOString(),
            ...entry
        });
        this.saveCompassData(compass);
    },

    // --- Widget Visibility ---
    getWidgetVisibility() {
        // Deprecated legacy fallback remains for one release cycle.
        const canonical = this.getSetting('widgetVisibility', null);
        if (canonical && this._isPlainObject(canonical)) {
            return this._normalizeWidgetVisibilityMap(canonical);
        }

        const v2Raw = this._safeParseJson(localStorage.getItem(this.V2_KEY), null);
        if (v2Raw && this._isPlainObject(v2Raw.visibility)) {
            return this._normalizeWidgetVisibilityMap(v2Raw.visibility);
        }

        const legacyRaw = this._safeParseJson(localStorage.getItem(this.WIDGET_VIS_KEY), null);
        if (legacyRaw && this._isPlainObject(legacyRaw)) {
            return this._normalizeWidgetVisibilityMap(legacyRaw);
        }

        return this._getDefaultWidgetVisibility();
    },
    saveWidgetVisibility(config) {
        const normalized = this._normalizeWidgetVisibilityMap(config);
        this.setSetting('widgetVisibility', normalized);

        // Keep V2 shadow in sync for compatibility readers.
        const v2 = this.getV2Data();
        v2.visibility = this._deepClone(normalized);
        this.saveV2Data(v2);
        return normalized;
    },

    // --- Daily State ---
    getDailyStateEntries() {
        const stored = localStorage.getItem(this.DAILY_STATE_KEY);
        if (stored) return JSON.parse(stored);
        return [...this.defaultDailyState];
    },
    saveDailyStateEntries(entries) {
        localStorage.setItem(this.DAILY_STATE_KEY, JSON.stringify(entries));
    },
    addDailyState(entry) {
        const entries = this.getDailyStateEntries();
        // Check if entry for today exists, if so update it
        const today = new Date().toDateString();
        const existingIdx = entries.findIndex(e => new Date(e.date).toDateString() === today);

        if (existingIdx !== -1) {
            entries[existingIdx] = { ...entries[existingIdx], ...entry };
        } else {
            entries.push(entry);
        }
        this.saveDailyStateEntries(entries);
    },
    getTodayState() {
        const entries = this.getDailyStateEntries();
        const today = new Date().toDateString();
        return entries.find(e => new Date(e.date).toDateString() === today);
    },

    // --- Seasons ---
    getSeasonsData() {
        const stored = localStorage.getItem(this.SEASONS_KEY);
        if (stored) return JSON.parse(stored);
        localStorage.setItem(this.SEASONS_KEY, JSON.stringify(this.defaultSeasons));
        return [...this.defaultSeasons];
    },
    saveSeasonsData(seasons) {
        localStorage.setItem(this.SEASONS_KEY, JSON.stringify(seasons));
    },
    getActiveSeason() {
        const seasons = this.getSeasonsData();
        return seasons.find(s => s.active);
    },
    updateSeason(id, updates) {
        const seasons = this.getSeasonsData();
        const idx = seasons.findIndex(s => s.id === id);
        if (idx !== -1) {
            seasons[idx] = { ...seasons[idx], ...updates };
            this.saveSeasonsData(seasons);
        }
    },

    // --- Invoices (Part of Finance) ---
    getInvoices() {
        const fin = this.getFinance();
        return fin.invoices || [];
    },
    saveInvoices(invoices) {
        const fin = this.getFinance();
        fin.invoices = invoices;
        this.saveFinance(fin);
    },
    addInvoice(inv) {
        const invoices = this.getInvoices();
        inv.id = 'inv' + Date.now();
        invoices.push(inv);
        this.saveInvoices(invoices);
    },
    // --- Pinned Widgets ---
    getPinnedWidgets() {
        const stored = localStorage.getItem(this.PINNED_WIDGETS_KEY);
        if (stored) return JSON.parse(stored);
        // Default pinned set — all widgets locked to their columns
        return [
            'finance-overview', 'revenue-engine', 'biz-finance-widget',
            'sport-widget', 'people-widget',
            'creative-pulse', 'journal-widget', 'system-health-widget',
            'daily-state', 'north-star', 'biz-projects-widget',
            'goals-widget', 'weekly-reflection', 'biz-content-widget',
            'vices-widget', 'daily-rhythm-widget', 'quick-capture-widget',
            'year-compass-widget', 'calendar-widget'
        ];
    },
    savePinnedWidgets(pinned) {
        localStorage.setItem(this.PINNED_WIDGETS_KEY, JSON.stringify(pinned));
    },
    isPinned(id) {
        const pinned = this.getPinnedWidgets();
        return pinned.includes(id);
    },
    togglePin(id) {
        let pinned = this.getPinnedWidgets();
        if (pinned.includes(id)) {
            pinned = pinned.filter(pid => pid !== id);
        } else {
            pinned.push(id);
        }
        this.savePinnedWidgets(pinned);
        return pinned.includes(id);
    },

    // --- Daily Archive System ---
    DAILY_ARCHIVE_KEY: 'lifeos-daily-archive',

    getDailyArchive() {
        const stored = localStorage.getItem(this.DAILY_ARCHIVE_KEY);
        if (stored) return JSON.parse(stored);
        return {};
    },

    saveDailyArchive(archive) {
        localStorage.setItem(this.DAILY_ARCHIVE_KEY, JSON.stringify(archive));
    },

    getArchivedDay(dateStr) {
        const archive = this.getDailyArchive();
        return archive[dateStr] || null;
    },

    hasArchive(dateStr) {
        const archive = this.getDailyArchive();
        return !!archive[dateStr];
    },

    archiveDay(dateStr) {
        const archive = this.getDailyArchive();
        const v2 = this.getV2Data();
        const rhythm = v2.dailyRhythm || [];

        // Calculate rhythm stats
        let totalSteps = 0;
        let completedSteps = 0;
        const phases = rhythm.map(phase => {
            const items = (phase.items || []).map(item => ({
                text: item.text,
                done: item.done
            }));
            totalSteps += items.length;
            completedSteps += items.filter(i => i.done).length;
            return {
                title: phase.title,
                items
            };
        });

        // Get today's state metrics
        const todayState = this.getTodayState();

        // Get today's journal entries
        const allJournal = this.getJournalEntries();
        const dayJournal = allJournal.filter(e => {
            const entryDate = new Date(e.date).toISOString().split('T')[0];
            return entryDate === dateStr;
        });

        // Goals snapshot
        const goals = this.getGoals().map(g => ({
            name: g.name,
            progress: g.progress,
            icon: g.icon
        }));

        // Events for this day
        const events = this.getEvents().filter(e => e.date === dateStr);

        // Vices
        const vices = v2.vices || [];

        // North Star snapshot
        const northStar = v2.northStar || {};

        // Quick Capture snapshot
        const quickCapture = v2.quickCapture || '';

        archive[dateStr] = {
            date: dateStr,
            archivedAt: new Date().toISOString(),
            rhythm: {
                phases,
                totalSteps,
                completedSteps,
                completionPct: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
            },
            dailyState: todayState || null,
            journal: dayJournal,
            goals,
            events,
            vices: vices.map(v => ({ name: v.name, count: v.count || 0 })),
            northStar: {
                focus: northStar.focus || '',
                intention: northStar.intention || ''
            },
            quickCapture
        };

        this.saveDailyArchive(archive);
        return archive[dateStr];
    },

    // Reset daily rhythm checkboxes (all items done = false)
    resetDailyRhythm() {
        const v2 = this.getV2Data();
        if (v2.dailyRhythm) {
            v2.dailyRhythm.forEach(phase => {
                if (phase.items) {
                    phase.items.forEach(item => {
                        item.done = false;
                    });
                }
            });
            this.saveV2Data(v2);
        }
    },

    // Reset vices counters
    resetVices() {
        const v2 = this.getV2Data();
        if (v2.vices) {
            v2.vices.forEach(v => {
                v.count = 0;
            });
            this.saveV2Data(v2);
        }
    },

    deleteInvoice(id) {
        const invoices = this.getInvoices().filter(i => i.id !== id);
        this.saveInvoices(invoices);
    },

    // --- Data Sovereignty (Backup & Restore) ---
    getAllData() {
        const data = {
            timestamp: new Date().toISOString(),
            version: '4.2',
            keys: {}
        };

        const keysToBackup = [
            this.SETTINGS_KEY,
            this.GOALS_KEY,
            this.HABITS_KEY,
            this.HABITS_STATUS_KEY,
            this.PROFILE_KEY,
            this.FINANCE_KEY,
            this.FITNESS_KEY,
            this.EVENTS_KEY,
            this.JOURNAL_KEY,
            this.MOOD_KEY,
            this.VISUAL_KEY,
            this.FOCUS_LOG_KEY,
            this.WIDGET_VIS_KEY,
            this.DAILY_STATE_KEY,
            this.SEASONS_KEY,
            this.V2_KEY,
            this.DAILY_ARCHIVE_KEY,
            this.PINNED_WIDGETS_KEY,
            this.LAYOUT_KEY,
            this.HABITS_HISTORY_KEY,
            'lifeos-streak-history',
            'lifeos-current-streak',
            'lifeos-last-archive-date',
            'lifeos-v2.visibility',
            // Vision & Ritual keys
            'lifeOS.vision.northStar',
            'lifeOS.vision.timeHorizons',
            'lifeOS.vision.lifeThemes',
            'lifeOS.vision.milestones',
            'lifeOS.vision.decisions',
            'lifeOS.ritual.vinyl',
            this.WALK_LOG_ENTRIES_KEY,
            'lifeOS.ritual.walkLog',
            'lifeOS.ritual.dailyJournal',
            'lifeOS.ritual.gratitude',
            'lifeOS.ritual.slowDays',
            'lifeOS.ritual.gatherings',
            // Visual Synth keys
            'visualSynthPresetBank',
            'visualSynthLastState',
            'visualSynthSequencerPatterns',
            this.VISUALIZER_MODE_KEY,
            // Cognitive layer keys
            this.COG_MEMORY_KEY,
            this.COG_FEEDBACK_KEY,
            this.COG_LAST_STATE_KEY
        ];

        keysToBackup.forEach(key => {
            const val = localStorage.getItem(key);
            if (val) {
                try {
                    data.keys[key] = JSON.parse(val);
                } catch (e) {
                    console.warn(`Failed to parse key ${key}`, e);
                    data.keys[key] = val; // Backup raw string if parse fails
                }
            }
        });

        return data;
    },

    restoreAllData(jsonData) {
        if (!jsonData || typeof jsonData !== 'object') {
            console.error("Invalid backup file format");
            return false;
        }

        let keyPayload = null;
        if (this._isPlainObject(jsonData.keys)) {
            keyPayload = jsonData.keys;
        } else if (this._isPlainObject(jsonData)) {
            keyPayload = { ...jsonData };
            delete keyPayload.timestamp;
            delete keyPayload.version;
            delete keyPayload.keys;
        }

        if (!this._isPlainObject(keyPayload) || Object.keys(keyPayload).length === 0) {
            console.error("Invalid backup file format");
            return false;
        }

        try {
            Object.entries(keyPayload).forEach(([key, value]) => {
                if (typeof value === 'object') {
                    localStorage.setItem(key, JSON.stringify(value));
                } else {
                    localStorage.setItem(key, value);
                }
            });

            this._settingsCache = null;
            if (!Object.prototype.hasOwnProperty.call(keyPayload, this.SETTINGS_KEY)) {
                this.migrateLegacySettingsToV1();
            } else {
                this.getSettings({ fresh: true });
            }

            console.log("Restoration complete. Timestamp:", jsonData.timestamp || null);
            return true;
        } catch (e) {
            console.error("Failed to restore data", e);
            return false;
        }
    },
    clearAll() {
        localStorage.clear();
        this._settingsCache = null;
        console.log('Store: LocalStorage cleared.');
    },

    resetToDefaults() {
        this.clearAll();
        window.location.reload();
    },

    // ========================================
    //  VISION MODE — Legacy Compatibility Wrappers (Deprecated)
    // ========================================

    // NOTE: These wrappers are kept for one release cycle while Vision V2 uses
    // js/vision-mode.js as the canonical architecture.

    getVisionNorthStar() {
        const state = this._safeParseJson(localStorage.getItem('visionModeState'), null);
        if (state && typeof state.northStar === 'string') return state.northStar;
        return localStorage.getItem('lifeOS.vision.northStar') || '';
    },
    saveVisionNorthStar(text) {
        const state = this._safeParseJson(localStorage.getItem('visionModeState'), {}) || {};
        state.version = 2;
        state.updatedAt = new Date().toISOString();
        state.northStar = text || '';
        localStorage.setItem('visionModeState', JSON.stringify(state));
        localStorage.setItem('lifeOS.vision.northStar', text || '');
    },

    getVisionTimeHorizons() {
        const state = this._safeParseJson(localStorage.getItem('visionModeState'), null);
        if (state && (state.oneYearDirection != null || state.fiveYearDirection != null)) {
            return {
                oneYear: state.oneYearDirection || '',
                fiveYear: state.fiveYearDirection || ''
            };
        }
        const stored = this._safeParseJson(localStorage.getItem('lifeOS.vision.timeHorizons'), null);
        if (stored) return stored;
        return { oneYear: '', fiveYear: '' };
    },
    saveVisionTimeHorizons(data) {
        const state = this._safeParseJson(localStorage.getItem('visionModeState'), {}) || {};
        state.version = 2;
        state.updatedAt = new Date().toISOString();
        state.oneYearDirection = data && data.oneYear || '';
        state.fiveYearDirection = data && data.fiveYear || '';
        localStorage.setItem('visionModeState', JSON.stringify(state));
        localStorage.setItem('lifeOS.vision.timeHorizons', JSON.stringify({
            oneYear: state.oneYearDirection,
            fiveYear: state.fiveYearDirection
        }));
    },

    getVisionLifeThemes() {
        const state = this._safeParseJson(localStorage.getItem('visionModeState'), null);
        if (state && Array.isArray(state.themes)) {
            return state.themes.map((theme) => theme && theme.label).filter(Boolean);
        }
        return this._safeParseJson(localStorage.getItem('lifeOS.vision.lifeThemes'), []);
    },
    saveVisionLifeThemes(themes) {
        const list = Array.isArray(themes) ? themes : [];
        const state = this._safeParseJson(localStorage.getItem('visionModeState'), {}) || {};
        state.version = 2;
        state.updatedAt = new Date().toISOString();
        state.themes = list.map((label, idx) => ({
            id: `legacy-theme-${Date.now()}-${idx}`,
            label: String(label || '').trim(),
            weight: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })).filter((theme) => theme.label);
        localStorage.setItem('visionModeState', JSON.stringify(state));
        localStorage.setItem('lifeOS.vision.lifeThemes', JSON.stringify(list));
    },
    addVisionTheme(theme) {
        const list = this.getVisionLifeThemes();
        const value = String(theme || '').trim();
        if (value && !list.includes(value)) list.push(value);
        this.saveVisionLifeThemes(list);
        return list;
    },
    removeVisionTheme(theme) {
        const value = String(theme || '').trim();
        const list = this.getVisionLifeThemes().filter((item) => item !== value);
        this.saveVisionLifeThemes(list);
        return list;
    },

    getVisionMilestones() {
        const state = this._safeParseJson(localStorage.getItem('visionModeState'), null);
        if (state && Array.isArray(state.milestones)) {
            return state.milestones.map((milestone) => ({
                id: milestone.id,
                title: milestone.title,
                date: milestone.date || '',
                completed: milestone.status === 'done' || Number(milestone.completionPct) >= 100,
                completionPct: Number(milestone.completionPct) || 0,
                nextAction: milestone.nextAction || '',
                blocker: milestone.blocker || '',
                visionType: milestone.visionType || 'Custom'
            }));
        }
        return this._safeParseJson(localStorage.getItem('lifeOS.vision.milestones'), []);
    },
    saveVisionMilestones(milestones) {
        const list = Array.isArray(milestones) ? milestones : [];
        const now = new Date().toISOString();
        const state = this._safeParseJson(localStorage.getItem('visionModeState'), {}) || {};
        state.version = 2;
        state.updatedAt = now;
        state.milestones = list.map((milestone, idx) => {
            const completionPct = milestone.completed ? 100 : Math.max(0, Math.min(100, Number(milestone.completionPct) || 0));
            const status = completionPct >= 100 ? 'done' : (completionPct > 0 ? 'active' : 'planned');
            return {
                id: milestone.id || `legacy-ms-${Date.now()}-${idx}`,
                title: String(milestone.title || 'Milestone').trim(),
                date: milestone.date || '',
                visionType: milestone.visionType || 'Custom',
                completionPct,
                status,
                nextAction: status === 'done' ? '' : (milestone.nextAction || 'Define next action'),
                blocker: milestone.blocker || '',
                linkedProjectId: milestone.linkedProjectId || null,
                createdAt: milestone.createdAt || now,
                updatedAt: now
            };
        });
        localStorage.setItem('visionModeState', JSON.stringify(state));
        localStorage.setItem('lifeOS.vision.milestones', JSON.stringify(list));
    },
    addVisionMilestone(milestone) {
        const list = this.getVisionMilestones();
        list.push({ ...milestone, id: milestone.id || ('ms-' + Date.now()) });
        this.saveVisionMilestones(list);
        return list;
    },
    removeVisionMilestone(id) {
        const list = this.getVisionMilestones().filter((milestone) => milestone.id !== id);
        this.saveVisionMilestones(list);
        return list;
    },
    toggleVisionMilestone(id) {
        const list = this.getVisionMilestones();
        const target = list.find((milestone) => milestone.id === id);
        if (target) {
            target.completed = !target.completed;
            target.completionPct = target.completed ? 100 : 0;
        }
        this.saveVisionMilestones(list);
        return list;
    },

    getVisionDecisions() {
        const log = this._safeParseJson(localStorage.getItem('visionDecisionLog'), null);
        if (Array.isArray(log) && log.length) {
            return log.map((entry) => ({
                decision: entry.decision || 'yes',
                timestamp: entry.createdAt || new Date().toISOString()
            }));
        }
        return this._safeParseJson(localStorage.getItem('lifeOS.vision.decisions'), []);
    },
    logVisionDecision(decision) {
        const list = this.getVisionDecisions();
        list.push({ decision, timestamp: new Date().toISOString() });
        localStorage.setItem('lifeOS.vision.decisions', JSON.stringify(list));
        const mapped = list.map((entry, idx) => ({
            id: `legacy-decision-${Date.now()}-${idx}`,
            createdAt: entry.timestamp || new Date().toISOString(),
            decision: entry.decision === 'no' ? 'no' : 'yes',
            contextMode: 'vision',
            energyState: null,
            note: null,
            alignmentAtDecision: 50,
            driftAtDecision: 0,
            visionType: 'Custom'
        }));
        localStorage.setItem('visionDecisionLog', JSON.stringify(mapped.slice(-200)));
    },

    // ========================================
    //  RITUAL MODE — Data Layer
    // ========================================

    // --- Vinyl of the Week ---
    getRitualVinyl() {
        const stored = localStorage.getItem('lifeOS.ritual.vinyl');
        if (stored) return JSON.parse(stored);
        return {
            id: '',
            artist: '',
            album: '',
            record: '',
            coverUrl: '',
            artwork: '',
            ritualLine: '',
            notes: '',
            year: '',
            genre: '',
            label: '',
            appleMusicEmbedUrl: '',
            appleMusic: null,
            spotifyUrl: ''
        };
    },
    saveRitualVinyl(data) {
        localStorage.setItem('lifeOS.ritual.vinyl', JSON.stringify(data));
    },

    seedVinylData() {
        const vinyl = this.getRitualVinyl();
        if (!vinyl.artist) {
            this.saveRitualVinyl({
                id: 'vinyl-default',
                artist: 'Chihei Hatakeyama',
                album: 'Reflection of the Same Dream',
                record: 'Reflection of the Same Dream',
                coverUrl: '/Users/maximilianschertz/.gemini/antigravity/brain/c4d1faf9-235c-42a9-91d3-8fd165009a04/vinyl_artwork_placeholder_1771001921867.png',
                ritualLine: 'Air still with memory. A forest bath for the spirit.',
                notes: 'Air still with memory. A forest bath for the spirit.',
                artwork: '/Users/maximilianschertz/.gemini/antigravity/brain/c4d1faf9-235c-42a9-91d3-8fd165009a04/vinyl_artwork_placeholder_1771001921867.png',
                year: '',
                genre: '',
                label: '',
                appleMusicEmbedUrl: '',
                appleMusic: null,
                spotifyUrl: ''
            });
        }
    },

    // --- Walk / Forest Log ---
    _createWalkId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'walk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    },
    _sanitizeWalkEntry(entry) {
        const src = entry && typeof entry === 'object' ? entry : {};
        const nowIso = new Date().toISOString();

        const safeIso = (value, fallback) => {
            const ts = new Date(value).getTime();
            if (!Number.isFinite(ts)) return fallback;
            return new Date(ts).toISOString();
        };
        const asText = (value) => String(value == null ? '' : value).trim();

        const createdAt = safeIso(src.createdAt || src.endTime || src.startTime, nowIso);
        const startTime = safeIso(src.startTime || createdAt, createdAt);
        const endTime = safeIso(src.endTime || createdAt, createdAt);
        const walkType = asText(src.walkType) || 'Forest Deep';
        const note = asText(src.note);
        const weather = asText(src.weather);
        const moodBefore = asText(src.moodBefore);
        const moodAfter = asText(src.moodAfter);
        const location = asText(src.location);

        const out = {
            id: asText(src.id) || this._createWalkId(),
            startTime,
            endTime,
            durationSeconds: Math.max(0, Math.floor(Number(src.durationSeconds) || 0)),
            walkType,
            note,
            createdAt
        };

        if (weather) out.weather = weather;
        if (['Calm', 'Stressed', 'Neutral', 'Inspired'].includes(moodBefore)) out.moodBefore = moodBefore;
        if (['Calm', 'Stressed', 'Neutral', 'Inspired'].includes(moodAfter)) out.moodAfter = moodAfter;
        if (location) out.location = location;

        return out;
    },
    _walkLegacyTypeKey(typeLabel) {
        const normalized = String(typeLabel == null ? '' : typeLabel)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!normalized) return 'unknown';
        if (normalized === 'forest' || normalized === 'forest-deep') return 'forest';
        if (normalized === 'city' || normalized === 'city-drift') return 'city';
        if (normalized === 'sea' || normalized === 'sea-walk' || normalized === 'sea-water-walk') return 'sea';
        return normalized;
    },
    _buildLegacyWalkSummary(entries) {
        const safeEntries = Array.isArray(entries) ? entries : [];
        const typeCounts = { forest: 0, city: 0, sea: 0 };

        safeEntries.forEach((entry) => {
            const key = this._walkLegacyTypeKey(entry.walkType);
            typeCounts[key] = (typeCounts[key] || 0) + 1;
        });

        const latest = safeEntries[0] || null;
        return {
            count: safeEntries.length,
            lastDate: latest ? latest.endTime : null,
            lastType: latest ? latest.walkType : null,
            typeCounts
        };
    },
    _sortWalkEntriesNewest(entries) {
        return entries.slice().sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    },
    _getLocalWeekRange(referenceDate) {
        const ref = referenceDate ? new Date(referenceDate) : new Date();
        const safeRef = Number.isFinite(ref.getTime()) ? ref : new Date();
        const mondayOffset = (safeRef.getDay() + 6) % 7;
        const start = new Date(safeRef.getFullYear(), safeRef.getMonth(), safeRef.getDate() - mondayOffset);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return { start, end };
    },
    getWalkLogEntries() {
        const stored = localStorage.getItem(this.WALK_LOG_ENTRIES_KEY);
        if (!stored) return [];

        let parsed = [];
        try {
            parsed = JSON.parse(stored);
        } catch (e) {
            return [];
        }

        if (!Array.isArray(parsed)) return [];
        const sanitized = parsed.map((entry) => this._sanitizeWalkEntry(entry));
        return this._sortWalkEntriesNewest(sanitized);
    },
    saveWalkLogEntries(entries) {
        const list = Array.isArray(entries) ? entries : [];
        const sanitized = this._sortWalkEntriesNewest(list.map((entry) => this._sanitizeWalkEntry(entry)));
        localStorage.setItem(this.WALK_LOG_ENTRIES_KEY, JSON.stringify(sanitized));
        localStorage.setItem('lifeOS.ritual.walkLog', JSON.stringify(this._buildLegacyWalkSummary(sanitized)));
        return sanitized;
    },
    addWalkLogEntry(entry) {
        const current = this.getWalkLogEntries();
        const next = this._sanitizeWalkEntry(entry);
        const filtered = current.filter((item) => item.id !== next.id);
        filtered.unshift(next);
        this.saveWalkLogEntries(filtered);
        return next;
    },
    deleteWalkLogEntry(entryId) {
        const id = String(entryId == null ? '' : entryId).trim();
        if (!id) return false;
        const current = this.getWalkLogEntries();
        const next = current.filter((entry) => entry.id !== id);
        if (next.length === current.length) return false;
        this.saveWalkLogEntries(next);
        return true;
    },
    clearWalkLogEntries() {
        this.saveWalkLogEntries([]);
        return [];
    },
    getWalkWeeklyInsights(referenceDate) {
        const entries = this.getWalkLogEntries();
        const { start, end } = this._getLocalWeekRange(referenceDate);
        const weekEntries = entries.filter((entry) => {
            const ts = new Date(entry.endTime || entry.startTime || entry.createdAt).getTime();
            if (!Number.isFinite(ts)) return false;
            return ts >= start.getTime() && ts < end.getTime();
        });

        const totalSeconds = weekEntries.reduce((sum, entry) => {
            return sum + Math.max(0, Number(entry.durationSeconds) || 0);
        }, 0);

        const byType = {};
        weekEntries.forEach((entry) => {
            const label = String(entry.walkType || 'Forest Deep').trim() || 'Forest Deep';
            byType[label] = (byType[label] || 0) + 1;
        });

        const rankedTypes = Object.keys(byType).sort((a, b) => {
            if (byType[b] !== byType[a]) return byType[b] - byType[a];
            return a.localeCompare(b);
        });

        const totalWalks = weekEntries.length;
        return {
            weekStart: start.toISOString(),
            weekEnd: end.toISOString(),
            totalWalksThisWeek: totalWalks,
            totalMinutesThisWeek: Math.round(totalSeconds / 60),
            averageMinutes: totalWalks ? Math.round((totalSeconds / totalWalks) / 60) : 0,
            mostCommonWalkType: rankedTypes.length ? rankedTypes[0] : 'None yet'
        };
    },
    getRitualWalkLog() {
        const entries = this.getWalkLogEntries();
        const computed = this._buildLegacyWalkSummary(entries);

        const stored = localStorage.getItem('lifeOS.ritual.walkLog');
        if (!stored) {
            localStorage.setItem('lifeOS.ritual.walkLog', JSON.stringify(computed));
            return computed;
        }

        try {
            const parsed = JSON.parse(stored);
            if (!parsed || typeof parsed !== 'object') {
                localStorage.setItem('lifeOS.ritual.walkLog', JSON.stringify(computed));
                return computed;
            }

            const parsedTypeCounts = parsed.typeCounts && typeof parsed.typeCounts === 'object' ? parsed.typeCounts : {};
            const computedTypeCounts = computed.typeCounts || {};
            const sameTypeCounts = JSON.stringify(parsedTypeCounts) === JSON.stringify(computedTypeCounts);
            const sameSummary = Number(parsed.count) === Number(computed.count)
                && parsed.lastDate === computed.lastDate
                && parsed.lastType === computed.lastType
                && sameTypeCounts;

            if (sameSummary) {
                return {
                    count: Number(parsed.count) || 0,
                    lastDate: parsed.lastDate || null,
                    lastType: parsed.lastType || null,
                    typeCounts: parsedTypeCounts
                };
            }
        } catch (e) {
            localStorage.setItem('lifeOS.ritual.walkLog', JSON.stringify(computed));
            return computed;
        }

        localStorage.setItem('lifeOS.ritual.walkLog', JSON.stringify(computed));
        return computed;
    },
    logRitualWalk(type = 'forest') {
        const mappedType = {
            forest: 'Forest Deep',
            city: 'City Drift',
            sea: 'Silent Walk'
        };
        const walkType = mappedType[type] || String(type || 'Forest Deep');
        const iso = new Date().toISOString();
        this.addWalkLogEntry({
            id: this._createWalkId(),
            startTime: iso,
            endTime: iso,
            durationSeconds: 0,
            walkType: walkType,
            note: '',
            createdAt: iso
        });
        return this.getRitualWalkLog();
    },
    resetRitualWalkLog() {
        this.clearWalkLogEntries();
        return this.getRitualWalkLog();
    },

    // --- Ritual Journal (daily scratchpad, keyed by date) ---
    getRitualJournal() {
        const stored = localStorage.getItem('lifeOS.ritual.dailyJournal');
        if (stored) return JSON.parse(stored);
        return {};
    },
    getRitualJournalToday() {
        const all = this.getRitualJournal();
        const today = new Date().toISOString().split('T')[0];
        return all[today] || '';
    },
    saveRitualJournalToday(text) {
        const all = this.getRitualJournal();
        const today = new Date().toISOString().split('T')[0];
        all[today] = text;
        localStorage.setItem('lifeOS.ritual.dailyJournal', JSON.stringify(all));
    },

    // --- Gratitude ---
    getRitualGratitude() {
        const stored = localStorage.getItem('lifeOS.ritual.gratitude');
        if (stored) return JSON.parse(stored);
        return { today: new Date().toISOString().split('T')[0], lines: ['', '', ''] };
    },
    saveRitualGratitude(data) {
        localStorage.setItem('lifeOS.ritual.gratitude', JSON.stringify(data));
    },
    getRitualGratitudeToday() {
        const data = this.getRitualGratitude();
        const today = new Date().toISOString().split('T')[0];
        if (data.today !== today) {
            return { today, lines: ['', '', ''] };
        }
        return data;
    },
    saveRitualGratitudeToday(lines) {
        const today = new Date().toISOString().split('T')[0];
        this.saveRitualGratitude({ today, lines });
    },
    resetRitualGratitude() {
        const today = new Date().toISOString().split('T')[0];
        const data = { today, lines: ['', '', ''] };
        this.saveRitualGratitude(data);
        return data;
    },

    // --- Days Lived Slowly ---
    getRitualSlowDays() {
        const stored = localStorage.getItem('lifeOS.ritual.slowDays');
        if (stored) return JSON.parse(stored);
        return { count: 0, lastDate: null };
    },
    logRitualSlowDay() {
        const data = this.getRitualSlowDays();
        const today = new Date().toISOString().split('T')[0];
        if (data.lastDate === today) return data; // Already logged today
        data.count++;
        data.lastDate = today;
        localStorage.setItem('lifeOS.ritual.slowDays', JSON.stringify(data));
        return data;
    },
    resetRitualSlowDays() {
        const data = { count: 0, lastDate: null };
        localStorage.setItem('lifeOS.ritual.slowDays', JSON.stringify(data));
        return data;
    },

    // --- Upcoming Gatherings ---
    getRitualGatherings() {
        const stored = localStorage.getItem('lifeOS.ritual.gatherings');
        if (stored) return JSON.parse(stored);
        return [];
    },
    saveRitualGatherings(list) {
        localStorage.setItem('lifeOS.ritual.gatherings', JSON.stringify(list));
    },
    addRitualGathering(gathering) {
        const list = this.getRitualGatherings();
        gathering.id = 'gth-' + Date.now();
        list.push(gathering);
        this.saveRitualGatherings(list);
        return list;
    },
    removeRitualGathering(id) {
        const list = this.getRitualGatherings().filter(g => g.id !== id);
        this.saveRitualGatherings(list);
        return list;
    }
};

Store.migrateLegacySettingsToV1();
Store._installDerivedMutationTracking();
window.Store = Store;
