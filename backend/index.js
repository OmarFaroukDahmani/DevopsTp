
const express = require('express');
const cors = require('cors');
const { pool, connectToDatabase } = require('./connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Standardized error response
function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message,
  });
}

// Validate student ID
function isValidId(id) {
  return /^\d+$/.test(String(id)) && Number(id) > 0;
}

// Validate and normalize student data
function validateStudent(body) {
  const { name, email, student_class, age, major } = body || {};

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof student_class !== 'string' ||
    typeof major !== 'string' ||
    String(age ?? '').trim() === ''
  ) {
    return { error: 'All student fields are required.' };
  }

  const student = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    student_class: student_class.trim(),
    age: Number(age),
    major: major.trim(),
  };

  if (
    !student.name ||
    !student.email ||
    !student.student_class ||
    !student.major
  ) {
    return { error: 'All student fields must contain valid values.' };
  }

  if (student.name.length > 100) {
    return { error: 'Name must not exceed 100 characters.' };
  }

  if (student.email.length > 100) {
    return { error: 'Email must not exceed 100 characters.' };
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)
  ) {
    return { error: 'Please provide a valid email address.' };
  }

  if (student.student_class.length > 50) {
    return { error: 'Class must not exceed 50 characters.' };
  }

  if (student.major.length > 100) {
    return { error: 'Major must not exceed 100 characters.' };
  }

  if (
    !Number.isInteger(student.age) ||
    student.age < 1 ||
    student.age > 120
  ) {
    return { error: 'Age must be a whole number between 1 and 120.' };
  }

  return { student };
}

// Handle PostgreSQL errors consistently
function handleDatabaseError(res, err) {
  console.error('Database error:', err.message);

  if (err.code === '23505') {
    return sendError(res, 409, 'A student with this email already exists.');
  }

  if (err.code === '23503') {
    return sendError(res, 409, 'This operation conflicts with related records.');
  }

  if (err.code === '23502' || err.code === '22001' || err.code === '22P02') {
    return sendError(res, 400, 'Invalid student data.');
  }

  return sendError(res, 500, 'An unexpected server error occurred.');
}

// Initialize database before accepting requests
async function setupDatabase() {
  await connectToDatabase();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      student_class VARCHAR(50) NOT NULL,
      age INT NOT NULL CHECK (age BETWEEN 1 AND 120),
      major VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Support databases created before the created_at column existed.
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  console.log('Database connected. Student table is ready.');
}

// HEALTH CHECK
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
    });
  } catch (err) {
    console.error('Health check failed:', err.message);

    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
    });
  }
});

// READ ALL STUDENTS
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, student_class, age, major, created_at
      FROM users
      ORDER BY id ASC
    `);

    res.json(result.rows);
  } catch (err) {
    handleDatabaseError(res, err);
  }
});

// READ ONE STUDENT
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, 'Invalid student ID.');
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, student_class, age, major, created_at
       FROM users WHERE id = $1`,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Student not found.');
    }

    res.json(result.rows[0]);
  } catch (err) {
    handleDatabaseError(res, err);
  }
});

// CREATE STUDENT
app.post('/users', async (req, res) => {
  const { student, error } = validateStudent(req.body);

  if (error) {
    return sendError(res, 400, error);
  }

  try {
    const { name, email, student_class, age, major } = student;

    const result = await pool.query(
      `INSERT INTO users (name, email, student_class, age, major)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, student_class, age, major, created_at`,
      [name, email, student_class, age, major]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleDatabaseError(res, err);
  }
});

// UPDATE STUDENT
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, 'Invalid student ID.');
  }

  const { student, error } = validateStudent(req.body);

  if (error) {
    return sendError(res, 400, error);
  }

  try {
    const { name, email, student_class, age, major } = student;

    const result = await pool.query(
      `UPDATE users
       SET name = $1,
           email = $2,
           student_class = $3,
           age = $4,
           major = $5
       WHERE id = $6
       RETURNING id, name, email, student_class, age, major, created_at`,
      [name, email, student_class, age, major, Number(id)]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Student not found.');
    }

    res.json(result.rows[0]);
  } catch (err) {
    handleDatabaseError(res, err);
  }
});

// DELETE STUDENT
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, 'Invalid student ID.');
  }

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Student not found.');
    }

    res.json({
      success: true,
      message: 'Student deleted successfully.',
      id: result.rows[0].id,
    });
  } catch (err) {
    handleDatabaseError(res, err);
  }
});

// Unknown endpoint
app.use((req, res) => {
  sendError(res, 404, 'Endpoint not found.');
});

// Invalid JSON and unexpected middleware errors
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 400, 'Invalid JSON request body.');
  }

  console.error('Server error:', err.message);
  sendError(res, 500, 'An unexpected server error occurred.');
});

// Start only after successful database initialization
async function startServer() {
  try {
    await setupDatabase();

    app.listen(PORT, () => {
      console.log(`Student API running at http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('Failed to initialize the database:', err.message);
    process.exitCode = 1;
  }
}

startServer();
