$(function () {
    if (typeof toastr !== "undefined") {
        toastr.options = {
            closeButton: true,
            progressBar: true,
            newestOnTop: true,
            preventDuplicates: true,
            positionClass: "toast-top-right"
        };
    }

    const data = window.__findJob || {
        jobs: [],
        recommendedJobs: [],
        savedJobIds: [],
        appliedJobIds: [],
        appliedJobs: {},
        filters: {}
    };
    const filterSkills = Array.isArray(data.filters && data.filters.skills)
        ? [...data.filters.skills]
        : [];
    const jobs = [...(data.jobs || []), ...(data.recommendedJobs || [])]
        .reduce((map, job) => {
            map.set(job.id, job);
            return map;
        }, new Map());
    let liveSearchTimer = null;
    let liveSearchRequest = null;
    let liveSearchSequence = 0;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("q") && !searchParams.has("keyword")) {
        const query = String(searchParams.get("q") || "").trim();
        if (query)
            $("[name='keyword']").val(query);
    }
    if (searchParams.has("location")) {
        const location = String(searchParams.get("location") || "").trim();
        if (location)
            $("[name='location']").val(location);
    }

    const escapeHtml = value => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const showMessage = function (message, type = "error") {
        if (typeof toastr !== "undefined") {
            toastr[type](message);
            return;
        }
        window.alert(message);
    };
    const label = value => String(value || "")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, character => character.toUpperCase());
    const renderList = function (items) {
        const values = (items || []).filter(Boolean);
        if (!values.length)
            return "";

        return `<ul>${values.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    };
    const normaliseSkill = value => String(value || "").trim().replace(/\s+/g, " ");
    const buildSearchParams = function () {
        const form = document.querySelector("[data-find-job-form]");
        const params = new URLSearchParams();

        if (!form)
            return params;

        for (const [key, value] of new FormData(form).entries()) {
            const text = String(value || "").trim();
            if (text)
                params.append(key, text);
        }

        return params;
    };

    const renderJobCard = function (job) {
        const saved = data.savedJobIds.includes(job.id);
        const applied = data.appliedJobIds.includes(job.id);
        const appliedInfo = data.appliedJobs && data.appliedJobs[job.id];
        const industry = job.companyIndustry ? `<span>| ${escapeHtml(job.companyIndustry)}</span>` : "";
        const jobType = job.jobType ? `<span><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(label(job.jobType))}</span>` : "";
        const appliedMeta = appliedInfo
            ? `<span class="find-job-page__applied-meta"><i class="fas fa-calendar-check" aria-hidden="true"></i>Applied ${escapeHtml(appliedInfo.appliedAtLabel)}</span>`
            : "";
        const actionButtons = applied
            ? ""
            : `
                <button class="find-job-page__apply" type="button" data-apply-job="${escapeHtml(job.id)}">
                    <i class="fas fa-paper-plane" aria-hidden="true"></i>
                    Apply
                </button>
                <button type="button" ${saved ? `data-unsave-job="${escapeHtml(job.id)}"` : `data-save-job="${escapeHtml(job.id)}"`}>
                    <i class="${saved ? "fas" : "far"} fa-bookmark" aria-hidden="true"></i>
                    ${saved ? "Unsave" : "Save"}
                </button>
            `;

        return `
            <article class="find-job-page__job-card" data-job-card data-job-id="${escapeHtml(job.id)}">
                <div class="find-job-page__job-main">
                    <div>
                        <h3>${escapeHtml(job.jobTitle)}</h3>
                        <p class="find-job-page__company">${escapeHtml(job.companyName)} ${industry}</p>
                    </div>
                </div>
                <div class="find-job-page__meta">
                    <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(job.jobLocation)}</span>
                    <span><i class="fas fa-briefcase" aria-hidden="true"></i>${escapeHtml(label(job.workMode))}</span>
                    ${jobType}
                    ${appliedMeta}
                </div>
                <div class="find-job-page__actions">
                    ${actionButtons}
                    <button type="button" data-view-job="${escapeHtml(job.id)}">
                        <i class="fas fa-eye" aria-hidden="true"></i>
                        View
                    </button>
                </div>
            </article>
        `;
    };

    const renderSearchResults = function (results) {
        const resultJobs = results.jobs || [];

        data.jobs = resultJobs;
        data.savedJobIds = results.savedJobIds || [];
        data.appliedJobIds = results.appliedJobIds || [];
        data.appliedJobs = results.appliedJobs || {};
        jobs.clear();
        [...resultJobs, ...(data.recommendedJobs || [])].forEach(job => jobs.set(job.id, job));

        $("[data-search-results-list]").html(resultJobs.map(renderJobCard).join(""));
        $("[data-search-empty]").prop("hidden", resultJobs.length > 0);
        $("[data-search-result-count]").text(`${resultJobs.length} active match${resultJobs.length === 1 ? "" : "es"}`);
    };

    const runLiveSearch = async function () {
        const sequence = ++liveSearchSequence;
        const params = buildSearchParams();
        const query = params.toString();
        const pageUrl = query ? `/candidate/find-a-job?${query}` : "/candidate/find-a-job";
        const apiUrl = query ? `/candidate/jobs/search?${query}` : "/candidate/jobs/search";

        window.history.replaceState({}, "", pageUrl);

        if (liveSearchRequest)
            liveSearchRequest.abort();

        liveSearchRequest = new AbortController();

        try {
            const response = await fetch(apiUrl, {
                headers: { "Accept": "application/json" },
                signal: liveSearchRequest.signal
            });
            const result = await response.json();

            if (sequence !== liveSearchSequence)
                return;

            if (!response.ok || !result.success) {
                showMessage(result.message || "Unable to search jobs.");
                return;
            }

            renderSearchResults(result);
        } catch (err) {
            if (err.name === "AbortError")
                return;

            console.error(err);
            showMessage("Unable to search jobs.");
        }
    };

    const scheduleLiveSearch = function () {
        window.clearTimeout(liveSearchTimer);
        liveSearchTimer = window.setTimeout(runLiveSearch, 260);
    };

    const renderSkillFilters = function () {
        const chips = filterSkills.length
            ? filterSkills.map((skill, index) => `
                <span class="find-job-page__skill-chip">
                    ${escapeHtml(skill)}
                    <button type="button" aria-label="Remove ${escapeHtml(skill)}" data-remove-filter-skill="${index}">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </span>
            `).join("")
            : '<span class="find-job-page__skill-empty">No skills added</span>';

        $("[data-filter-skill-list]").html(chips);
        $("[data-filter-skill-values]").html(filterSkills.map(skill => (
            `<input form="find-job-search-form" type="hidden" name="skill" value="${escapeHtml(skill)}" />`
        )).join(""));
    };

    const addSkillFilter = function (value) {
        const skill = normaliseSkill(value);
        const key = skill.toLowerCase();

        if (!skill || filterSkills.some(item => item.toLowerCase() === key))
            return;

        filterSkills.push(skill);
        renderSkillFilters();
    };

    const setSaved = function (jobId) {
        $(`[data-save-job="${jobId}"]`)
            .attr("data-unsave-job", jobId)
            .removeAttr("data-save-job")
            .prop("disabled", false)
            .html('<i class="fas fa-bookmark" aria-hidden="true"></i> Unsave');
    };

    const setUnsaved = function (jobId) {
        $(`[data-unsave-job="${jobId}"]`)
            .attr("data-save-job", jobId)
            .removeAttr("data-unsave-job")
            .prop("disabled", false)
            .html('<i class="far fa-bookmark" aria-hidden="true"></i> Save');
    };

    const setApplied = function (jobId, appliedAtLabel) {
        const labelText = appliedAtLabel || "today";
        const $cards = $(`[data-job-card][data-job-id="${jobId}"]`);
        $cards.each(function () {
            const $card = $(this);
            $card.find("[data-apply-job], [data-save-job], [data-unsave-job]").remove();
            if (!$card.find(".find-job-page__applied-meta").length) {
                $card.find(".find-job-page__meta").append(
                    `<span class="find-job-page__applied-meta"><i class="fas fa-calendar-check" aria-hidden="true"></i>Applied ${escapeHtml(labelText)}</span>`
                );
            }
        });
        $("[data-job-detail] .find-job-page__modal-footer").html(
            `<p class="find-job-page__applied-notice">Applied on ${escapeHtml(labelText)}</p>`
        );
    };

    const renderDetails = function (job) {
        const isApplied = data.appliedJobIds.includes(job.id);
        const isSaved = data.savedJobIds.includes(job.id);
        const appliedLabel = data.appliedJobs && data.appliedJobs[job.id] && data.appliedJobs[job.id].appliedAtLabel;

        $("[data-job-detail]").html(`
            <div class="find-job-page__detail-head">
                <p class="account-home__eyebrow">${escapeHtml(job.companyName)}${job.companyIndustry ? ` | ${escapeHtml(job.companyIndustry)}` : ""}</p>
                <h2 id="job-detail-title">${escapeHtml(job.jobTitle)}</h2>
                <div class="find-job-page__detail-meta">
                    <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(job.jobLocation)}</span>
                    <span><i class="fas fa-briefcase" aria-hidden="true"></i>${escapeHtml(label(job.workMode))}</span>
                    ${job.jobType ? `<span><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(label(job.jobType))}</span>` : ""}
                    ${job.salaryRange ? `<span><i class="fas fa-dollar-sign" aria-hidden="true"></i>${escapeHtml(job.salaryRange)}</span>` : ""}
                </div>
            </div>
            <div class="find-job-page__detail-body">
                <section><h3>Job description</h3><p>${escapeHtml(job.jobDescription)}</p></section>
                <section>
                    <h3>Required Background</h3>
                    ${renderList([
                        `Minimum degree: ${job.requiredEducationLabel || "Not specified"}`,
                        `Minimum experience: ${job.requiredExperience || 0}+ years`
                    ])}
                </section>
                ${(job.skills || []).length ? `<section><h3>Desired Skills</h3>${renderList(job.skills)}</section>` : ""}
            </div>
            <footer class="find-job-page__modal-footer">
                ${isApplied ? `<p class="find-job-page__applied-notice">Applied on ${escapeHtml(appliedLabel || "today")}</p>` : `
                    <button class="find-job-page__apply" type="button" data-apply-job="${escapeHtml(job.id)}">
                        <i class="fas fa-paper-plane" aria-hidden="true"></i>
                        Apply
                    </button>
                    <button type="button" ${isSaved ? `data-unsave-job="${escapeHtml(job.id)}"` : `data-save-job="${escapeHtml(job.id)}"`}>
                        <i class="${isSaved ? "fas" : "far"} fa-bookmark" aria-hidden="true"></i>
                        ${isSaved ? "Unsave" : "Save"}
                    </button>
                `}
            </footer>
        `);
        $("[data-job-modal]").prop("hidden", false).attr("aria-hidden", "false");
    };

    $(document).on("click", "[data-save-job]", async function () {
        const jobId = String($(this).attr("data-save-job") || "");
        const $button = $(this);
        $button.prop("disabled", true);
        try {
            const response = await fetch(`/candidate/jobs/${encodeURIComponent(jobId)}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                $button.prop("disabled", false);
                showMessage(result.message || "Unable to save job.");
                return;
            }
            if (!data.savedJobIds.includes(jobId))
                data.savedJobIds.push(jobId);
            setSaved(jobId);
            showMessage(result.message || "Job saved.", "success");
        } catch (err) {
            console.error(err);
            $button.prop("disabled", false);
            showMessage("Unable to save job.");
        }
    });

    $(document).on("click", "[data-unsave-job]", async function () {
        const jobId = String($(this).attr("data-unsave-job") || "");
        const $button = $(this);
        $button.prop("disabled", true);
        try {
            const response = await fetch(`/candidate/jobs/${encodeURIComponent(jobId)}/save`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                $button.prop("disabled", false);
                showMessage(result.message || "Unable to unsave job.");
                return;
            }
            data.savedJobIds = data.savedJobIds.filter(id => id !== jobId);
            setUnsaved(jobId);
            showMessage(result.message || "Job unsaved.", "success");
        } catch (err) {
            console.error(err);
            $button.prop("disabled", false);
            showMessage("Unable to unsave job.");
        }
    });

    $(document).on("click", "[data-apply-job]", async function () {
        const jobId = String($(this).attr("data-apply-job") || "");
        const $button = $(this);
        $button.prop("disabled", true);
        try {
            const response = await fetch(`/candidate/jobs/${encodeURIComponent(jobId)}/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                $button.prop("disabled", false);
                showMessage(result.message || "Unable to apply for job.");
                return;
            }
            if (!data.appliedJobIds.includes(jobId))
                data.appliedJobIds.push(jobId);
            data.appliedJobs = data.appliedJobs || {};
            data.appliedJobs[jobId] = {
                appliedAtLabel: result.appliedAtLabel || "today"
            };
            setApplied(jobId, data.appliedJobs[jobId].appliedAtLabel);
            showMessage(result.message || "Application submitted.", "success");
        } catch (err) {
            console.error(err);
            $button.prop("disabled", false);
            showMessage("Unable to apply for job.");
        }
    });

    $(document).on("click", "[data-view-job]", function () {
        const job = jobs.get(String($(this).attr("data-view-job") || ""));
        if (job) renderDetails(job);
    });

    $("[data-job-tab]").on("click", function () {
        const tab = String($(this).attr("data-job-tab") || "search");
        $("[data-job-tab]").removeClass("is-active");
        $(this).addClass("is-active");
        $("[data-job-panel]").prop("hidden", true);
        $(`[data-job-panel="${tab}"]`).prop("hidden", false);
    });

    $("[data-job-filter-open]").on("click", function () {
        $("[data-job-filter-modal]").prop("hidden", false).attr("aria-hidden", "false");
    });

    $("[data-job-filter-close]").on("click", function () {
        $("[data-job-filter-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });

    $("[data-filter-skill-input]").on("keydown", function (event) {
        if (event.key !== "Enter")
            return;

        event.preventDefault();
        addSkillFilter($(this).val());
        $(this).val("");
    });

    $("[name='keyword']").on("input", function (event) {
        if (event.originalEvent && event.originalEvent.isComposing)
            return;

        scheduleLiveSearch();
    });

    $(document).on("click", "[data-remove-filter-skill]", function () {
        filterSkills.splice(Number($(this).attr("data-remove-filter-skill")), 1);
        renderSkillFilters();
    });

    $("[data-job-modal-close]").on("click", function () {
        $("[data-job-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });

    renderSkillFilters();
});
