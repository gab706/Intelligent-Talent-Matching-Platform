/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
$(function () {
    if (typeof toastr !== "undefined") {
        toastr.options = {
            closeButton: true,
            progressBar: true,
            newestOnTop: true,
            preventDuplicates: true,
            positionClass: "toast-top-right"
        };
    }

    function showMessage(message, type) {
        if (typeof toastr !== "undefined" && toastr[type]) {
            toastr[type](message);
            return;
        }

        if (message)
            window.alert(message);
    }

    function updateCount() {
        const count = $("[data-notification-row]").length;
        $("[data-notification-count]").text(count);
        $("[data-notification-total]").text(count);
        $("[data-notification-empty]").prop("hidden", count > 0);
    }

    $("[data-notification-delete]").on("click", function () {
        const $button = $(this);
        const notificationId = String($button.attr("data-notification-delete") || "");

        if (!notificationId || $button.prop("disabled"))
            return;

        $button.prop("disabled", true);

        window.guardedFetch("/admin/notification-delete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                notificationId
            })
        }).then(response => response.json()).then(response => {
            if (!response || !response.success) {
                showMessage(response && response.message ? response.message : "Could not delete notification.", "error");
                return;
            }

            $(`[data-notification-row="${notificationId}"]`).remove();
            updateCount();
            showMessage(response.message || "Notification deleted.", "success");
        }).catch(err => {
            console.error(err);
            showMessage(window.getRequestErrorMessage(err, "Could not delete notification."), "error");
        }).finally(() => {
            $button.prop("disabled", false);
        });
    });
});
