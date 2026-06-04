$(function () {
    const $search = $("[data-company-search]");
    const $clear = $("[data-company-search-clear]");
    const $items = $("[data-company-item]");
    const $count = $("[data-company-count]");
    const $filteredEmpty = $("[data-company-filter-empty]");
    const $pagination = $("[data-company-pagination]");
    const perPage = 10;
    let currentPage = 1;
    let matchedItems = [];

    if (!$search.length || !$items.length) {
        return;
    }

    const total = Number($count.data("company-total")) || $items.length;

    const normalise = function (value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    };

    const renderPagination = function (pageCount) {
        $pagination.empty();

        for (let page = 1; page <= pageCount; page += 1) {
            const $button = $("<button>", {
                type: "button",
                class: "companies-page__page-button",
                text: String(page),
                "aria-label": `Go to company page ${page}`,
                "data-company-page": page
            });

            $button.toggleClass("is-active", page === currentPage);
            $button.attr("aria-current", page === currentPage ? "page" : null);
            $pagination.append($button);
        }
    };

    const renderCurrentPage = function () {
        if (matchedItems.length === 0) {
            $items.prop("hidden", true);
            $pagination.empty().prop("hidden", true);
            $filteredEmpty.prop("hidden", false);
            $count.text(`Showing 0 of ${total}`);
            return;
        }

        const pageCount = Math.max(1, Math.ceil(matchedItems.length / perPage));

        if (currentPage > pageCount) {
            currentPage = pageCount;
        }

        const start = (currentPage - 1) * perPage;
        const end = start + perPage;

        $items.prop("hidden", true);

        matchedItems.forEach(function (item, index) {
            $(item).prop("hidden", index < start || index >= end);
        });

        renderPagination(pageCount);
        $filteredEmpty.prop("hidden", matchedItems.length > 0);
        $pagination.prop("hidden", false);
        $count.text(`Showing ${matchedItems.length} of ${total}`);
    };

    const updateDirectory = function () {
        const query = normalise($search.val());
        matchedItems = [];

        $items.each(function () {
            const $item = $(this);
            const searchableText = normalise($item.data("company-search-text"));
            const isMatch = !query || searchableText.includes(query);

            if (isMatch) {
                matchedItems.push(this);
            }
        });

        $clear.prop("hidden", !query);
        currentPage = 1;
        renderCurrentPage();
    };

    $search.on("input", updateDirectory);

    $clear.on("click", function () {
        $search.val("");
        updateDirectory();
        $search.trigger("focus");
    });

    $pagination.on("click", "[data-company-page]", function () {
        currentPage = Number($(this).data("company-page")) || 1;
        renderCurrentPage();
    });

    updateDirectory();
});
