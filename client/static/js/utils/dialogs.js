// Generic Confirmation Dialog Wrappers
export const confirmDialog = {
    show({ title, message, confirmLabel = "Confirm", variant = "danger", dontShowKey = null, onConfirm, onCancel }) {
        if (dontShowKey && localStorage.getItem(dontShowKey) === "true") {
            if (typeof onConfirm === "function") onConfirm();
            return;
        }

        const modal = document.getElementById("confirm-modal");
        if (!modal) {
            if (typeof onConfirm === "function") onConfirm();
            return;
        }

        const titleEl = modal.querySelector("h2");
        if (titleEl) titleEl.innerText = title || "Confirm Action";

        const msgEl = document.getElementById("confirm-msg");
        if (msgEl) msgEl.innerText = message || "Are you sure?";

        const yesBtn = document.getElementById("confirm-yes-btn");
        if (yesBtn) {
            yesBtn.innerText = confirmLabel;
            yesBtn.className = `${variant}-btn px-4`;
        }

        const checkboxWrapper = modal.querySelector(".form-row.justify-center");
        if (checkboxWrapper) {
            if (dontShowKey) {
                checkboxWrapper.style.display = "flex";
                const checkbox = document.getElementById("confirm-dont-show");
                if (checkbox) checkbox.checked = false;
            } else {
                checkboxWrapper.style.display = "none";
            }
        }

        modal.classList.remove("hidden");

        if (yesBtn) {
            yesBtn.onclick = () => {
                modal.classList.add("hidden");
                if (dontShowKey) {
                    const checkbox = document.getElementById("confirm-dont-show");
                    if (checkbox && checkbox.checked) {
                        localStorage.setItem(dontShowKey, "true");
                    }
                }
                if (typeof onConfirm === "function") onConfirm();
            };
        }

        const noBtn = document.getElementById("confirm-no-btn");
        if (noBtn) {
            noBtn.onclick = () => {
                modal.classList.add("hidden");
                if (typeof onCancel === "function") onCancel();
            };
        }
    }
};

export const adminConfirmDialog = {
    show({ onConfirm, onCancel }) {
        const modal = document.getElementById("admin-confirm-modal");
        if (!modal) {
            if (typeof onConfirm === "function") onConfirm("");
            return;
        }

        const passwordInput = document.getElementById("admin-confirm-password-input");
        if (passwordInput) {
            passwordInput.value = "";
        }

        const yesBtn = document.getElementById("admin-confirm-yes-btn");
        const noBtn = document.getElementById("admin-confirm-no-btn");

        modal.classList.remove("hidden");
        if (passwordInput) {
            passwordInput.focus();
        }

        const handleConfirm = () => {
            const password = passwordInput ? passwordInput.value : "";
            modal.classList.add("hidden");
            cleanup();
            if (typeof onConfirm === "function") onConfirm(password);
        };

        const handleCancel = () => {
            modal.classList.add("hidden");
            cleanup();
            if (typeof onCancel === "function") onCancel();
        };

        const handleKeyPress = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
            }
        };

        const cleanup = () => {
            if (yesBtn) yesBtn.onclick = null;
            if (noBtn) noBtn.onclick = null;
            if (passwordInput) {
                passwordInput.removeEventListener("keydown", handleKeyPress);
            }
        };

        if (yesBtn) yesBtn.onclick = handleConfirm;
        if (noBtn) noBtn.onclick = handleCancel;
        if (passwordInput) {
            passwordInput.addEventListener("keydown", handleKeyPress);
        }
    }
};

if (typeof window !== "undefined") {
    window.confirmDialog = confirmDialog;
    window.adminConfirmDialog = adminConfirmDialog;
}
