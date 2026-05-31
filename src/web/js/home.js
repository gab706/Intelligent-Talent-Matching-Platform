$(function () {
    const $progressiveSearch = $("[data-progressive-search]");

    if (!$progressiveSearch.length) {
        return;
    }

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
});