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

        updateSearchState();
    }
});
