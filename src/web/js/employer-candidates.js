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

    const data = window.__candidateSearch || { candidates: [], postings: [] };
    const rawCandidates = data.candidates || [];
    const postings = data.postings || [];
    const perPage = 10;
    let currentPage = 1;
    let matched = [];
    let recommendationCandidateId = "";
    let filterSkills = [];

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

    function normalise(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/['’]/g, "")
            .replace(/[^a-z0-9+#./\s-]/g, " ")
            .replace(/[-_/]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function uniqueTokens(value) {
        return Array.from(new Set(normalise(value).split(" ").filter(token => token.length > 1)));
    }

    function levenshtein(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;

        const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
        const current = new Array(b.length + 1);

        for (let i = 1; i <= a.length; i += 1) {
            current[0] = i;
            for (let j = 1; j <= b.length; j += 1) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                current[j] = Math.min(
                    current[j - 1] + 1,
                    previous[j] + 1,
                    previous[j - 1] + cost
                );
            }
            for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
        }

        return previous[b.length];
    }

    function fuzzyMatchesTerm(term, tokens, text) {
        const cleanTerm = normalise(term);
        if (!cleanTerm) return true;
        if (text.includes(cleanTerm)) return true;

        return tokens.some(token => {
            if (token.includes(cleanTerm) || cleanTerm.includes(token)) return true;
            const maxDistance = cleanTerm.length <= 5 ? 1 : 2;
            return Math.abs(token.length - cleanTerm.length) <= maxDistance
                && levenshtein(cleanTerm, token) <= maxDistance;
        });
    }

    function fuzzyAllTermsMatch(query, tokens, text) {
        const terms = uniqueTokens(query);
        return !terms.length || terms.every(term => fuzzyMatchesTerm(term, tokens, text));
    }

    function fuzzyAnyTermMatch(query, tokens, text) {
        const terms = uniqueTokens(query);
        return !terms.length || terms.some(term => fuzzyMatchesTerm(term, tokens, text));
    }

    function collectCandidateText(candidate) {
        const profile = candidate.profile || {};
        const personal = profile.personal || {};
        const preferences = profile.preferences || {};
        const values = [
            candidate.fullName,
            personal.firstName,
            personal.lastName,
            preferences.profileSummary,
            preferences.legacyEducation,
            preferences.legacyMajor,
            preferences.workExperience,
            preferences.preferredLocation,
            preferences.availability,
            preferences.portfolioUrl,
            preferences.linkedinUrl,
            candidate.availability,
            candidate.highestEducation,
            ...(profile.skills || []),
            ...(profile.education || []).flatMap(item => [
                item.school,
                item.qualificationType,
                item.major
            ]),
            ...(profile.experience || []).flatMap(item => [
                item.company,
                item.jobTitle,
                item.workType,
                item.location,
                item.duties
            ]),
            ...(profile.portfolioLinks || []).flatMap(item => [
                item.label,
                item.url
            ])
        ];

        return values.filter(Boolean).join(" ");
    }

    function enrichCandidate(candidate) {
        const searchText = normalise(collectCandidateText(candidate));
        const skillText = normalise(((candidate.profile || {}).skills || []).join(" "));
        return {
            ...candidate,
            searchText,
            searchTokens: uniqueTokens(searchText),
            skillText,
            skillTokens: uniqueTokens(skillText)
        };
    }

    const candidates = rawCandidates.map(candidate => enrichCandidate(candidate));

    function qualificationRank(value) {
        const order = [
            "CERTIFICATE_I",
            "CERTIFICATE_II",
            "CERTIFICATE_III",
            "CERTIFICATE_IV",
            "DIPLOMA",
            "ADVANCED_DIPLOMA",
            "ASSOCIATE_DEGREE",
            "BACHELORS_DEGREE",
            "GRADUATE_CERTIFICATE",
            "GRADUATE_DIPLOMA",
            "MASTERS_DEGREE",
            "DOCTORAL_DEGREE"
        ];
        return order.indexOf(value);
    }

    function qualificationLabel(value) {
        const labels = {
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

        return labels[value] || String(value || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
    }

    function enumLabel(value) {
        return String(value || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
    }

    function candidateMeetsEducation(candidate, requiredEducation) {
        if (!requiredEducation) return true;
        const requiredRank = qualificationRank(requiredEducation);
        if (requiredRank < 0) return true;

        return ((candidate.profile || {}).education || []).some(item => {
            const rank = qualificationRank(item.qualificationType);
            return rank >= requiredRank;
        });
    }

    function candidateMeetsExperience(candidate, range) {
        if (!range) return true;
        const years = Number(candidate.yearsOfExperience || 0);

        if (range === "0-1") return years >= 0 && years <= 1;
        if (range === "1-3") return years >= 1 && years <= 3;
        if (range === "3-5") return years >= 3 && years <= 5;
        if (range === "5+") return years >= 5;

        return true;
    }

    function getFilters() {
        return {
            skills: [...filterSkills],
            education: String($("[data-filter-education]").val() || ""),
            experience: String($("[data-filter-experience]").val() || ""),
            workingMode: String($("[data-filter-working-mode]").val() || ""),
            location: String($("[data-filter-location]").val() || ""),
            jobType: String($("[data-filter-job-type]").val() || "")
        };
    }

    function getActiveFilterCount() {
        const filters = getFilters();
        return [
            filters.skills.length ? filters.skills.join(" ") : "",
            filters.education,
            filters.experience,
            filters.workingMode,
            filters.location,
            filters.jobType
        ].filter(value => normalise(value)).length;
    }

    function updateFilterCount() {
        const count = getActiveFilterCount();
        const $count = $("[data-filter-count]");
        $count.prop("hidden", count === 0).text(count);
    }

    function filterLabel(key, value) {
        const labels = {
            skills: "Skills",
            education: "Education",
            experience: "Experience",
            workingMode: "Working mode",
            location: "Location",
            jobType: "Job type"
        };
        const selectLabels = {
            education: qualificationLabel(value),
            workingMode: enumLabel(value),
            jobType: enumLabel(value)
        };

        return `${labels[key]}: ${selectLabels[key] || value}`;
    }

    function renderFilterSkills() {
        $("[data-filter-skill-list]").html(filterSkills.map(skill => `
            <span class="employer-candidates__filter-chip">
                ${escapeHtml(skill)}
                <button type="button" aria-label="Remove ${escapeHtml(skill)}" data-filter-skill-remove="${escapeHtml(skill)}">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </span>
        `).join(""));
    }

    function renderActiveFilters() {
        const filters = getFilters();
        const activeFilters = [
            filters.skills.length ? ["skills", filterSkills.join(", ")] : null,
            filters.education ? ["education", filters.education] : null,
            filters.experience ? ["experience", filters.experience] : null,
            filters.workingMode ? ["workingMode", filters.workingMode] : null,
            filters.location ? ["location", filters.location] : null,
            filters.jobType ? ["jobType", filters.jobType] : null
        ].filter(Boolean);
        const $activeFilters = $("[data-active-filters]");

        $activeFilters.prop("hidden", activeFilters.length === 0);
        $("[data-filter-clear-outside]").prop("hidden", activeFilters.length === 0);
        $activeFilters.html(activeFilters.map(([key, value]) => `
            <span class="employer-candidates__filter-chip">
                ${escapeHtml(filterLabel(key, value))}
                <button type="button" aria-label="Remove ${escapeHtml(filterLabel(key, value))}" data-filter-remove="${escapeHtml(key)}">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </span>
        `).join(""));
    }

    function addFilterSkill(value) {
        const skill = String(value || "").trim().replace(/\s+/g, " ");

        if (!skill)
            return;

        if (!filterSkills.some(item => normalise(item) === normalise(skill)))
            filterSkills.push(skill);

        $("[data-filter-skill-input]").val("");
        renderFilterSkills();
    }

    function clearFilters() {
        filterSkills = [];
        $("[data-filter-location]").val("");
        $("[data-filter-education], [data-filter-experience], [data-filter-working-mode], [data-filter-job-type]").val("");
        $("[data-filter-skill-input]").val("");
        renderFilterSkills();
        filterCandidates();
    }

    function removeFilter(key) {
        if (key === "skills")
            filterSkills = [];
        if (key === "education")
            $("[data-filter-education]").val("");
        if (key === "experience")
            $("[data-filter-experience]").val("");
        if (key === "workingMode")
            $("[data-filter-working-mode]").val("");
        if (key === "location")
            $("[data-filter-location]").val("");
        if (key === "jobType")
            $("[data-filter-job-type]").val("");

        renderFilterSkills();
        filterCandidates();
    }

    function candidateMatchesFilters(candidate, filters) {
        const preferences = ((candidate.profile || {}).preferences || {});
        const skillsMatch = !filters.skills.length
            || filters.skills.every(skill => fuzzyAllTermsMatch(skill, candidate.skillTokens, candidate.skillText));
        const educationMatch = candidateMeetsEducation(candidate, filters.education);
        const experienceMatch = candidateMeetsExperience(candidate, filters.experience);
        const workingModeMatch = !filters.workingMode || preferences.preferredWorkingMode === filters.workingMode;
        const locationText = normalise(preferences.preferredLocation || "");
        const locationMatch = !filters.location || fuzzyAllTermsMatch(filters.location, uniqueTokens(locationText), locationText);
        const jobTypeMatch = !filters.jobType || preferences.preferredJobType === filters.jobType;

        return skillsMatch
            && educationMatch
            && experienceMatch
            && workingModeMatch
            && locationMatch
            && jobTypeMatch;
    }

    const renderRows = function () {
        const pageCount = Math.max(1, Math.ceil(matched.length / perPage));
        currentPage = Math.min(currentPage, pageCount);
        const pageItems = matched.slice((currentPage - 1) * perPage, currentPage * perPage);

        $("[data-candidate-list]").html(pageItems.map(candidate => `
            <tr>
                <td><button class="employer-candidates__name" type="button" data-candidate-profile="${escapeHtml(candidate.id)}">${escapeHtml(candidate.fullName)}</button></td>
                <td>${escapeHtml(candidate.highestEducation)}</td>
                <td>${escapeHtml(String(candidate.yearsOfExperience || 0))} years</td>
                <td>${escapeHtml(candidate.availability)}</td>
            </tr>
        `).join(""));
        $("[data-candidate-empty]").prop("hidden", matched.length > 0);
        $("[data-candidate-count]").text(`Showing ${matched.length} of ${candidates.length}`).attr("data-candidate-total", candidates.length);
        renderPagination(pageCount);
    };

    const renderPagination = function (pageCount) {
        const $pagination = $("[data-candidate-pagination]");
        $pagination.empty();

        if (!matched.length) {
            $pagination.prop("hidden", true);
            return;
        }

        $pagination.prop("hidden", false);
        for (let page = 1; page <= pageCount; page += 1) {
            $pagination.append(`<button class="employer-candidates__page ${page === currentPage ? "is-active" : ""}" type="button" data-page="${page}">${page}</button>`);
        }
    };

    const filterCandidates = function () {
        const query = String($("[data-candidate-search]").val() || "");
        const filters = getFilters();

        matched = candidates.filter(candidate => {
            const keywordMatch = fuzzyAnyTermMatch(query, candidate.searchTokens, candidate.searchText);
            return keywordMatch && candidateMatchesFilters(candidate, filters);
        });
        currentPage = 1;
        $("[data-candidate-search-clear]").prop("hidden", !normalise(query));
        updateFilterCount();
        renderActiveFilters();
        renderRows();
    };

    const renderProfile = function (candidate) {
        const profile = candidate.profile;
        const personal = profile.personal || {};
        const preferences = profile.preferences || {};
        const contact = [personal.email, personal.phone].filter(Boolean).join(" | ");
        const profileItems = [
            candidate.highestEducation && candidate.highestEducation !== "Not set"
                ? ["Highest education", candidate.highestEducation]
                : null,
            Number(candidate.yearsOfExperience || 0) > 0
                ? ["Experience", `${candidate.yearsOfExperience} years`]
                : null,
            candidate.availability && candidate.availability !== "Not set"
                ? ["Availability", candidate.availability]
                : null,
            preferences.preferredLocation
                ? ["Preferred location", preferences.preferredLocation]
                : null,
            preferences.preferredWorkingMode
                ? ["Working mode", enumLabel(preferences.preferredWorkingMode)]
                : null,
            preferences.preferredJobType
                ? ["Job type", enumLabel(preferences.preferredJobType)]
                : null
        ].filter(Boolean);
        const pillList = items => items && items.length
            ? `<div class="candidate-info__pills">${items.map(item => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
            : "";
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
        const profileHtml = profileItems.length
            ? `
                <section class="candidate-info__section candidate-info__section--flush">
                    <div class="candidate-info__fact-grid">${factRowsHtml}</div>
                </section>
            `
            : "";
        const summaryHtml = preferences.profileSummary
            ? `
                <section class="candidate-info__section candidate-info__summary">
                    <p>${escapeHtml(preferences.profileSummary)}</p>
                </section>
            `
            : "";
        const skillsHtml = (profile.skills || []).length
            ? `
                <section class="candidate-info__section">
                    <h3>Skills</h3>
                    ${pillList(profile.skills)}
                </section>
            `
            : "";
        const educationHtml = (profile.education || []).length
            ? `
                <section class="candidate-info__section">
                    <h3>Education</h3>
                    ${(profile.education || []).map(item => `
                        <div class="candidate-info__row">
                            <strong>${escapeHtml(qualificationLabel(item.qualificationType))}${item.major ? ` in ${escapeHtml(item.major)}` : ""}</strong>
                            ${item.school ? `<p>${escapeHtml(item.school)}</p>` : ""}
                        </div>
                    `).join("")}
                </section>
            `
            : "";
        const experienceHtml = (profile.experience || []).length
            ? `
                <section class="candidate-info__section">
                    <h3>Experience</h3>
                    ${(profile.experience || []).map(item => `
                        <div class="candidate-info__row">
                            <strong>${escapeHtml(item.jobTitle || "Role")}</strong>
                            ${[item.company, item.location, item.workType ? enumLabel(item.workType) : ""].filter(Boolean).length
                                ? `<p>${escapeHtml([item.company, item.location, item.workType ? enumLabel(item.workType) : ""].filter(Boolean).join(" | "))}</p>`
                                : ""}
                            ${item.duties ? `<p class="candidate-info__long-text">${escapeHtml(item.duties)}</p>` : ""}
                        </div>
                    `).join("")}
                </section>
            `
            : "";
        const certificationsHtml = (profile.certifications || []).length
            ? `
                <section class="candidate-info__section">
                    <h3>Certifications</h3>
                    ${pillList(profile.certifications)}
                </section>
            `
            : "";
        const languagesHtml = (profile.languages || []).length
            ? `
                <section class="candidate-info__section">
                    <h3>Languages</h3>
                    ${pillList(profile.languages.map(item => `${item.name}${item.fluency ? ` | ${enumLabel(item.fluency)}` : ""}`))}
                </section>
            `
            : "";
        const portfolioItems = [
            preferences.portfolioUrl ? { label: "Portfolio", url: preferences.portfolioUrl } : null,
            preferences.linkedinUrl ? { label: "LinkedIn", url: preferences.linkedinUrl } : null,
            ...(profile.portfolioLinks || [])
        ].filter(Boolean);
        const portfolioHtml = portfolioItems.length
            ? `
                <section class="candidate-info__section">
                    <h3>Portfolio</h3>
                    ${portfolioItems.map(item => `
                        <div class="candidate-info__row">
                            <strong>${escapeHtml(item.label)}</strong>
                            <p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a></p>
                        </div>
                    `).join("")}
                </section>
            `
            : "";

        $("[data-profile-content]").html(`
            <div class="candidate-info">
            <div class="candidate-info__header">
                <img src="${escapeHtml(personal.avatarPath)}" alt="" />
                <div>
                    <h2 id="candidate-profile-title">${escapeHtml(candidate.fullName)}</h2>
                    ${contact ? `<p>${escapeHtml(contact)}</p>` : ""}
                </div>
            </div>
            ${summaryHtml}
            ${profileHtml}
            ${skillsHtml}
            ${educationHtml}
            ${experienceHtml}
            ${certificationsHtml}
            ${languagesHtml}
            ${portfolioHtml}
            <footer class="candidate-info__footer">
                <button class="employer-candidates__profile-recommend" type="button" data-recommend-open data-recommend-candidate-id="${escapeHtml(candidate.id)}" ${postings.length ? "" : "disabled"}>
                    <i class="fas fa-paper-plane" aria-hidden="true"></i>
                    Recommend
                </button>
            </footer>
            </div>
        `);
        $("[data-profile-modal]").prop("hidden", false).attr("aria-hidden", "false");
    };

    const renderRecommendations = function (postingLabel, matches) {
        const renderedMatches = matches
            .map(match => {
                const candidate = candidates.find(item => item.id === match.candidateId);
                if (!candidate) return "";

                return `
                    <article class="employer-candidates__recommendation">
                        <div>
                            <button class="employer-candidates__name" type="button" data-candidate-profile="${escapeHtml(candidate.id)}">${escapeHtml(candidate.fullName)}</button>
                            <p>${escapeHtml(candidate.highestEducation)} | ${escapeHtml(String(candidate.yearsOfExperience || 0))} years | ${escapeHtml(candidate.availability)}</p>
                            <p>${escapeHtml(match.explanation || "Matched from candidate profile information.")}</p>
                        </div>
                        <strong class="employer-candidates__score">${escapeHtml(match.percentage)}%</strong>
                    </article>
                `;
            })
            .join("");

        $("[data-recommended-label]").text(`For ${postingLabel}`);
        $("[data-recommended-list]").html(renderedMatches || '<p class="employer-candidates__empty">No recommended candidates found for this posting.</p>');
        $("[data-recommended-section]").prop("hidden", false);
    };

    postings.forEach(posting => {
        $("[data-match-posting]").append(`<option value="${escapeHtml(posting.id)}">${escapeHtml(posting.label)}</option>`);
        $("[data-recommend-posting]").append(`<option value="${escapeHtml(posting.id)}">${escapeHtml(posting.label)}</option>`);
    });
    $("[data-match-open]").prop("disabled", !postings.length);
    $("[data-recommend-submit]").prop("disabled", !postings.length);
    renderFilterSkills();
    filterCandidates();

    $("[data-candidate-search]").on("input", filterCandidates);
    $("[data-filter-open]").on("click", function () {
        $("[data-filter-modal]").prop("hidden", false).attr("aria-hidden", "false");
    });
    $("[data-filter-close]").on("click", function () {
        $("[data-filter-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
    $("[data-filter-apply]").on("click", function () {
        filterCandidates();
        $("[data-filter-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
    $("[data-filter-clear], [data-filter-clear-outside]").on("click", function () {
        clearFilters();
        $("[data-filter-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
    $("[data-filter-skill-input]").on("keydown", function (event) {
        if (event.key !== "Enter")
            return;

        event.preventDefault();
        addFilterSkill($(this).val());
    });
    $("[data-filter-skill-list]").on("click", "[data-filter-skill-remove]", function () {
        const skill = String($(this).attr("data-filter-skill-remove") || "");
        filterSkills = filterSkills.filter(item => item !== skill);
        renderFilterSkills();
    });
    $("[data-active-filters]").on("click", "[data-filter-remove]", function () {
        removeFilter(String($(this).attr("data-filter-remove") || ""));
    });
    $("[data-candidate-search-clear]").on("click", function () {
        $("[data-candidate-search]").val("").trigger("input").trigger("focus");
    });
    $("[data-candidate-pagination]").on("click", "[data-page]", function () {
        currentPage = Number($(this).attr("data-page")) || 1;
        renderRows();
    });
    $(document).on("click", "[data-candidate-profile]", function () {
        const candidate = candidates.find(item => item.id === $(this).attr("data-candidate-profile"));
        if (candidate) renderProfile(candidate);
    });
    $("[data-profile-close]").on("click", function () {
        $("[data-profile-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
    $(document).on("click", "[data-recommend-open]", function () {
        if (!postings.length) return;
        recommendationCandidateId = String($(this).attr("data-recommend-candidate-id") || "");
        $("[data-recommend-modal]").prop("hidden", false).attr("aria-hidden", "false");
    });
    $("[data-recommend-close]").on("click", function () {
        $("[data-recommend-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
    $("[data-match-open]").on("click", function () {
        $("[data-match-modal]").prop("hidden", false).attr("aria-hidden", "false");
    });
    $("[data-match-close]").on("click", function () {
        $("[data-match-modal]").prop("hidden", true).attr("aria-hidden", "true");
    });
    $("[data-recommended-clear]").on("click", function () {
        $("[data-recommended-section]").prop("hidden", true);
        $("[data-recommended-list]").empty();
    });
    $("[data-match-run]").on("click", async function () {
        const postingId = $("[data-match-posting]").val();
        const postingLabel = $("[data-match-posting] option:selected").text();
        const $button = $(this);
        $button.prop("disabled", true).text("Matching...");
        try {
            const response = await fetch("/employer/candidate-matches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ postingId })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                showMessage(result.message || "Unable to match candidates.");
                return;
            }
            renderRecommendations(postingLabel, result.matches || []);
            $("[data-match-modal]").prop("hidden", true).attr("aria-hidden", "true");
        } catch (err) {
            console.error(err);
            showMessage("Unable to match candidates.");
        } finally {
            $button.prop("disabled", false).text("Show recommendations");
        }
    });
    $("[data-recommend-submit]").on("click", async function () {
        const postingId = String($("[data-recommend-posting]").val() || "");
        const $button = $(this);
        $button.prop("disabled", true).text("Sending...");
        try {
            const response = await fetch("/employer/candidate-recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidateId: recommendationCandidateId,
                    postingId
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                showMessage(result.message || "Unable to recommend candidate.");
                return;
            }
            showMessage(result.message || "Recommendation sent.", "success");
            $("[data-recommend-modal]").prop("hidden", true).attr("aria-hidden", "true");
        } catch (err) {
            console.error(err);
            showMessage("Unable to recommend candidate.");
        } finally {
            $button.prop("disabled", !postings.length).html('<i class="fas fa-paper-plane" aria-hidden="true"></i> Send recommendation');
        }
    });
});
