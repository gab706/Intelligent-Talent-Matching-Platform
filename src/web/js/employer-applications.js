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
        { status: "REJECTED", label: "Rejected", icon: "fas fa-times" }
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
    const isReadOnlyPosting = posting => posting && posting.status === "CLOSED";
    const findApplication = applicationId => {
        for (const posting of postings) {
            const application = posting.applications.find(item => item.id === applicationId);
            if (application) return { posting, application };
        }
        return null;
    };

    const renderPostingSelect = function () {
        const $select = $("[data-posting-select]");
        $("[data-posting-select]").closest(".employer-applications__posting-select").prop("hidden", postings.length === 0);
        $select.html(postings.map(posting => `
            <option value="${escapeHtml(posting.id)}">${escapeHtml(posting.title)} @ ${escapeHtml(posting.companyName)}</option>
        `).join(""));
        $select.val(activePostingId);
    };

    const renderSummary = function (posting) {
        $("[data-posting-summary]").prop("hidden", false).html(`
            <div>
                <h2>${escapeHtml(posting.title)}</h2>
                <p class="employer-applications__posting-meta">
                    <span>${escapeHtml(posting.companyName)}</span>
                    <span class="employer-applications__status employer-applications__status--${escapeHtml(posting.status)}">${escapeHtml(enumLabel(posting.status))}</span>
                </p>
            </div>
            <dl>
                <div>
                    <dt>Total Applicants</dt>
                    <dd>${escapeHtml(posting.applications.length)}</dd>
                </div>
            </dl>
        `);
    };

    const cardHtml = function (application, readOnly) {
        const candidate = application.candidate;

        return `
            <article class="employer-applications__card ${readOnly ? "is-read-only" : ""}" draggable="${readOnly ? "false" : "true"}" data-application-id="${escapeHtml(application.id)}">
                <div class="employer-applications__card-main">
                    <img src="${escapeHtml(candidate.avatarPath)}" alt="" />
                    <div>
                        <button type="button" data-profile-open="${escapeHtml(application.id)}">${escapeHtml(candidate.fullName)}</button>
                        ${candidate.highestEducation ? `<p>${escapeHtml(candidate.highestEducation)}</p>` : ""}
                    </div>
                </div>
            </article>
        `;
    };

    const renderBoard = function () {
        const posting = getPosting();
        const $board = $("[data-application-board]");

        if (!posting) {
            $("[data-empty-state]").prop("hidden", false);
            $("[data-posting-summary]").prop("hidden", true).empty();
            $board.prop("hidden", true).empty();
            return;
        }

        const readOnly = isReadOnlyPosting(posting);
        $("[data-empty-state]").prop("hidden", postings.length > 0);
        $board.prop("hidden", false).toggleClass("is-read-only", readOnly);
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
                        ${applications.length ? applications.map(application => cardHtml(application, readOnly)).join("") : `<p class="employer-applications__lane-empty">No candidates</p>`}
                    </div>
                </section>
            `;
        }).join(""));
    };

    const moveApplication = async function (applicationId, status) {
        const found = findApplication(applicationId);
        if (!found || found.application.status === status || isReadOnlyPosting(found.posting))
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

    const pillList = items => items && items.length
        ? `<div class="candidate-info__pills">${items.map(item => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
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
        const factRowsHtml = profileItems.reduce((rows, item, index) => {
            if (index % 2 === 0)
                rows.push([]);

            rows[rows.length - 1].push(item);
            return rows;
        }, []).map(row => `
            <div class="candidate-info__fact-row ${row.length === 1 ? "candidate-info__fact-row--single" : ""}">
                ${row.map(item => `
                    <div class="candidate-info__fact">
                        <span>${escapeHtml(item[0])}</span>
                        <p>${escapeHtml(item[1])}</p>
                    </div>
                `).join("")}
            </div>
        `).join("");

        $("[data-profile-content]").html(`
            <div class="candidate-info">
            <div class="candidate-info__header">
                <img src="${escapeHtml(candidate.avatarPath)}" alt="" />
                <div>
                    <h2 id="application-profile-title">${escapeHtml(candidate.fullName)}</h2>
                    ${[candidate.email, candidate.phone].filter(Boolean).length
                        ? `<p>${escapeHtml([candidate.email, candidate.phone].filter(Boolean).join(" | "))}</p>`
                        : ""}
                </div>
            </div>
            ${candidate.summary ? `<section class="candidate-info__section candidate-info__summary"><p>${escapeHtml(candidate.summary)}</p></section>` : ""}
            ${profileItems.length ? `
                <section class="candidate-info__section candidate-info__section--flush">
                    <div class="candidate-info__fact-grid">${factRowsHtml}</div>
                </section>
            ` : ""}
            ${(candidate.skills || []).length ? `<section class="candidate-info__section"><h3>Skills</h3>${pillList(candidate.skills)}</section>` : ""}
            ${(candidate.education || []).length ? `
                <section class="candidate-info__section">
                    <h3>Education</h3>
                    ${candidate.education.map(item => `
                        <div class="candidate-info__row">
                            <strong>${escapeHtml(item.qualificationLabel)}${item.major ? ` in ${escapeHtml(item.major)}` : ""}</strong>
                            ${item.school ? `<p>${escapeHtml(item.school)}</p>` : ""}
                        </div>
                    `).join("")}
                </section>
            ` : ""}
            ${(candidate.experience || []).length ? `
                <section class="candidate-info__section">
                    <h3>Experience</h3>
                    ${candidate.experience.map(item => `
                        <div class="candidate-info__row">
                            <strong>${escapeHtml(item.jobTitle || "Role")}</strong>
                            ${[item.company, item.location, item.workType ? enumLabel(item.workType) : ""].filter(Boolean).length
                                ? `<p>${escapeHtml([item.company, item.location, item.workType ? enumLabel(item.workType) : ""].filter(Boolean).join(" | "))}</p>`
                                : ""}
                            ${item.duties ? `<p class="candidate-info__long-text">${escapeHtml(item.duties)}</p>` : ""}
                        </div>
                    `).join("")}
                </section>
            ` : ""}
            ${(candidate.certifications || []).length ? `<section class="candidate-info__section"><h3>Certifications</h3>${pillList(candidate.certifications)}</section>` : ""}
            ${(candidate.languages || []).length ? `<section class="candidate-info__section"><h3>Languages</h3>${pillList(candidate.languages.map(item => `${item.name} | ${enumLabel(item.fluency)}`))}</section>` : ""}
            ${(candidate.portfolioLinks || []).length ? `
                <section class="candidate-info__section">
                    <h3>Portfolio</h3>
                    ${candidate.portfolioLinks.map(item => `
                        <div class="candidate-info__row">
                            <strong>${escapeHtml(item.label)}</strong>
                            <p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a></p>
                        </div>
                    `).join("")}
                </section>
            ` : ""}
            </div>
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
        if (isReadOnlyPosting(getPosting())) {
            event.preventDefault();
            draggedApplicationId = "";
            return;
        }

        draggedApplicationId = String($(this).attr("data-application-id") || "");
        event.originalEvent.dataTransfer.effectAllowed = "move";
    });
    $("[data-application-board]").on("dragover", "[data-drop-status]", function (event) {
        if (isReadOnlyPosting(getPosting()))
            return;

        event.preventDefault();
        $(this).closest("[data-lane-status]").addClass("is-over");
    });
    $("[data-application-board]").on("dragleave", "[data-drop-status]", function () {
        $(this).closest("[data-lane-status]").removeClass("is-over");
    });
    $("[data-application-board]").on("drop", "[data-drop-status]", function (event) {
        event.preventDefault();
        if (isReadOnlyPosting(getPosting())) {
            draggedApplicationId = "";
            return;
        }

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
