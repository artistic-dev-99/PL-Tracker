// PL Tracker — Clean Application Entry Point
import { initApp } from './js/main.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
    });
} else {
    initApp();
}
