let allUsers = []
if (localStorage.insidelautechUsers) {
    allUsers = JSON.parse(localStorage.getItem('insidelautechUsers'))
}

const signUp = (event) => {
    event.preventDefault()

    if (!fullname || !email || !password || !confirmPassword) {
        showToast('Form elements not found. Please refresh the page.', 'error')
        return
    }

    if (fullname.value.trim() === '' || email.value.trim() === '' || password.value.trim() === '' || confirmPassword.value.trim() === '') {
        showToast('Please fill in all required fields.', 'warning')
        return
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    const validEmail = emailPattern.test(email.value.trim())

    if (!validEmail) {
        showToast('Please enter a valid email address.', 'warning')
        return
    }

    if (password.value.length < 8) {
        showToast('Password must be at least 8 characters.', 'warning')
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
        name: fullname.value,
        email: email.value.trim(),
        phone: phone.value,
        matric: matric.value,
        password: password.value
    }

    let found = false
    for (let i = 0; i < allUsers.length; i++) {
        if (allUsers[i].email === userObj.email) {
            found = true
            break
        }
    }

    if (found) {
        showToast('An account with this email already exists.', 'warning')
        return
    }

    allUsers.push(userObj)
    localStorage.setItem('insidelautechUsers', JSON.stringify(allUsers))

    showToast('Account created successfully! Please login.', 'success')

    fullname.value = ''
    email.value = ''
    phone.value = ''
    matric.value = ''
    password.value = ''
    confirmPassword.value = ''
    terms.checked = false

    setTimeout(() => {
        window.location.href = 'login.html'
    }, 1200)
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form.auth-form')
    if (form) {
        form.addEventListener('submit', signUp)
    }
})
