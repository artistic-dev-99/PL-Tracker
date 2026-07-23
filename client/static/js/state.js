// Global Application State Module
const defaultApiUrl = (typeof window !== "undefined" && window.location && window.location.origin && window.location.origin !== "null" && !window.location.origin.startsWith("file://"))
    ? window.location.origin
    : "http://127.0.0.1:5000";

export const state = {
    serverIp: (typeof window !== "undefined" && window.location && window.location.hostname) || "127.0.0.1",
    serverPort: (typeof window !== "undefined" && window.location && window.location.port) || 5000,
    apiUrl: defaultApiUrl,
    currentUser: null,
    currentTab: "entry-form-tab",
    isOffline: false,
    pollerInterval: null,

    // Entry Form Tab Cache
    searchMode: false,
    searchResults: [],
    searchIndex: -1,
    activeEntryId: null,

    // Spreadsheet Tab Cache
    sheetEntries: [],
    selectedEntryIds: new Set(),
    quickFilter: "all",

    // Bulk Modifying Cache
    bulkEntries: [],
    bulkIndex: -1,
    bulkModifiedData: {}, // Map of entryID -> modified entry object

    // Settings
    confirmDelete: true,

    // Pagination Cache
    currentPage: 1,
    pageSize: 100,

    // Sorting Cache
    sortColumn: null,
    sortDirection: "asc" // 'asc' or 'desc'
};

if (typeof window !== "undefined") {
    window.appState = state;
}
