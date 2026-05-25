const themeToggleButton = document.querySelector("[data-theme-toggle]");

if (themeToggleButton) {
    const themeIcon = themeToggleButton.querySelector("i");

    const applyTheme = (theme) => {
        if (theme === "dark") {
            document.body.classList.add("dark-mode");

            themeIcon.classList.remove("fa-sun");
            themeIcon.classList.add("fa-moon");
        } else {
            document.body.classList.remove("dark-mode");

            themeIcon.classList.remove("fa-moon");
            themeIcon.classList.add("fa-sun");
        }
    };

    const savedTheme = localStorage.getItem("theme") || "light";

    applyTheme(savedTheme);

    themeToggleButton.addEventListener("click", () => {
        const isDarkMode =
            document.body.classList.contains("dark-mode");

        const nextTheme = isDarkMode ? "light" : "dark";

        applyTheme(nextTheme);

        localStorage.setItem("theme", nextTheme);
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