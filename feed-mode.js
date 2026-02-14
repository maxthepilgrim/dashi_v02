(function () {
    'use strict';

    var PREFS_KEY = 'lifeos-feed-settings-v1';
    var VALID_SOURCES = ['all', 'journal', 'activity', 'walk', 'library', 'archive'];
    var VALID_SORTS = ['smart', 'recent'];
    var VALID_WINDOWS = ['24h', '7d', '30d', 'all'];
    var VALID_CONTEXT_MODES = ['personal', 'business', 'vision', 'ritual', 'library', 'shared'];
    var PAGE_SIZE = 40;

    var SOURCE_LABELS = {
        journal: 'Journal',
        activity: 'Activity',
        walk: 'Walk',
        library: 'Library',
        archive: 'Archive'
    };

    var SOURCE_BOOST = {
        journal: 0.22,
        activity: 0.18,
        walk: 0.16,
        library: 0.10,
        archive: 0.09
    };

    function toText(value, fallback) {
        if (value == null) return fallback || '';
        return String(value).trim();
    }

    function safeParse(text, fallback) {
        if (!text) return fallback;
        try {
            var parsed = JSON.parse(text);
            return parsed == null ? fallback : parsed;
        } catch (error) {
            return fallback;
        }
    }

    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function toTimestamp(value) {
        var ts = new Date(value).getTime();
        return Number.isFinite(ts) ? ts : null;
    }

    function toIso(value, fallbackIso) {
        var ts = toTimestamp(value);
        if (ts == null) return fallbackIso;
        return new Date(ts).toISOString();
    }

    function normalizeSource(value, fallback) {
        var next = toText(value, fallback || '').toLowerCase();
        return VALID_SOURCES.indexOf(next) >= 0 ? next : (fallback || 'all');
    }

    function normalizeSort(value, fallback) {
        var next = toText(value, fallback || '').toLowerCase();
        return VALID_SORTS.indexOf(next) >= 0 ? next : (fallback || 'smart');
    }

    function normalizeWindow(value, fallback) {
        var next = toText(value, fallback || '').toLowerCase();
        return VALID_WINDOWS.indexOf(next) >= 0 ? next : (fallback || 'all');
    }

    function normalizeContextMode(value, fallback) {
        var next = toText(value, fallback || '').toLowerCase();
        return VALID_CONTEXT_MODES.indexOf(next) >= 0 ? next : (fallback || 'personal');
    }

    function parseOptionalEnum(value, validValues) {
        var next = toText(value, '').toLowerCase();
        if (!next) return '';
        return validValues.indexOf(next) >= 0 ? next : '';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeUrlText(value) {
        return toText(value, '').replace(/[)\],.;!?]+$/, '');
    }

    function sanitizeMediaUrl(value) {
        var raw = normalizeUrlText(value);
        if (!raw) return '';
        var lower = raw.toLowerCase();
        if (lower.indexOf('javascript:') === 0) return '';
        if (lower.indexOf('data:image/') === 0) return raw;
        if (lower.indexOf('https://') === 0 || lower.indexOf('http://') === 0 || lower.indexOf('file://') === 0) return raw;
        if (raw.charAt(0) === '/') return raw;
        return '';
    }

    function looksLikeImageUrl(url) {
        var safe = toText(url, '').toLowerCase();
        if (!safe) return false;
        if (safe.indexOf('data:image/') === 0) return true;
        return /(\.png|\.jpe?g|\.gif|\.webp|\.avif|\.svg)(\?|#|$)/i.test(safe);
    }

    function extractUrls(text) {
        var raw = toText(text, '');
        if (!raw) return [];
        var matches = raw.match(/\b(?:https?:\/\/|file:\/\/)[^\s<>"']+/gi);
        return Array.isArray(matches) ? matches : [];
    }

    function isMediaHintKey(key) {
        var normalized = toText(key, '').toLowerCase();
        if (!normalized) return false;
        return normalized.indexOf('cover') >= 0 ||
            normalized.indexOf('artwork') >= 0 ||
            normalized.indexOf('image') >= 0 ||
            normalized.indexOf('photo') >= 0 ||
            normalized.indexOf('thumbnail') >= 0 ||
            normalized.indexOf('poster') >= 0;
    }

    function pushMediaCandidate(candidates, value, allowUnsafeImageExt) {
        if (!Array.isArray(candidates)) return;
        var url = sanitizeMediaUrl(value);
        if (!url) return;
        if (!allowUnsafeImageExt && !looksLikeImageUrl(url)) return;
        candidates.push(url);
    }

    function collectMediaFromObject(source, candidates, depth) {
        if (!source || depth > 2) return;
        if (Array.isArray(source)) {
            source.forEach(function (item) {
                if (typeof item === 'string') {
                    pushMediaCandidate(candidates, item, false);
                    return;
                }
                collectMediaFromObject(item, candidates, depth + 1);
            });
            return;
        }

        if (typeof source !== 'object') return;

        Object.keys(source).forEach(function (key) {
            var value = source[key];
            if (value == null) return;

            if (typeof value === 'string') {
                var hint = isMediaHintKey(key);
                pushMediaCandidate(candidates, value, hint);
                if (!hint) {
                    extractUrls(value).forEach(function (url) {
                        pushMediaCandidate(candidates, url, false);
                    });
                }
                return;
            }

            if (Array.isArray(value) || typeof value === 'object') {
                collectMediaFromObject(value, candidates, depth + 1);
            }
        });
    }

    function collectEventMedia(sourcePayload, fallbackText) {
        var candidates = [];
        collectMediaFromObject(sourcePayload, candidates, 0);
        extractUrls(fallbackText).forEach(function (url) {
            pushMediaCandidate(candidates, url, false);
        });

        var seen = {};
        var unique = [];
        candidates.forEach(function (url) {
            if (!url || seen[url]) return;
            seen[url] = true;
            unique.push({
                url: url,
                alt: 'Entry media'
            });
        });
        return unique.slice(0, 3);
    }

    function localDateKey(timestampIso) {
        var date = new Date(timestampIso);
        if (!Number.isFinite(date.getTime())) return '';
        var year = String(date.getFullYear());
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function formatDateTime(timestampIso) {
        var date = new Date(timestampIso);
        if (!Number.isFinite(date.getTime())) return 'Unknown time';
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatDayHeading(timestampIso) {
        var date = new Date(timestampIso);
        if (!Number.isFinite(date.getTime())) return 'Unknown day';
        return date.toLocaleDateString([], {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function parseDurationMinutes(rawValue) {
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            return Math.max(0, Math.round(rawValue));
        }

        var text = toText(rawValue, '').toLowerCase();
        if (!text) return 0;

        var hm = text.match(/^(\d{1,2}):(\d{2})$/);
        if (hm) {
            return (parseInt(hm[1], 10) * 60) + parseInt(hm[2], 10);
        }

        var hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
        var minsMatch = text.match(/(\d+(?:\.\d+)?)\s*m/);
        if (hoursMatch || minsMatch) {
            var total = 0;
            if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
            if (minsMatch) total += parseFloat(minsMatch[1]);
            return Math.max(0, Math.round(total));
        }

        var plain = parseFloat(text.replace(/[^\d.]/g, ''));
        if (Number.isFinite(plain)) {
            return Math.max(0, Math.round(plain));
        }

        return 0;
    }

    function safeStoreCall(methodName, fallback) {
        try {
            if (window.Store && typeof window.Store[methodName] === 'function') {
                return window.Store[methodName]();
            }
        } catch (error) {
            console.warn('[FeedMode] Store call failed for', methodName, error);
        }
        return fallback;
    }

    function ensureEventId(source, sourceId, timestampIso, index) {
        var baseId = toText(sourceId, '');
        if (baseId) return source + ':' + baseId;
        return source + ':' + toText(timestampIso, '') + ':' + String(index || 0);
    }

    /*
      Canonical feed event interface:
      {
        id: string,
        source: "journal" | "activity" | "walk" | "vision" | "library" | "archive",
        contextMode: "personal" | "business" | "vision" | "ritual" | "library" | "shared",
        timestamp: string,
        title: string,
        body: string,
        tags: string[],
        meta: object,
        canDelete: boolean,
        canOpenSource: boolean
      }
    */
    function buildEvent(payload, index) {
        var source = normalizeSource(payload && payload.source, 'journal');
        var meta = payload && payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
        var sourceId = toText(payload && payload.sourceId, '') || toText(meta.sourceId, '');
        var timestamp = toIso(payload && payload.timestamp, new Date().toISOString());
        var tags = safeArray(payload && payload.tags).map(function (tag) {
            return toText(tag, '').toLowerCase();
        }).filter(Boolean);

        if (sourceId && !meta.sourceId) {
            meta.sourceId = sourceId;
        }

        return {
            id: ensureEventId(source, sourceId, timestamp, index),
            source: source,
            contextMode: normalizeContextMode(payload && payload.contextMode, 'personal'),
            timestamp: timestamp,
            title: toText(payload && payload.title, 'Untitled Event'),
            body: toText(payload && payload.body, ''),
            tags: tags,
            meta: meta,
            media: safeArray(payload && payload.media),
            canDelete: Boolean(payload && payload.canDelete),
            canOpenSource: payload && payload.canOpenSource !== false
        };
    }

    function getLibraryItemsFallback() {
        var parsed = safeParse(localStorage.getItem('libraryMediaItems'), []);
        return safeArray(parsed);
    }

    function deleteLibraryFallback(itemId) {
        var id = toText(itemId, '');
        if (!id) return false;

        var items = getLibraryItemsFallback();
        var next = items.filter(function (item) {
            return toText(item && item.id, '') !== id;
        });

        if (next.length === items.length) return false;
        localStorage.setItem('libraryMediaItems', JSON.stringify(next));
        return true;
    }

    var FeedPrefs = {
        defaults: {
            source: 'all',
            sort: 'smart',
            window: 'all',
            search: ''
        },

        normalize(raw) {
            var src = raw && typeof raw === 'object' ? raw : {};
            return {
                source: normalizeSource(src.source, 'all'),
                sort: normalizeSort(src.sort, 'smart'),
                window: normalizeWindow(src.window, 'all'),
                search: toText(src.search, '')
            };
        },

        get() {
            var parsed = safeParse(localStorage.getItem(PREFS_KEY), this.defaults);
            return this.normalize(parsed);
        },

        save(nextPrefs) {
            var normalized = this.normalize(nextPrefs);
            localStorage.setItem(PREFS_KEY, JSON.stringify(normalized));
            return normalized;
        },

        update(patch) {
            var current = this.get();
            var merged = {
                source: patch && patch.source != null ? patch.source : current.source,
                sort: patch && patch.sort != null ? patch.sort : current.sort,
                window: patch && patch.window != null ? patch.window : current.window,
                search: patch && patch.search != null ? patch.search : current.search
            };
            return this.save(merged);
        }
    };

    var FeedData = {
        getJournalEvents: function () {
            var entries = safeArray(safeStoreCall('getJournalEntries', []));
            return entries.map(function (entry, index) {
                var mood = toText(entry && entry.mood, '');
                var energy = toText(entry && entry.energy, '');
                var rawLabels = [];
                if (Array.isArray(entry && entry.labels)) {
                    rawLabels = entry.labels;
                } else if (typeof (entry && entry.labels) === 'string') {
                    rawLabels = entry.labels.split(',');
                } else if (Array.isArray(entry && entry.tags)) {
                    rawLabels = entry.tags;
                } else if (typeof (entry && entry.tags) === 'string') {
                    rawLabels = entry.tags.split(',');
                }
                var labels = rawLabels.map(function (label) {
                    return toText(label, '');
                }).filter(Boolean);
                var tags = ['journal'];
                if (mood) tags.push('mood:' + mood.toLowerCase());
                if (energy) tags.push('energy:' + energy.toLowerCase());
                labels.forEach(function (label) {
                    tags.push('label:' + label.toLowerCase());
                });

                return buildEvent({
                    source: 'journal',
                    sourceId: entry && entry.id,
                    contextMode: 'personal',
                    timestamp: entry && entry.date,
                    title: 'Journal Entry',
                    body: toText(entry && entry.text, ''),
                    tags: tags,
                    media: collectEventMedia(entry, entry && entry.text),
                    meta: {
                        sourceId: entry && entry.id,
                        mood: mood,
                        energy: energy,
                        labels: labels
                    },
                    canDelete: true,
                    canOpenSource: true
                }, index);
            });
        },

        getActivityEvents: function () {
            var activities = safeArray(safeStoreCall('getActivities', []));
            return activities.map(function (activity, index) {
                var type = toText(activity && activity.type, 'Activity');
                var duration = toText(activity && activity.duration, '');
                var distance = toText(activity && activity.distance, '');
                var durationMinutes = parseDurationMinutes(duration);
                var bodyParts = [];
                if (distance) bodyParts.push('Distance: ' + distance);
                if (duration) bodyParts.push('Duration: ' + duration);

                return buildEvent({
                    source: 'activity',
                    sourceId: activity && activity.id,
                    contextMode: 'personal',
                    timestamp: activity && activity.date,
                    title: type,
                    body: bodyParts.join(' | '),
                    tags: ['activity', type.toLowerCase()],
                    media: collectEventMedia(activity, bodyParts.join(' | ')),
                    meta: {
                        sourceId: activity && activity.id,
                        type: type,
                        distance: distance,
                        duration: duration,
                        durationMinutes: durationMinutes
                    },
                    canDelete: true,
                    canOpenSource: true
                }, index);
            });
        },

        getWalkEvents: function () {
            var entries = [];
            if (window.Store && typeof window.Store.getWalkLogEntries === 'function') {
                entries = safeArray(window.Store.getWalkLogEntries());
            }

            return entries.map(function (entry, index) {
                var walkType = toText(entry && entry.walkType, 'Walk');
                var durationSeconds = Number(entry && entry.durationSeconds) || 0;
                var durationMinutes = Math.round(Math.max(0, durationSeconds) / 60);
                var note = toText(entry && entry.note, '');
                var location = toText(entry && entry.location, '');
                var bodyParts = [];
                if (note) bodyParts.push(note);
                if (location) bodyParts.push('Location: ' + location);
                if (durationMinutes > 0) bodyParts.push('Duration: ' + durationMinutes + ' min');

                return buildEvent({
                    source: 'walk',
                    sourceId: entry && entry.id,
                    contextMode: 'ritual',
                    timestamp: entry && (entry.endTime || entry.createdAt || entry.startTime),
                    title: walkType,
                    body: bodyParts.join(' | '),
                    tags: ['walk', walkType.toLowerCase()],
                    media: collectEventMedia(entry, bodyParts.join(' | ')),
                    meta: {
                        sourceId: entry && entry.id,
                        walkType: walkType,
                        durationSeconds: durationSeconds,
                        durationMinutes: durationMinutes,
                        note: note,
                        location: location
                    },
                    canDelete: true,
                    canOpenSource: false
                }, index);
            });
        },

        getVisionEvents: function () {
            var decisions = safeArray(safeParse(localStorage.getItem('visionDecisionLog'), []));
            return decisions.map(function (entry, index) {
                var decision = toText(entry && entry.decision, '').toLowerCase() === 'no' ? 'no' : 'yes';
                var contextMode = normalizeContextMode(entry && entry.contextMode, 'vision');
                var note = toText(entry && entry.note, '');
                var drift = Number(entry && entry.driftAtDecision);
                var alignment = Number(entry && entry.alignmentAtDecision);

                return buildEvent({
                    source: 'vision',
                    sourceId: entry && entry.id,
                    contextMode: contextMode,
                    timestamp: entry && entry.createdAt,
                    title: 'Vision Decision: ' + decision.toUpperCase(),
                    body: note || (contextMode + ' context'),
                    tags: ['vision', decision, contextMode],
                    meta: {
                        sourceId: entry && entry.id,
                        decision: decision,
                        driftAtDecision: Number.isFinite(drift) ? drift : 0,
                        alignmentAtDecision: Number.isFinite(alignment) ? alignment : 0,
                        note: note
                    },
                    canDelete: false,
                    canOpenSource: true
                }, index);
            });
        },

        getLibraryEvents: function () {
            var items = [];
            if (window.LibraryStorage && typeof window.LibraryStorage.getItems === 'function') {
                items = safeArray(window.LibraryStorage.getItems());
            } else {
                items = getLibraryItemsFallback();
            }

            return items.map(function (item, index) {
                var title = toText(item && item.title, 'Library Item');
                var creator = toText(item && item.creator, '');
                var year = toText(item && item.year, '');
                var type = toText(item && item.type, 'unknown');
                var bodyParts = [];
                if (creator) bodyParts.push(creator);
                if (year) bodyParts.push(year);
                if (type) bodyParts.push('Type: ' + type);

                return buildEvent({
                    source: 'library',
                    sourceId: item && item.id,
                    contextMode: 'library',
                    timestamp: item && item.createdAt,
                    title: title,
                    body: bodyParts.join(' | '),
                    tags: ['library', type.toLowerCase()],
                    media: collectEventMedia(item, bodyParts.join(' | ')),
                    meta: {
                        sourceId: item && item.id,
                        creator: creator,
                        year: year,
                        type: type
                    },
                    canDelete: true,
                    canOpenSource: true
                }, index);
            });
        },

        getArchiveEvents: function () {
            var archive = safeStoreCall('getDailyArchive', {});
            if (!archive || typeof archive !== 'object') return [];

            return Object.keys(archive).map(function (dateKey, index) {
                var entry = archive[dateKey] || {};
                var completion = Number(entry && entry.rhythm && entry.rhythm.completionPct);
                var journalCount = safeArray(entry && entry.journal).length;
                var completionSafe = Number.isFinite(completion) ? Math.max(0, Math.round(completion)) : 0;
                var timestamp = entry && entry.archivedAt ? entry.archivedAt : dateKey;

                return buildEvent({
                    source: 'archive',
                    sourceId: dateKey,
                    contextMode: 'shared',
                    timestamp: timestamp,
                    title: 'Daily Archive Snapshot',
                    body: dateKey + ' | Rhythm ' + completionSafe + '% | Journal ' + journalCount,
                    tags: ['archive', 'snapshot'],
                    media: collectEventMedia(entry, ''),
                    meta: {
                        sourceId: dateKey,
                        dateKey: dateKey,
                        completionPct: completionSafe,
                        journalCount: journalCount
                    },
                    canDelete: false,
                    canOpenSource: false
                }, index);
            });
        },

        getAllEvents: function () {
            var merged = []
                .concat(this.getJournalEvents())
                .concat(this.getActivityEvents())
                .concat(this.getWalkEvents())
                .concat(this.getLibraryEvents())
                .concat(this.getArchiveEvents());

            return merged
                .filter(function (eventItem) {
                    return toTimestamp(eventItem && eventItem.timestamp) != null;
                })
                .sort(function (a, b) {
                    return toTimestamp(b.timestamp) - toTimestamp(a.timestamp);
                });
        },

        deleteEvent: function (eventItem) {
            if (!eventItem || !eventItem.canDelete) return false;
            var sourceId = toText(eventItem.meta && eventItem.meta.sourceId, '');
            if (!sourceId) return false;

            try {
                if (eventItem.source === 'journal' && window.Store && typeof window.Store.deleteJournalEntry === 'function') {
                    window.Store.deleteJournalEntry(sourceId);
                    return true;
                }

                if (eventItem.source === 'activity' && window.Store && typeof window.Store.deleteActivity === 'function') {
                    window.Store.deleteActivity(sourceId);
                    return true;
                }

                if (eventItem.source === 'walk' && window.Store && typeof window.Store.deleteWalkLogEntry === 'function') {
                    return Boolean(window.Store.deleteWalkLogEntry(sourceId));
                }

                if (eventItem.source === 'library') {
                    if (window.LibraryStorage && typeof window.LibraryStorage.deleteItem === 'function') {
                        return Boolean(window.LibraryStorage.deleteItem(sourceId));
                    }
                    return deleteLibraryFallback(sourceId);
                }
            } catch (error) {
                console.error('[FeedMode] Delete action failed', error);
                return false;
            }

            return false;
        }
    };

    function buildSearchBlob(eventItem) {
        var metaValues = [];
        if (eventItem && eventItem.meta && typeof eventItem.meta === 'object') {
            Object.keys(eventItem.meta).forEach(function (key) {
                metaValues.push(toText(eventItem.meta[key], ''));
            });
        }

        return [
            toText(eventItem && eventItem.title, ''),
            toText(eventItem && eventItem.body, ''),
            safeArray(eventItem && eventItem.tags).join(' '),
            metaValues.join(' ')
        ].join(' ').toLowerCase();
    }

    var FeedEngine = {
        computeSignalBoost: function (eventItem) {
            var boost = 0;
            var meta = eventItem && eventItem.meta ? eventItem.meta : {};

            if (eventItem.source === 'journal' && (toText(meta.mood, '') || toText(meta.energy, ''))) {
                boost += 0.06;
            }

            if (eventItem.source === 'activity' && Number(meta.durationMinutes) >= 45) {
                boost += 0.05;
            }

            if (eventItem.source === 'walk' && Number(meta.durationMinutes) >= 45) {
                boost += 0.07;
            }

            if (eventItem.source === 'vision' && toText(meta.decision, '').toLowerCase() === 'no') {
                boost += 0.08;
            }

            if (eventItem.source === 'vision' && Math.abs(Number(meta.driftAtDecision) || 0) >= 40) {
                boost += 0.04;
            }

            if (eventItem.source === 'archive' && Number(meta.completionPct) < 40) {
                boost += 0.05;
            }

            return boost;
        },

        computeSmartScore: function (eventItem, nowTs) {
            var ts = toTimestamp(eventItem.timestamp);
            if (ts == null) return -Infinity;

            var ageHours = Math.max(0, (nowTs - ts) / 3600000);
            var recency = Math.max(0, 1 - (Math.min(ageHours, 168) / 168));
            var sourceBoost = SOURCE_BOOST[eventItem.source] || 0;
            var signalBoost = this.computeSignalBoost(eventItem);

            return (recency * 0.7) + sourceBoost + signalBoost;
        },

        applyFilters: function (events, prefs) {
            var list = safeArray(events).slice();
            var source = normalizeSource(prefs && prefs.source, 'all');
            var windowRange = normalizeWindow(prefs && prefs.window, 'all');
            var query = toText(prefs && prefs.search, '').toLowerCase();
            var nowTs = Date.now();

            if (source !== 'all') {
                list = list.filter(function (eventItem) {
                    return eventItem.source === source;
                });
            }

            if (windowRange !== 'all') {
                var maxHours = windowRange === '24h' ? 24 : (windowRange === '7d' ? 168 : 720);
                list = list.filter(function (eventItem) {
                    var ts = toTimestamp(eventItem.timestamp);
                    if (ts == null) return false;
                    var ageHours = Math.max(0, (nowTs - ts) / 3600000);
                    return ageHours <= maxHours;
                });
            }

            if (query) {
                list = list.filter(function (eventItem) {
                    return buildSearchBlob(eventItem).indexOf(query) >= 0;
                });
            }

            return list;
        },

        sortEvents: function (events, prefs) {
            var sortMode = normalizeSort(prefs && prefs.sort, 'smart');
            var filtered = this.applyFilters(events, prefs);

            if (sortMode === 'recent') {
                return filtered.sort(function (a, b) {
                    var diff = toTimestamp(b.timestamp) - toTimestamp(a.timestamp);
                    if (diff !== 0) return diff;
                    return String(a.id || '').localeCompare(String(b.id || ''));
                });
            }

            var nowTs = Date.now();
            return filtered.sort(function (a, b) {
                var scoreA = FeedEngine.computeSmartScore(a, nowTs);
                var scoreB = FeedEngine.computeSmartScore(b, nowTs);
                if (scoreB !== scoreA) return scoreB - scoreA;

                var tsDiff = toTimestamp(b.timestamp) - toTimestamp(a.timestamp);
                if (tsDiff !== 0) return tsDiff;
                return String(a.id || '').localeCompare(String(b.id || ''));
            });
        },

        paginate: function (events, page, pageSize) {
            var safePage = Math.max(1, Number(page) || 1);
            var size = Math.max(1, Number(pageSize) || PAGE_SIZE);
            var end = safePage * size;
            var list = safeArray(events);

            return {
                items: list.slice(0, end),
                hasMore: list.length > end
            };
        }
    };

    var FeedRenderer = {
        _initialized: false,
        _prefs: FeedPrefs.get(),
        _transient: {
            source: '',
            sort: ''
        },
        _page: 1,
        _eventMap: new Map(),
        _urlTransientConsumed: false,
        _storeUnsubscribe: null,
        _allEventsCount: 0,

        init: function () {
            if (this._initialized) return;

            var shell = document.getElementById('feed-shell');
            if (!shell) return;

            shell.innerHTML = [
                '<section class="feed-layout">',
                '  <header class="feed-header">',
                '    <div class="feed-heading">',
                '      <h1 class="feed-title">Timeline</h1>',
                '      <p class="feed-subtitle">Unified timeline across journal, motion, ritual, strategy, and archive.</p>',
                '    </div>',
                '    <div class="feed-count" id="feed-count">0 items</div>',
                '  </header>',
                '  <section class="feed-controls-shell" id="feed-controls" aria-label="Timeline controls">',
                '    <div class="feed-search-wrap">',
                '      <span class="feed-search-icon" aria-hidden="true">⌕</span>',
                '      <input id="feed-search-input" class="feed-search-input" type="search" placeholder="Search title, text, tags">',
                '      <button id="feed-search-clear" class="feed-search-clear" type="button" aria-label="Clear search">&times;</button>',
                '    </div>',
                '    <div class="feed-filter-grid">',
                '      <select id="feed-source-select" class="feed-select"></select>',
                '      <select id="feed-window-select" class="feed-select"></select>',
                '      <select id="feed-sort-select" class="feed-select"></select>',
                '    </div>',
                '    <div class="feed-action-row">',
                '      <button class="feed-action-link" type="button" data-feed-quick="new-journal">Write Journal</button>',
                '      <button class="feed-action-link" type="button" data-feed-quick="log-activity">Log Activity</button>',
                '      <button class="feed-action-link" type="button" data-feed-quick="open-library">Open Library</button>',
                '    </div>',
                '  </section>',
                '  <section class="feed-stream-shell">',
                '    <div class="feed-list" id="feed-list"></div>',
                '    <div class="feed-empty" id="feed-empty" hidden>No timeline entries match this view.</div>',
                '    <div class="feed-load-more-wrap">',
                '      <button class="feed-btn" id="feed-load-more" type="button" hidden>Load More</button>',
                '    </div>',
                '  </section>',
                '</section>'
            ].join('');

            this._els = {
                shell: shell,
                count: document.getElementById('feed-count'),
                sourceSelect: document.getElementById('feed-source-select'),
                windowSelect: document.getElementById('feed-window-select'),
                sortSelect: document.getElementById('feed-sort-select'),
                searchInput: document.getElementById('feed-search-input'),
                searchClear: document.getElementById('feed-search-clear'),
                list: document.getElementById('feed-list'),
                empty: document.getElementById('feed-empty'),
                loadMore: document.getElementById('feed-load-more')
            };

            this._bindEvents();
            this._prefs = FeedPrefs.get();

            if (window.Store && typeof window.Store.subscribe === 'function') {
                var self = this;
                this._storeUnsubscribe = window.Store.subscribe(function () {
                    self.render();
                });
            }

            this._initialized = true;
            this._consumeUrlTransient();
            this.render();
        },

        _bindEvents: function () {
            var self = this;
            if (!this._els || !this._els.shell) return;

            this._els.shell.addEventListener('click', function (event) {
                var quick = event.target.closest('[data-feed-quick]');
                if (quick) {
                    self._handleQuickAction(toText(quick.getAttribute('data-feed-quick'), ''));
                    return;
                }

                var listAction = event.target.closest('[data-feed-action]');
                if (listAction) {
                    var actionName = toText(listAction.getAttribute('data-feed-action'), '');
                    var card = listAction.closest('[data-feed-id]');
                    var eventId = card ? toText(card.getAttribute('data-feed-id'), '') : '';
                    var eventItem = self._eventMap.get(eventId);
                    self._handleCardAction(actionName, eventItem);
                    return;
                }

                if (event.target.id === 'feed-load-more') {
                    self._page += 1;
                    self.render();
                }
            });

            if (this._els.searchInput) {
                this._els.searchInput.addEventListener('input', function (event) {
                    self._page = 1;
                    self._prefs = FeedPrefs.update({ search: toText(event.target.value, '') });
                    self.render();
                });
            }

            if (this._els.sourceSelect) {
                this._els.sourceSelect.addEventListener('change', function (event) {
                    self._page = 1;
                    self._transient.source = '';
                    self._prefs = FeedPrefs.update({ source: normalizeSource(toText(event.target.value, 'all'), 'all') });
                    self.render();
                });
            }

            if (this._els.windowSelect) {
                this._els.windowSelect.addEventListener('change', function (event) {
                    self._page = 1;
                    self._prefs = FeedPrefs.update({ window: normalizeWindow(toText(event.target.value, 'all'), 'all') });
                    self.render();
                });
            }

            if (this._els.sortSelect) {
                this._els.sortSelect.addEventListener('change', function (event) {
                    self._page = 1;
                    self._transient.sort = '';
                    self._prefs = FeedPrefs.update({ sort: normalizeSort(toText(event.target.value, 'smart'), 'smart') });
                    self.render();
                });
            }

            if (this._els.searchClear) {
                this._els.searchClear.addEventListener('click', function () {
                    if (self._els.searchInput) self._els.searchInput.value = '';
                    self._page = 1;
                    self._prefs = FeedPrefs.update({ search: '' });
                    self.render();
                });
            }
        },

        _consumeUrlTransient: function () {
            if (this._urlTransientConsumed) return;

            var params = new URLSearchParams(window.location.search || '');
            var modeParam = toText(params.get('mode'), '').toLowerCase();
            if (modeParam !== 'feed') {
                this._urlTransientConsumed = true;
                return;
            }

            var source = parseOptionalEnum(params.get('source'), VALID_SOURCES);
            var sort = parseOptionalEnum(params.get('sort'), VALID_SORTS);
            if (source) this._transient.source = source;
            if (sort) this._transient.sort = sort;

            if (params.has('source') || params.has('sort')) {
                params.delete('source');
                params.delete('sort');
                var query = params.toString();
                var nextUrl = window.location.pathname + (query ? '?' + query : '') + (window.location.hash || '');
                window.history.replaceState({}, '', nextUrl);
            }

            this._urlTransientConsumed = true;
        },

        _getEffectivePrefs: function () {
            var prefs = this._prefs || FeedPrefs.get();
            var effective = {
                source: prefs.source,
                sort: prefs.sort,
                window: prefs.window,
                search: prefs.search
            };

            if (this._transient.source) effective.source = this._transient.source;
            if (this._transient.sort) effective.sort = this._transient.sort;
            return effective;
        },

        applyOptions: function (options) {
            var opts = options && typeof options === 'object' ? options : {};
            if (Object.prototype.hasOwnProperty.call(opts, 'source')) {
                this._transient.source = parseOptionalEnum(opts.source, VALID_SOURCES);
            }
            if (Object.prototype.hasOwnProperty.call(opts, 'sort')) {
                this._transient.sort = parseOptionalEnum(opts.sort, VALID_SORTS);
            }
            if (opts.clearTransient === true) {
                this._transient.source = '';
                this._transient.sort = '';
            }
            this._page = 1;
            this.render();
        },

        refresh: function (options) {
            var opts = options && typeof options === 'object' ? options : {};
            if (opts.resetPage) this._page = 1;
            this.render();
        },

        render: function () {
            if (!this._initialized) return;

            var allEvents = FeedData.getAllEvents();
            var effectivePrefs = this._getEffectivePrefs();
            var sortedEvents = FeedEngine.sortEvents(allEvents, effectivePrefs);

            this._allEventsCount = allEvents.length;
            this._renderControls(effectivePrefs, this._allEventsCount, sortedEvents.length);
            this._renderList(sortedEvents);
        },

        _renderControls: function (effectivePrefs, allCount, filteredCount) {
            if (!this._els) return;

            var sourceOptions = [
                { value: 'all', label: 'All Sources' },
                { value: 'journal', label: 'Journal' },
                { value: 'activity', label: 'Activity' },
                { value: 'walk', label: 'Walk' },
                { value: 'library', label: 'Library' },
                { value: 'archive', label: 'Archive' }
            ];

            var windowOptions = [
                { value: 'all', label: 'All Time' },
                { value: '24h', label: '24h' },
                { value: '7d', label: '7d' },
                { value: '30d', label: '30d' }
            ];

            var sortOptions = [
                { value: 'smart', label: 'Smart Order' },
                { value: 'recent', label: 'Recently Added' }
            ];

            var renderOptionList = function (options, selectedValue) {
                return options.map(function (option) {
                    var selected = selectedValue === option.value ? ' selected' : '';
                    return '<option value="' + escapeHtml(option.value) + '"' + selected + '>' + escapeHtml(option.label) + '</option>';
                }).join('');
            };

            if (this._els.sourceSelect) {
                this._els.sourceSelect.innerHTML = renderOptionList(sourceOptions, effectivePrefs.source);
            }
            if (this._els.windowSelect) {
                this._els.windowSelect.innerHTML = renderOptionList(windowOptions, effectivePrefs.window);
            }
            if (this._els.sortSelect) {
                this._els.sortSelect.innerHTML = renderOptionList(sortOptions, effectivePrefs.sort);
            }
            if (this._els.searchInput && this._els.searchInput.value !== this._prefs.search) {
                this._els.searchInput.value = this._prefs.search;
            }
            if (this._els.searchClear) {
                this._els.searchClear.hidden = !toText(this._prefs.search, '');
            }

            if (this._els.count) {
                if (filteredCount !== allCount) {
                    this._els.count.textContent = filteredCount + ' of ' + allCount + ' items';
                } else if (allCount === 1) {
                    this._els.count.textContent = '1 item';
                } else {
                    this._els.count.textContent = allCount + ' items';
                }
            }
        },

        _buildMetaChips: function (eventItem) {
            var meta = eventItem && eventItem.meta ? eventItem.meta : {};
            var chips = [];

            if (eventItem.source === 'journal') {
                if (meta.mood) chips.push('Mood ' + meta.mood);
                if (meta.energy) chips.push('Energy ' + meta.energy);
                safeArray(meta.labels).slice(0, 4).forEach(function (label) {
                    chips.push(label);
                });
            }

            if (eventItem.source === 'activity') {
                if (meta.type) chips.push(meta.type);
                if (meta.duration) chips.push(meta.duration);
                if (meta.distance) chips.push(meta.distance);
            }

            if (eventItem.source === 'walk') {
                if (meta.walkType) chips.push(meta.walkType);
                if (Number(meta.durationMinutes) > 0) chips.push(meta.durationMinutes + ' min');
                if (meta.location) chips.push(meta.location);
            }

            if (eventItem.source === 'vision') {
                chips.push(String(meta.decision || '').toUpperCase() || 'YES');
                chips.push('Alignment ' + Math.round(Number(meta.alignmentAtDecision) || 0));
                chips.push('Drift ' + Math.round(Number(meta.driftAtDecision) || 0));
            }

            if (eventItem.source === 'library') {
                if (meta.type) chips.push(meta.type);
                if (meta.creator) chips.push(meta.creator);
                if (meta.year) chips.push(meta.year);
            }

            if (eventItem.source === 'archive') {
                chips.push('Rhythm ' + Math.round(Number(meta.completionPct) || 0) + '%');
                chips.push('Journal ' + (Number(meta.journalCount) || 0));
            }

            return chips.filter(Boolean);
        },

        _renderEventCard: function (eventItem) {
            var sourceLabel = SOURCE_LABELS[eventItem.source] || eventItem.source;
            var chips = this._buildMetaChips(eventItem);
            var chipsHtml = chips.length
                ? '<div class="feed-meta-row">' + chips.map(function (chip) {
                    return '<span class="feed-meta-chip">' + escapeHtml(chip) + '</span>';
                }).join('') + '</div>'
                : '';

            var actions = [];
            if (eventItem.canOpenSource) {
                actions.push([
                    '<button class="feed-action-icon-btn" type="button" data-feed-action="edit" aria-label="Edit item" title="Edit item">',
                    '  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
                    '    <path d="M4 20h4l10.7-10.7-4-4L4 16v4z"></path>',
                    '    <path d="M13.9 5.3l4 4"></path>',
                    '  </svg>',
                    '</button>'
                ].join(''));
            }
            if (eventItem.canDelete) {
                actions.push([
                    '<button class="feed-action-icon-btn feed-action-icon-btn--danger" type="button" data-feed-action="delete" aria-label="Delete item" title="Delete item">',
                    '  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
                    '    <path d="M3 6h18"></path>',
                    '    <path d="M8 6V4h8v2"></path>',
                    '    <path d="M7 6l1 14h8l1-14"></path>',
                    '  </svg>',
                    '</button>'
                ].join(''));
            }

            var actionsHtml = actions.length
                ? '<div class="feed-card-actions-top">' + actions.join('') + '</div>'
                : '';

            var media = safeArray(eventItem && eventItem.media);
            var mediaHtml = media.length
                ? '<div class="feed-media-row">' + media.map(function (item, index) {
                    var url = toText(item && item.url, '');
                    if (!url) return '';
                    var alt = toText(item && item.alt, '') || ('Media ' + String(index + 1));
                    return '<img class="feed-media-image" loading="lazy" decoding="async" src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '">';
                }).join('') + '</div>'
                : '';
            var cardClass = media.length ? 'feed-card feed-card--media' : 'feed-card feed-card--text';

            return [
                '<article class="' + cardClass + '" data-feed-id="' + escapeHtml(eventItem.id) + '">',
                '  <div class="feed-card-top">',
                '    <div class="feed-card-top-meta">',
                '      <span class="feed-source">' + escapeHtml(sourceLabel) + '</span>',
                '      <span class="feed-time">' + escapeHtml(formatDateTime(eventItem.timestamp)) + '</span>',
                '    </div>',
                actionsHtml,
                '  </div>',
                '  <h3 class="feed-card-title">' + escapeHtml(eventItem.title) + '</h3>',
                '  <p class="feed-card-body">' + escapeHtml(eventItem.body || 'No details.') + '</p>',
                mediaHtml,
                chipsHtml,
                '</article>'
            ].join('');
        },

        _renderList: function (sortedEvents) {
            if (!this._els || !this._els.list || !this._els.empty || !this._els.loadMore) return;

            var paged = FeedEngine.paginate(sortedEvents, this._page, PAGE_SIZE);
            var visibleItems = paged.items;
            this._eventMap = new Map();

            if (!visibleItems.length) {
                this._els.list.innerHTML = '';
                this._els.empty.hidden = false;
                this._els.loadMore.hidden = true;
                return;
            }

            this._els.empty.hidden = true;

            var html = [];
            var currentDayKey = '';
            for (var index = 0; index < visibleItems.length; index += 1) {
                var eventItem = visibleItems[index];
                this._eventMap.set(eventItem.id, eventItem);

                var nextDayKey = localDateKey(eventItem.timestamp);
                if (nextDayKey !== currentDayKey) {
                    currentDayKey = nextDayKey;
                    html.push('<div class="feed-day-separator">' + escapeHtml(formatDayHeading(eventItem.timestamp)) + '</div>');
                }

                html.push(this._renderEventCard(eventItem));
            }

            this._els.list.innerHTML = html.join('');
            this._els.loadMore.hidden = !paged.hasMore;
        },

        _handleQuickAction: function (action) {
            if (action === 'new-journal') {
                if (typeof window.openJournalQuickEntryModal === 'function') {
                    window.openJournalQuickEntryModal();
                    return;
                }
                if (window.ModeManager && typeof window.ModeManager.switchMode === 'function') {
                    window.ModeManager.switchMode('personal');
                }
                return;
            }

            if (action === 'log-activity') {
                if (typeof window.openEditModal === 'function') {
                    window.openEditModal('sport');
                }
                return;
            }

            if (action === 'open-ritual' && window.ModeManager && typeof window.ModeManager.switchMode === 'function') {
                window.ModeManager.switchMode('ritual');
                return;
            }

            if (action === 'open-library' && window.ModeManager && typeof window.ModeManager.switchMode === 'function') {
                window.ModeManager.switchMode('library');
            }
        },

        _handleCardAction: function (action, eventItem) {
            if (!eventItem) return;

            if (action === 'edit') {
                this._openSourceEditor(eventItem);
                return;
            }

            if (action === 'delete') {
                if (!eventItem.canDelete) return;
                if (!window.confirm('Delete this feed item from its source?')) return;

                var didDelete = FeedData.deleteEvent(eventItem);
                if (!didDelete) return;

                if (eventItem.source === 'library' && window.LibraryRenderer && typeof window.LibraryRenderer.refresh === 'function') {
                    window.LibraryRenderer.refresh();
                }

                this._page = 1;
                this.render();
            }
        },

        _openSourceEditor: function (eventItem) {
            if (!eventItem) return;

            var sourceId = toText(eventItem.meta && eventItem.meta.sourceId, '');

            if (eventItem.source === 'journal') {
                if (sourceId && typeof window.openJournalEntryEditModal === 'function') {
                    var self = this;
                    window.openJournalEntryEditModal(sourceId, {
                        onSave: function () {
                            self.render();
                        },
                        onDelete: function () {
                            self._page = 1;
                            self.render();
                        }
                    });
                    return;
                }
                if (typeof window.openEditModal === 'function') {
                    window.openEditModal('journal');
                    return;
                }
            }

            if (eventItem.source === 'activity') {
                if (typeof window.openEditModal === 'function') {
                    window.openEditModal('sport');
                    return;
                }
            }

            if (eventItem.source === 'library') {
                if (window.LibraryRenderer && typeof window.LibraryRenderer.init === 'function') {
                    window.LibraryRenderer.init();
                }
                if (sourceId && window.LibraryRenderer && typeof window.LibraryRenderer.openItemModal === 'function') {
                    window.LibraryRenderer.openItemModal(sourceId);
                    return;
                }
                if (sourceId && typeof window.openLibraryItemModal === 'function') {
                    window.openLibraryItemModal(sourceId);
                }
                return;
            }
        }
    };

    window.FeedPrefs = FeedPrefs;
    window.FeedData = FeedData;
    window.FeedRenderer = FeedRenderer;

    window.openFeedMode = function (options) {
        if (window.FeedRenderer && typeof window.FeedRenderer.init === 'function') {
            window.FeedRenderer.init();
        }

        if (window.ModeManager && typeof window.ModeManager.switchMode === 'function') {
            window.ModeManager.switchMode('feed');
        }

        if (window.FeedRenderer && typeof window.FeedRenderer.applyOptions === 'function') {
            window.FeedRenderer.applyOptions(options || {});
        } else if (window.FeedRenderer && typeof window.FeedRenderer.refresh === 'function') {
            window.FeedRenderer.refresh();
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        if (window.FeedRenderer && typeof window.FeedRenderer.init === 'function') {
            window.FeedRenderer.init();
        }
    });
})();
