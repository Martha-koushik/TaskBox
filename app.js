// In-memory data store (replaces localStorage due to sandboxed environment)
const appState = {
  users: [
    {
      id: 1,
      fullName: 'Demo User',
      email: 'demo@example.com',
      username: 'demouser',
      password: 'password123',
      createdAt: new Date('2025-01-01').toISOString()
    }
  ],
  tasks: [
    {
      id: 1,
      userId: 1,
      title: 'Complete project proposal',
      description: 'Finish the Q4 project proposal document',
      dueDate: '2025-11-05',
      priority: 'high',
      status: 'active',
      createdAt: new Date('2025-10-20').toISOString(),
      updatedAt: new Date('2025-10-20').toISOString()
    },
    {
      id: 2,
      userId: 1,
      title: 'Team meeting',
      description: 'Weekly sync with development team',
      dueDate: '2025-10-30',
      priority: 'medium',
      status: 'active',
      createdAt: new Date('2025-10-22').toISOString(),
      updatedAt: new Date('2025-10-22').toISOString()
    },
    {
      id: 3,
      userId: 1,
      title: 'Code review',
      description: 'Review pull requests from team members',
      dueDate: '2025-10-29',
      priority: 'high',
      status: 'completed',
      createdAt: new Date('2025-10-25').toISOString(),
      updatedAt: new Date('2025-10-27').toISOString()
    }
  ],
  currentUser: null,
  settings: {
    darkMode: false,
    taskReminders: true
  },
  nextUserId: 2,
  nextTaskId: 4
};

// Persistent storage helper (localStorage)
const Storage = {
  key: 'taskflow_taskflow_state_v1',
  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(appState));
    } catch (err) {
      console.warn('Could not save app state', err);
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const keys = ['users','tasks','currentUser','settings','nextUserId','nextTaskId'];
      keys.forEach(k => {
        if (saved[k] !== undefined) appState[k] = saved[k];
      });
    } catch (err) {
      console.warn('Could not load app state', err);
    }
  },
  clear() {
    try { localStorage.removeItem(this.key); } catch (e) {}
  }
};

// Load persisted state (if any)
Storage.load();

// Utility Functions
const Utils = {
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  validatePassword(password) {
    return password.length >= 8 && password.length <= 16;
  },

  getPasswordStrength(password) {
    if (password.length < 8 || password.length > 16) return 'weak';
    if (password.length < 10) return 'medium';
    if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password)) return 'strong';
    return 'medium';
  },

  formatDate(dateString) {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  },

  formatTime(timeString) {
    // timeString expected in "HH:MM" (24-hour) format
    if (!timeString) return '';
    const [hh, mm] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  formatDateTime(dateString, timeString) {
    if (!dateString && !timeString) return 'No due date';
    if (!dateString) return this.formatTime(timeString);
    const datePart = this.formatDate(dateString);
    const timePart = this.formatTime(timeString);
    return timePart ? `${datePart} • ${timePart}` : datePart;
  },

  toYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getInitials(name) {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  },

  debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }
};

// Authentication Manager
const AuthManager = {
  login(emailOrUsername, password) {
    const user = appState.users.find(
      u => (u.email === emailOrUsername || u.username === emailOrUsername) && u.password === password
    );

    if (user) {
      appState.currentUser = { ...user };
      delete appState.currentUser.password;
      Storage.save();
      return { success: true, user: appState.currentUser };
    }

    return { success: false, error: 'Invalid credentials' };
  },

  signup(fullName, email, username, password) {
    // Check if email or username already exists
    if (appState.users.find(u => u.email === email)) {
      return { success: false, error: 'Email already exists' };
    }

    if (appState.users.find(u => u.username === username)) {
      return { success: false, error: 'Username already exists' };
    }

    const newUser = {
      id: appState.nextUserId++,
      fullName,
      email,
      username,
      password,
      createdAt: new Date().toISOString()
    };

    appState.users.push(newUser);
    appState.currentUser = { ...newUser };
    delete appState.currentUser.password;
    Storage.save();
    return { success: true, user: appState.currentUser };
  },

  logout() {
    appState.currentUser = null;
    Storage.save();
    Router.navigate('login');
  },

  isAuthenticated() {
    return appState.currentUser !== null;
  },

  getCurrentUser() {
    return appState.currentUser;
  },

  updateProfile(fullName, email, username) {
    if (!this.isAuthenticated()) return { success: false, error: 'Not authenticated' };

    const userId = appState.currentUser.id;
    const userIndex = appState.users.findIndex(u => u.id === userId);

    if (userIndex === -1) return { success: false, error: 'User not found' };

    // Check if new email/username is taken by another user
    if (email !== appState.currentUser.email && appState.users.find(u => u.email === email && u.id !== userId)) {
      return { success: false, error: 'Email already exists' };
    }

    if (username !== appState.currentUser.username && appState.users.find(u => u.username === username && u.id !== userId)) {
      return { success: false, error: 'Username already exists' };
    }

    appState.users[userIndex].fullName = fullName;
    appState.users[userIndex].email = email;
    appState.users[userIndex].username = username;

    appState.currentUser.fullName = fullName;
    appState.currentUser.email = email;
    appState.currentUser.username = username;

    Storage.save();
    return { success: true, user: appState.currentUser };
  },

  changePassword(currentPassword, newPassword) {
    if (!this.isAuthenticated()) return { success: false, error: 'Not authenticated' };

    const userId = appState.currentUser.id;
    const user = appState.users.find(u => u.id === userId);

    if (!user || user.password !== currentPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    user.password = newPassword;
    Storage.save();
    return { success: true };
  },

  deleteAccount() {
    if (!this.isAuthenticated()) return { success: false, error: 'Not authenticated' };

    const userId = appState.currentUser.id;
    
    // Remove user
    appState.users = appState.users.filter(u => u.id !== userId);
    
    // Remove user's tasks
    appState.tasks = appState.tasks.filter(t => t.userId !== userId);
    
    // Logout
    appState.currentUser = null;
    Storage.save();
    return { success: true };
  }
};

// Task Manager
const TaskManager = {
  getTasks(userId) {
    return appState.tasks.filter(t => t.userId === userId);
  },

  getTaskById(id) {
    return appState.tasks.find(t => t.id === id);
  },

  createTask(userId, title, description, dueDate, dueTime, priority) {
    const newTask = {
      id: appState.nextTaskId++,
      userId,
      title,
      description: description || '',
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      priority: priority || 'medium',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    appState.tasks.push(newTask);
    Storage.save();
    return { success: true, task: newTask };
  },

  updateTask(id, updates) {
    const taskIndex = appState.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return { success: false, error: 'Task not found' };

    appState.tasks[taskIndex] = {
      ...appState.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    Storage.save();
    return { success: true, task: appState.tasks[taskIndex] };
  },

  deleteTask(id) {
    const taskIndex = appState.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return { success: false, error: 'Task not found' };

    appState.tasks.splice(taskIndex, 1);
    Storage.save();
    return { success: true };
  },

  toggleTaskStatus(id) {
    const task = appState.tasks.find(t => t.id === id);
    if (!task) return { success: false, error: 'Task not found' };

    task.status = task.status === 'active' ? 'completed' : 'active';
    task.updatedAt = new Date().toISOString();
    Storage.save();
    return { success: true, task };
  },

  getTaskStats(userId) {
    const userTasks = this.getTasks(userId);
    const total = userTasks.length;
    const completed = userTasks.filter(t => t.status === 'completed').length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, completionRate };
  },

  getTasksByDate(userId, date) {
    return appState.tasks.filter(t => t.userId === userId && t.dueDate === date);
  },

  // Mark tasks as completed if overdue (based on local dueDate + dueTime)
  autoCompleteOverdueTasks() {
    const now = new Date();
    let changed = false;
    appState.tasks.forEach(task => {
      if (task.status === 'active' && task.dueDate) {
        // build local due datetime
        const [y, m, d] = task.dueDate.split('-').map(Number);
        let due = new Date(y, (m || 1) - 1, d || 1);
        if (task.dueTime) {
          const [hh, mm] = task.dueTime.split(':').map(Number);
          due.setHours(hh || 0, mm || 0, 0, 0);
        } else {
          // end of day
          due.setHours(23, 59, 59, 999);
        }

        if (now > due) {
          task.status = 'completed';
          task.updatedAt = new Date().toISOString();
          changed = true;
        }
      }
    });

    if (changed) {
      Storage.save();
      // Optional: update UI if pages are loaded
      if (Router.currentPage === 'dashboard') DashboardPage.renderTasks();
      if (Router.currentPage === 'calendar') CalendarPage.renderCalendar();
      if (AuthManager.isAuthenticated()) Utils.showToast('Overdue tasks marked completed');
    }

    return { success: true };
  },

  clearCompletedTasks(userId) {
    appState.tasks = appState.tasks.filter(t => !(t.userId === userId && t.status === 'completed'));
    Storage.save();
    return { success: true };
  },

  exportTasks(userId) {
    const userTasks = this.getTasks(userId);
    const dataStr = JSON.stringify(userTasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tasks_export.json';
    link.click();
    
    URL.revokeObjectURL(url);
    return { success: true };
  }
};

// Router
const Router = {
  currentPage: null,

  navigate(page, skipAuth = false) {
    // Check authentication
    if (!skipAuth && !AuthManager.isAuthenticated() && page !== 'login' && page !== 'signup') {
      this.navigate('login', true);
      return;
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

    // Show/hide navigation
    const nav = document.getElementById('mainNav');
    if (page === 'login' || page === 'signup') {
      nav.style.display = 'none';
    } else {
      nav.style.display = 'block';
    }

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-page') === page) {
        link.classList.add('active');
      }
    });

    // Show current page
    const pageElement = document.getElementById(`${page}Page`);
    if (pageElement) {
      pageElement.style.display = 'block';
      this.currentPage = page;

      // Load page content
      this.loadPageContent(page);
    }
  },

  loadPageContent(page) {
    switch(page) {
      case 'home':
        HomePage.load();
        break;
      case 'dashboard':
        DashboardPage.load();
        break;
      case 'calendar':
        CalendarPage.load();
        break;
      case 'profile':
        ProfilePage.load();
        break;
      case 'settings':
        SettingsPage.load();
        break;
    }
  }
};

// Home Page
const HomePage = {
  load() {
    const user = AuthManager.getCurrentUser();
    document.getElementById('userName').textContent = user.fullName;

    const stats = TaskManager.getTaskStats(user.id);
    document.getElementById('totalTasks').textContent = stats.total;
    document.getElementById('completedTasks').textContent = stats.completed;
    document.getElementById('pendingTasks').textContent = stats.pending;

    // Load recent tasks
    const tasks = TaskManager.getTasks(user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const recentTasksList = document.getElementById('recentTasksList');
    if (tasks.length === 0) {
      recentTasksList.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); padding: 20px;">No tasks yet. Create your first task!</p>';
    } else {
      recentTasksList.innerHTML = tasks.map(task => `
        <div class="task-item">
          <div class="task-info">
            <div class="task-title ${task.status === 'completed' ? 'completed' : ''}">${task.title}</div>
            <div class="task-meta">
              <span class="task-priority ${task.priority}">${task.priority}</span>
              <span>${Utils.formatDateTime(task.dueDate, task.dueTime)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
};

// Dashboard Page
const DashboardPage = {
  currentFilter: 'all',
  currentSort: 'date',
  searchQuery: '',

  load() {
    this.renderTasks();
  },

  renderTasks() {
    const user = AuthManager.getCurrentUser();
    let tasks = TaskManager.getTasks(user.id);

    // Apply filters
    if (this.currentFilter !== 'all') {
      tasks = tasks.filter(t => t.status === this.currentFilter);
    }

    // Apply search
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      tasks = tasks.filter(t => 
        t.title.toLowerCase().includes(query) || 
        t.description.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch(this.currentSort) {
      case 'date':
        tasks.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
        break;
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        break;
      case 'status':
        tasks.sort((a, b) => a.status.localeCompare(b.status));
        break;
    }

    const tasksList = document.getElementById('tasksList');
    const emptyState = document.getElementById('emptyState');

    if (tasks.length === 0) {
      tasksList.innerHTML = '';
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      tasksList.innerHTML = tasks.map(task => `
        <div class="task-card">
          <div class="task-card-header">
            <div>
              <div class="task-card-title ${task.status === 'completed' ? 'completed' : ''}">${task.title}</div>
              <span class="task-priority ${task.priority}">${task.priority}</span>
            </div>
          </div>
          ${task.description ? `<div class="task-card-description">${task.description}</div>` : ''}
          <div class="task-card-footer">
            <div class="task-meta">
              <span>${Utils.formatDateTime(task.dueDate, task.dueTime)}</span>
            </div>
            <div class="task-actions">
              <button class="icon-btn" onclick="DashboardPage.toggleTask(${task.id})" title="Toggle status">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <button class="icon-btn" onclick="DashboardPage.editTask(${task.id})" title="Edit">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="icon-btn danger" onclick="DashboardPage.deleteTask(${task.id})" title="Delete">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  toggleTask(id) {
    TaskManager.toggleTaskStatus(id);
    this.renderTasks();
    Utils.showToast('Task status updated');
  },

  editTask(id) {
    const task = TaskManager.getTaskById(id);
    if (!task) return;

    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description;
    document.getElementById('taskDueDate').value = task.dueDate || '';
    document.getElementById('taskDueTime').value = task.dueTime || '';
    document.getElementById('taskPriority').value = task.priority;

    document.getElementById('taskModal').classList.add('show');
  },

  deleteTask(id) {
    ModalManager.showConfirm(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      () => {
        TaskManager.deleteTask(id);
        this.renderTasks();
        Utils.showToast('Task deleted');
      }
    );
  },

  openAddTaskModal() {
    document.getElementById('modalTitle').textContent = 'Add New Task';
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    // ensure time field is cleared when opening modal for a new task
    document.getElementById('taskDueTime').value = '';
    document.getElementById('taskModal').classList.add('show');
  }
};

// Calendar Page
const CalendarPage = {
  currentDate: new Date(),
  selectedDate: null,

  load() {
    this.renderCalendar();
    this.selectToday();
  },

  renderCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Update header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const calendarGrid = document.getElementById('calendarGrid');
    let html = '';

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
      html += `<div class="calendar-day header">${day}</div>`;
    });

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
    }

    // Current month days
    const user = AuthManager.getCurrentUser();
    const today = new Date();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = Utils.toYMD(date);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = this.selectedDate && dateString === this.selectedDate;
      const tasks = TaskManager.getTasksByDate(user.id, dateString);

      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';

      // Build tasks HTML
      let tasksHtml = '';
      const maxVisibleTasks = 3;
      const visibleTasks = tasks.slice(0, maxVisibleTasks);
      const remainingTasks = tasks.length - maxVisibleTasks;

      visibleTasks.forEach(task => {
        tasksHtml += `
          <div class="calendar-task-item">
            <span class="calendar-task-dot ${task.priority}"></span>
            <span class="calendar-task-title">${task.title}</span>
          </div>
        `;
      });

      if (remainingTasks > 0) {
        tasksHtml += `<div class="calendar-task-more">+${remainingTasks} more</div>`;
      }

      html += `
        <div class="${classes}" onclick="CalendarPage.selectDate('${dateString}')">
          <span class="calendar-day-number">${day}</span>
          <div class="calendar-day-tasks">${tasksHtml}</div>
        </div>
      `;
    }

    // Next month days
    const remainingDays = 42 - (firstDay + daysInMonth);
    for (let day = 1; day <= remainingDays; day++) {
      html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
    }

    calendarGrid.innerHTML = html;
  },

  selectDate(dateString) {
    this.selectedDate = dateString;
    this.renderCalendar();
    this.renderTasksForDate(dateString);
  },

  selectToday() {
    const today = Utils.toYMD(new Date());
    this.selectDate(today);
  },

  renderTasksForDate(dateString) {
    document.getElementById('selectedDate').textContent = Utils.formatDate(dateString);
    
    const user = AuthManager.getCurrentUser();
    const tasks = TaskManager.getTasksByDate(user.id, dateString);
    
    const tasksList = document.getElementById('calendarTasksList');
    
    if (tasks.length === 0) {
      tasksList.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); padding: 20px;">No tasks for this date</p>';
    } else {
      tasksList.innerHTML = tasks.map(task => `
        <div class="task-item">
          <div class="task-info">
            <div class="task-title ${task.status === 'completed' ? 'completed' : ''}">${task.title}</div>
            <div class="task-meta">
              <span class="task-priority ${task.priority}">${task.priority}</span>
              ${task.description ? `<span>${task.description}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.renderCalendar();
  },

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.renderCalendar();
  }
};

// Profile Page
const ProfilePage = {
  load() {
    const user = AuthManager.getCurrentUser();
    const stats = TaskManager.getTaskStats(user.id);

    document.getElementById('profileName').textContent = user.fullName;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileUsername').textContent = `@${user.username}`;
    document.getElementById('avatarPlaceholder').textContent = Utils.getInitials(user.fullName);

    document.getElementById('profileTotalTasks').textContent = stats.total;
    document.getElementById('profileCompletionRate').textContent = `${stats.completionRate}%`;

    // Populate edit form
    document.getElementById('editFullName').value = user.fullName;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editUsername').value = user.username;
  }
};

// Settings Page
const SettingsPage = {
  load() {
    // Load current settings
    document.getElementById('darkModeToggle').checked = appState.settings.darkMode;
    document.getElementById('taskReminders').checked = appState.settings.taskReminders;

    // Apply dark mode if enabled
    if (appState.settings.darkMode) {
      document.documentElement.setAttribute('data-color-scheme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-color-scheme');
    }
  }
};

// Modal Manager
const ModalManager = {
  showConfirm(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const confirmModal = document.getElementById('confirmModal');
    confirmModal.classList.add('show');

    const confirmBtn = document.getElementById('confirmAction');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
      onConfirm();
      confirmModal.classList.remove('show');
    });
  }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Login Form
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    const result = AuthManager.login(email, password);
    if (result.success) {
      Utils.showToast('Login successful!');
      Router.navigate('home');
    } else {
      errorDiv.textContent = result.error;
    }
  });

  // Signup Form
  document.getElementById('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fullName = document.getElementById('signupFullName').value;
    const email = document.getElementById('signupEmail').value;
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const errorDiv = document.getElementById('signupError');

    // Validation
    if (!Utils.validateEmail(email)) {
      errorDiv.textContent = 'Please enter a valid email';
      return;
    }

    if (!Utils.validatePassword(password)) {
      errorDiv.textContent = 'Password must be 8-16 characters long';
      return;
    }

    if (password !== confirmPassword) {
      errorDiv.textContent = 'Passwords do not match';
      return;
    }

    const result = AuthManager.signup(fullName, email, username, password);
    if (result.success) {
      Utils.showToast('Account created successfully!');
      Router.navigate('home');
    } else {
      errorDiv.textContent = result.error;
    }
  });

  // Password strength indicator
  document.getElementById('signupPassword').addEventListener('input', (e) => {
    const password = e.target.value;
    const strength = Utils.getPasswordStrength(password);
    const bar = document.querySelector('.password-strength-bar');
    bar.className = `password-strength-bar ${strength}`;
  });

  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const page = e.target.getAttribute('data-page');
      if (page) {
        e.preventDefault();
        Router.navigate(page);
      }
    });
  });

  // Mobile menu toggle
  document.getElementById('navToggle').addEventListener('click', () => {
    document.getElementById('navMenu').classList.toggle('active');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    ModalManager.showConfirm(
      'Logout',
      'Are you sure you want to logout?',
      () => {
        AuthManager.logout();
        Utils.showToast('Logged out successfully');
      }
    );
  });

  // Task Modal
  document.getElementById('addTaskBtn').addEventListener('click', () => {
    DashboardPage.openAddTaskModal();
  });

  document.getElementById('quickAddTaskBtn').addEventListener('click', () => {
    DashboardPage.openAddTaskModal();
  });

  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('taskModal').classList.remove('show');
  });

  document.getElementById('cancelTask').addEventListener('click', () => {
    document.getElementById('taskModal').classList.remove('show');
  });

  // Task Form Submit
  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = AuthManager.getCurrentUser();
    const taskId = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const dueTime = document.getElementById('taskDueTime').value;
    const priority = document.getElementById('taskPriority').value;

    if (taskId) {
      // Update existing task (include dueTime)
      TaskManager.updateTask(parseInt(taskId), { title, description, dueDate, dueTime, priority });
      Utils.showToast('Task updated successfully');
    } else {
      // Create new task (include dueTime)
      TaskManager.createTask(user.id, title, description, dueDate, dueTime, priority);
      Utils.showToast('Task created successfully');
    }

    document.getElementById('taskModal').classList.remove('show');
    DashboardPage.renderTasks();
  });

  // Dashboard filters and search
  document.getElementById('searchTasks').addEventListener('input', Utils.debounce((e) => {
    DashboardPage.searchQuery = e.target.value;
    DashboardPage.renderTasks();
  }, 300));

  document.getElementById('filterStatus').addEventListener('change', (e) => {
    DashboardPage.currentFilter = e.target.value;
    DashboardPage.renderTasks();
  });

  document.getElementById('sortTasks').addEventListener('change', (e) => {
    DashboardPage.currentSort = e.target.value;
    DashboardPage.renderTasks();
  });

  // Calendar navigation
  document.getElementById('prevMonth').addEventListener('click', () => {
    CalendarPage.prevMonth();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    CalendarPage.nextMonth();
  });

  // Profile forms
  document.getElementById('editProfileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fullName = document.getElementById('editFullName').value;
    const email = document.getElementById('editEmail').value;
    const username = document.getElementById('editUsername').value;

    const result = AuthManager.updateProfile(fullName, email, username);
    if (result.success) {
      Utils.showToast('Profile updated successfully');
      ProfilePage.load();
    } else {
      Utils.showToast(result.error, 'error');
    }
  });

  document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (!Utils.validatePassword(newPassword)) {
      Utils.showToast('Password must be 8-16 characters long', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Utils.showToast('Passwords do not match', 'error');
      return;
    }

    const result = AuthManager.changePassword(currentPassword, newPassword);
    if (result.success) {
      Utils.showToast('Password changed successfully');
      document.getElementById('changePasswordForm').reset();
    } else {
      Utils.showToast(result.error, 'error');
    }
  });

  // Settings
  document.getElementById('darkModeToggle').addEventListener('change', (e) => {
    appState.settings.darkMode = e.target.checked;
    if (e.target.checked) {
      document.documentElement.setAttribute('data-color-scheme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-color-scheme');
    }
    Storage.save();
    Utils.showToast('Theme updated');
  });


  document.getElementById('taskReminders').addEventListener('change', (e) => {
    appState.settings.taskReminders = e.target.checked;
    Storage.save();
    Utils.showToast('Settings updated');
  });

  document.getElementById('exportTasksBtn').addEventListener('click', () => {
    const user = AuthManager.getCurrentUser();
    TaskManager.exportTasks(user.id);
    Utils.showToast('Tasks exported successfully');
  });

  document.getElementById('clearCompletedBtn').addEventListener('click', () => {
    ModalManager.showConfirm(
      'Clear Completed Tasks',
      'Are you sure you want to delete all completed tasks?',
      () => {
        const user = AuthManager.getCurrentUser();
        TaskManager.clearCompletedTasks(user.id);
        Utils.showToast('Completed tasks cleared');
        DashboardPage.renderTasks();
      }
    );
  });

  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    ModalManager.showConfirm(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      () => {
        const result = AuthManager.deleteAccount();
        if (result.success) {
          Utils.showToast('Account deleted');
          Router.navigate('login', true);
        }
      }
    );
  });

  // Confirm modal
  document.getElementById('closeConfirmModal').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.remove('show');
  });

  document.getElementById('confirmCancel').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.remove('show');
  });

  // Auth page links
  document.querySelectorAll('a[href="#signup"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      Router.navigate('signup', true);
    });
  });

  document.querySelectorAll('a[href="#login"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      Router.navigate('login', true);
    });
  });

  // Initial navigation
  // Run overdue check now and periodically
  TaskManager.autoCompleteOverdueTasks();
  setInterval(() => TaskManager.autoCompleteOverdueTasks(), 60 * 1000);

  // Start on home if there's an authenticated user, otherwise show login
  if (AuthManager.isAuthenticated()) {
    Router.navigate('home');
  } else {
    Router.navigate('login', true);
  }
});