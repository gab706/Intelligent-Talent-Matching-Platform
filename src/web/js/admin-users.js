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

    $("[data-user-status-toggle]").on("click", function () {
        const $button = $(this);
        const userId = String($button.attr("data-user-status-toggle") || "");
        const userName = String($button.attr("data-user-name") || "this user");

        if (!userId || $button.prop("disabled"))
            return;

        $button.prop("disabled", true);

        $.post("/admin/user-status", {
            userId
        }).done(response => {
            if (!response || !response.success) {
                showMessage(response && response.message ? response.message : "Could not update user status.", "error");
                return;
            }

            const isSuspended = Boolean(response.isSuspended);
            $button
                .attr("data-is-suspended", isSuspended ? "true" : "false")
                .attr("aria-label", `${isSuspended ? "Unlock" : "Lock"} account for ${userName}`);
            $button.find("i")
                .toggleClass("fa-lock", !isSuspended)
                .toggleClass("fa-unlock", isSuspended);
            showMessage(response.message || "User status updated.", "success");
        }).fail(() => {
            showMessage("Could not update user status.", "error");
        }).always(() => {
            $button.prop("disabled", false);
        });
    });
});
