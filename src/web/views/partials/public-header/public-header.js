/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
$(async function () {
    const $themeToggleButton = $("[data-theme-toggle]");
    const $dropdownTriggers = $("[data-public-dropdown]");
    const $helpModal = $("[data-help-modal]");
    const $helpOpenButton = $("[data-help-open]");
    const $helpCloseButtons = $("[data-help-close]");
    const $profileModal = $("[data-profile-modal]");
    const $profileOpenButtons = $("[data-profile-open]");
    const $profileCloseButtons = $("[data-profile-close]");
    const $profileForm = $("[data-profile-form]");
    const $profileAvatarInput = $("[data-profile-avatar-input]");
    const $profileAvatarPreview = $("[data-profile-avatar-preview]");
    const $publicHeader = $(".public-header");
    const $impersonationBanner = $("[data-impersonation-banner]");
    const $impersonationPin = $("[data-impersonation-pin]");
    const $mobileMenuToggle = $("[data-mobile-menu-toggle]");
    const $dropdownItems = $(".public-header__link-item--dropdown");
    const mobileMenuQuery = window.matchMedia("(max-width: 980px)");
    let dropdownCloseTimer = null;

    const updateHeaderScrollState = function () {
        $publicHeader.toggleClass("is-scrolled", window.scrollY > 16);
    };

    $(window).on("scroll", updateHeaderScrollState);
    updateHeaderScrollState();

    if ($impersonationBanner.length) {
        const storageKey = "talentmatch.impersonationBannerMinimised";
        const isMinimised = window.localStorage.getItem(storageKey) === "true";

        $impersonationBanner.toggleClass("is-minimised", isMinimised);
        $impersonationPin.attr("aria-label", isMinimised ? "Expand impersonation banner" : "Minimise impersonation banner");

        $impersonationPin.on("click", function () {
            const nextMinimised = !$impersonationBanner.hasClass("is-minimised");
            $impersonationBanner.toggleClass("is-minimised", nextMinimised);
            window.localStorage.setItem(storageKey, String(nextMinimised));
            $impersonationPin.attr("aria-label", nextMinimised ? "Expand impersonation banner" : "Minimise impersonation banner");
        });
    }

    const clearDropdownCloseTimer = function () {
        if (!dropdownCloseTimer)
            return;

        window.clearTimeout(dropdownCloseTimer);
        dropdownCloseTimer = null;
    };

    const closeDropdowns = function () {
        clearDropdownCloseTimer();

        $dropdownTriggers.each(function () {
            $(this)
                .attr("aria-expanded", "false")
                .closest(".public-header__link-item--dropdown")
                .removeClass("is-open");
        });

        if (
            document.activeElement &&
            $(document.activeElement).is("[data-public-dropdown]")
        ) {
            document.activeElement.blur();
        }
    };

    const closeOtherDropdowns = function ($activeItem) {
        $dropdownItems.not($activeItem).each(function () {
            $(this)
                .removeClass("is-open")
                .find("[data-public-dropdown]")
                .attr("aria-expanded", "false");
        });
    };

    const openDropdown = function ($item) {
        clearDropdownCloseTimer();
        closeOtherDropdowns($item);
        $item.addClass("is-open");
        $item.find("[data-public-dropdown]").attr("aria-expanded", "true");
    };

    const scheduleDropdownClose = function ($item) {
        clearDropdownCloseTimer();

        dropdownCloseTimer = window.setTimeout(function () {
            if ($item.is(":hover") || $item.find("*:hover").length)
                return;

            closeDropdowns();
        }, 180);
    };

    const closeMobileMenu = function () {
        $publicHeader.removeClass("is-mobile-menu-open");
        $mobileMenuToggle
            .attr("aria-expanded", "false")
            .attr("aria-label", "Open navigation menu")
            .find("i")
            .removeClass("fa-times")
            .addClass("fa-bars");
    };

    const openMobileMenu = function () {
        $publicHeader.addClass("is-mobile-menu-open");
        $mobileMenuToggle
            .attr("aria-expanded", "true")
            .attr("aria-label", "Close navigation menu")
            .find("i")
            .removeClass("fa-bars")
            .addClass("fa-times");
    };

    $mobileMenuToggle.on("click", function (event) {
        event.stopPropagation();

        if ($publicHeader.hasClass("is-mobile-menu-open")) {
            closeMobileMenu();
            closeDropdowns();
        } else {
            openMobileMenu();
        }
    });

    $dropdownTriggers.on("click", function (event) {
        event.stopPropagation();

        const $trigger = $(this);
        const $item = $trigger.closest(".public-header__link-item--dropdown");
        const isOpen = $item.hasClass("is-open");

        if (isOpen) {
            closeDropdowns();
        } else {
            openDropdown($item);
        }
    });

    $dropdownItems.on("mouseenter", function () {
        if (mobileMenuQuery.matches)
            return;

        openDropdown($(this));
    });

    $dropdownItems.on("mouseleave", function () {
        if (mobileMenuQuery.matches)
            return;

        scheduleDropdownClose($(this));
    });

    $("[data-public-dropdown-menu], [data-public-dropdown]").on("mouseenter", function () {
        clearDropdownCloseTimer();
    });

    $(document).on("click", function () {
        closeDropdowns();
        closeMobileMenu();
    });

    $(".public-header__menu").on("click", function (event) {
        event.stopPropagation();
    });

    const openHelpModal = function () {
        closeMobileMenu();
        closeDropdowns();
        $helpModal.addClass("is-open").attr("aria-hidden", "false");
        $("body").addClass("is-help-modal-open");
        $helpModal.find("[data-help-close]").first().trigger("focus");
    };

    const closeHelpModal = function () {
        $helpModal.removeClass("is-open").attr("aria-hidden", "true");
        $("body").removeClass("is-help-modal-open");
    };

    $helpOpenButton.on("click", openHelpModal);
    $helpCloseButtons.on("click", closeHelpModal);

    const showMessage = function (message, type = "error") {
        if (window.toastr && typeof window.toastr[type] === "function") {
            window.toastr[type](message);
            return;
        }

        window.alert(message);
    };

    const openProfileModal = function () {
        closeMobileMenu();
        closeDropdowns();
        $profileModal.addClass("is-open").attr("aria-hidden", "false");
        $("body").addClass("is-profile-modal-open");
        $profileModal.find("[data-profile-close]").first().trigger("focus");
    };

    const closeProfileModal = function () {
        $profileModal.removeClass("is-open").attr("aria-hidden", "true");
        $("body").removeClass("is-profile-modal-open");
    };

    $profileOpenButtons.on("click", openProfileModal);
    $profileCloseButtons.on("click", closeProfileModal);

    $profileAvatarInput.on("change", function () {
        const file = this.files && this.files[0];

        if (!file)
            return;

        $profileAvatarPreview.attr("src", URL.createObjectURL(file));
    });

    $profileForm.on("submit", async function (event) {
        event.preventDefault();

        const $saveButton = $profileForm.find("[data-profile-save]");
        const formData = new FormData(this);

        $saveButton.prop("disabled", true).text("Saving...");

        try {
            const response = await window.guardedFetch("/user/profile", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                showMessage(data.message || "Unable to save your profile.");
                return;
            }

            closeProfileModal();
            window.location.reload();
        } catch (err) {
            console.error(err);
            showMessage("An unexpected error occurred. Please try again.");
        } finally {
            $saveButton.prop("disabled", false).text("Save");
        }
    });

    const renderEmptyNotifications = function () {
        $("[data-notification-list]").html(
            '<p class="public-header__notification-empty">No Notifications From The Last 7 Days</p>'
        );
        $("[data-notification-badge]").remove();
        $("[data-notification-actions]").html(
            '<span class="public-header__notification-action is-disabled" aria-disabled="true" data-notification-clear-all-disabled>Clear all</span>' +
            '<span class="public-header__notification-action is-disabled" aria-disabled="true" data-notification-read-all-disabled>Mark all as read</span>'
        );
    };

    const updateNotificationBadge = function (unreadCount) {
        const normalisedCount = Number(unreadCount) || 0;
        const $toggle = $(".public-header__notification-toggle");
        const $badge = $("[data-notification-badge]");

        if (normalisedCount <= 0) {
            $badge.remove();
            return;
        }

        if ($badge.length) {
            $badge.text(normalisedCount);
            return;
        }

        $toggle.append(
            '<span class="public-header__notification-badge" data-notification-badge>' +
                normalisedCount +
                '</span>'
        );
    };

    const markNotificationsRead = async function (payload) {
        const response = await window.guardedFetch("/user/notification-read", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.success)
            throw new Error(data.message || "Unable to update notifications.");

        return data;
    };

    const clearNotifications = async function () {
        const response = await window.guardedFetch("/user/notification-clear", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                all: true
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success)
            throw new Error(data.message || "Unable to clear notifications.");

        return data;
    };

    $("[data-public-dropdown-menu]").on("click", "[data-notification-read]", async function (event) {
        event.preventDefault();
        event.stopPropagation();

        const $notification = $(this);
        const notificationId = $notification.data("notification-id");

        if (!notificationId || $notification.prop("disabled"))
            return;

        $notification.prop("disabled", true);

        try {
            const data = await markNotificationsRead({
                notificationId
            });

            const unreadCount = Number(data.unreadCount) || 0;

            updateNotificationBadge(unreadCount);
            $notification
                .removeAttr("data-notification-read")
                .removeAttr("data-notification-id")
                .removeClass("public-header__notification-item--unread")
                .addClass("public-header__notification-item--read")
                .prop("disabled", true);

            if (!$("[data-notification-read]").length)
                $("[data-notification-read-all]")
                    .replaceWith(
                        '<span class="public-header__notification-action is-disabled" aria-disabled="true" data-notification-read-all-disabled>Mark all as read</span>'
                    );
        } catch (err) {
            console.error(err);
            $notification.prop("disabled", false);
            showMessage(err.message || "Unable to update notifications.");
        }
    });

    $("[data-public-dropdown-menu]").on("click", "[data-notification-read-all]", async function (event) {
        event.preventDefault();
        event.stopPropagation();

        const $readAll = $(this);

        if ($readAll.hasClass("is-disabled"))
            return;

        $readAll.addClass("is-disabled").attr("aria-disabled", "true");

        try {
            await markNotificationsRead({
                all: true
            });

            updateNotificationBadge(0);
            $("[data-notification-read]")
                .removeAttr("data-notification-read")
                .removeAttr("data-notification-id")
                .removeClass("public-header__notification-item--unread")
                .addClass("public-header__notification-item--read")
                .prop("disabled", true);
            $readAll.replaceWith(
                '<span class="public-header__notification-action is-disabled" aria-disabled="true" data-notification-read-all-disabled>Mark all as read</span>'
            );
        } catch (err) {
            console.error(err);
            $readAll.removeClass("is-disabled").removeAttr("aria-disabled");
            showMessage(err.message || "Unable to update notifications.");
        }
    });

    $("[data-public-dropdown-menu]").on("click", "[data-notification-clear-all]", async function (event) {
        event.preventDefault();
        event.stopPropagation();

        const $clearAll = $(this);

        if ($clearAll.hasClass("is-disabled"))
            return;

        $clearAll.addClass("is-disabled").attr("aria-disabled", "true");

        try {
            await clearNotifications();
            renderEmptyNotifications();
        } catch (err) {
            console.error(err);
            $clearAll.removeClass("is-disabled").removeAttr("aria-disabled");
            showMessage(err.message || "Unable to clear notifications.");
        }
    });

    $("[data-public-dropdown-menu]").on("click", function (event) {
        event.stopPropagation();
    });

    $(".public-header__dropdown-link:not([data-profile-open]), .public-header__link:not(.public-header__dropdown-trigger)").on("click", function () {
        closeMobileMenu();
        closeDropdowns();
    });

    $(document).on("keydown", function (event) {
        if (event.key === "Escape") {
            closeDropdowns();
            closeMobileMenu();
            closeHelpModal();
        }
    });

    if ($themeToggleButton.length) {
        const applyTheme = function (theme) {
            const normalisedTheme =
                String(theme || "LIGHT").toUpperCase() === "DARK"
                    ? "DARK"
                    : "LIGHT";

            $("body").toggleClass("dark-mode", normalisedTheme === "DARK");

            $themeToggleButton.each(function () {
                const $toggle = $(this);

                if ($toggle.is("input[type='checkbox']")) {
                    $toggle.prop("checked", normalisedTheme === "DARK");
                    return;
                }

                $toggle
                    .attr(
                        "aria-label",
                        normalisedTheme === "DARK"
                            ? "Switch to light mode"
                            : "Switch to dark mode"
                    )
                    .find("i")
                    .removeClass("fas fa-sun fa-moon")
                    .addClass("fas")
                    .addClass(normalisedTheme === "DARK" ? "fa-moon" : "fa-sun");
            });
        };

        const persistTheme = async function (nextTheme) {
            applyTheme(nextTheme);

            try {
                const response = await window.guardedFetch("/user/update-theme", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        theme: nextTheme
                    })
                });

                if (!response.ok)
                    new Error("Failed to update theme.");
            } catch (err) {
                console.error(err);
            }
        };

        $themeToggleButton.filter("button").on("click", async function () {
            const isDarkMode = $("body").hasClass("dark-mode");
            await persistTheme(isDarkMode ? "LIGHT" : "DARK");
        });

        $themeToggleButton.filter("input[type='checkbox']").on("change", async function () {
            await persistTheme($(this).is(":checked") ? "DARK" : "LIGHT");
        });
    }
});
