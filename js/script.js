let allUsers = []
if (localStorage.insidelautechUsers) {
    allUsers = JSON.parse(localStorage.getItem('insidelautechUsers'))
}

const updateConfirmPasswordHint = (passwordInput, confirmPasswordInput, hintElement) => {
    if (!passwordInput || !confirmPasswordInput || !hintElement) {
        return
    }

    if (!confirmPasswordInput.value) {
        hintElement.textContent = 'Re-enter your password exactly.'
        hintElement.style.color = '#6c757d'
        return
    }

    if (passwordInput.value === confirmPasswordInput.value) {
        hintElement.textContent = 'Passwords match.'
        hintElement.style.color = '#198754'
    } else {
        hintElement.textContent = 'Passwords do not match yet.'
        hintElement.style.color = '#dc3545'
    }
}

const setupPasswordVisibilityToggles = () => {
    const toggleButtons = document.querySelectorAll('.password-toggle')
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target')
            const input = document.getElementById(targetId)
            if (!input) {
                return
            }

            const isPassword = input.type === 'password'
            input.type = isPassword ? 'text' : 'password'
            btn.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>'
        })
    })
}

const signUp = (event, formElements) => {
    event.preventDefault()

    const { fullname, email, phone, password, confirmPassword, terms } = formElements

    if (!fullname || !email || !password || !confirmPassword) {
        showToast('Form elements not found. Please refresh the page.', 'error')
        return
    }

    if (fullname.value.trim() === '' || email.value.trim() === '' || password.value.trim() === '' || confirmPassword.value.trim() === '') {
        showToast('Please fill in all required fields.', 'warning')
        return
    }

    const normalizedEmail = email.value.trim().toLowerCase()
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    const validEmail = emailPattern.test(normalizedEmail)

    if (!validEmail) {
        showToast('Please enter a valid email address.', 'warning')
        return
    }

    if (!normalizedEmail.endsWith('.com')) {
        showToast('Please use a .com email address (school domains are not allowed).', 'warning')
        return
    }

    const normalizedPhone = phone.value.trim()
    if (!/^\+?\d{10,15}$/.test(normalizedPhone.replace(/\s+/g, ''))) {
        showToast('Enter a valid phone number (10-15 digits).', 'warning')
        return
    }

    const hasStrongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password.value)
    if (!hasStrongPassword) {
        showToast('Use a stronger password with upper/lowercase letters and a number.', 'warning')
        return
    }

    if (password.value !== confirmPassword.value) {
        showToast('Passwords do not match.', 'warning')
        return
    }

    if (!terms.checked) {
        showToast('You must agree to the Terms & Conditions.', 'warning')
        return
    }

    const userObj = {
        name: fullname.value.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password: password.value,
        createdAt: new Date().toISOString()
    }

    let found = false
    for (let i = 0; i < allUsers.length; i++) {
        const existingEmail = (allUsers[i].email || '').trim().toLowerCase()

        if (existingEmail === userObj.email) {
            found = true
            break
        }
    }

    if (found) {
        showToast('An account already exists with this email.', 'warning')
        return
    }

    allUsers.push(userObj)
    localStorage.setItem('insidelautechUsers', JSON.stringify(allUsers))

    showToast('Account created successfully! Please login.', 'success')

    fullname.value = ''
    email.value = ''
    phone.value = ''
    password.value = ''
    confirmPassword.value = ''
    terms.checked = false

    setTimeout(() => {
        window.location.href = 'login.html'
    }, 1200)
}

document.addEventListener('DOMContentLoaded', () => {
    const activeSession = checkSession()
    if (activeSession) {
        window.location.href = 'dashboard.html'
        return
    }

    const form = document.querySelector('form.auth-form')
    const formElements = {
        fullname: document.getElementById('fullname'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        password: document.getElementById('password'),
        confirmPassword: document.getElementById('confirmPassword'),
        terms: document.getElementById('terms')
    }
    const confirmPasswordHint = document.getElementById('confirmPasswordHint')

    setupPasswordVisibilityToggles()

    if (formElements.password) {
        formElements.password.addEventListener('input', () => {
            updateConfirmPasswordHint(formElements.password, formElements.confirmPassword, confirmPasswordHint)
        })
    }

    if (formElements.confirmPassword) {
        formElements.confirmPassword.addEventListener('input', () => {
            updateConfirmPasswordHint(formElements.password, formElements.confirmPassword, confirmPasswordHint)
        })
    }

    updateConfirmPasswordHint(formElements.password, formElements.confirmPassword, confirmPasswordHint)

    if (form) {
        form.addEventListener('submit', (event) => signUp(event, formElements))
    }
})
