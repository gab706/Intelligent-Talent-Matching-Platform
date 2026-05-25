const themeToggleButton = document.querySelector("[data-theme-toggle]");

if (themeToggleButton) {
    const themeIcon = themeToggleButton.querySelector("i");

    const applyTheme = (theme) => {
        const normalisedTheme = theme?.toUpperCase?.();
        if (normalisedTheme === "DARK") {
            document.body.classList.add("dark-mode");

            themeIcon.classList.remove("fa-sun");
            themeIcon.classList.add("fa-moon");
        } else {
            document.body.classList.remove("dark-mode");

            themeIcon.classList.remove("fa-moon");
            themeIcon.classList.add("fa-sun");
        }
    };

    themeToggleButton.addEventListener("click", async () => {
        const isDarkMode =
            document.body.classList.contains("dark-mode");

        const nextTheme =
            isDarkMode
                ? "LIGHT"
                : "DARK";

        applyTheme(nextTheme);

        try {
            await fetch('/user/update-theme', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    theme: nextTheme
                })
            });
        } catch (err) {
            console.error(err);
        }
    });
}

const progressiveSearch = document.querySelector("[data-progressive-search]");

if (progressiveSearch) {
    const keywordInput = progressiveSearch.querySelector("#search-keywords");
    const locationInput = progressiveSearch.querySelector("#search-location");

    const updateSearchState = () => {
        const hasKeyword = keywordInput.value.trim().length > 0;
        const hasLocation = locationInput.value.trim().length > 0;

        progressiveSearch.classList.toggle("is-location-visible", hasKeyword);
        progressiveSearch.classList.toggle("is-submit-visible", hasKeyword && hasLocation);

        if (!hasKeyword) {
            locationInput.value = "";
        }
    };

    keywordInput.addEventListener("input", updateSearchState);
    locationInput.addEventListener("input", updateSearchState);

    updateSearchState();
}