// Live Database Updates Poller Service
import { state } from './state.js';

export function startLivePoller() {
    if (state.pollerInterval) return;
    state.pollerInterval = setInterval(() => {
        if (!state.isOffline && !document.hidden) {
            if (window.pollDatabaseForUpdates) {
                window.pollDatabaseForUpdates();
            }
        }
    }, 5000);
}

export function stopLivePoller() {
    if (state.pollerInterval) {
        clearInterval(state.pollerInterval);
        state.pollerInterval = null;
    }
}

if (typeof window !== "undefined") {
    window.startLivePoller = startLivePoller;
    window.stopLivePoller = stopLivePoller;

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopLivePoller();
        } else {
            startLivePoller();
        }
    });
}
