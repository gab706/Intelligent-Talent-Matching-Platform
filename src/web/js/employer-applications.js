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

    const state = window.__employerApplications || { postings: [] };
    const postings = state.postings || [];
    const lanes = [
        { status: "APPLIED", label: "Applied", icon: "fas fa-inbox" },
        { status: "SHORTLISTED", label: "Shortlisted", icon: "fas fa-star-half-alt" },
        { status: "HIRED", label: "Accepted", icon: "fas fa-check" },
        { status: "REJECTED", label: "Rejected", icon: "fas fa-times" },
        { status: "WITHDRAWN", label: "Withdrawn", icon: "fas fa-ban" }
    ];
    let activePostingId = postings[0]?.id || "";
    let draggedApplicationId = "";

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
    const enumLabel = value => String(value || "")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, character => character.toUpperCase());
    const getPosting = () => postings.find(posting => posting.id === activePostingId);
    const findApplication = applicationId => {
        for (const posting of postings) {
            const application = posting.applications.find(item => item.id === applicationId);
            if (application) return { posting, application };
        }
        return null;
    };

    const renderPostingSelect = function () {
        const $select = $("[data-posting-select]");
        $select.html(postings.map(posting => `
            <option value="${escapeHtml(posting.id)}">${escapeHtml(posting.title)} @ ${escapeHtml(posting.companyName)}</option>
        `).join(""));
        $select.val(activePostingId);
    };

    const renderSummary = function (posting) {
        const counts = lanes.map(lane => ({
            ...lane,
            count: posting.applications.filter(application => application.status === lane.status).length
        }));

        $("[data-posting-summary]").html(`
            <div>
                <h2>${escapeHtml(posting.title)}</h2>
                <p>${escapeHtml(posting.companyName)} | ${escapeHtml(enumLabel(posting.status))}</p>
            </div>
            <dl>
                ${counts.map(item => `
                    <div>
                        <dt>${escapeHtml(item.label)}</dt>
                        <dd>${escapeHtml(item.count)}</dd>
                    </div>
                `).join("")}
            </dl>
        `);
    };

    const cardHtml = function (application) {
        const candidate = application.candidate;
        const details = [
            candidate.highestEducation,
            candidate.yearsOfExperience ? `${candidate.yearsOfExperience} years` : "",
            candidate.availability
        ].filter(Boolean).join(" | ");

        return `
            <article class="employer-applications__card" draggable="true" data-application-id="${escapeHtml(application.id)}">
                <div class="employer-applications__card-main">
                    <img src="${escapeHtml(candidate.avatarPath)}" alt="" />
                    <div>
                        <button type="button" data-profile-open="${escapeHtml(application.id)}">${escapeHtml(candidate.fullName)}</button>
                        ${details ? `<p>${escapeHtml(details)}</p>` : ""}
                    </div>
                </div>
                ${(candidate.skills || []).length ? `
                    <div class="employer-applications__tags">
                        ${candidate.skills.slice(0, 3).map(skill => `<span>${escapeHtml(skill)}</span>`).join("")}
                    </div>
                ` : ""}
            </article>
        `;
    };

    const renderBoard = function () {
        const posting = getPosting();
        const $board = $("[data-application-board]");

        if (!posting) {
            $("[data-empty-state]").prop("hidden", false);
            $("[data-posting-summary]").empty();
            $board.empty();
            return;
        }

        $("[data-empty-state]").prop("hidden", postings.length > 0);
        renderSummary(posting);
        $board.html(lanes.map(lane => {
            const applications = posting.applications.filter(application => application.status === lane.status);

            return `
                <section class="employer-applications__lane" data-lane-status="${escapeHtml(lane.status)}">
                    <div class="employer-applications__lane-head">
                        <h3><i class="${escapeHtml(lane.icon)}" aria-hidden="true"></i>${escapeHtml(lane.label)}</h3>
                        <span>${escapeHtml(applications.length)}</span>
                    </div>
                    <div class="employer-applications__lane-body" data-drop-status="${escapeHtml(lane.status)}">
                        ${applications.length ? applications.map(cardHtml).join("") : `<p class="employer-applications__lane-empty">No candidates</p>`}
                    </div>
                </section>
            `;
        }).join(""));
    };

    const moveApplication = async function (applicationId, status) {
        const found = findApplication(applicationId);
        if (!found || found.application.status === status)
            return;

        const previousStatus = found.application.status;
        found.application.status = status;
        renderBoard();

        try {
            const response = await fetch("/employer/application-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ applicationId, status })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                found.application.status = previousStatus;
                renderBoard();
                showMessage(result.message || "Unable to move application.");
                return;
            }

            showMessage(result.message || "Application moved.", "success");
        } catch (err) {
            console.error(err);
            found.application.status = previousStatus;
            renderBoard();
            showMessage("Unable to move application.");
        }
    };

    const tagList = items => items && items.length
        ? `<div class="employer-applications__profile-tags">${items.map(item => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
        : "";

    const renderProfile = function (application) {
        const candidate = application.candidate;
        const profileItems = [
            candidate.highestEducation ? ["Highest education", candidate.highestEducation] : null,
            candidate.yearsOfExperience ? ["Experience", `${candidate.yearsOfExperience} years`] : null,
            candidate.availability ? ["Availability", candidate.availability] : null,
            candidate.preferredLocation ? ["Preferred location", candidate.preferredLocation] : null,
            candidate.preferredWorkingMode ? ["Working mode", enumLabel(candidate.preferredWorkingMode)] : null,
            candidate.preferredJobType ? ["Job type", enumLabel(candidate.preferredJobType)] : null
        ].filter(Boolean);

        $("[data-profile-content]").html(`
            <div class="employer-applications__profile-head">
                <img src="${escapeHtml(candidate.avatarPath)}" alt="" />
                <div>
                    <h2 id="application-profile-title">${escapeHtml(candidate.fullName)}</h2>
                    <p>${escapeHtml([candidate.email, candidate.phone].filter(Boolean).join(" | "))}</p>
                </div>
            </div>
            ${candidate.summary ? `<section><h3>Summary</h3><p>${escapeHtml(candidate.summary)}</p></section>` : ""}
            ${profileItems.length ? `
                <section>
                    <h3>Profile</h3>
                    <div class="employer-applications__profile-grid">
                        ${profileItems.map(item => `<div><span>${escapeHtml(item[0])}</span><p>${escapeHtml(item[1])}</p></div>`).join("")}
                    </div>
                </section>
            ` : ""}
            ${(candidate.skills || []).length ? `<section><h3>Skills</h3>${tagList(candidate.skills)}</section>` : ""}
            ${(candidate.education || []).length ? `
                <section>
                    <h3>Education</h3>
                    ${candidate.education.map(item => `
                        <div class="employer-applications__profile-row">
                            <strong>${escapeHtml(item.qualificationLabel)}${item.major ? ` in ${escapeHtml(item.major)}` : ""}</strong>
                            ${item.school ? `<p>${escapeHtml(item.school)}</p>` : ""}
                        </div>
                    `).join("")}
                </section>
            ` : ""}
            ${(candidate.experience || []).length ? `
                <section>
                    <h3>Experience</h3>
                    ${candidate.experience.map(item => `
                        <div class="employer-applications__profile-row">
                            <strong>${escapeHtml(item.jobTitle || "Role")}</strong>
                            ${[item.company, item.location, item.workType ? enumLabel(item.workType) : ""].filter(Boolean).length
                                ? `<p>${escapeHtml([item.company, item.location, item.workType ? enumLabel(item.workType) : ""].filter(Boolean).join(" | "))}</p>`
                                : ""}
                            ${item.duties ? `<p>${escapeHtml(item.duties)}</p>` : ""}
                        </div>
                    `).join("")}
                </section>
            ` : ""}
            ${application.coverLetter ? `<section><h3>Cover letter</h3><p>${escapeHtml(application.coverLetter)}</p></section>` : ""}
            ${(candidate.certifications || []).length ? `<section><h3>Certifications</h3>${tagList(candidate.certifications)}</section>` : ""}
            ${(candidate.languages || []).length ? `<section><h3>Languages</h3>${tagList(candidate.languages.map(item => `${item.name} | ${enumLabel(item.fluency)}`))}</section>` : ""}
            ${(candidate.portfolioLinks || []).length ? `
                <section>
                    <h3>Portfolio</h3>
                    ${candidate.portfolioLinks.map(item => `
                        <div class="employer-applications__profile-row">
                            <strong>${escapeHtml(item.label)}</strong>
                            <p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a></p>
                        </div>
                    `).join("")}
                </section>
            ` : ""}
        `);
        $("[data-profile-modal]").prop("hidden", false).attr("aria-hidden", "false");
    };

    renderPostingSelect();
    renderBoard();

    $("[data-posting-select]").on("change", function () {
        activePostingId = String($(this).val() || "");
        renderBoard();
    });
    $("[data-application-board]").on("dragstart", "[data-application-id]", function (event) {
        draggedApplicationId = String($(this).attr("data-application-id") || "");
        event.originalEvent.dataTransfer.effectAllowed = "move";
    });
    $("[data-application-board]").on("dragover", "[data-drop-status]", function (event) {
        event.preventDefault();
        $(this).closest("[data-lane-status]").addClass("is-over");
    });
    $("[data-application-board]").on("dragleave", "[data-drop-status]", function () {
        $(this).closest("[data-lane-status]").removeClass("is-over");
    });
    $("[data-application-board]").on("drop", "[data-drop-status]", function (event) {
        event.preventDefault();
        const status = String($(this).attr("data-drop-status") || "");
        $(this).closest("[data-lane-status]").removeClass("is-over");
        if (draggedApplicationId && status)
            moveApplication(draggedApplicationId, status);
        draggedApplicationId = "";
    });
    $("[data-application-board]").on("click", "[data-profile-open]", function () {
        const applicationId = String($(this).attr("data-profile-open") || "");
        const found = findApplication(applicationId);
        if (found) renderProfile(found.application);
    });
    $("[data-profile-close]").on("click", function () {
        $("[data-profile-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
});
