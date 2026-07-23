// HTML Component Template Loader Service
export async function loadHtmlComponents() {
    const containers = document.querySelectorAll("[data-component]");
    const promises = Array.from(containers).map(async (container) => {
        const componentPath = container.getAttribute("data-component");
        if (!componentPath) return;
        try {
            const res = await fetch(componentPath);
            if (!res.ok) throw new Error(`HTTP error ${res.status} fetching ${componentPath}`);
            const html = await res.text();
            container.outerHTML = html;
        } catch (e) {
            console.error(`Failed to load HTML component ${componentPath}:`, e);
        }
    });

    await Promise.all(promises);
}
