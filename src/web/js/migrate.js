$(function () {
    if (typeof toastr !== "undefined") {
        toastr.options = {
            closeButton: true,
            progressBar: true,
            newestOnTop: true,
            preventDuplicates: true,
            positionClass: "toast-top-right",
            timeOut: 5000,
            extendedTimeOut: 1500,
            showDuration: 200,
            hideDuration: 200,
            showMethod: "fadeIn",
            hideMethod: "fadeOut"
        };
    }

    const $modal = $("[data-migrate-modal]");
    const $openButton = $("[data-migrate-open]");
    const $confirmButton = $("[data-migrate-confirm]");
    const $closeButtons = $("[data-migrate-close]");

    if (!$modal.length) {
        return;
    }

    const showError = function (message) {
        if (typeof toastr !== "undefined") {
            toastr.error(message);
            return;
        }

        window.alert(message);
    };

    const openModal = function () {
        $modal.addClass("is-open").attr("aria-hidden", "false");
        $confirmButton.trigger("focus");
    };

    const closeModal = function () {
        $modal.removeClass("is-open").attr("aria-hidden", "true");
        $openButton.trigger("focus");
    };

    $openButton.on("click", openModal);
    $closeButtons.on("click", closeModal);

    $(document).on("keydown", function (event) {
        if (event.key === "Escape" && $modal.hasClass("is-open")) {
            closeModal();
        }
    });

    $confirmButton.on("click", async function () {
        const mode = String($(this).data("migrate-mode") || "");

        $confirmButton.prop("disabled", true).text("Migrating...");

        try {
            const response = await fetch("/user/migrate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    mode
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                showError(data.message || "Unable to migrate your account.");
                return;
            }

            if (typeof toastr !== "undefined") {
                toastr.success(data.message || "Account migrated successfully.");
            }

            window.location.href = data.redirectTo || "/candidate/home";
        } catch (err) {
            console.error(err);
            showError("An unexpected error occurred. Please try again.");
        } finally {
            $confirmButton.prop("disabled", false).text("Confirm migration");
        }
    });
});
