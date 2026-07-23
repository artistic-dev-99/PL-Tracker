// PyWebView Native Bridge Integration
import { state } from './state.js';
import { updateApiUrl } from './utils/domUtils.js';

export function initPyWebViewBridge(onConnectionCheck) {
    if (window.pywebview) {
        onWebViewReady(onConnectionCheck);
    } else {
        window.addEventListener("pywebviewready", () => onWebViewReady(onConnectionCheck));
    }

    setTimeout(() => {
        if (!window.pywebview) {
            console.warn("Running in Web Debug Mode - No Native Bridge");
            if (typeof onConnectionCheck === "function") onConnectionCheck();
        }
    }, 1000);
}

function onWebViewReady(onConnectionCheck) {
    console.log("Native PyWebView bridge loaded successfully.");
    if (window.pywebview && window.pywebview.api && window.pywebview.api.get_config) {
        window.pywebview.api.get_config().then(config => {
            if (config) {
                state.serverIp = config.server_ip || state.serverIp;
                state.serverPort = config.server_port || state.serverPort;
            }
            updateApiUrl();
            if (typeof onConnectionCheck === "function") onConnectionCheck();
        });
    } else {
        if (typeof onConnectionCheck === "function") onConnectionCheck();
    }
}
