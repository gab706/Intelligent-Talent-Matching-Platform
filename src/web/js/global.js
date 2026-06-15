/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
(function () {
    const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
    const DEFAULT_UPLOAD_TIMEOUT_MS = 30000;
    const nativeFetch = window.fetch.bind(window);
    const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    function parseDate(value) {
        if (!value)
            return null;

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    window.guardedFetch = function (url, options = {}) {
        const isUpload = typeof FormData !== "undefined" && options.body instanceof FormData;
        const timeoutMs = Number(options.timeoutMs || 0) || (isUpload ? DEFAULT_UPLOAD_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(function () {
            controller.abort();
        }, timeoutMs);
        const requestOptions = {
            ...options,
            signal: controller.signal
        };

        delete requestOptions.timeoutMs;

        if (options.signal) {
            if (options.signal.aborted)
                controller.abort();
            else
                options.signal.addEventListener("abort", function () {
                    controller.abort();
                }, {
                    once: true
                });
        }

        return nativeFetch(url, requestOptions).finally(function () {
            window.clearTimeout(timeoutId);
        });
    };

    window.getRequestErrorMessage = function (err, fallback = "Unable to contact the server.") {
        if (err && err.name === "AbortError")
            return "The request timed out. Please try again.";

        return fallback;
    };

    window.formatClientDateTime = function (value, fallback = "Not set") {
        const date = parseDate(value);

        return date
            ? dateTimeFormatter.format(date)
            : fallback;
    };

    window.formatClientDate = function (value, fallback = "Not set") {
        const date = parseDate(value);

        return date
            ? dateFormatter.format(date)
            : fallback;
    };

    window.formatClientSuspensionEnd = function (value, fallback = "Not set") {
        const date = parseDate(value);

        if (!date)
            return fallback;

        if (date.getFullYear() >= 9999)
            return "Permanent";

        return `Until ${dateTimeFormatter.format(date)}`;
    };
})();

$(function () {
    $("[data-local-datetime]").each(function () {
        const $element = $(this);
        $element.text(window.formatClientDateTime($element.attr("data-local-datetime"), $element.text()));
    });

    $("[data-local-date]").each(function () {
        const $element = $(this);
        $element.text(window.formatClientDate($element.attr("data-local-date"), $element.text()));
    });

    console.log(
        "%c🔎 Welcome to TalentMatch!",
        "color: #1557d6; font-size: 20px; font-weight: bold; padding: 6px 0;"
    );

    console.log(
        "%cIf someone told you to paste anything here, it may be a scam.\nPasting code in this console could give attackers access to your TalentMatch account.",
        "color: #ef4444; font-size: 13px; font-weight: 600;"
    );

    console.log(
        "%c🚀 If you understand exactly what you're doing, come work for us: jobs@talentmatch.com",
        "color: #f59e0b; font-size: 12px; font-weight: 600;"
    );
});
