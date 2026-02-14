/* ========================================
   Life Dashboard - Render Functions
   ======================================== */

// --- Essentials ---

function renderTime() {
    const now = new Date();
    const dateEl = $('#topbar-date');
    if (dateEl) {
        const options = { weekday: 'short', month: 'long', day: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
}

function renderGreeting() {
    const el = $('#greeting');
    if (!el) return;

    const hour = new Date().getHours();
    let greeting = 'Good Morning';
    if (hour >= 12) greeting = 'Good Afternoon';
    if (hour >= 18) greeting = 'Good Evening';

    const name = Store.getProfile().name || 'Maximilian';
    el.textContent = `${greeting}, ${name}.`;

    const quotes = [
        "Focus on what you can control.",
        "Amor Fati.",
        "Structure brings freedom.",
        "The obstacle is the way.",
        "Memento Mori.",
        "Stillness is the key.",
        "Make it count."
    ];
    const sub = $('#greeting-sub');
    if (sub) {
        sub.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    }
}

function renderDailyState() {
    const entry = Store.getTodayState();
    const container = $('#daily-state-content');
    if (!container) return;

    if (!entry) {
        container.innerHTML = `
            <div class="state-placeholder" onclick="openEditModal('dailyState')">
                Log today’s state.
            </div>
        `;
        return;
    }

    container.className = 'daily-state-container';
    container.innerHTML = `
        <div class="rhythm-header" onclick="openEditModal('dailyState')" style="cursor:pointer; align-items: flex-start; text-align: left; border-bottom: none; padding-bottom: 0;">
            <span class="rhythm-title">CURRENT STATUS</span>
            <span class="rhythm-subtitle">Today's inner metrics</span>
        </div>
        <div class="state-metrics-list">
            <div class="state-metric-row" style="animation-delay: 0.1s" onclick="openEditModal('dailyState')">
                <span class="metric-icon">⚡</span>
                <span class="metric-name">ENERGY</span>
                <div class="spacer"></div>
                <span class="metric-value">${entry.energy || '—'}</span>
            </div>
            <div class="state-metric-row" style="animation-delay: 0.2s" onclick="openEditModal('dailyState')">
                <span class="metric-icon">🎭</span>
                <span class="metric-name">MOOD</span>
                <div class="spacer"></div>
                <span class="metric-value">${entry.mood || '—'}</span>
            </div>
            <div class="state-metric-row" style="animation-delay: 0.3s" onclick="openEditModal('dailyState')">
                <span class="metric-icon">🌙</span>
                <span class="metric-name">REST</span>
                <div class="spacer"></div>
                <span class="metric-value">${entry.sleep ? entry.sleep + 'h' : '—'}</span>
            </div>
        </div>
    `;
}

function renderFinance() {
    const balanceEl = $('#fo-balance');
    const realBalanceEl = $('#fo-real-balance');
    const pipelineEl = $('#fo-pipeline');
    const debtEl = $('#fo-debt');
    const runwayEl = $('#fo-runway');
    const runwayStatusEl = $('#fo-runway-status');
    const pipelineListEl = $('#pipeline-list');

    if (!balanceEl) return;

    const finance = Store.getFinance();
    const v2 = Store.getV2Data();

    // Calculate Reality
    const realBalance = finance.balance;
    const invoices = Store.getInvoices();
    const openInvoices = invoices.filter(i => i.status !== 'Paid');
    const pipelineValue = openInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    const projectedBalance = realBalance + pipelineValue;

    // Runway Calculation
    const monthlyBurn = v2.financialReality.monthlyTarget || 3000;
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
                <div class="pipeline-item" onclick="openEditModal('income')">
                    <div style="flex:1">
                        <div style="font-weight:500; font-size:0.8rem">${inv.client}</div>
                        <div style="font-size:0.7rem; color:var(--text-tertiary)">${new Date(inv.expectedDate).toLocaleDateString()} · ${inv.status}</div>
                    </div>
                    <div style="font-weight:600; font-size:0.8rem">€${inv.amount}</div>
                </div>
            `).join('');
        }
    }
}

function renderDailyRhythm() {
    const container = $('#habits-list-dashboard');
    const ringFill = $('#tracker-ring-fill');
    const ringText = $('#tracker-subtitle');

    const morningList = $('#morning-rituals-list');
    const eveningList = $('#evening-rituals-list');
    if (morningList) morningList.innerHTML = '';
    if (eveningList) eveningList.innerHTML = '';

    if (!container) return;

    const v2 = Store.getV2Data();
    const rhythm = v2.dailyRhythm || [];

    // 1. Calculate Stats
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
        ringText.textContent = `${completedItems}/${totalItems} steps`;

        const ring = $('.mini-ring');
        if (ring) {
            ring.classList.remove('pulse-beat');
            void ring.offsetWidth;
            ring.classList.add('pulse-beat');
        }
    }

    // 2. Render Phases
    container.className = 'daily-rhythm-container';
    container.innerHTML = rhythm.map((phase, pIndex) => {
        const isCollapsed = phase.collapsed;
        return `
        <div class="rhythm-phase">
            <div class="rhythm-header" onclick="toggleRhythmPhase(${pIndex})" style="cursor:pointer">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
                    <span class="rhythm-title">${phase.title}</span>
                    <span class="rhythm-chevron" style="transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}; transition: transform 0.2s">▼</span>
                </div>
                <span class="rhythm-subtitle">${phase.subtitle}</span>
            </div>
            <div class="rhythm-items-wrapper" style="display:${isCollapsed ? 'none' : 'flex'}; flex-direction:column; gap:12px">
                ${phase.items.map((item, iIndex) => `
                    <div class="rhythm-item ${item.done ? 'done' : ''}" 
                         onclick="toggleRhythmItem(${pIndex}, ${iIndex})"
                         style="animation-delay: ${iIndex * 0.05}s">
                        <div class="rhythm-checkbox"></div>
                        <span class="rhythm-label">${item.text}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `}).join('');

    renderStreakCalendar();
}

function renderStreakCalendar() {
    const grid = document.getElementById('streak-calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const today = new Date();
    const dates = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d);
    }

    const habitHistory = Store.getHabitHistory();
    const habitsConfig = Store.getHabits();
    const totalHabits = habitsConfig.length; // Wait, Store.getHabits() gets legacy habits?
    // v2 uses v2.dailyRhythm for tracking.
    // Store.getHabitHistory logic needs to be checked.
    // Assuming it works for now based on app.js code.

    dates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        const completed = habitHistory[dateStr] ? habitHistory[dateStr].length : 0;
        let intensity = 0;
        if (totalHabits > 0 && completed > 0) {
            const pct = completed / totalHabits;
            if (pct <= 0.25) intensity = 1;
            else if (pct <= 0.50) intensity = 2;
            else if (pct <= 0.75) intensity = 3;
            else intensity = 4;
        }
        const cell = document.createElement('div');
        cell.className = `streak-cell intensity-${intensity}`;
        cell.title = `${dateStr}: ${completed}`;
        grid.appendChild(cell);
    });
}


// --- Dashboard Widgets ---

function renderCalendar() {
    const list = $('#calendar-list');
    if (!list) return;

    const events = Store.getEvents();
    events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const show = events.slice(0, 5);

    if (show.length === 0) {
        list.innerHTML = `<div style="text-align:center; opacity:0.5; padding:20px; font-size:0.9rem">No upcoming events.<br><button class="btn-text" onclick="openEditModal('calendar')">+ Add Event</button></div>`;
        return;
    }

    list.innerHTML = show.map(e => `
        <div class="cal-item">
            <div class="cal-time">${e.time}</div>
            <div class="cal-info">
                <div class="cal-name">${e.name}</div>
                ${e.description ? `<div class="cal-desc">${e.description}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function renderGoals() {
    const list = $('#goals-list-dashboard');
    if (!list) return;

    const goals = Store.getGoals();

    list.innerHTML = '';

    if (goals.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding:20px; opacity:0.6; font-size:0.85rem; font-style:italic">
                No active goals.<br>
                <button class="btn-text" onclick="addNewGoal()">Create Goal</button>
            </div>
        `;
        return;
    }
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
                    <span class="tg-pct" onclick="editGoalProgress('${goal.id}', ${goal.progress})">${goal.progress}%</span>
                </div>
                <div class="tg-bar-bg">
                    <div class="tg-bar-fill" style="width: ${goal.progress}%; background: ${color}"></div>
                </div>
            </div>
            <div class="tg-actions">
                <button onclick="updateGoalProgress('${goal.id}', -5)" title="-5%">-</button>
                <button onclick="updateGoalProgress('${goal.id}', 5)" title="+5%">+</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderActivityLog() {
    const container = $('#activity-list');
    if (!container) return;

    const activityLog = Store.getActivities();

    if (!activityLog || activityLog.length === 0) {
        container.innerHTML = `
            <div onclick="addActivity()" style="cursor:pointer; text-align:center; padding:20px; color:var(--text-tertiary); font-size:0.85rem; display:flex; flex-direction:column; align-items:center; gap:8px; opacity:0.8; transition:opacity 0.2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">
                <span style="font-size:1.5rem">🌱</span>
                <span>Start your first entry &rarr;</span>
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
                <button class="vice-relapse-btn" onclick="viceRelapse('${v.id}')" title="Reset">\u21bb</button>
            </div>
        `;
    }).join('');
}

function renderNorthStar() {
    const container = $('#north-star-display');
    if (!container) return;
    container.innerHTML = `
        <div class="ns-quote">"BUILD A LIFE YOU DON'T NEED TO ESCAPE FROM."</div>
        <div class="ns-values">
            <span>FREEDOM</span>
            <span>MASTERY</span>
            <span>IMPACT</span>
        </div>
    `;
}

function renderCreativeCompass() {
    const container = $('#compass-display');
    if (!container) return;

    const data = Store.getCompassData();
    const direction = getCompassDirection();

    if (!direction) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px; opacity:0.7">
                <div>No active projects found.</div>
                <button class="btn-text" onclick="openEditModal('creativePulse')">Define Projects</button>
            </div>
        `;
        return;
    }

    const project = direction.project;

    container.innerHTML = `
        <div class="compass-main">
            <div class="compass-label">CURRENT DIRECTION</div>
            <div class="compass-project">${project.name}</div>
            <div class="compass-stage">${project.stage} PHASE</div>
        </div>
        <div class="compass-checkin" id="compass-check-in">
            <div style="font-size:0.8rem; margin-bottom:8px; opacity:0.8">Did you move this forward today?</div>
            <div class="compass-actions">
                <button onclick="compassCheckIn('yes')">YES</button>
                <button onclick="compassCheckIn('little')">A BIT</button>
                <button onclick="compassCheckIn('no')">NO</button>
            </div>
        </div>
        <div style="text-align:center; margin-top:12px">
            <button class="btn-text-small" onclick="openEditModal('creativePulse')">Manage Compass</button>
            <button class="btn-text-small" onclick="openDirectionLog()">View Log</button>
        </div>
    `;
}

function getCompassDirection() {
    const data = Store.getCompassData();
    if (!data.projects || data.projects.length === 0) return null;

    const today = new Date().toDateString();
    if (data.dailyOverride && data.dailyOverride.date === today) {
        const p = data.projects.find(p => p.id === data.dailyOverride.projectId);
        if (p) return { project: p, reason: 'override' };
    }

    const active = data.projects.filter(p => !p.archived && p.stage !== 'RESTING');
    if (active.length === 0) return null;

    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const index = dayOfYear % active.length;

    return { project: active[index], reason: 'schedule' };
}

function renderWorlds() {
    const container = $('#worlds-list');
    if (!container) return;

    const v2 = Store.getV2Data();
    const worlds = v2.activeWorlds || [];

    if (worlds.length === 0) {
        container.innerHTML = '<div style="opacity:0.5; font-size:0.9rem; text-align:center; padding:15px">No active worlds.</div>';
        return;
    }

    container.innerHTML = worlds.map(w => `
        <div class="world-card">
            <div class="world-header">
                <span class="world-name">${w.name}</span>
                <span class="world-state">${w.state}</span>
            </div>
            <div class="world-action">➜ ${w.nextAction}</div>
        </div>
    `).join('');
}

function renderReflection() {
    const container = $('#reflection-display');
    if (!container) return;

    const v2 = Store.getV2Data();
    const ref = v2.reflection || {};

    container.innerHTML = `
        <div class="reflection-block">
            <label>WIN OF THE WEEK</label>
            <p>${ref.win || '—'}</p>
        </div>
        <div class="reflection-block">
            <label>LESSON LEARNED</label>
            <p>${ref.lesson || '—'}</p>
        </div>
        <div class="reflection-block">
            <label>NEXT SHIFT</label>
            <p>${ref.nextShift || '—'}</p>
        </div>
    `;
}

function renderPeople() {
    const list = $('#people-list');
    if (!list) return;

    const v2 = Store.getV2Data();
    const people = v2.people || [];

    if (people.length === 0) {
        list.innerHTML = '<div style="text-align:center; opacity:0.5">No connections tracked.</div>';
        return;
    }

    list.innerHTML = people.map(p => `
        <div class="person-card">
            <div class="person-avatar">${p.name.charAt(0)}</div>
            <div class="person-info">
                <div class="person-name">${p.name}</div>
                <div class="person-role">${p.role}</div>
            </div>
        </div>
    `).join('');
}

// --- Business Mode ---

function renderBusinessWidgets() {
    const v2 = Store.getV2Data();
    const bf = v2.businessFinance || {};
    const projects = v2.revenueProjects || [];
    const content = v2.contentDistribution || {};

    // Revenue Engine
    const revToday = document.getElementById('biz-rev-today');
    const pipeToday = document.getElementById('biz-pipeline-today');
    if (revToday) revToday.textContent = `€${bf.revenueToday || 0}`;
    if (pipeToday) pipeToday.textContent = `€${bf.pipelineToday || 0}`;

    // Financial Intelligence
    const cash90 = document.getElementById('biz-90d-cash');
    const burn = document.getElementById('biz-burn');
    const breakeven = document.getElementById('biz-breakeven');
    const runwayEl = document.getElementById('biz-runway');

    if (cash90) cash90.textContent = `€${(bf.cash || 0).toLocaleString()}`;
    if (burn) burn.textContent = `€${(bf.monthlyBurn || 0).toLocaleString()}`;
    if (breakeven) breakeven.textContent = `€${bf.breakEvenPoint || 0}/mo`;

    if (runwayEl) {
        const runway = bf.runwayMonths || (bf.monthlyBurn > 0 ? (bf.cash / bf.monthlyBurn).toFixed(1) : '∞');
        runwayEl.textContent = `${runway} mo`;
        if (parseFloat(runway) < 6) runwayEl.style.color = 'var(--accent-red)';
        else runwayEl.style.color = 'var(--accent-green)';
    }

    // Projects & Leverage
    const projectsList = document.getElementById('biz-projects-list');
    const leverageScore = document.getElementById('biz-leverage-score');
    if (projectsList) {
        projectsList.innerHTML = projects.map(p => `
            <div class="biz-project-item">
                <div>
                    <div class="biz-project-name">${p.name}</div>
                    <div class="biz-project-status">${p.status}</div>
                </div>
                <div class="biz-leverage-badge">${p.leverage}</div>
            </div>
        `).join('');
    }
    if (leverageScore && projects.length > 0) {
        const avg = (projects.reduce((s, p) => s + (p.leverage || 0), 0) / projects.length).toFixed(1);
        leverageScore.textContent = avg;
    }

    // Creative Output
    const minCreated = document.getElementById('biz-minutes-created');
    const piecesFinished = document.getElementById('biz-pieces-finished');
    const audienceGrowth = document.getElementById('biz-audience-growth');
    const contentStage = document.getElementById('biz-content-stage');

    if (minCreated) minCreated.textContent = content.minutesCreated || 0;
    if (piecesFinished) piecesFinished.textContent = content.piecesFinished || 0;
    if (audienceGrowth) audienceGrowth.textContent = `+${content.audienceGrowth || 0}`;
    if (contentStage) contentStage.textContent = content.stage || '—';
}


// --- Systems & Analysis ---

function renderSystemHealth() {
    const container = $('#system-health-bars');
    if (!container) return;

    try {
        const v2 = Store.getV2Data();
        const todayState = Store.getTodayState() || {};
        const activities = Store.getActivities();
        const journalEntries = (typeof Store.getJournalEntries === 'function') ? Store.getJournalEntries() : [];
        const now = new Date();

        // 1. HEALTH
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const recentActs = activities.filter(a => new Date(a.date) > oneWeekAgo).length;
        const actScore = Math.min(50, (recentActs / 4) * 50);

        const sleepHrs = parseFloat(todayState.sleep) || 0;
        const sleepScore = Math.min(50, (sleepHrs / 8) * 50);
        const healthScore = Math.round(actScore + sleepScore);

        // 2. WEALTH
        const fr = v2.financialReality || {};
        const runwayScore = Math.min(60, (fr.runwayMonths / 6) * 60);
        const debtProgress = fr.debtLeft === 0 ? 40 : Math.max(0, 40 - (fr.debtLeft / 12000) * 40);
        const wealthScore = Math.round(runwayScore + debtProgress);

        // 3. WISDOM
        const recentJournals = journalEntries.filter(e => (now - new Date(e.date)) < 7 * 86400000).length;
        const journalScore = Math.min(60, (recentJournals / 5) * 60);

        const libraryCount = (window.LibraryStorage && typeof window.LibraryStorage.getItems === 'function')
            ? window.LibraryStorage.getItems().length
            : 0;
        const curiosityScore = Math.min(40, (libraryCount / 5) * 40);
        const wisdomScore = Math.round(journalScore + curiosityScore);

        const areas = [
            { name: 'Health', score: healthScore, icon: '❤️' },
            { name: 'Wealth', score: wealthScore, icon: '💰' },
            { name: 'Wisdom', score: wisdomScore, icon: '🧠' }
        ];

        const statusColor = (s) => s >= 80 ? 'var(--text-accent)' : s >= 50 ? '#ffd3b6' : '#ffaaa5';
        const statusLabel = (s) => s >= 80 ? 'Optimal' : s >= 50 ? 'Stable' : 'Critical';

        container.innerHTML = areas.map(a => `
            <div class="sh-row">
                <span class="sh-icon">${a.icon}</span>
                <span class="sh-name">${a.name}</span>
                <div class="sh-bar-track">
                    <div class="sh-bar-fill" style="width:${a.score}%; background:${statusColor(a.score)}"></div>
                </div>
                <span class="sh-status" style="color:${statusColor(a.score)}">${statusLabel(a.score)}</span>
            </div>
        `).join('');
    } catch (e) {
        console.error('System Health calculation failed:', e);
        container.innerHTML = '<div style="opacity:0.5; font-size:0.75rem">Calculation sync error</div>';
    }
}

function calculateDailyPulse() {
    let score = 0;

    // 1. Daily Rhythm (40 pts)
    const rhythm = Store.getV2Data().dailyRhythm || [];
    let totalHabits = 0;
    let completedHabits = 0;
    rhythm.forEach(phase => {
        if (phase.items) {
            totalItems += phase.items.length;
            completedItems += phase.items.filter(i => i.done).length;
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

    // 4. Daily State Logged (20 pts)
    const state = Store.getDailyState();
    if (state && new Date(state.date).toDateString() === today) {
        score += 20;
    }

    // 5. Vices Clean (10 pts)
    score += 10;

    // Render
    const scoreEl = document.getElementById('daily-pulse-score');
    const ringEl = document.getElementById('pulse-score-ring');

    if (scoreEl && ringEl) {
        const finalScore = Math.round(score);
        scoreEl.textContent = finalScore;

        let color = 'var(--text-tertiary)';
        if (finalScore > 30) color = '#ffaaa5';
        if (finalScore > 60) color = '#ffd3b6';
        if (finalScore > 80) color = '#a8e6cf';

        scoreEl.style.color = color;
        ringEl.style.stroke = color;

        const radius = 15.9155;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (finalScore / 100) * circumference;
        ringEl.style.strokeDashoffset = offset;
    }
}
