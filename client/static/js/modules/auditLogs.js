// System Audit Logs & Live Activity Feed Module
import { state } from '../state.js';
import { api } from '../api.js';

let lastKnownMaxEntryId = 0;

export async function pollDatabaseForUpdates() {
    if (!state.currentUser) return;
    try {
        const currentEntries = await api.get("/api/entries/query");
        state.sheetEntries = currentEntries;

        if (state.currentTab === "previous-entries-tab" && window.renderSpreadsheet) {
            window.renderSpreadsheet();
        }

        if (currentEntries.length > 0) {
            const maxId = Math.max(...currentEntries.map(e => e.EntryID));
            if (lastKnownMaxEntryId > 0 && maxId > lastKnownMaxEntryId) {
                const newItems = currentEntries.filter(e => e.EntryID > lastKnownMaxEntryId);
                newItems.reverse().forEach(item => {
                    logActivity(item);
                });
            }
            lastKnownMaxEntryId = maxId;
        } else {
            lastKnownMaxEntryId = 0;
        }
    } catch (e) {
        console.warn("Polling failed:", e);
    }
}

export function logActivity(item) {
    const feed = document.getElementById("live-activity-feed");
    if (!feed) return;

    const placeholder = feed.querySelector(".no-activity");
    if (placeholder) placeholder.remove();

    const isSelf = state.currentUser && item.UserID === state.currentUser.userid;
    const timeStr = item.EntryTimestamp ? item.EntryTimestamp.split(' ')[1].substring(0, 5) : new Date().toLocaleTimeString().substring(0, 5);

    const activityDiv = document.createElement("div");
    activityDiv.className = `activity-item ${isSelf ? 'self' : ''}`;

    const label = isSelf ? "You" : item.Username;
    const firstLetter = item.Username ? item.Username.charAt(0).toUpperCase() : 'U';
    const uid = firstLetter + String(item.UserDailyCountID || 0).padStart(3, '0');

    activityDiv.innerHTML = `
        <span class="activity-text"><strong>${label}</strong> logged <strong>${uid}</strong> (${item.PLType} / ${item.Location})</span>
        <span class="activity-time">${timeStr}</span>
    `;

    feed.insertBefore(activityDiv, feed.firstChild);

    while (feed.children.length > 10) {
        feed.lastChild.remove();
    }
}

if (typeof window !== "undefined") {
    window.pollDatabaseForUpdates = pollDatabaseForUpdates;
    window.logActivity = logActivity;
}
