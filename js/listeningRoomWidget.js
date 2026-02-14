(function () {
    const OVERLAY_ID = 'listening-room-overlay';
    const NOTE_KEY_PREFIX = 'listening_note_';
    const NOTE_SAVE_DEBOUNCE_MS = 200;
    const AUTO_SHUFFLE_INTERVAL_MS = 15 * 60 * 1000;
    const ALLOWED_TYPES = new Set(['album', 'playlist', 'song']);
    const SHUFFLE_ITUNES_QUERIES = [
        'ambient',
        'jazz',
        'neo classical',
        'minimal',
        'electronic',
        'indie',
        'post rock',
        'soundtrack',
        'soul',
        'hip hop',
        'folk',
        'experimental',
        'house',
        'techno',
        'dream pop',
        'piano'
    ];

    let initialized = false;
    let overlayEl = null;
    let dialogEl = null;
    let embedContainerEl = null;
    let emptyStateEl = null;
    let noteTextareaEl = null;
    let lastFocusedEl = null;
    let activeVinyl = null;
    let noteSaveTimer = null;
    let autoShuffleTimer = null;
    let autoShuffleInFlight = false;

    function asText(value) {
        return String(value || '').trim();
    }

    function isObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function makeVinylId() {
        return `vinyl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function pickRandom(items) {
        if (!Array.isArray(items) || items.length === 0) return null;
        return items[Math.floor(Math.random() * items.length)] || null;
    }

    function setMusicStatus(message, tone) {
        if (typeof window.setVinylSpotifyStatus === 'function') {
            window.setVinylSpotifyStatus(message, tone);
        }
    }

    function getDefaultStorefront() {
        const locale = asText((navigator && navigator.language) || 'en-US');
        const parts = locale.split('-');
        const country = parts.length > 1 ? parts[1] : 'us';
        return asText(country || 'us').toLowerCase();
    }

    function parseStorefrontFromAppleUrl(url) {
        const raw = asText(url);
        if (!raw) return '';
        try {
            const parsed = new URL(raw);
            const parts = parsed.pathname.split('/').filter(Boolean);
            if (parts.length === 0) return '';
            const first = asText(parts[0]).toLowerCase();
            if (/^[a-z]{2}$/.test(first)) return first;
            return '';
        } catch (error) {
            return '';
        }
    }

    function parseAppleMusicRefFromEmbedUrl(url) {
        const raw = asText(url);
        if (!raw) return null;
        try {
            const parsed = new URL(raw);
            if (parsed.hostname.toLowerCase() !== 'embed.music.apple.com') return null;

            const parts = parsed.pathname.split('/').filter(Boolean);
            if (parts.length < 2) return null;

            const storefrontRaw = asText(parts[0]).toLowerCase();
            const storefront = /^[a-z]{2}$/.test(storefrontRaw) ? storefrontRaw : getDefaultStorefront();
            const typeRaw = asText(parts[1]).toLowerCase();
            const type = ALLOWED_TYPES.has(typeRaw) ? typeRaw : '';
            if (!type) return null;

            let id = '';
            if (type === 'song') {
                const songId = asText(parsed.searchParams.get('i'));
                if (/^\d{5,}$/.test(songId)) id = songId;
            }
            if (!id) {
                for (let index = parts.length - 1; index >= 2; index -= 1) {
                    const segment = asText(parts[index]);
                    const prefixed = segment.match(/^id(\d{5,})$/i);
                    if (prefixed) {
                        id = prefixed[1];
                        break;
                    }
                    if (/^\d{5,}$/.test(segment)) {
                        id = segment;
                        break;
                    }
                }
            }
            if (!id) {
                const idMatch = raw.match(/id(\d{5,})/i);
                if (idMatch) id = idMatch[1];
            }
            if (!id) return null;
            return { type, id, storefront: storefront || 'us' };
        } catch (error) {
            return null;
        }
    }

    function sanitizeAppleMusicRef(value) {
        if (!isObject(value)) return null;
        const typeRaw = asText(value.type).toLowerCase();
        const type = ALLOWED_TYPES.has(typeRaw) ? typeRaw : '';
        const id = asText(value.id);
        const storefront = asText(value.storefront || getDefaultStorefront()).toLowerCase() || 'us';
        if (!type || !id) return null;
        return { type, id, storefront };
    }

    function normalizeVinyl(raw) {
        const source = isObject(raw) ? raw : {};
        const appleMusic =
            sanitizeAppleMusicRef(source.appleMusic) ||
            (asText(source.itunesCollectionId)
                ? { type: 'album', id: asText(source.itunesCollectionId), storefront: getDefaultStorefront() }
                : null) ||
            parseAppleMusicRefFromEmbedUrl(source.appleMusicEmbedUrl);

        return {
            id: asText(source.id),
            artist: asText(source.artist),
            album: asText(source.album || source.record),
            coverUrl: asText(source.coverUrl || source.artwork),
            ritualLine: asText(source.ritualLine || source.notes),
            year: asText(source.year),
            genre: asText(source.genre),
            label: asText(source.label),
            appleMusicEmbedUrl: asText(source.appleMusicEmbedUrl),
            appleMusic,
            spotifyUrl: asText(source.spotifyUrl)
        };
    }

    function persistNormalizedVinyl(vinyl) {
        if (!window.Store || typeof Store.getRitualVinyl !== 'function' || typeof Store.saveRitualVinyl !== 'function') {
            return vinyl;
        }

        const current = Store.getRitualVinyl();
        const next = Object.assign({}, current);

        next.id = vinyl.id;
        next.artist = vinyl.artist;
        next.album = vinyl.album;
        next.record = vinyl.album;
        next.coverUrl = vinyl.coverUrl;
        next.artwork = vinyl.coverUrl;
        next.ritualLine = vinyl.ritualLine;
        next.notes = vinyl.ritualLine;
        next.year = vinyl.year;
        next.genre = vinyl.genre;
        next.label = vinyl.label;
        next.appleMusicEmbedUrl = vinyl.appleMusicEmbedUrl || '';
        if (vinyl.appleMusic && vinyl.appleMusic.id) {
            next.appleMusic = {
                type: vinyl.appleMusic.type,
                id: vinyl.appleMusic.id,
                storefront: vinyl.appleMusic.storefront || 'us'
            };
        } else {
            delete next.appleMusic;
        }
        if (vinyl.spotifyUrl) {
            next.spotifyUrl = vinyl.spotifyUrl;
        }

        Store.saveRitualVinyl(next);
        return vinyl;
    }

    function getCurrentVinyl() {
        const raw = (window.Store && typeof Store.getRitualVinyl === 'function') ? Store.getRitualVinyl() : {};
        const normalized = normalizeVinyl(raw);
        let changed = false;

        if (!normalized.id) {
            normalized.id = makeVinylId();
            changed = true;
        }
        if (!asText(raw.album) && normalized.album) changed = true;
        if (!asText(raw.coverUrl) && normalized.coverUrl) changed = true;
        if (!asText(raw.ritualLine) && normalized.ritualLine) changed = true;

        if (changed) {
            persistNormalizedVinyl(normalized);
        }
        return normalized;
    }

    function getEmbedUrl(vinyl) {
        if (!window.AppleMusicEmbedAdapter || typeof AppleMusicEmbedAdapter.getEmbedUrl !== 'function') return null;
        return AppleMusicEmbedAdapter.getEmbedUrl(vinyl);
    }

    function getNoteKey(vinylId) {
        return `${NOTE_KEY_PREFIX}${vinylId}`;
    }

    function saveActiveNoteImmediate() {
        if (!activeVinyl || !activeVinyl.id || !noteTextareaEl) return;
        localStorage.setItem(getNoteKey(activeVinyl.id), noteTextareaEl.value || '');
    }

    function ensureEmbedFullyVisible() {
        if (!dialogEl || !embedContainerEl) return;
        const viewportTopPadding = 20;
        const viewportBottomPadding = 20;
        const embedRect = embedContainerEl.getBoundingClientRect();
        const topLimit = viewportTopPadding;
        const bottomLimit = window.innerHeight - viewportBottomPadding;

        if (embedRect.top < topLimit) {
            dialogEl.scrollTop -= (topLimit - embedRect.top);
        }
        if (embedRect.bottom > bottomLimit) {
            dialogEl.scrollTop += (embedRect.bottom - bottomLimit);
        }
    }

    function createOverlayIfNeeded() {
        if (overlayEl) return;

        overlayEl = document.createElement('div');
        overlayEl.id = OVERLAY_ID;
        overlayEl.className = 'listening-room-overlay';
        overlayEl.setAttribute('aria-hidden', 'true');
        overlayEl.innerHTML = `
            <div class="listening-room-backdrop" data-listening-room-backdrop="true"></div>
            <div class="listening-room-dialog" role="dialog" aria-modal="true" aria-labelledby="listening-room-title" tabindex="-1">
                <button class="listening-room-close" type="button" aria-label="Close listening room">&times;</button>
                <div class="listening-room-dialog-body">
                    <div class="listening-room-content">
                        <div class="listening-room-kicker">Listening Room</div>
                        <h2 class="listening-room-title" id="listening-room-title">Untitled Album</h2>
                        <div class="listening-room-artist" id="listening-room-artist">Unknown Artist</div>
                        <div class="listening-room-player-shell">
                            <div class="listening-room-embed-container" id="listening-room-embed-container"></div>
                            <div class="listening-room-empty" id="listening-room-empty">No preview linked yet.</div>
                        </div>
                        <label class="listening-room-note-label" for="listening-room-note">Listening note</label>
                        <textarea class="listening-room-note" id="listening-room-note" placeholder="What surfaced while listening?"></textarea>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlayEl);
        dialogEl = overlayEl.querySelector('.listening-room-dialog');
        embedContainerEl = overlayEl.querySelector('#listening-room-embed-container');
        emptyStateEl = overlayEl.querySelector('#listening-room-empty');
        noteTextareaEl = overlayEl.querySelector('#listening-room-note');

        const closeBtn = overlayEl.querySelector('.listening-room-close');
        const backdrop = overlayEl.querySelector('[data-listening-room-backdrop="true"]');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => close());
        }
        if (backdrop) {
            backdrop.addEventListener('click', () => close());
        }
        if (noteTextareaEl) {
            noteTextareaEl.addEventListener('input', () => {
                if (!activeVinyl || !activeVinyl.id) return;
                clearTimeout(noteSaveTimer);
                noteSaveTimer = setTimeout(() => saveActiveNoteImmediate(), NOTE_SAVE_DEBOUNCE_MS);
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && overlayEl && overlayEl.classList.contains('is-open')) {
                close();
            }
        });
    }

    function updateOverlayContent(vinyl) {
        createOverlayIfNeeded();
        if (!overlayEl) return;

        const titleEl = overlayEl.querySelector('#listening-room-title');
        const artistEl = overlayEl.querySelector('#listening-room-artist');
        if (titleEl) titleEl.textContent = vinyl.album || 'No album selected';
        if (artistEl) artistEl.textContent = vinyl.artist || 'Unknown Artist';

        const embedUrl = getEmbedUrl(vinyl);
        if (embedUrl) {
            emptyStateEl.style.display = 'none';
            if (window.AppleMusicEmbedAdapter && typeof AppleMusicEmbedAdapter.renderEmbed === 'function') {
                AppleMusicEmbedAdapter.renderEmbed(embedContainerEl, embedUrl);
            }
        } else {
            if (window.AppleMusicEmbedAdapter && typeof AppleMusicEmbedAdapter.destroyEmbed === 'function') {
                AppleMusicEmbedAdapter.destroyEmbed(embedContainerEl);
            }
            emptyStateEl.style.display = 'block';
        }

        if (noteTextareaEl) {
            noteTextareaEl.value = localStorage.getItem(getNoteKey(vinyl.id)) || '';
        }
    }

    function open(options = {}) {
        const vinyl = getCurrentVinyl();
        createOverlayIfNeeded();
        activeVinyl = vinyl;
        lastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        updateOverlayContent(vinyl);
        overlayEl.classList.add('is-open');
        overlayEl.setAttribute('aria-hidden', 'false');
        document.body.classList.add('listening-room-open');
        if (dialogEl) dialogEl.scrollTop = 0;

        const shouldFocusNote = !!(options && options.focusNote);
        const focusTarget = shouldFocusNote && noteTextareaEl ? noteTextareaEl : dialogEl;
        if (focusTarget && typeof focusTarget.focus === 'function') {
            setTimeout(() => focusTarget.focus(), 0);
        }
        setTimeout(() => ensureEmbedFullyVisible(), 40);
    }

    function close() {
        if (!overlayEl || !overlayEl.classList.contains('is-open')) return;
        clearTimeout(noteSaveTimer);
        saveActiveNoteImmediate();

        if (window.AppleMusicEmbedAdapter && typeof AppleMusicEmbedAdapter.destroyEmbed === 'function') {
            AppleMusicEmbedAdapter.destroyEmbed(embedContainerEl);
        }

        overlayEl.classList.remove('is-open');
        overlayEl.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('listening-room-open');
        activeVinyl = null;

        if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
            setTimeout(() => lastFocusedEl.focus(), 0);
        }
    }

    function syncForm(vinyl) {
        const artistInput = document.getElementById('inp-vinyl-artist');
        const albumInput = document.getElementById('inp-vinyl-album');
        const ritualInput = document.getElementById('inp-vinyl-notes');
        const yearInput = document.getElementById('inp-vinyl-year');
        const genreInput = document.getElementById('inp-vinyl-genre');
        const labelInput = document.getElementById('inp-vinyl-label');
        const embedInput = document.getElementById('inp-vinyl-embed-url');
        const appleTypeInput = document.getElementById('inp-vinyl-apple-type');
        const appleIdInput = document.getElementById('inp-vinyl-apple-id');
        const appleStoreInput = document.getElementById('inp-vinyl-apple-storefront');
        const queryInput = document.getElementById('inp-vinyl-bandcamp');

        if (artistInput) artistInput.value = vinyl.artist || '';
        if (albumInput) albumInput.value = vinyl.album || '';
        if (ritualInput) ritualInput.value = vinyl.ritualLine || '';
        if (yearInput) yearInput.value = vinyl.year || '';
        if (genreInput) genreInput.value = vinyl.genre || '';
        if (labelInput) labelInput.value = vinyl.label || '';
        if (embedInput) embedInput.value = vinyl.appleMusicEmbedUrl || '';
        if (appleTypeInput) appleTypeInput.value = (vinyl.appleMusic && vinyl.appleMusic.type) || 'album';
        if (appleIdInput) appleIdInput.value = (vinyl.appleMusic && vinyl.appleMusic.id) || '';
        if (appleStoreInput) appleStoreInput.value = (vinyl.appleMusic && vinyl.appleMusic.storefront) || getDefaultStorefront();
        if (queryInput && document.activeElement !== queryInput) {
            queryInput.value = vinyl.spotifyUrl || vinyl.appleMusicEmbedUrl || ((vinyl.appleMusic && vinyl.appleMusic.id) || '');
        }
    }

    function render() {
        const vinyl = getCurrentVinyl();
        const artistDisplay = document.getElementById('vinyl-artist-display');
        const albumDisplay = document.getElementById('vinyl-album-display');
        const ritualDisplay = document.getElementById('vinyl-notes-display');
        const metaDisplay = document.getElementById('vinyl-meta-display');
        const coverPreview = document.getElementById('vinyl-artwork-preview');

        if (artistDisplay) artistDisplay.textContent = vinyl.artist || 'No Artist Set';
        if (albumDisplay) albumDisplay.textContent = vinyl.album || 'No Album Set';
        if (ritualDisplay) {
            const ritualText = asText(vinyl.ritualLine);
            if (ritualText) {
                ritualDisplay.textContent = ritualText;
                ritualDisplay.style.display = 'block';
            } else {
                ritualDisplay.textContent = '';
                ritualDisplay.style.display = 'none';
            }
        }
        if (metaDisplay) {
            const parts = [vinyl.year, vinyl.genre, vinyl.label].filter(Boolean);
            metaDisplay.textContent = parts.join(' • ');
            metaDisplay.style.display = parts.length ? 'block' : 'none';
        }

        if (coverPreview) {
            if (vinyl.coverUrl) {
                coverPreview.style.backgroundImage = `url(${vinyl.coverUrl})`;
                coverPreview.innerHTML = '';
            } else {
                coverPreview.style.backgroundImage = 'none';
                coverPreview.innerHTML = '<span style="font-size:30px; opacity:0.3">💿</span>';
            }
            coverPreview.onclick = (event) => {
                if (event) event.stopPropagation();
                open();
            };
        }

        const embedUrl = getEmbedUrl(vinyl);
        const playPreviewBtn = document.getElementById('btn-vinyl-play-preview');
        const editBtn = document.getElementById('btn-vinyl-edit');
        const quickPreviewBtn = document.getElementById('btn-vinyl-spotify');
        const shuffleBtn = document.getElementById('btn-vinyl-shuffle');
        const addLibraryBtn = document.getElementById('btn-vinyl-add-library');

        if (editBtn) {
            editBtn.onclick = (event) => {
                if (event) event.stopPropagation();
                if (typeof window.toggleVinylEdit === 'function') {
                    window.toggleVinylEdit();
                }
            };
        }
        if (playPreviewBtn) {
            playPreviewBtn.disabled = !embedUrl;
            playPreviewBtn.classList.toggle('is-disabled', !embedUrl);
            playPreviewBtn.onclick = () => open();
        }
        if (quickPreviewBtn) {
            quickPreviewBtn.title = embedUrl ? 'Play preview' : 'Enter room';
            quickPreviewBtn.onclick = (event) => {
                if (event) event.stopPropagation();
                open();
            };
        }
        if (shuffleBtn) {
            shuffleBtn.onclick = async (event) => {
                if (event) event.stopPropagation();
                await shuffleFromItunes();
            };
        }
        if (addLibraryBtn) {
            addLibraryBtn.disabled = !vinyl.album;
            addLibraryBtn.classList.toggle('is-disabled', !vinyl.album);
            addLibraryBtn.onclick = (event) => {
                if (event) event.stopPropagation();
                if (typeof window.addVinylToLibrary === 'function') {
                    window.addVinylToLibrary();
                }
            };
        }

        syncForm(vinyl);
    }

    function saveVinylFromForm() {
        const vinyl = getCurrentVinyl();
        const artistInput = document.getElementById('inp-vinyl-artist');
        const albumInput = document.getElementById('inp-vinyl-album');
        const ritualInput = document.getElementById('inp-vinyl-notes');
        const yearInput = document.getElementById('inp-vinyl-year');
        const genreInput = document.getElementById('inp-vinyl-genre');
        const labelInput = document.getElementById('inp-vinyl-label');
        const embedInput = document.getElementById('inp-vinyl-embed-url');
        const appleTypeInput = document.getElementById('inp-vinyl-apple-type');
        const appleIdInput = document.getElementById('inp-vinyl-apple-id');
        const appleStoreInput = document.getElementById('inp-vinyl-apple-storefront');

        vinyl.artist = artistInput ? asText(artistInput.value) : vinyl.artist;
        vinyl.album = albumInput ? asText(albumInput.value) : vinyl.album;
        vinyl.ritualLine = ritualInput ? asText(ritualInput.value) : vinyl.ritualLine;
        vinyl.year = yearInput ? asText(yearInput.value) : vinyl.year;
        vinyl.genre = genreInput ? asText(genreInput.value) : vinyl.genre;
        vinyl.label = labelInput ? asText(labelInput.value) : vinyl.label;
        vinyl.appleMusicEmbedUrl = embedInput ? asText(embedInput.value) : vinyl.appleMusicEmbedUrl;

        const appleTypeRaw = appleTypeInput ? asText(appleTypeInput.value).toLowerCase() : '';
        const appleType = ALLOWED_TYPES.has(appleTypeRaw) ? appleTypeRaw : 'album';
        const appleId = appleIdInput ? asText(appleIdInput.value) : '';
        const storefrontRaw = appleStoreInput ? asText(appleStoreInput.value).toLowerCase() : '';
        const storefront = storefrontRaw || getDefaultStorefront();

        if (appleId) {
            vinyl.appleMusic = { type: appleType, id: appleId, storefront: storefront || 'us' };
            if (!vinyl.appleMusicEmbedUrl && window.AppleMusicEmbedAdapter && typeof AppleMusicEmbedAdapter.buildFromParts === 'function') {
                vinyl.appleMusicEmbedUrl = AppleMusicEmbedAdapter.buildFromParts(appleType, appleId, storefront);
            }
        } else {
            vinyl.appleMusic = null;
        }

        persistNormalizedVinyl(vinyl);
        render();
        return vinyl;
    }

    async function shuffleFromItunes(options = {}) {
        const opts = isObject(options) ? options : {};
        const silent = !!opts.silent;
        const shuffleBtn = document.getElementById('btn-vinyl-shuffle');
        if (!window.SpotifyClient || typeof window.SpotifyClient.searchAlbums !== 'function') {
            if (!silent) setMusicStatus('Music search module is unavailable.', 'error');
            return null;
        }

        const seed = pickRandom(SHUFFLE_ITUNES_QUERIES) || 'music';
        if (shuffleBtn) {
            shuffleBtn.disabled = true;
            shuffleBtn.classList.add('is-disabled');
            shuffleBtn.title = 'Searching iTunes...';
        }

        try {
            let results = await window.SpotifyClient.searchAlbums(seed, 14);
            if (!Array.isArray(results) || results.length === 0) {
                results = await window.SpotifyClient.searchAlbums('album', 14);
            }

            const pool = (results || []).filter((album) => album && album.id && album.name);
            const randomAlbum = pickRandom(pool);
            if (!randomAlbum) {
                if (!silent) setMusicStatus('No iTunes albums found right now. Try again.', 'warn');
                return null;
            }

            const applied = applySearchAlbum(randomAlbum);
            if (!silent) setMusicStatus(`Shuffled: ${applied.album || randomAlbum.name}`, 'success');
            return applied;
        } catch (error) {
            console.error('[ListeningRoom] iTunes shuffle failed:', error);
            if (!silent) setMusicStatus('Shuffle failed. Please try again.', 'error');
            return null;
        } finally {
            if (shuffleBtn) {
                shuffleBtn.disabled = false;
                shuffleBtn.classList.remove('is-disabled');
                shuffleBtn.title = 'Shuffle iTunes album';
            }
        }
    }

    function applySearchAlbum(album) {
        const vinyl = getCurrentVinyl();
        const artists = Array.isArray(album && album.artists) ? album.artists.filter(Boolean) : [];
        const artistName = artists.join(', ');
        const albumName = asText(album && album.name);
        const image = asText(album && album.image);
        const releaseDate = asText(album && album.releaseDate);
        const genre = asText(album && album.genre);
        const label = asText(album && album.label);
        const albumId = asText(album && album.id);
        const sourceUrl = asText(album && album.spotifyUrl);
        const storefront = parseStorefrontFromAppleUrl(sourceUrl) || getDefaultStorefront();

        if (artistName) vinyl.artist = artistName;
        if (albumName) vinyl.album = albumName;
        if (image) vinyl.coverUrl = image;
        if (releaseDate) vinyl.year = releaseDate.slice(0, 4);
        if (genre) vinyl.genre = genre;
        if (label) vinyl.label = label;
        if (sourceUrl) vinyl.spotifyUrl = sourceUrl;

        if (albumId) {
            vinyl.appleMusic = { type: 'album', id: albumId, storefront };
            if (window.AppleMusicEmbedAdapter && typeof AppleMusicEmbedAdapter.buildFromParts === 'function') {
                vinyl.appleMusicEmbedUrl = AppleMusicEmbedAdapter.buildFromParts('album', albumId, storefront);
            }
        }

        persistNormalizedVinyl(vinyl);
        render();
        return vinyl;
    }

    function startAutoShuffle() {
        if (autoShuffleTimer) return;
        autoShuffleTimer = setInterval(async () => {
            if (autoShuffleInFlight) return;
            const widget = document.getElementById('ritual-vinyl');
            if (widget && widget.classList.contains('editing')) return;
            autoShuffleInFlight = true;
            try {
                await shuffleFromItunes({ silent: true });
            } finally {
                autoShuffleInFlight = false;
            }
        }, AUTO_SHUFFLE_INTERVAL_MS);
    }

    function init() {
        if (initialized) return;
        initialized = true;
        if (window.AppleMusicEmbedAdapter && typeof AppleMusicEmbedAdapter.init === 'function') {
            AppleMusicEmbedAdapter.init().catch((error) => {
                console.warn('[ListeningRoom] AppleMusicEmbedAdapter init warning:', error);
            });
        }
        createOverlayIfNeeded();
        render();
        startAutoShuffle();
    }

    window.ListeningRoomWidget = {
        init,
        render,
        open,
        close,
        saveVinylFromForm,
        applySearchAlbum,
        shuffleFromItunes
    };
})();
