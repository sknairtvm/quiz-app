const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static('.'));

// Session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Database connection
const db = new sqlite3.Database('quiz.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                district TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY,
                question TEXT NOT NULL,
                option1 TEXT NOT NULL,
                option2 TEXT NOT NULL,
                option3 TEXT NOT NULL,
                option4 TEXT NOT NULL,
                correct_answer INTEGER NOT NULL
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS high_scores (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                num_questions INTEGER NOT NULL,
                time_taken INTEGER NOT NULL,
                score INTEGER NOT NULL,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS user_answers (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                quiz_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                user_answer INTEGER NOT NULL,
                correct_answer INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS reported_questions (
                id INTEGER PRIMARY KEY,
                question_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                comment TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (question_id) REFERENCES questions(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        db.get('SELECT COUNT(*) as count FROM questions', (err, row) => {
            if (err) {
                console.error('Error checking questions:', err.message);
                return;
            }
            if (row.count === 0) {
                db.run(`
                    INSERT INTO questions (question, option1, option2, option3, option4, correct_answer) VALUES
                    ('What is 2+2?', '3', '4', '5', '6', 2),
                    ('Which planet is closest to the Sun?', 'Venus', 'Earth', 'Mercury', 'Mars', 3),
                    ('What is the capital of France?', 'London', 'Berlin', 'Paris', 'Rome', 3),
                    ('What is the capital of Kerala?', 'Kochi', 'Thrissur', 'Thiruvananthapuram', 'Kozhikode', 3),
                    ('Which is the largest district in Kerala by area?', 'Palakkad', 'Idukki', 'Malappuram', 'Ernakulam', 2)
                `);
            }
        });

        const initializeAdmin = async () => {
            try {
                const adminExists = await new Promise((resolve, reject) => {
                    db.get('SELECT COUNT(*) as count FROM users WHERE username = ?', ['admin'], (err, row) => {
                        if (err) reject(err);
                        resolve(row.count > 0);
                    });
                });

                if (!adminExists) {
                    const hashedPassword = await bcrypt.hash('password123', 10);
                    db.run(
                        'INSERT INTO users (username, password, district, is_admin) VALUES (?, ?, ?, ?)',
                        ['admin', hashedPassword, 'AdminDistrict', 1],
                        (err) => {
                            if (err) {
                                console.error('Error creating admin user:', err.message);
                            } else {
                                console.log('Admin user created successfully.');
                            }
                        }
                    );
                } else {
                    console.log('Admin user already exists.');
                }
            } catch (err) {
                console.error('Error initializing admin user:', err);
            }
        };

        initializeAdmin();
    }
});

// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password, district } = req.body;
    console.log('Register request:', { username, district });

    if (!username || !password || !district) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            'INSERT INTO users (username, password, district) VALUES (?, ?, ?)',
            [username, hashedPassword, district],
            function(err) {
                if (err) {
                    console.error('Registration error:', err.message);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ success: false, error: 'Username already exists!' });
                    }
                    return res.status(500).json({ success: false, error: 'Database error: ' + err.message });
                }
                console.log('User registered:', username);
                res.json({ success: true });
            }
        );
    } catch (err) {
        console.error('Hashing error:', err);
        res.status(500).json({ success: false, error: 'Error hashing password' });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login request:', { username });

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error('Login database error:', err.message);
            return res.status(500).json({ success: false, error: 'Database error: ' + err.message });
        }
        if (!user) {
            console.log('User not found:', username);
            return res.status(400).json({ success: false, error: 'Invalid username or password' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                console.log('Password mismatch for user:', username);
                return res.status(400).json({ success: false, error: 'Invalid username or password' });
            }

            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.district = user.district;
            console.log('User logged in:', username, 'Session:', req.session);
            res.json({ success: true, userId: user.id, username: user.username, district: user.district });
        } catch (err) {
            console.error('Password comparison error:', err);
            res.status(500).json({ success: false, error: 'Error verifying password' });
        }
    });
});

// User Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false, error: 'Error logging out' });
        }
        console.log('User logged out');
        res.json({ success: true });
    });
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Admin login request:', { username });

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ? AND is_admin = 1', [username], async (err, user) => {
        if (err) {
            console.error('Admin login database error:', err.message);
            return res.status(500).json({ success: false, error: 'Database error: ' + err.message });
        }
        if (!user) {
            console.log('Admin user not found or not an admin:', username);
            return res.status(400).json({ success: false, error: 'Invalid admin credentials' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.adminId = user.id;
                console.log('Admin logged in:', username);
                res.json({ success: true });
            } else {
                console.log('Admin password mismatch:', username);
                return res.status(400).json({ success: false, error: 'Invalid admin credentials' });
            }
        } catch (err) {
            console.error('Admin password comparison error:', err);
            res.status(500).json({ success: false, error: 'Error verifying password' });
        }
    });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Admin logout error:', err);
            return res.status(500).json({ success: false, error: 'Error logging out' });
        }
        console.log('Admin logged out');
        res.json({ success: true });
    });
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

// Add question
app.post('/api/admin/add-question', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { question, option1, option2, option3, option4, correctAnswer } = req.body;
    if (!question || !option1 || !option2 || !option3 || !option4 || !correctAnswer || correctAnswer < 1 || correctAnswer > 4) {
        return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    db.run(
        'INSERT INTO questions (question, option1, option2, option3, option4, correct_answer) VALUES (?, ?, ?, ?, ?, ?)',
        [question, option1, option2, option3, option4, correctAnswer],
        (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        }
    );
});

// Get all questions with pagination
app.get('/api/admin/questions', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as total FROM questions', (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });
        const total = countRow.total;

        db.all('SELECT * FROM questions LIMIT ? OFFSET ?', [limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ questions: rows, total });
        });
    });
});

// Get single question
app.get('/api/admin/questions/:id', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.get('SELECT * FROM questions WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Question not found' });
        res.json(row);
    });
});

// Update question
app.put('/api/admin/questions/:id', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { question, option1, option2, option3, option4, correctAnswer } = req.body;
    if (!question || !option1 || !option2 || !option3 || !option4 || !correctAnswer || correctAnswer < 1 || correctAnswer > 4) {
        return res.status(400).json({ success: false, error: 'Invalid input' });
    }
    db.run(
        'UPDATE questions SET question = ?, option1 = ?, option2 = ?, option3 = ?, option4 = ?, correct_answer = ? WHERE id = ?',
        [question, option1, option2, option3, option4, correctAnswer, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        }
    );
});

// Delete question
app.delete('/api/admin/questions/:id', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    db.run('DELETE FROM questions WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// Bulk delete questions
app.post('/api/admin/delete-questions', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'No questions selected' });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM questions WHERE id IN (${placeholders})`, ids, (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// Report question with comment
app.post('/api/report-question', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { questionId, userId, comment } = req.body;
    if (!questionId || !userId || !comment) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    db.run(
        'INSERT INTO reported_questions (question_id, user_id, comment) VALUES (?, ?, ?)',
        [questionId, userId, comment],
        (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        }
    );
});

// Get reported questions with pagination
app.get('/api/admin/reported-questions', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as total FROM reported_questions', (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });
        const total = countRow.total;

        db.all(`
            SELECT r.*, q.question, u.username 
            FROM reported_questions r 
            JOIN questions q ON r.question_id = q.id 
            JOIN users u ON r.user_id = u.id 
            LIMIT ? OFFSET ?
        `, [limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ reports: rows, total });
        });
    });
});

// Clear reported questions
app.post('/api/admin/clear-reported', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    db.run('DELETE FROM reported_questions', (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// Get all users with pagination
app.get('/api/admin/users', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as total FROM high_scores', (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });
        const total = countRow.total;

        db.all(`
            SELECT h.*, u.username, u.district 
            FROM high_scores h 
            JOIN users u ON h.user_id = u.id 
            LIMIT ? OFFSET ?
        `, [limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ users: rows, total });
        });
    });
});

// Get single user
app.get('/api/admin/users/:id', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.get(`
        SELECT h.*, u.username, u.district 
        FROM high_scores h 
        JOIN users u ON h.user_id = u.id 
        WHERE h.id = ?
    `, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'User not found' });
        res.json(row);
    });
});

// Update user
app.put('/api/admin/users/:id', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { username, district, numQuestions, timeTaken, score } = req.body;
    if (!username || !district || !numQuestions || !timeTaken || !score) {
        return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    db.get('SELECT user_id FROM high_scores WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!row) return res.status(404).json({ success: false, error: 'High score not found' });
        const userId = row.user_id;

        db.run('UPDATE users SET username = ?, district = ? WHERE id = ?', [username, district, userId], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            db.run(
                'UPDATE high_scores SET num_questions = ?, time_taken = ?, score = ? WHERE id = ?',
                [numQuestions, timeTaken, score, req.params.id],
                (err) => {
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    res.json({ success: true });
                }
            );
        });
    });
});

// Delete user
app.delete('/api/admin/users/:id', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    db.run('DELETE FROM high_scores WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// Bulk delete users
app.post('/api/admin/delete-users', (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'No users selected' });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM high_scores WHERE id IN (${placeholders})`, ids, (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// Upload questions via CSV
app.post('/api/admin/upload-questions', upload.single('questions'), (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(parse({ columns: true, trim: true }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            let count = 0;
            const stmt = db.prepare('INSERT INTO questions (question, option1, option2, option3, option4, correct_answer) VALUES (?, ?, ?, ?, ?, ?)');
            
            results.forEach((row, index) => {
                const { question, option1, option2, option3, option4, correct_answer } = row;
                if (!question || !option1 || !option2 || !option3 || !option4 || !correct_answer || correct_answer < 1 || correct_answer > 4) {
                    console.warn(`Skipping invalid row at line ${index + 1}:`, row);
                    return;
                }
                stmt.run([question, option1, option2, option3, option4, parseInt(correct_answer)], (err) => {
                    if (err) {
                        console.error('Error inserting row:', err.message);
                    } else {
                        count++;
                    }
                });
            });

            stmt.finalize((err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                fs.unlinkSync(req.file.path); // Clean up the uploaded file
                res.json({ success: true, count });
            });
        })
        .on('error', (err) => {
            console.error('Error parsing CSV:', err);
            res.status(500).json({ success: false, error: 'Error parsing CSV file' });
        });
});

// Get questions
app.get('/api/questions', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    db.all('SELECT * FROM questions ORDER BY RANDOM() LIMIT ?', [limit], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Save score
app.post('/api/save-score', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { userId, numQuestions, timeTaken, score } = req.body;
    db.run(
        'INSERT INTO high_scores (user_id, num_questions, time_taken, score) VALUES (?, ?, ?, ?)',
        [userId, numQuestions, timeTaken, score],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Save user answer
app.post('/api/save-answer', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { userId, quizId, questionId, userAnswer, correctAnswer } = req.body;
    db.run(
        'INSERT INTO user_answers (user_id, quiz_id, question_id, user_answer, correct_answer) VALUES (?, ?, ?, ?, ?)',
        [userId, quizId, questionId, userAnswer, correctAnswer],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Get high scores
app.get('/api/high-scores', (req, res) => {
    const numQuestions = parseInt(req.query.num_questions);
    let query = `
        SELECT u.username, u.district, h.num_questions, h.time_taken, h.score 
        FROM high_scores h 
        JOIN users u ON h.user_id = u.id
    `;
    let params = [];

    if (numQuestions) {
        query += ' WHERE h.num_questions = ?';
        params.push(numQuestions);
    }

    query += ' ORDER BY h.score DESC, h.time_taken ASC LIMIT 10';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get site stats
app.get('/api/stats', (req, res) => {
    db.all(`
        SELECT 
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM questions) as total_questions,
            (SELECT COUNT(*) FROM user_answers) as total_answers,
            (SELECT COUNT(*) FROM high_scores) as total_quizzes,
            (SELECT COUNT(*) FROM reported_questions) as total_reported
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows[0]);
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));