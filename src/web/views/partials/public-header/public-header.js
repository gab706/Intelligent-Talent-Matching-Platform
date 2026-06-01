$(async function () {
    const $themeToggleButton = $("[data-theme-toggle]");
    const $dropdownTriggers = $("[data-public-dropdown]");
    const $helpModal = $("[data-help-modal]");
    const $helpOpenButton = $("[data-help-open]");
    const $helpCloseButtons = $("[data-help-close]");
    const $publicHeader = $(".public-header");
    const $mobileMenuToggle = $("[data-mobile-menu-toggle]");
    const $dropdownItems = $(".public-header__link-item--dropdown");
    const mobileMenuQuery = window.matchMedia("(max-width: 980px)");

    const updateHeaderScrollState = function () {
        $publicHeader.toggleClass("is-scrolled", window.scrollY > 16);
    };

    $(window).on("scroll", updateHeaderScrollState);
    updateHeaderScrollState();

    const closeDropdowns = function () {
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

    const openDropdown = function ($item) {
        closeDropdowns();
        $item.addClass("is-open");
        $item.find("[data-public-dropdown]").attr("aria-expanded", "true");
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

        closeDropdowns();
    });

    $(document).on("click", function () {
        closeDropdowns();
        closeMobileMenu();
    });

    $(".public-header__menu").on("click", function (event) {
        event.stopPropagation();
    });

    $("[data-public-dropdown-menu]").on("click", function (event) {
        event.stopPropagation();
    });

    $(".public-header__dropdown-link, .public-header__link:not(.public-header__dropdown-trigger)").on("click", function () {
        closeMobileMenu();
        closeDropdowns();
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

    $(document).on("keydown", function (event) {
        if (event.key === "Escape") {
            closeDropdowns();
            closeMobileMenu();
            closeHelpModal();
        }
    });

    if ($themeToggleButton.length) {
        const $themeIcon = $themeToggleButton.find("i");

        const applyTheme = function (theme) {
            const normalisedTheme =
                String(theme || "LIGHT").toUpperCase() === "DARK"
                    ? "DARK"
                    : "LIGHT";

            $("body").toggleClass("dark-mode", normalisedTheme === "DARK");

            $themeIcon
                .removeClass("fas fa-sun fa-moon")
                .addClass("fas")
                .addClass(normalisedTheme === "DARK" ? "fa-moon" : "fa-sun");

            $themeToggleButton.attr(
                "aria-label",
                normalisedTheme === "DARK"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
            );
        };

        $themeToggleButton.on("click", async function () {
            const isDarkMode = $("body").hasClass("dark-mode");
            const nextTheme = isDarkMode ? "LIGHT" : "DARK";

            applyTheme(nextTheme);

            try {
                const response = await fetch("/user/update-theme", {
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
        });
    }
});
