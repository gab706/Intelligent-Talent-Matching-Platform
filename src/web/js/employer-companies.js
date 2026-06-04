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

    const data = window.__employerCompanies || {
        companies: [],
        invitations: [],
        activeCompany: null
    };
    let currentStep = 0;
    let managerSearchTimer = null;
    let managedCompany = null;
    let selectedEmployee = null;

    const showMessage = function (message, type = "error") {
        if (typeof toastr !== "undefined" && typeof toastr[type] === "function") {
            toastr[type](message);
            return;
        }

        window.alert(message);
    };

    const escapeHtml = function (value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    };

    const roleLabel = function (role) {
        return role === "ADMIN" ? "Admin" : "User";
    };

    const organisationLabel = function (value) {
        return {
            PRIVATE_COMPANY: "Private Company",
            PUBLIC_COMPANY: "Public Company",
            GOVERNMENT_AGENCY: "Government Agency",
            UNIVERSITY: "University",
            NON_PROFIT: "Non-Profit",
            STARTUP: "Startup"
        }[value] || "Organisation";
    };

    const getMemberName = function (member) {
        return `${member.employer.user.firstName || ""} ${member.employer.user.lastName || ""}`.trim() || "Employer";
    };

    const getCompanyItem = function (companyId) {
        return data.companies.find(item => item.company.id === companyId);
    };

    const getCompanyUrl = function (company) {
        return `/employer/companies/${encodeURIComponent(company.name)}/view`;
    };

    const getCompanyEditUrl = function (company) {
        return `/employer/companies/${encodeURIComponent(company.name)}/edit`;
    };

    const renderCompanyContactRow = function (company) {
        const details = [
            company.email ? `<span><i class="fas fa-envelope" aria-hidden="true"></i>${escapeHtml(company.email)}</span>` : "",
            company.phone ? `<span><i class="fas fa-phone" aria-hidden="true"></i>${escapeHtml(company.phone)}</span>` : "",
            company.website ? `<a href="${escapeHtml(company.website)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-globe" aria-hidden="true"></i>${escapeHtml(company.website)}</a>` : ""
        ].filter(Boolean);

        if (!details.length)
            return '<p class="employer-companies__meta">No contact details added.</p>';

        return `<div class="employer-companies__card-contact">${details.join("")}</div>`;
    };

    const searchEmployers = async function (query) {
        const response = await fetch("/employer/search-employers", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success)
            throw new Error(result.message || "Unable to search employers.");

        return result.results || [];
    };

    const resetEmployeeModal = function () {
        selectedEmployee = null;
        $("[data-company-member-search]").val("");
        $("[data-company-member-suggestions]").empty();
        $("[data-selected-employee]").prop("hidden", true).empty();
        $("[data-employee-modal-actions]").prop("hidden", true);
        $("[data-employee-search-panel]").prop("hidden", false);
    };

    const openEmployeeModal = function () {
        resetEmployeeModal();
        $("[data-employee-modal]").prop("hidden", false).attr("aria-hidden", "false");
    };

    const closeEmployeeModal = function () {
        resetEmployeeModal();
        $("[data-employee-modal]").prop("hidden", true).attr("aria-hidden", "true");
    };

    const renderCompanies = function () {
        const $list = $("[data-company-list]");
        $list.empty();

        if (!data.companies.length) {
            $list.append('<p class="employer-companies__empty">You are not attached to any companies yet.</p>');
            return;
        }

        data.companies.forEach(item => {
            const company = item.company;
            const canManage = item.isOwner || item.role === "ADMIN";

            $list.append(`
                <article class="employer-companies__card" data-company-id="${escapeHtml(company.id)}">
                    <div class="employer-companies__brand-row">
                        ${company.logoUrl ? `<img class="employer-companies__logo" src="${escapeHtml(company.logoUrl)}" alt="" />` : '<span class="employer-companies__logo"></span>'}
                        <div>
                            <h3>${escapeHtml(company.name)}</h3>
                            <p class="employer-companies__meta">${escapeHtml(company.industry || "Industry not set")} / ${escapeHtml(company.location || "Location not set")}</p>
                        </div>
                    </div>
                    <p>${escapeHtml(company.description || "No company description added.")}</p>
                    ${renderCompanyContactRow(company)}
                    <div class="employer-companies__card-actions">
                        <a class="employer-companies__action-link" href="${escapeHtml(getCompanyUrl(company))}">View</a>
                        ${canManage ? `<a class="employer-companies__action-link" href="${escapeHtml(getCompanyEditUrl(company))}">Edit</a>` : ""}
                        ${item.isOwner
                            ? '<button class="employer-companies__danger" type="button" data-company-delete>Delete</button>'
                            : '<button class="employer-companies__danger" type="button" data-company-leave>Leave</button>'}
                    </div>
                </article>
            `);
        });
    };

    const renderCompanyPage = function () {
        const item = data.activeCompany;
        const $page = $("[data-company-page-content]");

        if (!item || !$page.length)
            return;

        const company = item.company;
        const ownerUserId = company.ownedById;
        const brandColour = company.brandColour || "";
        const isEditMode = data.activeCompanyMode === "edit";

        if (isEditMode) {
            managedCompany = item;
            $page.html(`
                <div class="employer-companies__company-layout employer-companies__company-layout--edit">
                    <form class="employer-companies__form employer-companies__edit-page-form" data-company-edit-form>
                        <input type="hidden" name="companyId" value="${escapeHtml(company.id)}" />
                        <label class="employer-companies__logo-upload employer-companies__logo-upload--edit">
                            <span>Company Logo</span>
                            <input name="logo" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" data-logo-input />
                            <span class="employer-companies__logo-preview">
                                ${company.logoUrl
                                    ? `<img src="${escapeHtml(company.logoUrl)}" alt="" />`
                                    : '<i class="fas fa-image" aria-hidden="true"></i>'}
                            </span>
                        </label>
                        <label class="employer-companies__field">
                            <span>Company Name</span>
                            <input name="name" type="text" required value="${escapeHtml(company.name || "")}" />
                        </label>
                        <label class="employer-companies__field">
                            <span>Short Company Description</span>
                            <textarea name="description" rows="4" required>${escapeHtml(company.description || "")}</textarea>
                        </label>
                        <div class="employer-companies__grid">
                            <label class="employer-companies__field">
                                <span>Industry</span>
                                <input name="industry" type="text" required value="${escapeHtml(company.industry || "")}" />
                            </label>
                            <label class="employer-companies__field">
                                <span>Company Location</span>
                                <input name="location" type="text" required value="${escapeHtml(company.location || "")}" />
                            </label>
                            <label class="employer-companies__field">
                                <span>Contact Email</span>
                                <input name="email" type="email" required value="${escapeHtml(company.email || "")}" />
                            </label>
                            <label class="employer-companies__field">
                                <span>Contact Phone</span>
                                <input name="phone" type="tel" required value="${escapeHtml(company.phone || "")}" />
                            </label>
                            <label class="employer-companies__field">
                                <span>Company Website</span>
                                <input name="website" type="url" placeholder="https://example.com" value="${escapeHtml(company.website || "")}" />
                            </label>
                            <label class="employer-companies__field">
                                <span>Brand Colour</span>
                                <input name="brandColour" type="color" value="${escapeHtml(company.brandColour || "#2563eb")}" />
                            </label>
                            <label class="employer-companies__field">
                                <span>Company Size</span>
                                <select name="size" required>
                                    <option value="">Select size</option>
                                    ${["1-10 Employees", "11-50 Employees", "51-200 Employees", "201-1000 Employees", "1000+"].map(size =>
                                        `<option ${company.size === size ? "selected" : ""}>${escapeHtml(size)}</option>`
                                    ).join("")}
                                </select>
                            </label>
                            <label class="employer-companies__field">
                                <span>Organisation Type</span>
                                <select name="organisationType" required>
                                    ${Object.entries({
                                        PRIVATE_COMPANY: "Private Company",
                                        PUBLIC_COMPANY: "Public Company",
                                        GOVERNMENT_AGENCY: "Government Agency",
                                        UNIVERSITY: "University",
                                        NON_PROFIT: "Non-Profit",
                                        STARTUP: "Startup"
                                    }).map(([value, label]) =>
                                        `<option value="${escapeHtml(value)}" ${company.organisationType === value ? "selected" : ""}>${escapeHtml(label)}</option>`
                                    ).join("")}
                                </select>
                            </label>
                        </div>
                        <div class="employer-companies__actions employer-companies__edit-actions">
                            <a class="employer-companies__ghost" href="${escapeHtml(getCompanyUrl(company))}">Cancel</a>
                            <button class="employer-companies__primary" type="submit">Save</button>
                        </div>
                    </form>

                    <section class="employer-companies__company-members employer-companies__company-members--edit" aria-labelledby="company-page-members-title">
                        <div class="employer-companies__member-section-header">
                            <h2 id="company-page-members-title">Company members</h2>
                            <button class="employer-companies__primary" type="button" data-employee-modal-open>
                                <i class="fas fa-plus" aria-hidden="true"></i>
                                Add Employee
                            </button>
                        </div>
                        <div class="employer-companies__member-current" data-company-current-members></div>
                    </section>
                </div>
            `);
            renderManager();
            return;
        }

        $page.html(`
            <div class="employer-companies__company-layout">
                <section class="employer-companies__company-info" aria-label="Company details">
                    <div class="employer-companies__detail-grid">
                        <div class="employer-companies__view-item">
                            <span>Industry</span>
                            <p>${escapeHtml(company.industry || "Not set")}</p>
                        </div>
                        <div class="employer-companies__view-item">
                            <span>Location</span>
                            <p>${escapeHtml(company.location || "Not set")}</p>
                        </div>
                        <div class="employer-companies__view-item">
                            <span>Company Size</span>
                            <p>${escapeHtml(company.size || "Not set")}</p>
                        </div>
                        <div class="employer-companies__view-item">
                            <span>Brand Colour</span>
                            ${brandColour
                                ? `<p><span class="employer-companies__colour-swatch" style="background: ${escapeHtml(brandColour)};"></span>${escapeHtml(brandColour)}</p>`
                                : "<p>Not set</p>"}
                        </div>
                    </div>
                </section>

                <section class="employer-companies__company-members" aria-labelledby="company-page-members-title">
                    <h2 id="company-page-members-title">Company members</h2>
                    <div class="employer-companies__page-member-list">
                        ${company.employers.map(member => {
                            const isOwner = member.employer.user.id === ownerUserId;
                            return `
                                <div class="employer-companies__page-member">
                                    <div>
                                        <div class="employer-companies__page-member-main">
                                            <strong>
                                                ${escapeHtml(getMemberName(member))}
                                                ${isOwner ? '<i class="fas fa-crown" aria-label="Owner"></i>' : ""}
                                            </strong>
                                            <span>${escapeHtml(isOwner ? "Owner" : roleLabel(member.role))}</span>
                                        </div>
                                        <p>${escapeHtml(member.employer.user.email)}</p>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                        ${(company.invitations || []).map(invitation => `
                            <div class="employer-companies__page-member employer-companies__page-member--pending">
                                <div>
                                    <div class="employer-companies__page-member-main">
                                        <strong>${escapeHtml(getMemberName({
                                            employer: invitation.recipientEmployer
                                        }))}</strong>
                                        <span><em>Pending - ${escapeHtml(roleLabel(invitation.role))}</em></span>
                                    </div>
                                    <p>${escapeHtml(invitation.recipientEmployer.user.email)}</p>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </section>
            </div>
        `);
    };

    const renderManager = function () {
        const $manager = $("[data-company-member-manager]");
        const $list = $("[data-company-current-members]");
        const isRoutedEditPage = data.activeCompanyMode === "edit";

        if (!managedCompany) {
            $manager.prop("hidden", true);
            return;
        }

        const company = managedCompany.company;
        const isOwner = managedCompany.isOwner;
        const actorRole = managedCompany.role;
        $("[data-company-member-title]").text(`Manage ${company.name}`);
        $list.empty();

        if (!company.employers.length) {
            $list.append('<p class="employer-companies__empty">No members are attached to this company yet.</p>');
            return;
        }

        company.employers.forEach(member => {
            const memberName = getMemberName(member);
            const isCompanyOwner = member.employer.user.id === company.ownedById;
            const canChangeRole = isOwner && !isCompanyOwner;
            const canRemoveMember = !isCompanyOwner && (isOwner || (actorRole === "ADMIN" && member.role !== "ADMIN"));
            $list.append(`
                <div class="employer-companies__member employer-companies__member--current" data-company-member-id="${escapeHtml(member.employer.id)}">
                    <div>
                        <strong>${escapeHtml(memberName)}</strong>
            <p class="employer-companies__meta">${escapeHtml(member.employer.user.email)}</p>
                    </div>
                    ${canChangeRole ? `
                        <select data-company-member-role>
                            <option value="USER" ${member.role === "USER" ? "selected" : ""}>User</option>
                            <option value="ADMIN" ${member.role === "ADMIN" ? "selected" : ""}>Admin</option>
                        </select>
                    ` : `<span class="employer-companies__member-role">${escapeHtml(isCompanyOwner ? "Owner" : roleLabel(member.role))}</span>`}
                    ${canRemoveMember ? '<button class="employer-companies__danger" type="button" data-company-member-remove>Remove</button>' : ""}
                </div>
            `);
        });

        (company.invitations || []).forEach(invitation => {
            $list.append(`
                <div class="employer-companies__member employer-companies__member--current employer-companies__member--pending" data-company-invitation-id="${escapeHtml(invitation.id)}">
                    <div>
                        <strong>${escapeHtml(getMemberName({
                            employer: invitation.recipientEmployer
                        }))}</strong>
                        <p class="employer-companies__meta">${escapeHtml(invitation.recipientEmployer.user.email)}</p>
                    </div>
                    <span class="employer-companies__member-role"><em>Pending - ${escapeHtml(roleLabel(invitation.role))}</em></span>
                    <button class="employer-companies__danger" type="button" data-company-invitation-cancel>Cancel</button>
                </div>
            `);
        });

        if (!isRoutedEditPage)
            $manager.prop("hidden", false);
    };

    const renderView = function (item) {
        const company = item.company;
        const website = company.website || "";
        $("[data-company-view-title]").text(company.name);
        $("[data-company-view-body]").html(`
            <div class="employer-companies__view-item employer-companies__view-item--full">
                <span>Description</span>
                <p>${escapeHtml(company.description || "No company description added.")}</p>
            </div>
            <div class="employer-companies__view-item">
                <span>Industry</span>
                <p>${escapeHtml(company.industry || "Not set")}</p>
            </div>
            <div class="employer-companies__view-item">
                <span>Location</span>
                <p>${escapeHtml(company.location || "Not set")}</p>
            </div>
            <div class="employer-companies__view-item">
                <span>Contact Email</span>
                <p>${escapeHtml(company.email || "Not set")}</p>
            </div>
            <div class="employer-companies__view-item">
                <span>Contact Phone</span>
                <p>${escapeHtml(company.phone || "Not set")}</p>
            </div>
            <div class="employer-companies__view-item">
                <span>Company Size</span>
                <p>${escapeHtml(company.size || "Not set")}</p>
            </div>
            <div class="employer-companies__view-item">
                <span>Organisation Type</span>
                <p>${escapeHtml(organisationLabel(company.organisationType))}</p>
            </div>
            <div class="employer-companies__view-item employer-companies__view-item--full">
                <span>Website</span>
                ${website
                    ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a>`
                    : "<p>Not set</p>"}
            </div>
        `);
        $("[data-company-viewer]").prop("hidden", false);
    };

    const renderEditor = function (item) {
        const company = item.company;
        $("[data-company-edit-title]").text(`Edit ${company.name}`);
        $("[data-edit-company-id]").val(company.id);
        $("[data-edit-name]").val(company.name || "");
        $("[data-edit-description]").val(company.description || "");
        $("[data-edit-industry]").val(company.industry || "");
        $("[data-edit-location]").val(company.location || "");
        $("[data-edit-email]").val(company.email || "");
        $("[data-edit-phone]").val(company.phone || "");
        $("[data-edit-website]").val(company.website || "");
        $("[data-edit-brand-colour]").val(company.brandColour || "#2563eb");
        $("[data-edit-size]").val(company.size || "");
        $("[data-edit-organisation-type]").val(company.organisationType || "");
        $("[data-edit-logo-upload] input").val("");
        $("[data-edit-logo-preview]").html(
            company.logoUrl
                ? `<img src="${escapeHtml(company.logoUrl)}" alt="" />`
                : '<i class="fas fa-image" aria-hidden="true"></i>'
        );
        $("[data-company-editor]").prop("hidden", false);
    };

    const renderInvitations = function () {
        const $section = $("[data-company-invitations-section]");
        const $list = $("[data-company-invitations]");
        $list.empty();

        if (!data.invitations.length) {
            $section.prop("hidden", true);
            return;
        }

        $section.prop("hidden", false);
        data.invitations.forEach(invitation => {
            const company = invitation.company;
            $list.append(`
                <article class="employer-companies__card employer-companies__card--invite" data-invitation-id="${escapeHtml(invitation.id)}">
                    <div class="employer-companies__brand-row">
                        ${company.logoUrl ? `<img class="employer-companies__logo" src="${escapeHtml(company.logoUrl)}" alt="" />` : '<span class="employer-companies__logo"></span>'}
                        <div>
                            <h3>${escapeHtml(company.name)}</h3>
                            <p class="employer-companies__meta">${escapeHtml(company.industry || "Industry not set")} / ${escapeHtml(company.location || "Location not set")}</p>
                        </div>
                    </div>
                    <p>${escapeHtml(company.description || "No company description added.")}</p>
                    ${renderCompanyContactRow(company)}
                    <div class="employer-companies__card-actions">
                        <button class="employer-companies__primary" type="button" data-invitation-action="accept">Accept</button>
                        <button class="employer-companies__decline" type="button" data-invitation-action="decline">Decline</button>
                    </div>
                </article>
            `);
        });
    };

    const updateStep = function () {
        $("[data-company-step]").removeClass("is-active").eq(currentStep).addClass("is-active");
        $("[data-company-progress]").each(function (index) {
            $(this)
                .toggleClass("is-active", index === currentStep)
                .toggleClass("is-complete", index < currentStep);
        });
        $("[data-company-back]").prop("hidden", currentStep === 0);
        $("[data-company-next]")
            .attr("type", currentStep === 2 ? "submit" : "button")
            .text(currentStep === 2 ? "Create" : "Next");
    };

    const validateStep = function () {
        const $currentRequired = $("[data-company-step]").eq(currentStep).find("[required]");
        let isValid = true;

        for (const input of $currentRequired) {
            const $input = $(input);
            const hasValue = input.type === "file"
                ? input.files && input.files.length > 0
                : String($input.val() || "").trim().length > 0;

            $input.closest(".employer-companies__field, .employer-companies__logo-upload").toggleClass("is-invalid", !hasValue);

            if (!hasValue) {
                if (isValid)
                    input.focus();
                isValid = false;
            }
        }

        return isValid;
    };

    const validateAllCreateFields = function () {
        let firstInvalidStep = null;
        let isValid = true;

        $("[data-company-step]").each(function (stepIndex) {
            $(this).find("[required]").each(function () {
                const hasValue = this.type === "file"
                    ? this.files && this.files.length > 0
                    : String($(this).val() || "").trim().length > 0;

                $(this).closest(".employer-companies__field, .employer-companies__logo-upload").toggleClass("is-invalid", !hasValue);

                if (!hasValue) {
                    isValid = false;
                    if (firstInvalidStep === null)
                        firstInvalidStep = stepIndex;
                }
            });
        });

        if (!isValid && firstInvalidStep !== null) {
            currentStep = firstInvalidStep;
            updateStep();
            $("[data-company-step]").eq(firstInvalidStep).find(".is-invalid").first().find("input, textarea, select").trigger("focus");
        }

        return isValid;
    };

    const resetCompanyCreate = function () {
        const form = $("[data-company-form]")[0];

        if (form)
            form.reset();

        currentStep = 0;
        $("[data-company-form] .is-invalid").removeClass("is-invalid");
        $("[data-company-logo-preview]").html('<i class="fas fa-image" aria-hidden="true"></i>');
        updateStep();
    };

    $("[data-company-create-open]").on("click", function () {
        resetCompanyCreate();
        $("[data-company-creator]").prop("hidden", false);
        $("[data-company-creator]").attr("aria-hidden", "false");
        $("body").addClass("is-company-create-open");
        currentStep = 0;
        updateStep();
    });

    $("[data-company-create-close]").on("click", function () {
        resetCompanyCreate();
        $("[data-company-creator]").prop("hidden", true);
        $("[data-company-creator]").attr("aria-hidden", "true");
        $("body").removeClass("is-company-create-open");
    });

    $("[data-company-back]").on("click", function () {
        currentStep = Math.max(0, currentStep - 1);
        updateStep();
    });

    $("[data-company-next]").on("click", function () {
        if (currentStep === 2)
            return;

        if (!validateStep())
            return;

        currentStep = Math.min(2, currentStep + 1);
        updateStep();
    });

    $(document).on("input change", "[data-company-form] input, [data-company-form] textarea, [data-company-form] select", function () {
        const input = this;
        const hasValue = input.type === "file"
            ? input.files && input.files.length > 0
            : String($(input).val() || "").trim().length > 0;

        if (hasValue)
            $(input).closest(".employer-companies__field, .employer-companies__logo-upload").removeClass("is-invalid");
    });

    $(document).on("change", "[data-company-logo-input], [data-logo-input]", function () {
        const file = this.files && this.files[0];
        const $preview = $(this).closest(".employer-companies__logo-upload").find(".employer-companies__logo-preview");

        if (!file) {
            $preview.html('<i class="fas fa-image" aria-hidden="true"></i>');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            $preview.html(`<img src="${escapeHtml(event.target.result)}" alt="" />`);
        };
        reader.readAsDataURL(file);
    });

    $(document).on("click", "[data-employee-modal-open]", openEmployeeModal);
    $(document).on("click", "[data-employee-modal-close]", closeEmployeeModal);
    $(document).on("click", ".employer-companies__employee-dialog", function (event) {
        event.stopPropagation();
    });

    $(document).on("click", "[data-company-view]", function () {
        const companyId = $(this).closest("[data-company-id]").attr("data-company-id");
        const item = getCompanyItem(companyId);

        if (item)
            window.location.href = getCompanyUrl(item.company);
    });

    $("[data-company-view-close]").on("click", function () {
        $("[data-company-viewer]").prop("hidden", true);
    });

    $(document).on("click", "[data-company-edit]", function () {
        const companyId = $(this).closest("[data-company-id]").attr("data-company-id");
        const item = getCompanyItem(companyId);

        if (item)
            renderEditor(item);
    });

    $("[data-company-edit-close]").on("click", function () {
        $("[data-company-editor]").prop("hidden", true);
    });

    $("[data-company-page-manage]").on("click", function () {
        if (data.activeCompany)
            renderEditor(data.activeCompany);
    });

    $(document).on("input", "[data-company-member-search]", function () {
        const query = String($(this).val() || "").trim();
        clearTimeout(managerSearchTimer);

        if (!managedCompany || query.length < 1) {
            $("[data-company-member-suggestions]").empty();
            return;
        }

        managerSearchTimer = window.setTimeout(async function () {
            const $suggestions = $("[data-company-member-suggestions]");
            const companyMemberIds = [
                ...managedCompany.company.employers.map(member => member.employer.id),
                ...(managedCompany.company.invitations || []).map(invitation => invitation.recipientEmployer.id)
            ];
            $suggestions.empty();

            try {
                const results = await searchEmployers(query);

                if (!results.length) {
                    $suggestions.append('<p class="employer-companies__empty">No matching employers found.</p>');
                    return;
                }

                results.forEach(employer => {
                    if (companyMemberIds.includes(employer.id))
                        return;

                    $suggestions.append(`
                        <div class="employer-companies__suggestion">
                            <div>
                                <strong>${escapeHtml(employer.name)}</strong>
                                <p class="employer-companies__meta">${escapeHtml(employer.email)}</p>
                            </div>
                            <div class="employer-companies__suggestion-actions">
                                <button class="employer-companies__primary" type="button" data-select-employee="${escapeHtml(employer.id)}" data-name="${escapeHtml(employer.name)}" data-email="${escapeHtml(employer.email)}">
                                    <i class="fas fa-plus" aria-hidden="true"></i>
                                    Select
                                </button>
                            </div>
                        </div>
                    `);
                });

                if (!$suggestions.children().length)
                    $suggestions.append('<p class="employer-companies__empty">No new matching employers found.</p>');
            } catch (err) {
                console.error(err);
                $suggestions.append('<p class="employer-companies__empty">Unable to search employers right now.</p>');
            }
        }, 220);
    });

    $(document).on("click", "[data-select-employee]", function () {
        selectedEmployee = {
            id: $(this).attr("data-select-employee"),
            name: $(this).attr("data-name"),
            email: $(this).attr("data-email")
        };
        $("[data-employee-search-panel]").prop("hidden", true);
        $("[data-selected-employee]").prop("hidden", false).html(`
            <strong>${escapeHtml(selectedEmployee.name)}</strong>
            <p>${escapeHtml(selectedEmployee.email)}</p>
            ${managedCompany && managedCompany.isOwner ? `
                <label class="employer-companies__field employer-companies__selected-role">
                    <span>Role</span>
                    <select data-selected-employee-role>
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                </label>
            ` : ""}
        `);
        $("[data-employee-modal-actions]").prop("hidden", false);
    });

    $(document).on("click", "[data-employee-selection-cancel]", closeEmployeeModal);

    $(document).on("click", "[data-company-invite-selected]", async function () {
        if (!managedCompany)
            return;

        if (!selectedEmployee)
            return;

        const role = $("[data-selected-employee-role]").val() || "USER";
        const response = await fetch("/employer/company-members", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "invite",
                companyId: managedCompany.company.id,
                employerId: selectedEmployee.id,
                role
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showMessage(result.message || "Unable to invite employer.");
            return;
        }

        showMessage(result.message, "success");
        window.location.reload();
    });

    $(document).on("click", "[data-company-invitation-cancel]", async function () {
        if (!managedCompany)
            return;

        const invitationId = $(this).closest("[data-company-invitation-id]").attr("data-company-invitation-id");
        const response = await fetch("/employer/company-members", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "cancel-invitation",
                companyId: managedCompany.company.id,
                invitationId
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showMessage(result.message || "Unable to cancel invitation.");
            return;
        }

        showMessage(result.message, "success");
        window.location.reload();
    });

    $(document).on("change", "[data-company-member-role]", async function () {
        if (!managedCompany)
            return;

        const $member = $(this).closest("[data-company-member-id]");
        const employerId = $member.attr("data-company-member-id");
        const role = String($(this).val() || "USER");
        const response = await fetch("/employer/company-members", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "role",
                companyId: managedCompany.company.id,
                employerId,
                role
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showMessage(result.message || "Unable to update member role.");
            return;
        }

        showMessage(result.message, "success");
        window.location.reload();
    });

    $(document).on("click", "[data-company-member-remove]", async function () {
        if (!managedCompany)
            return;

        const $member = $(this).closest("[data-company-member-id]");
        const employerId = $member.attr("data-company-member-id");

        if (!window.confirm("Remove this member from the company?"))
            return;

        const response = await fetch("/employer/company-members", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "remove",
                companyId: managedCompany.company.id,
                employerId
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showMessage(result.message || "Unable to remove member.");
            return;
        }

        showMessage(result.message, "success");
        window.location.reload();
    });

    $("[data-company-form]").on("submit", async function (event) {
        event.preventDefault();

        if (currentStep !== 2)
            return;

        if (!validateAllCreateFields())
            return;

        const formData = new FormData(this);
        formData.append("members", JSON.stringify([]));
        $("[data-company-next]").prop("disabled", true).text("Creating...");

        try {
            const response = await fetch("/employer/companies-create", {
                method: "POST",
                body: formData
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                showMessage(result.message || "Unable to create company.");
                return;
            }

            showMessage("Company created successfully.", "success");
            window.location.reload();
        } catch (err) {
            console.error(err);
            showMessage("Unable to create company.");
        } finally {
            $("[data-company-next]").prop("disabled", false);
            updateStep();
        }
    });

    $(document).on("submit", "[data-company-edit-form]", async function (event) {
        event.preventDefault();

        const formData = new FormData(this);
        const values = Object.fromEntries(formData.entries());
        const response = await fetch("/employer/company-update", {
            method: "POST",
            body: formData
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showMessage(result.message || "Unable to update company.");
            return;
        }

        showMessage(result.message, "success");
        window.location.href = `/employer/companies/${encodeURIComponent(result.companyName || values.name)}/view`;
    });

    $(document).on("click", "[data-invitation-action]", async function () {
        const $invite = $(this).closest("[data-invitation-id]");
        const invitationId = $invite.attr("data-invitation-id");
        const action = $(this).attr("data-invitation-action");
        const response = await fetch("/employer/company-invitation", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                invitationId,
                action
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showMessage(result.message || "Unable to update invitation.");
            return;
        }

        showMessage(result.message, "success");
        window.location.reload();
    });

    $(document).on("click", "[data-company-leave], [data-company-delete]", async function () {
        const companyId = $(this).closest("[data-company-id]").attr("data-company-id");
        const action = $(this).is("[data-company-delete]") ? "delete" : "leave";

        if (action === "delete" && !window.confirm("Delete this company?"))
            return;

        const response = await fetch("/employer/company-action", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                companyId,
                action
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showMessage(result.message || "Unable to update company.");
            return;
        }

        showMessage(result.message, "success");
        window.location.reload();
    });

    renderCompanies();
    renderInvitations();
    renderCompanyPage();
    updateStep();
});
