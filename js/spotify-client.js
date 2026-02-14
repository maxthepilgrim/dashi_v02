(function () {
    const API_BASE = 'https://itunes.apple.com';

    function createError(code, message) {
        const error = new Error(message || code);
        error.code = code;
        return error;
    }

    function clamp(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return min;
        return Math.min(max, Math.max(min, Math.floor(number)));
    }

    function getCountryCode() {
        const locale = String((navigator && navigator.language) || 'en-US');
        const parts = locale.split('-');
        const code = parts.length > 1 ? parts[1] : 'US';
        return String(code || 'US').toUpperCase();
    }

    function getRedirectUri() {
        return `${window.location.origin}${window.location.pathname}`;
    }

    function parseAlbumId(input) {
        const raw = String(input || '').trim();
        if (!raw) return null;

        const plainIdMatch = raw.match(/^(\d{5,})$/);
        if (plainIdMatch) return plainIdMatch[1];

        try {
            const parsed = new URL(raw);
            const host = parsed.hostname.toLowerCase();
            if (!host.includes('apple.com')) return null;

            const parts = parsed.pathname.split('/').filter(Boolean);
            for (let index = parts.length - 1; index >= 0; index--) {
                const part = parts[index];
                const idWithPrefixMatch = part.match(/^id(\d{5,})$/i);
                if (idWithPrefixMatch) return idWithPrefixMatch[1];
                if (/^\d{5,}$/.test(part)) return part;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function pickArtwork(result) {
        const direct = [
            result.artworkUrl600,
            result.artworkUrl512,
            result.artworkUrl300,
            result.artworkUrl100,
            result.artworkUrl60,
            result.artworkUrl30
        ].find(Boolean);

        if (!direct) return '';

        return direct
            .replace(/100x100bb\.(jpg|png)$/i, '600x600bb.$1')
            .replace(/100x100-75\.(jpg|png)$/i, '600x600-75.$1')
            .replace(/\/(\d{2,4})x\1bb\.(jpg|png)$/i, '/600x600bb.$2');
    }

    function normalizeAlbum(result) {
        const id = result && result.collectionId ? String(result.collectionId) : '';
        const name = result && result.collectionName ? String(result.collectionName) : '';
        const artistName = result && result.artistName ? String(result.artistName) : '';
        const url = result && (result.collectionViewUrl || result.trackViewUrl) ? String(result.collectionViewUrl || result.trackViewUrl) : '';
        const image = pickArtwork(result || {});
        const genre = result && result.primaryGenreName ? String(result.primaryGenreName) : '';
        const label = result && result.copyright ? String(result.copyright) : '';

        return {
            id,
            name,
            artists: artistName ? [artistName] : [],
            images: image ? [{ url: image }] : [],
            image,
            uri: '',
            releaseDate: result && result.releaseDate ? String(result.releaseDate) : '',
            genre,
            label,
            spotifyUrl: url,
            source: 'itunes',
            service: 'itunes'
        };
    }

    async function request(endpoint, params) {
        const url = new URL(`${API_BASE}/${endpoint}`);
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && String(value) !== '') {
                url.searchParams.set(key, String(value));
            }
        });

        let response;
        try {
            response = await fetch(url.toString(), {
                method: 'GET',
                cache: 'no-store'
            });
        } catch (error) {
            throw createError('MUSIC_NETWORK_ERROR', 'Network error while contacting iTunes.');
        }

        if (!response.ok) {
            throw createError('MUSIC_API_ERROR', `iTunes request failed (${response.status}).`);
        }

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw createError('MUSIC_API_ERROR', 'Invalid iTunes response payload.');
        }

        if (!payload || !Array.isArray(payload.results)) {
            throw createError('MUSIC_API_ERROR', 'Unexpected iTunes response shape.');
        }

        return payload.results;
    }

    async function getAlbumById(albumId) {
        const id = String(albumId || '').trim();
        if (!id) return null;

        const results = await request('lookup', {
            id,
            entity: 'album',
            media: 'music',
            country: getCountryCode()
        });

        const exact = results.find((item) => String(item.collectionId || '') === id);
        const firstAlbum = exact || results.find((item) => String(item.wrapperType || '').toLowerCase() === 'collection');
        if (!firstAlbum) return null;
        return normalizeAlbum(firstAlbum);
    }

    async function searchAlbums(query, limit) {
        const term = String(query || '').trim();
        if (!term) return [];

        const cappedLimit = clamp(limit || 8, 1, 20);
        const results = await request('search', {
            term,
            entity: 'album',
            media: 'music',
            country: getCountryCode(),
            limit: cappedLimit
        });

        return results
            .filter((item) => String(item.wrapperType || '').toLowerCase() === 'collection')
            .map(normalizeAlbum)
            .filter((album) => album.id && album.name);
    }

    async function getAlbumByUrlOrId(input) {
        const albumId = parseAlbumId(input);
        if (!albumId) return null;
        return getAlbumById(albumId);
    }

    function init() {
        return true;
    }

    async function connect(returnContext) {
        return { connected: true, returnContext: returnContext || null, service: 'itunes' };
    }

    function disconnect() {
        return;
    }

    function isConfigured() {
        return true;
    }

    function isConnected() {
        return true;
    }

    function getClientId() {
        return '';
    }

    function setClientId() {
        return;
    }

    async function handleAuthCallback() {
        return null;
    }

    function getServiceName() {
        return 'itunes';
    }

    window.SpotifyClient = {
        init,
        connect,
        disconnect,
        isConfigured,
        isConnected,
        searchAlbums,
        getAlbumByUrlOrId,
        handleAuthCallback,
        getClientId,
        setClientId,
        getRedirectUri,
        getServiceName
    };
})();
