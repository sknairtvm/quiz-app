let currentQuestionPage = 1;
let currentUserPage = 1;
let currentReportPage = 1;
let questionsPerPage = 10;
let usersPerPage = 10;
let reportsPerPage = 10;
let totalQuestions = 0;
let totalUsers = 0;
let totalReports = 0;

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        console.log('Admin stats loaded:', stats);
        document.getElementById('admin-total-users').textContent = stats.total_users || 0;
        document.getElementById('admin-total-questions').textContent = stats.total_questions || 0;
        document.getElementById('admin-total-quizzes').textContent = stats.total_quizzes || 0;
        document.getElementById('admin-reported-questions').textContent = stats.total_reported || 0;
    } catch (err) {
        console.error('Error loading admin stats:', err);
    }
}

async function adminLogin() {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    const loginError = document.getElementById('login-error');

    console.log('Admin login request:', { username });

    if (!username || !password) {
        loginError.textContent = 'Username and password are required';
        loginError.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        console.log('Admin login response:', result);

        if (result.success) {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            loginError.style.display = 'none';
            loadStats();
            loadQuestions();
            loadUsers();
            loadReportedQuestions();
        } else {
            loginError.textContent = result.error || 'Login failed';
            loginError.style.display = 'block';
        }
    } catch (err) {
        console.error('Admin login error:', err);
        loginError.textContent = 'Error connecting to server';
        loginError.style.display = 'block';
    }
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tabs button[onclick="showTab('${tabId}')"]`).classList.add('active');

    // Reset checkboxes when switching tabs
    document.getElementById('select-all-questions').checked = false;
    document.getElementById('select-all-users').checked = false;
    document.querySelectorAll('.question-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
}

async function addQuestion(event) {
    event.preventDefault();
    const question = document.getElementById('question-text').value;
    const option1 = document.getElementById('option1').value;
    const option2 = document.getElementById('option2').value;
    const option3 = document.getElementById('option3').value;
    const option4 = document.getElementById('option4').value;
    const correctAnswer = parseInt(document.getElementById('correct-answer').value);
    const formMessage = document.getElementById('form-message');

    try {
        const response = await fetch('/api/admin/add-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, option1, option2, option3, option4, correctAnswer })
        });
        const result = await response.json();

        if (result.success) {
            formMessage.textContent = 'Question added successfully!';
            formMessage.style.color = 'green';
            formMessage.style.display = 'block';
            document.getElementById('add-question-form').reset();
            loadQuestions();
            setTimeout(() => {
                formMessage.style.display = 'none';
            }, 3000);
        } else {
            formMessage.textContent = 'Error adding question: ' + result.error;
            formMessage.style.color = 'red';
            formMessage.style.display = 'block';
        }
    } catch (err) {
        console.error('Error adding question:', err);
        formMessage.textContent = 'Error connecting to server';
        formMessage.style.display = 'block';
    }
}

async function loadQuestions() {
    questionsPerPage = parseInt(document.getElementById('questions-per-page').value);
    try {
        const response = await fetch(`/api/admin/questions?page=${currentQuestionPage}&limit=${questionsPerPage}`);
        const data = await response.json();
        totalQuestions = data.total;
        const questions = data.questions;

        const tbody = document.getElementById('questions-body');
        tbody.innerHTML = questions.map(q => `
            <tr>
                <td><input type="checkbox" class="question-checkbox" value="${q.id}"></td>
                <td>${q.question}</td>
                <td>${q.option1}</td>
                <td>${q.option2}</td>
                <td>${q.option3}</td>
                <td>${q.option4}</td>
                <td>${q.correct_answer}</td>
                <td>
                    <button class="action-btn edit" onclick="editQuestion(${q.id})"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteQuestion(${q.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');

        updateQuestionPagination();
    } catch (err) {
        console.error('Error loading questions:', err);
    }
}

async function loadUsers() {
    usersPerPage = parseInt(document.getElementById('users-per-page').value);
    try {
        const response = await fetch(`/api/admin/users?page=${currentUserPage}&limit=${usersPerPage}`);
        const data = await response.json();
        totalUsers = data.total;
        const users = data.users;

        const tbody = document.getElementById('users-body');
        tbody.innerHTML = users.map(u => `
            <tr>
                <td><input type="checkbox" class="user-checkbox" value="${u.id}"></td>
                <td>${u.username}</td>
                <td>${u.district}</td>
                <td>${u.num_questions}</td>
                <td>${formatTime(u.time_taken)}</td>
                <td>${u.score}</td>
                <td>
                    <button class="action-btn edit" onclick="editUser(${u.id})"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');

        updateUserPagination();
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

async function loadReportedQuestions() {
    reportsPerPage = parseInt(document.getElementById('reports-per-page').value);
    try {
        const response = await fetch(`/api/admin/reported-questions?page=${currentReportPage}&limit=${reportsPerPage}`);
        const data = await response.json();
        totalReports = data.total;
        const reports = data.reports;

        const tbody = document.getElementById('reported-body');
        tbody.innerHTML = reports.map(r => `
            <tr>
                <td>${r.question}</td>
                <td>${r.username}</td>
                <td>${r.comment}</td>
                <td>${new Date(r.timestamp).toLocaleString()}</td>
            </tr>
        `).join('');

        updateReportPagination();
    } catch (err) {
        console.error('Error loading reported questions:', err);
    }
}

async function uploadQuestions(event) {
    event.preventDefault();
    const fileInput = document.getElementById('questions-file');
    const formData = new FormData();
    formData.append('questions', fileInput.files[0]);

    try {
        const response = await fetch('/api/admin/upload-questions', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        const uploadMessage = document.getElementById('upload-message');

        if (result.success) {
            uploadMessage.textContent = `Successfully uploaded ${result.count} questions!`;
            uploadMessage.style.color = 'green';
            uploadMessage.style.display = 'block';
            document.getElementById('upload-questions-form').reset();
            loadStats();
            loadQuestions();
            setTimeout(() => {
                uploadMessage.style.display = 'none';
            }, 3000);
        } else {
            uploadMessage.textContent = 'Error uploading questions: ' + result.error;
            uploadMessage.style.color = 'red';
            uploadMessage.style.display = 'block';
        }
    } catch (err) {
        console.error('Error uploading questions:', err);
        document.getElementById('upload-message').textContent = 'Error connecting to server';
        document.getElementById('upload-message').style.display = 'block';
    }
}

function toggleSelectAll(className, checked) {
    document.querySelectorAll(`.${className}`).forEach(cb => cb.checked = checked);
}

async function deleteSelectedQuestions() {
    const selected = Array.from(document.querySelectorAll('.question-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0) {
        alert('Please select at least one question to delete.');
        return;
    }

    if (confirm(`Are you sure you want to delete ${selected.length} question(s)?`)) {
        try {
            const response = await fetch('/api/admin/delete-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selected })
            });
            const result = await response.json();
            if (result.success) {
                alert('Selected questions deleted successfully!');
                loadQuestions();
                loadStats();
            } else {
                alert('Error deleting questions: ' + result.error);
            }
        } catch (err) {
            console.error('Error deleting questions:', err);
            alert('Error deleting questions');
        }
    }
}

async function deleteSelectedUsers() {
    const selected = Array.from(document.querySelectorAll('.user-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0) {
        alert('Please select at least one user to delete.');
        return;
    }

    if (confirm(`Are you sure you want to delete ${selected.length} user(s)?`)) {
        try {
            const response = await fetch('/api/admin/delete-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selected })
            });
            const result = await response.json();
            if (result.success) {
                alert('Selected users deleted successfully!');
                loadUsers();
                loadStats();
            } else {
                alert('Error deleting users: ' + result.error);
            }
        } catch (err) {
            console.error('Error deleting users:', err);
            alert('Error deleting users');
        }
    }
}

function updateQuestionPagination() {
    const totalPages = Math.ceil(totalQuestions / questionsPerPage);
    document.getElementById('question-page-info').textContent = `Page ${currentQuestionPage} of ${totalPages}`;
    document.querySelector('#manage-questions button[onclick="previousQuestionPage()"]').disabled = currentQuestionPage === 1;
    document.querySelector('#manage-questions button[onclick="nextQuestionPage()"]').disabled = currentQuestionPage === totalPages;
}

function updateUserPagination() {
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    document.getElementById('user-page-info').textContent = `Page ${currentUserPage} of ${totalPages}`;
    document.querySelector('#manage-users button[onclick="previousUserPage()"]').disabled = currentUserPage === 1;
    document.querySelector('#manage-users button[onclick="nextUserPage()"]').disabled = currentUserPage === totalPages;
}

function updateReportPagination() {
    const totalPages = Math.ceil(totalReports / reportsPerPage);
    document.getElementById('report-page-info').textContent = `Page ${currentReportPage} of ${totalPages}`;
    document.querySelector('#reported-questions button[onclick="previousReportPage()"]').disabled = currentReportPage === 1;
    document.querySelector('#reported-questions button[onclick="nextReportPage()"]').disabled = currentReportPage === totalPages;
}

function previousQuestionPage() {
    if (currentQuestionPage > 1) {
        currentQuestionPage--;
        loadQuestions();
    }
}

function nextQuestionPage() {
    const totalPages = Math.ceil(totalQuestions / questionsPerPage);
    if (currentQuestionPage < totalPages) {
        currentQuestionPage++;
        loadQuestions();
    }
}

function previousUserPage() {
    if (currentUserPage > 1) {
        currentUserPage--;
        loadUsers();
    }
}

function nextUserPage() {
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    if (currentUserPage < totalPages) {
        currentUserPage++;
        loadUsers();
    }
}

function previousReportPage() {
    if (currentReportPage > 1) {
        currentReportPage--;
        loadReportedQuestions();
    }
}

function nextReportPage() {
    const totalPages = Math.ceil(totalReports / reportsPerPage);
    if (currentReportPage < totalPages) {
        currentReportPage++;
        loadReportedQuestions();
    }
}

async function clearReportedQuestions() {
    if (confirm('Are you sure you want to clear all reported questions?')) {
        try {
            const response = await fetch('/api/admin/clear-reported', {
                method: 'POST'
            });
            const result = await response.json();
            if (result.success) {
                alert('Reported questions cleared successfully!');
                loadReportedQuestions();
                loadStats();
            } else {
                alert('Error clearing reported questions: ' + result.error);
            }
        } catch (err) {
            console.error('Error clearing reported questions:', err);
            alert('Error clearing reported questions');
        }
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function editQuestion(id) {
    try {
        const response = await fetch(`/api/admin/questions/${id}`);
        const question = await response.json();

        document.getElementById('edit-question-id').value = id;
        document.getElementById('edit-question-text').value = question.question;
        document.getElementById('edit-option1').value = question.option1;
        document.getElementById('edit-option2').value = question.option2;
        document.getElementById('edit-option3').value = question.option3;
        document.getElementById('edit-option4').value = question.option4;
        document.getElementById('edit-correct-answer').value = question.correct_answer;

        document.getElementById('edit-question-modal').style.display = 'flex';
    } catch (err) {
        console.error('Error loading question for edit:', err);
        alert('Error loading question');
    }
}

async function saveQuestionEdit(event) {
    event.preventDefault();
    const id = document.getElementById('edit-question-id').value;
    const question = document.getElementById('edit-question-text').value;
    const option1 = document.getElementById('edit-option1').value;
    const option2 = document.getElementById('edit-option2').value;
    const option3 = document.getElementById('edit-option3').value;
    const option4 = document.getElementById('edit-option4').value;
    const correctAnswer = parseInt(document.getElementById('edit-correct-answer').value);

    try {
        const response = await fetch(`/api/admin/questions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, option1, option2, option3, option4, correctAnswer })
        });
        const result = await response.json();
        if (result.success) {
            alert('Question updated successfully!');
            closeModal('edit-question-modal');
            loadQuestions();
        } else {
            alert('Error updating question: ' + result.error);
        }
    } catch (err) {
        console.error('Error saving question edit:', err);
        alert('Error saving question');
    }
}

async function deleteQuestion(id) {
    if (confirm('Are you sure you want to delete this question?')) {
        try {
            const response = await fetch(`/api/admin/questions/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                alert('Question deleted successfully!');
                loadQuestions();
                loadStats();
            } else {
                alert('Error deleting question: ' + result.error);
            }
        } catch (err) {
            console.error('Error deleting question:', err);
            alert('Error deleting question');
        }
    }
}

async function editUser(id) {
    try {
        const response = await fetch(`/api/admin/users/${id}`);
        const user = await response.json();

        document.getElementById('edit-user-id').value = id;
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-district').value = user.district;
        document.getElementById('edit-num-questions').value = user.num_questions;
        document.getElementById('edit-time-taken').value = user.time_taken;
        document.getElementById('edit-score').value = user.score;

        document.getElementById('edit-user-modal').style.display = 'flex';
    } catch (err) {
        console.error('Error loading user for edit:', err);
        alert('Error loading user');
    }
}

async function saveUserEdit(event) {
    event.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-username').value;
    const district = document.getElementById('edit-district').value;
    const numQuestions = parseInt(document.getElementById('edit-num-questions').value);
    const timeTaken = parseInt(document.getElementById('edit-time-taken').value);
    const score = parseInt(document.getElementById('edit-score').value);

    try {
        const response = await fetch(`/api/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, district, numQuestions, timeTaken, score })
        });
        const result = await response.json();
        if (result.success) {
            alert('User updated successfully!');
            closeModal('edit-user-modal');
            loadUsers();
        } else {
            alert('Error updating user: ' + result.error);
        }
    } catch (err) {
        console.error('Error saving user edit:', err);
        alert('Error saving user');
    }
}

async function deleteUser(id) {
    if (confirm('Are you sure you want to delete this user?')) {
        try {
            const response = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                alert('User deleted successfully!');
                loadUsers();
                loadStats();
            } else {
                alert('Error deleting user: ' + result.error);
            }
        } catch (err) {
            console.error('Error deleting user:', err);
            alert('Error deleting user');
        }
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function logoutAdmin() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('admin-username').value = '';
        document.getElementById('admin-password').value = '';
        document.getElementById('login-error').style.display = 'none';
    } catch (err) {
        console.error('Error logging out admin:', err);
    }
}