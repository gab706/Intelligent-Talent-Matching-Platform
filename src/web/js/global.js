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