$(function () {
    $("[data-company-tab]").on("click", function () {
        const tab = $(this).attr("data-company-tab");

        $("[data-company-tab]")
            .removeClass("is-active")
            .attr("aria-selected", "false");
        $(this)
            .addClass("is-active")
            .attr("aria-selected", "true");

        $("[data-company-panel]").removeClass("is-active");
        $(`[data-company-panel='${tab}']`).addClass("is-active");
    });
});
