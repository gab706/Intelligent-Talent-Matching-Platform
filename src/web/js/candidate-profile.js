$(function () {
    if (typeof toastr !== "undefined") {
        toastr.options = {
            closeButton: true,
            progressBar: true,
            newestOnTop: true,
            preventDuplicates: true,
            positionClass: "toast-top-right",
            timeOut: 5000,
            extendedTimeOut: 1500
        };
    }

    const profile = window.__candidateProfile || {};
    const state = {
        skills: Array.isArray(profile.skills) ? [...profile.skills] : [],
        certifications: Array.isArray(profile.certifications) ? [...profile.certifications] : [],
        education: Array.isArray(profile.education) ? [...profile.education] : [],
        experience: Array.isArray(profile.experience) ? [...profile.experience] : [],
        portfolioLinks: Array.isArray(profile.portfolioLinks) ? [...profile.portfolioLinks] : [],
        languages: Array.isArray(profile.languages) ? [...profile.languages] : []
    };

    const qualificationOptions = [
        ["CERTIFICATE_I", "Certificate I"],
        ["CERTIFICATE_II", "Certificate II"],
        ["CERTIFICATE_III", "Certificate III"],
        ["CERTIFICATE_IV", "Certificate IV"],
        ["DIPLOMA", "Diploma"],
        ["ADVANCED_DIPLOMA", "Advanced Diploma"],
        ["ASSOCIATE_DEGREE", "Associate Degree"],
        ["BACHELORS_DEGREE", "Bachelor's Degree"],
        ["GRADUATE_CERTIFICATE", "Graduate Certificate"],
        ["GRADUATE_DIPLOMA", "Graduate Diploma"],
        ["MASTERS_DEGREE", "Master's Degree"],
        ["DOCTORAL_DEGREE", "Doctoral Degree"]
    ];

    const workingModeOptions = [
        ["REMOTE", "Remote"],
        ["ONSITE", "In person"],
        ["HYBRID", "Hybrid"]
    ];

    const fluencyOptions = [
        ["BEGINNER", "Beginner"],
        ["INTERMEDIATE", "Intermediate"],
        ["ADVANCED", "Advanced"],
        ["NATIVE", "Native"]
    ];
    const jobTypeOptions = [
        ["FULL_TIME", "Full Time"],
        ["PART_TIME", "Part Time"],
        ["CASUAL", "Casual"],
        ["CONTRACT", "Contract"],
        ["INTERNSHIP", "Internship"]
    ];
    const qualificationRank = new Map(
        qualificationOptions.map(([value], index) => [value, index])
    );
    const labelMaps = {
        qualification: new Map(qualificationOptions),
        workingMode: new Map(workingModeOptions),
        jobType: new Map(jobTypeOptions),
        fluency: new Map(fluencyOptions)
    };
    const currentMonth = new Date().toISOString().slice(0, 7);

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

    const optionHtml = function (options, selectedValue, placeholder) {
        return [
            placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "",
            ...options.map(([value, label]) => (
                `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`
            ))
        ].join("");
    };

    const normaliseUniqueList = function (items) {
        const seen = new Set();

        return items
            .map(item => String(item || "").trim())
            .filter(item => {
                const key = item.toLowerCase();

                if (!item || seen.has(key))
                    return false;

                seen.add(key);
                return true;
            });
    };

    const getLabel = function (map, value, fallback = "") {
        return map.get(value) || fallback || value || "Not set";
    };

    const parseDate = function (value) {
        if (!value)
            return null;

        const date = /^\d{4}-\d{2}$/.test(value)
            ? new Date(`${value}-01T00:00:00.000Z`)
            : new Date(`${value}T00:00:00.000Z`);

        return Number.isNaN(date.getTime()) ? null : date;
    };

    const formatDate = function (value) {
        const date = parseDate(value);

        if (!date)
            return "";

        return date.toLocaleDateString("en-AU", {
            month: "short",
            year: "numeric"
        });
    };

    const formatDateRange = function (item) {
        const from = formatDate(item.fromDate);
        const to = item.isCurrent ? "Present" : formatDate(item.toDate);

        if (from && to)
            return `${from} - ${to}`;

        return from || to || "Dates not set";
    };

    const getSortDate = function (item) {
        return parseDate(item.fromDate)?.getTime() || 0;
    };

    const getRecentSortDate = function (item) {
        if (item.isCurrent)
            return Date.now();

        return parseDate(item.toDate)?.getTime() || getSortDate(item);
    };

    const sortMostToLeastRecent = function (items) {
        return [...items].sort((a, b) => getRecentSortDate(b) - getRecentSortDate(a));
    };

    const formatCurrentHighestEducation = function (item) {
        if (!item)
            return "Not set";

        const title = formatEducationTitle(item);
        const currentNote = item.isCurrent ? " (In Progress)" : "";

        return `${escapeHtml(title)}${escapeHtml(currentNote)}`;
    };

    const formatEducationTitle = function (item) {
        const qualification = getLabel(labelMaps.qualification, item.qualificationType, "Qualification not set");

        if (!item.major)
            return qualification;

        return `${qualification} in ${item.major}`;
    };

    const renderDuties = function (duties) {
        const lines = String(duties || "")
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        if (!lines.length)
            return "";

        return `
            <div class="candidate-profile__duties">
                <strong>Duties:</strong>
                <ul>
                    ${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}
                </ul>
            </div>
        `;
    };

    const renderPortfolioLinks = function (links) {
        if (!links.length)
            return '<p class="candidate-profile__view-empty">No portfolio links added yet.</p>';

        return `
            <ul class="candidate-profile__portfolio-list">
                ${links.map(item => `
                    <li>
                        <strong>${escapeHtml(item.label || "Link")}</strong>
                        <span>-</span>
                        <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a>
                    </li>
                `).join("")}
            </ul>
        `;
    };

    const hasText = function (value) {
        return String(value || "").trim().length > 0;
    };

    const cleanPdfText = function (value) {
        return String(value || "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .trim();
    };

    const compactLine = function (items) {
        return items.filter(hasText).join(" | ");
    };

    const getOptionalLabel = function (map, value) {
        return hasText(value) ? getLabel(map, value, "") : "";
    };

    const exportResumePdf = function () {
        if (!window.pdfMake) {
            showMessage("PDF export is unavailable. Please refresh and try again.");
            return;
        }

        const personal = profile.personal || {};
        const preferences = profile.preferences || {};
        const education = sortMostToLeastRecent(profile.education || []);
        const experience = sortMostToLeastRecent(profile.experience || []);
        const fullName = [personal.firstName, personal.lastName].filter(hasText).join(" ") || "Candidate";
        const nameParts = [personal.firstName, personal.lastName].filter(hasText);
        const filenameBase = [personal.firstName, personal.lastName]
            .filter(hasText)
            .join("_")
            .replace(/[^a-z0-9_-]/gi, "") || "Candidate";
        const normaliseName = function () {
            if (nameParts.length >= 2)
                return `${nameParts[0].toUpperCase()}\n${nameParts.slice(1).join(" ").toUpperCase()}`;

            return fullName.toUpperCase();
        };
        const cleanLines = function (value) {
            return cleanPdfText(value).split("\n").map(line => line.trim()).filter(Boolean);
        };
        const makeColumns = function (items, columnCount = 2) {
            const values = items.filter(hasText);
            const columns = Array.from({ length: Math.min(columnCount, Math.max(1, values.length)) }, () => []);

            values.forEach((item, index) => {
                columns[index % columns.length].push(item);
            });

            return columns.map(itemsForColumn => ({
                width: '*',
                ul: itemsForColumn,
                style: 'compactList'
            }));
        };
        const sideStack = [
            { text: normaliseName(), style: 'sideName' }
        ];
        const addSideSection = function (title, content) {
            if (!content || (Array.isArray(content) && !content.length))
                return;

            sideStack.push({ text: title, style: 'sideHeader' });

            if (Array.isArray(content)) {
                sideStack.push({
                    ul: content,
                    style: 'sideList'
                });
                return;
            }

            sideStack.push(content);
        };
        const contactLines = [
            personal.email,
            personal.phone,
            preferences.preferredLocation
        ].filter(hasText);
        const languageRows = (profile.languages || [])
            .map(item => [item.name, getOptionalLabel(labelMaps.fluency, item.fluency)].filter(hasText).join(' - '))
            .filter(hasText);
        const mainStack = [];
        const addMainSection = function (title, content) {
            if (!content || (Array.isArray(content) && !content.length))
                return;

            mainStack.push({
                text: title,
                style: 'sectionHeader',
                margin: mainStack.length ? [0, 4, 0, 5] : [0, 0, 0, 5]
            });

            if (Array.isArray(content))
                mainStack.push(...content);
            else
                mainStack.push(content);
        };
        const experienceBlocks = experience.flatMap(item => {
            const duties = cleanLines(item.duties);
            const block = [
                {
                    table: {
                        widths: ['*', 105],
                        body: [[
                            {
                                stack: [
                                    { text: item.jobTitle || 'Job title not set', style: 'roleTitle' },
                                    {
                                        text: [
                                            item.company,
                                            item.location,
                                            getOptionalLabel(labelMaps.workingMode, item.workType)
                                        ].filter(hasText).join(' · '),
                                        style: 'subText'
                                    }
                                ]
                            },
                            { text: formatDateRange(item), style: 'date', alignment: 'right' }
                        ]]
                    },
                    layout: 'noBorders'
                }
            ];

            if (duties.length) {
                block.push({
                    text: cleanPdfText(item.duties),
                    style: 'mainText'
                });
            }

            return block;
        });
        const educationRows = education.map((item, index) => [
            {
                stack: [
                    { text: formatEducationTitle(item), style: 'itemTitle' },
                    { text: item.school || 'School not set', style: 'subText' }
                ],
                margin: index ? [0, 8, 0, 0] : [0, 0, 0, 0]
            },
            {
                text: formatDateRange(item),
                style: 'date',
                alignment: 'right',
                margin: index ? [0, 8, 0, 0] : [0, 0, 0, 0]
            }
        ]);

        if (contactLines.length) {
            sideStack.push({ text: 'CONTACT', style: 'sideHeader' });
            contactLines.forEach(line => {
                sideStack.push({ text: line, style: 'sideText' });
            });
        }
        addSideSection('CERTIFICATIONS', profile.certifications || []);
        addSideSection('LANGUAGES', languageRows);
        addMainSection('Professional Summary', hasText(preferences.profileSummary)
            ? { text: preferences.profileSummary, style: 'bodyText' }
            : null);
        addMainSection('Experience', experienceBlocks);
        addMainSection('Education', educationRows.length ? {
            table: {
                widths: ['*', 105],
                body: educationRows
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 12]
        } : null);

        if ((profile.skills || []).length) {
            addMainSection('Skills', {
                columns: makeColumns(profile.skills || [], 2),
                columnGap: 18
            });
        }

        const dd = {
            pageSize: 'A4',
            pageMargins: [32, 28, 32, 28],
            background: function () {
                return [
                    {
                        canvas: [
                            { type: 'rect', x: 0, y: 0, w: 595.28, h: 841.89, color: '#F3F6F9' },
                            { type: 'rect', x: 32, y: 28, w: 150, h: 785, color: '#1F4E79' }
                        ]
                    }
                ];
            },
            content: [
                {
                    columns: [
                        {
                            width: 150,
                            stack: sideStack,
                            margin: [10, 12, 14, 0]
                        },
                        {
                            width: '*',
                            stack: mainStack,
                            margin: [24, 10, 8, 0]
                        }
                    ]
                }
            ],
            styles: {
                sideName: {
                    fontSize: 19,
                    bold: true,
                    color: '#FFFFFF',
                    lineHeight: 1.05,
                    margin: [0, 0, 0, 26]
                },
                sideHeader: {
                    fontSize: 8.6,
                    bold: true,
                    color: '#FFFFFF',
                    margin: [0, 13, 0, 4],
                    characterSpacing: 0.6
                },
                sideText: {
                    fontSize: 8.2,
                    color: '#EAF2F8',
                    lineHeight: 1.32
                },
                sideList: {
                    fontSize: 8.1,
                    color: '#EAF2F8',
                    lineHeight: 1.25,
                    margin: [0, 0, 0, 0]
                },
                sectionHeader: {
                    fontSize: 12.4,
                    bold: true,
                    color: '#1F4E79',
                    margin: [0, 0, 0, 5]
                },
                bodyText: {
                    fontSize: 8.9,
                    color: '#374151',
                    lineHeight: 1.25,
                    margin: [0, 0, 0, 10]
                },
                roleTitle: {
                    fontSize: 10.2,
                    bold: true,
                    color: '#111827'
                },
                itemTitle: {
                    fontSize: 9.8,
                    bold: true,
                    color: '#111827'
                },
                subText: {
                    fontSize: 8.4,
                    color: '#5B6472'
                },
                date: {
                    fontSize: 8,
                    color: '#6B7280'
                },
                mainList: {
                    fontSize: 8.6,
                    color: '#374151',
                    lineHeight: 1.22,
                    margin: [0, 3, 0, 9]
                },
                mainText: {
                    fontSize: 8.6,
                    color: '#374151',
                    lineHeight: 1.22,
                    margin: [0, 4, 0, 9]
                },
                compactList: {
                    fontSize: 8.5,
                    color: '#374151',
                    lineHeight: 1.22,
                    margin: [0, 0, 0, 0]
                }
            },
            defaultStyle: {
                fontSize: 9,
                color: '#111827'
            }
        };

        window.pdfMake.createPdf(dd).download(`${filenameBase}_Resume.pdf`);
    };

    const getHighestEducation = function (education) {
        if (!education.length)
            return null;

        return [...education].sort((a, b) => {
            const rankA = qualificationRank.get(a.qualificationType) ?? -1;
            const rankB = qualificationRank.get(b.qualificationType) ?? -1;

            if (rankA !== rankB)
                return rankB - rankA;

            return getSortDate(b) - getSortDate(a);
        })[0];
    };

    const calculateYearsOfExperience = function (experience) {
        const ranges = experience.map(item => {
            const from = parseDate(item.fromDate);

            if (!from)
                return null;

            const to = item.isCurrent
                ? new Date()
                : parseDate(item.toDate);

            if (!to || to <= from)
                return null;

            return [from.getTime(), to.getTime()];
        }).filter(Boolean).sort((a, b) => a[0] - b[0]);
        const mergedRanges = [];

        ranges.forEach(range => {
            const lastRange = mergedRanges[mergedRanges.length - 1];

            if (!lastRange || range[0] > lastRange[1]) {
                mergedRanges.push([...range]);
                return;
            }

            lastRange[1] = Math.max(lastRange[1], range[1]);
        });

        const totalMs = mergedRanges.reduce((total, range) => (
            total + (range[1] - range[0])
        ), 0);
        const years = totalMs / (1000 * 60 * 60 * 24 * 365.25);

        return Math.max(0, Math.round(years * 10) / 10);
    };

    const listOrEmpty = function (items, renderItem, emptyText) {
        if (!items.length)
            return `<p class="candidate-profile__view-empty">${escapeHtml(emptyText)}</p>`;

        return items.map(renderItem).join("");
    };

    const renderView = function (viewProfile = profile) {
        const preferences = viewProfile.preferences || {};
        const education = sortMostToLeastRecent(viewProfile.education || []);
        const experience = sortMostToLeastRecent(viewProfile.experience || []);
        const highestEducation = getHighestEducation(education);
        const yearsOfExperience = calculateYearsOfExperience(experience);
        const personal = viewProfile.personal || {};
        const $view = $("[data-candidate-profile-view]");

        $view.html(`
            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Personal Information</h2>
                </div>
                <dl class="candidate-profile__view-grid">
                    <div>
                        <dt>First Name</dt>
                        <dd>${escapeHtml(personal.firstName || "Not set")}</dd>
                    </div>
                    <div>
                        <dt>Last Name</dt>
                        <dd>${escapeHtml(personal.lastName || "Not set")}</dd>
                    </div>
                    <div>
                        <dt>Contact Email</dt>
                        <dd>${escapeHtml(personal.email || "Not set")}</dd>
                    </div>
                    <div>
                        <dt>Contact Phone</dt>
                        <dd>${escapeHtml(personal.phone || "Not set")}</dd>
                    </div>
                </dl>
            </section>

            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Profile Summary</h2>
                </div>
                <p class="candidate-profile__view-copy">${escapeHtml(preferences.profileSummary || "No profile summary added yet.")}</p>
            </section>

            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Education</h2>
                    <p><strong>Highest Education Level:</strong> ${formatCurrentHighestEducation(highestEducation)}</p>
                </div>
                <div class="candidate-profile__timeline">
                    ${listOrEmpty(education, item => `
                        <article class="candidate-profile__view-item">
                            <h3>${escapeHtml(formatEducationTitle(item))}</h3>
                            <p>${escapeHtml(item.school || "School not set")}</p>
                            <span>${escapeHtml(formatDateRange(item))}</span>
                        </article>
                    `, "No education records added yet.")}
                </div>
            </section>

            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Experience</h2>
                    <p><strong>Years of Experience:</strong> ${yearsOfExperience ? `${yearsOfExperience} ${yearsOfExperience === 1 ? "year" : "years"}` : "Not set"}</p>
                </div>
                <div class="candidate-profile__timeline">
                    ${listOrEmpty(experience, item => `
                        <article class="candidate-profile__view-item">
                            <h3>${escapeHtml(item.jobTitle || "Job title not set")}</h3>
                            <p>${escapeHtml(item.company || "Company not set")}${item.location ? ` | ${escapeHtml(item.location)}` : ""} | ${escapeHtml(getLabel(labelMaps.workingMode, item.workType, "Work type not set"))}</p>
                            <span>${escapeHtml(formatDateRange(item))}</span>
                            ${renderDuties(item.duties)}
                        </article>
                    `, "No experience records added yet.")}
                </div>
            </section>

            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Skills</h2>
                </div>
                <div class="candidate-profile__view-tags">
                    ${listOrEmpty(viewProfile.skills || [], item => `<span>${escapeHtml(item)}</span>`, "No skills added yet.")}
                </div>
            </section>

            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Preferences</h2>
                </div>
                <dl class="candidate-profile__view-grid">
                    <div>
                        <dt>Preferred Working Mode</dt>
                        <dd>${escapeHtml(getLabel(labelMaps.workingMode, preferences.preferredWorkingMode))}</dd>
                    </div>
                    <div>
                        <dt>Preferred Location</dt>
                        <dd>${escapeHtml(preferences.preferredLocation || "Not set")}</dd>
                    </div>
                    <div>
                        <dt>Availability</dt>
                        <dd>${escapeHtml(preferences.availability || "Not set")}</dd>
                    </div>
                    <div>
                        <dt>Preferred Job Type</dt>
                        <dd>${escapeHtml(getLabel(labelMaps.jobType, preferences.preferredJobType))}</dd>
                    </div>
                </dl>
            </section>

            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Portfolio</h2>
                </div>
                ${renderPortfolioLinks(viewProfile.portfolioLinks || [])}
            </section>

            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Certifications</h2>
                </div>
                <div class="candidate-profile__view-tags">
                    ${listOrEmpty(viewProfile.certifications || [], item => `<span>${escapeHtml(item)}</span>`, "No certifications added yet.")}
                </div>
            </section>

            <section class="candidate-profile__view-section">
                <div class="candidate-profile__view-heading">
                    <h2>Languages</h2>
                </div>
                <div class="candidate-profile__timeline">
                    ${listOrEmpty(viewProfile.languages || [], item => `
                        <article class="candidate-profile__view-item candidate-profile__view-item--compact">
                            <h3>${escapeHtml(item.name || "Language not set")}</h3>
                            <span>${escapeHtml(getLabel(labelMaps.fluency, item.fluency, "Fluency not set"))}</span>
                        </article>
                    `, "No languages added yet.")}
                </div>
            </section>
        `);
    };

    const setMode = function (mode) {
        const isEditMode = mode === "edit";

        $("[data-candidate-profile-form]").prop("hidden", !isEditMode);
        $("[data-candidate-profile-view]").prop("hidden", isEditMode);
        $("[data-candidate-profile-edit]").prop("hidden", isEditMode);
        $("[data-candidate-profile-export]").prop("hidden", isEditMode);
    };

    const renderChips = function (items, $container, removeAttribute) {
        $container.empty();

        if (!items.length) {
            $container.append('<p class="candidate-profile__empty">No items added yet.</p>');
            return;
        }

        items.forEach((item, index) => {
            $container.append(`
                <span class="candidate-profile__chip">
                    ${escapeHtml(item)}
                    <button type="button" aria-label="Remove ${escapeHtml(item)}" ${removeAttribute}="${index}">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </span>
            `);
        });
    };

    const addChipFromInput = function ($input, key, $container, removeAttribute) {
        const value = String($input.val() || "").trim();

        if (!value)
            return;

        state[key] = normaliseUniqueList([...state[key], value]);
        $input.val("");
        renderChips(state[key], $container, removeAttribute);
    };

    const updateRowTitles = function () {
        $("[data-education-list] [data-education-item]").each(function (index) {
            $(this).find("[data-row-title]").text(`Education ${index + 1}`);
        });

        $("[data-experience-list] [data-experience-item]").each(function (index) {
            $(this).find("[data-row-title]").text(`Experience ${index + 1}`);
        });

        $("[data-portfolio-list] [data-portfolio-item]").each(function (index) {
            $(this).find("[data-row-title]").text(`Portfolio link ${index + 1}`);
        });

        $("[data-language-list] [data-language-item]").each(function (index) {
            $(this).find("[data-row-title]").text(`Language ${index + 1}`);
        });
    };

    const renderEmptyState = function ($container, text) {
        if ($container.children().length)
            return;

        $container.append(`<p class="candidate-profile__empty">${escapeHtml(text)}</p>`);
    };

    const removeEmptyState = function ($container) {
        $container.find(".candidate-profile__empty").remove();
    };

    const educationItemHtml = function (item = {}) {
        return `
            <article class="candidate-profile__row" data-education-item>
                <div class="candidate-profile__row-header">
                    <strong class="candidate-profile__row-title" data-row-title>Education</strong>
                    <button class="candidate-profile__remove" type="button" data-remove-row>
                        Remove
                    </button>
                </div>
                <div class="candidate-profile__row-grid">
                    <label class="candidate-profile__field">
                        <span>School</span>
                        <input type="text" data-education-field="school" value="${escapeHtml(item.school)}" />
                    </label>
                    <label class="candidate-profile__field">
                        <span>Qualification</span>
                        <select data-education-field="qualificationType">
                            ${optionHtml(qualificationOptions, item.qualificationType || "", "Select a qualification")}
                        </select>
                    </label>
                    <label class="candidate-profile__field">
                        <span>Major</span>
                        <input type="text" data-education-field="major" value="${escapeHtml(item.major)}" />
                    </label>
                    <label class="candidate-profile__field">
                        <span>From</span>
                        <input type="month" max="${currentMonth}" data-education-field="fromDate" value="${escapeHtml(item.fromDate)}" />
                    </label>
                    <label class="candidate-profile__field ${item.isCurrent ? "is-hidden" : ""}" data-education-to-field>
                        <span>To</span>
                        <input type="month" max="${currentMonth}" data-education-field="toDate" value="${escapeHtml(item.toDate)}" />
                    </label>
                    <label class="candidate-profile__check">
                        <input type="checkbox" data-education-field="isCurrent" ${item.isCurrent ? "checked" : ""} />
                        Currently studying
                    </label>
                </div>
            </article>
        `;
    };

    const experienceItemHtml = function (item = {}) {
        return `
            <article class="candidate-profile__row" data-experience-item>
                <div class="candidate-profile__row-header">
                    <strong class="candidate-profile__row-title" data-row-title>Experience</strong>
                    <button class="candidate-profile__remove" type="button" data-remove-row>
                        Remove
                    </button>
                </div>
                <div class="candidate-profile__row-grid">
                    <label class="candidate-profile__field">
                        <span>Company</span>
                        <input type="text" data-experience-field="company" value="${escapeHtml(item.company)}" />
                    </label>
                    <label class="candidate-profile__field">
                        <span>Job title</span>
                        <input type="text" data-experience-field="jobTitle" value="${escapeHtml(item.jobTitle)}" />
                    </label>
                    <label class="candidate-profile__field">
                        <span>Work type</span>
                        <select data-experience-field="workType">
                            ${optionHtml(workingModeOptions, item.workType || "", "Select a work type")}
                        </select>
                    </label>
                    <label class="candidate-profile__field">
                        <span>Location</span>
                        <input type="text" data-experience-field="location" value="${escapeHtml(item.location)}" />
                    </label>
                    <label class="candidate-profile__field">
                        <span>From</span>
                        <input type="month" max="${currentMonth}" data-experience-field="fromDate" value="${escapeHtml(item.fromDate)}" />
                    </label>
                    <label class="candidate-profile__field ${item.isCurrent ? "is-hidden" : ""}" data-experience-to-field>
                        <span>To</span>
                        <input type="month" max="${currentMonth}" data-experience-field="toDate" value="${escapeHtml(item.toDate)}" />
                    </label>
                    <label class="candidate-profile__check">
                        <input type="checkbox" data-experience-field="isCurrent" ${item.isCurrent ? "checked" : ""} />
                        Currently working here
                    </label>
                </div>
                <label class="candidate-profile__field">
                    <span>Duties / responsibilities</span>
                    <textarea data-experience-field="duties" rows="4">${escapeHtml(item.duties)}</textarea>
                </label>
            </article>
        `;
    };

    const portfolioItemHtml = function (item = {}) {
        return `
            <article class="candidate-profile__row" data-portfolio-item>
                <div class="candidate-profile__row-header">
                    <strong class="candidate-profile__row-title" data-row-title>Portfolio link</strong>
                    <button class="candidate-profile__remove" type="button" data-remove-row>
                        Remove
                    </button>
                </div>
                <div class="candidate-profile__row-grid">
                    <label class="candidate-profile__field">
                        <span>Label</span>
                        <input type="text" data-portfolio-field="label" placeholder="GitHub, LinkedIn, Portfolio" value="${escapeHtml(item.label)}" />
                    </label>
                    <label class="candidate-profile__field">
                        <span>URL</span>
                        <input type="url" data-portfolio-field="url" placeholder="https://example.com" value="${escapeHtml(item.url)}" />
                    </label>
                </div>
            </article>
        `;
    };

    const languageItemHtml = function (item = {}) {
        return `
            <article class="candidate-profile__row" data-language-item>
                <div class="candidate-profile__row-header">
                    <strong class="candidate-profile__row-title" data-row-title>Language</strong>
                    <button class="candidate-profile__remove" type="button" data-remove-row>
                        Remove
                    </button>
                </div>
                <div class="candidate-profile__row-grid">
                    <label class="candidate-profile__field">
                        <span>Language</span>
                        <input type="text" data-language-field="name" value="${escapeHtml(item.name)}" />
                    </label>
                    <label class="candidate-profile__field">
                        <span>Fluency</span>
                        <select data-language-field="fluency">
                            ${optionHtml(fluencyOptions, item.fluency || "", "Select fluency")}
                        </select>
                    </label>
                </div>
            </article>
        `;
    };

    const addRow = function ($container, html) {
        removeEmptyState($container);
        $container.append(html);
        updateRowTitles();
    };

    const renderInitialRows = function () {
        const $educationList = $("[data-education-list]");
        const $experienceList = $("[data-experience-list]");
        const $portfolioList = $("[data-portfolio-list]");
        const $languageList = $("[data-language-list]");

        state.education.forEach(item => addRow($educationList, educationItemHtml(item)));
        state.experience.forEach(item => addRow($experienceList, experienceItemHtml(item)));
        state.portfolioLinks.forEach(item => addRow($portfolioList, portfolioItemHtml(item)));
        state.languages.forEach(item => addRow($languageList, languageItemHtml(item)));

        renderEmptyState($educationList, "No education records added yet.");
        renderEmptyState($experienceList, "No experience records added yet.");
        renderEmptyState($portfolioList, "No portfolio links added yet.");
        renderEmptyState($languageList, "No languages added yet.");
        updateRowTitles();
    };

    const collectEducation = function () {
        return $("[data-education-item]").map(function () {
            const $item = $(this);
            const isCurrent = $item.find("[data-education-field='isCurrent']").is(":checked");

            return {
                school: String($item.find("[data-education-field='school']").val() || "").trim(),
                qualificationType: String($item.find("[data-education-field='qualificationType']").val() || ""),
                major: String($item.find("[data-education-field='major']").val() || "").trim(),
                fromDate: String($item.find("[data-education-field='fromDate']").val() || ""),
                toDate: isCurrent ? "" : String($item.find("[data-education-field='toDate']").val() || ""),
                isCurrent
            };
        }).get();
    };

    const collectExperience = function () {
        return $("[data-experience-item]").map(function () {
            const $item = $(this);
            const isCurrent = $item.find("[data-experience-field='isCurrent']").is(":checked");

            return {
                company: String($item.find("[data-experience-field='company']").val() || "").trim(),
                jobTitle: String($item.find("[data-experience-field='jobTitle']").val() || "").trim(),
                workType: String($item.find("[data-experience-field='workType']").val() || ""),
                location: String($item.find("[data-experience-field='location']").val() || "").trim(),
                duties: String($item.find("[data-experience-field='duties']").val() || "").trim(),
                fromDate: String($item.find("[data-experience-field='fromDate']").val() || ""),
                toDate: isCurrent ? "" : String($item.find("[data-experience-field='toDate']").val() || ""),
                isCurrent
            };
        }).get();
    };

    const collectPortfolioLinks = function () {
        return $("[data-portfolio-item]").map(function () {
            const $item = $(this);

            return {
                label: String($item.find("[data-portfolio-field='label']").val() || "").trim(),
                url: String($item.find("[data-portfolio-field='url']").val() || "").trim()
            };
        }).get();
    };

    const collectLanguages = function () {
        return $("[data-language-item]").map(function () {
            const $item = $(this);

            return {
                name: String($item.find("[data-language-field='name']").val() || "").trim(),
                fluency: String($item.find("[data-language-field='fluency']").val() || "")
            };
        }).get();
    };

    const preferences = profile.preferences || {};

    $("[data-profile-field='preferredWorkingMode']").val(preferences.preferredWorkingMode || "");
    $("[data-profile-field='preferredLocation']").val(preferences.preferredLocation || "");
    $("[data-profile-field='preferredJobType']").val(preferences.preferredJobType || "");
    $("[data-profile-field='availability']").val(preferences.availability || "");
    $("[data-profile-field='profileSummary']").val(preferences.profileSummary || "");

    renderInitialRows();
    renderChips(state.skills, $("[data-skill-list]"), "data-remove-skill");
    renderChips(state.certifications, $("[data-certification-list]"), "data-remove-certification");

    $("[data-add-education]").on("click", function () {
        addRow($("[data-education-list]"), educationItemHtml());
    });

    $("[data-add-experience]").on("click", function () {
        addRow($("[data-experience-list]"), experienceItemHtml());
    });

    $("[data-add-portfolio]").on("click", function () {
        addRow($("[data-portfolio-list]"), portfolioItemHtml());
    });

    $("[data-add-language]").on("click", function () {
        addRow($("[data-language-list]"), languageItemHtml());
    });

    $(document).on("click", "[data-remove-row]", function () {
        const $stack = $(this).closest(".candidate-profile__stack");
        $(this).closest(".candidate-profile__row").remove();
        renderEmptyState($stack, "No items added yet.");
        updateRowTitles();
    });

    $(document).on("change", "[data-education-field='isCurrent']", function () {
        const isCurrent = $(this).is(":checked");
        const $item = $(this).closest("[data-education-item]");
        const $toField = $item.find("[data-education-to-field]");
        const $toDate = $toField.find("[data-education-field='toDate']");

        $toField.toggleClass("is-hidden", isCurrent);

        if (isCurrent)
            $toDate.val("");
    });

    $(document).on("change", "[data-experience-field='isCurrent']", function () {
        const isCurrent = $(this).is(":checked");
        const $item = $(this).closest("[data-experience-item]");
        const $toField = $item.find("[data-experience-to-field]");
        const $toDate = $toField.find("[data-experience-field='toDate']");

        $toField.toggleClass("is-hidden", isCurrent);

        if (isCurrent)
            $toDate.val("");
    });

    $("[data-skill-input]").on("keydown", function (event) {
        if (event.key !== "Enter")
            return;

        event.preventDefault();
        addChipFromInput($(this), "skills", $("[data-skill-list]"), "data-remove-skill");
    });

    $("[data-certification-input]").on("keydown", function (event) {
        if (event.key !== "Enter")
            return;

        event.preventDefault();
        addChipFromInput($(this), "certifications", $("[data-certification-list]"), "data-remove-certification");
    });

    $(document).on("click", "[data-remove-skill]", function () {
        state.skills.splice(Number($(this).attr("data-remove-skill")), 1);
        renderChips(state.skills, $("[data-skill-list]"), "data-remove-skill");
    });

    $(document).on("click", "[data-remove-certification]", function () {
        state.certifications.splice(Number($(this).attr("data-remove-certification")), 1);
        renderChips(state.certifications, $("[data-certification-list]"), "data-remove-certification");
    });

    $("[data-candidate-profile-form]").on("submit", async function (event) {
        event.preventDefault();

        const $saveButton = $("[data-candidate-profile-save]");
        const payload = {
            education: collectEducation(),
            experience: collectExperience(),
            skills: normaliseUniqueList(state.skills),
            preferences: {
                preferredWorkingMode: String($("[data-profile-field='preferredWorkingMode']").val() || ""),
                preferredLocation: String($("[data-profile-field='preferredLocation']").val() || "").trim(),
                preferredJobType: String($("[data-profile-field='preferredJobType']").val() || ""),
                availability: String($("[data-profile-field='availability']").val() || "").trim(),
                profileSummary: String($("[data-profile-field='profileSummary']").val() || "").trim()
            },
            portfolioLinks: collectPortfolioLinks(),
            certifications: normaliseUniqueList(state.certifications),
            languages: collectLanguages()
        };

        $saveButton.prop("disabled", true).text("Saving...");

        try {
            const response = await fetch("/candidate/profile", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                showMessage(data.message || "Unable to update candidate profile.");
                return;
            }

            showMessage("Candidate Profile updated successfully.", "success");
            const updatedProfile = {
                personal: profile.personal || {},
                education: payload.education,
                experience: payload.experience,
                skills: payload.skills,
                preferences: payload.preferences,
                portfolioLinks: payload.portfolioLinks,
                certifications: payload.certifications,
                languages: payload.languages
            };

            Object.assign(profile, updatedProfile);
            renderView(profile);
            setMode("view");
        } catch (err) {
            console.error(err);
            showMessage("An unexpected error occurred. Please try again.");
        } finally {
            $saveButton.prop("disabled", false).text("Save candidate profile");
        }
    });

    $("[data-candidate-profile-edit]").on("click", function () {
        setMode("edit");
    });

    $("[data-candidate-profile-export]").on("click", function () {
        exportResumePdf();
    });

    $("[data-candidate-profile-cancel]").on("click", function () {
        setMode("view");
    });

    renderView(profile);
    setMode("view");
});
