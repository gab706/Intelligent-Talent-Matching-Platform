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
        appliedJobIds: []
    };
    const jobs = [...(data.jobs || []), ...(data.recommendedJobs || [])]
        .reduce((map, job) => {
            map.set(job.id, job);
            return map;
        }, new Map());

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

    const setSaved = function (jobId) {
        $(`[data-save-job="${jobId}"]`)
            .prop("disabled", true)
            .html('<i class="fas fa-bookmark" aria-hidden="true"></i> Saved');
    };

    const setApplied = function (jobId) {
        $(`[data-apply-job="${jobId}"]`)
            .prop("disabled", true)
            .html('<i class="fas fa-check" aria-hidden="true"></i> Applied');
    };

    const renderDetails = function (job) {
        $("[data-job-detail]").html(`
            <div class="find-job-page__detail-head">
                <p class="account-home__eyebrow">${escapeHtml(job.companyName)}</p>
                <h2 id="job-detail-title">${escapeHtml(job.jobTitle)}</h2>
                ${job.companyIndustry ? `<p>${escapeHtml(job.companyIndustry)}</p>` : ""}
            </div>
            <div class="find-job-page__detail-meta">
                <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(job.jobLocation)}</span>
                <span><i class="fas fa-briefcase" aria-hidden="true"></i>${escapeHtml(label(job.workMode))}</span>
                ${job.jobType ? `<span><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(label(job.jobType))}</span>` : ""}
                <span><i class="fas fa-user-graduate" aria-hidden="true"></i>${escapeHtml(job.requiredEducationLabel)}</span>
                <span><i class="fas fa-chart-line" aria-hidden="true"></i>${escapeHtml(job.requiredExperience)}+ years</span>
                ${job.salaryRange ? `<span><i class="fas fa-dollar-sign" aria-hidden="true"></i>${escapeHtml(job.salaryRange)}</span>` : ""}
                ${job.closingDateLabel ? `<span><i class="fas fa-calendar-alt" aria-hidden="true"></i>Closes ${escapeHtml(job.closingDateLabel)}</span>` : ""}
            </div>
            ${(job.skills || []).length ? `
                <div class="find-job-page__skills find-job-page__skills--detail">
                    ${job.skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join("")}
                </div>
            ` : ""}
            ${job.explanation ? `<section><h3>Why this was recommended</h3><p>${escapeHtml(job.explanation)}</p></section>` : ""}
            <section><h3>Job description</h3><p>${escapeHtml(job.jobDescription)}</p></section>
            ${job.companyInformation ? `<section><h3>Company information</h3><p>${escapeHtml(job.companyInformation)}</p></section>` : ""}
            <div class="find-job-page__actions">
                <button type="button" data-save-job="${escapeHtml(job.id)}" ${data.savedJobIds.includes(job.id) ? "disabled" : ""}>
                    <i class="${data.savedJobIds.includes(job.id) ? "fas" : "far"} fa-bookmark" aria-hidden="true"></i>
                    ${data.savedJobIds.includes(job.id) ? "Saved" : "Save"}
                </button>
                <button class="find-job-page__apply" type="button" data-apply-job="${escapeHtml(job.id)}" ${data.appliedJobIds.includes(job.id) ? "disabled" : ""}>
                    <i class="${data.appliedJobIds.includes(job.id) ? "fas fa-check" : "fas fa-paper-plane"}" aria-hidden="true"></i>
                    ${data.appliedJobIds.includes(job.id) ? "Applied" : "Apply"}
                </button>
            </div>
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
            setApplied(jobId);
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

    $("[data-job-modal-close]").on("click", function () {
        $("[data-job-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
});
