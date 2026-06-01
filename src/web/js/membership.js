$(function () {
    const $selectorButtons =
        $(".membership-page__selector-button");

    const $panels =
        $(".membership-page__capability-panel");

    $selectorButtons.on("click", function () {
        const target =
            $(this).data("membership-target");

        $selectorButtons.removeClass(
            "membership-page__selector-button--active"
        );

        $(this).addClass(
            "membership-page__selector-button--active"
        );

        $panels.attr("hidden", true);

        $panels
            .filter(`[data-membership-panel="${target}"]`)
            .removeAttr("hidden");
    });
});