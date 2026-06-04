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

    const data = window.__employerPostings || {
        companies: [],
        postings: [],
        educationOptions: []
    };
    let postings = data.postings || [];
    let skills = [];
    let editingPosting = null;
    let currentStep = 0;

    const educationLabels = {
        CERTIFICATE_I: "Certificate I",
        CERTIFICATE_II: "Certificate II",
        CERTIFICATE_III: "Certificate III",
        CERTIFICATE_IV: "Certificate IV",
        DIPLOMA: "Diploma",
        ADVANCED_DIPLOMA: "Advanced Diploma",
        ASSOCIATE_DEGREE: "Associate Degree",
        BACHELORS_DEGREE: "Bachelor's Degree",
        GRADUATE_CERTIFICATE: "Graduate Certificate",
        GRADUATE_DIPLOMA: "Graduate Diploma",
        MASTERS_DEGREE: "Master's Degree",
        DOCTORAL_DEGREE: "Doctoral Degree"
    };
    const workModeLabels = {
        REMOTE: "Remote",
        HYBRID: "Hybrid",
        ONSITE: "On-site"
    };
    const jobTypeLabels = {
        FULL_TIME: "Full Time",
        PART_TIME: "Part Time",
        CASUAL: "Casual",
        CONTRACT: "Contract",
        INTERNSHIP: "Internship"
    };

    const escapeHtml = function (value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const showMessage = function (message, type = "error") {
        if (typeof toastr !== "undefined") {
            toastr[type](message);
            return;
        }

        window.alert(message);
    };

    const renderEmpty = function (text) {
        return `<p class="employer-postings__empty">${escapeHtml(text)}</p>`;
    };

    const canClose = function (posting) {
        return posting.canManage && posting.status === "ACTIVE";
    };

    const canReactivate = function (posting) {
        return posting.canManage && posting.status === "CLOSED";
    };

    const workModeIcon = function (workMode) {
        if (workMode === "REMOTE")
            return "far fa-star-half";

        if (workMode === "HYBRID")
            return "fas fa-star-half-alt";

        return "fas fa-star";
    };

    const renderPosting = function (posting) {
        return `
            <article class="employer-postings__card" data-posting-id="${escapeHtml(posting.id)}">
                <div class="employer-postings__card-top">
                    <div>
                        <h3><strong>${escapeHtml(posting.jobTitle)} @ ${escapeHtml(posting.companyName)}</strong></h3>
                        <p class="employer-postings__meta">
                            <span>${escapeHtml(posting.jobLocation)}</span>
                        </p>
                    </div>
                    <span class="employer-postings__mode-icon" aria-label="${escapeHtml(workModeLabels[posting.workMode] || posting.workMode)}">
                        <i class="${escapeHtml(workModeIcon(posting.workMode))}" aria-hidden="true"></i>
                    </span>
                    <span class="employer-postings__status employer-postings__status--${escapeHtml(posting.status)}">${escapeHtml(posting.status)}</span>
                </div>
                <p class="employer-postings__description">${escapeHtml(posting.jobDescription)}</p>
                <div class="employer-postings__card-actions">
                    ${posting.canManage && posting.status !== "CLOSED" ? '<button class="employer-postings__ghost" type="button" data-posting-edit>Edit</button>' : ""}
                    ${canClose(posting) ? '<button class="employer-postings__ghost" type="button" data-posting-status="CLOSED">Close</button>' : ""}
                    ${canReactivate(posting) ? '<button class="employer-postings__ghost" type="button" data-posting-status="ACTIVE">Set active</button>' : ""}
                    ${posting.canManage ? '<button class="employer-postings__danger" type="button" data-posting-delete>Remove</button>' : ""}
                </div>
            </article>
        `;
    };

    const renderPostings = function () {
        const active = postings.filter(posting => posting.status === "ACTIVE");
        const planned = postings.filter(posting => posting.status === "DRAFT");
        const past = postings.filter(posting => posting.status === "CLOSED");
        const hasAny = active.length || planned.length || past.length;

        $("[data-active-count]").text(active.length);
        $("[data-planned-count]").text(planned.length);
        $("[data-past-count]").text(past.length);
        $("[data-posting-section='ACTIVE']").prop("hidden", active.length === 0);
        $("[data-posting-section='DRAFT']").prop("hidden", planned.length === 0);
        $("[data-posting-section='CLOSED']").prop("hidden", past.length === 0);
        $("[data-all-empty]").prop("hidden", Boolean(hasAny));
        $("[data-active-postings]").html(active.map(renderPosting).join(""));
        $("[data-planned-postings]").html(planned.map(renderPosting).join(""));
        $("[data-past-postings]").html(past.map(renderPosting).join(""));
    };

    const fillSelects = function () {
        const $companySelect = $("[data-company-select]");
        const $educationSelect = $("[data-education-select]");
        $companySelect.html('<option value="">Select company</option>');
        $educationSelect.html('<option value="">Select education level</option>');

        data.companies.forEach(company => {
            $companySelect.append(`<option value="${escapeHtml(company.id)}">${escapeHtml(company.name)}</option>`);
        });

        data.educationOptions.forEach(option => {
            $educationSelect.append(`<option value="${escapeHtml(option)}">${escapeHtml(educationLabels[option] || option)}</option>`);
        });
    };

    const syncSkills = function () {
        $("[data-skills-value]").val(skills.join(","));
        $("[data-skill-list]").html(skills.map(skill => `
            <span class="employer-postings__skill">
                ${escapeHtml(skill)}
                <button type="button" aria-label="Remove ${escapeHtml(skill)}" data-remove-skill="${escapeHtml(skill)}">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </span>
        `).join(""));
    };

    const addSkill = function (value) {
        const skill = String(value || "").trim().replace(/\s+/g, " ");

        if (!skill)
            return;

        if (!skills.includes(skill))
            skills.push(skill);

        $("[data-skill-input]").val("");
        syncSkills();
    };

    const updateStep = function () {
        const $steps = $("[data-posting-step]");

        $steps.removeClass("is-active");
        $steps.eq(currentStep).addClass("is-active");
        $("[data-posting-progress]").each(function (index) {
            $(this)
                .toggleClass("is-active", index === currentStep)
                .toggleClass("is-complete", index < currentStep);
        });
        $("[data-posting-back]").prop("hidden", currentStep === 0);
        $("[data-posting-next]").prop("hidden", currentStep === $steps.length - 1);
        $("[data-posting-submit]").prop("hidden", currentStep !== $steps.length - 1);
    };

    const openModal = function (posting = null) {
        editingPosting = posting;
        skills = posting ? [...posting.skills] : [];
        currentStep = 0;
        const form = $("[data-posting-form]")[0];

        if (form)
            form.reset();

        $("[data-posting-form] .is-invalid").removeClass("is-invalid");
        $("[data-posting-modal-title]").text(posting ? "Edit posting" : "Create a posting");
        $("[data-posting-id]").val(posting ? posting.id : "");

        if (posting) {
            const $form = $("[data-posting-form]");
            $form.find("[name='jobTitle']").val(posting.jobTitle);
            $form.find("[name='companyId']").val(posting.companyId);
            $form.find("[name='jobDescription']").val(posting.jobDescription);
            $form.find("[name='requiredEducationLevel']").val(posting.requiredEducationLevel);
            $form.find("[name='requiredExperience']").val(posting.requiredExperience);
            $form.find("[name='workMode']").val(posting.workMode);
            $form.find("[name='jobLocation']").val(posting.jobLocation);
            $form.find("[name='jobType']").val(posting.jobType);
            $form.find("[name='status']").val(posting.status);
            $form.find("[name='salaryMin']").val(posting.salaryMin);
            $form.find("[name='salaryMax']").val(posting.salaryMax);
            $form.find("[name='closingDate']").val(posting.closingDate);
        }

        syncSkills();
        updateStep();
        $("[data-posting-modal]").prop("hidden", false).attr("aria-hidden", "false");
        $("body").addClass("is-posting-modal-open");
    };

    const closeModal = function () {
        $("[data-posting-modal]").prop("hidden", true).attr("aria-hidden", "true");
        $("body").removeClass("is-posting-modal-open");
        editingPosting = null;
        skills = [];
        currentStep = 0;
        syncSkills();
        updateStep();
    };

    const validateStep = function (stepIndex = currentStep) {
        let isValid = true;
        const $form = $("[data-posting-form]");
        const $step = $("[data-posting-step]").eq(stepIndex);
        $step.find(".is-invalid").removeClass("is-invalid");

        $step.find("input[required], textarea[required], select[required]").each(function () {
            const hasValue = String($(this).val() || "").trim().length > 0;

            if (!hasValue) {
                isValid = false;
                $(this).closest(".employer-postings__field").addClass("is-invalid");
            }
        });

        if ($step.find("[data-skills-value]").length && !skills.length) {
            isValid = false;
            $("[data-skill-input]").closest(".employer-postings__field").addClass("is-invalid");
        }

        if (!isValid)
            showMessage("Please complete all required posting fields.");

        return isValid;
    };

    const validateForm = function () {
        for (let index = 0; index < $("[data-posting-step]").length; index += 1) {
            if (!validateStep(index)) {
                currentStep = index;
                updateStep();
                return false;
            }
        }

        return true;
    };

    const submitPosting = async function (event) {
        event.preventDefault();

        if (!validateForm())
            return;

        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
        values.action = editingPosting ? "update" : "create";
        values.postingId = editingPosting ? editingPosting.id : "";
        values.skills = skills;

        $("[data-posting-submit]").prop("disabled", true).text("Saving...");

        try {
            const response = await fetch("/employer/posting", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(values)
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                showMessage(result.message || "Unable to save posting.");
                return;
            }

            showMessage(result.message, "success");
            window.location.reload();
        } catch (err) {
            console.error(err);
            showMessage("Unable to save posting.");
        } finally {
            $("[data-posting-submit]").prop("disabled", false).text("Save posting");
        }
    };

    const postAction = async function (payload) {
        const response = await fetch("/employer/posting", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            showMessage(result.message || "Unable to update posting.");
            return;
        }

        showMessage(result.message, "success");
        window.location.reload();
    };

    fillSelects();

    if (!data.companies.length) {
        $("[data-no-companies]").prop("hidden", false);
        $("[data-postings-content]").prop("hidden", true);
        $("[data-posting-open]").prop("disabled", true);
        return;
    }

    renderPostings();

    $("[data-posting-open]").on("click", function () {
        openModal();
    });
    $("[data-posting-close]").on("click", closeModal);
    $("[data-posting-form]").on("submit", submitPosting);
    $("[data-posting-next]").on("click", function () {
        if (!validateStep())
            return;

        currentStep = Math.min(currentStep + 1, $("[data-posting-step]").length - 1);
        updateStep();
    });
    $("[data-posting-back]").on("click", function () {
        currentStep = Math.max(currentStep - 1, 0);
        updateStep();
    });

    $("[data-skill-input]").on("keydown", function (event) {
        if (event.key !== "Enter")
            return;

        event.preventDefault();
        addSkill($(this).val());
    });

    $(document).on("click", "[data-remove-skill]", function () {
        const skill = $(this).attr("data-remove-skill");
        skills = skills.filter(item => item !== skill);
        syncSkills();
    });

    $(document).on("click", "[data-posting-edit]", function () {
        const postingId = $(this).closest("[data-posting-id]").attr("data-posting-id");
        const posting = postings.find(item => item.id === postingId);

        if (posting)
            openModal(posting);
    });

    $(document).on("click", "[data-posting-delete]", function () {
        const postingId = $(this).closest("[data-posting-id]").attr("data-posting-id");

        if (!window.confirm("Remove this posting?"))
            return;

        postAction({
            action: "delete",
            postingId
        });
    });

    $(document).on("click", "[data-posting-status]", function () {
        const postingId = $(this).closest("[data-posting-id]").attr("data-posting-id");
        const status = $(this).attr("data-posting-status");

        postAction({
            action: "status",
            postingId,
            status
        });
    });
});
