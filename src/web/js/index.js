$(function () {
    const $slider = $("[data-home-slider]");
    const $progressiveSearch = $("[data-progressive-search]");

    if ($slider.length) {
        const $slides = $slider.find(".home-hero__slide");
        const $indicators = $(".home-hero__indicator");
        let activeIndex = 0;
        let slideTimer;

        const showSlide = function (index) {
            activeIndex = (index + $slides.length) % $slides.length;

            $slides.removeClass("is-active").eq(activeIndex).addClass("is-active");
            $indicators.removeClass("is-active").eq(activeIndex).addClass("is-active");
        };

        const startSlider = function () {
            clearInterval(slideTimer);
            slideTimer = setInterval(function () {
                showSlide(activeIndex + 1);
            }, 6200);
        };

        $indicators.on("click", function () {
            const nextIndex = Number($(this).attr("data-slide-index"));

            if (!Number.isNaN(nextIndex)) {
                showSlide(nextIndex);
                startSlider();
            }
        });

        startSlider();
    }

    if ($progressiveSearch.length) {
        const $keywordInput = $progressiveSearch.find("#home-search-keywords");
        const $locationInput = $progressiveSearch.find("#home-search-location");
        const isAuthenticated = String($progressiveSearch.attr("data-authenticated") || "") === "true";
        const accountType = Number($progressiveSearch.attr("data-account-type") || 0);

        const updateSearchState = function () {
            const hasKeyword = String($keywordInput.val() || "").trim().length > 0;
            const hasLocation = String($locationInput.val() || "").trim().length > 0;

            $progressiveSearch.toggleClass("is-location-visible", hasKeyword);
            $progressiveSearch.toggleClass("is-submit-visible", hasKeyword && hasLocation);

            if (!hasKeyword) {
                $locationInput.val("");
            }
        };

        $keywordInput.on("input", updateSearchState);
        $locationInput.on("input", updateSearchState);

        $progressiveSearch.on("submit", function (event) {
            event.preventDefault();

            if (!isAuthenticated) {
                window.location.href = "/candidate/register";
                return;
            }

            if (accountType === 2) {
                window.location.href = "/employer/migrate";
                return;
            }

            const params = new URLSearchParams();
            const keyword = String($keywordInput.val() || "").trim();
            const location = String($locationInput.val() || "").trim();

            if (keyword)
                params.set("keyword", keyword);
            if (location)
                params.set("location", location);

            window.location.href = `/candidate/find-a-job${params.toString() ? `?${params.toString()}` : ""}`;
        });

        updateSearchState();
    }
});
