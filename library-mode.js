(function () {
    const STORAGE_KEY = 'libraryMediaItems';
    const SETTINGS_KEY = 'librarySettings';
    const VALID_TYPES = ['book', 'video', 'article', 'podcast', 'album', 'unknown'];

    function toText(value, fallback) {
        if (value == null) return fallback || '';
        return String(value).trim();
    }

    function safeDateIso(value) {
        const parsed = new Date(value);
        if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
        return parsed.toISOString();
    }

    function safeParseArray(raw) {
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function normalizeMediaType(type) {
        const normalized = toText(type, 'unknown').toLowerCase();
        return VALID_TYPES.includes(normalized) ? normalized : 'unknown';
    }

    function normalizeTag(value) {
        return toText(value, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeTags(value) {
        const source = Array.isArray(value)
            ? value
            : String(value || '').split(',');
        const output = [];
        const seen = new Set();
        source.forEach((entry) => {
            const tag = normalizeTag(entry);
            if (!tag || seen.has(tag)) return;
            seen.add(tag);
            output.push(tag);
        });
        return output;
    }

    function getDefaultSettings() {
        return {
            defaultType: 'book',
            tagCatalog: [],
            hoverMetaOnly: true
        };
    }

    function normalizeSettings(source) {
        const raw = source && typeof source === 'object' ? source : {};
        return {
            defaultType: normalizeMediaType(raw.defaultType || 'book'),
            tagCatalog: normalizeTags(raw.tagCatalog),
            hoverMetaOnly: raw.hoverMetaOnly !== false
        };
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function cssUrlValue(value) {
        return String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\r?\n/g, '');
    }

    function getTypeLabel(type) {
        const normalized = normalizeMediaType(type);
        if (normalized === 'book') return 'Book';
        if (normalized === 'video') return 'Video';
        if (normalized === 'article') return 'Article';
        if (normalized === 'podcast') return 'Podcast';
        if (normalized === 'album') return 'Album';
        return 'Media';
    }

    function buildItemId(prefix) {
        return (prefix || 'library-item') + '-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
    }

    function normalizeMediaItem(item, index) {
        if (!item || typeof item !== 'object') return null;

        const title = toText(item.title || item.name, '');
        if (!title) return null;

        const createdAt = safeDateIso(item.createdAt || item.added || item.updatedAt || new Date().toISOString());
        const id = toText(item.id, '') || ('library-' + createdAt + '-' + index);

        return {
            id: id,
            title: title,
            type: normalizeMediaType(item.type),
            coverUrl: toText(item.coverUrl || item.artwork, ''),
            year: toText(item.year, ''),
            creator: toText(item.creator || item.author, ''),
            notes: toText(item.notes, ''),
            tags: normalizeTags(item.tags || item.tag || ''),
            createdAt: createdAt
        };
    }

    function mapLegacyItem(item, index) {
        return normalizeMediaItem({
            id: item && item.id,
            title: item && item.name,
            type: item && item.type,
            coverUrl: item && item.artwork,
            year: item && item.year,
            creator: item && item.author,
            notes: item && item.notes,
            createdAt: (item && (item.added || item.updatedAt)) || new Date().toISOString()
        }, index);
    }

    function dedupeByIdThenKey(items) {
        const byId = new Set();
        const byKey = new Set();
        const output = [];

        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            if (!item) continue;

            const id = toText(item.id, '');
            const key = [
                normalizeMediaType(item.type),
                toText(item.title, '').toLowerCase(),
                toText(item.creator, '').toLowerCase()
            ].join('::');

            if (id && byId.has(id)) continue;
            if (byKey.has(key)) continue;

            if (id) byId.add(id);
            byKey.add(key);
            output.push(item);
        }

        return output;
    }

    function sortByRecent(items) {
        return items.slice().sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    function getMusicSearchError(error) {
        const code = error && error.code ? error.code : '';
        const message = error && error.message ? error.message : '';
        if (code === 'MUSIC_NETWORK_ERROR') return 'Network error while contacting iTunes.';
        if (code === 'MUSIC_API_ERROR') return message || 'iTunes request failed.';
        if (code === 'SPOTIFY_API_ERROR') return message || 'Music request failed.';
        return message || 'Search failed.';
    }

    function parseYearFromReleaseDate(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        return String(date.getFullYear());
    }

    const LibraryStorage = {
        getItems() {
            this.migrateFromLegacyIfNeeded();
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = safeParseArray(raw);
            const normalized = parsed
                .map((item, index) => normalizeMediaItem(item, index))
                .filter(Boolean);
            const deduped = dedupeByIdThenKey(normalized);
            return sortByRecent(deduped);
        },

        saveItems(items) {
            const safeItems = Array.isArray(items) ? items : [];
            const normalized = safeItems
                .map((item, index) => normalizeMediaItem(item, index))
                .filter(Boolean);
            const deduped = dedupeByIdThenKey(normalized);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sortByRecent(deduped)));
        },

        getItem(id) {
            const itemId = toText(id, '');
            if (!itemId) return null;
            const items = this.getItems();
            return items.find((item) => item.id === itemId) || null;
        },

        addItem(payload) {
            const source = payload || {};
            const title = toText(source.title, '');
            if (!title) return null;

            const next = normalizeMediaItem({
                id: toText(source.id, '') || buildItemId('library-item'),
                title: title,
                type: normalizeMediaType(source.type || 'unknown'),
                coverUrl: toText(source.coverUrl, ''),
                year: toText(source.year, ''),
                creator: toText(source.creator, ''),
                notes: toText(source.notes, ''),
                tags: normalizeTags(source.tags),
                createdAt: source.createdAt || new Date().toISOString()
            }, 0);

            if (!next) return null;

            const items = this.getItems();
            items.unshift(next);
            this.saveItems(items);
            return next;
        },

        updateItem(id, patch) {
            const itemId = toText(id, '');
            if (!itemId) return null;

            const items = this.getItems();
            const index = items.findIndex((item) => item.id === itemId);
            if (index < 0) return null;

            const current = items[index];
            const source = patch || {};
            const merged = normalizeMediaItem({
                id: current.id,
                title: toText(source.title, current.title),
                type: normalizeMediaType(toText(source.type, current.type)),
                coverUrl: toText(source.coverUrl, current.coverUrl),
                year: toText(source.year, current.year),
                creator: toText(source.creator, current.creator),
                notes: toText(source.notes, current.notes),
                tags: normalizeTags(source.tags || current.tags),
                createdAt: toText(source.createdAt, current.createdAt)
            }, index);

            if (!merged) return null;
            items[index] = merged;
            this.saveItems(items);
            return merged;
        },

        deleteItem(id) {
            const itemId = toText(id, '');
            if (!itemId) return false;

            const items = this.getItems();
            const nextItems = items.filter((item) => item.id !== itemId);
            if (nextItems.length === items.length) return false;
            this.saveItems(nextItems);
            return true;
        },

        migrateFromLegacyIfNeeded() {
            const existingRaw = localStorage.getItem(STORAGE_KEY);
            const existing = safeParseArray(existingRaw);
            if (existing.length > 0) return;

            if (typeof Store === 'undefined' || typeof Store.getV2Data !== 'function') return;

            const v2 = Store.getV2Data();
            const legacy = Array.isArray(v2.inputLog) ? v2.inputLog : [];
            if (legacy.length === 0) return;

            const migrated = legacy
                .map((item, index) => mapLegacyItem(item, index))
                .filter(Boolean);
            this.saveItems(migrated);
        },

        upsertFromVinyl(payload) {
            const source = payload || {};
            const title = toText(source.title, '');
            if (!title) return { created: false, item: null };

            const creator = toText(source.creator, 'Unknown Artist');
            const type = 'album';
            const keyTitle = title.toLowerCase();
            const keyCreator = creator.toLowerCase();
            const items = this.getItems();

            const index = items.findIndex((item) => {
                return normalizeMediaType(item.type) === type
                    && toText(item.title, '').toLowerCase() === keyTitle
                    && toText(item.creator, '').toLowerCase() === keyCreator;
            });

            const next = normalizeMediaItem({
                id: toText(source.id, '') || buildItemId('library-album'),
                title: title,
                type: type,
                coverUrl: toText(source.coverUrl, ''),
                year: toText(source.year, ''),
                creator: creator,
                notes: toText(source.notes, ''),
                tags: normalizeTags(source.tags),
                createdAt: source.createdAt || new Date().toISOString()
            }, items.length);

            if (!next) return { created: false, item: null };

            if (index >= 0) {
                const current = items[index];
                const merged = normalizeMediaItem({
                    id: current.id,
                    title: current.title || next.title,
                    type: 'album',
                    coverUrl: current.coverUrl || next.coverUrl,
                    year: current.year || next.year,
                    creator: current.creator || next.creator,
                    notes: current.notes || next.notes,
                    tags: normalizeTags((current.tags || []).concat(next.tags || [])),
                    createdAt: current.createdAt || next.createdAt
                }, index);
                items[index] = merged;
                this.saveItems(items);
                return { created: false, item: merged };
            }

            items.unshift(next);
            this.saveItems(items);
            return { created: true, item: next };
        }
    };

    const LibrarySettings = {
        get() {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return getDefaultSettings();
            try {
                const parsed = JSON.parse(raw);
                return normalizeSettings(parsed);
            } catch (error) {
                return getDefaultSettings();
            }
        },

        save(nextSettings) {
            const normalized = normalizeSettings(nextSettings);
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
            return normalized;
        }
    };

    const LibraryRenderer = {
        _initialized: false,
        _filters: {
            search: '',
            type: 'all',
            tag: 'all',
            sort: 'recent'
        },
        _addFormVisible: false,
        _settingsVisible: false,
        _activeModalItemId: '',
        _modalSearchResults: [],
        _modalHideTimer: null,

        init() {
            if (this._initialized) return;
            const shell = document.getElementById('library-shell');
            if (!shell) return;

            shell.innerHTML = [
                '<section class="library-layout">',
                '<aside class="library-sidebar">',
                '<header class="library-header">',
                '  <div class="library-heading">',
                '    <h1 class="library-title">Library</h1>',
                '    <p class="library-subtitle">Your collected media archive.</p>',
                '  </div>',
                '  <div class="library-count" id="library-count">0 items</div>',
                '</header>',
                '<section class="library-controls" aria-label="Library controls">',
                '  <div class="library-search-wrap">',
                '    <span class="library-search-icon" aria-hidden="true">⌕</span>',
                '    <input id="library-search" class="library-search" type="search" placeholder="Search title, creator, tags">',
                '    <button id="library-search-clear" class="library-search-clear" type="button" aria-label="Clear search">&times;</button>',
                '  </div>',
                '  <div class="library-filter-row">',
                '    <select id="library-type-filter" class="library-select">',
                '      <option value="all">All Types</option>',
                '      <option value="book">Books</option>',
                '      <option value="video">Videos</option>',
                '      <option value="article">Articles</option>',
                '      <option value="podcast">Podcasts</option>',
                '      <option value="album">Albums</option>',
                '      <option value="unknown">Other</option>',
                '    </select>',
                '    <select id="library-tag-filter" class="library-select">',
                '      <option value="all">All Tags</option>',
                '    </select>',
                '    <select id="library-sort" class="library-select">',
                '      <option value="recent">Recently added</option>',
                '      <option value="year">Year</option>',
                '      <option value="title">Title A-Z</option>',
                '    </select>',
                '  </div>',
                '  <div class="library-action-row">',
                '    <button id="library-add-toggle" class="library-add-btn" type="button">+ Add Item</button>',
                '    <button id="library-settings-toggle" class="library-add-btn" type="button">Library Settings</button>',
                '  </div>',
                '</section>',
                '<section class="library-add-panel" id="library-add-panel" hidden>',
                '  <div class="library-add-header">',
                '    <h2 class="library-add-title">Add New Item</h2>',
                '    <p class="library-add-help">Required: title. Optional: creator, type, year, cover URL, tags, notes.</p>',
                '  </div>',
                '  <p id="library-add-error" class="library-add-error" hidden></p>',
                '  <div class="library-add-grid">',
                '    <div class="library-field">',
                '      <label class="library-field-label" for="library-add-title">Title <span class="library-required">*</span></label>',
                '      <input id="library-add-title" class="library-input" type="text" placeholder="e.g. Deep Work">',
                '    </div>',
                '    <div class="library-field">',
                '      <label class="library-field-label" for="library-add-creator">Creator</label>',
                '      <input id="library-add-creator" class="library-input" type="text" placeholder="Author, artist, or source">',
                '    </div>',
                '    <div class="library-field">',
                '      <label class="library-field-label" for="library-add-type">Type</label>',
                '      <select id="library-add-type" class="library-select">',
                '        <option value="book">Book</option>',
                '        <option value="video">Video</option>',
                '        <option value="article">Article</option>',
                '        <option value="podcast">Podcast</option>',
                '        <option value="album">Album</option>',
                '        <option value="unknown">Other</option>',
                '      </select>',
                '    </div>',
                '    <div class="library-field">',
                '      <label class="library-field-label" for="library-add-year">Year</label>',
                '      <input id="library-add-year" class="library-input" type="text" inputmode="numeric" placeholder="YYYY">',
                '    </div>',
                '    <div class="library-field library-field-wide">',
                '      <label class="library-field-label" for="library-add-cover">Cover URL</label>',
                '      <input id="library-add-cover" class="library-input" type="url" placeholder="https://...">',
                '    </div>',
                '    <div class="library-field library-field-wide">',
                '      <label class="library-field-label" for="library-add-tags">Tags</label>',
                '      <input id="library-add-tags" class="library-input" type="text" placeholder="e.g. ambient, electronic">',
                '    </div>',
                '    <div class="library-field library-field-wide">',
                '      <label class="library-field-label" for="library-add-notes">Notes</label>',
                '      <textarea id="library-add-notes" class="library-textarea" placeholder="Optional notes"></textarea>',
                '    </div>',
                '  </div>',
                '  <div class="library-add-actions">',
                '    <button id="library-add-cancel" class="library-add-cancel" type="button">Cancel</button>',
                '    <button id="library-add-save" class="library-add-save" type="button">Save to Library</button>',
                '  </div>',
                '</section>',
                '<section class="library-settings-panel" id="library-settings-panel" hidden>',
                '  <div class="library-add-header">',
                '    <h2 class="library-add-title">Library Settings</h2>',
                '    <p class="library-add-help">Set defaults, manage tag catalog, and import CSV files.</p>',
                '  </div>',
                '  <div class="library-settings-grid">',
                '    <div class="library-field">',
                '      <label class="library-field-label" for="library-setting-default-type">Default Add Type</label>',
                '      <select id="library-setting-default-type" class="library-select">',
                '        <option value="book">Book</option>',
                '        <option value="video">Video</option>',
                '        <option value="article">Article</option>',
                '        <option value="podcast">Podcast</option>',
                '        <option value="album">Album</option>',
                '        <option value="unknown">Other</option>',
                '      </select>',
                '    </div>',
                '    <div class="library-field">',
                '      <label class="library-field-label" for="library-setting-tags">Tag Catalog (comma separated)</label>',
                '      <input id="library-setting-tags" class="library-input" type="text" placeholder="ambient, deep-work, research">',
                '    </div>',
                '    <label class="library-toggle-field">',
                '      <input id="library-setting-hover-meta" type="checkbox">',
                '      <span>Show card info only on hover</span>',
                '    </label>',
                '  </div>',
                '  <div class="library-settings-actions">',
                '    <button id="library-settings-import-btn" class="library-import-btn" type="button">Import CSV</button>',
                '    <input id="library-import-input" type="file" accept=".csv" hidden>',
                '    <button id="library-settings-save" class="library-add-save" type="button">Save settings</button>',
                '  </div>',
                '</section>',
                '<div class="library-import-status" id="library-import-status" hidden></div>',
                '</aside>',
                '<section class="library-grid-wrap">',
                '  <div class="library-grid" id="library-grid"></div>',
                '  <div class="library-empty" id="library-empty" hidden>',
                '    <p class="library-empty-title">Your library is empty.</p>',
                '    <p class="library-empty-subtitle">Start adding pieces to build your archive.</p>',
                '  </div>',
                '</section>',
                '</section>'
            ].join('');

            this._ensureItemModal();
            this._bindStaticEvents();
            this._initialized = true;
        },

        _bindStaticEvents() {
            const searchEl = document.getElementById('library-search');
            const searchClearEl = document.getElementById('library-search-clear');
            const typeEl = document.getElementById('library-type-filter');
            const tagEl = document.getElementById('library-tag-filter');
            const sortEl = document.getElementById('library-sort');
            const addToggleEl = document.getElementById('library-add-toggle');
            const settingsToggleEl = document.getElementById('library-settings-toggle');
            const settingsSaveEl = document.getElementById('library-settings-save');
            const settingsImportEl = document.getElementById('library-settings-import-btn');
            const addCancelEl = document.getElementById('library-add-cancel');
            const addSaveEl = document.getElementById('library-add-save');
            const addTitleEl = document.getElementById('library-add-title');
            const importInputEl = document.getElementById('library-import-input');
            const gridEl = document.getElementById('library-grid');

            if (searchEl) {
                searchEl.addEventListener('input', (event) => {
                    this._filters.search = toText(event.target.value, '');
                    if (searchClearEl) searchClearEl.hidden = this._filters.search.length === 0;
                    this.refresh();
                });
            }

            if (searchClearEl && searchEl) {
                searchClearEl.hidden = true;
                searchClearEl.addEventListener('click', () => {
                    searchEl.value = '';
                    this._filters.search = '';
                    searchClearEl.hidden = true;
                    this.refresh();
                    searchEl.focus();
                });
            }

            if (typeEl) {
                typeEl.addEventListener('change', (event) => {
                    this._filters.type = toText(event.target.value, 'all') || 'all';
                    this.refresh();
                });
            }

            if (tagEl) {
                tagEl.addEventListener('change', (event) => {
                    this._filters.tag = toText(event.target.value, 'all') || 'all';
                    this.refresh();
                });
            }

            if (sortEl) {
                sortEl.addEventListener('change', (event) => {
                    this._filters.sort = toText(event.target.value, 'recent') || 'recent';
                    this.refresh();
                });
            }

            if (addToggleEl) {
                addToggleEl.addEventListener('click', () => {
                    this._setAddFormVisible(!this._addFormVisible);
                    if (this._addFormVisible && addTitleEl) addTitleEl.focus();
                });
            }

            if (settingsToggleEl) {
                settingsToggleEl.addEventListener('click', () => {
                    this._setSettingsVisible(!this._settingsVisible);
                });
            }

            if (addCancelEl) {
                addCancelEl.addEventListener('click', () => {
                    this._resetAddForm();
                    this._setAddFormVisible(false);
                });
            }

            if (addSaveEl) {
                addSaveEl.addEventListener('click', () => {
                    const created = this._saveFromAddForm();
                    if (!created) return;
                    this._resetAddForm();
                    this._setAddFormVisible(false);
                    this.refresh();
                });
            }

            if (settingsSaveEl) {
                settingsSaveEl.addEventListener('click', () => {
                    this._saveSettingsForm();
                });
            }

            if (settingsImportEl && importInputEl) {
                settingsImportEl.addEventListener('click', () => importInputEl.click());
                importInputEl.addEventListener('change', (event) => {
                    const file = event.target.files && event.target.files[0];
                    if (!file) return;
                    this._importCsvFile(file);
                    importInputEl.value = '';
                });
            }

            if (gridEl) {
                gridEl.addEventListener('click', (event) => {
                    const card = event.target.closest('[data-library-id]');
                    if (!card) return;
                    const itemId = toText(card.getAttribute('data-library-id'), '');
                    if (itemId) this.openItemModal(itemId);
                });

                gridEl.addEventListener('keydown', (event) => {
                    const isEnter = event.key === 'Enter';
                    const isSpace = event.key === ' ';
                    if (!isEnter && !isSpace) return;
                    const card = event.target.closest('[data-library-id]');
                    if (!card) return;
                    event.preventDefault();
                    const itemId = toText(card.getAttribute('data-library-id'), '');
                    if (itemId) this.openItemModal(itemId);
                });
            }

            this._hydrateSettingsForm();
            this._renderTagFilterOptions();
            this._applyDisplaySettings();
        },

        _ensureItemModal() {
            if (document.getElementById('library-item-modal')) return;

            const modal = document.createElement('div');
            modal.id = 'library-item-modal';
            modal.className = 'library-item-modal';
            modal.hidden = true;
            modal.innerHTML = [
                '<div class="library-item-modal-backdrop" data-library-modal-close="true"></div>',
                '<div class="library-item-modal-card" role="dialog" aria-modal="true" aria-labelledby="library-item-modal-heading">',
                '  <button class="library-item-modal-close" type="button" data-library-modal-close="true" aria-label="Close item editor">&times;</button>',
                '  <div class="library-item-modal-layout">',
                '    <section class="library-item-modal-cover-column">',
                '      <div class="library-modal-cover-preview" id="library-modal-cover-preview"></div>',
                '      <div class="library-modal-cover-controls">',
                '        <label class="library-field-label" for="library-modal-cover-url">Cover URL</label>',
                '        <input id="library-modal-cover-url" class="library-input" type="url" placeholder="https://...">',
                '        <label class="library-cover-upload">',
                '          <input id="library-modal-cover-file" type="file" accept="image/*">',
                '          Upload artwork',
                '        </label>',
                '      </div>',
                '    </section>',
                '    <section class="library-item-modal-fields-column">',
                '      <h2 class="library-item-modal-heading" id="library-item-modal-heading">Library Item</h2>',
                '      <p class="library-item-modal-subtitle">Edit metadata, refresh artwork, and keep your archive clean.</p>',
                '      <p id="library-modal-form-error" class="library-add-error" hidden></p>',
                '      <div class="library-modal-field-grid">',
                '        <div class="library-field">',
                '          <label class="library-field-label" for="library-modal-title">Title <span class="library-required">*</span></label>',
                '          <input id="library-modal-title" class="library-input" type="text">',
                '        </div>',
                '        <div class="library-field">',
                '          <label class="library-field-label" for="library-modal-creator">Creator</label>',
                '          <input id="library-modal-creator" class="library-input" type="text">',
                '        </div>',
                '        <div class="library-field">',
                '          <label class="library-field-label" for="library-modal-type">Type</label>',
                '          <select id="library-modal-type" class="library-select">',
                '            <option value="book">Book</option>',
                '            <option value="video">Video</option>',
                '            <option value="article">Article</option>',
                '            <option value="podcast">Podcast</option>',
                '            <option value="album">Album</option>',
                '            <option value="unknown">Other</option>',
                '          </select>',
                '        </div>',
                '        <div class="library-field">',
                '          <label class="library-field-label" for="library-modal-year">Year</label>',
                '          <input id="library-modal-year" class="library-input" type="text" inputmode="numeric" placeholder="YYYY">',
                '        </div>',
                '        <div class="library-field library-field-full">',
                '          <label class="library-field-label" for="library-modal-tags">Tags</label>',
                '          <input id="library-modal-tags" class="library-input" type="text" placeholder="ambient, focus, archive">',
                '        </div>',
                '      </div>',
                '      <div class="library-field">',
                '        <label class="library-field-label" for="library-modal-notes">Notes</label>',
                '        <textarea id="library-modal-notes" class="library-textarea" placeholder="Optional notes"></textarea>',
                '      </div>',
                '      <section class="library-modal-search">',
                '        <div class="library-modal-search-header">',
                '          <h3 class="library-modal-search-title">Find on iTunes / Apple Music</h3>',
                '          <p class="library-modal-search-help">Use artist + album or paste an Apple Music / iTunes album URL.</p>',
                '        </div>',
                '        <div class="library-modal-search-row">',
                '          <input id="library-modal-search-query" class="library-input" type="search" placeholder="Artist + album or Apple Music/iTunes URL">',
                '          <button id="library-modal-search-btn" class="library-add-save" type="button">Search</button>',
                '        </div>',
                '        <p id="library-modal-search-status" class="library-modal-search-status" hidden></p>',
                '        <div id="library-modal-search-results" class="library-modal-search-results"></div>',
                '      </section>',
                '      <div class="library-item-modal-actions">',
                '        <button id="library-modal-delete-btn" class="library-item-delete-btn" type="button">Delete</button>',
                '        <div class="library-item-modal-actions-right">',
                '          <button id="library-modal-cancel-btn" class="library-add-cancel" type="button">Cancel</button>',
                '          <button id="library-modal-save-btn" class="library-add-save" type="button">Save changes</button>',
                '        </div>',
                '      </div>',
                '    </section>',
                '  </div>',
                '</div>'
            ].join('');

            document.body.appendChild(modal);

            modal.addEventListener('click', (event) => {
                const closeTrigger = event.target.closest('[data-library-modal-close="true"]');
                if (closeTrigger) this.closeItemModal();
            });

            const cancelBtn = document.getElementById('library-modal-cancel-btn');
            const saveBtn = document.getElementById('library-modal-save-btn');
            const deleteBtn = document.getElementById('library-modal-delete-btn');
            const coverUrlInput = document.getElementById('library-modal-cover-url');
            const coverFileInput = document.getElementById('library-modal-cover-file');
            const searchBtn = document.getElementById('library-modal-search-btn');
            const searchInput = document.getElementById('library-modal-search-query');
            const resultList = document.getElementById('library-modal-search-results');

            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeItemModal());
            if (saveBtn) saveBtn.addEventListener('click', () => this._saveModalItem());
            if (deleteBtn) deleteBtn.addEventListener('click', () => this._deleteModalItem());

            if (coverUrlInput) {
                coverUrlInput.addEventListener('input', (event) => {
                    this._updateModalCoverPreview(toText(event.target.value, ''));
                });
            }

            if (coverFileInput) {
                coverFileInput.addEventListener('change', (event) => {
                    const file = event.target.files && event.target.files[0];
                    if (!file) return;
                    this._readCoverFile(file, (dataUrl) => {
                        const coverEl = document.getElementById('library-modal-cover-url');
                        if (!coverEl) return;
                        coverEl.value = dataUrl;
                        this._updateModalCoverPreview(dataUrl);
                    });
                    event.target.value = '';
                });
            }

            if (searchBtn) {
                searchBtn.addEventListener('click', () => this._searchAlbumFromModal());
            }

            if (searchInput) {
                searchInput.addEventListener('keydown', (event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    this._searchAlbumFromModal();
                });
            }

            if (resultList) {
                resultList.addEventListener('click', (event) => {
                    const useBtn = event.target.closest('[data-library-use-album-id]');
                    if (!useBtn) return;
                    const albumId = toText(useBtn.getAttribute('data-library-use-album-id'), '');
                    this._applyModalAlbumResult(albumId);
                });
            }

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this._activeModalItemId) {
                    this.closeItemModal();
                }
            });
        },

        _setAddFormVisible(visible) {
            const panel = document.getElementById('library-add-panel');
            const toggle = document.getElementById('library-add-toggle');
            this._addFormVisible = Boolean(visible);
            if (panel) panel.hidden = !this._addFormVisible;
            if (toggle) toggle.textContent = this._addFormVisible ? 'Close' : '+ Add Item';
            if (!this._addFormVisible) this._setAddError('');
        },

        _setSettingsVisible(visible) {
            const panel = document.getElementById('library-settings-panel');
            const toggle = document.getElementById('library-settings-toggle');
            this._settingsVisible = Boolean(visible);
            if (panel) panel.hidden = !this._settingsVisible;
            if (toggle) toggle.textContent = this._settingsVisible ? 'Close Settings' : 'Library Settings';
            if (this._settingsVisible) this._hydrateSettingsForm();
        },

        _hydrateSettingsForm() {
            const settings = LibrarySettings.get();
            const defaultTypeEl = document.getElementById('library-setting-default-type');
            const tagsEl = document.getElementById('library-setting-tags');
            const hoverMetaEl = document.getElementById('library-setting-hover-meta');

            if (defaultTypeEl) defaultTypeEl.value = settings.defaultType;
            if (tagsEl) tagsEl.value = settings.tagCatalog.join(', ');
            if (hoverMetaEl) hoverMetaEl.checked = settings.hoverMetaOnly;
        },

        _saveSettingsForm() {
            const defaultTypeEl = document.getElementById('library-setting-default-type');
            const tagsEl = document.getElementById('library-setting-tags');
            const hoverMetaEl = document.getElementById('library-setting-hover-meta');

            const settings = LibrarySettings.save({
                defaultType: toText(defaultTypeEl && defaultTypeEl.value, 'book'),
                tagCatalog: normalizeTags(tagsEl && tagsEl.value),
                hoverMetaOnly: !(hoverMetaEl && hoverMetaEl.checked === false)
            });

            this._renderTagFilterOptions();
            this._applyDisplaySettings();
            this._showImportStatus('Library settings saved.', 'success');
            return settings;
        },

        _renderTagFilterOptions() {
            const tagFilterEl = document.getElementById('library-tag-filter');
            if (!tagFilterEl) return;

            const settings = LibrarySettings.get();
            const itemTags = LibraryStorage.getItems().reduce((acc, item) => {
                normalizeTags(item.tags).forEach((tag) => acc.add(tag));
                return acc;
            }, new Set());
            settings.tagCatalog.forEach((tag) => itemTags.add(tag));
            const tags = Array.from(itemTags.values()).sort((a, b) => a.localeCompare(b));
            const previous = this._filters.tag || 'all';

            tagFilterEl.innerHTML = ['<option value="all">All Tags</option>']
                .concat(tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`))
                .join('');

            if (tags.includes(previous)) {
                tagFilterEl.value = previous;
            } else {
                tagFilterEl.value = 'all';
                this._filters.tag = 'all';
            }
        },

        _applyDisplaySettings() {
            const settings = LibrarySettings.get();
            const gridEl = document.getElementById('library-grid');
            if (!gridEl) return;
            if (settings.hoverMetaOnly) {
                gridEl.classList.remove('library-grid-show-meta');
            } else {
                gridEl.classList.add('library-grid-show-meta');
            }
        },

        _setAddError(message) {
            const errorEl = document.getElementById('library-add-error');
            if (!errorEl) return;
            const text = toText(message, '');
            if (!text) {
                errorEl.hidden = true;
                errorEl.textContent = '';
                return;
            }
            errorEl.hidden = false;
            errorEl.textContent = text;
        },

        _setModalError(message) {
            const errorEl = document.getElementById('library-modal-form-error');
            if (!errorEl) return;
            const text = toText(message, '');
            if (!text) {
                errorEl.hidden = true;
                errorEl.textContent = '';
                return;
            }
            errorEl.hidden = false;
            errorEl.textContent = text;
        },

        _resetAddForm() {
            const ids = [
                'library-add-title',
                'library-add-creator',
                'library-add-year',
                'library-add-cover',
                'library-add-tags',
                'library-add-notes'
            ];
            ids.forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            const typeEl = document.getElementById('library-add-type');
            if (typeEl) typeEl.value = LibrarySettings.get().defaultType;
            this._setAddError('');
        },

        _saveFromAddForm() {
            const titleEl = document.getElementById('library-add-title');
            const creatorEl = document.getElementById('library-add-creator');
            const typeEl = document.getElementById('library-add-type');
            const yearEl = document.getElementById('library-add-year');
            const coverEl = document.getElementById('library-add-cover');
            const tagsEl = document.getElementById('library-add-tags');
            const notesEl = document.getElementById('library-add-notes');

            const title = toText(titleEl && titleEl.value, '');
            if (!title) {
                this._setAddError('Title is required.');
                if (titleEl) titleEl.focus();
                return null;
            }

            this._setAddError('');

            return LibraryStorage.addItem({
                title: title,
                creator: toText(creatorEl && creatorEl.value, ''),
                type: toText(typeEl && typeEl.value, 'unknown'),
                year: toText(yearEl && yearEl.value, ''),
                coverUrl: toText(coverEl && coverEl.value, ''),
                tags: normalizeTags(tagsEl && tagsEl.value),
                notes: toText(notesEl && notesEl.value, ''),
                createdAt: new Date().toISOString()
            });
        },

        _showImportStatus(message, tone) {
            const statusEl = document.getElementById('library-import-status');
            if (!statusEl) return;
            const text = toText(message, '');
            if (!text) {
                statusEl.hidden = true;
                statusEl.textContent = '';
                statusEl.removeAttribute('data-tone');
                return;
            }
            statusEl.hidden = false;
            statusEl.textContent = text;
            statusEl.setAttribute('data-tone', toText(tone, 'info'));
        },

        _importCsvFile(file) {
            const reader = new FileReader();
            reader.onload = () => {
                const rows = this._parseCsv(reader.result || '');
                let imported = 0;
                rows.forEach((row) => {
                    const title = this._getCsvValue(row, ['Title', 'Album', 'Record', 'Name', 'title']);
                    if (!title) return;

                    const creator = this._getCsvValue(row, ['Artist', 'Creator', 'Author', 'artist', 'creator']);
                    const year = this._getCsvValue(row, ['Released', 'Year', 'Date', 'released', 'year']);
                    const cover = this._getCsvValue(row, ['Cover URL', 'Artwork', 'Artwork URL', 'coverUrl', 'artwork']);
                    const tags = this._getCsvValue(row, ['Tags', 'Tag', 'tags', 'tag']);
                    const notes = this._getCsvValue(row, ['Label', 'Notes', 'Comment', 'label', 'notes']);

                    const added = LibraryStorage.addItem({
                        title: title,
                        creator: creator,
                        type: 'album',
                        year: year,
                        coverUrl: cover,
                        tags: normalizeTags(tags),
                        notes: notes,
                        createdAt: new Date().toISOString()
                    });

                    if (added) imported += 1;
                });

                this.refresh();
                if (imported > 0) {
                    this._showImportStatus(`Imported ${imported} records.`, 'success');
                } else {
                    this._showImportStatus('No valid rows found in CSV.', 'warn');
                }
            };

            reader.onerror = () => {
                this._showImportStatus('CSV import failed. File could not be read.', 'error');
            };

            reader.readAsText(file);
        },

        _getCsvValue(row, keys) {
            if (!row || typeof row !== 'object') return '';
            for (let index = 0; index < keys.length; index += 1) {
                const key = keys[index];
                if (Object.prototype.hasOwnProperty.call(row, key)) {
                    const value = toText(row[key], '');
                    if (value) return value;
                }
                const alt = Object.keys(row).find((name) => name.toLowerCase() === key.toLowerCase());
                if (alt) {
                    const altValue = toText(row[alt], '');
                    if (altValue) return altValue;
                }
            }
            return '';
        },

        _parseCsv(text) {
            const lines = String(text || '')
                .split(/\r?\n/)
                .filter((line) => line.trim().length > 0);
            if (lines.length === 0) return [];

            const headers = this._splitCsvLine(lines[0]).map((header) => toText(header, ''));
            if (headers.length === 0) return [];

            const rows = [];
            for (let index = 1; index < lines.length; index += 1) {
                const values = this._splitCsvLine(lines[index]);
                if (values.length === 0) continue;
                const row = {};
                headers.forEach((header, colIndex) => {
                    if (!header) return;
                    row[header] = toText(values[colIndex], '');
                });
                rows.push(row);
            }
            return rows;
        },

        _splitCsvLine(line) {
            const values = [];
            let value = '';
            let inQuotes = false;

            for (let index = 0; index < line.length; index += 1) {
                const char = line[index];
                const next = line[index + 1];

                if (char === '"' && inQuotes && next === '"') {
                    value += '"';
                    index += 1;
                    continue;
                }

                if (char === '"') {
                    inQuotes = !inQuotes;
                    continue;
                }

                if (char === ',' && !inQuotes) {
                    values.push(value.trim());
                    value = '';
                    continue;
                }

                value += char;
            }

            values.push(value.trim());
            return values;
        },

        _applyFilters(items) {
            const query = this._filters.search.toLowerCase();
            let filtered = items.slice();

            if (this._filters.type !== 'all') {
                filtered = filtered.filter((item) => normalizeMediaType(item.type) === this._filters.type);
            }

            if (this._filters.tag !== 'all') {
                filtered = filtered.filter((item) => {
                    const tags = normalizeTags(item.tags);
                    return tags.includes(this._filters.tag);
                });
            }

            if (query) {
                filtered = filtered.filter((item) => {
                    const title = toText(item.title, '').toLowerCase();
                    const creator = toText(item.creator, '').toLowerCase();
                    const tags = normalizeTags(item.tags).join(' ');
                    return title.includes(query) || creator.includes(query) || tags.includes(query);
                });
            }

            if (this._filters.sort === 'year') {
                filtered.sort((a, b) => {
                    const yearA = parseInt(a.year, 10);
                    const yearB = parseInt(b.year, 10);
                    if (Number.isFinite(yearA) && Number.isFinite(yearB) && yearA !== yearB) {
                        return yearB - yearA;
                    }
                    return toText(a.title, '').localeCompare(toText(b.title, ''));
                });
            } else if (this._filters.sort === 'title') {
                filtered.sort((a, b) => toText(a.title, '').localeCompare(toText(b.title, '')));
            } else {
                filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }

            return filtered;
        },

        _renderGrid(items, totalCount) {
            const countEl = document.getElementById('library-count');
            const gridEl = document.getElementById('library-grid');
            const emptyEl = document.getElementById('library-empty');
            if (!countEl || !gridEl || !emptyEl) return;

            if (items.length !== totalCount) {
                countEl.textContent = String(items.length) + ' of ' + String(totalCount) + ' items';
            } else if (totalCount === 1) {
                countEl.textContent = '1 item';
            } else {
                countEl.textContent = String(totalCount) + ' items';
            }

            if (items.length === 0) {
                gridEl.hidden = true;
                gridEl.innerHTML = '';
                emptyEl.hidden = false;
                return;
            }

            emptyEl.hidden = true;
            gridEl.hidden = false;
            gridEl.innerHTML = items.map((item) => {
                const hasCover = Boolean(toText(item.coverUrl, ''));
                const coverStyle = hasCover
                    ? "style=\"background-image:url('" + cssUrlValue(item.coverUrl) + "')\""
                    : '';
                const title = escapeHtml(item.title || 'Untitled');
                const creator = escapeHtml(item.creator || 'Unknown Creator');
                const year = escapeHtml(item.year || '');
                const dot = year ? ' · ' : '';
                const meta = creator + dot + year;
                const typeLabel = escapeHtml(getTypeLabel(item.type));
                const id = escapeHtml(item.id);
                const aria = escapeHtml('Open ' + title);
                const cardClass = hasCover ? 'library-card' : 'library-card library-card-no-cover';

                return [
                    '<article class="' + cardClass + '" ' + coverStyle + ' data-library-id="' + id + '" tabindex="0" role="button" aria-label="' + aria + '">',
                    '  <div class="library-card-overlay"></div>',
                    '  <div class="library-card-badge">' + typeLabel + '</div>',
                    '  <div class="library-card-meta">',
                    '    <h2 class="library-card-title">' + title + '</h2>',
                    '    <p class="library-card-subtitle">' + meta + '</p>',
                    '  </div>',
                    '</article>'
                ].join('');
            }).join('');
        },

        _setModalSearchStatus(message, tone) {
            const statusEl = document.getElementById('library-modal-search-status');
            if (!statusEl) return;
            const text = toText(message, '');
            if (!text) {
                statusEl.hidden = true;
                statusEl.textContent = '';
                statusEl.removeAttribute('data-tone');
                return;
            }
            statusEl.hidden = false;
            statusEl.textContent = text;
            statusEl.setAttribute('data-tone', toText(tone, 'info'));
        },

        _renderModalSearchResults(results) {
            const listEl = document.getElementById('library-modal-search-results');
            if (!listEl) return;

            if (!results || results.length === 0) {
                listEl.innerHTML = '';
                return;
            }

            listEl.innerHTML = results.map((album) => {
                const albumId = escapeHtml(album.id || '');
                const title = escapeHtml(album.name || 'Untitled Album');
                const artist = escapeHtml((album.artists || []).join(', ') || 'Unknown Artist');
                const imageStyle = album.image
                    ? "style=\"background-image:url('" + cssUrlValue(album.image) + "')\""
                    : '';

                return [
                    '<article class="library-modal-result">',
                    '  <div class="library-modal-result-cover" ' + imageStyle + '></div>',
                    '  <div class="library-modal-result-text">',
                    '    <p class="library-modal-result-title">' + title + '</p>',
                    '    <p class="library-modal-result-subtitle">' + artist + '</p>',
                    '  </div>',
                    '  <button class="library-modal-result-use" type="button" data-library-use-album-id="' + albumId + '">Use</button>',
                    '</article>'
                ].join('');
            }).join('');
        },

        _updateModalCoverPreview(url) {
            const previewEl = document.getElementById('library-modal-cover-preview');
            if (!previewEl) return;
            const cleaned = toText(url, '');
            previewEl.style.backgroundImage = cleaned ? "url('" + cssUrlValue(cleaned) + "')" : '';
            if (cleaned) {
                previewEl.classList.remove('is-empty');
            } else {
                previewEl.classList.add('is-empty');
            }
        },

        _readCoverFile(file, onDone) {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = toText(reader.result, '');
                if (dataUrl && typeof onDone === 'function') onDone(dataUrl);
            };
            reader.readAsDataURL(file);
        },

        openItemModal(itemId) {
            const item = LibraryStorage.getItem(itemId);
            if (!item) return;

            const modalEl = document.getElementById('library-item-modal');
            const titleEl = document.getElementById('library-modal-title');
            const creatorEl = document.getElementById('library-modal-creator');
            const typeEl = document.getElementById('library-modal-type');
            const yearEl = document.getElementById('library-modal-year');
            const tagsEl = document.getElementById('library-modal-tags');
            const notesEl = document.getElementById('library-modal-notes');
            const coverEl = document.getElementById('library-modal-cover-url');
            const searchQueryEl = document.getElementById('library-modal-search-query');
            if (!modalEl || !titleEl || !typeEl) return;

            this._activeModalItemId = item.id;
            this._modalSearchResults = [];
            this._setModalError('');
            this._setModalSearchStatus('', 'info');
            this._renderModalSearchResults([]);

            titleEl.value = item.title || '';
            if (creatorEl) creatorEl.value = item.creator || '';
            typeEl.value = normalizeMediaType(item.type);
            if (yearEl) yearEl.value = item.year || '';
            if (tagsEl) tagsEl.value = normalizeTags(item.tags).join(', ');
            if (notesEl) notesEl.value = item.notes || '';
            if (coverEl) coverEl.value = item.coverUrl || '';
            this._updateModalCoverPreview(item.coverUrl || '');

            if (searchQueryEl) {
                searchQueryEl.value = [toText(item.creator, ''), toText(item.title, '')].filter(Boolean).join(' ').trim();
            }

            if (this._modalHideTimer) {
                clearTimeout(this._modalHideTimer);
                this._modalHideTimer = null;
            }

            modalEl.hidden = false;
            requestAnimationFrame(() => modalEl.classList.add('is-open'));
            document.body.classList.add('library-modal-open');
            setTimeout(() => titleEl.focus(), 10);
        },

        closeItemModal() {
            const modalEl = document.getElementById('library-item-modal');
            if (!modalEl) return;
            modalEl.classList.remove('is-open');
            document.body.classList.remove('library-modal-open');

            this._modalHideTimer = setTimeout(() => {
                modalEl.hidden = true;
            }, 180);

            this._activeModalItemId = '';
            this._modalSearchResults = [];
            this._setModalError('');
            this._setModalSearchStatus('', 'info');
        },

        _collectModalPayload() {
            const titleEl = document.getElementById('library-modal-title');
            const creatorEl = document.getElementById('library-modal-creator');
            const typeEl = document.getElementById('library-modal-type');
            const yearEl = document.getElementById('library-modal-year');
            const tagsEl = document.getElementById('library-modal-tags');
            const notesEl = document.getElementById('library-modal-notes');
            const coverEl = document.getElementById('library-modal-cover-url');

            return {
                title: toText(titleEl && titleEl.value, ''),
                creator: toText(creatorEl && creatorEl.value, ''),
                type: toText(typeEl && typeEl.value, 'unknown'),
                year: toText(yearEl && yearEl.value, ''),
                tags: normalizeTags(tagsEl && tagsEl.value),
                notes: toText(notesEl && notesEl.value, ''),
                coverUrl: toText(coverEl && coverEl.value, '')
            };
        },

        _saveModalItem() {
            if (!this._activeModalItemId) return;
            const payload = this._collectModalPayload();
            if (!payload.title) {
                this._setModalError('Title is required.');
                const titleEl = document.getElementById('library-modal-title');
                if (titleEl) titleEl.focus();
                return;
            }

            const updated = LibraryStorage.updateItem(this._activeModalItemId, payload);
            if (!updated) {
                this._setModalError('Could not save this item.');
                return;
            }

            this.refresh();
            this.closeItemModal();
        },

        _deleteModalItem() {
            if (!this._activeModalItemId) return;
            const confirmed = window.confirm('Delete this library item?');
            if (!confirmed) return;

            const removed = LibraryStorage.deleteItem(this._activeModalItemId);
            if (!removed) {
                this._setModalError('Could not delete this item.');
                return;
            }

            this.refresh();
            this.closeItemModal();
        },

        async _searchAlbumFromModal() {
            const queryEl = document.getElementById('library-modal-search-query');
            const searchBtn = document.getElementById('library-modal-search-btn');
            if (!queryEl || !searchBtn) return;

            if (!window.SpotifyClient || typeof window.SpotifyClient.searchAlbums !== 'function') {
                this._setModalSearchStatus('Music search is unavailable.', 'error');
                return;
            }

            const query = toText(queryEl.value, '');
            if (!query) {
                this._setModalSearchStatus('Enter artist + album, or paste an Apple Music/iTunes URL.', 'warn');
                queryEl.focus();
                return;
            }

            const previousText = searchBtn.textContent;
            searchBtn.textContent = 'Searching...';
            searchBtn.disabled = true;
            this._setModalSearchStatus('', 'info');

            try {
                let results = [];
                if (typeof window.SpotifyClient.getAlbumByUrlOrId === 'function') {
                    const direct = await window.SpotifyClient.getAlbumByUrlOrId(query);
                    if (direct) results = [direct];
                }
                if (results.length === 0) {
                    results = await window.SpotifyClient.searchAlbums(query, 8);
                }

                this._modalSearchResults = Array.isArray(results) ? results : [];
                this._renderModalSearchResults(this._modalSearchResults);

                if (this._modalSearchResults.length === 0) {
                    this._setModalSearchStatus('No albums found for that query.', 'warn');
                } else {
                    this._setModalSearchStatus('Select a result to apply cover and metadata.', 'success');
                }
            } catch (error) {
                this._setModalSearchStatus(getMusicSearchError(error), 'error');
            } finally {
                searchBtn.textContent = previousText;
                searchBtn.disabled = false;
            }
        },

        _applyModalAlbumResult(albumId) {
            const selected = this._modalSearchResults.find((album) => String(album.id) === String(albumId));
            if (!selected) return;

            const titleEl = document.getElementById('library-modal-title');
            const creatorEl = document.getElementById('library-modal-creator');
            const typeEl = document.getElementById('library-modal-type');
            const yearEl = document.getElementById('library-modal-year');
            const notesEl = document.getElementById('library-modal-notes');
            const coverEl = document.getElementById('library-modal-cover-url');

            if (titleEl) titleEl.value = toText(selected.name, titleEl.value);
            if (creatorEl) creatorEl.value = toText((selected.artists || []).join(', '), creatorEl.value);
            if (typeEl) typeEl.value = 'album';
            if (yearEl) {
                const parsedYear = parseYearFromReleaseDate(selected.releaseDate);
                if (parsedYear) yearEl.value = parsedYear;
            }
            if (coverEl && selected.image) {
                coverEl.value = selected.image;
                this._updateModalCoverPreview(selected.image);
            }
            if (notesEl && !toText(notesEl.value, '') && selected.label) {
                notesEl.value = selected.label;
            }

            this._setModalSearchStatus('Result applied. Save changes to update this item.', 'success');
        },

        render() {
            this.init();
            this._renderTagFilterOptions();
            this._applyDisplaySettings();
            const items = LibraryStorage.getItems();
            const filtered = this._applyFilters(items);
            this._renderGrid(filtered, items.length);
        },

        refresh() {
            this.render();
        }
    };

    window.LibraryStorage = LibraryStorage;
    window.LibrarySettings = LibrarySettings;
    window.LibraryRenderer = LibraryRenderer;

    window.addItemToLibrary = function (payload) {
        const created = LibraryStorage.addItem(payload || {});
        if (window.LibraryRenderer && typeof window.LibraryRenderer.refresh === 'function') {
            window.LibraryRenderer.refresh();
        }
        return created;
    };

    window.openLibraryItemModal = function (itemId) {
        if (window.LibraryRenderer && typeof window.LibraryRenderer.openItemModal === 'function') {
            window.LibraryRenderer.openItemModal(itemId);
        }
    };
})();
