import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:3000/users';

const EMPTY_FORM = {
  name: '',
  email: '',
  student_class: '',
  age: '',
  major: '',
};

const NAV_ITEMS = [
  { icon: '♙', label: 'Students' },
];

async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(
      'Cannot connect to the server. Make sure your backend is running on port 3000.'
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}.`
    );
  }

  return data;
}

function App() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('All classes');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest(API_URL);

      if (!Array.isArray(data)) {
        throw new Error('The server returned an invalid student list.');
      }

      setUsers(data);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const classes = useMemo(
    () =>
      [...new Set(users.map(user => user.student_class).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter(user => {
      const searchableFields = [
        user.name,
        user.email,
        user.major,
        user.student_class,
      ];

      const matchesSearch = searchableFields.some(value =>
        String(value ?? '').toLowerCase().includes(query)
      );

      const matchesClass =
        classFilter === 'All classes' ||
        user.student_class === classFilter;

      return matchesSearch && matchesClass;
    });
  }, [users, search, classFilter]);

  const averageAge = users.length
    ? (
        users.reduce((total, user) => total + (Number(user.age) || 0), 0) /
        users.length
      ).toFixed(1)
    : '0.0';

  const uniqueMajors = new Set(
    users.map(user => user.major?.trim()).filter(Boolean)
  ).size;

  const openAddModal = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormError('');
    setModalOpen(true);
  };

  const handleEdit = user => {
    setForm({
      name: user.name ?? '',
      email: user.email ?? '',
      student_class: user.student_class ?? '',
      age: user.age ?? '',
      major: user.major ?? '',
    });

    setEditingId(user.id);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
  };

  const updateField = event => {
    const { name, value } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: value,
    }));

    if (formError) setFormError('');
  };

  const handleSubmit = async event => {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setFormError('');

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      student_class: form.student_class.trim(),
      age: Number(form.age),
      major: form.major.trim(),
    };

    try {
      const isEditing = editingId !== null;
      const url = isEditing
        ? `${API_URL}/${editingId}`
        : API_URL;

      await apiRequest(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setModalOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });

      setNotice(
        isEditing
          ? 'Student updated successfully.'
          : 'Student added successfully.'
      );

      await fetchUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async user => {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.name}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(user.id);
    setError('');

    try {
      await apiRequest(`${API_URL}/${user.id}`, {
        method: 'DELETE',
      });

      setUsers(previous =>
        previous.filter(student => student.id !== user.id)
      );

      setNotice('Student deleted successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const getInitials = name =>
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();

  const avatarColors = ['blue', 'purple', 'orange', 'green', 'pink'];

  const getAvatarColor = id =>
    avatarColors[Math.abs(Number(id) || 0) % avatarColors.length];

  const handleNavigation = label => {
    if (label === 'Students') {
      document.getElementById('students')?.scrollIntoView({
        behavior: 'smooth',
      });
  };}

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard">
          <span className="brand-mark">S</span>
          <span>
            <strong>scholar</strong>
            <small>STUDENT PORTAL</small>
          </span>
        </a>

        <div className="nav-caption">WORKSPACE</div>

        <nav className="main-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.label}
              className={`nav-item ${
                item.label === 'Students' ? 'active' : ''
              }`}
              onClick={() => handleNavigation(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.label === 'Students' && (
                <span className="nav-indicator" />
              )}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>Students</strong>
          </div>

        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">YOUR ACADEMIC WORKSPACE</div>
              <h1>Student directory<span>.</span></h1>
              <p>
                Manage student records, track classes, and keep everything
                organized.
              </p>
            </div>

            <button className="primary-button" onClick={openAddModal}>
              <span className="button-plus">＋</span>
              Add student
            </button>
          </section>

          {error && (
            <div className="alert alert-error" role="alert">
              <span>!</span>
              <div>{error}</div>
              <button onClick={fetchUsers}>Retry ↻</button>
            </div>
          )}

          {notice && (
            <div className="toast" role="status">
              <span>✓</span>
              {notice}
              <button
                onClick={() => setNotice('')}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-top">
                <span>Total students</span>
                <span className="stat-icon icon-blue">♙</span>
              </div>
              <div className="stat-value">
                {loading ? '—' : users.length}
              </div>
              <div className="stat-footer">All registered students</div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Active classes</span>
                <span className="stat-icon icon-purple">▤</span>
              </div>
              <div className="stat-value">
                {loading ? '—' : classes.length}
              </div>
              <div className="stat-footer">
                Unique classes represented
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Study majors</span>
                <span className="stat-icon icon-orange">◈</span>
              </div>
              <div className="stat-value">
                {loading ? '—' : uniqueMajors}
              </div>
              <div className="stat-footer">
                Fields of study represented
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Average age</span>
                <span className="stat-icon icon-green">⌁</span>
              </div>
              <div className="stat-value">
                {loading ? '—' : averageAge}
                <span className="stat-unit"> yrs</span>
              </div>
              <div className="stat-footer">
                Across all registered students
              </div>
            </article>
          </section>

          <section className="directory-panel" id="students">
            <div className="panel-heading">
              <div>
                <div className="panel-title-row">
                  <h2>All students</h2>
                  <span className="count-badge">
                    {loading ? '—' : filteredUsers.length}
                  </span>
                </div>
                <p>View and manage your registered student profiles.</p>
              </div>

              <button
                className="secondary-button"
                onClick={fetchUsers}
                disabled={loading}
              >
                <span className="refresh-icon">↻</span>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="table-toolbar">
              <div className="search-box">
                <span className="search-icon">⌕</span>
                <input
                  type="search"
                  placeholder="Search name, email, major..."
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  aria-label="Search students"
                />
                {search && (
                  <button
                    className="clear-search"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <label className="filter-select">
                <span>Class:</span>
                <select
                  value={classFilter}
                  onChange={event => setClassFilter(event.target.value)}
                >
                  <option>All classes</option>
                  {classes.map(studentClass => (
                    <option key={studentClass} value={studentClass}>
                      {studentClass}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="table-scroll">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>CLASS / GRADE</th>
                    <th>MAJOR</th>
                    <th>AGE</th>
                    <th>STATUS</th>
                    <th className="actions-heading">ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="empty-cell">
                        <div className="loading-spinner" />
                        Loading student records...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-cell">
                        <div className="empty-icon">♙</div>
                        <strong>
                          {users.length
                            ? 'No matching students'
                            : 'Your directory is empty'}
                        </strong>
                        <p>
                          {users.length
                            ? 'Try changing your search or class filter.'
                            : 'Add your first student to get started.'}
                        </p>
                        {users.length === 0 && !error && (
                          <button
                            className="primary-button small-button"
                            onClick={openAddModal}
                          >
                            ＋ Add first student
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="student-identity">
                            <div
                              className={`student-avatar ${getAvatarColor(
                                user.id
                              )}`}
                            >
                              {getInitials(user.name)}
                            </div>
                            <div className="student-details">
                              <strong>{user.name}</strong>
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="class-label">
                            {user.student_class || 'Unassigned'}
                          </span>
                        </td>

                        <td>
                          <span className="major-label">
                            {user.major || '—'}
                          </span>
                        </td>

                        <td className="age-cell">
                          {user.age ? `${user.age} yrs` : '—'}
                        </td>

                        <td>
                          <span className="status-pill">
                            <span />
                            Registered
                          </span>
                        </td>

                        <td>
                          <div className="row-actions">
                            <button
                              className="action-button edit-action"
                              onClick={() => handleEdit(user)}
                              aria-label={`Edit ${user.name}`}
                              title="Edit student"
                            >
                              ✎
                            </button>

                            <button
                              className="action-button delete-action"
                              onClick={() => handleDelete(user)}
                              disabled={deletingId !== null}
                              aria-label={`Delete ${user.name}`}
                              title={
                                deletingId === user.id
                                  ? 'Deleting...'
                                  : 'Delete student'
                              }
                            >
                              {deletingId === user.id ? '…' : '♲'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <footer className="table-footer">
              <span>
                Showing <strong>{loading ? 0 : filteredUsers.length}</strong>{' '}
                of <strong>{loading ? 0 : users.length}</strong> students
              </span>
              <span className="footer-note">
                <span className={`status-dot ${error ? 'offline-dot' : ''}`} />
                {error ? 'Database connection issue' : 'Data from your student database'}
              </span>
            </footer>
          </section>

          <footer className="page-footer">
            <span>© {new Date().getFullYear()} Scholar Portal</span>
            <span>Student management made simple.</span>
          </footer>
        </div>
      </main>

      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="student-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div>
                <div className="modal-icon">♙</div>
                <h2 id="modal-title">
                  {editingId !== null ? 'Edit student' : 'Add a new student'}
                </h2>
                <p>
                  {editingId !== null
                    ? 'Update this student’s information below.'
                    : 'Fill in the details to create a student profile.'}
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="field-group">
                  <span>Full name <b>*</b></span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    placeholder="e.g. Sarah Johnson"
                    maxLength={100}
                    autoComplete="name"
                    required
                    autoFocus
                  />
                </label>

                <label className="field-group">
                  <span>Email address <b>*</b></span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder="sarah@example.com"
                    maxLength={100}
                    autoComplete="email"
                    required
                  />
                </label>

                <label className="field-group">
                  <span>Class / grade <b>*</b></span>
                  <input
                    name="student_class"
                    value={form.student_class}
                    onChange={updateField}
                    placeholder="e.g. Grade 11"
                    maxLength={50}
                    required
                  />
                </label>

                <label className="field-group">
                  <span>Age <b>*</b></span>
                  <input
                    name="age"
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    value={form.age}
                    onChange={updateField}
                    placeholder="e.g. 18"
                    required
                  />
                </label>

                <label className="field-group field-full">
                  <span>Major / field of study <b>*</b></span>
                  <input
                    name="major"
                    value={form.major}
                    onChange={updateField}
                    placeholder="e.g. Computer Science"
                    maxLength={100}
                    required
                  />
                </label>
              </div>

              {formError && (
                <div className="form-error" role="alert">
                  <span>!</span>
                  <div>{formError}</div>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingId !== null
                      ? 'Save changes'
                      : 'Create student'}
                  {!saving && <span>↗</span>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;