/* ========================================
   LIFE OS — App Logic
   ======================================== */
console.log('[LifeOS] Script LOADED and STARTING at line 1');

// ---- Data ----
// Data is now managed by Store.js

// ---- Utilities ----

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// Global Initialization Flags (To avoid TDZ/ReferenceError)
let visionInitialized = false;
let ritualInitialized = false;
let vinylSpotifySearchResults = [];
let spotifyReturnContext = null;
let globalSettingsModalState = null;

const APP_MODES = ['personal', 'business', 'vision', 'ritual', 'library'];
const APP_VERSION = 'v9.4';
const APP_EDITION = 'AURORA';
const APP_VERSION_LABEL = `${APP_VERSION} ${APP_EDITION}`;
const ACTION_ARG_VALUE = '__value__';
const ACTION_ARG_TARGET = '__target__';
const ACTION_ARG_EVENT = '__event__';
const INLINE_STYLE_CUSTOM_PROP_ALLOWLIST = new Set(['--progress', '--delay', '--bg-image']);
const inlineStyleClassRegistry = new Map();
let inlineStyleSheetEl = null;
let inlineStyleObserver = null;
const WIDGET_SETTINGS_LABELS = {
    topbar: 'Greeting & Date',
    'north-star': 'North Star',
    'daily-state': 'Daily State',
    'daily-rhythm-widget': 'Daily Rhythm',
    'creative-pulse': 'Focus Engine',
    'goals-widget': 'Goals Tracker',
    'quick-capture-widget': 'Strike Team',
    'year-compass-widget': 'Year Compass',
    'system-health-widget': 'System Health',
    'vices-widget': 'Vault of Vices',
    'finance-overview': 'Personal Finance',
    'revenue-engine': 'Revenue Engine',
    'biz-finance-widget': 'Financial Intelligence',
    'biz-projects-widget': 'Projects & Leverage',
    'biz-content-widget': 'Creative Output',
    'active-worlds': 'Active Worlds',
    'people-widget': 'People & Relationships',
    'journal-widget': 'Quick Journal',
    'calendar-widget': 'Calendar',
    'sport-widget': 'Activity Log (Fitness)',
    'weekly-reflection': 'Weekly Reflection'
};

function parseDataActionArgs(rawArgs) {
    const source = String(rawArgs || '').trim();
    if (!source) return [];
    try {
        return Function(`"use strict"; return [${source}];`)();
    } catch (error) {
        console.warn('[LifeOS] Failed to parse data-action args:', rawArgs, error);
        return [];
    }
}

function hydrateActionArgs(args, element, event) {
    return args.map((arg) => {
        if (arg === ACTION_ARG_VALUE) return element ? element.value : undefined;
        if (arg === ACTION_ARG_TARGET) return element;
        if (arg === ACTION_ARG_EVENT) return event;
        return arg;
    });
}

function resolveActionCallable(actionPath) {
    const path = String(actionPath || '').trim();
    if (!path) return null;
    const parts = path.replace(/^window\./, '').split('.');
    let ctx = window;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        if (!ctx || !(part in ctx)) return null;
        ctx = ctx[part];
    }
    const fnName = parts[parts.length - 1];
    const fn = ctx ? ctx[fnName] : null;
    return typeof fn === 'function' ? { fn, ctx } : null;
}

function invokeDataAction(target, attrName, event) {
    if (!target) return;
    const actionName = target.getAttribute(attrName);
    if (!actionName) return;
    const args = hydrateActionArgs(parseDataActionArgs(target.getAttribute('data-action-args')), target, event);
    const actionRef = resolveActionCallable(actionName);
    if (!actionRef) {
        console.warn('[LifeOS] Missing action function for', actionName);
        return;
    }
    actionRef.fn.apply(actionRef.ctx, args);
}

function bindDataActionDelegation() {
    document.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        if (target.tagName === 'A') event.preventDefault();
        invokeDataAction(target, 'data-action', event);
    });

    document.addEventListener('change', (event) => {
        const target = event.target.closest('[data-action-change]');
        if (!target) return;
        invokeDataAction(target, 'data-action-change', event);
    });

    document.addEventListener('input', (event) => {
        const target = event.target.closest('[data-action-input]');
        if (!target) return;
        invokeDataAction(target, 'data-action-input', event);
    });
}

function getInlineStyleSheet() {
    if (inlineStyleSheetEl) return inlineStyleSheetEl;
    inlineStyleSheetEl = document.createElement('style');
    inlineStyleSheetEl.id = 'lifeos-inline-style-registry';
    document.head.appendChild(inlineStyleSheetEl);
    return inlineStyleSheetEl;
}

function hashStyleText(styleText) {
    let hash = 0;
    for (let i = 0; i < styleText.length; i += 1) {
        hash = ((hash << 5) - hash) + styleText.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function isAllowedInlineCustomPropertyStyle(styleText) {
    const declarations = String(styleText || '')
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (!declarations.length) return false;
    return declarations.every((declaration) => {
        const sep = declaration.indexOf(':');
        if (sep < 0) return false;
        const prop = declaration.slice(0, sep).trim();
        return INLINE_STYLE_CUSTOM_PROP_ALLOWLIST.has(prop);
    });
}

function getInlineStyleClassName(styleText) {
    if (inlineStyleClassRegistry.has(styleText)) {
        return inlineStyleClassRegistry.get(styleText);
    }
    const className = `ui-inline-${hashStyleText(styleText)}`;
    inlineStyleClassRegistry.set(styleText, className);
    const styleSheet = getInlineStyleSheet();
    styleSheet.textContent += `.${className}{${styleText}}\n`;
    return className;
}

function normalizeInlineStyles(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    const inlineStyled = [];
    if (scope instanceof Element && scope.hasAttribute && scope.hasAttribute('style')) {
        inlineStyled.push(scope);
    }
    if (scope.querySelectorAll) {
        inlineStyled.push(...scope.querySelectorAll('[style]'));
    }
    inlineStyled.forEach((element) => {
        const styleText = String(element.getAttribute('style') || '').trim();
        if (!styleText) return;
        if (isAllowedInlineCustomPropertyStyle(styleText)) return;
        const className = getInlineStyleClassName(styleText);
        element.classList.add(className);
        element.removeAttribute('style');
    });
}

function observeInlineStyles() {
    if (inlineStyleObserver || !document.body) return;
    inlineStyleObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) return;
                normalizeInlineStyles(node);
            });
        });
    });
    inlineStyleObserver.observe(document.body, { childList: true, subtree: true });
}

window.triggerFileDialog = function triggerFileDialog(inputId) {
    const fileInput = document.getElementById(String(inputId || ''));
    if (fileInput && typeof fileInput.click === 'function') {
        fileInput.click();
    }
};

window.handleVinylSpotifyAction = function handleVinylSpotifyAction(url) {
    const spotifyUrl = String(url || '').trim();
    if (spotifyUrl) {
        window.open(spotifyUrl, '_blank');
        return;
    }
    if (typeof window.promptSpotifyLink === 'function') {
        window.promptSpotifyLink();
    }
};

window.openJournalFeedAndCloseModal = function openJournalFeedAndCloseModal() {
    if (typeof window.openJournalFeed === 'function') {
        window.openJournalFeed();
    }
    if (typeof window.closeModal === 'function') {
        window.closeModal();
    }
};

function cloneDeep(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        return value;
    }
}

function getSettingsSnapshot() {
    if (window.Store && typeof Store.getSettings === 'function') {
        return Store.getSettings();
    }
    return {
        profile: { name: 'Guest User', avatar: 'G' },
        startup: { policy: 'remember-last', fixedMode: 'personal', allowUrlOverride: true, lastMode: 'personal' },
        modeVisibility: { personal: true, business: true, vision: true, ritual: true, library: true },
        density: { personal: 'full', business: 'full', vision: 'full', ritual: 'full', library: 'full' },
        dateTime: { weekStartsOn: 'monday', dateStyle: 'system', hourCycle: 'system' },
        accessibility: { reducedMotion: false, introAnimation: 'once-per-session' },
        visualizer: { mode: 'pro' },
        widgetVisibility: {}
    };
}

function getDateTimePrefs() {
    const settings = getSettingsSnapshot();
    const raw = settings && settings.dateTime ? settings.dateTime : {};
    return {
        weekStartsOn: raw.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
        dateStyle: ['system', 'iso', 'short', 'long'].includes(raw.dateStyle) ? raw.dateStyle : 'system',
        hourCycle: ['system', 'h12', 'h24'].includes(raw.hourCycle) ? raw.hourCycle : 'system'
    };
}

function getAccessibilityPrefs() {
    const settings = getSettingsSnapshot();
    const raw = settings && settings.accessibility ? settings.accessibility : {};
    return {
        reducedMotion: Boolean(raw.reducedMotion),
        introAnimation: raw.introAnimation === 'disabled' ? 'disabled' : 'once-per-session'
    };
}

function formatIsoDate(dateLike) {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (!Number.isFinite(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateBySettings(dateLike, purpose = 'generic') {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (!Number.isFinite(date.getTime())) return '';

    const prefs = getDateTimePrefs();
    const style = prefs.dateStyle;
    if (style === 'iso' && purpose !== 'month-label') {
        return formatIsoDate(date);
    }

    if (purpose === 'topbar-day') {
        return date.toLocaleDateString(undefined, { weekday: 'long' });
    }

    if (purpose === 'month-label') {
        if (style === 'short') {
            return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        }
        return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

    if (purpose === 'topbar-full') {
        if (style === 'short') {
            return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' });
        }
        if (style === 'long') {
            return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (purpose === 'month-day') {
        if (style === 'short') {
            return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
        }
        if (style === 'long') {
            return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    if (purpose === 'selected-day-title') {
        if (style === 'short') {
            return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    if (style === 'short') return date.toLocaleDateString(undefined, { dateStyle: 'short' });
    if (style === 'long') return date.toLocaleDateString(undefined, { dateStyle: 'full' });
    return date.toLocaleDateString();
}

function formatTimeBySettings(dateLike, opts = {}) {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (!Number.isFinite(date.getTime())) return '';
    const prefs = getDateTimePrefs();
    const options = { ...opts };
    if (prefs.hourCycle === 'h12') options.hour12 = true;
    if (prefs.hourCycle === 'h24') options.hour12 = false;
    return date.toLocaleTimeString([], options);
}

function formatEventTimeBySettings(dateLike, timeText) {
    const rawTime = String(timeText || '').trim();
    if (!rawTime) return '';
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    const isoDate = Number.isFinite(date.getTime()) ? formatIsoDate(date) : formatIsoDate(new Date());
    const parsed = new Date(`${isoDate}T${rawTime}`);
    if (!Number.isFinite(parsed.getTime())) return rawTime;
    return formatTimeBySettings(parsed, { hour: '2-digit', minute: '2-digit' });
}

function applyAccessibilitySettings(settingsInput = null) {
    const settings = settingsInput || getSettingsSnapshot();
    const accessibility = settings && settings.accessibility ? settings.accessibility : {};
    const reducedMotion = Boolean(accessibility.reducedMotion);
    const introDisabled = accessibility.introAnimation === 'disabled' || reducedMotion;

    document.documentElement.classList.toggle('settings-reduced-motion', reducedMotion);
    document.body.classList.toggle('settings-reduced-motion', reducedMotion);
    document.documentElement.classList.toggle('settings-intro-disabled', introDisabled);
    document.body.classList.toggle('settings-intro-disabled', introDisabled);

    if (introDisabled && document.documentElement.classList.contains('run-intro')) {
        document.documentElement.classList.remove('run-intro');
        try {
            sessionStorage.setItem('lifeOS_intro_shown', 'true');
        } catch (e) {
            console.warn('Could not persist intro skip flag', e);
        }
    }
}

function normalizeWidgetNameFromId(id) {
    return String(id || '')
        .replace(/-widget$/i, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getSettingsWidgetList() {
    const seen = new Set();
    const widgets = [];
    document.querySelectorAll('#dashboard .widget[id]').forEach((el) => {
        const id = String(el.id || '').trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        const titleEl = el.querySelector('.widget-title');
        const title = (titleEl && titleEl.textContent ? titleEl.textContent.trim() : '') || WIDGET_SETTINGS_LABELS[id] || normalizeWidgetNameFromId(id);
        widgets.push({ id, name: title });
    });
    return widgets;
}

function teardownSettingsModalPreviewOnClose(overlayInput = null) {
    const overlay = overlayInput || $('#modal-overlay');
    const modalType = overlay ? overlay.getAttribute('data-type') : null;
    if (modalType !== 'settings' || !globalSettingsModalState) return;

    if (!globalSettingsModalState.committed && globalSettingsModalState.initial) {
        try {
            if (window.Store && typeof Store.saveSettings === 'function') {
                Store.saveSettings(globalSettingsModalState.initial, { persist: false });
            }
            applyGlobalSettingsToUi(globalSettingsModalState.initial);
        } catch (e) {
            console.warn('Failed to restore Global Settings preview state', e);
        }
    }

    globalSettingsModalState = null;
}

function applyGlobalSettingsToUi(settingsInput, options = {}) {
    const settings = settingsInput || getSettingsSnapshot();

    if (window.ModeManager && typeof ModeManager.refreshModeVisibility === 'function') {
        ModeManager.refreshModeVisibility({
            enforceCurrentMode: true,
            persistStartupLastMode: false
        });
    }

    const currentMode = (window.ModeManager && typeof ModeManager.getMode === 'function')
        ? ModeManager.getMode()
        : 'personal';
    const modeDensity = settings && settings.density ? settings.density[currentMode] : 'full';

    applyAccessibilitySettings(settings);

    if (window.UIManager && typeof UIManager.setDensity === 'function') {
        UIManager.setDensity(modeDensity || 'full', { persist: false, silent: true });
        if (typeof UIManager.recalculate === 'function') UIManager.recalculate();
    }

    if (typeof setVisualizerMode === 'function' && settings && settings.visualizer) {
        setVisualizerMode(settings.visualizer.mode, { persist: false });
    }

    if (typeof initGreeting === 'function') initGreeting();
    if (typeof initTopBar === 'function') initTopBar();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof applyWidgetVisibility === 'function') applyWidgetVisibility();

    if (options.closeModalOnApply) {
        closeModal();
    }
}

function escapeHtml(value) {
    const raw = String(value || '');
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureVinylEditOpen(shouldOpen) {
    const widget = document.getElementById('ritual-vinyl');
    const display = document.getElementById('vinyl-display');
    const edit = document.getElementById('vinyl-edit-form');
    const actions = document.getElementById('vinyl-actions');
    if (!widget || !display || !edit) return;

    const isEditing = widget.classList.contains('editing');
    if (shouldOpen && !isEditing) {
        widget.classList.add('editing');
    } else if (!shouldOpen && isEditing) {
        widget.classList.remove('editing');
    }

    const nowEditing = widget.classList.contains('editing');
    display.style.display = nowEditing ? 'none' : 'flex';
    edit.style.display = nowEditing ? 'flex' : 'none';
    if (actions) actions.style.display = nowEditing ? 'none' : 'flex';
}

function setVinylSpotifyStatus(message, tone) {
    const statusEl = document.getElementById('vinyl-spotify-status');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.remove('is-success', 'is-warn', 'is-error');
    if (tone === 'success') statusEl.classList.add('is-success');
    if (tone === 'warn') statusEl.classList.add('is-warn');
    if (tone === 'error') statusEl.classList.add('is-error');
}

function setVinylSpotifyHint(message) {
    const hintEl = document.getElementById('vinyl-spotify-hint');
    if (!hintEl) return;
    hintEl.textContent = message || '';
}

function mapSpotifyError(error) {
    const code = error && error.code ? error.code : '';
    const message = error && error.message ? error.message : '';
    if (code === 'MUSIC_NETWORK_ERROR') return 'Network error while contacting iTunes.';
    if (code === 'MUSIC_API_ERROR') return message || 'iTunes request failed.';
    if (code === 'SPOTIFY_API_ERROR') return message || 'Music request failed.';
    return message || 'Music request failed.';
}

function renderVinylSpotifyResults(albums) {
    const listEl = document.getElementById('vinyl-spotify-results');
    if (!listEl) return;

    if (!albums || albums.length === 0) {
        listEl.innerHTML = '';
        return;
    }

    listEl.innerHTML = albums.map((album) => {
        const albumTitle = escapeHtml(album.name || 'Untitled Album');
        const artistText = escapeHtml((album.artists || []).join(', ') || 'Unknown Artist');
        const coverStyle = album.image ? `style="background-image:url('${escapeHtml(album.image)}')"` : '';
        return `
            <div class="vinyl-spotify-result">
                <div class="vinyl-spotify-result-cover" ${coverStyle}></div>
                <div class="vinyl-spotify-result-text">
                    <div class="vinyl-spotify-result-album">${albumTitle}</div>
                    <div class="vinyl-spotify-result-artist">${artistText}</div>
                </div>
                <button class="vinyl-spotify-result-use" data-action="applySpotifyAlbumToVinyl" data-action-args="'${album.id}'">Use</button>
            </div>
        `;
    }).join('');
}

window.updateVinylSpotifyUi = function () {
    const sourceRow = document.querySelector('.vinyl-spotify-config-row');
    const clientInput = document.getElementById('inp-vinyl-spotify-client-id');
    const connectBtn = document.getElementById('btn-vinyl-spotify-connect');
    const disconnectBtn = document.getElementById('btn-vinyl-spotify-disconnect');

    if (!window.SpotifyClient) {
        setVinylSpotifyStatus('Music search module is unavailable.', 'error');
        setVinylSpotifyHint('');
        if (sourceRow) sourceRow.style.display = 'none';
        if (clientInput) clientInput.style.display = 'none';
        if (connectBtn) connectBtn.style.display = 'none';
        if (disconnectBtn) disconnectBtn.style.display = 'none';
        return;
    }

    const serviceName = (typeof SpotifyClient.getServiceName === 'function') ? SpotifyClient.getServiceName() : 'spotify';
    if (serviceName === 'itunes') {
        if (sourceRow) sourceRow.style.display = 'flex';
        if (clientInput) clientInput.style.display = 'none';
        if (connectBtn) connectBtn.style.display = 'none';
        if (disconnectBtn) disconnectBtn.style.display = 'none';
        setVinylSpotifyStatus('iTunes search ready. No login required.', 'success');
        setVinylSpotifyHint('Paste an Apple Music/iTunes album URL or search by artist + album.');
        return;
    }

    if (!clientInput || !connectBtn || !disconnectBtn) return;

    const currentClientId = SpotifyClient.getClientId() || '';
    if (clientInput.value !== currentClientId) {
        clientInput.value = currentClientId;
    }

    const configured = SpotifyClient.isConfigured();
    const connected = SpotifyClient.isConnected();
    connectBtn.style.display = configured && !connected ? 'inline-flex' : 'none';
    disconnectBtn.style.display = connected ? 'inline-flex' : 'none';

    if (!configured) {
        setVinylSpotifyStatus('Spotify is not configured.', 'warn');
        setVinylSpotifyHint(`Redirect URI: ${SpotifyClient.getRedirectUri()}`);
        return;
    }

    setVinylSpotifyHint(`Redirect URI: ${SpotifyClient.getRedirectUri()}`);
    setVinylSpotifyStatus(connected ? 'Spotify connected. Search is ready.' : 'Spotify configured. Connect to enable search.', connected ? 'success' : 'warn');
};

window.saveSpotifyClientIdForVinyl = function () {
    if (!window.SpotifyClient) {
        setVinylSpotifyStatus('Music search module is unavailable.', 'error');
        return;
    }
    const serviceName = (typeof SpotifyClient.getServiceName === 'function') ? SpotifyClient.getServiceName() : 'spotify';
    if (serviceName === 'itunes') {
        window.updateVinylSpotifyUi();
        return;
    }
    const input = document.getElementById('inp-vinyl-spotify-client-id');
    const clientId = input ? input.value.trim() : '';
    SpotifyClient.setClientId(clientId);
    window.updateVinylSpotifyUi();
};

window.connectSpotifyForVinyl = async function () {
    if (!window.SpotifyClient) {
        setVinylSpotifyStatus('Music search module is unavailable.', 'error');
        return;
    }

    const serviceName = (typeof SpotifyClient.getServiceName === 'function') ? SpotifyClient.getServiceName() : 'spotify';
    if (serviceName === 'itunes') {
        setVinylSpotifyStatus('No login needed for iTunes search.', 'success');
        setVinylSpotifyHint('Search directly in the field below.');
        return;
    }

    window.saveSpotifyClientIdForVinyl();

    if (!SpotifyClient.isConfigured()) {
        setVinylSpotifyStatus('Add your Spotify Client ID to connect.', 'warn');
        return;
    }

    const queryInput = document.getElementById('inp-vinyl-bandcamp');
    const mode = (typeof ModeManager !== 'undefined' && typeof ModeManager.getMode === 'function') ? ModeManager.getMode() : 'ritual';
    const restoreSearch = queryInput ? queryInput.value.trim() : '';
    setVinylSpotifyStatus('Redirecting to Spotify authorization...', 'success');

    try {
        await SpotifyClient.connect({
            mode: mode,
            openVinylEdit: true,
            restoreSearch: restoreSearch,
            autoSearch: !!restoreSearch
        });
    } catch (error) {
        setVinylSpotifyStatus(mapSpotifyError(error), 'error');
    }
};

window.disconnectSpotifyForVinyl = function () {
    if (!window.SpotifyClient) return;
    const serviceName = (typeof SpotifyClient.getServiceName === 'function') ? SpotifyClient.getServiceName() : 'spotify';
    if (serviceName === 'itunes') {
        vinylSpotifySearchResults = [];
        renderVinylSpotifyResults(vinylSpotifySearchResults);
        setVinylSpotifyStatus('iTunes does not require a connected session.', 'warn');
        return;
    }
    SpotifyClient.disconnect();
    vinylSpotifySearchResults = [];
    renderVinylSpotifyResults(vinylSpotifySearchResults);
    setVinylSpotifyStatus('Spotify disconnected.', 'warn');
    window.updateVinylSpotifyUi();
};

window.applySpotifyAlbumToVinyl = async function (albumId) {
    let selectedAlbum = vinylSpotifySearchResults.find((album) => album.id === albumId);
    if (!selectedAlbum && window.SpotifyClient) {
        try {
            selectedAlbum = await SpotifyClient.getAlbumByUrlOrId(albumId);
        } catch (error) {
            setVinylSpotifyStatus(mapSpotifyError(error), 'error');
            return;
        }
    }
    if (!selectedAlbum) return;

    if (window.ListeningRoomWidget && typeof window.ListeningRoomWidget.applySearchAlbum === 'function') {
        window.ListeningRoomWidget.applySearchAlbum(selectedAlbum);
        renderRitualVinyl();
        setVinylSpotifyStatus('Album applied to Listening Room.', 'success');
        return;
    }

    const data = Store.getRitualVinyl();
    data.artist = (selectedAlbum.artists || []).join(', ');
    data.record = selectedAlbum.name || '';
    data.spotifyUrl = selectedAlbum.spotifyUrl || '';
    data.spotifyAlbumId = selectedAlbum.id || '';
    data.spotifyAlbumUri = selectedAlbum.uri || '';
    data.spotifyLastSyncedAt = new Date().toISOString();
    data.musicSource = (selectedAlbum.source || selectedAlbum.service || 'spotify');
    data.itunesCollectionId = selectedAlbum.id || '';
    data.itunesLastSyncedAt = new Date().toISOString();
    if (selectedAlbum.image) data.artwork = selectedAlbum.image;

    Store.saveRitualVinyl(data);
    renderRitualVinyl();
    const sourceLabel = data.musicSource === 'itunes' ? 'iTunes' : 'Spotify';
    setVinylSpotifyStatus(`Album applied from ${sourceLabel}.`, 'success');
};

window.addVinylToLibrary = function () {
    if (window.ListeningRoomWidget && typeof window.ListeningRoomWidget.saveVinylFromForm === 'function') {
        window.ListeningRoomWidget.saveVinylFromForm();
    }

    const artistInput = document.getElementById('inp-vinyl-artist');
    const albumInput = document.getElementById('inp-vinyl-album');
    const notesInput = document.getElementById('inp-vinyl-notes');
    const vinylData = Store.getRitualVinyl();

    const artist = (artistInput && artistInput.value ? artistInput.value.trim() : '') || String(vinylData.artist || '').trim();
    const record = (albumInput && albumInput.value ? albumInput.value.trim() : '') || String(vinylData.record || '').trim();
    const notes = (notesInput && notesInput.value ? notesInput.value.trim() : '') || String(vinylData.notes || '').trim();
    const artwork = String(vinylData.artwork || '').trim();

    if (!record) {
        setVinylSpotifyStatus('Set an album title first, then add it to Library.', 'warn');
        return;
    }

    if (!window.LibraryStorage || typeof window.LibraryStorage.upsertFromVinyl !== 'function') {
        setVinylSpotifyStatus('Library module is unavailable.', 'error');
        return;
    }

    const upsert = window.LibraryStorage.upsertFromVinyl({
        title: record,
        creator: artist || 'Unknown Artist',
        coverUrl: artwork,
        year: String(vinylData.year || '').trim(),
        notes: notes,
        createdAt: new Date().toISOString()
    });

    if (window.LibraryRenderer && typeof window.LibraryRenderer.refresh === 'function') {
        window.LibraryRenderer.refresh();
    }

    if (upsert.created) {
        setVinylSpotifyStatus('Album added to Library.', 'success');
    } else {
        setVinylSpotifyStatus('Album already exists in Library. Metadata refreshed.', 'success');
    }
};

/* ========================================
   CRITICAL UI HANDLERS (Top-loaded)
   ======================================== */
window.toggleVinylEdit = function () {
    console.log('[Vinyl] toggleVinylEdit START');
    const widget = document.getElementById('ritual-vinyl');
    const display = document.getElementById('vinyl-display');
    const edit = document.getElementById('vinyl-edit-form');
    const actions = document.getElementById('vinyl-actions');

    if (!widget || !display || !edit) {
        console.error('[Vinyl] toggleVinylEdit failed: elements missing');
        return;
    }

    const isNowEditing = widget.classList.toggle('editing');
    console.log('[Vinyl] New editing state:', isNowEditing);

    display.style.display = isNowEditing ? 'none' : 'flex';
    edit.style.display = isNowEditing ? 'flex' : 'none';
    if (actions) actions.style.display = isNowEditing ? 'none' : 'flex';
    if (isNowEditing && typeof window.updateVinylSpotifyUi === 'function') {
        window.updateVinylSpotifyUi();
    }
    console.log('[Vinyl] toggleVinylEdit END');
};

window.openVinylRitual = function () {
    if (window.ListeningRoomWidget && typeof window.ListeningRoomWidget.open === 'function') {
        window.ListeningRoomWidget.open();
        return;
    }

    console.log('[Vinyl] openVinylRitual called!');
    const data = Store.getRitualVinyl();
    const overlay = document.createElement('div');
    overlay.className = 'vinyl-ritual-overlay';
    overlay.id = 'vinyl-ritual-overlay';

    overlay.innerHTML = `
        <button class="vinyl-overlay-close" data-action="window.closeVinylRitual" data-action-args="">&times;</button>
        <div class="vinyl-overlay-content">
            <div class="vinyl-visualization">
                <div class="vinyl-disc"></div>
                <div class="vinyl-overlay-artwork" style="background-image: url('${data.artwork}')"></div>
            </div>
            <div class="vinyl-overlay-text">
                <div class="vinyl-overlay-artist">${data.artist || 'Unknown Artist'}</div>
                <div class="vinyl-overlay-album">${data.record || 'Untitled Album'}</div>
                <div class="vinyl-overlay-notes">${data.notes || ''}</div>
                <div class="vinyl-overlay-actions">
                    <button class="vinyl-ghost-btn" style="padding: 12px 30px; background: rgba(255,255,255,0.08)" data-action="handleVinylSpotifyAction" data-action-args="'${data.spotifyUrl}'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.508 17.307c-.222.363-.694.475-1.055.253-2.824-1.725-6.377-2.114-10.564-1.158-.414.094-.83-.163-.925-.577-.094-.414.163-.83.577-.925 4.582-1.047 8.528-.606 11.714 1.341.361.222.473.694.253 1.066zm1.47-3.253c-.278.452-.87.596-1.32.321-3.232-1.987-8.158-2.564-11.978-1.404-.51.155-1.05-.138-1.205-.648-.155-.51.138-1.05.648-1.205 4.37-1.325 9.79-.675 13.535 1.625.45.275.596.87.32 1.32zm.126-3.41c-3.875-2.301-10.276-2.513-14-1.383-.594.18-1.223-.153-1.403-.747-.18-.594.153-1.223.747-1.403 4.275-1.297 11.343-1.046 15.825 1.613.535.317.71 1.01.393 1.545-.317.535-1.01.71-1.545.393z"/></svg>
                        Open Link
                    </button>
                    <button class="vinyl-ghost-btn" style="padding: 12px 30px" data-action="window.closeVinylRitual" data-action-args="">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            window.closeVinylRitual();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
};

window.closeVinylRitual = function () {
    if (window.ListeningRoomWidget && typeof window.ListeningRoomWidget.close === 'function') {
        window.ListeningRoomWidget.close();
        return;
    }

    const overlay = document.getElementById('vinyl-ritual-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 400);
};

window.promptSpotifyLink = function () {
    const link = prompt('Enter Apple embed URL or Apple Music album URL:');
    if (link) {
        const data = Store.getRitualVinyl();
        const trimmed = String(link).trim();
        data.spotifyUrl = trimmed;
        if (trimmed.includes('embed.music.apple.com')) {
            data.appleMusicEmbedUrl = trimmed;
        } else {
            try {
                const parsed = new URL(trimmed);
                const parts = parsed.pathname.split('/').filter(Boolean);
                const storefront = parts[0] || 'us';
                const type = parts[1] || 'album';
                const idMatch = trimmed.match(/id(\d{5,})/i);
                if (idMatch) {
                    data.appleMusic = {
                        type: type === 'playlist' || type === 'song' ? type : 'album',
                        id: idMatch[1],
                        storefront: storefront
                    };
                }
            } catch (error) {
                // Keep manual URL only when parsing fails.
            }
        }
        Store.saveRitualVinyl(data);
        renderRitualVinyl();
        window.open(trimmed, '_blank');
    }
};

window.handleVinylArtwork = function (input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = Store.getRitualVinyl();
        data.artwork = e.target.result;
        Store.saveRitualVinyl(data);
        renderRitualVinyl();
    };
    reader.readAsDataURL(file);
};

window.fetchBandcampData = async function () {
    const input = document.getElementById('inp-vinyl-bandcamp');
    const query = input ? input.value.trim() : '';
    if (!query) {
        setVinylSpotifyStatus('Enter an artist + album query or an Apple Music/iTunes album URL.', 'warn');
        return;
    }

    if (!window.SpotifyClient) {
        setVinylSpotifyStatus('Music search module is unavailable.', 'error');
        return;
    }

    const btn = document.getElementById('btn-fetch-bandcamp');
    if (btn) {
        btn.textContent = 'Searching...';
        btn.disabled = true;
    }

    try {
        let results = [];
        const directAlbum = await SpotifyClient.getAlbumByUrlOrId(query);
        if (directAlbum) {
            results = [directAlbum];
        } else {
            results = await SpotifyClient.searchAlbums(query, 8);
        }

        vinylSpotifySearchResults = results;
        renderVinylSpotifyResults(vinylSpotifySearchResults);

        if (results.length === 0) {
            setVinylSpotifyStatus('No albums found for that search.', 'warn');
        } else if (directAlbum) {
            setVinylSpotifyStatus('Album found. Click Use to apply it.', 'success');
        } else {
            setVinylSpotifyStatus(`Found ${results.length} album result${results.length === 1 ? '' : 's'}.`, 'success');
        }
    } catch (e) {
        console.error('[Music] Album search failed:', e);
        setVinylSpotifyStatus(mapSpotifyError(e), 'error');
    } finally {
        if (btn) {
            btn.textContent = 'Search';
            btn.disabled = false;
        }
    }
};

window.saveVinylWidget = function () {
    console.log('[Vinyl] saveVinylWidget called');
    try {
        if (window.ListeningRoomWidget && typeof window.ListeningRoomWidget.saveVinylFromForm === 'function') {
            window.ListeningRoomWidget.saveVinylFromForm();
            renderRitualVinyl();
            window.toggleVinylEdit();
            return;
        }

        const elArtist = document.getElementById('inp-vinyl-artist');
        const elAlbum = document.getElementById('inp-vinyl-album');
        const elNotes = document.getElementById('inp-vinyl-notes');
        const elPreview = document.getElementById('vinyl-artwork-preview');

        if (!elArtist || !elAlbum || !elNotes) {
            console.error('[Vinyl] Save failed: Input elements missing');
            return;
        }

        const artist = elArtist.value;
        const album = elAlbum.value;
        const notes = elNotes.value;
        const pendingArtwork = elPreview ? elPreview.dataset.pendingArtwork : null;

        console.log('[Vinyl] Saving data:', { artist, album, notes, hasPendingArtwork: !!pendingArtwork });

        if (typeof Store === 'undefined') {
            console.error('[Vinyl] Save failed: Store is undefined');
            return;
        }

        const data = Store.getRitualVinyl();
        data.artist = artist;
        data.record = album;
        data.notes = notes;
        if (pendingArtwork) {
            data.artwork = pendingArtwork;
            delete elPreview.dataset.pendingArtwork;
        }

        Store.saveRitualVinyl(data);
        console.log('[Vinyl] Data saved to Store');

        if (typeof renderRitualVinyl === 'function') {
            renderRitualVinyl();
        }

        console.log('[Vinyl] Calling toggleVinylEdit to close form');
        window.toggleVinylEdit();
    } catch (err) {
        console.error('[Vinyl] saveVinylWidget CRASHED:', err);
    }
};

/* ========================================
   GLOBAL MODE TOGGLES & HELPERS
   ======================================== */

// ---- Global Reset Helpers for Widgets ----
window.resetWalkLog = function () {
    try {
        if (confirm('Clear all saved walk entries?')) {
            if (typeof Store.clearWalkLogEntries === 'function') {
                Store.clearWalkLogEntries();
            } else {
                Store.resetRitualWalkLog();
            }

            // Force immediate UI refresh
            if (typeof renderRitualWalkLog === 'function') {
                renderRitualWalkLog();
            } else if (typeof renderRitualWidgets === 'function') {
                renderRitualWidgets();
            }

            if (typeof window.closeModal === 'function') {
                window.closeModal();
            } else if (typeof closeModal === 'function') {
                closeModal();
            }
        }
    } catch (err) {
        console.error('[LifeOS] Error in resetWalkLog:', err);
        alert('Failed to reset walk log: ' + err.message);
    }
};

window.toggleZenMode = function () {
    console.log('[LifeOS] Toggling Zen Mode...');
    const btn = document.getElementById('btn-zen-mode');
    const isActive = document.body.classList.toggle('zen-active');

    if (btn) {
        if (isActive) btn.classList.add('active');
        else btn.classList.remove('active');
    }

    if (isActive) {
        if (typeof startFocusTimer === 'function') startFocusTimer();
    } else {
        if (typeof stopFocusTimer === 'function') stopFocusTimer();
    }
};

window.toggleCandleMode = function () {
    console.log('[LifeOS] Toggling Candle Mode...');
    const existing = document.getElementById('candle-overlay');
    if (existing) {
        console.log('[LifeOS] Exiting Candle Mode');
        existing.classList.add('candle-exiting');
        document.body.classList.remove('candle-mode-active');
        const btn = document.getElementById('ritual-candle-btn');
        if (btn) btn.classList.remove('active');
        setTimeout(() => existing.remove(), 800);
        localStorage.setItem('lifeOS.ritual.candleMode', 'false');
        if (window._candleTimer) clearInterval(window._candleTimer);
        return;
    }

    document.body.classList.add('candle-mode-active');
    const btn = document.getElementById('ritual-candle-btn');
    if (btn) btn.classList.add('active');

    const overlay = document.createElement('div');
    overlay.id = 'candle-overlay';
    overlay.innerHTML = `
        <div class="candle-scene">
            <div class="candle-orb candle-orb-1"></div>
            <div class="candle-orb candle-orb-2"></div>
            <div class="candle-orb candle-orb-3"></div>
            <div class="candle-orb candle-orb-4"></div>
            <div class="candle-orb candle-orb-5"></div>
            <div class="candle-glow"></div>
        </div>
        <div class="candle-quote" id="candle-quote"></div>
        <div class="candle-timer" id="candle-timer" style="opacity:0; pointer-events:none">10:00</div>
        <button class="candle-exit" data-action="toggleCandleMode" data-action-args="">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const quotes = [
        "Breathe in stillness.", "You are already whole.", "Let the mind rest.", "Nothing needs to be fixed right now.", "Feel the weight of your body.",
        "Slow is the way.", "This moment is enough.", "Let go of what doesn't serve you.", "Be here. Just here.", "The candle burns for you.",
        "Soft eyes, open heart.", "Release the tension in your jaw.", "Radiate quiet confidence.", "Patience is a sacred practice.", "Trust the unfolding.",
        "Deep peace of the running wave to you.", "Deep peace of the quiet earth to you.", "Let your thoughts pass like clouds.", "Sink into the silence.", "The breath is your anchor.",
        "Gentle heart, clear mind.", "Observe without judgment.", "Your presence is a gift.", "Embrace the rhythm of now.", "Harmony is within you.",
        "Allow yourself to simply be.", "Flow with the current of life.", "Nurture your inner light.", "Kindness starts within.", "Space is where growth happens.",
        "Quiet the noise, hear the truth.", "You are the sky, not the weather.", "Rooted like a tree, reaching for light.", "Celebrate the small stillness.", "Awaken to the beauty of this breath.",
        "Everything you need is already here.", "Speak to yourself with love.", "Balance is a dynamic dance.", "Find the center in the chaos.", "Inhale courage, exhale fear.",
        "Gratitude is the memory of the heart.", "Listen to the whispers of your soul.", "Strength is found in softness.", "Boundless peace, infinite light.", "Cherish the emptiness between thoughts.",
        "A quiet mind sees clearly.", "Let the earth carry your weight.", "The soul knows the way.", "Breathe light into every cell.", "One breath at a time, you are home."
    ];

    let quoteIndex = -1;
    const quoteEl = document.getElementById('candle-quote');

    // Breathing Transition Logic: Slow Fade In -> Rest -> Slow Fade Out -> Pause
    async function rotateQuotes() {
        if (!document.getElementById('candle-overlay')) return;

        quoteIndex = (quoteIndex + 1) % quotes.length;
        if (quoteEl) {
            // Fade Out
            quoteEl.style.transition = 'opacity 5s ease-in-out';
            quoteEl.style.opacity = '0';
            await new Promise(r => setTimeout(r, 6000)); // Pause in emptiness

            if (!document.getElementById('candle-overlay')) return;

            // Change Text & Fade In
            quoteEl.textContent = quotes[quoteIndex];
            quoteEl.style.opacity = '1';
            await new Promise(r => setTimeout(r, 12000)); // Stay visible (The "Rest")

            if (!document.getElementById('candle-overlay')) return;

            rotateQuotes();
        }
    }

    // Initial sequence
    if (quoteEl) quoteEl.style.opacity = '0';
    setTimeout(rotateQuotes, 1000);

    let remaining = 600;
    const timerEl = document.getElementById('candle-timer');
    window._candleTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(window._candleTimer);
            toggleCandleMode();
            return;
        }
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        if (timerEl) timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);

    localStorage.setItem('lifeOS.ritual.candleMode', 'true');
};

window.logWalk = function (type) {
    try {
        if (window.WalkUI && typeof window.WalkUI.quickLogFromLegacy === 'function') {
            window.WalkUI.quickLogFromLegacy(type);
        } else {
            Store.logRitualWalk(type);
        }
        if (typeof renderRitualWalkLog === 'function') renderRitualWalkLog();
    } catch (e) {
        console.error('[LifeOS] Error logging walk:', e);
    }
};

function animateNumber(el, target, suffix = '', duration = 1200) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
        const value = Math.round(start + (target - start) * eased);
        el.textContent = value.toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function animateFloat(el, target, decimals = 1, suffix = '', duration = 1200) {
    if (!el) return;
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = (target * eased).toFixed(decimals);
        el.textContent = value + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}


// ---- Greeting & Profile ----

// Helpers for modal interactivity
function deleteEvent(idx) {
    const events = Store.getEvents();
    events.splice(idx, 1);
    Store.saveEvents(events);
    initCalendar();
    openEditModal('calendar');
}

function addNewEvent() {
    const time = $('#new-ev-time').value.trim();
    const name = $('#new-ev-name').value.trim();
    if (time && name) {
        const events = Store.getEvents();
        events.push({ time, name, type: 'manual' });
        Store.saveEvents(events);
        initCalendar();
        openEditModal('calendar');
    }
}

window.deleteEvent = deleteEvent;
window.addNewEvent = addNewEvent;

async function initGreeting() {
    const profile = Store.getProfile();
    const v2 = Store.getV2Data();

    const hour = new Date().getHours();
    let greet = 'HI';
    if (hour < 12) greet = 'GOOD MORNING';
    else if (hour < 17) greet = 'GOOD AFTERNOON';
    else greet = 'GOOD EVENING';

    const nameEl = $('#greeting-text');
    if (nameEl) nameEl.innerHTML = `<strong>${greet}, ${profile.name.toUpperCase()}</strong>`;

    // Intention line from North Star
    const intentEl = $('#greeting-intention');
    if (intentEl && v2.northStar) {
        intentEl.textContent = v2.northStar.intention || '';
    }
}


// ---- Top Bar ----

let liveSystemSyncInitialized = false;
let liveSystemRefreshRaf = null;
let liveSystemUnsubscribe = null;

function readStoreStateSafe(getterName, forceRecompute = false) {
    if (!window.Store || typeof Store[getterName] !== 'function') return null;
    try {
        return Store[getterName](forceRecompute);
    } catch (e) {
        console.warn(`${getterName} read skipped:`, e);
        return null;
    }
}

function getCognitiveStateSafe(forceRecompute = false) {
    return readStoreStateSafe('getCognitiveState', forceRecompute);
}

function getSystemStateSafe(forceRecompute = false) {
    return readStoreStateSafe('getSystemState', forceRecompute);
}

function getTimeStateSafe(forceRecompute = false) {
    return readStoreStateSafe('getTimeState', forceRecompute);
}

function getAttentionStateSafe(forceRecompute = false) {
    return readStoreStateSafe('getAttentionState', forceRecompute);
}

function getAlignmentStateSafe(forceRecompute = false) {
    return readStoreStateSafe('getAlignmentState', forceRecompute);
}

function getRelationshipStateSafe(forceRecompute = false) {
    return readStoreStateSafe('getRelationshipState', forceRecompute);
}

function getCreativePhaseStateSafe(forceRecompute = false) {
    return readStoreStateSafe('getCreativePhaseState', forceRecompute);
}

function getNarrativeStateSafe(forceRecompute = false) {
    return readStoreStateSafe('getNarrativeState', forceRecompute);
}

function formatPercent01(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0%';
    return `${Math.round(Math.min(1, Math.max(0, num)) * 100)}%`;
}

function scheduleLiveSystemRefresh() {
    if (liveSystemRefreshRaf != null) return;
    liveSystemRefreshRaf = requestAnimationFrame(() => {
        liveSystemRefreshRaf = null;
        try {
            if ($('#topbar')) renderDerivedTopBarPulse();
            if ($('#creative-compass-container')) renderCreativeCompass();
            if ($('#north-star')) renderNorthStar();
            if ($('#weekly-reflection')) renderReflection();
            if ($('#people-list')) renderPeople();
            if ($('#habits-list-dashboard')) renderDailyRhythm();
            if ($('#system-health-bars')) renderSystemHealth();
        } catch (e) {
            console.warn('Live system refresh skipped:', e);
        }
    });
}

function initLiveSystemSync() {
    if (liveSystemSyncInitialized) return;
    liveSystemSyncInitialized = true;

    if (window.Store && typeof Store.subscribe === 'function') {
        liveSystemUnsubscribe = Store.subscribe(() => {
            scheduleLiveSystemRefresh();
        });
    }

    window.addEventListener('storage', () => {
        scheduleLiveSystemRefresh();
    });
}

function renderDerivedTopBarPulse() {
    const topbar = $('#topbar');
    if (!topbar || !window.Store || typeof Store.getDerivedState !== 'function') return;

    const versionTag = topbar.querySelector('.version-tag');
    if (!versionTag) return;

    if (!versionTag.dataset.baseLabel) {
        versionTag.dataset.baseLabel = versionTag.textContent.trim();
    }
    const baseLabel = versionTag.dataset.baseLabel || APP_VERSION_LABEL;

    try {
        const derived = Store.getDerivedState();
        const pulse = derived && derived.metrics ? derived.metrics.lifePulse : null;
        const cognitive = getCognitiveStateSafe();
        const systemState = getSystemStateSafe();
        const systemMode = systemState && systemState.systemMode
            ? systemState.systemMode
            : (cognitive && cognitive.states ? cognitive.states.systemMode : null);
        const details = [];
        if (systemMode) details.push(`MODE ${systemMode}`);
        if (systemState && Number.isFinite(systemState.overallRisk)) {
            details.push(`RISK ${formatPercent01(systemState.overallRisk)}`);
        } else if (Number.isFinite(pulse)) {
            details.push(`PULSE ${pulse}`);
        }
        versionTag.textContent = details.length ? `${baseLabel} · ${details.join(' · ')}` : baseLabel;
    } catch (e) {
        console.warn('Top bar pulse sync skipped:', e);
        versionTag.textContent = baseLabel;
    }
}

function initTopBar() {
    const now = new Date();

    const dayNameEl = $('#day-name');
    if (dayNameEl) dayNameEl.textContent = formatDateBySettings(now, 'topbar-day');

    const fullDateEl = $('#full-date');
    if (fullDateEl) fullDateEl.textContent = formatDateBySettings(now, 'topbar-full');

    renderSeasons(); // Added: Update season display
    renderDerivedTopBarPulse(); // Read-only LifeGraph integration example
}


// ---- Journal Widget ----

function initJournal() {
    const area = $('#journal-area');

    if (area) {
        // Quick add on Enter (Shift+Enter for newline)
        area.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = area.value.trim();
                if (text) {
                    Store.addJournalEntry(text);
                    area.value = '';
                    area.placeholder = "Saved to Journal!";
                    setTimeout(() => area.placeholder = "What's on your mind today?", 2000);
                }
            }
        });
    }
}


// ---- Focus Timer & Mood ----

const FocusTimer = {
    timeLeft: 25 * 60,
    targetTime: 25 * 60,
    isRunning: false,
    interval: null,

    init() {
        this.display = $('#timer-display');
        this.progressRing = $('#timer-progress');
        this.toggleBtn = $('#timer-toggle');
        this.resetBtn = $('#timer-reset');
        this.widget = $('.widget-creative-pulse');
        this.toggleIcon = $('#toggle-icon-path');
        this.selectedProjectIndex = 0; // Default to first project

        if (!this.display) return;

        // Load total focus
        // this.updateTotalDisplay(); // Removed per user request

        // Presets
        $$('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setSession(parseInt(btn.dataset.time));
            });
        });

        // Controls
        this.toggleBtn.addEventListener('click', () => this.toggle());
        this.resetBtn.addEventListener('click', () => this.reset());

        // Notifications
        if (Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    },

    toggle() {
        if (this.isRunning) this.pause();
        else this.start();
    },

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.toggleBtn.classList.add('pumping');
        if (this.widget) this.widget.classList.add('focus-active');
        this.render(); // force update icon/state
        this.interval = setInterval(() => this.tick(), 1000);
    },

    pause() {
        this.isRunning = false;
        this.toggleBtn.classList.remove('pumping');
        if (this.widget) this.widget.classList.remove('focus-active');
        this.render();
        clearInterval(this.interval);
    },

    reset() {
        this.pause();
        const activePreset = $('.preset-btn.active');
        const min = activePreset ? parseInt(activePreset.dataset.time) : 25;
        this.setSession(min);
    },

    setSession(minutes) {
        this.pause();
        this.targetTime = minutes * 60;
        this.timeLeft = this.targetTime;
        this.render();
    },

    tick() {
        if (this.timeLeft > 0) {
            this.timeLeft--;
            this.render();
        } else {
            this.complete();
        }
    },

    render() {
        if (!this.display) return;
        const m = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
        const s = (this.timeLeft % 60).toString().padStart(2, '0');
        this.display.textContent = `${m}:${s}`;

        // Update Ring (Using pathLength="1" logic)
        const pct = this.timeLeft / this.targetTime;
        if (this.progressRing) {
            this.progressRing.style.strokeDasharray = "1";
            this.progressRing.style.strokeDashoffset = (1 - pct);
        }

        // Update Toggle Icon
        if (this.toggleIcon) {
            this.toggleIcon.setAttribute('d', this.isRunning ? "M6 19h4V5H6v14zm8-14v14h4V5h-4z" : "M8 5v14l11-7z");
        }
    },

    complete() {
        this.pause();
        new Notification("Focus Session Complete!", {
            body: "Great job! Take a short break.",
            icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>\uD83C\uDF3F</text></svg>"
        });

        // Log to selected project
        const v2 = Store.getV2Data();
        const world = v2.creativePulse.worlds[this.selectedProjectIndex];
        if (world) {
            Store.logFocusSession(world.name, this.targetTime);
        }

        // Add to daily total
        this.addToTotal(this.targetTime);
        this.reset();
        initCreativePulse(); // Refresh progress bars
    },

    addToTotal(seconds) {
        const key = 'lifeos-focus-total';
        const today = new Date().toDateString();
        let data = JSON.parse(localStorage.getItem(key) || '{}');

        if (data.date !== today) {
            data = { date: today, seconds: 0 };
        }

        data.seconds += seconds;
        this.updateTotalDisplay();
    },

    updateTotalDisplay() {
        if (!this.totalDisplay) return;
        const key = 'lifeos-focus-total';
        const today = new Date().toDateString();
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        const totalSec = (data.date === today) ? data.seconds : 0;

        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        this.totalDisplay.textContent = `${h}h ${m}m`;
    }
};

function initFocusTimer() {
    FocusTimer.init();
}

// ---- Sport ----

function initSport() {
    const data = Store.getFitness();
    renderSport(data);
}

function renderSport(data) {
    const { movePercent, exercisePercent, standPercent, caloriesBurned, steps, activeMinutes, distanceKm, workoutsDone, streakDays } = data;

    // Animate rings
    setTimeout(() => {
        const standCirc = 2 * Math.PI * 52;
        const exCirc = 2 * Math.PI * 42;
        const moveCirc = 2 * Math.PI * 32;

        const rStand = $('#ring-stand');
        const rEx = $('#ring-exercise');
        const rMove = $('#ring-move');

        if (rStand) rStand.style.strokeDashoffset = standCirc * (1 - standPercent);
        if (rEx) rEx.style.strokeDashoffset = exCirc * (1 - exercisePercent);
        if (rMove) rMove.style.strokeDashoffset = moveCirc * (1 - movePercent);
    }, 400);

    // Animate numbers
    setTimeout(() => {
        animateNumber($('#cal-burned'), caloriesBurned);
        animateNumber($('#steps-count'), steps);
        animateNumber($('#active-min'), activeMinutes);
        animateFloat($('#distance-km'), distanceKm, 1);
        animateNumber($('#workouts-done'), workoutsDone);
    }, 500);

    const streakEl = $('#streak-text');
    if (streakEl) streakEl.textContent = `${streakDays} day streak`;
}

// ---- Unified Finance Overview ----

function initFinanceOverview() {
    const fin = Store.getFinance();
    const v2 = Store.getV2Data().financialReality;

    // Balance
    const balEl = $('#fo-balance');
    if (balEl) balEl.textContent = `${fin.balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}\u20ac`;

    // Flow
    const incEl = $('#fo-income');
    const expEl = $('#fo-expense');
    if (incEl) incEl.textContent = `+\u20ac${fin.monthlyIncome}`;
    if (expEl) expEl.textContent = `-\u20ac${fin.monthlyExpenses}`;

    // Stats from V2
    const debtEl = $('#fo-debt');
    const runEl = $('#fo-runway');
    const runStatusEl = $('#fo-runway-status');
    const targetEl = $('#fo-target');
    if (debtEl) debtEl.textContent = `\u20ac${v2.debtLeft.toLocaleString()}`;
    if (runEl) {
        runEl.textContent = `${v2.runwayMonths} mo`;

        // Proposal 3: Runway Visualizer
        const runwayContainer = $('#runway-visualizer-container');
        if (runwayContainer) {
            const status = v2.runwayMonths >= 6 ? 'safe' : (v2.runwayMonths >= 3 ? 'warning' : 'danger');
            const pct = Math.min((v2.runwayMonths / 12) * 100, 100); // 12 months as 100%
            runwayContainer.innerHTML = `
                <div class="runway-bar-bg">
                    <div class="runway-bar-fill ${status}" style="width: ${pct}%"></div>
                </div>
            `;
        }

        if (runStatusEl) {
            runStatusEl.className = 'runway-status'; // reset
            if (v2.runwayMonths >= 6) runStatusEl.classList.add('safe');
            else if (v2.runwayMonths >= 3) runStatusEl.classList.add('warning');
            else runStatusEl.classList.add('danger');
        }
    }
    if (targetEl) targetEl.textContent = `\u20ac${v2.monthlyIncome.toLocaleString()} / \u20ac${v2.monthlyTarget.toLocaleString()}`;

    // Lightweight insight
    const insightEl = $('#fo-insight');
    if (insightEl && v2.debtLeft > 0 && fin.monthlyIncome > fin.monthlyExpenses) {
        const surplus = fin.monthlyIncome - fin.monthlyExpenses;
        const monthsToFree = Math.ceil(v2.debtLeft / surplus);
        const freeDate = new Date();
        freeDate.setMonth(freeDate.getMonth() + monthsToFree);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        insightEl.textContent = `At this pace, debt-free by ~${months[freeDate.getMonth()]} ${freeDate.getFullYear()}`;
    } else if (insightEl) {
        insightEl.textContent = '';
    }
}

// ---- Goals ---- 

// Legacy renderGoalsAndHabits removed. Replaced by renderGoals and renderDailyRhythm.

// Helper: Toggle and re-render
window.toggleHabitWrapper = function (id) {
    Store.toggleHabit(id);
    renderDailyRhythm();
};

window.updateGoalProgress = function (id, delta) {
    const goals = Store.getGoals();
    const goal = goals.find(g => g.id === id);
    if (!goal) return;

    let newProg = Math.max(0, Math.min(100, (goal.progress || 0) + delta));
    Store.updateGoal(id, { progress: newProg });
    renderGoals();
};

window.editGoalProgress = function (id, current) {
    const newVal = prompt("Enter progress % (0-100):", current);
    if (newVal !== null && !isNaN(newVal)) {
        let val = parseInt(newVal);
        val = Math.max(0, Math.min(100, val));
        Store.updateGoal(id, { progress: val });
        renderGoals();
    }
};

function getCategoryColor(cat) {
    const colors = {
        fitness: '#ff8a8a',
        finance: '#ffd700',
        growth: '#a8e6cf',
        mindfulness: '#a0c4ff',
        health: '#ffb3c6',
        work: '#ffffff'
    };
    return colors[cat?.toLowerCase()] || '#a8e6cf';
}

// ---- Calendar (Monthly) ----
let calViewDate = new Date();
let calSelectedDate = new Date().toISOString().split('T')[0];

function renderCalendar() {
    renderMonthGrid();
    renderEvents(calSelectedDate);
}

function renderMonthGrid() {
    const grid = $('#month-grid');
    const label = $('#cal-month-label');
    if (!grid || !label) return;

    const prefs = getDateTimePrefs();
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    label.textContent = formatDateBySettings(new Date(year, month, 1), 'month-label');

    // Clear grid but keep headers (assuming headers are pre-existing in HTML or we add them now)
    const headerNames = prefs.weekStartsOn === 'sunday'
        ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
        : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const headers = headerNames.map((name) => `<span class="mg-day-header">${name}</span>`).join('');

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    const events = Store.getEvents();

    // Calendar offset based on settings (monday/sunday start).
    let startDay = firstDay.getDay();
    if (prefs.weekStartsOn === 'monday') {
        startDay = startDay === 0 ? 6 : startDay - 1;
    }
    const days = [];

    // Fill leading days from previous month
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        const d = new Date(year, month - 1, prevLastDay - i);
        const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const eventsOnDay = events.filter(e => e.date === dateString);
        let energyStyle = '';
        if (eventsOnDay.length > 0) {
            const opacity = Math.min(eventsOnDay.length * 0.15, 0.4);
            energyStyle = `background: rgba(168, 230, 207, ${opacity})`;
        }
        const dotIndicator = eventsOnDay.length > 0 ? '<span class="day-dot-indicator"></span>' : '';
        days.push(`
            <div class="mg-day other-month" 
                 data-action="selectCalendarDay" data-action-args="'${dateString}'"
                 style="${energyStyle}">
                ${d.getDate()}
                ${dotIndicator}
            </div>
        `);
    }

    // Current month days
    const dailyArchive = Store.getDailyArchive();

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const currentDayDate = new Date(year, month, d);
        const isToday = currentDayDate.getDate() === today.getDate() && currentDayDate.getMonth() === today.getMonth() && currentDayDate.getFullYear() === today.getFullYear();
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const eventsOnDay = events.filter(e => e.date === dateString);
        const dayClass = isToday ? 'mg-day today' : 'mg-day';
        const selectedClass = dateString === calSelectedDate ? 'selected' : '';
        const hasArchiveData = !!dailyArchive[dateString];

        // Heatmap: archive completion takes priority, then events
        let energyStyle = '';
        if (hasArchiveData) {
            const pct = dailyArchive[dateString].rhythm.completionPct || 0;
            const opacity = Math.min(pct / 100 * 0.5, 0.5);
            energyStyle = `background: rgba(168, 230, 207, ${opacity})`;
        } else if (eventsOnDay.length > 0) {
            const opacity = Math.min(eventsOnDay.length * 0.15, 0.4);
            energyStyle = `background: rgba(168, 230, 207, ${opacity})`;
        }

        // Dot: archive = accent dot, events-only = small dot
        let dotIndicator = '';
        if (hasArchiveData) {
            dotIndicator = '<span class="day-dot-indicator archive-dot"></span>';
        } else if (eventsOnDay.length > 0) {
            dotIndicator = '<span class="day-dot-indicator"></span>';
        }

        days.push(`
            <div class="${dayClass} ${selectedClass}" 
                 data-action="selectCalendarDay" data-action-args="'${dateString}'"
                 style="${energyStyle}">
                ${d}
                ${dotIndicator}
            </div>
        `);
    }

    // Fill trailing days
    const totalCells = startDay + lastDay.getDate();
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
        days.push(`<span class="mg-day other-month">${d}</span>`);
    }

    grid.innerHTML = headers + days.join('');
}

// renderEvents and selectCalendarDay are defined after DOMContentLoaded (archive-aware versions)

function initCalendar() {
    renderCalendar();

    const prevBtn = $('#cal-prev');
    const nextBtn = $('#cal-next');
    if (prevBtn) prevBtn.addEventListener('click', () => {
        calViewDate.setMonth(calViewDate.getMonth() - 1);
        renderCalendar();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        calViewDate.setMonth(calViewDate.getMonth() + 1);
        renderCalendar();
    });
}

// ---- V2 Strategic & Reflective Functions ----

function renderNorthStar() {
    const data = Store.getV2Data().northStar;
    const nsEl = $('#north-star');
    if (!nsEl) return;

    $('#ns-month').textContent = `${data.month} Focus`;
    $('#ns-focus').textContent = data.focus;
    const alignment = getAlignmentStateSafe();
    const timeState = getTimeStateSafe();
    const systemState = getSystemStateSafe();
    const intentionParts = [];
    if (data.intention) intentionParts.push(data.intention);
    if (alignment && Number.isFinite(alignment.score)) intentionParts.push(`Align ${formatPercent01(alignment.score)}`);
    if (timeState && timeState.phase) intentionParts.push(`Phase ${timeState.phase}`);
    if (systemState && systemState.lifeDirection) intentionParts.push(`Direction ${systemState.lifeDirection}`);
    $('#ns-intention').textContent = intentionParts.join(' · ');

    const prioritiesEl = $('#ns-priorities');
    prioritiesEl.innerHTML = data.priorities.map(p => `<span>• ${p}</span>`).join('');
}

// --- Phase 3: Creative Compass (The Roller) ---
function rollCompass() {
    const data = Store.getCompassData();
    const projects = data.projects.filter(p => !p.archived && p.stage !== 'RESTING');
    if (projects.length === 0) return;

    const rollBtn = $('.btn-roll-compass');
    if (rollBtn) rollBtn.style.transform = 'scale(0.9) rotate(360deg)';

    // Weighted random selection
    const totalWeight = projects.reduce((acc, p) => acc + (p.priorityWeight || 1), 0);
    let random = Math.random() * totalWeight;
    let selectedProject = projects[0];

    for (const p of projects) {
        random -= (p.priorityWeight || 1);
        if (random <= 0) {
            selectedProject = p;
            break;
        }
    }

    // Set as daily override
    Store.setDailyOverride(selectedProject.id);

    setTimeout(() => {
        if (rollBtn) rollBtn.style.transform = '';
        renderCreativeCompass();
        // Visual feedback
        const nameEl = $('#compass-suggestion-name');
        if (nameEl) {
            nameEl.style.animation = 'none';
            nameEl.offsetHeight; // trigger reflow
            nameEl.style.animation = 'pulse-accent 0.8s ease-out';
        }
    }, 500);
}

function calculateCompassScore(project, settings) {
    if (project.archived || project.stage === 'RESTING') return -1;

    const weights = settings.stageWeights || { SEED: 10, GROWING: 20, FORMING: 35, RELEASING: 50, RESTING: 0 };
    const factor = settings.inactivityFactor || 2;

    const lastDate = new Date(project.lastActivityDate);
    const today = new Date();
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;

    const stageWeight = weights[project.stage] || 0;
    const priorityWeight = project.priorityWeight || 0;

    return stageWeight + (diffDays * factor) + priorityWeight;
}

function getCompassDirection() {
    const data = Store.getCompassData();
    const projects = data.projects.filter(p => !p.archived);
    if (projects.length === 0) return null;

    // Check for override
    const today = new Date().toDateString();
    if (data.dailyOverride && data.dailyOverride.date === today) {
        const override = projects.find(p => p.id === data.dailyOverride.projectId);
        if (override) return { project: override, reason: "Your choice for today." };
    }

    // Cognitive focus suggestion (read-only integration)
    const cognitive = getCognitiveStateSafe();
    const focus = cognitive && cognitive.focusDecision ? cognitive.focusDecision : null;
    if (focus && focus.suggestionType === 'CREATIVE' && focus.suggestedProjectId) {
        const suggested = projects.find(p => p.id === focus.suggestedProjectId);
        if (suggested) {
            const reason = Array.isArray(focus.why) && focus.why.length
                ? focus.why[0]
                : 'Suggested by current system state.';
            return { project: suggested, reason };
        }
    }

    // Scoring
    let bestProject = null;
    let maxScore = -1;

    projects.forEach(p => {
        const score = calculateCompassScore(p, data.settings);
        if (score > maxScore) {
            maxScore = score;
            bestProject = p;
        } else if (score === maxScore && score !== -1) {
            // Tie-breakers
            const dateA = new Date(p.lastActivityDate);
            const dateB = new Date(bestProject.lastActivityDate);
            if (dateA < dateB) {
                bestProject = p;
            } else if (dateA.getTime() === dateB.getTime()) {
                if (p.name.toLowerCase() < bestProject.name.toLowerCase()) {
                    bestProject = p;
                }
            }
        }
    });

    if (!bestProject) return null;

    // Reason text
    let reason = "A good next step.";
    const diffTime = Math.abs(new Date() - new Date(bestProject.lastActivityDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;

    if (bestProject.stage === 'RELEASING') reason = "Ready to release.";
    else if (diffDays >= 7) reason = `Has been quiet for ${diffDays} days.`;
    else if (bestProject.priorityWeight > 0) reason = "Marked as a priority.";

    return { project: bestProject, reason };
}

function renderCreativeCompass() {
    const data = Store.getCompassData();
    const v2 = Store.getV2Data();
    const container = $('#creative-compass-container');
    if (!container) return;

    const direction = getCompassDirection();
    const suggestionName = $('#compass-suggestion-name');
    const suggestionReason = $('#compass-suggestion-reason');
    const missionText = $('#mission-text');
    const momentumFill = $('#momentum-fill');
    const momentumPct = $('#momentum-pct');
    const attentionState = getAttentionStateSafe();
    const systemState = getSystemStateSafe();
    const timeState = getTimeStateSafe();
    const creativePhaseState = getCreativePhaseStateSafe();

    // Update Project Direction
    if (direction) {
        suggestionName.textContent = direction.project.name;
        const reasonParts = [direction.reason];
        if (attentionState && attentionState.leakSource && attentionState.leakSource !== 'NONE') {
            reasonParts.push(`Leak risk: ${attentionState.leakSource.toLowerCase()}`);
        }
        if (systemState && Number.isFinite(systemState.overallRisk)) {
            reasonParts.push(`Risk ${formatPercent01(systemState.overallRisk)}`);
        }
        if (creativePhaseState && creativePhaseState.phase) {
            reasonParts.push(`Phase ${creativePhaseState.phase.toLowerCase()}`);
        }
        suggestionReason.textContent = reasonParts.join(' · ');
    } else {
        suggestionName.textContent = "Quiet Day";
        suggestionReason.textContent = "Add a project to begin.";
    }

    // Update Mission Context
    if (missionText) {
        const mission = v2.northStar.focus || "Steady Growth";
        const suffix = [];
        if (timeState && timeState.phase) suffix.push(timeState.phase);
        if (systemState && systemState.systemMode) suffix.push(systemState.systemMode);
        missionText.textContent = suffix.length ? `${mission} · ${suffix.join('/')}` : mission;
    }

    // Calculate Momentum
    if (momentumFill && momentumPct) {
        const today = new Date().toISOString().split('T')[0];
        const todayLog = data.dailyLog.find(l => l.date.split('T')[0] === today);
        let pct = 0;
        if (todayLog) {
            if (todayLog.outcome === 'yes') pct = 100;
            else if (todayLog.outcome === 'little') pct = 50;
        }
        momentumFill.style.width = `${pct}%`;
        momentumPct.textContent = `${pct}%`;
    }

    // Render Project Tags (Cloud)
    const listEl = $('#compass-projects');
    if (listEl) {
        const activeProjects = data.projects.filter(p => !p.archived && (data.settings.showResting || p.stage !== 'RESTING'));
        listEl.innerHTML = activeProjects.map(p => `
            <div class="world-tag ${direction && direction.project.id === p.id ? 'active' : ''}" 
                 data-action="setCompassOverride" data-action-args="'${p.id}'">
                ${p.name}
            </div>
        `).join('');
    }

    // Check-in Visibility
    const checkInEl = $('#compass-check-in');
    if (checkInEl && direction) {
        const today = new Date().toISOString().split('T')[0];
        const alreadyLogged = data.dailyLog.some(l => l.date.split('T')[0] === today && l.projectId === direction.project.id);
        if (alreadyLogged) {
            checkInEl.classList.add('hidden');
        } else {
            checkInEl.classList.remove('hidden');
        }
    }

    renderDerivedTopBarPulse();
}


function renderPeople() {
    const data = Store.getV2Data().people;
    const peopleEl = $('#people-list');
    if (!peopleEl) return;

    const relationshipState = getRelationshipStateSafe();
    const items = data.map(p => `
        <div class="person-item">
            <div class="person-role">${p.role}</div>
            <div class="person-name">${p.name}</div>
            <div class="person-prompt">${p.prompt}</div>
        </div>
    `);

    if (relationshipState) {
        items.push(`
            <div class="person-item person-insight">
                <div class="person-role">Relationship Field</div>
                <div class="person-name">Warmth ${formatPercent01(relationshipState.warmth)}</div>
                <div class="person-prompt">Isolation ${formatPercent01(relationshipState.isolationRisk)} · ${relationshipState.neglectedCount} neglected</div>
            </div>
        `);
    }

    peopleEl.innerHTML = items.join('');
}

function renderWorlds() {
    const data = Store.getV2Data().activeWorlds;
    const worldsEl = $('#worlds-list');
    if (!worldsEl) return;

    worldsEl.innerHTML = data.map(w => `
        <div class="world-item">
            <div class="world-label">${w.name}</div>
            <div class="world-state">${w.state}</div>
            ${w.nextAction ? `<div class="world-next-action">${w.nextAction}</div>` : ''}
        </div>
    `).join('');
}

function renderReflection() {
    const data = Store.getV2Data().reflection;
    const widget = $('#weekly-reflection');
    if (!widget) return;
    const narrative = getNarrativeStateSafe();
    const chapter = narrative && narrative.chapterLabel ? narrative.chapterLabel : 'Current Chapter';
    const summary = narrative && narrative.summary ? narrative.summary : 'No long-range narrative yet.';

    widget.innerHTML = `
        <div class="drag-handle">⋮⋮</div>
        <button class="btn-edit-widget" data-widget="reflection" title="Edit Widget">✎</button>
        <div class="reflection-header">
            <span style="font-size: 1.2rem">📔</span>
            <h2>Weekly Reflection</h2>
        </div>
        <div class="reflection-content">
            <div class="reflection-line">
                <span class="icon">🏆</span>
                <div class="reflection-text">
                    <strong>Big Win</strong>
                    <span id="reflection-win">${data.win}</span>
                </div>
            </div>
            <div class="reflection-line">
                <span class="icon">💡</span>
                <div class="reflection-text">
                    <strong>Major Lesson</strong>
                    <span id="reflection-lesson">${data.lesson}</span>
                </div>
            </div>
            <div class="reflection-line">
                <span class="icon">🚀</span>
                <div class="reflection-text">
                    <strong>Next Shift</strong>
                    <span id="reflection-next">${data.nextShift}</span>
                </div>
            </div>
            <div class="reflection-line">
                <span class="icon">🧭</span>
                <div class="reflection-text">
                    <strong>${chapter}</strong>
                    <span>${summary}</span>
                </div>
            </div>
        </div>
    `;
}

function initQuickCapture() {
    renderStrikeTeam();
}

function renderStrikeTeam() {
    const listEl = $('#quick-alert-list');
    const status = $('#quick-capture-status');
    if (!listEl) return;

    const v2 = Store.getV2Data();
    // Default to 3 empty tasks if none exist
    if (!v2.strikeTeam || v2.strikeTeam.length !== 3) {
        v2.strikeTeam = [
            { text: '', done: false },
            { text: '', done: false },
            { text: '', done: false }
        ];
        Store.saveV2Data(v2);
    }

    listEl.innerHTML = v2.strikeTeam.map((task, i) => `
        <div class="alert-task-item ${task.done ? 'done-item' : ''}">
            <div class="alert-task-checkbox ${task.done ? 'done' : ''}" data-action="toggleStrikeTask" data-action-args="${i}"></div>
            <input type="text" class="alert-task-input" 
                   value="${task.text}" 
                   placeholder="Task ${i + 1}..." 
                   data-action-input="saveStrikeTask" data-action-args="${i}, '__value__'">
            ${task.text ? '<span class="alert-badge">Strike</span>' : ''}
        </div>
    `).join('');
}

window.toggleStrikeTask = function (index) {
    const v2 = Store.getV2Data();
    v2.strikeTeam[index].done = !v2.strikeTeam[index].done;
    Store.saveV2Data(v2);
    renderStrikeTeam();
};

let strikeSaveTimeout = null;
window.saveStrikeTask = function (index, text) {
    const status = $('#quick-capture-status');
    if (status) {
        status.classList.add('visible');
        status.textContent = 'Saving...';
    }

    clearTimeout(strikeSaveTimeout);
    strikeSaveTimeout = setTimeout(() => {
        const v2 = Store.getV2Data();
        v2.strikeTeam[index].text = text;
        Store.saveV2Data(v2);

        // Re-render badge if text added/removed
        renderStrikeTeam();

        if (status) {
            status.textContent = 'Auto-saved';
            setTimeout(() => status.classList.remove('visible'), 2000);
        }
    }, 800);
};

function renderRituals() {
    const v2 = Store.getV2Data();
    const data = v2.rituals || { morning: [], evening: [] };
    const morningList = $('#morning-rituals-list');
    const eveningList = $('#evening-rituals-list');

    if (morningList) {
        morningList.innerHTML = (data.morning || []).map((r, i) => `
            <div class="ritual-item ${r.done ? 'done' : ''}" data-action="toggleRitual" data-action-args="'morning', ${i}">
                <div class="ritual-checkbox">${r.done ? '✓' : ''}</div>
                <span>${r.text}</span>
            </div>
        `).join('');
    }
    if (eveningList) {
        eveningList.innerHTML = (data.evening || []).map((r, i) => `
            <div class="ritual-item ${r.done ? 'done' : ''}" data-action="toggleRitual" data-action-args="'evening', ${i}">
                <div class="ritual-checkbox">${r.done ? '✓' : ''}</div>
                <span>${r.text}</span>
            </div>
        `).join('');
    }
}

window.toggleRitual = function (type, index) {
    const v2 = Store.getV2Data();
    v2.rituals[type][index].done = !v2.rituals[type][index].done;
    Store.saveV2Data(v2);
    renderRituals();
};

// ---- Daily State ----
function initDailyState() {
    renderDailyState();
}

function renderDailyState() {
    const entry = Store.getTodayState();
    const container = $('#daily-state-content');
    if (!container) return;

    if (!entry) {
        container.innerHTML = `
            <div class="state-placeholder" data-action="openEditModal" data-action-args="'dailyState'">
                Log today’s state.
            </div>
        `;
        renderDerivedTopBarPulse();
        return;
    }

    container.className = 'daily-state-container';
    container.innerHTML = `
        <div class="rhythm-header" data-action="openEditModal" data-action-args="'dailyState'" style="cursor:pointer; align-items: flex-start; text-align: left; border-bottom: none; padding-bottom: 0;">
            <span class="rhythm-title">CURRENT STATUS</span>
            <span class="rhythm-subtitle">Today's inner metrics</span>
        </div>
        <div class="state-metrics-list">
            <div class="state-metric-row" style="animation-delay: 0.1s" data-action="openEditModal" data-action-args="'dailyState'">
                <span class="metric-icon">⚡</span>
                <span class="metric-name">ENERGY</span>
                <div class="spacer"></div>
                <span class="metric-value">${entry.energy || '—'}</span>
            </div>
            <div class="state-metric-row" style="animation-delay: 0.2s" data-action="openEditModal" data-action-args="'dailyState'">
                <span class="metric-icon">🎭</span>
                <span class="metric-name">MOOD</span>
                <div class="spacer"></div>
                <span class="metric-value">${entry.mood || '—'}</span>
            </div>
            <div class="state-metric-row" style="animation-delay: 0.3s" data-action="openEditModal" data-action-args="'dailyState'">
                <span class="metric-icon">🌙</span>
                <span class="metric-name">REST</span>
                <div class="spacer"></div>
                <span class="metric-value">${entry.sleep ? entry.sleep + 'h' : '—'}</span>
            </div>
        </div>
    `;
    renderDerivedTopBarPulse();
}

// ---- Income Pipeline ----
function initIncome() {
    renderIncome();
}

function renderIncome() {
    const invoices = Store.getInvoices();
    const openEl = $('#inc-open');
    const thisEl = $('#inc-this');
    const nextEl = $('#inc-next');
    if (!openEl) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const nextMonth = (currentMonth + 1) % 12;
    const currentYear = now.getFullYear();

    // Logic:
    // Open = Status != Paid
    // This Month = Expected Date in current month
    // Confirmed Next = Status == Confirmed AND Next Month

    let openTotal = 0;
    let thisMonthTotal = 0;
    let nextMonthConfirmed = 0;

    invoices.forEach(inv => {
        if (inv.status !== 'Paid') {
            openTotal += inv.amount;
        }

        const d = new Date(inv.expectedDate);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            thisMonthTotal += inv.amount;
        }

        if (inv.status === 'Confirmed' && d.getMonth() === nextMonth) {
            nextMonthConfirmed += inv.amount;
        }
    });

    // Formatting k
    const format = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;

    openEl.textContent = '€' + format(openTotal);
    thisEl.textContent = '€' + format(thisMonthTotal);
    nextEl.textContent = '€' + format(nextMonthConfirmed);
}

// ---- Current Season ----
function initSeasons() {
    renderSeasons();
}

function renderSeasons() {
    const season = Store.getActiveSeason();
    const seasonEl = $('#topbar-season');
    if (!seasonEl) return;

    if (season) {
        seasonEl.textContent = ` · ${season.name}`;
        seasonEl.title = season.focus || '';
        seasonEl.style.cursor = 'pointer';
        seasonEl.onclick = () => openEditModal('season');
    } else {
        seasonEl.textContent = ' · NO SEASON';
        seasonEl.title = 'Define current season';
        seasonEl.style.cursor = 'pointer';
        seasonEl.onclick = () => openEditModal('season');
    }
}


// ---- Drag & Drop Layout ----

function initDragging() {
    const columns = $$('.col-left, .col-center, .col-right, .ritual-col-left, .ritual-col-right, .vision-inner');
    const widgets = $$('.widget, .vision-widget, .ritual-widget');
    let draggedWidget = null;

    // Load saved layout
    // Load saved layout
    /* 
    // DISABLED to fix layout crash - forcing default HTML structure
    const savedLayout = Store.getLayout();
    if (savedLayout) {
        Object.keys(savedLayout).forEach(colClass => {
            const col = $(`.${colClass}`);
            if (col) {
                savedLayout[colClass].forEach(id => {
                    const widget = document.getElementById(id);
                    if (widget) col.appendChild(widget);
                });
            }
        });
    }
    */

    widgets.forEach(widget => {
        const handle = widget.querySelector('.drag-handle');

        if (handle) {
            handle.addEventListener('mousedown', () => {
                widget.setAttribute('draggable', 'true');
            });
            handle.addEventListener('mouseup', () => {
                widget.setAttribute('draggable', 'false');
            });
        }

        widget.addEventListener('dragstart', (e) => {
            // draggable is only set via handle mousedown, so no extra check needed
            draggedWidget = widget;
            widget.classList.add('dragging');
            e.dataTransfer.setData('text/plain', widget.id);
            // Wait for next tick to apply style so it's not in the ghost image
            setTimeout(() => widget.style.display = 'none', 0);
        });

        widget.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        widget.addEventListener('dragend', () => {
            draggedWidget = null;
            widget.classList.remove('dragging');
            widget.style.display = ''; // Revert to stylesheet default
            widget.setAttribute('draggable', 'false'); // Reset
            saveCurrentLayout();
        });
    });

    columns.forEach(col => {
        col.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(col, e.clientY);
            if (afterElement == null) {
                col.appendChild(draggedWidget);
            } else {
                col.insertBefore(draggedWidget, afterElement);
            }
        });

        col.addEventListener('drop', e => {
            e.preventDefault();
            saveCurrentLayout();
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.widget:not(.dragging), .vision-widget:not(.dragging), .ritual-widget:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveCurrentLayout() {
    const layout = {
        'col-left': Array.from($$('.col-left > *')).filter(w => w.id && !w.classList.contains('dragging')).map(w => w.id),
        'col-center': Array.from($$('.col-center > *')).filter(w => w.id && !w.classList.contains('dragging')).map(w => w.id),
        'col-right': Array.from($$('.col-right > *')).filter(w => w.id && !w.classList.contains('dragging')).map(w => w.id),
        'ritual-col-left': Array.from($$('.ritual-col-left > *')).filter(w => w.id && !w.classList.contains('dragging')).map(w => w.id),
        'ritual-col-right': Array.from($$('.ritual-col-right > *')).filter(w => w.id && !w.classList.contains('dragging')).map(w => w.id),
        'vision-inner': Array.from($$('.vision-inner > *')).filter(w => w.id && !w.classList.contains('dragging')).map(w => w.id)
    };
    Store.saveLayout(layout);
}

// ---- Modal System ----

function initModal() {
    console.log('initModal: initializing with delegation...');
    const closeBtn = $('#modal-close');

    // Global delegation for all edit buttons (Dashboard, Ritual, Vision)
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-edit-widget');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            const widgetType = btn.dataset.widget;
            console.log('Opening modal for:', widgetType);
            openEditModal(widgetType);
        }
    });

    window.closeModal = function () {
        console.log('closeModal: closing...');
        const overlay = $('#modal-overlay');
        const content = $('#modal-content');
        teardownSettingsModalPreviewOnClose(overlay);
        if (overlay) overlay.classList.remove('active');
        if (overlay) overlay.removeAttribute('data-type');
        if (content) {
            content.style.width = '';
            content.style.maxWidth = '';
            content.classList.remove('modal-large');
        }
    };
    function closeModal() { window.closeModal(); }

    if (closeBtn) closeBtn.onclick = closeModal;

    // Close on overlay click
    const overlay = $('#modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }
}

// Helpers moved to top for better accessibility

window.resetSlowDays = function () {
    if (confirm("Are you sure you want to reset the slow days counter?")) {
        Store.resetRitualSlowDays();
        renderRitualWidgets();
        closeModal();
    }
};

window.resetGratitude = function () {
    if (confirm("Clear today's gratitude list?")) {
        Store.resetRitualGratitude();
        renderRitualWidgets();
        closeModal();
    }
};

window.resetRhythm = function () {
    if (confirm("Reset all checkmarks for today?")) {
        Store.resetDailyRhythm();
        renderDailyRhythm();
        closeModal();
    }
};

window.addTransaction = function addTransaction() {
    const descInput = document.getElementById('modal-txn-desc');
    const amountInput = document.getElementById('modal-txn-amount');
    const name = String(descInput?.value || '').trim();
    const amount = Number.parseFloat(amountInput?.value || '');
    if (!name || !Number.isFinite(amount)) return;

    const fin = Store.getFinance();
    const transactions = Array.isArray(fin.transactions) ? fin.transactions : [];
    transactions.unshift({
        icon: amount < 0 ? '💸' : '💰',
        name,
        amount,
        date: new Date().toISOString().split('T')[0]
    });
    fin.transactions = transactions;
    Store.saveFinance(fin);
    openEditModal('financeOverview');
};

window.deleteTransaction = function deleteTransaction(index) {
    const idx = Number.parseInt(index, 10);
    if (!Number.isInteger(idx) || idx < 0) return;
    const fin = Store.getFinance();
    const transactions = Array.isArray(fin.transactions) ? fin.transactions : [];
    if (idx >= transactions.length) return;
    transactions.splice(idx, 1);
    fin.transactions = transactions;
    Store.saveFinance(fin);
    openEditModal('financeOverview');
};

window.previewFont = function previewFont(fontValue) {
    const font = String(fontValue || '').trim();
    document.body.style.fontFamily = font || 'var(--font-body)';
};

function openEditModal(type) {
    console.log('openEditModal: opening for', type);
    const overlay = $('#modal-overlay');
    const content = $('#modal-content');
    const body = $('#modal-body');

    // Reset styles that might have been set by special modals
    content.style.width = '';
    content.style.maxWidth = '';
    content.classList.remove('modal-large');

    body.innerHTML = '';


    overlay.setAttribute('data-type', type);

    let formHtml = '';
    const v2Data = Store.getV2Data();

    switch (type) {
        case 'financeOverview':
            const fin = Store.getFinance();
            const frData = v2Data.financialReality;

            // Transaction List HTML
            const txnListHtml = fin.transactions.map((t, i) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1)">
                    <span>${t.icon} ${t.name} <small style="opacity:0.6">${t.date}</small></span>
                    <div>
                        <span style="color:${t.amount < 0 ? '#ff6b6b' : '#88d8b0'}">${t.amount}€</span>
                        <button data-action="deleteTransaction" data-action-args="${i}" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer; margin-left:8px">×</button>
                    </div>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Financial Overview</h2>
                    
                    <!-- Stats -->
                    <div class="modal-grid-two" style="margin-bottom:20px">
                        <div class="form-group">
                            <label>Balance (€)</label>
                            <input type="number" step="0.01" id="modal-fin-balance" value="${fin.balance}">
                        </div>
                        <div class="form-group">
                            <label>Debt Left (€)</label>
                            <input type="number" id="modal-fr-debt" value="${frData.debtLeft}">
                        </div>
                        <div class="form-group">
                            <label>Runway (Mo)</label>
                            <input type="number" step="0.1" id="modal-fr-runway" value="${frData.runwayMonths}">
                        </div>
                        <div class="form-group">
                            <label>Monthly Target (€)</label>
                            <input type="number" id="modal-fr-target" value="${frData.monthlyTarget}">
                        </div>
                    </div>

                    <!-- Transactions -->
                    <h3>Recent Transactions</h3>
                    <div style="max-height:150px; overflow-y:auto; margin-bottom:15px; font-size:0.9rem">
                        ${txnListHtml}
                    </div>
                    
                    <div class="form-group" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px">
                        <label>Add Transaction</label>
                        <div class="modal-grid-add-three">
                            <input type="text" id="modal-txn-desc" placeholder="Desc">
                            <input type="number" id="modal-txn-amount" placeholder="-20">
                            <button class="btn-icon-add" data-action="addTransaction" data-action-args="" aria-label="Add transaction">+</button>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'financeOverview'">Save Stats</button>
                    </div>
                </div>
            `;
            break;

        case 'revenueEngine':
            const rev = v2Data.revenueEngine || { today: 0, pipeline: 0, invoices: 0, deals: 0 };
            formHtml = `
                <div class="modal-form">
                    <h2>Revenue Engine</h2>
                    <div class="form-group">
                        <label>Generated Today (€)</label>
                        <input type="number" id="modal-rev-today" value="${rev.today}">
                    </div>
                    <div class="form-group">
                        <label>Pipeline Created (€)</label>
                        <input type="number" id="modal-rev-pipe" value="${rev.pipeline}">
                    </div>
                    <div class="form-group">
                        <label>Invoices Sent</label>
                        <input type="number" id="modal-rev-inv" value="${rev.invoices}">
                    </div>
                    <div class="form-group">
                        <label>Deals Moved</label>
                        <input type="number" id="modal-rev-deals" value="${rev.deals}">
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'revenueEngine'">Save</button>
                    </div>
                </div>
            `;
            break;

        case 'bizFinance':
            const bizFr = v2Data.financialReality || {};
            formHtml = `
                <div class="modal-form">
                    <h2>Biz: Financial Intelligence</h2>
                    <div class="form-group">
                        <label>90-Day Cash (€)</label>
                        <input type="number" id="modal-biz-cash" value="${bizFr.cash90 || 0}">
                    </div>
                    <div class="form-group">
                        <label>Monthly Burn (€)</label>
                        <input type="number" id="modal-biz-burn" value="${bizFr.monthlyBurn || 0}">
                    </div>
                    <div class="form-group">
                        <label>Runway (Months)</label>
                        <input type="number" step="0.1" id="modal-biz-runway" value="${bizFr.runwayMonths || 0}">
                    </div>
                    <div class="form-group">
                        <label>Monthly Target (€)</label>
                        <input type="number" id="modal-biz-target" value="${bizFr.monthlyTarget || 4000}">
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'bizFinance'">Save</button>
                    </div>
                </div>
            `;
            break;

        case 'bizProjects':
            const bp = v2Data.bizProjects || [];
            const bpListHtml = bp.map((p, i) => `
                <div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1)">
                    <div style="display:flex; justify-content:space-between">
                        <b>${p.name}</b>
                        <span>L${p.leverage}</span>
                    </div>
                    <div style="font-size:0.8rem; opacity:0.6">${p.status}</div>
                    <button data-action="deleteBizProject" data-action-args="${i}" class="btn-ghost" style="font-size:0.7rem">Delete</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Biz: Projects & Leverage</h2>
                    <div style="max-height:200px; overflow-y:auto; margin-bottom:15px">
                        ${bpListHtml || '<div style="opacity:0.5">No projects.</div>'}
                    </div>
                    <div class="form-group" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px">
                        <label>Add Project</label>
                        <input type="text" id="modal-bp-name" placeholder="Name" style="margin-bottom:8px">
                        <div style="display:flex; gap:8px">
                            <input type="number" id="modal-bp-leverage" placeholder="Leverage (1-10)" style="flex:1">
                            <button data-action="addBizProject" data-action-args="" class="btn-secondary ui-btn ui-btn--secondary">Add</button>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                    </div>
                </div>
            `;
            break;

        case 'bizContent':
            const bc = v2Data.bizContent || { minutesCreated: 0, piecesFinished: 0, audienceGrowth: 0, stage: 'Building' };
            formHtml = `
                <div class="modal-form">
                    <h2>Biz: Creative Output</h2>
                    <div class="form-group">
                        <label>Minutes Created</label>
                        <input type="number" id="modal-bc-mins" value="${bc.minutesCreated}">
                    </div>
                    <div class="form-group">
                        <label>Pieces Finished</label>
                        <input type="number" id="modal-bc-pieces" value="${bc.piecesFinished}">
                    </div>
                    <div class="form-group">
                        <label>Audience Growth</label>
                        <input type="number" id="modal-bc-growth" value="${bc.audienceGrowth}">
                    </div>
                    <div class="form-group">
                        <label>Content Stage</label>
                        <input type="text" id="modal-bc-stage" value="${bc.stage}">
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'bizContent'">Save</button>
                    </div>
                </div>
            `;
            break;

        case 'calendar':
            const events = Store.getEvents();
            // Sort by date/time
            events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

            const eventListHtml = events.map((ev, i) => `
                <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:0.9rem; border-bottom:1px solid rgba(255,255,255,0.1)">
                    <div style="flex:1">
                        <b>${ev.date} ${ev.time}</b>: ${ev.name}
                        ${ev.description ? `<br><small style="opacity:0.6">${ev.description}</small>` : ''}
                    </div>
                    <button data-action="deleteEvent" data-action-args="${i}" style="color:var(--text-tertiary); background:none; border:none; cursor:pointer; font-size:1.1rem">×</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Calendar Events</h2>
                    <div class="items-list" style="max-height:250px; overflow-y:auto; margin-bottom:15px">
                        ${eventListHtml || '<div style="opacity:0.5; text-align:center">No upcoming events</div>'}
                    </div>
                    
                    <div class="form-group" style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px">
                        <label>Add New Event</label>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px">
                            <input type="date" id="new-ev-date" value="${new Date().toISOString().split('T')[0]}">
                            <input type="time" id="new-ev-time">
                        </div>
                        <input type="text" id="new-ev-name" placeholder="Event Name" style="margin-bottom:8px">
                        <textarea id="new-ev-desc" placeholder="Description (shows on hover)" style="margin-bottom:8px; min-height:60px"></textarea>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="addNewEvent" data-action-args="" style="width:100%">Add Event</button>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Done</button>
                    </div>
                </div>
            `;
            break;

        case 'goals':
            const goals = Store.getGoals();

            const goalsHtml = goals.map(g => `
                <div style="display:grid; grid-template-columns: 24px 1fr 80px 32px; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1)">
                    <span>${g.icon}</span>
                    <span style="font-size:0.9rem">${g.name}</span>
                    <input type="number" class="modal-goal-progress" data-id="${g.id}" value="${g.progress}" style="width:100%; padding:4px">
                    <button data-action="deleteGoal" data-action-args="'${g.id}'" style="color:var(--text-tertiary); background:none; border:none; cursor:pointer; font-size:1.1rem">×</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Edit Goals</h2>
                    
                    <h3 style="margin-top:0">Active Goals</h3>
                    <div style="max-height:250px; overflow-y:auto; margin-bottom:10px">
                        ${goalsHtml || '<div style="opacity:0.5">No goals set</div>'}
                    </div>
                    <div class="form-group" style="display:flex; gap:8px; margin-bottom:20px; background:rgba(255,255,255,0.03); padding:12px; border-radius:12px">
                        <input type="text" id="modal-goal-name" placeholder="New Goal Name" style="flex:2">
                        <input type="text" id="modal-goal-target" placeholder="Target (e.g. €10k)" style="flex:1">
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="addGoal" data-action-args="">+</button>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'goals'">Save Changes</button>
                    </div>
                </div>
            `;
            break;

        case 'habitsRituals':
            const rhythm = v2Data.dailyRhythm || [];

            const rhythmHtml = rhythm.map((phase, pIdx) => {
                const itemsHtml = phase.items.map((item, iIdx) => `
                    <div style="display:flex; gap:10px; padding:6px 0; align-items:center; border-bottom:1px solid rgba(255,255,255,0.03)">
                        <input type="text" class="modal-rhythm-item-edit" data-phase="${pIdx}" data-item="${iIdx}" value="${item.text}">
                        <button data-action="deleteRhythmItem" data-action-args="${pIdx}, ${iIdx}" style="color:var(--text-tertiary); background:none; border:none; cursor:pointer; font-size:1.2rem">×</button>
                    </div>
                `).join('');

                return `
                    <div class="rhythm-modal-phase" style="margin-bottom:28px; background:rgba(255,255,255,0.03); padding:20px; border-radius:18px; border:1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 15px rgba(0,0,0,0.1)">
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px">
                            <label style="font-size:0.85rem; color:var(--text-accent); font-weight:700; text-transform:uppercase; letter-spacing:0.1em">${phase.title}</label>
                            <span style="font-size:0.75rem; color:var(--text-tertiary); font-style:italic; opacity:0.6">${phase.subtitle}</span>
                        </div>
                        <div style="margin-bottom:16px; display:flex; flex-direction:column; gap:4px">${itemsHtml || '<div style="font-size:0.8rem; color:var(--text-tertiary); padding:15px 0; text-align:center; opacity:0.5">Empty phase. Add your first ritual below.</div>'}</div>
                        <div style="display:flex; gap:10px; margin-top:20px; background:rgba(0,0,0,0.1); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.03)">
                            <input type="text" id="add-rhythm-item-${pIdx}" placeholder="New ${phase.title} ritual..." style="flex:1; background:transparent !important; border:none !important; box-shadow:none !important; padding:4px 8px !important">
                            <button class="btn-primary ui-btn ui-btn--primary" data-action="addRhythmItem" data-action-args="${pIdx}" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:8px">+</button>
                        </div>
                    </div>
                `;
            }).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Daily Rhythm Structure</h2>
                    <div style="max-height:450px; overflow-y:auto; padding-right:10px">
                        ${rhythmHtml}
                    </div>
                    <div class="modal-actions" style="margin-top:10px">
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="window.resetRhythm" data-action-args="" style="color:#ff6b6b; border-color:rgba(255,107,107,0.3)">Reset Checkmarks</button>
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'habitsRituals'">Save Rhythm</button>
                    </div>
                </div>
            `;
            break;

        case 'northStar':
            const northStar = v2Data.northStar || { focus: '', intention: '', priorities: [] };
            formHtml = `
                <div class="modal-form">
                    <h2>Edit North Star</h2>
                    <div class="form-group">
                        <label>Strategic Focus</label>
                        <textarea id="modal-ns-focus" style="min-height:90px">${northStar.focus || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Intention</label>
                        <textarea id="modal-ns-intent" style="min-height:70px">${northStar.intention || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Priorities (comma separated)</label>
                        <input type="text" id="modal-ns-priorities" value="${(northStar.priorities || []).join(', ')}">
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'northStar'">Save North Star</button>
                    </div>
                </div>
            `;
            break;

        case 'ritualWalk':
            const walk = Store.getRitualWalkLog();
            const walkInsights = (typeof Store.getWalkWeeklyInsights === 'function')
                ? Store.getWalkWeeklyInsights()
                : { totalWalksThisWeek: 0, totalMinutesThisWeek: 0, averageMinutes: 0, mostCommonWalkType: 'None yet' };
            formHtml = `
                <div class="modal-form">
                    <h2>Ritual: Walk / Forest Log</h2>
                    <div style="text-align:center; padding:20px 0">
                        <div style="font-size:3rem; font-weight:700; color:var(--text-accent)">${walk.count}</div>
                        <div style="opacity:0.6; font-size:0.9rem">Total Walk Entries</div>
                        <div style="margin-top:14px; font-size:0.85rem; color:var(--text-secondary)">
                            This week: ${walkInsights.totalWalksThisWeek} walks · ${walkInsights.totalMinutesThisWeek} min
                        </div>
                        <div style="margin-top:4px; font-size:0.78rem; color:var(--text-tertiary)">
                            Average: ${walkInsights.averageMinutes} min · Most frequent: ${walkInsights.mostCommonWalkType}
                        </div>
                    </div>
                    <div class="modal-actions" style="flex-direction:column; gap:10px">
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="window.resetWalkLog" data-action-args="" style="width:100%; color:#ff6b6b; border-color:rgba(255,107,107,0.3)">Clear Walk Entries</button>
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="" style="width:100%">Close</button>
                    </div>
                </div>
            `;
            break;
        case 'ritualSlowDays':
            const slow = Store.getRitualSlowDays();
            formHtml = `
                <div class="modal-form">
                    <h2>Ritual: Slow Days</h2>
                    <div style="text-align:center; padding:20px 0">
                        <div style="font-size:3rem; font-weight:700; color:var(--text-accent)">${slow.count}</div>
                        <div style="opacity:0.6; font-size:0.9rem">Days Lived Slowly</div>
                    </div>
                    <div class="modal-actions" style="flex-direction:column; gap:10px">
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="window.resetSlowDays" data-action-args="" style="width:100%; color:#ff6b6b; border-color:rgba(255,107,107,0.3)">Reset Count</button>
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="" style="width:100%">Close</button>
                    </div>
                </div>
            `;
            break;
        case 'ritualGratitude':
            const grat = Store.getRitualGratitudeToday();
            formHtml = `
                <div class="modal-form">
                    <h2>Ritual: Gratitude</h2>
                    <div class="form-group">
                        <label>Line 1</label>
                        <input type="text" id="modal-grat-1" value="${grat.lines[0]}">
                    </div>
                    <div class="form-group">
                        <label>Line 2</label>
                        <input type="text" id="modal-grat-2" value="${grat.lines[1]}">
                    </div>
                    <div class="form-group">
                        <label>Line 3</label>
                        <input type="text" id="modal-grat-3" value="${grat.lines[2]}">
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="window.resetGratitude" data-action-args="" style="color:#ff6b6b; border-color:rgba(255,107,107,0.3)">Reset</button>
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'ritualGratitude'">Save</button>
                    </div>
                </div>
            `;
            break;

        case 'ritualJournal': {
            const entries = Store.getJournalEntries();
            const entriesHtml = entries.slice(0, 10).map(e => `
                <div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem">
                    <div style="opacity:0.5; font-size:0.7rem; margin-bottom:4px">${new Date(e.date).toLocaleString()}</div>
                    <div style="white-space:pre-wrap">${e.text}</div>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Ritual: Journal Feed</h2>
                    <div style="max-height:300px; overflow-y:auto; margin-bottom:20px; background:rgba(0,0,0,0.1); border-radius:12px; padding:10px">
                        ${entriesHtml || '<p style="opacity:0.5; text-align:center">No entries yet.</p>'}
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="openJournalFeedAndCloseModal" data-action-args="">Full History</button>
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Close</button>
                    </div>
                </div>
            `;
            break;
        }

        case 'ritualGatherings':
            const gaths = Store.getRitualGatherings();
            const gathHtml = gaths.map(g => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:6px">
                    <div>
                        <div style="font-weight:600">${g.name}</div>
                        <div style="font-size:0.8rem; opacity:0.6">${g.date}</div>
                    </div>
                    <button data-action="removeRitualGathering" data-action-args="'${g.id}'" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:1.2rem">×</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Ritual: Gatherings</h2>
                    <div style="max-height:250px; overflow-y:auto; margin-bottom:15px">
                        ${gathHtml || '<p style="opacity:0.5; text-align:center">No gatherings planned.</p>'}
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Close</button>
                    </div>
                </div>
            `;
            break;

        case 'visualConfig':
            formHtml = `
                <div class="modal-form">
                    <h2>Edit Visual System</h2>
                    <div class="form-group">
                        <label>Base Typography & Scale</label>
                        <select id="modal-visual-font" data-action-change="previewFont" data-action-args="'__value__'">
                            <option value="Inter" ${v2Data.visual?.font === 'Inter' ? 'selected' : ''}>Standard (Inter)</option>
                            <option value="'Outfit', sans-serif" ${v2Data.visual?.font === "'Outfit', sans-serif" ? 'selected' : ''}>Premium (Outfit)</option>
                            <option value="'Playfair Display', serif" ${v2Data.visual?.font === "'Playfair Display', serif" ? 'selected' : ''}>Serif (Playfair)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Interface Brightness (%)</label>
                        <input type="range" id="modal-visual-brightness" min="50" max="150" value="${v2Data.visual?.brightness || 100}">
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'visualConfig'">Apply System</button>
                    </div>
                </div>
            `;
            break;

        case 'vices':
            const vicesData = v2Data.vices || [];
            const vicesList = vicesData.map(v => `
                <div style="display:flex; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); align-items:center">
                    <span style="font-size:0.85rem; flex:1">${v.name}</span>
                    <span style="font-size:0.7rem; color:var(--text-tertiary)">Since: ${v.cleanSince}</span>
                    <button data-action="deleteVice" data-action-args="'${v.id}'" style="color:var(--text-tertiary); background:none; border:none; cursor:pointer">\u00d7</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Vault of Vices</h2>
                    <div style="max-height:250px; overflow-y:auto; margin-bottom:15px">
                        ${vicesList || '<div style="padding:20px; text-align:center; color:var(--text-tertiary)">No vices tracked yet.</div>'}
                    </div>
                    <div class="form-group" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px">
                        <label>Add Vice to Track</label>
                        <div style="display:flex; gap:8px">
                            <input type="text" id="new-vice-name" placeholder="e.g. Sugar, Doom-scrolling..." style="flex:1">
                            <button class="btn-primary ui-btn ui-btn--primary" data-action="addNewVice" data-action-args="">+</button>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Close</button>
                    </div>
                </div>
            `;
            break;



        case 'financialReality':
            formHtml = `
                <div class="modal-form">
                    <h2>Edit Financial Reality</h2>
                    <div class="form-group">
                        <label>Debt Left (€)</label>
                        <input type="number" id="modal-fr-debt" value="${v2Data.financialReality.debtLeft}">
                    </div>
                    <div class="form-group">
                        <label>Runway (Months)</label>
                        <input type="number" id="modal-fr-runway" value="${v2Data.financialReality.runwayMonths}">
                    </div>
                    <div class="form-group">
                        <label>Income Target (€)</label>
                        <input type="number" id="modal-fr-target" value="${v2Data.financialReality.monthlyTarget}">
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'financialReality'">Save Changes</button>
                    </div>
                </div>
            `;
            break;

        case 'creativePulse':
            const compassData = Store.getCompassData();
            formHtml = `
                <div class="modal-form">
                    <h2>Edit Focus Engine</h2>
                    <div class="form-group">
                        <label>Projects (Name, Stage, Priority)</label>
                        <div style="max-height: 250px; overflow-y: auto; margin-bottom: 20px">
                            ${compassData.projects.map((p, i) => `
                                <div style="display:grid; grid-template-columns: 1fr 100px 60px 32px; gap:8px; margin-bottom:10px; align-items:center; background:rgba(255,255,255,0.03); padding:8px; border-radius:8px">
                                    <input type="text" class="modal-cp-name-edit" data-id="${p.id}" value="${p.name}" style="font-size:0.85rem">
                                    <select class="modal-cp-stage-edit" data-id="${p.id}" style="font-size:0.8rem">
                                        <option value="SEED" ${p.stage === 'SEED' ? 'selected' : ''}>SEED</option>
                                        <option value="GROWING" ${p.stage === 'GROWING' ? 'selected' : ''}>GROWING</option>
                                        <option value="FORMING" ${p.stage === 'FORMING' ? 'selected' : ''}>FORMING</option>
                                        <option value="RELEASING" ${p.stage === 'RELEASING' ? 'selected' : ''}>RELEASING</option>
                                        <option value="RESTING" ${p.stage === 'RESTING' ? 'selected' : ''}>RESTING</option>
                                    </select>
                                    <input type="number" class="modal-cp-priority-edit" data-id="${p.id}" value="${p.priorityWeight || 0}" title="Priority Weight">
                                    <button data-action="deleteCompassProject" data-action-args="'${p.id}'" style="color:var(--text-tertiary); background:none; border:none; cursor:pointer">×</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group" style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px">
                        <label>Add New Project</label>
                        <div style="display:grid; grid-template-columns: 1fr 100px 32px; gap:8px">
                            <input type="text" id="new-cp-name" placeholder="Project name">
                            <select id="new-cp-stage">
                                <option value="SEED">SEED</option>
                                <option value="GROWING" selected>GROWING</option>
                                <option value="FORMING">FORMING</option>
                            </select>
                            <button class="btn-primary ui-btn ui-btn--primary" data-action="addNewCompassProject" data-action-args="">+</button>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'creativePulse'">Save Compass</button>
                    </div>
                </div>
            `;
            break;

        case 'worlds':
            const worlds = v2Data.activeWorlds;
            const worldsList = worlds.map((w, i) => `
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 32px; gap:10px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.1); align-items:center">
                    <input type="text" class="modal-world-name-edit" data-index="${i}" value="${w.name}" style="font-size:0.85rem">
                    <input type="text" class="modal-world-state-edit" data-index="${i}" value="${w.state}" style="font-size:0.85rem">
                    <input type="text" class="modal-world-action-edit" data-index="${i}" value="${w.nextAction || ''}" style="font-size:0.85rem" placeholder="Next Action">
                    <button data-action="deleteWorld" data-action-args="${i}" style="color:var(--text-tertiary); background:none; border:none; cursor:pointer">×</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Active Worlds</h2>
                    <div style="max-height:300px; overflow-y:auto; margin-bottom:15px">
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 32px; gap:10px; margin-bottom:8px; opacity:0.5; font-size:0.7rem; font-family:var(--font-mono); text-transform:uppercase">
                            <span>Name</span>
                            <span>State</span>
                            <span>Next Action</span>
                            <span></span>
                        </div>
                        ${worldsList}
                    </div>
                    
                    <div class="form-group" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px">
                        <label>Add New World</label>
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 32px; gap:8px">
                            <input type="text" id="modal-world-name" placeholder="Name">
                            <input type="text" id="modal-world-state" placeholder="State">
                            <input type="text" id="modal-world-action" placeholder="Next Action">
                            <button class="btn-primary ui-btn ui-btn--primary" data-action="addWorld" data-action-args="">+</button>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'worlds'">Save All Worlds</button>
                    </div>
                </div>
            `;
            break;

        case 'people':
            const people = v2Data.people;
            content.classList.add('modal-large');
            const ppList = people.map((p, i) => `
                <div class="people-modal-grid people-modal-row">
                    <input type="text" class="modal-person-name-edit" data-index="${i}" value="${p.name}" style="font-size:0.85rem">
                    <input type="text" class="modal-person-role-edit" data-index="${i}" value="${p.role}" style="font-size:0.85rem">
                    <input type="text" class="modal-person-prompt-edit" data-index="${i}" value="${p.prompt || ''}" style="font-size:0.85rem" placeholder="Prompt">
                    <button class="people-modal-remove" data-action="deletePerson" data-action-args="${i}">×</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>People & Relationships</h2>
                    <div class="people-modal-scroll">
                        <div class="people-modal-grid people-modal-header">
                            <span>Name</span><span>Role</span><span>Subline / Prompt</span><span></span>
                        </div>
                        ${ppList || '<p style="opacity:0.5; text-align:center">No entries</p>'}
                    </div>
                    <div class="form-group people-modal-add">
                        <label>Add Connection</label>
                        <div class="people-modal-grid people-modal-add-row">
                            <input type="text" id="modal-person-name" placeholder="Name">
                            <input type="text" id="modal-person-role" placeholder="Role">
                            <input type="text" id="modal-person-prompt" placeholder="Subline">
                            <button class="btn-primary people-modal-add-btn" data-action="addPerson" data-action-args="">+</button>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'people'">Save Changes</button>
                    </div>
                </div>
            `;
            break;

        case 'journal':
            const entries = Store.getJournalEntries();
            formHtml = `
                <div class="modal-form">
                    <h2>Manage Journal Entries</h2>
                    <div style="max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:10px">
                        ${entries.length ? entries.map(e => `
                            <div style="padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; display:flex; justify-content:space-between; align-items:center">
                                <div style="flex:1; margin-right:15px">
                                    <div style="font-size:0.7rem; color:var(--text-tertiary); margin-bottom:4px">${new Date(e.date).toLocaleString()}</div>
                                    <div style="font-size:0.85rem">${e.text}</div>
                                </div>
                                <button data-action="deleteAndRefreshJournal" data-action-args="'${e.id}'" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:1.2rem">&times;</button>
                            </div>
                        `).join('') : '<p style="text-align:center; opacity:0.5">No entries yet.</p>'}
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="closeModal" data-action-args="">Done</button>
                    </div>
                </div>
            `;
            break;

        case 'reflection':
            formHtml = `
                <div class="modal-form">
                    <h2>Weekly Reflection</h2>
                    <div class="form-group">
                        <label>Win of the Week</label>
                        <textarea id="modal-refl-win">${v2Data.reflection.win}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Lesson Learned</label>
                        <textarea id="modal-refl-lesson">${v2Data.reflection.lesson}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Next Week's Shift</label>
                        <textarea id="modal-refl-next">${v2Data.reflection.nextShift}</textarea>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'reflection'">Save Changes</button>
                    </div>
                </div>
            `;
            break;

        case 'sport':
            const acts = Store.getActivities();
            const actListHtml = acts.map((a, i) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05)">
                    <div>
                        <div style="font-weight:600; font-size:0.9rem; color:var(--text-accent)">🏃 ${a.type}</div>
                        <div style="font-size:0.75rem; opacity:0.6">${new Date(a.date).toLocaleDateString()} · ${a.distance || ''} ${a.duration || ''}</div>
                    </div>
                    <button data-action="deleteActivity" data-action-args="'${a.id}'" style="color:var(--text-tertiary); background:none; border:none; cursor:pointer; font-size:1.4rem; padding:4px">×</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Activity Log</h2>
                    <div style="max-height:300px; overflow-y:auto; margin-bottom:20px; padding-right:8px">
                        ${actListHtml || '<div style="opacity:0.5; padding:20px; text-align:center">No activities recorded yet.</div>'}
                    </div>
                    
                    <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:14px; border:1px solid rgba(255,255,255,0.05)">
                        <h3 style="font-size:0.8rem; margin-bottom:12px; color:var(--text-secondary)">Log New Activity</h3>
                        <div class="modal-grid-two" style="margin-bottom:10px">
                            <input type="text" id="modal-act-type" placeholder="Type (Run, Gym...)">
                            <input type="text" id="modal-act-dist" placeholder="Distance (e.g. 5km)">
                        </div>
                        <div class="modal-grid-action">
                             <input type="text" id="modal-act-dur" placeholder="Duration (e.g. 45m)">
                             <button class="btn-icon-add" data-action="addActivityFromModal" data-action-args="" aria-label="Add activity">+</button>
                        </div>
                    </div>

                    <div class="modal-actions" style="margin-top:20px">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Close</button>
                    </div>
                </div>
            `;
            break;

        case 'settings':
            const settings = getSettingsSnapshot();
            const profile = settings.profile || Store.getProfile();
            const startup = settings.startup || { policy: 'remember-last', fixedMode: 'personal', allowUrlOverride: true, lastMode: 'personal' };
            const modeVisibility = settings.modeVisibility || { personal: true, business: true, vision: true, ritual: true, library: true };
            const density = settings.density || { personal: 'full', business: 'full', vision: 'full', ritual: 'full', library: 'full' };
            const dateTime = settings.dateTime || { weekStartsOn: 'monday', dateStyle: 'system', hourCycle: 'system' };
            const accessibility = settings.accessibility || { reducedMotion: false, introAnimation: 'once-per-session' };
            const visualizerMode = settings.visualizer && settings.visualizer.mode ? settings.visualizer.mode : 'pro';

            let widgetList = getSettingsWidgetList();
            if (!widgetList.length) {
                widgetList = Object.entries(WIDGET_SETTINGS_LABELS).map(([id, name]) => ({ id, name }));
            }
            const vis = settings.widgetVisibility || Store.getWidgetVisibility();

            const visHtml = widgetList.map((w) => {
                const assignment = vis[w.id] || 'both';
                return `
                    <div class="gs-widget-row">
                        <span class="gs-widget-name">${w.name}</span>
                        <select class="modal-vis-select" data-id="${w.id}">
                            <option value="both" ${assignment === 'both' ? 'selected' : ''}>Both</option>
                            <option value="personal" ${assignment === 'personal' ? 'selected' : ''}>Personal</option>
                            <option value="business" ${assignment === 'business' ? 'selected' : ''}>Business</option>
                            <option value="hidden" ${assignment === 'hidden' ? 'selected' : ''}>Hidden</option>
                        </select>
                    </div>
                `;
            }).join('');

            const densityRows = APP_MODES.map((mode) => `
                <div class="gs-density-row">
                    <span>${mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                    <select class="gs-density-select" data-mode="${mode}">
                        <option value="minimal" ${(density[mode] || 'full') === 'minimal' ? 'selected' : ''}>Minimal</option>
                        <option value="adaptive" ${(density[mode] || 'full') === 'adaptive' ? 'selected' : ''}>Adaptive</option>
                        <option value="full" ${(density[mode] || 'full') === 'full' ? 'selected' : ''}>Full</option>
                    </select>
                </div>
            `).join('');

            const modeVisibilityRows = APP_MODES.map((mode) => `
                <label class="gs-toggle gs-mode-visibility-row">
                    <input type="checkbox" class="gs-mode-visible" data-mode="${mode}" ${modeVisibility[mode] !== false ? 'checked' : ''}>
                    <span>${mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                </label>
            `).join('');

            globalSettingsModalState = {
                initial: cloneDeep(settings),
                draft: cloneDeep(settings),
                committed: false
            };

            formHtml = `
                <div class="modal-form global-settings-modal" id="global-settings-form">
                    <h2>Global Settings</h2>

                    <section class="gs-section">
                        <h3 class="gs-title">Profile</h3>
                        <div class="modal-profile-row">
                            <input type="text" id="modal-prof-name" value="${profile.name || ''}" placeholder="Name">
                            <input type="text" id="modal-prof-avatar" value="${profile.avatar || ''}" placeholder="Avatar" maxlength="2">
                        </div>
                    </section>

                    <section class="gs-section">
                        <h3 class="gs-title">Startup</h3>
                        <div class="gs-grid-two">
                            <div class="form-group">
                                <label>Startup Policy</label>
                                <select id="modal-startup-policy">
                                    <option value="remember-last" ${startup.policy !== 'fixed-default' ? 'selected' : ''}>Remember Last Mode</option>
                                    <option value="fixed-default" ${startup.policy === 'fixed-default' ? 'selected' : ''}>Fixed Default Mode</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Fixed Default Mode</label>
                                <select id="modal-startup-fixed-mode">
                                    ${APP_MODES.map((mode) => `<option value="${mode}" ${startup.fixedMode === mode ? 'selected' : ''}>${mode.charAt(0).toUpperCase() + mode.slice(1)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <label class="gs-toggle">
                            <input type="checkbox" id="modal-startup-url-override" ${startup.allowUrlOverride !== false ? 'checked' : ''}>
                            <span>Allow URL mode override (?mode=...)</span>
                        </label>
                    </section>

                    <section class="gs-section">
                        <h3 class="gs-title">Visible Modes</h3>
                        <div class="gs-mode-visibility-grid">
                            ${modeVisibilityRows}
                        </div>
                        <p class="ui-kicker">At least one mode must stay visible.</p>
                    </section>

                    <section class="gs-section">
                        <h3 class="gs-title">Density (Per Mode)</h3>
                        <div class="gs-density-grid">
                            ${densityRows}
                        </div>
                    </section>

                    <section class="gs-section">
                        <h3 class="gs-title">Date & Time</h3>
                        <div class="gs-grid-three">
                            <div class="form-group">
                                <label>Week Starts On</label>
                                <select id="modal-dt-week-start">
                                    <option value="monday" ${dateTime.weekStartsOn !== 'sunday' ? 'selected' : ''}>Monday</option>
                                    <option value="sunday" ${dateTime.weekStartsOn === 'sunday' ? 'selected' : ''}>Sunday</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Date Style</label>
                                <select id="modal-dt-date-style">
                                    <option value="system" ${dateTime.dateStyle === 'system' ? 'selected' : ''}>System</option>
                                    <option value="iso" ${dateTime.dateStyle === 'iso' ? 'selected' : ''}>ISO (YYYY-MM-DD)</option>
                                    <option value="short" ${dateTime.dateStyle === 'short' ? 'selected' : ''}>Short</option>
                                    <option value="long" ${dateTime.dateStyle === 'long' ? 'selected' : ''}>Long</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Hour Cycle</label>
                                <select id="modal-dt-hour-cycle">
                                    <option value="system" ${dateTime.hourCycle === 'system' ? 'selected' : ''}>System</option>
                                    <option value="h12" ${dateTime.hourCycle === 'h12' ? 'selected' : ''}>12h</option>
                                    <option value="h24" ${dateTime.hourCycle === 'h24' ? 'selected' : ''}>24h</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    <section class="gs-section">
                        <h3 class="gs-title">Accessibility</h3>
                        <label class="gs-toggle">
                            <input type="checkbox" id="modal-acc-reduced-motion" ${accessibility.reducedMotion ? 'checked' : ''}>
                            <span>Reduced Motion</span>
                        </label>
                        <div class="form-group">
                            <label>Intro Animation</label>
                            <select id="modal-acc-intro">
                                <option value="once-per-session" ${accessibility.introAnimation !== 'disabled' ? 'selected' : ''}>Once Per Session</option>
                                <option value="disabled" ${accessibility.introAnimation === 'disabled' ? 'selected' : ''}>Disabled</option>
                            </select>
                        </div>
                    </section>

                    <section class="gs-section">
                        <h3 class="gs-title">Visualizer</h3>
                        <div class="form-group">
                            <label>Visualizer Mode</label>
                            <select id="modal-visualizer-mode">
                                <option value="normal" ${visualizerMode === 'normal' ? 'selected' : ''}>Normal Visualizer (legacy mixer)</option>
                                <option value="pro" ${visualizerMode === 'pro' ? 'selected' : ''}>Pro Visualizer (visual synth)</option>
                            </select>
                        </div>
                    </section>

                    <section class="gs-section">
                        <h3 class="gs-title">Widget Assignment</h3>
                        <div class="gs-widget-list">
                            ${visHtml}
                        </div>
                    </section>

                    <section class="gs-section gs-data-management">
                        <h3 class="gs-title">Data Management</h3>
                        <div class="gs-data-actions">
                            <button class="btn-secondary ui-btn ui-btn--secondary" data-action="exportData" data-action-args="" type="button">Download Backup</button>
                            <button class="btn-secondary ui-btn ui-btn--secondary" data-action="triggerFileDialog" data-action-args="'import-file'" type="button">Restore Backup</button>
                            <button class="btn-secondary ui-btn ui-btn--secondary" data-action="resetDashboard" data-action-args="" type="button" style="color:#ff6b6b; border-color:rgba(255,107,107,0.3)">Reset Board</button>
                            <button class="btn-primary ui-btn ui-btn--primary" data-action="exportDashboardAsImage" data-action-args="" type="button">Export Dashboard PNG</button>
                            <input type="file" id="import-file" style="display:none" accept=".json" data-action-change="importData" data-action-args="'__target__'">
                        </div>
                        <p class="gs-version-tag ui-kicker">Life OS ${APP_VERSION} — ${APP_EDITION}</p>
                    </section>

                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="cancelGlobalSettingsModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveGlobalSettings" data-action-args="">Save All Settings</button>
                    </div>
                </div>
            `;
            break;
    }

    switch (type) {
        case 'dailyState':
            const todayState = Store.getTodayState() || { energy: 'Medium', mood: 'Neutral', sleep: 7 };
            formHtml = `
                <div class="modal-form">
                    <h2>Log Today's State</h2>
                    <div class="form-group">
                        <label>Energy Level</label>
                        <select id="modal-ds-energy">
                            <option value="Low" ${todayState.energy === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${todayState.energy === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="High" ${todayState.energy === 'High' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Mood Tone</label>
                        <select id="modal-ds-mood">
                            <option value="Calm" ${todayState.mood === 'Calm' ? 'selected' : ''}>Calm</option>
                            <option value="Tense" ${todayState.mood === 'Tense' ? 'selected' : ''}>Tense</option>
                            <option value="Inspired" ${todayState.mood === 'Inspired' ? 'selected' : ''}>Inspired</option>
                            <option value="Neutral" ${todayState.mood === 'Neutral' ? 'selected' : ''}>Neutral</option>
                            <option value="Anxious" ${todayState.mood === 'Anxious' ? 'selected' : ''}>Anxious</option>
                            <option value="Flow" ${todayState.mood === 'Flow' ? 'selected' : ''}>Flow</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Sleep Hours</label>
                        <input type="number" step="0.5" id="modal-ds-sleep" value="${todayState.sleep}">
                    </div>
                    <div class="form-group">
                        <label>Short Note (Optional)</label>
                        <input type="text" id="modal-ds-note" value="${todayState.note || ''}" placeholder="Brief reflection...">
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'dailyState'">Save Log</button>
                    </div>
                </div>
    `;
            break;

        case 'income':
            const invoices = Store.getInvoices();
            const invHtml = invoices.map((inv, i) => `
                <div style="display:grid; grid-template-columns: 1fr 1fr 80px 80px 32px; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1); font-size:0.85rem">
                    <span>${inv.client}</span>
                    <input type="date" class="modal-inv-date" data-id="${inv.id}" value="${inv.expectedDate}">
                    <input type="number" class="modal-inv-amount" data-id="${inv.id}" value="${inv.amount}">
                    <select class="modal-inv-status" data-id="${inv.id}">
                        <option value="Open" ${inv.status === 'Open' ? 'selected' : ''}>Open</option>
                        <option value="Sent" ${inv.status === 'Sent' ? 'selected' : ''}>Sent</option>
                        <option value="Confirmed" ${inv.status === 'Confirmed' ? 'selected' : ''}>Conf.</option>
                        <option value="Paid" ${inv.status === 'Paid' ? 'selected' : ''}>Paid</option>
                    </select>
                    <button data-action="deleteInvoice" data-action-args="'${inv.id}'" style="color:#ff6b6b; background:none; border:none; cursor:pointer">×</button>
                </div>
            `).join('');

            formHtml = `
                <div class="modal-form">
                    <h2>Income Pipeline</h2>
                    <h3 style="opacity:0.7; font-size:0.8rem; margin-bottom:10px">INVOICES</h3>
                    <div style="max-height:200px; overflow-y:auto; margin-bottom:15px">
                        ${invHtml || '<p style="opacity:0.5; text-align:center">No invoices tracking.</p>'}
                    </div>
                    
                    <div class="form-group" style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px">
                        <label>Add Invoice</label>
                        <div style="display:grid; grid-template-columns: 1fr 80px; gap:8px; margin-bottom:8px">
                            <input type="text" id="new-inv-client" placeholder="Client Name">
                            <input type="number" id="new-inv-amount" placeholder="Amount">
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px">
                            <input type="date" id="new-inv-date" value="${new Date().toISOString().split('T')[0]}">
                            <select id="new-inv-status">
                                <option value="Open">Open</option>
                                <option value="Sent">Sent</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Paid">Paid</option>
                            </select>
                            <button class="btn-primary ui-btn ui-btn--primary" data-action="addNewInvoice" data-action-args="">Add</button>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Close</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'income'">Save Changes</button>
                    </div>
                </div>
            `;
            break;

        case 'season':
            const activeSeason = Store.getActiveSeason();
            const seasonsList = Store.getSeasonsData();

            formHtml = `
                <div class="modal-form">
                    <h2>Current Season</h2>
                    <div class="form-group">
                        <label>Season Name</label>
                        <input type="text" id="modal-sea-name" value="${activeSeason ? activeSeason.name : ''}">
                    </div>
                    <div class="form-group">
                        <label>Focus Sentence</label>
                        <textarea id="modal-sea-focus">${activeSeason ? activeSeason.focus : ''}</textarea>
                    </div>
                    <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
                        <div>
                            <label>Start</label>
                            <input type="date" id="modal-sea-start" value="${activeSeason ? activeSeason.start : ''}">
                        </div>
                        <div>
                            <label>End</label>
                            <input type="date" id="modal-sea-end" value="${activeSeason ? activeSeason.end : ''}">
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn-secondary ui-btn ui-btn--secondary" data-action="closeModal" data-action-args="">Cancel</button>
                        <button class="btn-primary ui-btn ui-btn--primary" data-action="saveWidgetData" data-action-args="'season'">Save Season</button>
                    </div>
                </div>
            `;
            break;
    }

    if (formHtml) {
        body.innerHTML = formHtml;
        overlay.classList.add('active');
        if (type === 'settings') {
            bindGlobalSettingsModal();
        }
    }
}

function closeModal() {
    if (typeof window.closeModal === 'function' && window.closeModal !== closeModal) {
        window.closeModal();
        return;
    }

    const overlay = $('#modal-overlay');
    const content = $('#modal-content');
    teardownSettingsModalPreviewOnClose(overlay);
    if (overlay) overlay.classList.remove('active');
    if (overlay) overlay.removeAttribute('data-type');
    if (content) {
        content.style.width = '';
        content.style.maxWidth = '';
        content.classList.remove('modal-large');
    }
}

function saveWidgetData(type) {
    const v2Data = Store.getV2Data();

    if (type === 'financeOverview') {
        const finData = Store.getFinance();
        finData.balance = parseFloat($('#modal-fin-balance').value) || 0;
        Store.saveFinance(finData);

        v2Data.financialReality.debtLeft = parseInt($('#modal-fr-debt').value) || 0;
        v2Data.financialReality.runwayMonths = parseFloat($('#modal-fr-runway').value) || 0;
        v2Data.financialReality.monthlyTarget = parseInt($('#modal-fr-target').value) || 0;
        Store.saveV2Data(v2Data);
        renderFinance();
    } else if (type === 'goals') {
        const goals = Store.getGoals();
        const progressInputs = $$('.modal-goal-progress');
        progressInputs.forEach(input => {
            const id = input.dataset.id;
            const goal = goals.find(g => g.id === id);
            if (goal) goal.progress = Math.min(100, Math.max(0, parseInt(input.value) || 0));
        });
        Store.saveGoals(goals);
        renderGoals();
    } else if (type === 'habitsRituals') {
        const itemInputs = $$('.modal-rhythm-item-edit');
        const rhythm = v2Data.dailyRhythm || [];

        itemInputs.forEach(input => {
            const pIdx = input.dataset.phase;
            const iIdx = input.dataset.item;
            if (rhythm[pIdx] && rhythm[pIdx].items[iIdx]) {
                rhythm[pIdx].items[iIdx].text = input.value.trim();
            }
        });

        v2Data.dailyRhythm = rhythm;
        Store.saveV2Data(v2Data);
        renderDailyRhythm();
    } else if (type === 'northStar') {
        v2Data.northStar.focus = $('#modal-ns-focus').value;
        v2Data.northStar.intention = $('#modal-ns-intent').value;
        v2Data.northStar.priorities = $('#modal-ns-priorities').value.split(',').map(s => s.trim()).filter(s => s);
        Store.saveV2Data(v2Data);
        renderNorthStar();
    } else if (type === 'visualConfig') {
        if (!v2Data.visual) v2Data.visual = {};
        v2Data.visual.font = $('#modal-visual-font').value;
        v2Data.visual.brightness = parseInt($('#modal-visual-brightness').value);
        Store.saveV2Data(v2Data);
        document.body.style.fontFamily = v2Data.visual.font;
        document.body.style.filter = `brightness(${v2Data.visual.brightness}%)`;
        closeModal();
    } else if (type === 'creativePulse') {
        const compass = Store.getCompassData();
        const nameEdits = $$('.modal-cp-name-edit');
        const stageEdits = $$('.modal-cp-stage-edit');
        const priorityEdits = $$('.modal-cp-priority-edit');

        nameEdits.forEach((input, i) => {
            const id = input.dataset.id;
            const project = compass.projects.find(p => p.id === id);
            if (project) {
                project.name = input.value;
                project.stage = stageEdits[i].value;
                project.priorityWeight = parseInt(priorityEdits[i].value) || 0;
            }
        });

        Store.saveCompassData(compass);
        renderCreativeCompass();
    } else if (type === 'worlds') {
        const nameEdits = $$('.modal-world-name-edit');
        const stateEdits = $$('.modal-world-state-edit');
        const actionEdits = $$('.modal-world-action-edit');

        nameEdits.forEach((input, i) => {
            const idx = input.dataset.index;
            v2Data.activeWorlds[idx].name = input.value;
            v2Data.activeWorlds[idx].state = stateEdits[i].value;
            v2Data.activeWorlds[idx].nextAction = actionEdits[i].value;
        });
        Store.saveV2Data(v2Data);
        renderWorlds();
    } else if (type === 'people') {
        // Save edits to existing people
        const nameEdits = $$('.modal-person-name-edit');
        const roleEdits = $$('.modal-person-role-edit');
        const promptEdits = $$('.modal-person-prompt-edit');

        nameEdits.forEach((input, i) => {
            const idx = input.dataset.index;
            v2Data.people[idx].name = input.value;
            v2Data.people[idx].role = roleEdits[i].value;
            v2Data.people[idx].prompt = promptEdits[i].value;
        });
        Store.saveV2Data(v2Data);
        renderPeople();
    } else if (type === 'reflection') {
        v2Data.reflection.win = $('#modal-refl-win').value;
        v2Data.reflection.lesson = $('#modal-refl-lesson').value;
        v2Data.reflection.nextShift = $('#modal-refl-next').value;
        Store.saveV2Data(v2Data);
        renderReflection();
    } else if (type === 'revenueEngine') {
        v2Data.revenueEngine.today = parseInt($('#modal-rev-today').value) || 0;
        v2Data.revenueEngine.pipeline = parseInt($('#modal-rev-pipe').value) || 0;
        v2Data.revenueEngine.invoices = parseInt($('#modal-rev-inv').value) || 0;
        v2Data.revenueEngine.deals = parseInt($('#modal-rev-deals').value) || 0;
        Store.saveV2Data(v2Data);
        renderBusinessWidgets();
    } else if (type === 'bizFinance') {
        v2Data.financialReality.cash90 = parseInt($('#modal-biz-cash').value) || 0;
        v2Data.financialReality.monthlyBurn = parseInt($('#modal-biz-burn').value) || 0;
        v2Data.financialReality.runwayMonths = parseFloat($('#modal-biz-runway').value) || 0;
        v2Data.financialReality.monthlyTarget = parseInt($('#modal-biz-target').value) || 4000;

        // Smart Recalculation (if runway not manually touched)
        if ($('#modal-biz-runway').value === v2Data.financialReality.runwayMonths.toString()) {
            if (v2Data.financialReality.monthlyBurn > 0) {
                v2Data.financialReality.runwayMonths = v2Data.financialReality.cash90 / v2Data.financialReality.monthlyBurn;
            }
        }

        Store.saveV2Data(v2Data);
        renderBusinessWidgets();
        renderSystemHealth();
    } else if (type === 'bizContent') {
        v2Data.bizContent.minutesCreated = parseInt($('#modal-bc-mins').value) || 0;
        v2Data.bizContent.piecesFinished = parseInt($('#modal-bc-pieces').value) || 0;
        v2Data.bizContent.audienceGrowth = parseInt($('#modal-bc-growth').value) || 0;
        v2Data.bizContent.stage = $('#modal-bc-stage').value;
        Store.saveV2Data(v2Data);
        renderBusinessWidgets();
    } else if (type === 'sport') {
        // Activities are saved immediately via add/delete
        renderActivityLog();
    } else if (type === 'dailyState') {
        const entry = {
            date: new Date().toISOString(),
            energy: $('#modal-ds-energy').value,
            mood: $('#modal-ds-mood').value,
            sleep: parseFloat($('#modal-ds-sleep').value) || 0,
            note: $('#modal-ds-note').value.trim()
        };
        Store.addDailyState(entry);
        renderDailyState();
    } else if (type === 'income') {
        // Save existing edits
        const inputsAmt = $$('.modal-inv-amount');
        const inputsDate = $$('.modal-inv-date');
        const inputsStatus = $$('.modal-inv-status');

        inputsAmt.forEach((inp, i) => {
            const id = inp.dataset.id;
            Store.updateInvoice(id, {
                amount: parseFloat(inp.value) || 0,
                expectedDate: inputsDate[i].value,
                status: inputsStatus[i].value
            });
        });
        renderFinance();
    } else if (type === 'season') {
        const active = Store.getActiveSeason();
        const updates = {
            name: $('#modal-sea-name').value.trim(),
            focus: $('#modal-sea-focus').value.trim(),
            start: $('#modal-sea-start').value,
            end: $('#modal-sea-end').value,
            active: true
        };

        if (active) {
            Store.updateSeason(active.id, updates);
        } else {
            // Create new if none
            Store.saveSeasonsData([{ id: 's-' + Date.now(), ...updates }]);
        }
        renderSeasons();
    } else if (type === 'rituals') {
        const mEdits = $$('.modal-ritual-m-edit');
        const eEdits = $$('.modal-ritual-e-edit');
        const v4rituals = v2Data.rituals || { morning: [], evening: [] };
        mEdits.forEach((el, i) => {
            const idx = el.dataset.index;
            v4rituals.morning[idx].text = el.value;
        });
        eEdits.forEach((el, i) => {
            const idx = el.dataset.index;
            v4rituals.evening[idx].text = el.value;
        });
        v2Data.rituals = v4rituals;
        Store.saveV2Data(v2Data);
        renderRituals();
    } else if (type === 'ritualGratitude') {
        const gratData = {
            lines: [
                document.getElementById('modal-grat-1')?.value || '',
                document.getElementById('modal-grat-2')?.value || '',
                document.getElementById('modal-grat-3')?.value || ''
            ]
        };
        Store.saveRitualGratitudeToday(gratData);
        renderRitualWidgets();
    }


    closeModal();
}

// ---- Visual Controls ----

let visualSynthControlsBound = false;
let legacyVisualControlsBound = false;
let legacyAtmosphereSyncTimer = null;
let legacyVisualState = null;
let visualizerMode = 'pro';

const LEGACY_VISUAL_INPUT_MAP = {
    hue: 'vs-hue',
    brightness: 'vs-brightness',
    saturation: 'vs-saturation',
    grain: 'vs-grain',
    speed: 'vs-speed',
    temperature: 'vs-temperature',
    contrast: 'vs-contrast',
    calmness: 'vs-calmness',
    accentHue: 'vs-accent-hue',
    syncWithTimeOfDay: 'vs-time-sync'
};

function clampVisual(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function coerceVisualNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeLegacyVisual(config) {
    const defaults = (Store && Store.defaultVisual) ? Store.defaultVisual : {};
    const merged = { ...defaults, ...(config || {}) };
    return {
        ...merged,
        hue: clampVisual(coerceVisualNumber(merged.hue, 0), -180, 180),
        brightness: clampVisual(coerceVisualNumber(merged.brightness, 80), 30, 150),
        saturation: clampVisual(coerceVisualNumber(merged.saturation, 100), 40, 180),
        grain: clampVisual(coerceVisualNumber(merged.grain, 0), 0, 100),
        speed: clampVisual(coerceVisualNumber(merged.speed, 25), 0, 100),
        temperature: clampVisual(coerceVisualNumber(merged.temperature, 0), -100, 100),
        contrast: clampVisual(coerceVisualNumber(merged.contrast, 40), 0, 100),
        calmness: clampVisual(coerceVisualNumber(merged.calmness, 35), 0, 100),
        accentHue: clampVisual(coerceVisualNumber(merged.accentHue, 0), -180, 180),
        syncWithTimeOfDay: Boolean(merged.syncWithTimeOfDay)
    };
}

function getStoredVisualizerMode() {
    if (Store && typeof Store.getVisualizerMode === 'function') {
        return Store.getVisualizerMode();
    }
    return 'pro';
}

function setDockVisualizerModeLabel(mode) {
    const btn = $('#btn-visual-config');
    if (!btn) return;
    btn.dataset.visualizerMode = mode;
    btn.title = mode === 'normal' ? 'Visualizer: Normal' : 'Visualizer: Pro';
}

function getLegacyVisualStyleElement() {
    let styleTag = document.getElementById('visual-dynamic');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'visual-dynamic';
        document.head.appendChild(styleTag);
    }
    return styleTag;
}

function setLegacyVisualInputs(config) {
    Object.entries(LEGACY_VISUAL_INPUT_MAP).forEach(([key, id]) => {
        const input = document.getElementById(id);
        if (!input) return;
        if (input.type === 'checkbox') {
            input.checked = Boolean(config[key]);
        } else {
            input.value = String(config[key]);
        }
    });
}

function closeLegacyVisualizer() {
    const popup = $('#visual-popup');
    if (!popup) return;
    popup.classList.remove('active');
    popup.setAttribute('aria-hidden', 'true');
}

function openLegacyVisualizer() {
    const popup = $('#visual-popup');
    if (!popup) return;
    popup.classList.add('active');
    popup.setAttribute('aria-hidden', 'false');
}

function toggleLegacyVisualizer() {
    const popup = $('#visual-popup');
    if (!popup) return;
    if (popup.classList.contains('active')) {
        closeLegacyVisualizer();
    } else {
        openLegacyVisualizer();
    }
}

function deriveTimeSyncedVisual(baseState) {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const phase = (hour / 24) * Math.PI * 2;
    const daylight = Math.sin(phase - Math.PI / 2); // -1 night, +1 midday

    return normalizeLegacyVisual({
        ...baseState,
        hue: baseState.hue + Math.cos(phase) * 12,
        brightness: baseState.brightness + daylight * 14,
        saturation: baseState.saturation + daylight * 10,
        temperature: baseState.temperature + daylight * 20
    });
}

function applyLegacyVisualConfig(config) {
    const styleTag = getLegacyVisualStyleElement();
    const hueShift = config.hue + config.temperature * 0.18;
    const saturation = clampVisual(config.saturation / 100 + config.temperature / 260, 0.35, 2.2);
    const brightness = clampVisual(config.brightness / 100, 0.35, 1.8);
    const contrast = clampVisual(0.75 + config.contrast / 100, 0.55, 2.1);
    const calmness = clampVisual(config.calmness / 100, 0, 1);
    const speedFactor = clampVisual(0.45 + config.speed / 90, 0.35, 2.4);
    const speedMultiplier = 1 + calmness * 0.55;
    const durationBefore = (28 / speedFactor) * speedMultiplier;
    const blur = (1 - calmness) * 1.4;
    const grainOpacity = clampVisual(config.grain / 420, 0, 0.24);
    const accentHue = ((config.accentHue % 360) + 360) % 360;

    document.documentElement.style.setProperty('--grain-opacity', grainOpacity.toFixed(3));
    document.documentElement.style.setProperty('--text-accent', `hsl(${accentHue.toFixed(1)}deg 78% 72%)`);

    styleTag.textContent = `
body:not(.visual-synth-active)::before {
    animation-duration: ${durationBefore.toFixed(2)}s !important;
    filter: hue-rotate(${hueShift.toFixed(1)}deg) saturate(${saturation.toFixed(3)}) brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) blur(${blur.toFixed(2)}px) !important;
}
body:not(.visual-synth-active)::after {
    opacity: ${grainOpacity.toFixed(3)} !important;
}
`;

    const vignette = $('#vignette-overlay');
    if (vignette) {
        const vignetteAlpha = clampVisual(0.14 + (1 - calmness) * 0.22 + config.contrast / 420, 0.08, 0.45);
        const vignetteRadius = Math.round(120 + config.calmness * 1.4);
        vignette.style.boxShadow = `inset 0 0 ${vignetteRadius}px rgba(0, 0, 0, ${vignetteAlpha.toFixed(3)})`;
    }
}

function applyLegacyVisualFromState() {
    if (!legacyVisualState) {
        legacyVisualState = normalizeLegacyVisual(Store.getVisual());
    }
    const resolved = legacyVisualState.syncWithTimeOfDay
        ? deriveTimeSyncedVisual(legacyVisualState)
        : legacyVisualState;
    applyLegacyVisualConfig(resolved);
}

function startLegacyAtmosphereSync() {
    stopLegacyAtmosphereSync();
    applyLegacyVisualFromState();
    legacyAtmosphereSyncTimer = window.setInterval(() => {
        if (visualizerMode !== 'normal') return;
        if (!legacyVisualState || !legacyVisualState.syncWithTimeOfDay) return;
        applyLegacyVisualFromState();
    }, 45000);
}

function stopLegacyAtmosphereSync() {
    if (legacyAtmosphereSyncTimer) {
        clearInterval(legacyAtmosphereSyncTimer);
        legacyAtmosphereSyncTimer = null;
    }
}

function bindLegacyVisualizerControls() {
    if (legacyVisualControlsBound) return;

    const popup = $('#visual-popup');
    if (!popup) return;

    Object.entries(LEGACY_VISUAL_INPUT_MAP).forEach(([key, id]) => {
        const input = document.getElementById(id);
        if (!input || input.type === 'checkbox') return;
        input.addEventListener('input', () => {
            legacyVisualState = normalizeLegacyVisual({
                ...(legacyVisualState || Store.getVisual()),
                [key]: Number(input.value)
            });
            Store.saveVisual(legacyVisualState);
            applyLegacyVisualFromState();
        });
    });

    const syncToggle = document.getElementById(LEGACY_VISUAL_INPUT_MAP.syncWithTimeOfDay);
    if (syncToggle) {
        syncToggle.addEventListener('change', () => {
            legacyVisualState = normalizeLegacyVisual({
                ...(legacyVisualState || Store.getVisual()),
                syncWithTimeOfDay: syncToggle.checked
            });
            Store.saveVisual(legacyVisualState);
            if (legacyVisualState.syncWithTimeOfDay) {
                startLegacyAtmosphereSync();
            } else {
                stopLegacyAtmosphereSync();
            }
            applyLegacyVisualFromState();
        });
    }

    const resetBtn = $('#vs-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            legacyVisualState = normalizeLegacyVisual(Store.resetVisual());
            setLegacyVisualInputs(legacyVisualState);
            if (legacyVisualState.syncWithTimeOfDay) {
                startLegacyAtmosphereSync();
            } else {
                stopLegacyAtmosphereSync();
            }
            applyLegacyVisualFromState();
        });
    }

    const closeBtn = $('#vs-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeLegacyVisualizer();
        });
    }

    legacyVisualControlsBound = true;
}

function initLegacyVisualizer() {
    bindLegacyVisualizerControls();
    legacyVisualState = normalizeLegacyVisual(Store.getVisual());
    setLegacyVisualInputs(legacyVisualState);
    applyLegacyVisualFromState();
    if (legacyVisualState.syncWithTimeOfDay) {
        startLegacyAtmosphereSync();
    } else {
        stopLegacyAtmosphereSync();
    }
}

function activateProVisualizer() {
    if (!window.VisualSynthApp || typeof window.VisualSynthApp.init !== 'function') {
        return false;
    }
    const initialized = window.VisualSynthApp.init({ store: window.Store || Store });
    if (!initialized) return false;
    if (typeof window.VisualSynthApp.activate === 'function') {
        window.VisualSynthApp.activate();
    } else {
        document.body.classList.add('visual-synth-active');
    }
    return true;
}

function deactivateProVisualizer() {
    if (window.VisualSynthApp && typeof window.VisualSynthApp.deactivate === 'function') {
        window.VisualSynthApp.deactivate();
    } else {
        const synthOverlay = $('#visual-synth-overlay');
        if (synthOverlay) synthOverlay.classList.remove('active');
        document.body.classList.remove('visual-synth-active');
    }
}

function setVisualizerMode(mode, options = {}) {
    const persist = options.persist !== false;
    let nextMode = mode === 'normal' ? 'normal' : 'pro';

    if (nextMode === 'pro' && (!window.VisualSynthApp || typeof window.VisualSynthApp.init !== 'function')) {
        nextMode = 'normal';
    }

    if (persist && Store && typeof Store.saveVisualizerMode === 'function') {
        nextMode = Store.saveVisualizerMode(nextMode);
    }

    visualizerMode = nextMode;
    setDockVisualizerModeLabel(visualizerMode);

    if (visualizerMode === 'pro') {
        closeLegacyVisualizer();
        stopLegacyAtmosphereSync();
        const vignette = $('#vignette-overlay');
        if (vignette) vignette.style.boxShadow = 'none';
        if (!activateProVisualizer()) {
            visualizerMode = 'normal';
            setDockVisualizerModeLabel(visualizerMode);
            if (persist && Store && typeof Store.saveVisualizerMode === 'function') {
                Store.saveVisualizerMode('normal');
            }
            deactivateProVisualizer();
            initLegacyVisualizer();
        }
    } else {
        deactivateProVisualizer();
        initLegacyVisualizer();
    }

    return visualizerMode;
}

function initVisualControls() {
    const btn = $('#btn-visual-config');
    if (!btn) return;

    if (!visualSynthControlsBound) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (visualizerMode === 'normal') {
                toggleLegacyVisualizer();
                return;
            }

            closeLegacyVisualizer();
            if (!activateProVisualizer()) {
                setVisualizerMode('normal', { persist: true });
                openLegacyVisualizer();
                return;
            }
            window.VisualSynthApp.toggle();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && visualizerMode === 'normal') {
                closeLegacyVisualizer();
            }
        });

        visualSynthControlsBound = true;
    }

    setVisualizerMode(getStoredVisualizerMode(), { persist: false });
}

// Attach these to window so they can be called from onclick in dynamic HTML
if (typeof window.closeModal !== 'function') {
    window.closeModal = closeModal;
}
window.saveWidgetData = saveWidgetData;

window.openDayDetail = function (dateStr) {
    const events = Store.getEvents().filter(e => e.date === dateStr);
    const dateObj = new Date(dateStr);
    const title = dateObj.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long' });

    let html = `
        <div class="modal-form">
            <h2>${title}</h2>
            <div style="margin-bottom: 20px">
                <h3>Events</h3>
                ${events.length ? events.map(e => `
                    <div style="padding: 12px; background: rgba(255,255,255,0.05); margin-bottom: 8px; border-radius: 8px">
                        <strong>${e.time} - ${e.name}</strong>
                        ${e.description ? `<p style="font-size: 0.85rem; opacity: 0.7; margin-top: 4px">${e.description}</p>` : ''}
                    </div>
                `).join('') : '<p style="opacity: 0.5">No events scheduled for this day.</p>'}
            </div>
            <div class="modal-actions">
                <button class="btn-primary ui-btn ui-btn--primary" data-action="closeModal" data-action-args="">Close</button>
            </div>
        </div>
    `;

    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('active');
};
// --- Calendar Helpers ---
window.addNewEvent = function () {
    const date = $('#new-ev-date').value;
    const time = $('#new-ev-time').value;
    const name = $('#new-ev-name').value.trim();
    const description = $('#new-ev-desc').value.trim();

    if (!time || !name || !date) return;

    const events = Store.getEvents();
    events.push({ date, time, name, description, type: 'work' });
    Store.saveEvents(events);

    renderCalendar();
    openEditModal('calendar');
};

window.deleteEvent = function (idx) {
    const events = Store.getEvents();
    events.splice(idx, 1);
    Store.saveEvents(events);
    renderCalendar();
    openEditModal('calendar');
};

// --- Creative Pulse Helpers ---
window.addNewProject = function () {
    const name = $('#new-cp-project').value.trim();
    const hours = parseInt($('#new-cp-hours').value) || 0;
    if (!name) return;

    Store.addProject({
        name,
        progress: 0,
        targetHours: hours,
        loggedMinutes: 0
    });

    renderCreativePulse();
    openEditModal('creativePulse');
};

window.deleteProject = function (idx) {
    Store.deleteProject(idx);
    renderCreativePulse();
    openEditModal('creativePulse');
};

// --- People Helpers ---
window.addPerson = function () {
    const name = $('#modal-person-name').value.trim();
    const role = $('#modal-person-role').value.trim();
    const prompt = $('#modal-person-prompt').value.trim();
    if (!name) return;

    Store.addPerson({ name, role, prompt });
    openEditModal('people');
    renderPeople();
};

window.deletePerson = function (idx) {
    Store.deletePerson(idx);
    openEditModal('people');
    renderPeople();
};

function readGlobalSettingsDraftFromForm() {
    const seed = (globalSettingsModalState && globalSettingsModalState.draft)
        ? cloneDeep(globalSettingsModalState.draft)
        : getSettingsSnapshot();

    const name = ($('#modal-prof-name') ? $('#modal-prof-name').value : '').trim();
    const avatarRaw = ($('#modal-prof-avatar') ? $('#modal-prof-avatar').value : '').trim();
    const startupPolicy = ($('#modal-startup-policy') ? $('#modal-startup-policy').value : 'remember-last');
    const fixedMode = ($('#modal-startup-fixed-mode') ? $('#modal-startup-fixed-mode').value : 'personal');
    const allowUrlOverride = Boolean($('#modal-startup-url-override') && $('#modal-startup-url-override').checked);

    const next = cloneDeep(seed);
    next.profile = {
        name: name || (seed.profile && seed.profile.name) || 'Guest User',
        avatar: (avatarRaw || ((name || (seed.profile && seed.profile.name) || 'G').charAt(0))).slice(0, 2).toUpperCase()
    };

    next.startup = {
        policy: startupPolicy === 'fixed-default' ? 'fixed-default' : 'remember-last',
        fixedMode: APP_MODES.includes(fixedMode) ? fixedMode : 'personal',
        allowUrlOverride: allowUrlOverride,
        lastMode: (seed.startup && seed.startup.lastMode) || ((window.ModeManager && typeof ModeManager.getMode === 'function') ? ModeManager.getMode() : 'personal')
    };

    const modeVisibility = {};
    $$('.gs-mode-visible').forEach((el) => {
        const mode = String(el.dataset.mode || '').trim();
        if (!APP_MODES.includes(mode)) return;
        modeVisibility[mode] = Boolean(el.checked);
    });
    APP_MODES.forEach((mode) => {
        if (modeVisibility[mode] === undefined) {
            modeVisibility[mode] = seed.modeVisibility && seed.modeVisibility[mode] !== false;
        }
    });
    if (!APP_MODES.some((mode) => modeVisibility[mode])) {
        modeVisibility.personal = true;
    }
    next.modeVisibility = modeVisibility;

    const visibleModes = APP_MODES.filter((mode) => next.modeVisibility[mode]);
    const fallbackVisibleMode = visibleModes[0] || 'personal';
    if (!visibleModes.includes(next.startup.fixedMode)) {
        next.startup.fixedMode = fallbackVisibleMode;
    }
    if (!visibleModes.includes(next.startup.lastMode)) {
        next.startup.lastMode = fallbackVisibleMode;
    }

    next.density = next.density || {};
    $$('.gs-density-select').forEach((el) => {
        const mode = String(el.dataset.mode || '').trim();
        if (!APP_MODES.includes(mode)) return;
        next.density[mode] = ['minimal', 'adaptive', 'full'].includes(el.value) ? el.value : 'full';
    });

    next.dateTime = {
        weekStartsOn: ($('#modal-dt-week-start') && $('#modal-dt-week-start').value === 'sunday') ? 'sunday' : 'monday',
        dateStyle: ($('#modal-dt-date-style') && ['system', 'iso', 'short', 'long'].includes($('#modal-dt-date-style').value)) ? $('#modal-dt-date-style').value : 'system',
        hourCycle: ($('#modal-dt-hour-cycle') && ['system', 'h12', 'h24'].includes($('#modal-dt-hour-cycle').value)) ? $('#modal-dt-hour-cycle').value : 'system'
    };

    next.accessibility = {
        reducedMotion: Boolean($('#modal-acc-reduced-motion') && $('#modal-acc-reduced-motion').checked),
        introAnimation: ($('#modal-acc-intro') && $('#modal-acc-intro').value === 'disabled') ? 'disabled' : 'once-per-session'
    };

    next.visualizer = {
        mode: ($('#modal-visualizer-mode') && $('#modal-visualizer-mode').value === 'normal') ? 'normal' : 'pro'
    };

    const widgetVisibility = {};
    $$('.modal-vis-select').forEach((sel) => {
        const widgetId = String(sel.dataset.id || '').trim();
        if (!widgetId) return;
        widgetVisibility[widgetId] = ['both', 'personal', 'business', 'hidden'].includes(sel.value) ? sel.value : 'both';
    });
    next.widgetVisibility = widgetVisibility;

    return next;
}

function syncStartupPolicyUi() {
    const policyEl = $('#modal-startup-policy');
    const fixedModeEl = $('#modal-startup-fixed-mode');
    if (!policyEl || !fixedModeEl) return;

    const modeVisibility = {};
    $$('.gs-mode-visible').forEach((el) => {
        const mode = String(el.dataset.mode || '').trim();
        if (!APP_MODES.includes(mode)) return;
        modeVisibility[mode] = Boolean(el.checked);
    });
    APP_MODES.forEach((mode) => {
        if (modeVisibility[mode] === undefined) modeVisibility[mode] = true;
    });
    if (!APP_MODES.some((mode) => modeVisibility[mode])) {
        modeVisibility.personal = true;
        const personalCheckbox = $('.gs-mode-visible[data-mode="personal"]');
        if (personalCheckbox) personalCheckbox.checked = true;
    }

    const visibleModes = APP_MODES.filter((mode) => modeVisibility[mode]);
    const fallbackVisibleMode = visibleModes[0] || 'personal';
    Array.from(fixedModeEl.options).forEach((option) => {
        const mode = String(option.value || '').trim();
        const isVisible = visibleModes.includes(mode);
        option.disabled = !isVisible;
        option.hidden = !isVisible;
    });
    if (!visibleModes.includes(fixedModeEl.value)) {
        fixedModeEl.value = fallbackVisibleMode;
    }

    const fixedEnabled = policyEl.value === 'fixed-default';
    fixedModeEl.disabled = !fixedEnabled;
    fixedModeEl.classList.toggle('is-disabled', !fixedEnabled);
}

function previewGlobalSettingsFromForm() {
    if (!globalSettingsModalState) return;
    const draft = readGlobalSettingsDraftFromForm();
    globalSettingsModalState.draft = cloneDeep(draft);
    Store.saveSettings(draft, { persist: false });
    syncStartupPolicyUi();
    applyGlobalSettingsToUi(draft);
}

function bindGlobalSettingsModal() {
    const form = $('#global-settings-form');
    if (!form) return;

    syncStartupPolicyUi();
    form.addEventListener('change', previewGlobalSettingsFromForm);
    form.addEventListener('input', (event) => {
        const target = event.target;
        if (!target) return;
        const tag = String(target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') {
            previewGlobalSettingsFromForm();
        }
    });

    previewGlobalSettingsFromForm();
}

window.cancelGlobalSettingsModal = function () {
    if (globalSettingsModalState && globalSettingsModalState.initial) {
        Store.saveSettings(globalSettingsModalState.initial, { persist: false });
        applyGlobalSettingsToUi(globalSettingsModalState.initial);
    }
    globalSettingsModalState = null;
    closeModal();
};

window.saveGlobalSettings = function () {
    const draft = readGlobalSettingsDraftFromForm();
    const saved = Store.saveSettings(draft, { persist: true });
    Store.saveWidgetVisibility(saved.widgetVisibility || {});

    globalSettingsModalState = globalSettingsModalState || { initial: cloneDeep(saved), draft: cloneDeep(saved), committed: false };
    globalSettingsModalState.draft = cloneDeep(saved);
    globalSettingsModalState.committed = true;

    applyGlobalSettingsToUi(saved);
    closeModal();
};

function applyWidgetVisibility() {
    const vis = Store.getWidgetVisibility();
    const currentMode = typeof ModeManager !== 'undefined' ? ModeManager.getMode() : 'personal';
    const widgets = $$('.widget');

    widgets.forEach(w => {
        const assignment = vis[w.id] || 'both'; // Default to both

        let shouldShow = true;
        if (assignment === 'hidden') {
            shouldShow = false;
        } else if (assignment === 'personal' && currentMode !== 'personal') {
            shouldShow = false;
        } else if (assignment === 'business' && currentMode !== 'business') {
            shouldShow = false;
        }

        if (shouldShow) {
            w.classList.remove('hidden');
        } else {
            w.classList.add('hidden');
        }
    });

    // distributeWidgets(); // DISABLED: Prevents layout reshuffling/crashing on mode switch
}

function distributeWidgets() {
    const cols = [$('.col-left'), $('.col-center'), $('.col-right')];
    if (!cols[0] || !cols[1] || !cols[2]) return;

    const pinnedWidgets = Store.getPinnedWidgets() || [];

    // Get all widgets, excluding topbar and pinned ones
    const allWidgets = $$('.widget');
    const movableWidgets = Array.from(allWidgets).filter(w => {
        return !w.classList.contains('hidden') &&
            w.id !== 'topbar' &&
            !pinnedWidgets.includes(w.id);
    });

    // Distribute remaining movable widgets into columns
    // We try to fill the columns starting from where unpinned slots are available
    movableWidgets.forEach((w, i) => {
        const targetCol = cols[i % 3];
        if (w.parentElement !== targetCol) {
            targetCol.appendChild(w);
        }
    });

    // Ensure pinned widgets are in their correct column (if layout was saved)
    // The initDragging layout load already handles this on boot.
    // If user pins/unpins, we might want to re-save.

    // Ensure topbar is at the start of col-center
    const topbar = $('#topbar');
    if (topbar && topbar.parentElement !== cols[1]) {
        cols[1].prepend(topbar);
    }
}

function initWidgetControls() {
    const widgets = $$('.widget, .vision-widget, .ritual-widget');
    const pinned = Store.getPinnedWidgets() || [];

    widgets.forEach(widget => {
        if (widget.id === 'topbar' || !widget.id) return;

        // Remove existing pin if any (to prevent doubles on re-init)
        const oldPin = widget.querySelector('.btn-pin-widget');
        if (oldPin) oldPin.remove();

        const pinBtn = document.createElement('button');
        pinBtn.className = 'btn-pin-widget';
        if (pinned.includes(widget.id)) pinBtn.classList.add('active');
        pinBtn.title = 'Pin Widget to this column';
        pinBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="17" x2="12" y2="22"></line>
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.79-.9A2 2 0 0 1 15 10.76V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.76a2 2 0 0 1-1.1 1.79l-1.79.9A2 2 0 0 0 5 15.24V17z"></path>
            </svg>
        `;

        pinBtn.onclick = (e) => {
            e.stopPropagation();
            const isActive = Store.togglePin(widget.id);
            pinBtn.classList.toggle('active', isActive);

            // If pinned, save current layout so it knows which column it's in
            if (isActive) saveCurrentLayout();

            // Re-distribute unpinned ones around the new pin
            distributeWidgets();
        };

        widget.appendChild(pinBtn);
    });
}



// --- Goals Helpers ---
window.addGoal = function () {
    const name = $('#modal-goal-name').value.trim();
    const target = $('#modal-goal-target').value.trim();
    if (!name) return;

    Store.addGoal({
        id: 'g-' + Date.now(),
        name,
        target,
        progress: 0,
        icon: '🎯',
        category: 'other'
    });
    openEditModal('goals');
    renderGoals();
};

window.deleteGoal = function (id) {
    Store.deleteGoal(id);
    openEditModal('goals');
    renderGoals();
};

// --- Habits Helpers ---
window.addHabit = function () {
    const name = $('#modal-habit-name').value.trim();
    if (!name) return;

    Store.addHabit({
        id: 'h-' + Date.now(),
        name,
        icon: '⚡',
        category: 'health'
    });
    openEditModal('goals'); // Habits are in goals modal
    renderHabits();
};

window.deleteHabit = function (id) {
    Store.deleteHabit(id);
    openEditModal('goals');
    renderHabits();
};

// --- Worlds Helpers ---
window.addWorld = function () {
    const name = $('#modal-world-name').value.trim();
    const state = $('#modal-world-state').value.trim();
    const nextAction = $('#modal-world-action').value.trim();
    if (!name) return;

    Store.addWorld({ name, state, nextAction });
    openEditModal('worlds');
    renderWorlds();
};

window.deleteWorld = function (idx) {
    Store.deleteWorld(idx);
    openEditModal('worlds');
    renderWorlds();
};

// --- Journal Helpers ---
window.openJournalFeed = function () {
    const entries = Store.getJournalEntries();
    const body = $('#modal-body');
    const overlay = $('#modal-overlay');

    const entriesHtml = entries.map(e => {
        const d = new Date(e.date);
        const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Proposal 4: Mood dots
        const moodClass = e.mood ? e.mood.toLowerCase() : '';
        const moodDotHtml = e.mood ? `<span class="mood-dot ${moodClass}" title="Mood: ${e.mood}"></span>` : '';

        const tagsHtml = (e.mood || e.energy) ? `
            <div style="display:flex; gap:6px; margin-top:8px">
                ${e.energy ? `<span class="journal-tag energy">⚡ ${e.energy}</span>` : ''}
                ${e.mood ? `<span class="journal-tag mood">🎭 ${e.mood}</span>` : ''}
            </div>
        ` : '';
        return `
            <div class="journal-feed-item">
                <div class="journal-feed-date">${moodDotHtml}${dateStr}</div>
                <div class="journal-feed-text">${e.text}</div>
                ${tagsHtml}
                <button class="btn-delete-journal" data-action="deleteAndRefreshJournal" data-action-args="'${e.id}'">×</button>
            </div>
        `;
    }).join('');

    body.innerHTML = `
        <div class="modal-form">
            <h2>Journal Feed</h2>
            <div class="journal-feed-list">
                ${entriesHtml || '<p style="opacity:0.5; text-align:center">No entries yet.</p>'}
            </div>
            <div class="modal-actions">
                <button class="btn-primary ui-btn ui-btn--primary" data-action="closeModal" data-action-args="">Close</button>
            </div>
        </div>
    `;
    overlay.classList.add('active');
};

window.deleteAndRefreshJournal = function (id) {
    Store.deleteJournalEntry(id);
    openJournalFeed(); // Stay in feed
};

// --- Invoice Helpers ---
window.addNewInvoice = function () {
    const client = $('#new-inv-client').value.trim();
    const amount = parseFloat($('#new-inv-amount').value) || 0;
    const date = $('#new-inv-date').value;
    const status = $('#new-inv-status').value;

    if (!client) return;

    Store.addInvoice({
        client, amount, expectedDate: date, status
    });

    // Refresh modal
    openEditModal('income'); // primitive refresh
    renderIncome();
};

window.deleteInvoice = function (id) {
    Store.deleteInvoice(id);
    openEditModal('income');
    renderIncome();
};

// --- Dashboard Capture ---
window.exportDashboardAsImage = function () {
    const modal = document.getElementById('modal-overlay');
    const dock = document.getElementById('global-controls');

    // Create a temporary notice
    const notice = document.createElement('div');
    notice.style.position = 'fixed';
    notice.style.top = '50%';
    notice.style.left = '50%';
    notice.style.transform = 'translate(-50%, -50%)';
    notice.style.background = 'rgba(0,0,0,0.85)';
    notice.style.color = 'var(--text-accent)';
    notice.style.padding = '24px 40px';
    notice.style.borderRadius = '20px';
    notice.style.border = '1px solid var(--text-accent)';
    notice.style.zIndex = '10000';
    notice.style.fontFamily = 'var(--font-mono)';
    notice.style.fontSize = '0.75rem';
    notice.style.letterSpacing = '0.1em';
    notice.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';
    notice.innerText = 'GENERATING HIGH-RES SNAPSHOT...';
    document.body.appendChild(notice);

    // Hide UI elements that shouldn't be in the PNG
    modal.classList.remove('active');
    if (dock) dock.style.opacity = '0';

    setTimeout(() => {
        html2canvas(document.body, {
            scale: 1.5, // 1.5x for better compatibility on file://
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#050505',
            logging: false,
            // Ensure blur/filters are handled as best as possible
            ignoreElements: (el) => el.id === 'modal-overlay' || el.id === 'global-controls'
        }).then(canvas => {
            // Restore UI
            modal.classList.add('active');
            if (dock) dock.style.opacity = '1';

            const filename = `life-os-snapshot-${new Date().toISOString().split('T')[0]}.png`;

            try {
                // Use DataURL with forced stream to bypass file:// blob security
                const dataUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");

                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();

                // Update notice to success with manual fallback
                notice.innerHTML = `SNAPSHOT READY.<br><span style="font-size:0.6rem; opacity:0.7; margin-top:8px; display:block">IF THE DOWNLOAD DIDN'T START, <a href="${dataUrl}" download="${filename}" style="color:var(--text-accent); text-decoration:underline">CLICK HERE</a></span>`;

                setTimeout(() => {
                    if (document.body.contains(link)) document.body.removeChild(link);
                    if (document.body.contains(notice)) document.body.removeChild(notice);
                }, 8000);
            } catch (e) {
                console.error("Download failed", e);
                document.body.removeChild(notice);
                alert("The snapshot is too large for automatic download. Try reducing window size or widgets.");
            }

        }).catch(err => {
            console.error('Capture failed', err);
            modal.classList.add('active');
            if (dock) dock.style.opacity = '1';
            if (notice.parentNode) document.body.removeChild(notice);
            alert('Dashboard capture failed. Check console for details.');
        });
    }, 600); // 600ms to allow all glass-blur and transitions to settle
};

// --- Data Sovereignty Wrappers ---
window.exportData = function () {
    const data = Store.getAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.importData = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);
            if (Store.restoreAllData(json)) {
                alert('Restoration successful! The page will now reload.');
                window.location.reload();
            } else {
                alert('Failed to restore data. Invalid file format.');
            }
        } catch (err) {
            console.error(err);
            alert('Error parsing backup file.');
        }
    };
    reader.readAsText(file);
};

window.setCompassOverride = function (projectId) {
    Store.setDailyOverride(projectId);
    renderCreativeCompass();
};

window.compassCheckIn = function (outcome) {
    const direction = getCompassDirection();
    if (!direction) return;

    const data = Store.getCompassData();
    const today = new Date().toDateString();
    const wasOverride = data.dailyOverride && data.dailyOverride.date === today;

    // Update Project if positive outcome
    if (outcome === 'yes' || outcome === 'little') {
        Store.updateCompassProject(direction.project.id, {
            lastActivityDate: new Date().toISOString().split('T')[0]
        });
    }

    Store.appendDailyLog({
        projectId: direction.project.id,
        wasOverride: wasOverride,
        outcome: outcome
    });

    renderCreativeCompass();
    // Immediate Feedback
    const checkInEl = $('#compass-check-in');
    if (checkInEl) checkInEl.innerHTML = `<div class="check-in-prompt" style="font-style:italic">Direction log updated. Peace for today.</div>`;
    setTimeout(() => renderCreativeCompass(), 1500);
};

window.selectProject = function (index) {
    // Legacy support or ignored
};

window.startProjectTimer = function (index) {
    // Legacy support or ignored
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[LifeOS] DOMContentLoaded - Starting initialization...');
    bindDataActionDelegation();
    normalizeInlineStyles(document);
    observeInlineStyles();
    if (typeof ModeManager !== 'undefined') {
        try {
            ModeManager.init();
            console.log('[LifeOS] ModeManager initialized.');
        } catch (e) { console.error("ModeManager.init failed:", e); }
    }

    try {
        applyAccessibilitySettings();
    } catch (e) {
        console.error('applyAccessibilitySettings failed:', e);
    }

    if (window.ListeningRoomWidget && typeof window.ListeningRoomWidget.init === 'function') {
        try {
            window.ListeningRoomWidget.init();
        } catch (e) {
            console.error('[ListeningRoom] Initialization failed:', e);
        }
    }

    if (window.WalkUI && typeof window.WalkUI.init === 'function') {
        try {
            window.WalkUI.init();
        } catch (e) {
            console.error('[WalkUI] Initialization failed:', e);
        }
    }

    if (window.SpotifyClient && typeof SpotifyClient.handleAuthCallback === 'function') {
        try {
            SpotifyClient.init();
            const authResult = await SpotifyClient.handleAuthCallback();
            if (authResult && authResult.error) {
                console.warn('[Spotify] OAuth callback warning:', authResult.error);
            }
            if (authResult && authResult.returnContext) {
                spotifyReturnContext = authResult.returnContext;
            }
        } catch (e) {
            console.error('[Spotify] OAuth callback handling failed:', e);
        }
    }

    try {
        applyWidgetVisibility();
        console.log('[LifeOS] applyWidgetVisibility done.');
    } catch (e) { console.error("applyWidgetVisibility failed:", e); }

    try {
        initGreeting();
        console.log('[LifeOS] initGreeting done.');
    } catch (e) { console.error("initGreeting failed:", e); }

    try {
        initTopBar();
        console.log('[LifeOS] initTopBar done.');
    } catch (e) { console.error("initTopBar failed:", e); }
    initJournal();
    // initFocusTimer(); // Replaced by Creative Compass
    renderActivityLog();
    renderFinance(); // Merged Overview + Pipeline
    renderGoals();
    renderDailyRhythm();
    initCalendar();

    // V2
    initDailyState();
    // initIncome(); // Merged into renderFinance
    initSeasons();

    // V4 Roadmap Phase 2
    if (window.LibraryRenderer && typeof window.LibraryRenderer.init === 'function') {
        window.LibraryRenderer.init();
        window.LibraryRenderer.render();
    }
    initQuickCapture();
    // renderRituals(); // Merged into renderDailyRhythm

    renderNorthStar();
    renderCreativeCompass();
    renderWorlds();
    renderReflection();
    renderPeople();

    // Phase 7
    renderYearCompass();
    renderSystemHealth();
    renderVices();

    // Business Widgets (v34)
    renderBusinessWidgets();

    initWidgetControls();
    initDragging();
    initModal();
    initVisualControls();
    initDensityDockMenu();
    initZenMode();
    initSmartDock();
    initCommandPalette();
    initLiveSystemSync();


    // Ensure modes react to switches
    applyWidgetVisibility();

    // Ensure modes react to switches
    window.addEventListener('mode-changed', (e) => {
        console.log('Mode switch observed:', e.detail.mode);
        applyWidgetVisibility();
            if (e.detail.mode === 'business') {
                renderBusinessWidgets();
            } else if (e.detail.mode === 'vision') {
                initVisionMode();
                if (window.VisionUI && typeof window.VisionUI.render === 'function') {
                    window.VisionUI.render();
                }
            } else if (e.detail.mode === 'ritual') {
            try {
                initRitualMode();
                renderRitualWidgets();
            } catch (err) { console.error('Error rendering ritual widgets:', err); }
        } else if (e.detail.mode === 'library') {
            if (window.LibraryRenderer && typeof window.LibraryRenderer.refresh === 'function') {
                window.LibraryRenderer.refresh();
            }
        }
        scheduleLiveSystemRefresh();
    });

    // Check initial mode after listener is attached
    const currentMode = ModeManager.getMode();
    if (currentMode === 'business') renderBusinessWidgets();
    if (currentMode === 'vision') {
        initVisionMode();
        if (window.VisionUI && typeof window.VisionUI.render === 'function') {
            window.VisionUI.render();
        }
    }
    if (currentMode === 'ritual') {
        try {
            initRitualMode();
            renderRitualWidgets();
        } catch (e) { console.error('Initial ritual render error', e); }
    }
    if (currentMode === 'library') {
        if (window.LibraryRenderer && typeof window.LibraryRenderer.refresh === 'function') {
            window.LibraryRenderer.refresh();
        }
    }

    if (spotifyReturnContext && spotifyReturnContext.openVinylEdit) {
        try {
            if (typeof ModeManager !== 'undefined' && typeof ModeManager.switchMode === 'function') {
                ModeManager.switchMode('ritual');
            }
            initRitualMode();
            renderRitualWidgets();
            ensureVinylEditOpen(true);

            const queryInput = document.getElementById('inp-vinyl-bandcamp');
            if (queryInput && spotifyReturnContext.restoreSearch) {
                queryInput.value = spotifyReturnContext.restoreSearch;
            }
            window.updateVinylSpotifyUi();

            if (spotifyReturnContext.autoSearch && queryInput && queryInput.value.trim()) {
                setTimeout(() => window.fetchBandcampData(), 150);
            }
        } catch (e) {
            console.error('[Spotify] Failed restoring post-auth ritual state:', e);
        }
        spotifyReturnContext = null;
    }

    scheduleLiveSystemRefresh();

    // Bootstrap: archive today on load
    initMidnightWatcher();

    // Trigger Intro Sequence if applicable
    runIntroSequence();
});

/* ========================================
   MIDNIGHT ARCHIVE & RESET SYSTEM
   ======================================== */

function initMidnightWatcher() {
    // Calculate ms until next midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight - now;

    console.log(`[LifeOS] Midnight watcher: ${Math.round(msUntilMidnight / 60000)} minutes until archive.`);

    setTimeout(() => {
        performDayEndArchive();
        // Re-schedule for next midnight (24h later)
        setInterval(performDayEndArchive, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    // Also check on load if we missed a midnight (e.g. laptop was sleeping)
    checkMissedMidnight();
}

function checkMissedMidnight() {
    const lastArchiveDate = localStorage.getItem('lifeos-last-archive-date');
    const todayStr = new Date().toISOString().split('T')[0];

    if (lastArchiveDate && lastArchiveDate !== todayStr) {
        // We missed the midnight transition for the previous day
        // Archive whatever state we have for yesterday (it may be stale but better than nothing)
        console.log(`[LifeOS] Missed midnight for ${lastArchiveDate}. Archiving now.`);
        Store.archiveDay(lastArchiveDate);
        Store.resetDailyRhythm();
        Store.resetVices();
        renderDailyRhythm();
        renderVices();
    }

    // Update the last known date
    localStorage.setItem('lifeos-last-archive-date', todayStr);
}

function performDayEndArchive() {
    // Use the date that just ended (right before midnight)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`[LifeOS] === DAY-END ARCHIVE for ${dateStr} ===`);

    // 1. Archive the full day's state
    const archived = Store.archiveDay(dateStr);
    console.log(`[LifeOS] Archived: ${archived.rhythm.completedSteps}/${archived.rhythm.totalSteps} steps (${archived.rhythm.completionPct}%)`);

    // 2. Update streak history for the streak calendar
    const streakHistory = JSON.parse(localStorage.getItem('lifeos-streak-history') || '{}');
    streakHistory[dateStr] = {
        completed: archived.rhythm.completedSteps,
        total: archived.rhythm.totalSteps
    };
    localStorage.setItem('lifeos-streak-history', JSON.stringify(streakHistory));

    // 3. Count overall streak (consecutive days with > 75% completion)
    let streak = 0;
    const checkDate = new Date(yesterday);
    while (true) {
        const checkStr = checkDate.toISOString().split('T')[0];
        const dayData = Store.getArchivedDay(checkStr);
        if (dayData && dayData.rhythm.completionPct >= 75) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    localStorage.setItem('lifeos-current-streak', streak.toString());
    console.log(`[LifeOS] Current streak: ${streak} days`);

    // 4. Reset daily rhythm checkboxes
    Store.resetDailyRhythm();

    // 5. Reset vices counters
    Store.resetVices();

    // 6. Update the last archive date marker
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem('lifeos-last-archive-date', todayStr);

    // 7. Refresh UI
    renderDailyRhythm();
    if (typeof renderVices === 'function') renderVices();
    renderStreakCalendar();
    renderCalendar();
    initGreeting();
    initTopBar();

    console.log(`[LifeOS] Day reset complete. New day started.`);
}

/* ========================================
   CALENDAR ARCHIVE VIEWER
   ======================================== */

// Override selectCalendarDay to also show archive data
window.selectCalendarDay = function (dateStr) {
    if (calSelectedDate === dateStr) {
        calSelectedDate = null;
    } else {
        calSelectedDate = dateStr;
    }
    renderCalendar();
};

function renderEvents(filterDate = null) {
    const eventsEl = $('#events-list');
    const titleEl = $('.calendar-events-side .widget-title');
    if (!eventsEl) return;

    let events = Store.getEvents();

    events.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.time || '').localeCompare(b.time || '');
    });

    if (filterDate) {
        events = events.filter(e => e.date === filterDate);

        // Check if this day has archived data
        const archive = Store.getArchivedDay(filterDate);
        const todayStr = new Date().toISOString().split('T')[0];

        if (archive && filterDate !== todayStr) {
            // Show the archive panel instead of just events
            if (titleEl) titleEl.textContent = `${formatDateBySettings(new Date(filterDate + 'T12:00:00'), 'selected-day-title')}`;
            eventsEl.innerHTML = renderArchivePanel(archive, events);
            return;
        }

        if (titleEl) titleEl.textContent = 'Selected Day';
    } else {
        if (titleEl) titleEl.textContent = 'Upcoming';
    }

    if (events.length === 0) {
        eventsEl.innerHTML = `<div style="text-align:center;color:var(--text-tertiary);font-size:0.8rem;padding:10px">No events</div>`;
        return;
    }

    eventsEl.innerHTML = (filterDate ? events : events.slice(0, 10)).map(e => {
        const d = new Date(e.date);
        const dateLabel = formatDateBySettings(d, 'month-day');
        const timeLabel = formatEventTimeBySettings(d, e.time) || e.time;
        return `
            <div class="calendar-event event-item">
                <div class="ce-date-time" style="font-size:0.65rem; color:var(--text-accent); margin-bottom: 2px">
                    ${dateLabel} • ${timeLabel}
                </div>
                <div class="ce-name" style="color:var(--text-primary); font-weight:500">${e.name}</div>
                ${e.description ? `<div class="event-tooltip"><strong>${e.name}</strong><br>${e.description}</div>` : ''}
            </div>
        `;
    }).join('');
}

function renderArchivePanel(archive, events) {
    const r = archive.rhythm;
    const pctColor = r.completionPct >= 75 ? 'var(--text-accent)' : r.completionPct >= 50 ? '#ffd3b6' : '#ffaaa5';

    // Rhythm summary
    const rhythmHTML = r.phases.map(phase => {
        const done = phase.items.filter(i => i.done).length;
        const total = phase.items.length;
        return `
            <div class="archive-phase">
                <div class="archive-phase-title">${phase.title}</div>
                <div class="archive-phase-items">
                    ${phase.items.map(item => `
                        <span class="archive-item ${item.done ? 'done' : ''}">${item.done ? '✓' : '○'} ${item.text}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    // Daily state metrics
    let stateHTML = '';
    if (archive.dailyState) {
        const s = archive.dailyState;
        stateHTML = `
            <div class="archive-section">
                <div class="archive-section-label">STATE</div>
                <div class="archive-metrics">
                    ${s.energy != null ? `<span>⚡ ${s.energy}/10</span>` : ''}
                    ${s.mood != null ? `<span>😊 ${s.mood}/10</span>` : ''}
                    ${s.clarity != null ? `<span>🧠 ${s.clarity}/10</span>` : ''}
                    ${s.stress != null ? `<span>💆 ${s.stress}/10</span>` : ''}
                </div>
            </div>
        `;
    }

    // Journal entries
    let journalHTML = '';
    if (archive.journal && archive.journal.length > 0) {
        journalHTML = `
            <div class="archive-section">
                <div class="archive-section-label">JOURNAL</div>
                ${archive.journal.map(j => `
                    <div class="archive-journal-entry">${j.text}</div>
                `).join('')}
            </div>
        `;
    }

    // Events
    let eventsHTML = '';
    if (events.length > 0) {
        eventsHTML = `
            <div class="archive-section">
                <div class="archive-section-label">EVENTS</div>
                ${events.map(e => `
                    <div class="archive-event">${e.time} — ${e.name}</div>
                `).join('')}
            </div>
        `;
    }

    return `
        <div class="archive-panel">
            <div class="archive-header">
                <div class="archive-score" style="color:${pctColor}">${r.completionPct}%</div>
                <div class="archive-score-label">${r.completedSteps}/${r.totalSteps} steps</div>
            </div>
            <div class="archive-rhythm">${rhythmHTML}</div>
            ${stateHTML}
            ${journalHTML}
            ${eventsHTML}
        </div>
    `;
}

// --- Unified Finance & Pipeline ---
function renderFinance() {
    const balanceEl = $('#fo-balance');
    const realBalanceEl = $('#fo-real-balance'); // New
    const pipelineEl = $('#fo-pipeline'); // New
    const debtEl = $('#fo-debt');
    const runwayEl = $('#fo-runway');
    const runwayStatusEl = $('#fo-runway-status');
    const pipelineListEl = $('#pipeline-list');

    if (!balanceEl) return;

    const finance = Store.getFinance() || { balance: 0, transactions: [] };
    const v2 = Store.getV2Data(); // For Debt/Runway Reality

    // Calculate Reality
    const realBalance = parseFloat(finance.balance) || 0;
    const invoices = Store.getInvoices() || [];
    const openInvoices = invoices.filter(i => i.status !== 'Paid');
    const pipelineValue = openInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    const projectedBalance = realBalance + pipelineValue;

    // Runway Calculation
    const monthlyBurn = v2.financialReality.monthlyTarget || 3000; // Default or from settings
    const runwayMonths = (projectedBalance / monthlyBurn).toFixed(1);

    // Update Main Metrics
    if (balanceEl) balanceEl.textContent = '€' + projectedBalance.toLocaleString();
    if (realBalanceEl) realBalanceEl.textContent = '€' + realBalance.toLocaleString();
    if (pipelineEl) pipelineEl.textContent = '€' + pipelineValue.toLocaleString();
    if (debtEl) debtEl.textContent = '€' + (v2.financialReality.debtLeft || 0).toLocaleString();
    if (runwayEl) runwayEl.textContent = runwayMonths + ' mo';

    if (runwayStatusEl) {
        if (runwayMonths < 1) {
            runwayStatusEl.textContent = 'CRITICAL';
            runwayStatusEl.className = 'runway-status critical';
        } else if (runwayMonths < 3) {
            runwayStatusEl.textContent = 'Low';
            runwayStatusEl.className = 'runway-status low';
        } else {
            runwayStatusEl.textContent = 'Stable';
            runwayStatusEl.className = 'runway-status good';
        }
    }

    // Render Pipeline List
    if (pipelineListEl) {
        if (openInvoices.length === 0) {
            pipelineListEl.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.75rem; font-style:italic">No open invoices.</div>';
        } else {
            pipelineListEl.innerHTML = openInvoices.map(inv => `
                <div class="pipeline-item" data-action="openEditModal" data-action-args="'income'">
                    <div style="flex:1">
                        <div style="font-weight:500; font-size:0.8rem">${inv.client}</div>
                        <div style="font-size:0.7rem; color:var(--text-tertiary)">${new Date(inv.expectedDate).toLocaleDateString()} · ${inv.status}</div>
                    </div>
                    <div style="font-weight:600; font-size:0.8rem">€${inv.amount}</div>
                </div>
            `).join('');
        }
    }

    renderDerivedTopBarPulse();
}

// --- Goals (Standalone) ---
function renderGoals() {
    const list = $('#goals-list-dashboard');
    if (!list) return;

    const goals = Store.getGoals() || [];

    list.innerHTML = '';
    goals.forEach(goal => {
        const color = getCategoryColor(goal.category);
        const card = document.createElement('div');
        card.className = 'tracker-goal';
        card.style.borderLeft = `3px solid ${color}`;

        card.innerHTML = `
            <div class="tg-icon">${goal.icon}</div>
            <div class="tg-content">
                <div class="tg-header">
                    <span class="tg-name">${goal.name}</span>
                    <span class="tg-pct" data-action="editGoalProgress" data-action-args="'${goal.id}', ${goal.progress}">${goal.progress}%</span>
                </div>
                <div class="tg-bar-bg">
                    <div class="tg-bar-fill" style="width: ${goal.progress}%; background: ${color}"></div>
                </div>
            </div>
            <div class="tg-actions">
                <button data-action="updateGoalProgress" data-action-args="'${goal.id}', -5" title="-5%">-</button>
                <button data-action="updateGoalProgress" data-action-args="'${goal.id}', 5" title="+5%">+</button>
            </div>
        `;
        list.appendChild(card);
    });

    renderDerivedTopBarPulse();
}

// --- Daily Rhythm (Habits + Rituals) ---
function renderDailyRhythm() {
    const container = $('#habits-list-dashboard'); // Using the main container
    const ringFill = $('#tracker-ring-fill');
    const ringText = $('#tracker-subtitle');
    const timeState = getTimeStateSafe();
    const attentionState = getAttentionStateSafe();

    // Clear legacy ritual containers if they exist to avoid duplication
    const morningList = $('#morning-rituals-list');
    const eveningList = $('#evening-rituals-list');
    if (morningList) morningList.innerHTML = '';
    if (eveningList) eveningList.innerHTML = '';

    if (!container) return;

    const v2 = Store.getV2Data();
    const rhythm = v2.dailyRhythm || [];

    // 1. Calculate Stats for Ring
    let totalItems = 0;
    let completedItems = 0;

    rhythm.forEach(phase => {
        if (phase.items) {
            totalItems += phase.items.length;
            completedItems += phase.items.filter(i => i.done).length;
        }
    });

    // Update Ring
    if (ringFill && ringText) {
        const pct = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
        const radius = 15.9155;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (pct / 100) * circumference;

        ringFill.style.strokeDasharray = `${circumference} ${circumference}`;
        ringFill.style.strokeDashoffset = offset;
        const parts = [`${completedItems}/${totalItems} steps`];
        if (attentionState && Number.isFinite(attentionState.integrity)) {
            parts.push(`Integrity ${formatPercent01(attentionState.integrity)}`);
        } else if (timeState && timeState.phase) {
            parts.push(timeState.phase);
        }
        ringText.textContent = parts.join(' · ');

        // Add pulse animation on change
        const ring = $('.mini-ring');
        if (ring) {
            ring.classList.remove('pulse-beat');
            void ring.offsetWidth; // Trigger reflow
            ring.classList.add('pulse-beat');
        }
    }

    // 2. Render Phases
    container.className = 'daily-rhythm-container';
    container.innerHTML = rhythm.map((phase, pIndex) => {
        const isCollapsed = phase.collapsed;
        return `
        <div class="rhythm-phase">
            <div class="rhythm-header" data-action="toggleRhythmPhase" data-action-args="${pIndex}" style="cursor:pointer">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
                    <span class="rhythm-title">${phase.title}</span>
                    <span class="rhythm-chevron" style="transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}; transition: transform 0.2s">▼</span>
                </div>
                <span class="rhythm-subtitle">${phase.subtitle}</span>
            </div>
            <div class="rhythm-items-wrapper" style="display:${isCollapsed ? 'none' : 'flex'}; flex-direction:column; gap:12px">
                ${phase.items.map((item, iIndex) => `
                    <div class="rhythm-item ${item.done ? 'done' : ''}" 
                         data-action="toggleRhythmItem" data-action-args="${pIndex}, ${iIndex}"
                         style="animation-delay: ${iIndex * 0.05}s">
                        <div class="rhythm-checkbox"></div>
                        <span class="rhythm-label">${item.text}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `}).join('');

    renderStreakCalendar(); // Added: Update streak grid
    renderDerivedTopBarPulse();
}

window.toggleRhythmPhase = function (index) {
    const v2 = Store.getV2Data();
    if (v2.dailyRhythm && v2.dailyRhythm[index]) {
        v2.dailyRhythm[index].collapsed = !v2.dailyRhythm[index].collapsed;
        Store.saveV2Data(v2);
        renderDailyRhythm();
    }
};

window.toggleRhythmItem = function (phaseIndex, itemIndex) {
    const v2 = Store.getV2Data();
    if (v2.dailyRhythm && v2.dailyRhythm[phaseIndex] && v2.dailyRhythm[phaseIndex].items[itemIndex]) {
        const item = v2.dailyRhythm[phaseIndex].items[itemIndex];
        item.done = !item.done;
        Store.saveV2Data(v2);
        renderDailyRhythm(); // Re-render to update
    }
};

// Activity Log (Fitness Replacement)
function renderActivityLog() {
    const container = $('#activity-list');
    if (!container) return;

    const activityLog = Store.getActivities();

    if (!activityLog || activityLog.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-tertiary); font-size:0.85rem; display:flex; flex-direction:column; align-items:center; gap:8px; opacity:0.6;">
                <span style="font-size:1.5rem">🌱</span>
                <span>No movement yet.<br>Start the flow.</span>
            </div>`;
        return;
    }

    container.innerHTML = activityLog.map(act => {
        const date = new Date(act.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `
            <div class="activity-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 10px; border-radius:6px; font-size:0.85rem">
                <div>
                    <div style="font-weight:500">🏃 ${act.type}</div>
                    <div style="font-size:0.75rem; color:var(--text-tertiary)">${date} · ${act.duration || ''}</div>
                </div>
                <div style="font-family:var(--font-mono); font-size:0.8rem">${act.distance || ''}</div>
            </div>
        `;
    }).join('');
}

window.addActivity = function () {
    openEditModal('sport');
};

window.addActivityFromModal = function () {
    const type = $('#modal-act-type').value.trim();
    const distance = $('#modal-act-dist').value.trim();
    const duration = $('#modal-act-dur').value.trim();

    if (!type) return;

    Store.addActivity({
        type,
        distance,
        duration,
        date: new Date().toISOString()
    });

    openEditModal('sport'); // Refresh modal
    renderActivityLog();
    renderSystemHealth();
};

window.deleteActivity = function (id) {
    Store.deleteActivity(id);
    openEditModal('sport'); // Refresh modal
    renderActivityLog();
    renderSystemHealth();
};

// Deprecated or Replaced Functions
// function initGoals() {} -> Replaced by renderGoals
// function initHabits() {} -> Replaced by renderDailyRhythm
// function initSport() {} -> Replaced by renderActivityLog
// function initFinanceOverview() {} -> Replaced by renderFinance

// --- Phase 7: Year Compass ---
function renderYearCompass() {
    const grid = $('#year-compass-grid');
    const progressText = $('#yc-progress-text');
    if (!grid) return;

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000);
    const currentWeek = Math.ceil((dayOfYear + 1) / 7);
    const totalWeeks = 52;
    const pct = Math.round((currentWeek / totalWeeks) * 100);

    if (progressText) progressText.textContent = `Week ${currentWeek} · ${pct}%`;

    let dots = '';
    for (let i = 1; i <= totalWeeks; i++) {
        const cls = i < currentWeek ? 'yc-dot past' : i === currentWeek ? 'yc-dot current' : 'yc-dot future';
        dots += `<div class="${cls}" title="Week ${i}"></div>`;
    }
    grid.innerHTML = dots;
}

// --- Phase 7: System Health ---
function renderSystemHealth() {
    const container = $('#system-health-bars');
    if (!container) return;

    try {
        const v2 = Store.getV2Data();
        const todayState = Store.getTodayState() || {};
        const rhythm = v2.dailyRhythm || [];
        const attention = getAttentionStateSafe();
        const relationship = getRelationshipStateSafe();
        const systemState = getSystemStateSafe();
        const narrative = getNarrativeStateSafe();

        // 1. HEALTH: Completion of Habits + Sleep
        const sleepHrs = parseFloat(todayState.sleep) || 0;
        const sleepPart = Math.min(40, (sleepHrs / 8) * 40); // 40pts for 8h sleep

        let totalItems = 0;
        let doneItems = 0;
        rhythm.forEach(phase => {
            (phase.items || []).forEach(item => {
                totalItems++;
                if (item.done) doneItems++;
            });
        });
        const rhythmPart = totalItems > 0 ? (doneItems / totalItems) * 60 : 0; // 60pts for habits
        const healthScore = Math.round(sleepPart + rhythmPart);

        // 2. WEALTH: Runway Focus
        const fr = v2.financialReality || {};
        const runwayScore = Math.min(100, (fr.runwayMonths / 12) * 100); // 100pts for 12 months runway
        const wealthScore = Math.round(runwayScore);

        // 3. WISDOM: Input Log + Journal Streak
        const libraryCount = (window.LibraryStorage && typeof window.LibraryStorage.getItems === 'function')
            ? window.LibraryStorage.getItems().length
            : 0;
        const curiosityScore = Math.min(60, (libraryCount / 5) * 60); // 60pts for active inputs

        const journalEntries = Store.getJournalEntries();
        // Calculate streak or recent consistency
        const last7Days = journalEntries.filter(e => (new Date() - new Date(e.date)) < 7 * 24 * 60 * 60 * 1000).length;
        const consistencyScore = Math.min(40, (last7Days / 5) * 40); // 40pts for 5 entries/week

        const wisdomScore = Math.round(curiosityScore + consistencyScore);

        const attentionScore = attention && Number.isFinite(Number(attention.integrity))
            ? Number(attention.integrity)
            : 0.5;
        const warmthScore = relationship && Number.isFinite(Number(relationship.warmth))
            ? Number(relationship.warmth)
            : 0.5;

        const areas = [
            { name: 'Health', score: healthScore, icon: '❤️' },
            { name: 'Wealth', score: wealthScore, icon: '💰' },
            { name: 'Wisdom', score: wisdomScore, icon: '🧠' },
            { name: 'Attention', score: Math.round(attentionScore * 100), icon: '🎯' },
            { name: 'Connection', score: Math.round(warmthScore * 100), icon: '🤝' }
        ];

        const statusColor = (s) => s >= 75 ? 'var(--text-accent)' : s >= 45 ? '#d3d7c4' : '#f1b9a7';
        const statusLabel = (s) => s >= 75 ? 'Strong' : s >= 45 ? 'Steady' : 'Needs Care';
        const systemSummary = (systemState && systemState.systemMode)
            ? `${systemState.systemMode} · Risk ${formatPercent01(systemState.overallRisk)}`
            : 'System model warming up';
        const trajectoryLabel = (narrative && narrative.trajectory) ? `Trajectory ${narrative.trajectory}` : '';

        container.innerHTML = areas.map(a => `
            <div class="sh-row">
                <span class="sh-icon">${a.icon}</span>
                <span class="sh-name">${a.name}</span>
                <div class="sh-bar-track">
                    <div class="sh-bar-fill" style="width:${a.score}%; background:${statusColor(a.score)}"></div>
                </div>
                <span class="sh-status" style="color:${statusColor(a.score)}">${statusLabel(a.score)}</span>
            </div>
        `).join('') + `
            <div class="sh-system-summary">
                <span>${systemSummary}</span>
                ${trajectoryLabel ? `<span>${trajectoryLabel}</span>` : ''}
            </div>
        `;
        renderDerivedTopBarPulse();
    } catch (e) {
        console.error('System Health calculation failed:', e);
        container.innerHTML = '<div style="opacity:0.5; font-size:0.75rem">Calculation sync error</div>';
    }
}

// --- Phase 7: Vault of Vices ---
function renderVices() {
    const container = $('#vices-list');
    if (!container) return;

    const v2 = Store.getV2Data();
    const vices = v2.vices || [];

    if (vices.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-tertiary); font-size:0.8rem">No vices tracked. Add one via the edit button.</div>';
        return;
    }

    const today = new Date();
    container.innerHTML = vices.map(v => {
        const cleanSince = new Date(v.cleanSince);
        const days = Math.floor((today - cleanSince) / 86400000);
        const maxStreak = v.maxStreak || 0;
        return `
            <div class="vice-item">
                <div class="vice-info">
                    <div class="vice-name">${v.name}</div>
                    <div class="vice-meta">Best: ${maxStreak}d</div>
                </div>
                <div class="vice-streak">
                    <span class="vice-days">${days}</span>
                    <span class="vice-label">days clean</span>
                </div>
                <button class="vice-relapse-btn" data-action="viceRelapse" data-action-args="'${v.id}'" title="Reset">\u21bb</button>
            </div>
        `;
    }).join('');
}

window.viceRelapse = function (id) {
    if (!confirm('Reset this counter? Stay strong next time.')) return;
    const v2 = Store.getV2Data();
    const vice = (v2.vices || []).find(v => v.id === id);
    if (vice) {
        const today = new Date();
        const days = Math.floor((today - new Date(vice.cleanSince)) / 86400000);
        vice.maxStreak = Math.max(vice.maxStreak || 0, days);
        vice.cleanSince = today.toISOString().split('T')[0];
        Store.saveV2Data(v2);
        renderVices();
    }
};

window.addNewVice = function () {
    const name = $('#new-vice-name').value.trim();
    if (!name) return;

    const v2 = Store.getV2Data();
    if (!v2.vices) v2.vices = [];
    v2.vices.push({
        id: 'vice-' + Date.now(),
        name,
        cleanSince: new Date().toISOString().split('T')[0],
        maxStreak: 0
    });
    Store.saveV2Data(v2);
    openEditModal('vices');
    renderVices();
};

window.deleteVice = function (id) {
    const v2 = Store.getV2Data();
    v2.vices = (v2.vices || []).filter(v => v.id !== id);
    Store.saveV2Data(v2);
    openEditModal('vices');
    renderVices();
};


// --- Phase 6: Direction Log ---
window.openDirectionLog = function () {
    const overlay = $('#modal-overlay');
    const content = $('#modal-content');
    const body = $('#modal-body');

    const compassData = Store.getCompassData();
    const logs = compassData.dailyLogs || [];

    // Reverse chronological
    const sortedLogs = [...logs].reverse();

    let listHtml = '';
    if (sortedLogs.length === 0) {
        listHtml = '<div style="text-align:center; padding:20px; color:var(--text-tertiary)">No history yet.</div>';
    } else {
        listHtml = sortedLogs.map(log => {
            const date = new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            const project = compassData.projects.find(p => p.id === log.projectId);
            const projectName = project ? project.name : 'Unknown Project';

            return `
            <div class="dir-log-item">
                <div class="dir-log-date">${date}</div>
                <div class="dir-log-content">
                    <div class="dir-log-project">${projectName} ${log.wasOverride ? '(Override)' : ''}</div>
                    <div class="dir-log-outcome">${log.outcome === 'yes' ? 'Moved Forward' : log.outcome === 'little' ? 'A Little' : 'No Progress'}</div>
                </div>
            </div>
            `;
        }).join('');
    }

    body.innerHTML = `
        <div class="modal-form">
            <h2>Direction Log</h2>
            <div class="dir-log-list" style="margin-top:16px; max-height:400px; overflow-y:auto">
                ${listHtml}
            </div>
            <div class="modal-actions">
                <button class="btn-primary ui-btn ui-btn--primary" data-action="closeModal" data-action-args="">Close</button>
            </div>
        </div>
    `;

    overlay.classList.add('active');
    content.classList.add('active'); // Ensure content animates if needed
};

// --- Creative Compass Helpers ---
window.addNewCompassProject = function () {
    const name = $('#new-cp-name').value.trim();
    const stage = $('#new-cp-stage').value;
    if (!name) return;

    const compass = Store.getCompassData();
    compass.projects.push({
        id: 'cp-' + Date.now(),
        name,
        stage,
        lastActivityDate: new Date().toISOString().split('T')[0],
        priorityWeight: 0,
        archived: false
    });
    Store.saveCompassData(compass);
    openEditModal('creativePulse');
    renderCreativeCompass();
};

window.deleteCompassProject = function (id) {
    const compass = Store.getCompassData();
    compass.projects = compass.projects.filter(p => p.id !== id);
    Store.saveCompassData(compass);
    openEditModal('creativePulse');
    renderCreativeCompass();
};

window.addRhythmItem = function (phaseIndex) {
    const input = $(`#add-rhythm-item-${phaseIndex}`);
    const text = input.value.trim();
    if (!text) return;

    const v2 = Store.getV2Data();
    if (!v2.dailyRhythm) return;

    v2.dailyRhythm[phaseIndex].items.push({
        id: 'r-' + Date.now(),
        text: text,
        done: false
    });

    Store.saveV2Data(v2);
    openEditModal('habitsRituals'); // Re-open to show new item
    renderDailyRhythm();
};

window.deleteRhythmItem = function (phaseIndex, itemIndex) {
    const v2 = Store.getV2Data();
    if (!v2.dailyRhythm) return;

    v2.dailyRhythm[phaseIndex].items.splice(itemIndex, 1);
    Store.saveV2Data(v2);
    openEditModal('habitsRituals');
    renderDailyRhythm();
};

/* Zen toggle moved to top of file */

function initZenMode() {
    // Relying on onclick in HTML to avoid double-firing
    const btn = $('#btn-zen-mode');
    if (!btn) return;
    if (document.body.classList.contains('zen-active')) {
        btn.classList.add('active');
    }
}

function initDensityDockMenu() {
    const toggleBtn = $('#btn-density-menu');
    const menu = $('#dock-density-menu');
    const wrap = $('#dock-density-wrap');
    if (!toggleBtn || !menu || !wrap) return;
    if (toggleBtn.dataset.bound === '1') return;
    toggleBtn.dataset.bound = '1';

    const options = Array.from(menu.querySelectorAll('[data-density-level]'));

    function closeMenu() {
        menu.classList.add('hidden');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
        menu.classList.remove('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function syncActiveState() {
        const canUseDensity = window.UIManager && typeof UIManager.setDensity === 'function' && typeof UIManager.getDensity === 'function';
        if (!canUseDensity) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = '';

        const currentDensity = UIManager.getDensity();
        options.forEach((option) => {
            const isActive = option.dataset.densityLevel === currentDensity;
            option.classList.toggle('active', isActive);
            option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        toggleBtn.setAttribute('title', `Density: ${currentDensity}`);
    }

    toggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (menu.classList.contains('hidden')) {
            openMenu();
        } else {
            closeMenu();
        }
    });

    options.forEach((option) => {
        option.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const level = option.dataset.densityLevel;
            if (window.UIManager && typeof UIManager.setDensity === 'function') {
                UIManager.setDensity(level);
            }
            syncActiveState();
            closeMenu();
        });
    });

    document.addEventListener('click', (event) => {
        if (wrap.contains(event.target)) return;
        closeMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
    });

    const observer = new MutationObserver((mutations) => {
        const densityChanged = mutations.some((mutation) => mutation.attributeName === 'data-ui-density');
        if (densityChanged) syncActiveState();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ui-density'] });

    closeMenu();
    syncActiveState();
}

function initSmartDock() {
    const dock = $('.command-dock-bar');
    if (!dock) return;

    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY < 100) {
            dock.classList.add('visible');
        } else {
            if (Math.abs(currentScrollY - lastScrollY) < 15) return;
            if (currentScrollY < lastScrollY) {
                dock.classList.add('visible');
            } else {
                dock.classList.remove('visible');
            }
        }
        lastScrollY = currentScrollY;
    }, { passive: true });

    // Initial state
    if (window.scrollY < 100) dock.classList.add('visible');
}


/* ========================================
   V07 — Focus Timer (Dock)
   ======================================== */
let focusTimerInterval = null;
let focusTimeRemaining = 25 * 60; // 25 minutes
let isTimerRunning = false;

function startFocusTimer() {
    const display = document.getElementById('timer-large-display');
    if (!display) return;

    isTimerRunning = true;
    focusTimeRemaining = 25 * 60;

    focusTimerInterval = setInterval(() => {
        focusTimeRemaining--;

        if (focusTimeRemaining <= 0) {
            clearInterval(focusTimerInterval);
            isTimerRunning = false;
            display.textContent = 'DONE';

            // Notification or visual cue?
            new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { });
        } else {
            const m = Math.floor(focusTimeRemaining / 60);
            const s = focusTimeRemaining % 60;
            display.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
        }
    }, 1000);
}

function stopFocusTimer() {
    clearInterval(focusTimerInterval);
    isTimerRunning = false;
    focusTimeRemaining = 25 * 60;
    const display = document.getElementById('timer-large-display');
    if (display) display.textContent = '25:00';
}

/* ========================================
   V07 — Streak Calendar
   ======================================== */
function renderStreakCalendar() {
    const grid = document.getElementById('streak-calendar-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dates = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d);
    }

    // Calculate today's completion from Daily Rhythm
    const v2 = Store.getV2Data();
    const rhythm = v2.dailyRhythm || [];
    let totalItems = 0;
    let completedItems = 0;
    rhythm.forEach(phase => {
        if (phase.items) {
            totalItems += phase.items.length;
            completedItems += phase.items.filter(i => i.done).length;
        }
    });

    // Save today's snapshot
    const streakHistory = JSON.parse(localStorage.getItem('lifeos-streak-history') || '{}');
    if (totalItems > 0) {
        streakHistory[todayStr] = { completed: completedItems, total: totalItems };
    }
    localStorage.setItem('lifeos-streak-history', JSON.stringify(streakHistory));

    // Render 28-day grid
    dates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        let pct = 0;

        if (dateStr === todayStr && totalItems > 0) {
            // Use live data for today
            pct = completedItems / totalItems;
        } else if (streakHistory[dateStr]) {
            // Use saved snapshot for past days
            const snap = streakHistory[dateStr];
            pct = snap.total > 0 ? snap.completed / snap.total : 0;
        }

        // Map percentage to intensity (0-4)
        let intensity = 0;
        if (pct > 0 && pct <= 0.25) intensity = 1;
        else if (pct > 0.25 && pct <= 0.50) intensity = 2;
        else if (pct > 0.50 && pct <= 0.75) intensity = 3;
        else if (pct > 0.75) intensity = 4;

        const cell = document.createElement('div');
        cell.className = `streak-cell intensity-${intensity}`;

        const snap = streakHistory[dateStr];
        const completed = dateStr === todayStr ? completedItems : (snap ? snap.completed : 0);
        const total = dateStr === todayStr ? totalItems : (snap ? snap.total : 0);
        cell.title = `${dateStr}: ${completed}/${total}`;

        // Today's cell gets a special indicator
        if (dateStr === todayStr) {
            cell.classList.add('streak-today');
        }

        grid.appendChild(cell);
    });
}

/* ========================================
   V07 — Daily Pulse Score
   ======================================== */
function calculateDailyPulse() {
    let score = 0;
    const maxScore = 100;

    // 1. Daily Rhythm (40 pts)
    const rhythm = Store.getV2Data().dailyRhythm || [];
    let totalHabits = 0;
    let completedHabits = 0;
    rhythm.forEach(phase => {
        if (phase.items) {
            totalHabits += phase.items.length;
            completedHabits += phase.items.filter(i => i.done).length;
        }
    });
    if (totalHabits > 0) {
        score += (completedHabits / totalHabits) * 40;
    }

    // 2. Journal Entry Today (10 pts)
    const journal = Store.getJournal();
    const today = new Date().toDateString();
    if (journal.some(entry => new Date(entry.date).toDateString() === today)) {
        score += 10;
    }

    // 3. Creative Compass Direction (20 pts)
    const v2 = Store.getV2Data();
    if (v2.creativeCompass && v2.creativeCompass.log && v2.creativeCompass.log.some(l => new Date(l.date).toDateString() === today)) {
        score += 20;
    }
    // Or just if a direction is set for today (implied by having a log entry? No, let's check current direction)
    // Actually, let's check if the user "Checked In" today. The compassCheckIn logic updates a 'lastCheckIn' or pushes to log.
    // Let's assume having a log entry for today means they engaged.

    // 4. Daily State Logged (20 pts)
    const state = Store.getDailyState();
    if (state && new Date(state.date).toDateString() === today) {
        score += 20;
    }

    // 5. Vices Clean (10 pts) - if all > 0 days
    // This is hard to calculate without streak history per vice.
    // Let's simplify: 10 pts free for now, or check generic "System Health" (if health > 80)
    score += 10;

    // Render
    const scoreEl = document.getElementById('daily-pulse-score');
    const ringEl = document.getElementById('pulse-score-ring');

    if (scoreEl && ringEl) {
        const finalScore = Math.round(score);
        scoreEl.textContent = finalScore;

        // Color based on score
        let color = 'var(--text-tertiary)';
        if (finalScore > 30) color = '#ffaaa5';
        if (finalScore > 60) color = '#ffd3b6';
        if (finalScore > 80) color = '#a8e6cf';

        scoreEl.style.color = color;
        ringEl.style.stroke = color;

        // Ring offset
        const radius = 15.9155;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (finalScore / 100) * circumference;
        ringEl.style.strokeDashoffset = offset;
    }
}

/* ========================================
   V08 — Command Palette
   ======================================== */
const paletteActions = [
    { id: 'zen', name: 'Toggle Zen Mode', icon: '🧘', action: () => { document.getElementById('btn-zen-mode').click(); } },
    { id: 'timer', name: 'Start/Stop Focus Timer', icon: '🕐', action: toggleFocusTimer },
    { id: 'journal', name: 'New Journal Entry', icon: '📝', action: () => { document.getElementById('journal-area').focus(); } },
    { id: 'feed', name: 'Open Journal Feed', icon: '📖', action: openJournalFeed },
    { id: 'income', name: 'Add Income', icon: '💰', action: () => openEditModal('income') },
    { id: 'habit', name: 'Edit Habits', icon: '✅', action: () => openEditModal('habitsRituals') },
    { id: 'theme', name: 'Open Visualizer', icon: '', action: () => { document.getElementById('btn-visual-config').click(); } },
    { id: 'settings', name: 'Settings', icon: '⚙️', action: () => openEditModal('settings') },
];

function initCommandPalette() {
    const overlay = document.getElementById('command-palette');
    const input = document.getElementById('cp-input');
    const results = document.getElementById('cp-results');

    if (!overlay || !input) return;

    // Open/Close
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            overlay.classList.add('visible');
            input.value = '';
            renderPaletteResults(paletteActions);
            input.focus();
        }
        if (e.key === 'Escape' && overlay.classList.contains('visible')) {
            overlay.classList.remove('visible');
        }
    });

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('visible');
    });

    // Filter
    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = paletteActions.filter(act =>
            act.name.toLowerCase().includes(query)
        );
        renderPaletteResults(filtered);
    });

    function renderPaletteResults(actions) {
        results.innerHTML = actions.map((act, i) => `
            <div class="cp-item ${i === 0 ? 'selected' : ''}" data-action="executePaletteAction" data-action-args="'${act.id}'">
                <span class="cp-item-icon">${act.icon}</span>
                <span class="cp-item-name">${act.name}</span>
                <span class="cp-item-enter">⏎</span>
            </div>
        `).join('');
    }

    window.executePaletteAction = (id) => {
        const act = paletteActions.find(a => a.id === id);
        if (act) {
            act.action();
            overlay.classList.remove('visible');
        }
    };

    // Keyboard Nav (Enter)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const first = results.querySelector('.cp-item');
            if (first) first.click();
        }
    });
}
/* ========================================
   v34 — Business Mode Logic
   ======================================== */

function renderBusinessWidgets() {
    const v2 = Store.getV2Data();
    const rev = v2.revenueEngine || { today: 0, pipeline: 0, invoices: 0, deals: 0 };
    const fr = v2.financialReality || { debtLeft: 0, runwayMonths: 0, monthlyIncome: 0, monthlyTarget: 4000 };
    const bizContent = v2.bizContent || { minutesCreated: 0, piecesFinished: 0, audienceGrowth: 0, stage: 'Building' };
    const bizProjects = v2.bizProjects || [];

    // 1. Revenue Engine
    const revToday = $('#biz-rev-today');
    const pipeToday = $('#biz-pipeline-today');
    const invSent = $('#biz-invoices-sent');
    const deals = $('#biz-deals-moved');

    if (revToday) animateNumber(revToday, rev.today, '€');
    if (pipeToday) animateNumber(pipeToday, rev.pipeline, '€');
    if (invSent) invSent.textContent = rev.invoices;
    if (deals) deals.textContent = rev.deals;

    // 2. Financial Intelligence
    const cash90 = $('#biz-90d-cash');
    const burn = $('#biz-burn');
    const breakeven = $('#biz-breakeven');
    const runway = $('#biz-runway');

    // Smart Calculations
    const cashValue = fr.cash90 || (fr.runwayMonths * fr.monthlyIncome); // Fallback
    const burnValue = fr.monthlyBurn || (fr.monthlyIncome - (fr.monthlyIncome / fr.runwayMonths)); // Fallback

    if (cash90) animateNumber(cash90, Math.round(cashValue), '€');
    if (burn) animateNumber(burn, Math.round(burnValue), '€');
    if (breakeven) breakeven.textContent = `€${fr.monthlyTarget || 4000}/mo`;

    if (runway) {
        const rValue = fr.runwayMonths ? fr.runwayMonths : (burnValue > 0 ? cashValue / burnValue : 0);
        runway.textContent = rValue ? rValue.toFixed(1) + ' mo' : '—';
        runway.style.color = rValue < 3 ? '#ffaaa5' : rValue < 6 ? '#ffd3b6' : 'var(--text-accent)';
    }

    // 3. Projects & Leverage
    const projList = $('#biz-projects-list');
    const leverageScoreEl = $('#biz-leverage-score');

    if (projList) {
        if (bizProjects.length === 0) {
            projList.innerHTML = `<div class="state-placeholder">No active business projects.</div>`;
        } else {
            projList.innerHTML = bizProjects.map(p => `
                <div class="state-metric-row">
                    <span class="metric-icon">${p.leverage >= 8 ? '🔥' : '📈'}</span>
                    <span class="metric-name">${p.name}</span>
                    <div class="spacer"></div>
                    <span class="metric-value">L${p.leverage}</span>
                </div>
            `).join('');
        }
    }

    if (leverageScoreEl && bizProjects.length > 0) {
        const avgLeverage = bizProjects.reduce((acc, p) => acc + p.leverage, 0) / bizProjects.length;
        leverageScoreEl.textContent = avgLeverage.toFixed(1);
    }

    // 4. Creative Output
    const mins = $('#biz-minutes-created');
    const pieces = $('#biz-pieces-finished');
    const growth = $('#biz-audience-growth');
    const stage = $('#biz-content-stage');

    if (mins) animateNumber(mins, bizContent.minutesCreated);
    if (pieces) animateNumber(pieces, bizContent.piecesFinished);
    if (growth) growth.textContent = (bizContent.audienceGrowth >= 0 ? '+' : '') + bizContent.audienceGrowth;
    if (stage) stage.textContent = bizContent.stage;
}

// Ensure modes react to switches (Handled in DOMContentLoaded)

function initBusinessModals() {
    // Handled by switch cases in openEditModal and saveWidgetData
}

function addBizProject() {
    const name = $('#modal-bp-name').value.trim();
    const leverage = parseInt($('#modal-bp-leverage').value) || 5;
    if (!name) return;

    const v2Data = Store.getV2Data();
    v2Data.bizProjects.push({
        id: 'bp' + Date.now(),
        name,
        leverage,
        status: 'Active'
    });
    Store.saveV2Data(v2Data);
    openEditModal('bizProjects'); // Refresh
    renderBusinessWidgets();
}

function deleteBizProject(index) {
    const v2Data = Store.getV2Data();
    v2Data.bizProjects.splice(index, 1);
    Store.saveV2Data(v2Data);
    openEditModal('bizProjects'); // Refresh
    renderBusinessWidgets();
}


window.resetDashboard = function () {
    if (confirm("Are you sure you want to reset the entire dashboard? This will remove all your data and fill it with placeholders.")) {
        Store.resetToDefaults();
    }
};


/* ========================================
   VISION MODE — Widget Logic
   ======================================== */

/* Variable definition moved to top to fix hoisting/TDZ issues */
// let visionInitialized = false; 


function initVisionMode() {
    if (visionInitialized) return;
    visionInitialized = true;
    if (window.VisionUI && typeof window.VisionUI.init === 'function') {
        window.VisionUI.init();
    }
}

/* ========================================
   RITUAL MODE — Widget Logic
   ======================================== */

/* Variable definition moved to top to fix hoisting/TDZ issues */
// let ritualInitialized = false;


function initRitualMode() {
    console.log('[LifeOS] Initializing Ritual Mode...');
    if (ritualInitialized) {
        console.log('[LifeOS] Ritual Mode already initialized.');
        return;
    }
    try {
        wireRitualEvents();
        ritualInitialized = true;
        console.log('[LifeOS] Ritual Mode initialized successfully.');
    } catch (e) {
        console.error('[LifeOS] Error initializing Ritual Mode:', e);
    }
}

/* Candle toggle moved to top of file */

function renderRitualWidgets() {
    console.log('Rendering Ritual Widgets...');
    try { renderRitualVinyl(); } catch (e) { console.error('Vinyl render error', e); }
    try { renderRitualJournal(); } catch (e) { console.error('Journal render error', e); }
    try { renderRitualGratitude(); } catch (e) { console.error('Gratitude render error', e); }
    try { renderRitualWalkLog(); } catch (e) { console.error('WalkLog render error', e); }
    try { renderRitualSlowDays(); } catch (e) { console.error('SlowDays render error', e); }
    try { renderRitualGatherings(); } catch (e) { console.error('Gatherings render error', e); }
}

function renderRitualVinyl() {
    console.log('[Vinyl] renderRitualVinyl execution started');

    if (window.ListeningRoomWidget && typeof window.ListeningRoomWidget.render === 'function') {
        window.ListeningRoomWidget.render();
        if (typeof window.updateVinylSpotifyUi === 'function') {
            window.updateVinylSpotifyUi();
        }
        return;
    }

    const data = Store.getRitualVinyl();
    const artworkPreview = document.getElementById('vinyl-artwork-preview');
    const artistDisplay = document.getElementById('vinyl-artist-display');
    const albumDisplay = document.getElementById('vinyl-album-display');
    const notesDisplay = document.getElementById('vinyl-notes-display');

    if (artistDisplay) artistDisplay.textContent = data.artist || 'No Artist Set';
    if (albumDisplay) albumDisplay.textContent = data.record || 'No Album Set';
    if (notesDisplay) notesDisplay.textContent = data.notes || 'Share your reflection here...';

    if (artworkPreview) {
        if (data.artwork) {
            artworkPreview.style.backgroundImage = `url(${data.artwork})`;
            artworkPreview.innerHTML = '';
        } else {
            artworkPreview.style.backgroundImage = 'none';
            artworkPreview.innerHTML = '<span style="font-size:30px; opacity:0.3">\ud83d\udcbf</span>';
        }
        // Artwork click → open deep listen overlay
        artworkPreview.onclick = (e) => {
            if (e) e.stopPropagation();
            window.openVinylRitual();
        };
    }

    // Wire buttons by ID
    const editBtn = document.getElementById('btn-vinyl-edit');
    const spotifyBtn = document.getElementById('btn-vinyl-spotify');
    const listenBtn = document.getElementById('btn-vinyl-listen');

    console.log('[Vinyl] Buttons found:', {
        edit: !!editBtn,
        spotify: !!spotifyBtn,
        listen: !!listenBtn
    });

    // Wire buttons by ID with direct assignment to prevent duplicate listeners
    if (editBtn) {
        editBtn.onclick = (e) => {
            console.log('[Vinyl] Physical click on Edit button');
            if (e) e.stopPropagation();
            if (typeof window.toggleVinylEdit === 'function') {
                console.log('[Vinyl] Calling window.toggleVinylEdit()');
                window.toggleVinylEdit();
            } else {
                console.error('[Vinyl] ERROR: window.toggleVinylEdit is NOT a function!', typeof window.toggleVinylEdit);
            }
        };
    }

    if (spotifyBtn) {
        spotifyBtn.onclick = (e) => {
            console.log('[Vinyl] Spotify button clicked');
            if (e) e.stopPropagation();
            if (data.spotifyUrl) window.open(data.spotifyUrl, '_blank');
            else window.promptSpotifyLink();
        };
    }

    if (listenBtn) {
        listenBtn.onclick = (e) => {
            console.log('[Vinyl] Deep Listen clicked');
            if (e) e.stopPropagation();
            window.openVinylRitual();
        };
    }

    // Populate edit fields
    const inpArtist = document.getElementById('inp-vinyl-artist');
    const inpAlbum = document.getElementById('inp-vinyl-album');
    const inpNotes = document.getElementById('inp-vinyl-notes');
    if (inpArtist) inpArtist.value = data.artist || '';
    if (inpAlbum) inpAlbum.value = data.record || '';
    if (inpNotes) inpNotes.value = data.notes || '';
    if (typeof window.updateVinylSpotifyUi === 'function') {
        window.updateVinylSpotifyUi();
    }
}



function renderRitualJournal() {
    const text = Store.getRitualJournalToday();
    const el = document.getElementById('ritual-journal-text');
    if (el) {
        el.value = text;
        if (!text) {
            const quotes = [
                "What is present today?",
                "Slow, clear, consistent.",
                "Where is the breath moving?",
                "One small intentional step.",
                "The joy of being, not doing."
            ];
            el.placeholder = quotes[Math.floor(Date.now() / 86400000) % quotes.length];
        }
    }
    const dateEl = document.getElementById('ritual-journal-date');
    if (dateEl) dateEl.textContent = formatDateBySettings(new Date(), 'topbar-full');
}

function renderRitualGratitude() {
    const data = Store.getRitualGratitudeToday();
    for (let i = 0; i < 3; i++) {
        const el = document.getElementById(`ritual-grat-${i + 1}`);
        if (el) el.value = data.lines[i] || '';
    }
}

function renderRitualWalkLog() {
    if (window.WalkUI && typeof window.WalkUI.render === 'function') {
        window.WalkUI.render();
        return;
    }

    const data = Store.getRitualWalkLog();
    const countEl = document.getElementById('ritual-walk-count');
    const lastEl = document.getElementById('ritual-walk-last');

    if (countEl) countEl.textContent = data.count;

    if (lastEl) {
        if (data.lastDate) {
            const d = new Date(data.lastDate);
            const type = data.lastType ? ` [${data.lastType}]` : '';
            lastEl.textContent = `Last: ${formatDateBySettings(d, 'month-day')} @ ${formatTimeBySettings(d, { hour: '2-digit', minute: '2-digit' })}${type}`;
        } else {
            lastEl.textContent = 'No walks logged yet';
        }
    }
}

// Global walk logging — called by inline onclick in HTML
// Global walk logging — called by ID-wired listeners
/* logWalk moved to top of file */

function renderRitualSlowDays() {
    const data = Store.getRitualSlowDays();
    const countEl = document.getElementById('ritual-slow-count');
    const lastEl = document.getElementById('ritual-slow-last');
    if (countEl) countEl.textContent = data.count;
    if (lastEl && data.lastDate) {
        lastEl.textContent = `Last: ${data.lastDate}`;
    }
}

function renderRitualGatherings() {
    const list = document.getElementById('ritual-gatherings-list');
    if (!list) return;
    const gatherings = Store.getRitualGatherings();

    if (gatherings.length === 0) {
        list.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.8rem; font-style:italic; padding:4px">No gatherings planned.</div>';
        return;
    }

    // Sort by date
    gatherings.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    list.innerHTML = gatherings.map((g, i) => {
        const dateLabel = g.date ? formatDateBySettings(new Date(g.date + 'T12:00:00'), 'month-day') : '';
        return `
            <div class="ritual-gathering-item" style="animation-delay:${i * 0.05}s">
                <div class="ritual-gathering-dot"></div>
                <span style="flex:1; font-size:0.85rem; color:var(--text-primary)">${g.name}</span>
                ${dateLabel ? `<span class="ritual-gathering-date-label">${dateLabel}</span>` : ''}
                <button class="ritual-gathering-remove" data-action="removeRitualGathering" data-action-args="'${g.id}'">×</button>
            </div>
        `;
    }).join('');
}

function wireRitualEvents() {
    if (window.WalkUI && typeof window.WalkUI.init === 'function') {
        window.WalkUI.init();
    }

    // Auto-save Vinyl
    const vinylArtist = document.getElementById('inp-vinyl-artist');
    const vinylRecord = document.getElementById('inp-vinyl-album');
    const vinylNotes = document.getElementById('inp-vinyl-notes');
    const vinylYear = document.getElementById('inp-vinyl-year');
    const vinylGenre = document.getElementById('inp-vinyl-genre');
    const vinylLabel = document.getElementById('inp-vinyl-label');
    const vinylEmbedUrl = document.getElementById('inp-vinyl-embed-url');
    const vinylAppleType = document.getElementById('inp-vinyl-apple-type');
    const vinylAppleId = document.getElementById('inp-vinyl-apple-id');
    const vinylAppleStorefront = document.getElementById('inp-vinyl-apple-storefront');
    let vinylTimer;
    const saveVinyl = () => {
        clearTimeout(vinylTimer);
        vinylTimer = setTimeout(() => {
            if (window.ListeningRoomWidget && typeof window.ListeningRoomWidget.saveVinylFromForm === 'function') {
                window.ListeningRoomWidget.saveVinylFromForm();
                return;
            }

            const data = Store.getRitualVinyl();
            data.artist = vinylArtist ? vinylArtist.value : data.artist;
            data.record = vinylRecord ? vinylRecord.value : data.record;
            data.notes = vinylNotes ? vinylNotes.value : data.notes;
            Store.saveRitualVinyl(data);
        }, 400);
    };
    if (vinylArtist) vinylArtist.addEventListener('input', saveVinyl);
    if (vinylRecord) vinylRecord.addEventListener('input', saveVinyl);
    if (vinylNotes) vinylNotes.addEventListener('input', saveVinyl);
    if (vinylYear) vinylYear.addEventListener('input', saveVinyl);
    if (vinylGenre) vinylGenre.addEventListener('input', saveVinyl);
    if (vinylLabel) vinylLabel.addEventListener('input', saveVinyl);
    if (vinylEmbedUrl) vinylEmbedUrl.addEventListener('input', saveVinyl);
    if (vinylAppleType) vinylAppleType.addEventListener('change', saveVinyl);
    if (vinylAppleId) vinylAppleId.addEventListener('input', saveVinyl);
    if (vinylAppleStorefront) vinylAppleStorefront.addEventListener('input', saveVinyl);

    // Auto-save Journal
    const journalText = document.getElementById('ritual-journal-text');
    if (journalText) {
        let jTimer;
        journalText.addEventListener('input', () => {
            clearTimeout(jTimer);
            jTimer = setTimeout(() => Store.saveRitualJournalToday(journalText.value), 400);
        });
    }

    // Auto-save Gratitude
    const saveGratitude = () => {
        const lines = [];
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById(`ritual-grat-${i}`);
            lines.push(el ? el.value : '');
        }
        Store.saveRitualGratitudeToday({ lines });
    };
    let gratTimer;
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`ritual-grat-${i}`);
        if (el) el.addEventListener('input', () => {
            clearTimeout(gratTimer);
            gratTimer = setTimeout(saveGratitude, 400);
        });
    }

    // Slow Days Button
    const slowBtn = document.getElementById('ritual-slow-btn');
    if (slowBtn) {
        slowBtn.onclick = () => {
            console.log('Slow Day Logged');
            Store.logRitualSlowDay();
            renderRitualSlowDays();
        };
        console.log('Wired Slow Day button');
    }

    // Add Gathering
    const gathName = document.getElementById('ritual-gath-name');
    const gathDate = document.getElementById('ritual-gath-date');
    const gathAddBtn = document.getElementById('ritual-gath-add-btn');
    const addGathering = () => {
        const name = gathName ? gathName.value.trim() : '';
        if (!name) return;
        Store.addRitualGathering({ name, date: gathDate ? gathDate.value : '' });
        if (gathName) gathName.value = '';
        if (gathDate) gathDate.value = '';
        renderRitualGatherings();
    };
    if (gathAddBtn) gathAddBtn.addEventListener('click', addGathering);
    if (gathName) gathName.addEventListener('keydown', e => { if (e.key === 'Enter') addGathering(); });

    // Initial render for vinyl
    Store.seedVinylData(); // Seed with reference data if empty
    renderRitualVinyl();
}

window.removeRitualGathering = function (id) {
    Store.removeRitualGathering(id);
    renderRitualGatherings();
};

/* ========================================
   INTRO SEQUENCE ORCHESTRATOR
   ======================================== */
function runIntroSequence() {
    // Only run if the class is present (set by inline script in head)
    if (!document.documentElement.classList.contains('run-intro')) return;
    const accessibility = getAccessibilityPrefs();
    if (accessibility.reducedMotion || accessibility.introAnimation === 'disabled') {
        document.documentElement.classList.remove('run-intro');
        try {
            sessionStorage.setItem('lifeOS_intro_shown', 'true');
        } catch (e) {
            console.warn('Intro preference session flag could not be written', e);
        }
        return;
    }

    console.log('[LifeOS] Running Intro Sequence...');

    // Function to apply staggered delays
    const applyStagger = (selector, baseDelay, increment = 0.1) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
            // Apply inline style to override CSS defaults
            el.style.animationDelay = `${baseDelay + (index * increment)}s`;
        });
    };

    // Stagger Center Column (starts after greeting 0.2s)
    // Waterfall twice as long (increment 0.6s), but starting much earlier
    applyStagger('.col-center .widget:not(#topbar)', 0.6, 0.6);

    // Stagger Left Column (starts later at 1.8s)
    applyStagger('.col-left .widget', 1.8, 0.5);

    // Stagger Right Column (starts last at 3.0s)
    applyStagger('.col-right .widget', 3.0, 0.5);

    // Also handle Vision/Ritual widget containers if active
    applyStagger('.vision-widget', 1.2, 0.4);
    applyStagger('.ritual-widget', 1.2, 0.4);

    // Cleanup: Remove class after animation to restore normal interaction
    // Max delay ~3.0s + (5*0.5s) = 5.5s + 1.6s duration = ~7s
    // Setting to 8s to be safe
    setTimeout(() => {
        document.documentElement.classList.remove('run-intro');

        // Remove inline styles to clean up DOM
        const animated = document.querySelectorAll('.widget, .vision-widget, .ritual-widget');
        animated.forEach(el => el.style.animationDelay = '');

        // Mark as shown in storage
        sessionStorage.setItem('lifeOS_intro_shown', 'true');
        console.log('[LifeOS] Intro Sequence Complete. Interaction restored.');
    }, 4000);
}
