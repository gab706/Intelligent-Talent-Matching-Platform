/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
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

    const state = window.__candidateApplications || { applications: [], savedJobs: [], statusCounts: {} };
    const applications = state.applications || [];
    let savedJobs = state.savedJobs || [];
    const appliedJobIds = new Set(applications.map(application => application.job && application.job.id).filter(Boolean));
    let activeStatus = "ALL";
    let activeMode = "applications";

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

    const findApplication = id => applications.find(application => application.id === id);
    const findSavedJob = id => savedJobs.find(savedJob => savedJob.id === id);

    const renderJobMeta = function (job, extra = "") {
        return `
            <div class="candidate-applications__meta">
                <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(job.jobLocation)}</span>
                <span><i class="fas fa-briefcase" aria-hidden="true"></i>${escapeHtml(label(job.workMode))}</span>
                ${extra}
            </div>
        `;
    };

    const renderList = function (items) {
        const values = (items || []).filter(Boolean);
        if (!values.length)
            return "";

        return `<ul>${values.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    };

    const renderJobDetails = function (job, context = {}) {
        const appliedLabel = window.formatClientDate(context.appliedAt, "");

        $("[data-application-detail]").html(`
            <div class="candidate-applications__detail-head">
                <p class="account-home__eyebrow">${escapeHtml(job.companyName)}${job.companyIndustry ? ` | ${escapeHtml(job.companyIndustry)}` : ""}</p>
                <h2 id="application-detail-title">${escapeHtml(job.jobTitle)}</h2>
                <div class="candidate-applications__detail-meta">
                    <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(job.jobLocation)}</span>
                    <span><i class="fas fa-briefcase" aria-hidden="true"></i>${escapeHtml(label(job.workMode))}</span>
                    ${job.jobType ? `<span><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(label(job.jobType))}</span>` : ""}
                    ${job.salaryRange ? `<span><i class="fas fa-dollar-sign" aria-hidden="true"></i>${escapeHtml(job.salaryRange)}</span>` : ""}
                </div>
            </div>
            <div class="candidate-applications__detail-body">
                <section>
                    <h3>Job description</h3>
                    <p>${escapeHtml(job.jobDescription)}</p>
                </section>
                <section>
                    <h3>Required Background</h3>
                    ${renderList([
                        `Minimum degree: ${job.requiredEducationLabel || "Not specified"}`,
                        `Minimum experience: ${job.requiredExperience || 0}+ years`
                    ])}
                </section>
                ${(job.skills || []).length ? `<section><h3>Desired Skills</h3>${renderList(job.skills)}</section>` : ""}
            </div>
            <footer class="candidate-applications__modal-footer">
                ${context.savedJobId && !appliedJobIds.has(job.id) ? `
                    <button class="candidate-applications__primary-action" type="button" data-apply-saved-job="${escapeHtml(job.id)}">
                        <i class="fas fa-paper-plane" aria-hidden="true"></i>
                        Apply
                    </button>
                    <button type="button" data-unsave-job="${escapeHtml(job.id)}">
                        <i class="fas fa-bookmark" aria-hidden="true"></i>
                        Unsave
                    </button>
                ` : `<p class="candidate-applications__applied-notice">Applied on ${escapeHtml(appliedLabel || "this job")}</p>`}
            </footer>
        `);
        $("[data-application-modal]").prop("hidden", false).attr("aria-hidden", "false");
    };

    const renderApplications = function () {
        if (activeMode === "saved") {
            renderSavedJobs();
            return;
        }

        const visible = applications.filter(application =>
            activeStatus === "ALL" || application.status === activeStatus);

        $("[data-application-list]").html(visible.map(application => {
            const job = application.job;
            return `
                <article class="candidate-applications__item" data-application-id="${escapeHtml(application.id)}">
                    <div>
                        <h2>${escapeHtml(job.jobTitle)}</h2>
                        <p>${escapeHtml(job.companyName)}${job.companyIndustry ? ` | ${escapeHtml(job.companyIndustry)}` : ""}</p>
                    </div>
                    ${renderJobMeta(job, `<span><i class="fas fa-calendar-check" aria-hidden="true"></i>Applied ${escapeHtml(window.formatClientDate(application.appliedAt, ""))}</span>`)}
                    <div class="candidate-applications__actions">
                        <button type="button" data-view-application="${escapeHtml(application.id)}">
                            <i class="fas fa-eye" aria-hidden="true"></i>
                            Details
                        </button>
                    </div>
                </article>
            `;
        }).join(""));

        updateEmptyState(visible.length);
    };

    const renderSavedJobs = function () {
        $("[data-application-list]").html(savedJobs.map(savedJob => {
            const job = savedJob.job;
            const alreadyApplied = appliedJobIds.has(job.id);
            return `
                <article class="candidate-applications__item" data-saved-job-id="${escapeHtml(savedJob.id)}">
                    <div>
                        <h2>${escapeHtml(job.jobTitle)}</h2>
                        <p>${escapeHtml(job.companyName)}${job.companyIndustry ? ` | ${escapeHtml(job.companyIndustry)}` : ""}</p>
                    </div>
                    ${renderJobMeta(job, `<span><i class="fas fa-bookmark" aria-hidden="true"></i>Saved ${escapeHtml(window.formatClientDate(savedJob.savedAt, ""))}</span>`)}
                    <div class="candidate-applications__actions">
                        <button class="candidate-applications__primary-action" type="button" data-apply-saved-job="${escapeHtml(job.id)}" ${alreadyApplied ? "disabled" : ""}>
                            <i class="fas fa-paper-plane" aria-hidden="true"></i>
                            ${alreadyApplied ? "Applied" : "Apply"}
                        </button>
                        <button type="button" data-unsave-job="${escapeHtml(job.id)}">
                            <i class="fas fa-bookmark" aria-hidden="true"></i>
                            Unsave
                        </button>
                        <button type="button" data-view-saved-job="${escapeHtml(savedJob.id)}">
                            <i class="fas fa-eye" aria-hidden="true"></i>
                            Details
                        </button>
                    </div>
                </article>
            `;
        }).join(""));

        updateEmptyState(savedJobs.length);
    };

    const updateEmptyState = function (visibleCount) {
        const isSaved = activeMode === "saved";
        $("[data-empty-state] h2").text(isSaved ? "No saved jobs yet" : "No applications here");
        $("[data-empty-state] p").text(isSaved
            ? "Save roles from Find a Job and they will appear here."
            : "Try another status, or apply for a role from Find a Job.");
        $("[data-empty-state]").prop("hidden", visibleCount > 0);
    };

    const updateCounts = function () {
        const counts = applications.reduce((result, application) => {
            result[application.status] = (result[application.status] || 0) + 1;
            return result;
        }, {});
        $("[data-status-filter='ALL'] strong").text(applications.length);
        ["APPLIED", "SHORTLISTED", "HIRED", "REJECTED"].forEach(status => {
            $(`[data-status-filter='${status}'] strong`).text(counts[status] || 0);
        });
    };

    renderApplications();

    $("[data-view-mode]").on("click", function () {
        activeMode = String($(this).attr("data-view-mode") || "applications");
        $("[data-view-mode]").removeClass("is-active");
        $(this).addClass("is-active");
        $("[data-status-filter]").closest(".candidate-applications__summary").prop("hidden", activeMode === "saved");
        renderApplications();
    });

    $("[data-status-filter]").on("click", function () {
        activeStatus = String($(this).attr("data-status-filter") || "ALL");
        $("[data-status-filter]").removeClass("is-active");
        $(this).addClass("is-active");
        renderApplications();
    });

    $(document).on("click", "[data-view-application]", function () {
        const application = findApplication(String($(this).attr("data-view-application") || ""));
        if (application) renderJobDetails(application.job, application);
    });

    $(document).on("click", "[data-view-saved-job]", function () {
        const savedJob = findSavedJob(String($(this).attr("data-view-saved-job") || ""));
        if (savedJob) renderJobDetails(savedJob.job, {
            savedJobId: savedJob.id,
            savedAt: savedJob.savedAt
        });
    });

    $(document).on("click", "[data-apply-saved-job]", async function () {
        const jobId = String($(this).attr("data-apply-saved-job") || "");
        if (!jobId || appliedJobIds.has(jobId))
            return;

        const $buttons = $(`[data-apply-saved-job='${jobId}']`);
        $buttons.prop("disabled", true);
        try {
            const response = await window.guardedFetch(`/candidate/jobs/${encodeURIComponent(jobId)}/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                $buttons.prop("disabled", false);
                showMessage(result.message || "Unable to apply for this job.");
                return;
            }

            appliedJobIds.add(jobId);
            $buttons.text("Applied").prop("disabled", true);
            savedJobs = savedJobs.filter(savedJob => savedJob.job.id !== jobId);
            renderApplications();
            $("[data-application-modal]").prop("hidden", true).attr("aria-hidden", "true");
            showMessage(result.message || "Application submitted.", "success");
        } catch (err) {
            console.error(err);
            $buttons.prop("disabled", false);
            showMessage("Unable to apply for this job.");
        }
    });

    $(document).on("click", "[data-unsave-job]", async function () {
        const jobId = String($(this).attr("data-unsave-job") || "");
        if (!jobId)
            return;

        const $buttons = $(`[data-unsave-job='${jobId}']`);
        $buttons.prop("disabled", true);
        try {
            const response = await window.guardedFetch(`/candidate/jobs/${encodeURIComponent(jobId)}/save`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                $buttons.prop("disabled", false);
                showMessage(result.message || "Unable to unsave this job.");
                return;
            }

            savedJobs = savedJobs.filter(savedJob => savedJob.job.id !== jobId);
            renderApplications();
            $("[data-application-modal]").prop("hidden", true).attr("aria-hidden", "true");
            showMessage(result.message || "Job unsaved.", "success");
        } catch (err) {
            console.error(err);
            $buttons.prop("disabled", false);
            showMessage("Unable to unsave this job.");
        }
    });

    $("[data-application-modal-close]").on("click", function () {
        $("[data-application-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
});
