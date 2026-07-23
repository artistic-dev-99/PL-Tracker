// Admin User Management Module
import { state } from '../state.js';
import { api } from '../api.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/domUtils.js';
import { adminConfirmDialog } from '../utils/dialogs.js';
import { fetchSpreadsheetData } from './spreadsheet.js';

export async function fetchAdminUsersList() {
    if (!state.currentUser || state.currentUser.role !== "Admin") return;

    try {
        const users = await api.get(`/api/admin/users?requesting_userid=${state.currentUser.userid}`);
        renderAdminUsersTable(users);
    } catch (e) {
        toast.error("Failed to load users: " + (e.message || "Server error"));
    }
}

export function renderAdminUsersTable(users) {
    const tbody = document.getElementById("admin-users-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    users.forEach(u => {
        const tr = document.createElement("tr");
        const isSelf = state.currentUser.userid === u.UserID;

        tr.innerHTML = `
            <td>${u.UserID}</td>
            <td><strong>${escapeHtml(u.Username)}</strong> ${isSelf ? '<span class="badge info-badge">You</span>' : ''}</td>
            <td>
                <select class="settings-role-select" data-id="${u.UserID}" ${isSelf ? 'disabled' : ''}>
                    <option value="Local" ${u.Role === 'Local' ? 'selected' : ''}>Local User</option>
                    <option value="Admin" ${u.Role === 'Admin' ? 'selected' : ''}>Administrator</option>
                </select>
            </td>
            <td>${u.CreatedTimestamp ? u.CreatedTimestamp.substring(0, 10) : '—'}</td>
            <td class="text-center">
                <button class="danger-btn btn-sm" onclick="window.deleteUserByAdmin(${u.UserID}, '${escapeHtml(u.Username)}')" ${isSelf ? 'disabled' : ''}>
                    Delete Account
                </button>
            </td>
        `;

        const roleSelect = tr.querySelector(".settings-role-select");
        if (roleSelect && !isSelf) {
            roleSelect.addEventListener("change", (e) => {
                const newRole = e.target.value;
                updateUserByAdmin(u.UserID, u.Username, newRole);
            });
        }

        tbody.appendChild(tr);
    });
}

export async function updateUserByAdmin(targetUserid, username, newRole) {
    try {
        await api.post("/api/users/update", {
            requesting_userid: state.currentUser.userid,
            target_userid: targetUserid,
            new_role: newRole
        });
        toast.success(`Updated ${username}'s role to ${newRole}`);
        if (state.currentUser.userid === targetUserid) {
            state.currentUser.role = newRole;
            const badge = document.getElementById("user-badge");
            if (badge) badge.innerText = newRole;
        }
        fetchAdminUsersList();
    } catch (e) {
        toast.error(e.message || "Failed to update user account.");
    }
}

export function deleteUserByAdmin(targetUserid, username) {
    state.pendingDeleteUserId = targetUserid;
    state.pendingDeleteUsername = username;

    const modal = document.getElementById("user-delete-options-modal");
    const msgEl = document.getElementById("delete-user-modal-msg");
    if (msgEl) msgEl.innerText = `Are you sure you want to delete user account: ${username}?`;
    if (modal) modal.classList.remove("hidden");
}

export async function handleAdminCreateUser() {
    const user = document.getElementById("admin-new-username")?.value.trim() || "";
    const pass = document.getElementById("admin-new-password")?.value || "";
    const role = document.getElementById("admin-new-role")?.value || "Local";
    const status = document.getElementById("admin-create-user-status");

    if (!user || !pass) {
        if (status) {
            status.className = "status-msg error-msg text-center mt-2";
            status.innerText = "Username and password are required.";
        }
        return;
    }

    if (pass.length < 6) {
        if (status) {
            status.className = "status-msg error-msg text-center mt-2";
            status.innerText = "Password must be at least 6 characters.";
        }
        return;
    }

    adminConfirmDialog.show({
        onConfirm: async (adminPasswordConfirm) => {
            if (!adminPasswordConfirm) {
                toast.warning("Administrator password confirmation required.");
                return;
            }

            if (status) {
                status.className = "status-msg text-center mt-2";
                status.innerText = "Creating account...";
            }

            try {
                await api.post("/api/auth/register", {
                    admin_username: state.currentUser.username,
                    admin_password: adminPasswordConfirm,
                    new_username: user,
                    new_password: pass,
                    new_role: role
                });

                if (status) {
                    status.className = "status-msg success-msg text-center mt-2";
                    status.innerText = `Operator ${user} registered!`;
                }
                const newU = document.getElementById("admin-new-username");
                const newP = document.getElementById("admin-new-password");
                if (newU) newU.value = "";
                if (newP) newP.value = "";
                fetchAdminUsersList();
            } catch (e) {
                if (status) {
                    status.className = "status-msg error-msg text-center mt-2";
                    status.innerText = e.message || "Failed to create account.";
                }
            }
        }
    });
}

if (typeof window !== "undefined") {
    window.fetchAdminUsersList = fetchAdminUsersList;
    window.deleteUserByAdmin = deleteUserByAdmin;
    window.handleAdminCreateUser = handleAdminCreateUser;
}
