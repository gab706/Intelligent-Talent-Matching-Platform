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

    const state = window.__candidateApplications || { applications: [], statusCounts: {} };
    const applications = state.applications || [];
    let activeStatus = "ALL";

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

    const statusClass = status => `candidate-applications__status--${String(status || "").toLowerCase()}`;

    const renderApplications = function () {
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
                    <div class="candidate-applications__meta">
                        <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(job.jobLocation)}</span>
                        <span><i class="fas fa-briefcase" aria-hidden="true"></i>${escapeHtml(label(job.workMode))}</span>
                        ${job.salaryRange ? `<span><i class="fas fa-dollar-sign" aria-hidden="true"></i>${escapeHtml(job.salaryRange)}</span>` : ""}
                        <span><i class="fas fa-calendar-check" aria-hidden="true"></i>Applied ${escapeHtml(application.appliedAtLabel)}</span>
                    </div>
                    ${(job.skills || []).length ? `
                        <div class="candidate-applications__skills">
                            ${job.skills.slice(0, 6).map(skill => `<span>${escapeHtml(skill)}</span>`).join("")}
                        </div>
                    ` : ""}
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

        $("[data-empty-state]").prop("hidden", visible.length > 0);
    };

    const renderDetails = function (application) {
        const job = application.job;
        $("[data-application-detail]").html(`
            <div class="candidate-applications__detail-head">
                <p class="account-home__eyebrow">${escapeHtml(application.statusLabel)}</p>
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
            ${(job.skills || []).length ? `
                <div class="candidate-applications__skills candidate-applications__skills--detail">
                    ${job.skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join("")}
                </div>
            ` : ""}
            <section>
                <h3>Application timeline</h3>
                <p>Applied ${escapeHtml(application.appliedAtLabel)}. Last updated ${escapeHtml(application.updatedAtLabel)}.</p>
            </section>
            <section>
                <h3>Job description</h3>
                <p>${escapeHtml(job.jobDescription)}</p>
            </section>
            ${job.companyInformation ? `<section><h3>Company information</h3><p>${escapeHtml(job.companyInformation)}</p></section>` : ""}
            ${application.coverLetter ? `<section><h3>Cover letter</h3><p>${escapeHtml(application.coverLetter)}</p></section>` : ""}
            ${application.canWithdraw ? `
                <div class="candidate-applications__actions">
                    <button class="candidate-applications__danger" type="button" data-withdraw-application="${escapeHtml(application.id)}">
                        <i class="fas fa-ban" aria-hidden="true"></i>
                        Withdraw application
                    </button>
                </div>
            ` : ""}
        `);
        $("[data-application-modal]").prop("hidden", false).attr("aria-hidden", "false");
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

    $("[data-status-filter]").on("click", function () {
        activeStatus = String($(this).attr("data-status-filter") || "ALL");
        $("[data-status-filter]").removeClass("is-active");
        $(this).addClass("is-active");
        renderApplications();
    });

    $(document).on("click", "[data-view-application]", function () {
        const application = findApplication(String($(this).attr("data-view-application") || ""));
        if (application) renderDetails(application);
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
