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

    const users = window.__adminUsers || [];
    const $userModal = $("[data-user-modal]");
    const $suspendModal = $("[data-suspend-modal]");
    const $suspendForm = $("[data-suspend-form]");
    let activeUser = null;

    function showMessage(message, type) {
        if (typeof toastr !== "undefined" && toastr[type]) {
            toastr[type](message);
            return;
        }

        if (message)
            window.alert(message);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function getUser(userId) {
        return users.find(user => user.id === userId);
    }

    function renderDetail(label, value) {
        return `
            <div class="admin-users__detail">
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value || "Not set")}</dd>
            </div>
        `;
    }

    function renderDateTime(label, value) {
        return renderDetail(label, window.formatClientDateTime(value));
    }

    function renderMember(value) {
        return `
            <div class="admin-users__detail">
                <dt>Member</dt>
                <dd>
                    <span class="admin-users__member-status ${value ? "is-member" : "is-not-member"}">
                        <i class="fas ${value ? "fa-check" : "fa-times"}" aria-hidden="true"></i>
                    </span>
                </dd>
            </div>
        `;
    }

    function renderSection(title, rows) {
        return `
            <section class="admin-users__detail-section">
                <h3>${escapeHtml(title)}</h3>
                <dl>${rows.join("")}</dl>
            </section>
        `;
    }

    function renderUserDetails(user) {
        return [
            renderSection("Account", [
                renderDetail("Account type", user.type || "Not set"),
                renderDetail("Theme", user.theme),
                renderMember(Boolean(user.isMember)),
                renderDateTime("Created", user.createdAt),
                renderDateTime("Updated", user.updatedAt)
            ]),
            renderSection("Activity", [
                renderDetail("Active sessions", String(user.activeSessionsCount || 0)),
                renderDetail("Last active", user.lastActiveLabel),
                renderDateTime("Last login", user.lastLoginAt)
            ]),
            renderSection("Login Safe Guards", [
                renderDateTime("Throttled until", user.throttledUntil),
                renderDetail("Failed login attempts", String(user.failedLoginAttempts || 0)),
                renderDateTime("Failed login window", user.failedLoginWindowStartedAt)
            ]),
            renderSection("Contact", [
                renderDetail("Phone", user.phone)
            ])
        ].join("");
    }

    function updateTableRow(user) {
        const $row = $(`[data-user-row="${user.id}"]`);
        $row.find("[data-user-open]").text(user.name);
    }

    function renderModal(user) {
        activeUser = user;
        $suspendForm[0]?.reset();

        $("[data-user-avatar]").attr("src", user.avatarUrl || "/images/avatar/default.png");
        $("[data-user-title]").text(user.name || "User details");
        $("[data-user-subtitle]").text(user.email || "");
        $("[data-user-details]").html(renderUserDetails(user));

        const $banner = $("[data-user-suspension-banner]");
        if (user.isSuspended && user.activeSuspension && user.activeSuspension.reason) {
            $banner
                .prop("hidden", false)
                .html(`
                    <strong>Account suspended</strong>
                    <span>By ${escapeHtml(user.activeSuspension.issuedBy)} · ${escapeHtml(window.formatClientSuspensionEnd(user.activeSuspension.datetimeEnd))}</span>
                    <p>${escapeHtml(user.activeSuspension.reason)}</p>
                `);
        } else {
            $banner.prop("hidden", true).empty();
        }

        const $suspendButton = $("[data-user-suspend-action]");
        $suspendButton
            .prop("hidden", !user.canSuspend)
            .prop("disabled", !user.canSuspend)
            .text(user.isSuspended ? "Unsuspend" : "Suspend");

        $("[data-user-impersonate]")
            .prop("hidden", !user.canImpersonate)
            .prop("disabled", !user.canImpersonate);

        $userModal.prop("hidden", false);
    }

    function closeUserModal() {
        activeUser = null;
        $userModal.prop("hidden", true);
        closeSuspendModal();
    }

    function openSuspendModal() {
        if (!activeUser)
            return;

        $("[data-suspend-user-name]").text(activeUser.name || "");
        $suspendForm[0]?.reset();
        $suspendModal.prop("hidden", false);
        $("#suspend-reason").trigger("focus");
    }

    function closeSuspendModal() {
        $suspendModal.prop("hidden", true);
        $suspendForm[0]?.reset();
    }

    function updateUserStatus(payload) {
        return window.guardedFetch("/admin/user-status", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }).then(response => response.json()).then(response => {
            if (!response || !response.success) {
                showMessage(response && response.message ? response.message : "Could not update user status.", "error");
                return false;
            }

            activeUser.isSuspended = Boolean(response.isSuspended);
            activeUser.accountStatus = response.accountStatus || activeUser.accountStatus;
            activeUser.activeSuspension = response.activeSuspension || null;
            updateTableRow(activeUser);
            renderModal(activeUser);
            showMessage(response.message || "User status updated.", "success");
            return true;
        }).catch(err => {
            console.error(err);
            showMessage(window.getRequestErrorMessage(err, "Could not update user status."), "error");
            return false;
        });
    }

    $("[data-user-open]").on("click", function () {
        const user = getUser(String($(this).attr("data-user-open") || ""));

        if (user)
            renderModal(user);
    });

    $("[data-user-modal-close]").on("click", closeUserModal);

    $("[data-user-suspend-action]").on("click", function () {
        if (!activeUser || !activeUser.canSuspend)
            return;

        if (activeUser.isSuspended) {
            updateUserStatus({
                userId: activeUser.id,
                action: "unsuspend"
            });
            return;
        }

        openSuspendModal();
    });

    $("[data-suspend-modal-close]").on("click", closeSuspendModal);

    $suspendForm.on("submit", function (event) {
        event.preventDefault();

        if (!activeUser || !activeUser.canSuspend)
            return;

        const reason = String($("#suspend-reason").val() || "").trim();
        const duration = String($("#suspend-duration").val() || "");

        if (!reason || !duration) {
            showMessage("Please provide a reason and duration.", "error");
            return;
        }

        updateUserStatus({
            userId: activeUser.id,
            action: "suspend",
            reason,
            duration
        }).then(updated => {
            if (updated)
                closeSuspendModal();
        });
    });

    $("[data-user-impersonate]").on("click", function () {
        if (!activeUser || !activeUser.canImpersonate)
            return;

        const $button = $(this);
        $button.prop("disabled", true);

        window.guardedFetch("/admin/impersonate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId: activeUser.id
            })
        }).then(response => response.json()).then(response => {
            if (!response || !response.success) {
                showMessage(response && response.message ? response.message : "Could not start impersonation.", "error");
                return;
            }

            window.location.href = response.redirectTo || "/";
        }).catch(err => {
            console.error(err);
            showMessage(window.getRequestErrorMessage(err, "Could not start impersonation."), "error");
        }).finally(() => {
            $button.prop("disabled", false);
        });
    });

    $(document).on("keydown", function (event) {
        if (event.key !== "Escape")
            return;

        if (!$suspendModal.prop("hidden")) {
            closeSuspendModal();
            return;
        }

        if (!$userModal.prop("hidden"))
            closeUserModal();
    });
});
