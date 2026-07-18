// Closes the header account/burger popup menu ("G | Menu", element uid below)
// when the user clicks anywhere outside of it. The menu itself has no
// click-outside behavior built into its WeWeb interactions, only close
// buttons/links inside it.
const PANEL_UID = '2866c5dd-08c4-415e-90f2-af3d30fef11c';
const TRIGGER_UID = 'd3ca430f-4074-40e2-b8ae-b5e4d1ea9cf1';
const SHOW_MENU_VARIABLE_ID = '607f8472-91ba-4f65-979a-1d9d788d8fd1';

export function initHeaderMenuOutsideClick() {
    document.addEventListener('click', event => {
        const panel = document.querySelector(`[data-ww-uid="${PANEL_UID}"]`);
        if (!panel) return;

        const trigger = document.querySelector(`[data-ww-uid="${TRIGGER_UID}"]`);
        if (panel.contains(event.target) || (trigger && trigger.contains(event.target))) return;

        window.wwLib?.wwVariable?.updateValue(SHOW_MENU_VARIABLE_ID, false);
    });
}
