document.addEventListener("DOMContentLoaded", () => {
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = 2;
    const ATTEMPT_KEY = "shoponcampus_login_attempts";

    const activeSession = checkSession();
    if (activeSession) {
        window.location.href = "dashboard.html";
        return;
    }

    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const rememberMe = document.getElementById("rememberMe");
    const forgotPasswordLink = document.querySelector(".forgot-password");
    const signInBtn = document.getElementById("signInBtn");
    const attemptInfo = document.getElementById("loginAttemptInfo");
    const passwordToggleButtons = document.querySelectorAll(".password-toggle");
    const nextPath = new URLSearchParams(window.location.search).get("next");

    const getAttemptState = () => {
        const raw = localStorage.getItem(ATTEMPT_KEY);
        if (!raw) {
            return { count: 0, lockedUntil: null };
        }

        try {
            const parsed = JSON.parse(raw);
            return {
                count: Number(parsed.count) || 0,
                lockedUntil: parsed.lockedUntil || null,
            };
        } catch {
            return { count: 0, lockedUntil: null };
        }
    };

    const setAttemptState = (state) => {
        localStorage.setItem(ATTEMPT_KEY, JSON.stringify(state));
    };

    const clearAttempts = () => {
        localStorage.removeItem(ATTEMPT_KEY);
        if (attemptInfo) {
            attemptInfo.classList.remove("show");
            attemptInfo.textContent = "";
        }
        if (signInBtn) {
            signInBtn.disabled = false;
        }
    };

    const updateLockoutState = () => {
        const state = getAttemptState();
        const now = Date.now();
        const lockedUntil = state.lockedUntil ? new Date(state.lockedUntil).getTime() : 0;

        if (lockedUntil > now) {
            const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
            if (attemptInfo) {
                attemptInfo.classList.add("show");
                attemptInfo.textContent = `Too many failed attempts. Try again in ${remainingSeconds}s.`;
            }
            if (signInBtn) {
                signInBtn.disabled = true;
            }
            return true;
        }

        if (state.lockedUntil) {
            clearAttempts();
        }

        return false;
    };

    const registerFailedAttempt = () => {
        const state = getAttemptState();
        const newCount = state.count + 1;

        if (newCount >= MAX_LOGIN_ATTEMPTS) {
            const lockedUntil = new Date(
                Date.now() + LOCKOUT_MINUTES * 60 * 1000,
            ).toISOString();
            setAttemptState({ count: newCount, lockedUntil });
            updateLockoutState();
            showToast(
                "Too many failed attempts. Please wait before trying again.",
                "error",
            );
            return;
        }

        setAttemptState({ count: newCount, lockedUntil: null });
        if (attemptInfo) {
            attemptInfo.classList.remove("show");
            attemptInfo.textContent = "";
        }
    };

    passwordToggleButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const input = document.getElementById(targetId);
            if (!input) {
                return;
            }

            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            btn.innerHTML = isPassword
                ? '<i class="bi bi-eye-slash"></i>'
                : '<i class="bi bi-eye"></i>';
        });
    });

    const remembered =
        localStorage.getItem("shoponcampus_remembered_email") ||
        localStorage.getItem("shoponcampus_rememberedEmail");
    if (remembered) {
        emailInput.value = remembered;
        rememberMe.checked = true;
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", (event) => {
            event.preventDefault();
            window.location.href = "forgot-password.html";
        });
    }

    updateLockoutState();

    const lockoutInterval = setInterval(() => {
        const locked = updateLockoutState();
        if (!locked) {
            clearInterval(lockoutInterval);
        }
    }, 1000);

    async function loginWithBackend(email, password) {
        try {
            if (typeof makeApiRequest !== "function" || !window.API_CONFIG) {
                throw new Error("API client is not configured.");
            }

            const data = await makeApiRequest(API_CONFIG.endpoints.auth.login, {
                method: "POST",
                includeAuth: false,
                body: { email, password },
            });

            return data;
        } catch (err) {
            if (err?.data?.reason === "verification_pending") {
                const verificationError = new Error(err.data.error || "Email not verified");
                verificationError.reason = "verification_pending";
                verificationError.email = err.data.email;
                throw verificationError;
            }

            if (err.reason === "verification_pending") {
                throw err;
            }

            throw new Error(err.message || "Login failed");
        }
    }

    if (!form) {
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const isLocked = updateLockoutState();
        if (isLocked) {
            return;
        }

        const normalizedEmail = emailInput.value.trim().toLowerCase();
        if (!normalizedEmail || !passwordInput.value) {
            showToast("Please fill in all fields", "warning");
            return;
        }

        try {
            const result = await loginWithBackend(normalizedEmail, passwordInput.value);
            clearAttempts();

            const session = {
                email: result.user.email,
                name: result.user.name,
                loggedIn: true,
                loginTime: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
            };
            localStorage.setItem("shoponcampus_session", JSON.stringify(session));
            if (result.token) {
                localStorage.setItem("shoponcampus_auth_token", result.token);
            }

            if (rememberMe.checked) {
                localStorage.setItem("shoponcampus_remembered_email", normalizedEmail);
                localStorage.removeItem("shoponcampus_rememberedEmail");
            } else {
                localStorage.removeItem("shoponcampus_remembered_email");
                localStorage.removeItem("shoponcampus_rememberedEmail");
            }

            showToast("Login successful! Welcome back.", "success");
            setTimeout(() => {
                if (nextPath && !nextPath.startsWith("http")) {
                    window.location.href = nextPath;
                } else {
                    window.location.href = "dashboard.html";
                }
            }, 1000);
        } catch (err) {
            if (err.reason === "verification_pending") {
                showToast(
                    "Please verify your email first. Redirecting to verification page...",
                    "warning",
                );
                setTimeout(() => {
                    localStorage.setItem("verification_pending_email", err.email);
                    window.location.href = `verification-pending.html?email=${encodeURIComponent(err.email)}`;
                }, 1500);
                return;
            }

            registerFailedAttempt();
            showToast(err.message || "Login failed", "error");
        }
    });
});
