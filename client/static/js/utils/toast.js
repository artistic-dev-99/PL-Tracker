// Toast Notification Manager Module
export const toast = {
    show(message, type = "info", duration = 3000) {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const el = document.createElement("div");
        el.className = `toast-item toast-${type} fade-in`;
        el.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close-btn" style="outline: none;">&times;</button>
        `;

        container.appendChild(el);

        const closeBtn = el.querySelector(".toast-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                el.remove();
            });
        }

        setTimeout(() => {
            if (el.parentNode) {
                el.classList.add("fade-out");
                setTimeout(() => el.remove(), 250);
            }
        }, duration);
    },
    success(msg) { this.show(msg, "success"); },
    error(msg) { this.show(msg, "error"); },
    warning(msg) { this.show(msg, "warning"); },
    info(msg) { this.show(msg, "info"); }
};

if (typeof window !== "undefined") {
    window.toast = toast;
}
