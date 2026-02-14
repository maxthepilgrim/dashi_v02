/* ========================================
   Mode Manager (Personal | Business | Vision | Ritual | Feed | Library)
   ======================================== */

var ModeManager = {
    KEY: 'lifeos-mode',
    DEFAULT: 'personal',
    MODES: ['personal', 'business', 'vision', 'ritual', 'feed', 'library'],

    _normalizeMode(mode, fallback = 'personal') {
        const value = String(mode || '').trim().toLowerCase();
        if (this.MODES.includes(value)) return value;
        return this.MODES.includes(fallback) ? fallback : this.DEFAULT;
    },

    _readModeFromBody() {
        if (!document.body) return '';
        for (const mode of this.MODES) {
            if (document.body.classList.contains(`mode-${mode}`)) return mode;
        }
        return '';
    },

    _getModeVisibilityMap() {
        const fallback = {};
        this.MODES.forEach((mode) => {
            fallback[mode] = true;
        });

        if (!window.Store || typeof Store.getSetting !== 'function') {
            return fallback;
        }

        try {
            const raw = Store.getSetting('modeVisibility', null);
            if (!raw || typeof raw !== 'object') return fallback;

            const out = {};
            this.MODES.forEach((mode) => {
                out[mode] = raw[mode] !== false;
            });
            if (!this.MODES.some((mode) => out[mode])) {
                out[this.DEFAULT] = true;
            }
            return out;
        } catch (e) {
            console.warn('[ModeManager] Failed to read mode visibility settings:', e);
            return fallback;
        }
    },

    getVisibleModes() {
        const visibilityMap = this._getModeVisibilityMap();
        const visible = this.MODES.filter((mode) => visibilityMap[mode]);
        return visible.length ? visible : [this.DEFAULT];
    },

    _resolveModeAgainstVisibility(mode, fallback = this.DEFAULT) {
        const normalized = this._normalizeMode(mode, '');
        const visible = this.getVisibleModes();
        if (normalized && visible.includes(normalized)) return normalized;
        if (visible.includes(fallback)) return fallback;
        return visible[0] || this.DEFAULT;
    },

    _applyModeToggleVisibility(activeMode = '') {
        const visibleSet = new Set(this.getVisibleModes());
        let visibleCount = 0;

        this.MODES.forEach((mode) => {
            const label = document.getElementById(`mode-label-${mode}`);
            if (!label) return;

            const isVisible = visibleSet.has(mode);
            label.hidden = !isVisible;
            label.style.display = isVisible ? '' : 'none';
            label.disabled = !isVisible;
            label.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
            if (!isVisible) {
                label.classList.remove('active');
                return;
            }

            visibleCount += 1;
            label.classList.toggle('active', mode === activeMode);
        });

        const modeGroup = document.querySelector('.master-dock-modes') || document.querySelector('.mode-toggle-bar');
        if (modeGroup) {
            modeGroup.classList.toggle('single-mode', visibleCount <= 1);
        }
    },

    refreshModeVisibility(options = {}) {
        const currentBodyMode = this._normalizeMode(this._readModeFromBody(), '');
        const fallbackMode = currentBodyMode || this.getMode();
        const resolved = this._resolveModeAgainstVisibility(fallbackMode, this.DEFAULT);

        this._applyModeToggleVisibility(resolved);

        const shouldEnforceCurrentMode = options.enforceCurrentMode !== false;
        if (shouldEnforceCurrentMode && currentBodyMode && currentBodyMode !== resolved) {
            this.setMode(resolved, {
                persistStartupLastMode: options.persistStartupLastMode !== false
            });
        }
        return resolved;
    },

    _getStartupSettings() {
        const fallbackMode = this._normalizeMode(localStorage.getItem(this.KEY), this.DEFAULT);
        const fallback = {
            policy: 'remember-last',
            fixedMode: this.DEFAULT,
            allowUrlOverride: true,
            lastMode: fallbackMode
        };

        if (!window.Store || typeof Store.getSettings !== 'function') {
            return fallback;
        }

        try {
            const settings = Store.getSettings();
            const startup = settings && settings.startup ? settings.startup : {};
            return {
                policy: startup.policy === 'fixed-default' ? 'fixed-default' : 'remember-last',
                fixedMode: this._normalizeMode(startup.fixedMode, this.DEFAULT),
                allowUrlOverride: startup.allowUrlOverride !== false,
                lastMode: this._normalizeMode(startup.lastMode, fallbackMode)
            };
        } catch (e) {
            console.warn('[ModeManager] Failed to read startup settings:', e);
            return fallback;
        }
    },

    _resolveInitialMode() {
        const startup = this._getStartupSettings();

        const urlParams = new URLSearchParams(window.location.search);
        const urlMode = this._normalizeMode(urlParams.get('mode'), '');
        if (urlMode && startup.allowUrlOverride) {
            return this._resolveModeAgainstVisibility(urlMode, startup.lastMode || this.DEFAULT);
        }

        if (startup.policy === 'fixed-default') {
            return this._resolveModeAgainstVisibility(startup.fixedMode, startup.lastMode || this.DEFAULT);
        }

        return this._resolveModeAgainstVisibility(startup.lastMode || this.DEFAULT, this.DEFAULT);
    },

    init() {
        const initialMode = this._resolveInitialMode();
        this.setMode(initialMode, { persistStartupLastMode: true });

        // 3. Keyboard Shortcut (M to cycle)
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

            if (e.key.toLowerCase() === 'm') {
                this.cycleMode();
            }
        });
    },

    getMode() {
        const bodyMode = this._normalizeMode(this._readModeFromBody(), '');
        if (bodyMode) return this._resolveModeAgainstVisibility(bodyMode, this.DEFAULT);

        if (window.Store && typeof Store.getSetting === 'function') {
            const settingsMode = this._normalizeMode(Store.getSetting('startup.lastMode', ''), '');
            if (settingsMode) return this._resolveModeAgainstVisibility(settingsMode, this.DEFAULT);
        }
        return this._resolveModeAgainstVisibility(localStorage.getItem(this.KEY), this.DEFAULT);
    },

    setMode(mode, options = {}) {
        const normalizedMode = this._normalizeMode(mode, '');
        if (!normalizedMode) return;
        const nextMode = options.allowHidden
            ? normalizedMode
            : this._resolveModeAgainstVisibility(normalizedMode, this.DEFAULT);
        if (!nextMode) return;

        localStorage.setItem(this.KEY, nextMode);
        const shouldPersistStartup = options.persistStartupLastMode !== false;
        if (shouldPersistStartup && window.Store && typeof Store.setSetting === 'function') {
            Store.setSetting('startup.lastMode', nextMode);
        }

        // Remove all mode classes, add current
        this.MODES.forEach(m => document.body.classList.remove(`mode-${m}`));
        document.body.classList.add(`mode-${nextMode}`);

        // Update Toggle UI with visibility + active mode state.
        this._applyModeToggleVisibility(nextMode);

        // Dispatch event for other components to react
        window.dispatchEvent(new CustomEvent('mode-changed', { detail: { mode: nextMode } }));
    },

    switchMode(mode) {
        this.setMode(mode);
    },

    cycleMode() {
        const visibleModes = this.getVisibleModes();
        if (!visibleModes.length) return;
        const current = this.getMode();
        const idx = visibleModes.indexOf(current);
        const next = visibleModes[(idx + 1) % visibleModes.length];
        this.setMode(next);
    }
};

window.ModeManager = ModeManager;
