/**
 * UI Manager - Flappy Bird Online Multiplayer
 * Handles HUD layout configuration, transparent overlays, and UI element positioning.
 */

window.UIManager = {
    /**
     * Configure transparent HUD layout and ensure exit button is anchored top-right
     */
    setupHUD() {
        const hudContainer = document.getElementById("hud");
        const mapProgressPanel = document.getElementById("hud-map-progress");
        const exitBtn = document.getElementById("btn-in-game-exit");

        if (hudContainer) {
            hudContainer.style.background = "transparent";
            hudContainer.style.border = "none";
        }

        if (mapProgressPanel) {
            mapProgressPanel.style.background = "transparent";
            mapProgressPanel.style.border = "none";
            mapProgressPanel.style.boxShadow = "none";
        }

        if (exitBtn && exitBtn.parentElement) {
            exitBtn.parentElement.style.marginLeft = "auto";
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.UIManager.setupHUD();
});
