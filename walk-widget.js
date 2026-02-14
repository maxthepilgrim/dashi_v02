(function (global) {
    'use strict';

    var WALK_LOG_KEY = 'walkLogEntries';
    var LEGACY_WALK_LOG_KEY = 'lifeOS.ritual.walkLog';
    var DEFAULT_WALK_TYPE = 'Forest Deep';
    var WALK_TYPES = [
        'Forest Deep',
        'City Drift',
        'Silent Walk',
        'Listening Walk',
        'Sauna Recovery',
        'Night Walk',
        'Custom'
    ];
    var MOODS = ['Calm', 'Stressed', 'Neutral', 'Inspired'];

    function asText(value) {
        return String(value == null ? '' : value).trim();
    }

    function clamp(value, min, max) {
        var num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function safeDate(value, fallbackIso) {
        var candidate = asText(value);
        var timestamp = new Date(candidate).getTime();
        if (!Number.isFinite(timestamp)) {
            return fallbackIso || nowIso();
        }
        return new Date(timestamp).toISOString();
    }

    function makeWalkId() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return global.crypto.randomUUID();
        }
        return 'walk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function escapeHtml(input) {
        return String(input == null ? '' : input)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function durationLabel(totalSeconds) {
        var seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        var hours = Math.floor(seconds / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        var secs = seconds % 60;

        if (hours > 0) {
            return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        }
        return String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    function dateLabel(iso) {
        var ts = new Date(iso).getTime();
        if (!Number.isFinite(ts)) return 'Unknown date';
        var d = new Date(ts);
        return d.toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }) + ' · ' + d.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function truncateNote(note, maxLength) {
        var text = asText(note);
        var limit = Number(maxLength) || 120;
        if (!text) return '';
        if (text.length <= limit) return text;
        return text.slice(0, limit).trimEnd() + '…';
    }

    function normalizeLegacyTypeKey(typeLabel) {
        var normalized = asText(typeLabel)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!normalized) return 'unknown';
        if (normalized === 'forest' || normalized === 'forest-deep') return 'forest';
        if (normalized === 'city' || normalized === 'city-drift') return 'city';
        if (normalized === 'sea' || normalized === 'sea-walk' || normalized === 'sea-water-walk') return 'sea';
        return normalized;
    }

    function sanitizeWalkEntry(rawEntry) {
        var source = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
        var createdAt = safeDate(source.createdAt || source.endTime || source.startTime, nowIso());
        var startTime = safeDate(source.startTime || createdAt, createdAt);
        var endTime = safeDate(source.endTime || createdAt, createdAt);
        var walkType = asText(source.walkType) || DEFAULT_WALK_TYPE;
        var note = asText(source.note);
        var weather = asText(source.weather);
        var moodBefore = asText(source.moodBefore);
        var moodAfter = asText(source.moodAfter);
        var location = asText(source.location);

        var entry = {
            id: asText(source.id) || makeWalkId(),
            startTime: startTime,
            endTime: endTime,
            durationSeconds: Math.max(0, Math.floor(Number(source.durationSeconds) || 0)),
            walkType: walkType,
            note: note,
            createdAt: createdAt
        };

        if (weather) entry.weather = weather;
        if (MOODS.indexOf(moodBefore) !== -1) entry.moodBefore = moodBefore;
        if (MOODS.indexOf(moodAfter) !== -1) entry.moodAfter = moodAfter;
        if (location) entry.location = location;

        return entry;
    }

    function sortEntriesNewestFirst(entries) {
        return entries.slice().sort(function (a, b) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    function buildLegacySummary(entries) {
        var safeEntries = Array.isArray(entries) ? entries : [];
        var typeCounts = { forest: 0, city: 0, sea: 0 };

        safeEntries.forEach(function (entry) {
            var key = normalizeLegacyTypeKey(entry.walkType);
            typeCounts[key] = (typeCounts[key] || 0) + 1;
        });

        var latest = safeEntries[0] || null;

        return {
            count: safeEntries.length,
            lastDate: latest ? latest.endTime : null,
            lastType: latest ? latest.walkType : null,
            typeCounts: typeCounts
        };
    }

    function getWeekRange(referenceDate) {
        var ref = referenceDate ? new Date(referenceDate) : new Date();
        if (!Number.isFinite(ref.getTime())) ref = new Date();

        var mondayOffset = (ref.getDay() + 6) % 7;
        var start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - mondayOffset);
        start.setHours(0, 0, 0, 0);

        var end = new Date(start);
        end.setDate(start.getDate() + 7);

        return { start: start, end: end };
    }

    function computeWeeklyInsights(entries, referenceDate) {
        /* Weekly calculation logic: local Monday 00:00 through next Monday 00:00. */
        var range = getWeekRange(referenceDate);
        var weekEntries = (Array.isArray(entries) ? entries : []).filter(function (entry) {
            var candidate = new Date(entry.endTime || entry.startTime || entry.createdAt).getTime();
            if (!Number.isFinite(candidate)) return false;
            return candidate >= range.start.getTime() && candidate < range.end.getTime();
        });

        var totalSeconds = weekEntries.reduce(function (sum, entry) {
            return sum + Math.max(0, Number(entry.durationSeconds) || 0);
        }, 0);

        var countsByType = {};
        weekEntries.forEach(function (entry) {
            var label = asText(entry.walkType) || DEFAULT_WALK_TYPE;
            countsByType[label] = (countsByType[label] || 0) + 1;
        });

        var mostCommon = 'None yet';
        var rankedTypes = Object.keys(countsByType).sort(function (a, b) {
            if (countsByType[b] !== countsByType[a]) return countsByType[b] - countsByType[a];
            return a.localeCompare(b);
        });
        if (rankedTypes.length) mostCommon = rankedTypes[0];

        var totalWalks = weekEntries.length;
        var totalMinutes = Math.round(totalSeconds / 60);
        var averageMinutes = totalWalks ? Math.round((totalSeconds / totalWalks) / 60) : 0;

        return {
            weekStart: range.start.toISOString(),
            weekEnd: range.end.toISOString(),
            totalWalksThisWeek: totalWalks,
            totalMinutesThisWeek: totalMinutes,
            averageMinutes: averageMinutes,
            mostCommonWalkType: mostCommon
        };
    }

    var WalkTimer = (function () {
        var intervalId = null;
        var startedAtMs = 0;
        var accumulatedMs = 0;
        var status = 'idle';
        var tickHandler = null;

        function clearTick() {
            if (!intervalId) return;
            clearInterval(intervalId);
            intervalId = null;
        }

        function getElapsedMs() {
            if (status === 'running') {
                return accumulatedMs + Math.max(0, Date.now() - startedAtMs);
            }
            return accumulatedMs;
        }

        function emitTick() {
            if (typeof tickHandler === 'function') {
                tickHandler(getElapsedMs());
            }
        }

        function ensureTick() {
            /* Timer logic: guard against duplicate intervals by reusing one active ticker. */
            if (intervalId) return;
            intervalId = setInterval(emitTick, 1000);
        }

        return {
            start: function (options) {
                clearTick();
                accumulatedMs = 0;
                startedAtMs = Date.now();
                status = 'running';
                tickHandler = options && typeof options.onTick === 'function' ? options.onTick : null;
                ensureTick();
                emitTick();
                return getElapsedMs();
            },
            pause: function () {
                if (status !== 'running') return getElapsedMs();
                accumulatedMs = getElapsedMs();
                status = 'paused';
                clearTick();
                emitTick();
                return accumulatedMs;
            },
            resume: function () {
                if (status !== 'paused') return getElapsedMs();
                startedAtMs = Date.now();
                status = 'running';
                ensureTick();
                emitTick();
                return getElapsedMs();
            },
            stop: function () {
                var elapsed = getElapsedMs();
                accumulatedMs = elapsed;
                status = 'stopped';
                clearTick();
                emitTick();
                return elapsed;
            },
            reset: function () {
                clearTick();
                startedAtMs = 0;
                accumulatedMs = 0;
                status = 'idle';
                tickHandler = null;
                return 0;
            },
            getElapsedMs: getElapsedMs,
            getStatus: function () { return status; },
            formatDuration: durationLabel
        };
    })();

    var WalkStorage = (function () {
        function readEntriesFallback() {
            /* Storage handling logic: defensive parse with graceful fallback on corrupted JSON. */
            var raw = localStorage.getItem(WALK_LOG_KEY);
            if (!raw) return [];
            var parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (error) {
                return [];
            }
            if (!Array.isArray(parsed)) return [];
            return sortEntriesNewestFirst(parsed.map(sanitizeWalkEntry));
        }

        function writeEntriesFallback(entries) {
            var sanitized = sortEntriesNewestFirst((Array.isArray(entries) ? entries : []).map(sanitizeWalkEntry));
            localStorage.setItem(WALK_LOG_KEY, JSON.stringify(sanitized));
            localStorage.setItem(LEGACY_WALK_LOG_KEY, JSON.stringify(buildLegacySummary(sanitized)));
            return sanitized;
        }

        function usingStore(methodName) {
            return global.Store && typeof global.Store[methodName] === 'function';
        }

        return {
            getEntries: function () {
                if (usingStore('getWalkLogEntries')) return global.Store.getWalkLogEntries();
                return readEntriesFallback();
            },
            saveEntries: function (entries) {
                if (usingStore('saveWalkLogEntries')) return global.Store.saveWalkLogEntries(entries);
                return writeEntriesFallback(entries);
            },
            addEntry: function (entry) {
                if (usingStore('addWalkLogEntry')) return global.Store.addWalkLogEntry(entry);
                var current = readEntriesFallback();
                var sanitized = sanitizeWalkEntry(entry);
                var filtered = current.filter(function (item) { return item.id !== sanitized.id; });
                filtered.unshift(sanitized);
                writeEntriesFallback(filtered);
                return sanitized;
            },
            deleteEntry: function (entryId) {
                if (usingStore('deleteWalkLogEntry')) return global.Store.deleteWalkLogEntry(entryId);
                var id = asText(entryId);
                if (!id) return false;
                var current = readEntriesFallback();
                var next = current.filter(function (entry) { return entry.id !== id; });
                if (next.length === current.length) return false;
                writeEntriesFallback(next);
                return true;
            },
            clearEntries: function () {
                if (usingStore('clearWalkLogEntries')) return global.Store.clearWalkLogEntries();
                writeEntriesFallback([]);
                return [];
            },
            getWeeklyInsights: function (referenceDate) {
                if (usingStore('getWalkWeeklyInsights')) return global.Store.getWalkWeeklyInsights(referenceDate);
                return computeWeeklyInsights(readEntriesFallback(), referenceDate);
            },
            sanitizeWalkEntry: sanitizeWalkEntry,
            buildLegacySummary: buildLegacySummary
        };
    })();

    var WalkUI = (function () {
        var initialized = false;
        var elements = {};
        var expandedIds = new Set();
        var saveMessageTimer = null;

        var ui = {
            phase: 'idle',
            logOpen: false,
            selectedWalkType: DEFAULT_WALK_TYPE,
            customWalkType: '',
            activeQuickNote: '',
            sessionStartTimeIso: null,
            sessionEndTimeIso: null,
            completedDurationSeconds: 0
        };

        function cacheElements() {
            elements.root = document.getElementById('ritual-walk');
            if (!elements.root) return;

            elements.activeDot = document.getElementById('walk-active-indicator');
            elements.subtitle = document.getElementById('walk-subtext');

            elements.stateIdle = document.getElementById('walk-state-idle');
            elements.stateActive = document.getElementById('walk-state-active');
            elements.stateCompleted = document.getElementById('walk-state-completed');

            elements.startBtn = document.getElementById('walk-start-btn');
            elements.viewLogBtn = document.getElementById('walk-view-log-btn');
            elements.hideLogBtn = document.getElementById('walk-hide-log-btn');

            elements.timer = document.getElementById('walk-active-timer');
            elements.pauseBtn = document.getElementById('walk-pause-btn');
            elements.addNoteBtn = document.getElementById('walk-add-note-btn');
            elements.endBtn = document.getElementById('walk-end-btn');
            elements.typeButtons = document.querySelectorAll('[data-walk-type]');
            elements.customWrap = document.getElementById('walk-custom-wrap');
            elements.customInput = document.getElementById('walk-custom-input');
            elements.quickNoteWrap = document.getElementById('walk-quick-note-wrap');
            elements.quickNoteInput = document.getElementById('walk-quick-note-input');

            elements.summaryDuration = document.getElementById('walk-summary-duration');
            elements.summaryType = document.getElementById('walk-summary-type');
            elements.summaryDate = document.getElementById('walk-summary-date');

            elements.noteInput = document.getElementById('walk-note-input');
            elements.weatherInput = document.getElementById('walk-weather-input');
            elements.moodBeforeInput = document.getElementById('walk-mood-before-input');
            elements.moodAfterInput = document.getElementById('walk-mood-after-input');
            elements.locationInput = document.getElementById('walk-location-input');
            elements.saveBtn = document.getElementById('walk-save-btn');
            elements.discardBtn = document.getElementById('walk-discard-btn');
            elements.saveFeedback = document.getElementById('walk-save-feedback');

            elements.logPanel = document.getElementById('walk-log-panel');
            elements.logList = document.getElementById('walk-log-list');
            elements.logEmpty = document.getElementById('walk-log-empty');
            elements.weeklyLinePrimary = document.getElementById('walk-weekly-primary');
            elements.weeklyLineAverage = document.getElementById('walk-weekly-average');
            elements.weeklyLineType = document.getElementById('walk-weekly-type');
        }

        function setHidden(el, hidden) {
            if (!el) return;
            if (hidden) {
                el.setAttribute('hidden', 'hidden');
            } else {
                el.removeAttribute('hidden');
            }
        }

        function currentWalkTypeLabel() {
            if (ui.selectedWalkType !== 'Custom') return ui.selectedWalkType;
            return asText(ui.customWalkType) || 'Custom';
        }

        function transitionTo(phase) {
            ui.phase = phase;
            renderStates();
        }

        function renderStates() {
            if (!elements.root) return;

            setHidden(elements.stateIdle, ui.phase !== 'idle');
            setHidden(elements.stateActive, ui.phase !== 'active');
            setHidden(elements.stateCompleted, ui.phase !== 'completed');

            var active = ui.phase === 'active';
            setHidden(elements.activeDot, !active);

            if (elements.subtitle) {
                if (ui.phase === 'active') elements.subtitle.textContent = 'Stay with your breath.';
                else if (ui.phase === 'completed') elements.subtitle.textContent = 'Name what shifted.';
                else elements.subtitle.textContent = 'Step outside.';
            }

            if (elements.pauseBtn) {
                elements.pauseBtn.textContent = WalkTimer.getStatus() === 'paused' ? 'Resume' : 'Pause';
            }

            if (elements.timer && ui.phase !== 'active') {
                elements.timer.textContent = WalkTimer.formatDuration(0);
            }

            if (elements.summaryDuration) {
                elements.summaryDuration.textContent = WalkTimer.formatDuration(ui.completedDurationSeconds);
            }
            if (elements.summaryType) {
                elements.summaryType.textContent = currentWalkTypeLabel();
            }
            if (elements.summaryDate) {
                elements.summaryDate.textContent = dateLabel(ui.sessionEndTimeIso || nowIso());
            }

            if (elements.customWrap) {
                setHidden(elements.customWrap, ui.selectedWalkType !== 'Custom');
            }

            if (elements.quickNoteWrap && ui.phase !== 'active') {
                setHidden(elements.quickNoteWrap, true);
            }

            Array.prototype.forEach.call(elements.typeButtons || [], function (button) {
                var type = asText(button.getAttribute('data-walk-type'));
                button.classList.toggle('is-active', type === ui.selectedWalkType);
                button.setAttribute('aria-pressed', type === ui.selectedWalkType ? 'true' : 'false');
            });

            if (elements.saveFeedback && ui.phase !== 'idle') {
                setHidden(elements.saveFeedback, true);
            }
        }

        function renderInsights() {
            var insights = WalkStorage.getWeeklyInsights(new Date());
            if (elements.weeklyLinePrimary) {
                elements.weeklyLinePrimary.textContent = 'This week: ' + insights.totalWalksThisWeek + ' walks · ' + insights.totalMinutesThisWeek + ' min';
            }
            if (elements.weeklyLineAverage) {
                elements.weeklyLineAverage.textContent = 'Average: ' + insights.averageMinutes + ' min';
            }
            if (elements.weeklyLineType) {
                elements.weeklyLineType.textContent = 'Most frequent: ' + insights.mostCommonWalkType;
            }
        }

        function renderLog() {
            var entries = WalkStorage.getEntries();
            renderInsights();

            if (!elements.logPanel || !elements.logList || !elements.logEmpty) return;
            if (elements.viewLogBtn) {
                elements.viewLogBtn.textContent = ui.logOpen ? 'Hide Log' : 'View Log';
            }

            setHidden(elements.logPanel, !ui.logOpen);
            if (!ui.logOpen) return;

            if (!entries.length) {
                elements.logList.innerHTML = '';
                setHidden(elements.logEmpty, false);
                return;
            }

            setHidden(elements.logEmpty, true);

            elements.logList.innerHTML = entries.map(function (entry) {
                var expanded = expandedIds.has(entry.id);
                var notePreview = truncateNote(entry.note, 120);
                var hasMeta = !!(entry.weather || entry.moodBefore || entry.moodAfter || entry.location);

                var metaItems = [];
                if (entry.weather) metaItems.push('<span class="walk-widget__entry-meta-pill">Weather: ' + escapeHtml(entry.weather) + '</span>');
                if (entry.moodBefore) metaItems.push('<span class="walk-widget__entry-meta-pill">Before: ' + escapeHtml(entry.moodBefore) + '</span>');
                if (entry.moodAfter) metaItems.push('<span class="walk-widget__entry-meta-pill">After: ' + escapeHtml(entry.moodAfter) + '</span>');
                if (entry.location) metaItems.push('<span class="walk-widget__entry-meta-pill">Location: ' + escapeHtml(entry.location) + '</span>');

                return '' +
                    '<article class="walk-widget__entry" data-walk-entry-id="' + escapeHtml(entry.id) + '">' +
                        '<div class="walk-widget__entry-top">' +
                            '<div class="walk-widget__entry-date">' + escapeHtml(dateLabel(entry.createdAt)) + '</div>' +
                            '<div class="walk-widget__entry-duration">' + escapeHtml(WalkTimer.formatDuration(entry.durationSeconds)) + '</div>' +
                        '</div>' +
                        '<div class="walk-widget__entry-type">' + escapeHtml(entry.walkType) + '</div>' +
                        (notePreview ? '<div class="walk-widget__entry-note">' + escapeHtml(notePreview) + '</div>' : '') +
                        (expanded && asText(entry.note)
                            ? '<div class="walk-widget__entry-note-full">' + escapeHtml(entry.note) + '</div>'
                            : '') +
                        (expanded && hasMeta
                            ? '<div class="walk-widget__entry-meta">' + metaItems.join('') + '</div>'
                            : '') +
                        '<div class="walk-widget__entry-actions">' +
                            '<button type="button" class="walk-widget__entry-action" data-entry-action="toggle" data-entry-id="' + escapeHtml(entry.id) + '">' + (expanded ? 'Collapse' : 'Expand') + '</button>' +
                            '<button type="button" class="walk-widget__entry-action walk-widget__entry-action--danger" data-entry-action="delete" data-entry-id="' + escapeHtml(entry.id) + '">Delete</button>' +
                        '</div>' +
                    '</article>';
            }).join('');
        }

        function startWalk() {
            ui.sessionStartTimeIso = nowIso();
            ui.sessionEndTimeIso = null;
            ui.completedDurationSeconds = 0;
            ui.activeQuickNote = '';

            if (elements.quickNoteInput) elements.quickNoteInput.value = '';
            if (elements.quickNoteWrap) setHidden(elements.quickNoteWrap, true);

            WalkTimer.start({
                onTick: function (elapsedMs) {
                    if (elements.timer) {
                        elements.timer.textContent = WalkTimer.formatDuration(Math.floor(elapsedMs / 1000));
                    }
                }
            });

            transitionTo('active');
        }

        function togglePause() {
            if (WalkTimer.getStatus() === 'running') {
                WalkTimer.pause();
            } else if (WalkTimer.getStatus() === 'paused') {
                WalkTimer.resume();
            }
            renderStates();
        }

        function endWalk() {
            if (ui.selectedWalkType === 'Custom' && !asText(ui.customWalkType)) {
                if (elements.customInput) elements.customInput.focus();
                return;
            }

            var elapsedMs = WalkTimer.stop();
            ui.sessionEndTimeIso = nowIso();
            ui.completedDurationSeconds = Math.max(1, Math.round(elapsedMs / 1000));

            if (elements.noteInput) elements.noteInput.value = ui.activeQuickNote;
            if (elements.weatherInput) elements.weatherInput.value = '';
            if (elements.moodBeforeInput) elements.moodBeforeInput.value = '';
            if (elements.moodAfterInput) elements.moodAfterInput.value = '';
            if (elements.locationInput) elements.locationInput.value = '';

            transitionTo('completed');
        }

        function discardCompleted() {
            WalkTimer.reset();
            ui.activeQuickNote = '';
            ui.sessionStartTimeIso = null;
            ui.sessionEndTimeIso = null;
            ui.completedDurationSeconds = 0;
            transitionTo('idle');
        }

        function validateType() {
            if (ui.selectedWalkType !== 'Custom') return ui.selectedWalkType;
            return asText(ui.customWalkType);
        }

        function saveCompletedWalk() {
            var walkType = validateType();
            if (!walkType) {
                if (elements.customInput) {
                    elements.customInput.focus();
                }
                return;
            }

            var entry = WalkStorage.sanitizeWalkEntry({
                id: makeWalkId(),
                startTime: ui.sessionStartTimeIso || nowIso(),
                endTime: ui.sessionEndTimeIso || nowIso(),
                durationSeconds: ui.completedDurationSeconds,
                walkType: walkType,
                note: elements.noteInput ? elements.noteInput.value : '',
                weather: elements.weatherInput ? elements.weatherInput.value : '',
                moodBefore: elements.moodBeforeInput ? elements.moodBeforeInput.value : '',
                moodAfter: elements.moodAfterInput ? elements.moodAfterInput.value : '',
                location: elements.locationInput ? elements.locationInput.value : '',
                createdAt: nowIso()
            });

            WalkStorage.addEntry(entry);

            WalkTimer.reset();
            ui.activeQuickNote = '';
            ui.sessionStartTimeIso = null;
            ui.sessionEndTimeIso = null;
            ui.completedDurationSeconds = 0;
            transitionTo('idle');

            if (elements.saveFeedback) {
                clearTimeout(saveMessageTimer);
                setHidden(elements.saveFeedback, false);
                elements.saveFeedback.textContent = 'Walk saved.';
                saveMessageTimer = setTimeout(function () {
                    setHidden(elements.saveFeedback, true);
                }, 1800);
            }

            renderLog();
        }

        function toggleLog() {
            ui.logOpen = !ui.logOpen;
            if (elements.viewLogBtn) {
                elements.viewLogBtn.textContent = ui.logOpen ? 'Hide Log' : 'View Log';
            }
            renderLog();
        }

        function bindEvents() {
            if (elements.startBtn) {
                elements.startBtn.addEventListener('click', startWalk);
            }
            if (elements.pauseBtn) {
                elements.pauseBtn.addEventListener('click', togglePause);
            }
            if (elements.endBtn) {
                elements.endBtn.addEventListener('click', endWalk);
            }
            if (elements.addNoteBtn) {
                elements.addNoteBtn.addEventListener('click', function () {
                    if (!elements.quickNoteWrap) return;
                    var isHidden = elements.quickNoteWrap.hasAttribute('hidden');
                    setHidden(elements.quickNoteWrap, !isHidden);
                    if (isHidden && elements.quickNoteInput) {
                        elements.quickNoteInput.focus();
                    }
                });
            }
            if (elements.quickNoteInput) {
                elements.quickNoteInput.addEventListener('input', function () {
                    ui.activeQuickNote = elements.quickNoteInput.value;
                });
            }
            if (elements.viewLogBtn) {
                elements.viewLogBtn.addEventListener('click', toggleLog);
            }
            if (elements.hideLogBtn) {
                elements.hideLogBtn.addEventListener('click', toggleLog);
            }
            if (elements.saveBtn) {
                elements.saveBtn.addEventListener('click', saveCompletedWalk);
            }
            if (elements.discardBtn) {
                elements.discardBtn.addEventListener('click', discardCompleted);
            }
            if (elements.customInput) {
                elements.customInput.addEventListener('input', function () {
                    ui.customWalkType = asText(elements.customInput.value);
                });
            }

            Array.prototype.forEach.call(elements.typeButtons || [], function (button) {
                button.addEventListener('click', function () {
                    ui.selectedWalkType = asText(button.getAttribute('data-walk-type')) || DEFAULT_WALK_TYPE;
                    if (ui.selectedWalkType !== 'Custom') {
                        ui.customWalkType = '';
                        if (elements.customInput) elements.customInput.value = '';
                    }
                    renderStates();
                });
            });

            if (elements.logList) {
                elements.logList.addEventListener('click', function (event) {
                    var actionEl = event.target.closest('[data-entry-action]');
                    if (!actionEl) return;

                    var action = asText(actionEl.getAttribute('data-entry-action'));
                    var entryId = asText(actionEl.getAttribute('data-entry-id'));
                    if (!entryId) return;

                    if (action === 'toggle') {
                        if (expandedIds.has(entryId)) expandedIds.delete(entryId);
                        else expandedIds.add(entryId);
                        renderLog();
                        return;
                    }

                    if (action === 'delete') {
                        var confirmed = global.confirm('Delete this walk entry?');
                        if (!confirmed) return;
                        WalkStorage.deleteEntry(entryId);
                        expandedIds.delete(entryId);
                        renderLog();
                    }
                });
            }
        }

        function ensureInit() {
            if (initialized) return true;
            cacheElements();
            if (!elements.root) return false;
            bindEvents();
            initialized = true;
            return true;
        }

        return {
            init: function () {
                if (!ensureInit()) return false;
                if (elements.timer) {
                    elements.timer.textContent = WalkTimer.formatDuration(0);
                }
                renderStates();
                renderLog();
                return true;
            },
            render: function () {
                if (!ensureInit()) return false;
                renderStates();
                renderLog();
                return true;
            },
            quickLogFromLegacy: function (type) {
                var typeText = asText(type);
                var map = {
                    forest: 'Forest Deep',
                    city: 'City Drift',
                    sea: 'Silent Walk'
                };
                var mappedType = map[typeText] || typeText || DEFAULT_WALK_TYPE;
                var iso = nowIso();
                WalkStorage.addEntry({
                    id: makeWalkId(),
                    startTime: iso,
                    endTime: iso,
                    durationSeconds: 0,
                    walkType: mappedType,
                    note: '',
                    createdAt: iso
                });
                this.render();
            }
        };
    })();

    global.WalkTimer = WalkTimer;
    global.WalkStorage = WalkStorage;
    global.WalkUI = WalkUI;
})(window);
