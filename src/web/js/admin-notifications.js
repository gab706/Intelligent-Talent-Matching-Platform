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

        $.post("/admin/notification-delete", {
            notificationId
        }).done(response => {
            if (!response || !response.success) {
                showMessage(response && response.message ? response.message : "Could not delete notification.", "error");
                return;
            }

            $(`[data-notification-row="${notificationId}"]`).remove();
            updateCount();
            showMessage(response.message || "Notification deleted.", "success");
        }).fail(() => {
            showMessage("Could not delete notification.", "error");
        }).always(() => {
            $button.prop("disabled", false);
        });
    });
});
