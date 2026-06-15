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
            positionClass: "toast-top-right",
            timeOut: 5000,
            extendedTimeOut: 1500,
            showDuration: 200,
            hideDuration: 200,
            showMethod: "fadeIn",
            hideMethod: "fadeOut"
        };
    }

    const params = new URLSearchParams(window.location.search);
    const accountType = params.get("type");

    if (accountType === "candidate") {
        window.location.replace("/candidate/register");
        return;
    }

    if (accountType === "employer") {
        window.location.replace("/employer/register");
    }

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

    const $registerForm = $("[data-register-form]");

    if (!$registerForm.length) {
        return;
    }

    const $steps = $registerForm.find("[data-register-step]");
    const $progress = $("[data-register-progress]");
    const $backButton = $registerForm.find("[data-register-back]");
    const $nextButton = $registerForm.find("[data-register-next]");
    let currentStep = 0;

    const showError = function (message) {
        if (typeof toastr !== "undefined") {
            toastr.error(message);
            return;
        }

        window.alert(message);
    };

    const updateStep = function () {
        $steps.removeClass("is-active");
        $steps.eq(currentStep).addClass("is-active");

        $progress.each(function (index) {
            $(this)
                .toggleClass("is-active", index === currentStep)
                .toggleClass("is-complete", index < currentStep);
        });

        $backButton
            .prop("disabled", currentStep === 0)
            .prop("hidden", currentStep === 0);
        $nextButton
            .attr("type", currentStep === $steps.length - 1 ? "submit" : "button")
            .text(currentStep === $steps.length - 1 ? "Create" : "Next");
    };

    const resetRegisterForm = function () {
        $registerForm[0].reset();
        currentStep = 0;
        updateStep();
    };

    const validateCurrentStep = function () {
        const $currentInputs = $steps.eq(currentStep).find("input[required]");

        for (const input of $currentInputs) {
            const $input = $(input);
            const value = String($input.val() || "").trim();
            const label = $input.closest(".register-candidate__field").find("> span:first").text().trim();

            if (!value) {
                showError(`${label} is required.`);
                input.focus();
                return false;
            }

            if (input.type === "email" && !input.checkValidity()) {
                showError("Please enter a valid email address.");
                input.focus();
                return false;
            }
        }

        if (currentStep === $steps.length - 1) {
            const password = String($registerForm.find("[data-register-field='password']").val() || "");
            const confirmPassword = String($registerForm.find("[data-register-field='confirm_password']").val() || "");

            if (password.length < 8) {
                showError("Password must be at least 8 characters.");
                $registerForm.find("[data-register-field='password']").trigger("focus");
                return false;
            }

            if (password !== confirmPassword) {
                showError("Passwords do not match.");
                $registerForm.find("[data-register-field='confirm_password']").trigger("focus");
                return false;
            }
        }

        return true;
    };

    $nextButton.on("click", function () {
        if (currentStep === $steps.length - 1) {
            return;
        }

        if (!validateCurrentStep()) {
            return;
        }

        currentStep = Math.min(currentStep + 1, $steps.length - 1);
        updateStep();
    });

    $backButton.on("click", function () {
        currentStep = Math.max(currentStep - 1, 0);
        updateStep();
    });

    $registerForm.on("submit", async function (event) {
        event.preventDefault();

        if (!validateCurrentStep()) {
            return;
        }

        const payload = {
            account_type: Number($registerForm.data("register-account-type")),
            email: String($registerForm.find("[data-register-field='email']").val() || "").trim(),
            phone: String($registerForm.find("[data-register-field='phone']").val() || "").trim(),
            first_name: String($registerForm.find("[data-register-field='first_name']").val() || "").trim(),
            last_name: String($registerForm.find("[data-register-field='last_name']").val() || "").trim(),
            password: String($registerForm.find("[data-register-field='password']").val() || ""),
            confirm_password: String($registerForm.find("[data-register-field='confirm_password']").val() || "")
        };

        $nextButton.prop("disabled", true).text("Creating...");
        $backButton.prop("disabled", true);

        try {
            const response = await window.guardedFetch("/user/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                showError(data.message || "Unable to create your account.");
                resetRegisterForm();
                return;
            }

            window.location.href = data.redirectTo || $registerForm.data("register-redirect") || "/candidate/home";
        } catch (err) {
            console.error(err);
            showError("An unexpected error occurred. Please try again.");
            resetRegisterForm();
        } finally {
            $nextButton.prop("disabled", false);
            $backButton
                .prop("disabled", currentStep === 0)
                .prop("hidden", currentStep === 0);
            updateStep();
        }
    });

    updateStep();
});
