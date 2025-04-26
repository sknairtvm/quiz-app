let currentQuestion = 0;
let score = 0;
let userId = null;
let username = '';
let district = '';
let numQuestions = 0;
let questions = [];
let timerInterval;
let timeLeft;
let startTime;
let userAnswers = [];
let quizId = 0;

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        console.log('Stats loaded:', stats);
        document.getElementById('total-users').textContent = stats.total_users || 0;
        document.getElementById('total-questions').textContent = stats.total_questions || 0;
        document.getElementById('total-answers').textContent = stats.total_answers || 0;
        document.getElementById('total-quizzes').textContent = stats.total_quizzes || 0;
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

async function login() {
    const usernameInput = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const loginError = document.getElementById('login-error');

    console.log('Attempting login:', usernameInput);

    if (!usernameInput || !password) {
        loginError.textContent = 'Username and password are required';
        loginError.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password })
        });
        const result = await response.json();
        console.log('Login response:', result);

        if (result.success) {
            userId = result.userId;
            username = result.username;
            district = result.district;
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('start-screen').style.display = 'block';
            document.getElementById('welcome-message').textContent = `Welcome, ${username}!`;
            loginError.style.display = 'none';
            await loadStats();
        } else {
            loginError.textContent = result.error || 'Login failed';
            loginError.style.display = 'block';
        }
    } catch (err) {
        console.error('Login error:', err);
        loginError.textContent = 'Error connecting to server';
        loginError.style.display = 'block';
    }
}

async function register() {
    const usernameInput = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const districtInput = document.getElementById('register-district').value;
    const registerError = document.getElementById('register-error');

    console.log('Attempting registration:', usernameInput, districtInput);

    const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
    const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{6,20}$/;
    if (!usernameRegex.test(usernameInput)) {
        registerError.textContent = 'Username must be 3-20 characters long and contain only letters, numbers, or underscores!';
        registerError.style.display = 'block';
        return;
    }
    if (!passwordRegex.test(password)) {
        registerError.textContent = 'Password must be 6-20 characters long!';
        registerError.style.display = 'block';
        return;
    }
    if (!districtInput) {
        registerError.textContent = 'Please select a district!';
        registerError.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password, district: districtInput })
        });
        const result = await response.json();
        console.log('Register response:', result);

        if (result.success) {
            alert('Registration successful! Please log in.');
            showLoginForm();
            registerError.style.display = 'none';
        } else {
            registerError.textContent = result.error || 'Registration failed';
            registerError.style.display = 'block';
        }
    } catch (err) {
        console.error('Register error:', err);
        registerError.textContent = 'Error connecting to server';
        registerError.style.display = 'block';
    }
}

function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('login-error').style.display = 'none';
}

function showLoginForm() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-error').style.display = 'none';
}

async function startQuiz() {
    numQuestions = parseInt(document.getElementById('num-questions').value);
    if (!numQuestions) {
        alert('Please choose the number of questions!');
        return;
    }

    try {
        const response = await fetch(`/api/questions?limit=${numQuestions}`);
        questions = await response.json();
        console.log('Questions loaded:', questions);

        if (questions.length < numQuestions) {
            alert('Not enough questions in the database!');
            return;
        }

        userAnswers = [];
        startTime = Date.now();
        setTimer();
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('quiz-screen').style.display = 'block';
        showQuestion();
    } catch (err) {
        console.error('Error starting quiz:', err);
        alert('Error loading questions');
    }
}

function setTimer() {
    const timeLimits = { 10: 5 * 60, 25: 15 * 60, 50: 30 * 60, 100: 60 * 60 };
    timeLeft = timeLimits[numQuestions];
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').textContent = `Time Left: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function showQuestion() {
    const q = questions[currentQuestion];
    document.getElementById('question').textContent = q.question;
    document.getElementById('progress').textContent = `Question ${currentQuestion + 1} of ${numQuestions}`;
    document.getElementById('report-btn').dataset.questionId = q.id;

    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = '';

    [q.option1, q.option2, q.option3, q.option4].forEach((option, index) => {
        const btn = document.createElement('div');
        btn.className = 'option';
        btn.textContent = option;
        btn.onclick = () => selectAnswer(index + 1, btn);
        optionsDiv.appendChild(btn);
    });
}

async function selectAnswer(selected, selectedBtn) {
    const q = questions[currentQuestion];
    const options = document.querySelectorAll('.option');

    userAnswers[currentQuestion] = {
        question: q.question,
        userAnswer: selected,
        correctAnswer: q.correct_answer,
        options: [q.option1, q.option2, q.option3, q.option4]
    };

    try {
        await fetch('/api/save-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                quizId: quizId,
                questionId: q.id,
                userAnswer: selected,
                correctAnswer: q.correct_answer
            })
        });
    } catch (err) {
        console.error('Error saving answer:', err);
    }

    options.forEach(btn => btn.onclick = null);
    options.forEach((btn, index) => {
        if (index + 1 === q.correct_answer) {
            btn.classList.add('correct');
        } else if (index + 1 === selected) {
            btn.classList.add('incorrect');
        }
    });

    if (selected === q.correct_answer) {
        score++;
    }
}

function showReportModal() {
    document.getElementById('report-modal').style.display = 'flex';
    document.getElementById('report-comment').value = '';
}

async function reportQuestion() {
    const questionId = document.getElementById('report-btn').dataset.questionId;
    const comment = document.getElementById('report-comment').value;

    if (!comment.trim()) {
        alert('Please provide a comment explaining the issue.');
        return;
    }

    try {
        const response = await fetch('/api/report-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId, userId, comment })
        });
        const result = await response.json();
        console.log('Report response:', result);
        if (result.success) {
            alert('Question reported successfully!');
            document.getElementById('report-btn').disabled = true;
            closeModal('report-modal');
        } else {
            alert('Error reporting question: ' + result.error);
        }
    } catch (err) {
        console.error('Error reporting question:', err);
        alert('Error reporting question');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function nextQuestion() {
    currentQuestion++;
    if (currentQuestion < questions.length) {
        showQuestion();
    } else {
        endQuiz();
    }
}

async function endQuiz() {
    clearInterval(timerInterval);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
        await fetch('/api/save-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numQuestions, timeTaken, score })
        });
    } catch (err) {
        console.error('Error saving score:', err);
    }

    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';
    document.getElementById('final-score').textContent = `${username}, your score: ${score}/${numQuestions}`;
}

function showCorrectAnswers() {
    document.getElementById('correct-answers').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'none';

    const answersBody = document.getElementById('answers-body');
    answersBody.innerHTML = userAnswers.map((ans, index) => {
        const userAnsText = ans.userAnswer ? ans.options[ans.userAnswer - 1] : 'Not answered';
        const correctAnsText = ans.options[ans.correctAnswer - 1];
        const isCorrect = ans.userAnswer === ans.correctAnswer;
        return `
            <tr>
                <td>${ans.question}</td>
                <td class="${isCorrect ? '' : 'incorrect'}">${userAnsText}</td>
                <td>${correctAnsText}</td>
            </tr>
        `;
    }).join('');
}

function downloadAnswersPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text('Quiz Answers', 10, 10);
        doc.setFontSize(12);
        doc.text(`Username: ${username}`, 10, 20);
        doc.text(`District: ${district}`, 10, 30);
        doc.text(`Questions: ${numQuestions}`, 10, 40);
        doc.text(`Score: ${score}/${numQuestions}`, 10, 50);

        const tableData = userAnswers.map((ans, index) => [
            ans.question,
            ans.userAnswer ? ans.options[ans.userAnswer - 1] : 'Not answered',
            ans.options[ans.correctAnswer - 1]
        ]);

        doc.autoTable({
            startY: 60,
            head: [['Question', 'Your Answer', 'Correct Answer']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { cellWidth: 40 },
                2: { cellWidth: 40 }
            }
        });

        doc.save(`quiz_answers_${username}.pdf`);
    } catch (err) {
        console.error('Error generating PDF:', err);
        alert('Error generating PDF. Please try again.');
    }
}

async function showLeaderboard() {
    document.getElementById('correct-answers').style.display = 'none';
    document.getElementById('leaderboard').style.display = 'block';

    document.querySelector('#leaderboard h3').textContent = `Leaderboard (${numQuestions} Questions)`;

    try {
        const response = await fetch(`/api/high-scores?num_questions=${numQuestions}`);
        const highScores = await response.json();
        console.log('Leaderboard loaded:', highScores);
        const scoresTable = document.getElementById('high-scores');
        scoresTable.innerHTML = highScores.map(s => `
            <tr>
                <td>${s.username}</td>
                <td>${s.district}</td>
                <td>${s.num_questions}</td>
                <td>${formatTime(s.time_taken)}</td>
                <td>${s.score}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Error loading leaderboard:', err);
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function restartQuiz() {
    currentQuestion = 0;
    score = 0;
    userAnswers = [];
    quizId = 0;
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('num-questions').value = '';
    document.getElementById('correct-answers').style.display = 'none';
    document.getElementById('leaderboard').style.display = 'none';
    await loadStats();
}

async function logoutUser() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const result = await response.json();
        console.log('Logout response:', result);
        if (result.success) {
            userId = null;
            username = '';
            district = '';
            document.getElementById('start-screen').style.display = 'none';
            document.getElementById('auth-screen').style.display = 'block';
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            document.getElementById('login-error').style.display = 'none';
        }
    } catch (err) {
        console.error('Error logging out:', err);
    }
}