/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
$(function () {
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

    const $themeToggleButton = $("[data-theme-toggle]");

    if ($themeToggleButton.length) {
        const $themeIcon = $themeToggleButton.find("i");

        const applyTheme = function (theme) {
            const normalisedTheme =
                String(theme || "LIGHT").toUpperCase() === "DARK"
                    ? "DARK"
                    : "LIGHT";

            $("body").toggleClass("dark-mode", normalisedTheme === "DARK");

            $themeIcon
                .removeClass("fa-sun fa-moon")
                .addClass(normalisedTheme === "DARK" ? "fa-moon" : "fa-sun");

            $themeToggleButton.attr(
                "aria-label",
                normalisedTheme === "DARK"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
            );

            return normalisedTheme;
        };

        $themeToggleButton.on("click", async function () {
            const nextTheme = $("body").hasClass("dark-mode")
                ? "LIGHT"
                : "DARK";

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

                if (!response.ok) {
                    throw new Error("Failed to update theme.");
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    const $loginForm = $(".login-page__form");

    if ($loginForm.length) {
        $loginForm.on("submit", async function (event) {
            event.preventDefault();

            const email = $("#email").val()?.toString().trim();
            const password = $("#password").val()?.toString();
            const remember = $("input[name='remember']").is(":checked");

            try {
                const response = await window.guardedFetch("/user/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        password,
                        remember
                    })
                });

                const data = await response.json();

                if (!data.success) {
                    toastr.error(data.message || "Invalid email or password.");
                    return;
                }

                if (data.redirectTo) {
                    window.location.href = data.redirectTo;
                }
            } catch (err) {
                console.error(err);
                toastr.error("An unexpected error occurred. Please try again.");
            }
        });
    }
});