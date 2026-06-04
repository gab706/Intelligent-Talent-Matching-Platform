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
    const savedJobs = state.savedJobs || [];
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

    const statusClass = status => `candidate-applications__status--${String(status || "").toLowerCase()}`;

    const renderJobMeta = function (job, extra = "") {
        return `
            <div class="candidate-applications__meta">
                <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(job.jobLocation)}</span>
                <span><i class="fas fa-briefcase" aria-hidden="true"></i>${escapeHtml(label(job.workMode))}</span>
                ${job.salaryRange ? `<span><i class="fas fa-dollar-sign" aria-hidden="true"></i>${escapeHtml(job.salaryRange)}</span>` : ""}
                ${extra}
            </div>
        `;
    };

    const renderSkills = function (skills, detail = false) {
        if (!skills || !skills.length)
            return "";

        return `
            <div class="candidate-applications__skills${detail ? " candidate-applications__skills--detail" : ""}">
                ${skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join("")}
            </div>
        `;
    };

    const renderJobDetails = function (job, context = {}) {
        const statusText = context.statusLabel || context.savedAtLabel && `Saved ${context.savedAtLabel}` || "Job details";
        const timeline = context.appliedAtLabel
            ? `<section><h3>Application timeline</h3><p>Applied ${escapeHtml(context.appliedAtLabel)}. Last updated ${escapeHtml(context.updatedAtLabel)}.</p></section>`
            : context.savedAtLabel
                ? `<section><h3>Saved job</h3><p>Saved ${escapeHtml(context.savedAtLabel)}.</p></section>`
                : "";

        $("[data-application-detail]").html(`
            <div class="candidate-applications__detail-head">
                <p class="account-home__eyebrow">${escapeHtml(statusText)}</p>
                <h2 id="application-detail-title">${escapeHtml(job.jobTitle)}</h2>
                <p>${escapeHtml(job.companyName)}${job.companyIndustry ? ` | ${escapeHtml(job.companyIndustry)}` : ""}</p>
            </div>
            <div class="candidate-applications__detail-meta">
                <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(job.jobLocation)}</span>
                <span><i class="fas fa-briefcase" aria-hidden="true"></i>${escapeHtml(label(job.workMode))}</span>
                ${job.jobType ? `<span><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(label(job.jobType))}</span>` : ""}
                <span><i class="fas fa-user-graduate" aria-hidden="true"></i>${escapeHtml(job.requiredEducationLabel)}</span>
                <span><i class="fas fa-chart-line" aria-hidden="true"></i>${escapeHtml(job.requiredExperience)}+ years</span>
                ${job.salaryRange ? `<span><i class="fas fa-dollar-sign" aria-hidden="true"></i>${escapeHtml(job.salaryRange)}</span>` : ""}
                ${job.closingDateLabel ? `<span><i class="fas fa-calendar-alt" aria-hidden="true"></i>Closes ${escapeHtml(job.closingDateLabel)}</span>` : ""}
            </div>
            ${renderSkills(job.skills || [], true)}
            ${timeline}
            <section>
                <h3>Job description</h3>
                <p>${escapeHtml(job.jobDescription)}</p>
            </section>
            ${job.companyInformation ? `<section><h3>Company information</h3><p>${escapeHtml(job.companyInformation)}</p></section>` : ""}
            ${context.coverLetter ? `<section><h3>Cover letter</h3><p>${escapeHtml(context.coverLetter)}</p></section>` : ""}
            ${context.canWithdraw ? `
                <div class="candidate-applications__actions">
                    <button class="candidate-applications__danger" type="button" data-withdraw-application="${escapeHtml(context.id)}">
                        <i class="fas fa-ban" aria-hidden="true"></i>
                        Withdraw application
                    </button>
                </div>
            ` : ""}
            ${context.savedJobId && !appliedJobIds.has(job.id) ? `
                <div class="candidate-applications__actions">
                    <button class="candidate-applications__primary-action" type="button" data-apply-saved-job="${escapeHtml(job.id)}">
                        <i class="fas fa-paper-plane" aria-hidden="true"></i>
                        Apply
                    </button>
                </div>
            ` : ""}
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
                        <span class="candidate-applications__status ${statusClass(application.status)}">${escapeHtml(application.statusLabel)}</span>
                        <h2>${escapeHtml(job.jobTitle)}</h2>
                        <p>${escapeHtml(job.companyName)}${job.companyIndustry ? ` | ${escapeHtml(job.companyIndustry)}` : ""}</p>
                    </div>
                    ${renderJobMeta(job, `<span><i class="fas fa-calendar-check" aria-hidden="true"></i>Applied ${escapeHtml(application.appliedAtLabel)}</span>`)}
                    ${renderSkills((job.skills || []).slice(0, 6))}
                    <div class="candidate-applications__actions">
                        <button type="button" data-view-application="${escapeHtml(application.id)}">
                            <i class="fas fa-eye" aria-hidden="true"></i>
                            Details
                        </button>
                        ${application.canWithdraw ? `
                            <button class="candidate-applications__danger" type="button" data-withdraw-application="${escapeHtml(application.id)}">
                                <i class="fas fa-ban" aria-hidden="true"></i>
                                Withdraw
                            </button>
                        ` : ""}
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
                        <span class="candidate-applications__status candidate-applications__status--saved">Saved</span>
                        <h2>${escapeHtml(job.jobTitle)}</h2>
                        <p>${escapeHtml(job.companyName)}${job.companyIndustry ? ` | ${escapeHtml(job.companyIndustry)}` : ""}</p>
                    </div>
                    ${renderJobMeta(job, `<span><i class="fas fa-bookmark" aria-hidden="true"></i>Saved ${escapeHtml(savedJob.savedAtLabel)}</span>`)}
                    ${renderSkills((job.skills || []).slice(0, 6))}
                    <div class="candidate-applications__actions">
                        <button type="button" data-view-saved-job="${escapeHtml(savedJob.id)}">
                            <i class="fas fa-eye" aria-hidden="true"></i>
                            Details
                        </button>
                        <button class="candidate-applications__primary-action" type="button" data-apply-saved-job="${escapeHtml(job.id)}" ${alreadyApplied ? "disabled" : ""}>
                            <i class="fas fa-paper-plane" aria-hidden="true"></i>
                            ${alreadyApplied ? "Applied" : "Apply"}
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
        ["APPLIED", "SHORTLISTED", "HIRED", "REJECTED", "WITHDRAWN"].forEach(status => {
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
            savedAtLabel: savedJob.savedAtLabel
        });
    });

    $(document).on("click", "[data-apply-saved-job]", async function () {
        const jobId = String($(this).attr("data-apply-saved-job") || "");
        if (!jobId || appliedJobIds.has(jobId))
            return;

        const $buttons = $(`[data-apply-saved-job='${jobId}']`);
        $buttons.prop("disabled", true);
        try {
            const response = await fetch(`/candidate/jobs/${encodeURIComponent(jobId)}/apply`, {
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
            showMessage(result.message || "Application submitted.", "success");
        } catch (err) {
            console.error(err);
            $buttons.prop("disabled", false);
            showMessage("Unable to apply for this job.");
        }
    });

    $(document).on("click", "[data-withdraw-application]", async function () {
        const applicationId = String($(this).attr("data-withdraw-application") || "");
        const application = findApplication(applicationId);
        if (!application || !application.canWithdraw)
            return;

        const confirmed = window.confirm("Withdraw this application?");
        if (!confirmed)
            return;

        const $button = $(this);
        $button.prop("disabled", true);
        try {
            const response = await fetch("/candidate/application-withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ applicationId })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                $button.prop("disabled", false);
                showMessage(result.message || "Unable to withdraw application.");
                return;
            }

            application.status = "WITHDRAWN";
            application.statusLabel = "Withdrawn";
            application.canWithdraw = false;
            application.updatedAtLabel = "Today";
            updateCounts();
            renderApplications();
            $("[data-application-modal]").prop("hidden", true).attr("aria-hidden", "true");
            showMessage(result.message || "Application withdrawn.", "success");
        } catch (err) {
            console.error(err);
            $button.prop("disabled", false);
            showMessage("Unable to withdraw application.");
        }
    });

    $("[data-application-modal-close]").on("click", function () {
        $("[data-application-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
});
