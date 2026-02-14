/* ========================================
   Journal Feed Logic
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    renderJournalFeed();

    // Re-render feed when a new entry is added via the quick-add in app.js
    const area = $('#journal-area');
    if (area) {
        area.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                // Wait a tiny bit for app.js to finish its Enter handling
                setTimeout(renderJournalFeed, 50);
            }
        });
    }
});

function renderJournalFeed() {
    const feedEl = $('#journal-feed');
    if (!feedEl) return;

    const entries = Store.getJournalEntries();
    feedEl.innerHTML = '';

    if (entries.length === 0) {
        feedEl.innerHTML = `
            <div class="widget glass" style="text-align:center; padding: 40px; color: var(--text-tertiary)">
                <p>No journal entries yet. Start writing above!</p>
            </div>
        `;
        return;
    }

    entries.forEach(entry => {
        const date = new Date(entry.date);
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const card = document.createElement('div');
        card.className = 'journal-entry-card glass';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <span class="entry-date">${dateStr}</span>
                <button class="btn-delete" data-id="${entry.id}" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer; font-size:0.8rem">&times; Delete</button>
            </div>
            <div class="entry-content">${entry.text}</div>
        `;

        // Delete functionality
        const deleteBtn = card.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const entryId = deleteBtn.getAttribute('data-id');
            if (confirm('Delete this entry?')) {
                Store.deleteJournalEntry(entryId);
                renderJournalFeed();
            }
        });

        feedEl.appendChild(card);
    });
}
