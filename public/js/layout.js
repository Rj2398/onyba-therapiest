// sidebat-toggle
function initSidebarToggle() {
    const toggleButton = document.getElementById('sidebarToggleBtn');
    const layoutWrapper = document.getElementById('dashboardLayout');

    if (toggleButton && layoutWrapper) {
        toggleButton.addEventListener('click', function () {
            layoutWrapper.classList.toggle('mini-sidebar');
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarToggle);
} else {
    initSidebarToggle();
}
// sidebat-toggle