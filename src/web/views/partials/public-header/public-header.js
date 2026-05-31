$(async function () {
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