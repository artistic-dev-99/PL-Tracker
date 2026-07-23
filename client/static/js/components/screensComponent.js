// Outer Application Screens Component (Setup, First-Time Admin, Login, Register)
export function renderScreensComponent() {
    return `
    <!-- Global Connection Status / Network Unreachable Screen -->
    <div id="setup-screen" class="screen hidden">
        <div class="glass-card compact-card fade-in">
            <h2>Server Connection Setup</h2>
            <p class="subtitle">Enter the IP and Port of the Host PC running the PL Tracker Server.</p>

            <div class="input-group">
                <label for="setup-ip">Host Server IP</label>
                <input type="text" id="setup-ip" placeholder="e.g. 192.168.1.100" value="127.0.0.1">
                <span class="error-text" id="setup-ip-error"></span>
            </div>

            <div class="input-group">
                <label for="setup-port">Server Port</label>
                <input type="number" id="setup-port" placeholder="e.g. 5000" value="5000">
                <span class="error-text" id="setup-port-error"></span>
            </div>

            <button id="save-setup-btn" class="primary-btn">Test & Connect</button>
            <p class="status-msg text-center mt-3" id="setup-status"></p>
        </div>
    </div>

    <!-- First-Time Admin Setup Screen -->
    <div id="first-time-screen" class="screen hidden">
        <div class="glass-card compact-card fade-in">
            <div class="badge admin-badge">First-Time Setup</div>
            <h2>Create Admin Account</h2>
            <p class="subtitle">No users found in database. Please create the initial Administrator account.</p>

            <div class="input-group">
                <label for="admin-setup-username">Username</label>
                <input type="text" id="admin-setup-username" placeholder="Enter username">
                <span class="error-text" id="admin-setup-username-error"></span>
            </div>

            <div class="input-group">
                <label for="admin-setup-password">Password</label>
                <div class="password-wrapper">
                    <input type="password" id="admin-setup-password" placeholder="Enter password">
                    <button type="button" class="toggle-password-btn" data-target="admin-setup-password">Show</button>
                </div>
                <span class="error-text" id="admin-setup-password-error"></span>
            </div>

            <button id="create-admin-btn" class="primary-btn">Initialize App</button>
            <p class="status-msg text-center mt-3" id="first-time-status"></p>
        </div>
    </div>

    <!-- Login Screen -->
    <div id="login-screen" class="screen">
        <div class="glass-card compact-card fade-in login-card">
            <div class="login-header-section text-center">
                <div class="login-logo-box">
                    <svg class="logo-icon-svg login-logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path
                            d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                </div>
                <h1 class="login-brand-title"><span class="logo-accent">PL</span> Tracker</h1>
                <p class="subtitle">Please sign in to manage Packing Lists</p>
            </div>

            <form id="login-form" onsubmit="return false;">
                <div class="input-group">
                    <label for="login-username">Username</label>
                    <input type="text" id="login-username" autocomplete="username">
                    <span class="error-text" id="login-username-error"></span>
                </div>

                <div class="input-group">
                    <label for="login-password">Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="login-password" autocomplete="current-password">
                        <button type="button" class="toggle-password-btn" data-target="login-password">Show</button>
                    </div>
                    <span class="error-text" id="login-password-error"></span>
                </div>

                <div class="form-row justify-between mb-4">
                    <label class="checkbox-container">
                        <input type="checkbox" id="remember-me">
                        <span class="checkmark"></span>
                        Remember my username
                    </label>
                </div>

                <button type="submit" id="login-btn" class="primary-btn btn-lg w-full">Sign In</button>
            </form>

            <div class="register-link mt-4 text-center">
                Need a new account? <a href="#" id="go-to-register-btn">Request Signup</a>
            </div>

            <p class="status-msg text-center mt-3" id="login-status"></p>
        </div>
    </div>

    <!-- Registration Screen (Requires Admin Authorization) -->
    <div id="register-screen" class="screen hidden">
        <div class="glass-card fade-in">
            <h2>User Registration</h2>
            <p class="subtitle">New account creation requires Administrator authorization.</p>

            <div class="form-grid">
                <!-- Admin Credentials Verification -->
                <div class="grid-section">
                    <h3>1. Admin Authorization</h3>
                    <div class="input-group">
                        <label for="reg-admin-username">Admin Username</label>
                        <input type="text" id="reg-admin-username" placeholder="Verify Admin Username">
                        <span class="error-text" id="reg-admin-username-error"></span>
                    </div>
                    <div class="input-group">
                        <label for="reg-admin-password">Admin Password</label>
                        <div class="password-wrapper">
                            <input type="password" id="reg-admin-password" placeholder="Verify Admin Password">
                            <button type="button" class="toggle-password-btn" data-target="reg-admin-password">Show</button>
                        </div>
                        <span class="error-text" id="reg-admin-password-error"></span>
                    </div>
                </div>

                <!-- New User Details -->
                <div class="grid-section">
                    <h3>2. New Account Details</h3>
                    <div class="input-group">
                        <label for="reg-new-username">New Username</label>
                        <input type="text" id="reg-new-username" placeholder="Choose username">
                        <span class="error-text" id="reg-new-username-error"></span>
                    </div>
                    <div class="input-group">
                        <label for="reg-new-password">New Password</label>
                        <div class="password-wrapper">
                            <input type="password" id="reg-new-password" placeholder="Create password">
                            <button type="button" class="toggle-password-btn" data-target="reg-new-password">Show</button>
                        </div>
                        <span class="error-text" id="reg-new-password-error"></span>
                    </div>
                    <div class="input-group">
                        <label for="reg-new-role">Role</label>
                        <select id="reg-new-role">
                            <option value="Local">Local User</option>
                            <option value="Admin">Administrator</option>
                        </select>
                        <span class="error-text" id="reg-new-role-error"></span>
                    </div>
                </div>
            </div>

            <div class="form-actions mt-4 justify-center" style="display: flex; gap: 12px; justify-content: center;">
                <button id="register-btn" class="primary-btn btn-lg px-4">Create User Account</button>
                <button id="cancel-register-btn" class="secondary-btn btn-lg px-4">Cancel</button>
            </div>
            <p class="status-msg text-center mt-3" id="register-status"></p>
        </div>
    </div>
    `;
}
