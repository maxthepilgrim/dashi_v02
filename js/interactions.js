/* ========================================
   Life Dashboard - Interaction Logic
   ======================================== */

// --- Modals & Popups ---

/* ========================================
   V07 — Modals & Editing
   ======================================== */

function initModal() {
    const modal = document.getElementById('edit-modal');
    const close = document.getElementById('modal-close');
    const save = document.getElementById('modal-save');

    if (close) close.addEventListener('click', closeModal);
    if (save) save.addEventListener('click', saveWidgetData);

    // Click outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function closeModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.remove('visible');
}

function openEditModal(type) {
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    if (!modal) return;

    modal.dataset.type = type;
    body.innerHTML = '';

    const v2 = Store.getV2Data();

    switch (type) {
        case 'dailyState':
            title.textContent = 'Log Daily State';
            const state = Store.getTodayState() || {};
            body.innerHTML = `
                <div class="form-group">
                    <label>Energy (1-10)</label>
                    <input type="range" id="inp-energy" min="1" max="10" value="${state.energy || 7}" oninput="this.nextElementSibling.value = this.value">
                    <output>${state.energy || 7}</output>
                </div>
                <div class="form-group">
                    <label>Mood (Emoji)</label>
                    <input type="text" id="inp-mood" value="${state.mood || '😐'}" list="moods">
                    <datalist id="moods"><option value="🔥"><option value="🙂"><option value="😐"><option value="😫"></datalist>
                </div>
                <div class="form-group">
                    <label>Sleep (Hours)</label>
                    <input type="number" id="inp-sleep" value="${state.sleep || 7.5}" step="0.5">
                </div>
            `;
            break;

        case 'income':
            title.textContent = 'Manage Invoices';
            const invoices = Store.getInvoices();
            const listHtml = invoices.map((inv, i) => `
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center">
                    <input type="text" value="${inv.client}" class="inv-client-${i}" placeholder="Client" style="flex:2">
                    <input type="number" value="${inv.amount}" class="inv-amount-${i}" placeholder="€" style="flex:1">
                    <select class="inv-status-${i}" style="flex:1">
                        <option value="Sent" ${inv.status === 'Sent' ? 'selected' : ''}>Sent</option>
                        <option value="Paid" ${inv.status === 'Paid' ? 'selected' : ''}>Paid</option>
                    </select>
                </div>
            `).join('');

            body.innerHTML = `
                <div id="invoice-list-container">${listHtml}</div>
                <button class="btn-text" onclick="addInvoiceRow()">+ Add Invoice</button>
            `;
            break;

        case 'habitsRituals':
            title.textContent = 'Daily Rhythm';
            const rhythm = v2.dailyRhythm || [];
            body.innerHTML = rhythm.map((phase, pI) => `
                <div class="rhythm-phase-edit" style="margin-bottom:20px; border:1px solid var(--border-color); padding:10px; border-radius:8px">
                    <input type="text" value="${phase.title}" class="rp-title-${pI}" style="font-weight:bold; width:100%; margin-bottom:5px">
                    <input type="text" value="${phase.subtitle}" class="rp-sub-${pI}" style="font-size:0.8rem; width:100%; margin-bottom:10px">
                    <div id="rp-items-${pI}">
                        ${phase.items.map((item, iI) => `
                            <div style="display:flex; gap:8px; margin-bottom:5px">
                                <input type="checkbox" ${item.done ? 'checked' : ''} class="rp-check-${pI}-${iI}">
                                <input type="text" value="${item.text}" class="rp-text-${pI}-${iI}" style="flex:1">
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn-text-small" onclick="addRhythmItem(${pI})">+ Add Item</button>
                </div>
            `).join('');
            break;


        case 'revenueEngine':
            title.textContent = 'Revenue Engine';
            const bfRev = Store.getV2Data().businessFinance || {};
            body.innerHTML = `
                <div class="form-group">
                    <label>Revenue Today (€)</label>
                    <input type="number" id="inp-rev-today" value="${bfRev.revenueToday || 0}">
                </div>
                <div class="form-group">
                    <label>Pipeline Added Today (€)</label>
                    <input type="number" id="inp-pipe-today" value="${bfRev.pipelineToday || 0}">
                </div>
                <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0">
                <p style="font-size:0.8rem; color:var(--text-tertiary)">Updates here reflect immediately on the dashboard.</p>
            `;
            break;

        case 'financialIntel':
            title.textContent = 'Financial Intelligence';
            const bfIntel = Store.getV2Data().businessFinance || {};
            body.innerHTML = `
                <div class="form-group">
                    <label>Cash on Hand (€)</label>
                    <input type="number" id="inp-biz-cash" value="${bfIntel.cash || 0}">
                </div>
                <div class="form-group">
                    <label>Monthly Burn (€)</label>
                    <input type="number" id="inp-biz-burn" value="${bfIntel.monthlyBurn || 0}">
                </div>
                <div class="form-group">
                    <label>Break-Even Point (€/mo)</label>
                    <input type="number" id="inp-biz-breakeven" value="${bfIntel.breakEvenPoint || 0}">
                </div>
            `;
            break;

        case 'projectsLeverage':
            title.textContent = 'Projects & Leverage';
            const projects = Store.getV2Data().revenueProjects || [];
            const pList = projects.map((p, i) => `
                <div style="display:grid; grid-template-columns: 1fr 80px 60px 30px; gap:8px; margin-bottom:8px">
                    <input type="text" placeholder="Project Name" value="${p.name}" class="p-name-${i}">
                    <select class="p-status-${i}">
                        <option value="Active" ${p.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Hold" ${p.status === 'Hold' ? 'selected' : ''}>Hold</option>
                    </select>
                    <input type="number" placeholder="Lev" value="${p.leverage}" class="p-lev-${i}">
                    <button onclick="deleteRevenueProject(${i})" style="color:red">&times;</button>
                </div>
            `).join('');

            body.innerHTML = `
                <div id="rev-projects-container">${pList}</div>
                <button class="btn-text" onclick="addRevenueProjectRow()">+ Add Row</button>
            `;
            break;

        case 'creativeOutput':
            title.textContent = 'Creative Output';
            const content = Store.getV2Data().contentDistribution || {};
            body.innerHTML = `
                <div class="form-group">
                    <label>Minutes Created Today</label>
                    <input type="number" id="inp-content-mins" value="${content.minutesCreated || 0}">
                </div>
                <div class="form-group">
                    <label>Pieces Finished</label>
                    <input type="number" id="inp-content-pieces" value="${content.piecesFinished || 0}">
                </div>
                <div class="form-group">
                    <label>Audience Growth</label>
                    <input type="number" id="inp-content-growth" value="${content.audienceGrowth || 0}">
                </div>
            `;
            break;

        case 'creativePulse':
            title.textContent = 'Creative Compass Projects';
            const compass = Store.getCompassData();
            const projs = compass.projects || [];
            body.innerHTML = projs.map((p, i) => `
                <div style="background:rgba(255,255,255,0.05); padding:10px; margin-bottom:10px; border-radius:6px">
                    <input type="text" value="${p.name}" class="cp-name-${i}" style="font-weight:bold; width:100%">
                    <select class="cp-stage-${i}">
                        <option value="SEED" ${p.stage === 'SEED' ? 'selected' : ''}>SEED</option>
                        <option value="SPROUT" ${p.stage === 'SPROUT' ? 'selected' : ''}>SPROUT</option>
                        <option value="BLOOM" ${p.stage === 'BLOOM' ? 'selected' : ''}>BLOOM</option>
                        <option value="RESTING" ${p.stage === 'RESTING' ? 'selected' : ''}>RESTING</option>
                    </select>
                    <label style="font-size:0.8rem"><input type="checkbox" ${p.archived ? 'checked' : ''} class="cp-arch-${i}"> Archived</label>
                </div>
            `).join('');
            body.innerHTML += `<button class="btn-text" onclick="addCompassProject()">+ New Project</button>`;
            break;

        case 'settings':
            title.textContent = 'Global Settings';
            const profile = Store.getProfile();
            body.innerHTML = `
                <h3>Profile</h3>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="inp-set-name" value="${profile.name || ''}">
                </div>
                <h3>Data</h3>
                <button class="btn-primary" onclick="exportData()">Export JSON</button>
                <div style="margin-top:10px">
                    <button class="btn-text" style="color:red" onclick="resetAllData()">Reset All</button>
                </div>
            `;
            break;

        case 'library':
            title.textContent = 'Library';
            body.innerHTML = `
                <div class="form-group">
                    <p>Library is now a dedicated top-level mode.</p>
                </div>
                <div class="form-actions" style="margin-top:20px; text-align:right">
                    <button class="btn-primary" onclick="ModeManager.switchMode('library'); closeModal()">Open Library</button>
                </div>
            `;
            break;

        default:
            body.innerHTML = '<p>To be implemented for this widget.</p>';

    }
    modal.classList.add('visible');
}

// PLACEHOLDER_SAVE_LOGIC


// --- Drag & Drop ---

function initDragging() {
    const columns = $$('.col-left, .col-center, .col-right, .vision-inner, .ritual-inner');
    const widgets = $$('.widget, .vision-widget, .ritual-widget, .ritual-card');
    let draggedWidget = null;

    // Load saved layout
    const savedLayout = Store.getLayout();
    if (savedLayout) {
        Object.keys(savedLayout).forEach(colClass => {
            const col = document.querySelector(`.${colClass}`) || document.getElementById(colClass);
            if (col) {
                savedLayout[colClass].forEach(id => {
                    const widget = document.getElementById(id);
                    if (widget) col.appendChild(widget);
                });
            }
        });
    }

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
            draggedWidget = widget;
            widget.classList.add('dragging');
            e.dataTransfer.setData('text/plain', widget.id);
            setTimeout(() => widget.style.display = 'none', 0);
        });

        widget.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        widget.addEventListener('dragend', () => {
            draggedWidget = null;
            widget.classList.remove('dragging');
            widget.style.display = 'flex';
            widget.setAttribute('draggable', 'false');
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
    const draggableElements = [...container.querySelectorAll('.widget:not(.dragging)')];

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
        'col-left': Array.from($$('.col-left .widget')).map(w => w.id),
        'col-center': Array.from($$('.col-center .widget')).map(w => w.id),
        'col-right': Array.from($$('.col-right .widget')).map(w => w.id),
        'vision-inner': Array.from($$('.vision-inner .vision-widget')).map(w => w.id),
        'ritual-inner': Array.from($$('.ritual-inner .ritual-widget, .ritual-inner .ritual-card')).map(w => w.id)
    };
    Store.saveLayout(layout);
}


// --- Smart Dock ---

function initSmartDock() {
    const dock = document.querySelector('.command-dock'); // Fixed selector
    if (!dock) return;

    let timeout;
    let lastScrollY = window.scrollY;

    // Show on mouse bottom
    document.addEventListener('mousemove', (e) => {
        if (e.clientY > window.innerHeight - 100) {
            dock.classList.add('visible');
            clearTimeout(timeout);
        } else {
            timeout = setTimeout(() => {
                dock.classList.remove('visible');
            }, 3000);
        }
    });

    // Show on scroll up (mobile style)
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY < lastScrollY && currentScrollY > 100) {
            dock.classList.add('visible');
            clearTimeout(timeout);
            timeout = setTimeout(() => dock.classList.remove('visible'), 2000);
        } else if (currentScrollY > lastScrollY) {
            dock.classList.remove('visible');
        }
        lastScrollY = currentScrollY;
    }, { passive: true });
}

// --- Focus Timer (Restored Object Logic) ---
const FocusTimer = {
    timeLeft: 25 * 60,
    targetTime: 25 * 60,
    isRunning: false,
    interval: null,

    init() {
        this.display = document.getElementById('timer-display');
        this.toggleBtn = document.getElementById('btn-focus-timer');
        this.icon = this.toggleBtn ? this.toggleBtn.querySelector('svg') : null;

        if (this.toggleBtn) {
            this.toggleBtn.onclick = () => this.toggle();
        }
    },

    toggle() {
        if (this.isRunning) this.pause();
        else this.start();
    },

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.toggleBtn.classList.add('active');
        if (this.icon) this.icon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>'; // Stop icon
        this.interval = setInterval(() => this.tick(), 1000);

        if (this.display) this.display.style.display = 'inline';
    },

    pause() {
        this.isRunning = false;
        this.toggleBtn.classList.remove('active');
        if (this.icon) this.icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'; // Play icon
        clearInterval(this.interval);
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
        const m = Math.floor(this.timeLeft / 60);
        const s = this.timeLeft % 60;
        this.display.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    },

    complete() {
        this.pause();
        new Notification("Focus Session Complete!");
        this.timeLeft = this.targetTime;
        if (this.display) this.display.textContent = 'Done';
        setTimeout(() => {
            if (this.display) this.display.textContent = 'Timer';
            if (this.display) this.display.style.display = 'none';
        }, 3000);
    }
};

function initFocusTimer() {
    FocusTimer.init();
}

// Global wrapper for onclick
window.toggleFocusTimer = () => FocusTimer.toggle();


// --- Missing Navigation Helpers ---

function openJournalFeed() {
    const entries = Store.getJournalEntries();
    const body = document.getElementById('modal-body');
    const overlay = document.getElementById('modal-overlay');

    if (!body || !overlay) return;

    const entriesHtml = entries.map(e => {
        const d = new Date(e.date);
        const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
            <div class="journal-feed-item" style="padding:15px; border-bottom:1px solid rgba(255,255,255,0.1)">
                <div class="journal-feed-date" style="font-size:0.75rem; color:var(--text-tertiary); margin-bottom:5px">${dateStr}</div>
                <div class="journal-feed-text" style="white-space: pre-wrap;">${e.text}</div>
                <button class="btn-text-small" style="color:red; margin-top:5px" onclick="deleteAndRefreshJournal('${e.id}')">Delete</button>
            </div>
        `;
    }).join('');

    body.innerHTML = `
        <div class="modal-form">
            <h2>Journal Feed</h2>
            
            <!-- Quick Add -->
            <div style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1)">
                <textarea id="modal-journal-input" placeholder="Write a new entry..." style="width:100%; height:80px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px; color:var(--text-primary); font-family:var(--font-body); margin-bottom:10px"></textarea>
                <button class="btn-primary" onclick="addJournalFromModal()">Add Entry</button>
            </div>

            <div class="journal-feed-list" style="max-height:50vh; overflow-y:auto">
                ${entriesHtml || '<p style="opacity:0.5; text-align:center">No entries yet.</p>'}
            </div>
            <div class="modal-actions">
                <button class="btn-text" onclick="closeModal()">Close</button>
            </div>
        </div>
    `;
    overlay.classList.add('active');
}

function deleteAndRefreshJournal(id) {
    Store.deleteJournalEntry(id);
    openJournalFeed();
}

function openLibraryDatabase() {
    if (window.ModeManager && typeof window.ModeManager.switchMode === 'function') {
        ModeManager.switchMode('library');
    }
}

function deleteEvent(idx) {
    const events = Store.getEvents();
    events.splice(idx, 1);
    Store.saveEvents(events);
    renderCalendar();
    openEditModal('calendar');
}

function addNewEvent() {
    const time = document.getElementById('new-ev-time').value;
    const name = document.getElementById('new-ev-name').value;
    const date = document.getElementById('new-ev-date').value;
    const desc = document.getElementById('new-ev-desc').value;

    if (name) {
        const events = Store.getEvents();
        events.push({ date, time, name, description: desc });
        Store.saveEvents(events);
        renderCalendar();
        openEditModal('calendar');
    }
}

// --- Config / Exports ---

function initVisualControls() {
    // Basic init if needed, mostly handled by CSS variables now
    // Restoring user's specific logic requires more context, 
    // but ensuring the button works is step 1.
    const btn = document.getElementById('btn-visual-config');
    if (btn) {
        btn.onclick = () => openEditModal('settings'); // Redirect to settings for now or restore popup
    }
}

window.exportDashboardAsImage = function () {
    alert("Snapshot feature requires html2canvas. Ensure it is loaded.");
    if (typeof html2canvas === 'function') {
        html2canvas(document.body).then(canvas => {
            const link = document.createElement('a');
            link.download = 'life-dashboard.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
};

window.exportData = function () {
    const data = Store.getAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'life-os-backup.json';
    a.click();
};

window.importData = function (input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const json = JSON.parse(e.target.result);
        Store.restoreAllData(json);
        window.location.reload();
    };
    reader.readAsText(file);
};

// Expose to window
window.initSmartDock = initSmartDock;
window.initFocusTimer = initFocusTimer;
window.openJournalFeed = openJournalFeed;
window.deleteAndRefreshJournal = deleteAndRefreshJournal;
window.openLibraryDatabase = openLibraryDatabase;
window.deleteEvent = deleteEvent;
window.addNewEvent = addNewEvent;
window.initVisualControls = initVisualControls;

// --- Command Palette ---

const paletteActions = [
    { id: 'mode', name: 'Toggle Personal / Business Mode', icon: '🔄', action: () => ModeManager.toggleMode() },
    { id: 'zen', name: 'Toggle Zen Mode', icon: '🧘', action: () => { document.getElementById('btn-zen-mode').click(); } },
    { id: 'timer', name: 'Start/Stop Focus Timer', icon: '🕐', action: () => FocusTimer.toggle() },
    { id: 'journal', name: 'New Journal Entry', icon: '📝', action: () => { document.getElementById('journal-area').focus(); } },
    { id: 'feed', name: 'Open Journal Feed', icon: '📖', action: openJournalFeed },
    { id: 'income', name: 'Add Income', icon: '💰', action: () => openEditModal('income') },
    { id: 'habit', name: 'Edit Habits', icon: '✅', action: () => openEditModal('habitsRituals') },
    { id: 'theme', name: 'Change Theme', icon: '🎨', action: () => openEditModal('settings') },
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
            <div class="cp-item ${i === 0 ? 'selected' : ''}" onclick="executePaletteAction('${act.id}')">
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

window.saveLibraryItem = function () {
    const title = $('#inp-lib-title').value;
    const author = $('#inp-lib-author').value;

    if (!title) return;

    if (window.LibraryStorage && typeof window.LibraryStorage.saveItems === 'function') {
        const allItems = LibraryStorage.getItems();
        allItems.unshift({
            id: 'library-' + Date.now(),
            title: title,
            creator: author || '',
            type: 'unknown',
            coverUrl: '',
            year: '',
            notes: '',
            createdAt: new Date().toISOString()
        });
        LibraryStorage.saveItems(allItems);
    }

    closeModal();
    if (window.LibraryRenderer && typeof window.LibraryRenderer.refresh === 'function') {
        window.LibraryRenderer.refresh();
    }
};

window.addJournalFromModal = function () {
    const txt = $('#modal-journal-input').value;
    if (!txt.trim()) return;

    Store.addJournalEntry(txt);
    openJournalFeed(); // Refresh
};
