(function () {
    const IFRAME_CLASS = 'listening-room-embed-iframe';
    const ALLOWED_TYPES = new Set(['album', 'playlist', 'song']);

    function asText(value) {
        return String(value || '').trim();
    }

    function isObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function sanitizeEmbedUrl(value) {
        const raw = asText(value);
        if (!raw) return '';
        try {
            const parsed = new URL(raw, window.location.origin);
            if (parsed.protocol !== 'https:') return '';
            if (parsed.hostname.toLowerCase() !== 'embed.music.apple.com') return '';
            return parsed.toString();
        } catch (error) {
            return '';
        }
    }

    function buildEmbedUrlFromAppleMusic(appleMusic) {
        if (!isObject(appleMusic)) return '';
        const typeRaw = asText(appleMusic.type).toLowerCase();
        const type = ALLOWED_TYPES.has(typeRaw) ? typeRaw : '';
        const id = asText(appleMusic.id);
        const storefrontRaw = asText(appleMusic.storefront || 'us').toLowerCase();
        const storefront = storefrontRaw || 'us';
        if (!type || !id) return '';
        return `https://embed.music.apple.com/${storefront}/${type}/${id}`;
    }

    function inferEmbedTypeFromUrl(embedUrl) {
        const raw = asText(embedUrl);
        if (!raw) return 'album';
        try {
            const parsed = new URL(raw);
            const parts = parsed.pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
                const type = asText(parts[1]).toLowerCase();
                if (ALLOWED_TYPES.has(type)) return type;
            }
        } catch (error) {
            // fallback below
        }
        return 'album';
    }

    function getEmbedHeightForType(type) {
        return type === 'song' ? 175 : 450;
    }

    async function init() {
        return;
    }

    function getEmbedUrl(vinyl) {
        const embed = sanitizeEmbedUrl(vinyl && vinyl.appleMusicEmbedUrl);
        if (embed) return embed;
        const built = buildEmbedUrlFromAppleMusic(vinyl && vinyl.appleMusic);
        return built || null;
    }

    function renderEmbed(containerEl, embedUrl) {
        if (!containerEl || !embedUrl) return;

        let iframe = containerEl.querySelector(`.${IFRAME_CLASS}`);
        const embedType = inferEmbedTypeFromUrl(embedUrl);
        const embedHeight = getEmbedHeightForType(embedType);
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.className = IFRAME_CLASS;
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'origin';
            iframe.setAttribute('allow', 'encrypted-media *; fullscreen *; clipboard-write *;');
            iframe.setAttribute(
                'sandbox',
                'allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation'
            );
            iframe.setAttribute('title', 'Apple Music Preview');
            containerEl.innerHTML = '';
            containerEl.appendChild(iframe);
        }

        iframe.height = String(embedHeight);
        iframe.style.height = `${embedHeight}px`;

        if (iframe.src !== embedUrl) {
            iframe.src = embedUrl;
        }
    }

    function destroyEmbed(containerEl) {
        if (!containerEl) return;
        const iframe = containerEl.querySelector(`.${IFRAME_CLASS}`);
        if (!iframe) return;
        iframe.src = 'about:blank';
        iframe.remove();
    }

    function buildFromParts(type, id, storefront) {
        return buildEmbedUrlFromAppleMusic({ type, id, storefront });
    }

    window.AppleMusicEmbedAdapter = {
        init,
        getEmbedUrl,
        renderEmbed,
        destroyEmbed,
        buildFromParts
    };
})();
