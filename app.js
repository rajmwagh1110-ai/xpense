// ─── Constants ───────────────────────────────────────────────────────────────
const CATEGORIES = {
  food:          { label: 'Food',          icon: '🍜', color: '#4ade80', var: '--food' },
  transport:     { label: 'Transport',     icon: '🚌', color: '#60a5fa', var: '--transport' },
  housing:       { label: 'Housing',       icon: '🏠', color: '#f97316', var: '--housing' },
  entertainment: { label: 'Entertainment', icon: '🎬', color: '#a78bfa', var: '--entertainment' },
  health:        { label: 'Health',        icon: '💊', color: '#f43f5e', var: '--health' },
  shopping:      { label: 'Shopping',      icon: '🛍️', color: '#facc15', var: '--shopping' },
  education:     { label: 'Education',     icon: '📚', color: '#22d3ee', var: '--education' },
  other:         { label: 'Other',         icon: '📦', color: '#94a3b8', var: '--other' }
};

// Smart category keywords for auto-detection
const CATEGORY_KEYWORDS = {
  food: ['swiggy','zomato','restaurant','food','grocery','groceries','cafe','coffee','tea','lunch','dinner','breakfast','snack','dominos','pizza','burger','kfc','mcdonalds','subway','hotel','dhaba','mess','canteen','fruit','vegetable','milk','bread'],
  transport: ['uber','ola','rapido','bus','metro','train','auto','cab','fuel','petrol','diesel','toll','parking','irctc','flight','airline','indigo','air india','spicejet','ticket','commute','transport','bike','cycle'],
  housing: ['rent','electricity','water','gas','maintenance','wifi','internet','broadband','society','flat','pg','hostel','broom','repair','plumber','electrician','airtel','jio','bsnl'],
  entertainment: ['netflix','amazon prime','hotstar','zee5','sonyliv','spotify','gaana','youtube','movie','cinema','pvr','inox','concert','game','steam','playstation','xbox','party','pub','bar','club','bowling','arcade'],
  health: ['pharmacy','medicine','doctor','hospital','clinic','apollo','medplus','1mg','netmedi','gym','yoga','fitness','health','dental','optician','lab','test','scan','consultation','insurance'],
  shopping: ['amazon','flipkart','myntra','ajio','meesho','nykaa','clothes','shoes','shirt','jeans','dress','kurta','saree','watch','accessories','bag','wallet','gift','home decor','furniture','ikea'],
  education: ['course','udemy','coursera','book','stationery','college','school','tuition','coaching','exam','fee','library','pen','notebook','education','study','learning','workshop','seminar'],
};

function getActiveSession() {
  try { return JSON.parse(localStorage.getItem('xpense_session')) || null; } catch { return null; }
}

function getActiveUsername() {
  return getActiveSession()?.username || null;
}

function getNamespacedKey(key) {
  const user = getActiveUsername();
  return user ? `xpense_data_${user}_${key}` : key;
}

function restoreUserData() {
  const user = getActiveUsername();
  if (!user) return;
  const keys = ['expenses', 'budgets', 'goals', 'settings', 'streak', 'categories'];
  keys.forEach((key) => {
    const value = localStorage.getItem(`xpense_data_${user}_${key}`);
    if (value !== null) localStorage.setItem(key, value);
  });
}

function logoutUser() {
  const user = getActiveUsername();
  if (!user) return;
  localStorage.removeItem('xpense_session');
  localStorage.removeItem('xpense_active_user');
  ['expenses', 'budgets', 'goals', 'settings', 'streak', 'categories'].forEach(key => localStorage.removeItem(key));
  location.href = 'login.html';
}

function requireLogin() {
  if (!getActiveUsername()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

restoreUserData();
requireLogin();

// ─── Storage Helpers ──────────────────────────────────────────────────────────
const Storage = {
  get: (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val))
};

// ─── Data Layer ───────────────────────────────────────────────────────────────
const DB = {
  getExpenses: () => Storage.get(getNamespacedKey('expenses'), []),
  saveExpenses: (arr) => {
    Storage.set('expenses', arr);
    const user = getActiveUsername();
    if (user) Storage.set(getNamespacedKey('expenses'), arr);
  },

  getBudgets: () => Storage.get(getNamespacedKey('budgets'), {
    food: 5000, transport: 2000, housing: 15000,
    entertainment: 2000, health: 3000, shopping: 4000,
    education: 5000, other: 2000
  }),
  saveBudgets: (obj) => {
    Storage.set('budgets', obj);
    const user = getActiveUsername();
    if (user) Storage.set(getNamespacedKey('budgets'), obj);
  },

  getCategories: () => Storage.get(getNamespacedKey('categories'), {}),
  saveCategories: (obj) => {
    Storage.set('categories', obj);
    const user = getActiveUsername();
    if (user) Storage.set(getNamespacedKey('categories'), obj);
  },

  getGoals: () => Storage.get(getNamespacedKey('goals'), []),
  saveGoals: (arr) => {
    Storage.set('goals', arr);
    const user = getActiveUsername();
    if (user) Storage.set(getNamespacedKey('goals'), arr);
  },

  getSettings: () => Storage.get(getNamespacedKey('settings'), {
    theme: 'dark',
    currency: 'INR',
    budgetAlerts: true,
    alertThreshold: 80
  }),
  saveSettings: (obj) => {
    Storage.set('settings', obj);
    const user = getActiveUsername();
    if (user) Storage.set(getNamespacedKey('settings'), obj);
  },

  getStreak: () => Storage.get(getNamespacedKey('streak'), { count: 0, lastDate: null }),
  saveStreak: (obj) => {
    Storage.set('streak', obj);
    const user = getActiveUsername();
    if (user) Storage.set(getNamespacedKey('streak'), obj);
  },

  addExpense(exp) {
    const list = this.getExpenses();
    const newExp = { ...exp, id: Date.now().toString(), createdAt: new Date().toISOString() };
    list.push(newExp);
    this.saveExpenses(list);
    checkBudgetAlert(newExp);
    updateStreak();
    return newExp;
  },

  updateExpense(id, updates) {
    const list = this.getExpenses().map(e => e.id === id ? { ...e, ...updates } : e);
    this.saveExpenses(list);
  },

  deleteExpense(id) {
    this.saveExpenses(this.getExpenses().filter(e => e.id !== id));
  }
};

// ─── Utility ──────────────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

function getCurrencySymbol() {
  const settings = DB.getSettings();
  return CURRENCY_SYMBOLS[settings.currency] || '₹';
}

function fmt(amount) {
  const sym = getCurrencySymbol();
  const settings = DB.getSettings();
  if (settings.currency === 'INR') {
    return sym + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  }
  return sym + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function expenseMonth(exp) {
  return exp.date.substring(0, 7);
}

function totalForMonth(month, expenses = DB.getExpenses()) {
  return expenses.filter(e => expenseMonth(e) === month).reduce((s, e) => s + Number(e.amount), 0);
}

function getActiveCategories() {
  return { ...CATEGORIES, ...DB.getCategories() };
}

function getCategoryKeys() {
  return Object.keys(getActiveCategories());
}

function totalByCategory(month, expenses = DB.getExpenses()) {
  const result = {};
  getCategoryKeys().forEach(k => result[k] = 0);
  expenses.filter(e => expenseMonth(e) === month).forEach(e => {
    result[e.category] = (result[e.category] || 0) + Number(e.amount);
  });
  return result;
}

function getMonthlySpending(expenses = DB.getExpenses()) {
  return expenses.reduce((result, e) => {
    const month = expenseMonth(e);
    result[month] = (result[month] || 0) + Number(e.amount);
    return result;
  }, {});
}

function getBestSavingsMonth(expenses = DB.getExpenses()) {
  const budgets = DB.getBudgets();
  const monthly = getMonthlySpending(expenses);
  const result = Object.entries(monthly).map(([month, spent]) => {
    const budget = Object.values(budgets).reduce((sum, val) => sum + Number(val), 0);
    return { month, savings: budget - spent, spent };
  }).sort((a, b) => b.savings - a.savings)[0];
  return result;
}

function getHighestSpendingDay(expenses = DB.getExpenses()) {
  const days = expenses.reduce((result, e) => {
    result[e.date] = (result[e.date] || 0) + Number(e.amount);
    return result;
  }, {});
  const best = Object.entries(days).sort((a, b) => b[1] - a[1])[0];
  return best ? { date: best[0], amount: best[1] } : null;
}

// ─── Smart Category Detection ─────────────────────────────────────────────────
function detectCategory(description) {
  if (!description) return '';
  const lower = description.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'other';
}

// ─── Recurring Expense Detection ─────────────────────────────────────────────
function detectRecurring(expenses = DB.getExpenses()) {
  const recurring = [];
  const grouped = {};
  expenses.forEach(e => {
    const key = (e.description || '').toLowerCase().trim();
    if (!key) return;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });
  for (const [desc, list] of Object.entries(grouped)) {
    if (list.length >= 2) {
      const months = [...new Set(list.map(e => expenseMonth(e)))];
      if (months.length >= 2) {
        const avg = list.reduce((s, e) => s + Number(e.amount), 0) / list.length;
        recurring.push({ description: list[0].description, category: list[0].category, avgAmount: avg, count: list.length, months });
      }
    }
  }
  return recurring.sort((a, b) => b.count - a.count);
}

// ─── Spending Forecast ────────────────────────────────────────────────────────
function forecastMonthEnd() {
  const month = currentMonth();
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const spent = totalForMonth(month);
  if (dayOfMonth === 0) return spent;
  const dailyAvg = spent / dayOfMonth;
  return dailyAvg * daysInMonth;
}

// ─── Spending Insights ────────────────────────────────────────────────────────
function generateInsights() {
  const insights = [];
  const month = currentMonth();
  const prev = prevMonth();
  const expenses = DB.getExpenses();
  const budgets = DB.getBudgets();
  const thisMonth = totalByCategory(month, expenses);
  const lastMonth = totalByCategory(prev, expenses);
  const thisTotal = totalForMonth(month, expenses);
  const lastTotal = totalForMonth(prev, expenses);
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  // Month-on-month change
  if (lastTotal > 0) {
    const pct = ((thisTotal - lastTotal) / lastTotal * 100).toFixed(1);
    if (Math.abs(pct) > 5) {
      insights.push({
        type: pct > 0 ? 'warning' : 'success',
        icon: pct > 0 ? '📈' : '📉',
        text: `Spending is ${Math.abs(pct)}% ${pct > 0 ? 'higher' : 'lower'} than last month`
      });
    }
  }

  // Category spikes
  const categories = getActiveCategories();
  for (const [cat, amt] of Object.entries(thisMonth)) {
    const prevAmt = lastMonth[cat] || 0;
    const label = categories[cat]?.label || cat;
    if (amt > 0 && prevAmt > 0) {
      if (amt / prevAmt >= 1.4) {
        insights.push({
          type: 'warning',
          icon: '⚡',
          text: `${label} spending jumped ${((amt / prevAmt) * 100 - 100).toFixed(0)}% from last month`
        });
      }
      if (amt > prevAmt * 1.5 && amt > 500) {
        insights.push({
          type: 'warning',
          icon: categories[cat]?.icon || '⚡',
          text: `${label} spending up ${((amt - prevAmt) / prevAmt * 100).toFixed(0)}% vs last month`
        });
      }
    }
  }

  // Budget alerts
  for (const [cat, budget] of Object.entries(budgets)) {
    const spent = thisMonth[cat] || 0;
    if (budget > 0 && spent > budget) {
      insights.push({
        type: 'danger',
        icon: '🚨',
        text: `Over budget on ${CATEGORIES[cat].label} by ${fmt(spent - budget)}`
      });
    }
  }

  // Forecast
  const forecast = forecastMonthEnd();
  const totalBudget = Object.values(budgets).reduce((s, v) => s + Number(v), 0);
  if (forecast > totalBudget * 1.1) {
    insights.push({
      type: 'warning',
      icon: '🔮',
      text: `On track to spend ${fmt(forecast)} this month (${fmt(forecast - totalBudget)} over budget)`
    });
  } else if (forecast < totalBudget * 0.7) {
    insights.push({
      type: 'success',
      icon: '🎯',
      text: `Great pace! Projected to stay ${fmt(totalBudget - forecast)} under budget`
    });
  }

  // Daily avg
  if (dayOfMonth > 3) {
    const dailyAvg = thisTotal / dayOfMonth;
    insights.push({
      type: 'info',
      icon: '📅',
      text: `Daily average: ${fmt(dailyAvg)} (${daysInMonth - dayOfMonth} days remaining)`
    });
  }

  // Anomaly detection
  const monthExpenses = expenses.filter(e => expenseMonth(e) === month);
  if (monthExpenses.length > 3) {
    const amounts = monthExpenses.map(e => Number(e.amount));
    const mean = amounts.reduce((a, b) => a + b) / amounts.length;
    const stdDev = Math.sqrt(amounts.map(a => Math.pow(a - mean, 2)).reduce((a, b) => a + b) / amounts.length);
    const anomalies = monthExpenses.filter(e => Number(e.amount) > mean + 2 * stdDev);
    if (anomalies.length > 0) {
      insights.push({
        type: 'warning',
        icon: '⚡',
        text: `${anomalies.length} unusually large expense${anomalies.length > 1 ? 's' : ''} detected this month`
      });
    }
  }

  return insights.slice(0, 5);
}

// ─── Budget Alert ─────────────────────────────────────────────────────────────
function checkBudgetAlert(newExp) {
  const settings = DB.getSettings();
  if (!settings.budgetAlerts) return;
  const budgets = DB.getBudgets();
  const month = currentMonth();
  const catTotals = totalByCategory(month);
  const cat = newExp.category;
  const budget = Number(budgets[cat]) || 0;
  const spent = catTotals[cat] || 0;
  if (budget > 0) {
    const pct = (spent / budget) * 100;
    const threshold = settings.alertThreshold || 80;
    if (pct >= 100) {
      setTimeout(() => showToast(`🚨 Over budget on ${CATEGORIES[cat].label}!`, 'error'), 1000);
    } else if (pct >= threshold) {
      setTimeout(() => showToast(`⚠️ ${CATEGORIES[cat].label} at ${pct.toFixed(0)}% of budget`, 'warning'), 1000);
    }
  }
}

// ─── Streak Tracker ───────────────────────────────────────────────────────────
function updateStreak() {
  const streak = DB.getStreak();
  const today = new Date().toISOString().split('T')[0];
  if (streak.lastDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (streak.lastDate === yesterdayStr) {
    streak.count += 1;
  } else {
    streak.count = 1;
  }
  streak.lastDate = today;
  DB.saveStreak(streak);
}

// ─── Theme ───────────────────────────────────────────────────────────────────
function applyTheme() {
  const settings = DB.getSettings();
  document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
}

function toggleTheme() {
  const settings = DB.getSettings();
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  DB.saveSettings(settings);
  applyTheme();
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = (type === 'success' ? '✓ ' : type === 'warning' ? '⚠ ' : '✕ ') + msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = `toast ${type}`; }, 3000);
}

// ─── Category Badge HTML ──────────────────────────────────────────────────────
function catBadge(cat) {
  const c = getActiveCategories()[cat];
  if (!c) return `<span class="cat-badge" style="background:var(--muted)20;color:var(--muted)">${cat}</span>`;
  return `<span class="cat-badge" style="background:${c.color}20;color:${c.color}">${c.icon} ${c.label}</span>`;
}

// ─── Sidebar active state ─────────────────────────────────────────────────────
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === 'n' || e.key === 'N') { location.href = 'add.html'; }
    if (e.key === 'd' || e.key === 'D') { location.href = 'index.html'; }
    if (e.key === 'e' || e.key === 'E') { location.href = 'expenses.html'; }
    if (e.key === 'b' || e.key === 'B') { location.href = 'budget.html'; }
    if (e.key === 'r' || e.key === 'R') { location.href = 'reports.html'; }
    if (e.key === 't' || e.key === 'T') { toggleTheme(); }
    if (e.key === '?' ) { showKeyboardHelp(); }
  });
}

function renderPageHeaderUser() {
  const header = document.querySelector('.page-header');
  if (!header) return;
  const user = getActiveSession();
  const existing = document.getElementById('pageUserBadge');
  if (existing) return;

  const badge = document.createElement('div');
  badge.id = 'pageUserBadge';
  badge.className = 'page-user-badge';
  badge.innerHTML = `
    <span>Welcome back, ${user?.name || user?.username || 'User'}</span>
    <button class="page-logout-btn" onclick="logoutUser()">Logout</button>
  `;
  header.appendChild(badge);
}

function showKeyboardHelp() {
  const shortcuts = [
    ['N', 'New expense'],['D', 'Dashboard'],['E', 'Expenses'],
    ['B', 'Budget'],['R', 'Reports'],['T', 'Toggle theme'],['?', 'This help']
  ];
  const existing = document.getElementById('kbHelp');
  if (existing) { existing.remove(); return; }
  const div = document.createElement('div');
  div.id = 'kbHelp';
  div.innerHTML = `
    <div style="position:fixed;inset:0;background:#00000080;z-index:9998;display:flex;align-items:center;justify-content:center" onclick="this.parentElement.remove()">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;min-width:320px;z-index:9999">
        <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;margin-bottom:16px">⌨️ Keyboard Shortcuts</div>
        ${shortcuts.map(([k, v]) => `
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
            <span style="color:var(--muted)">${v}</span>
            <kbd style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:2px 8px;font-family:'DM Mono',monospace;font-size:0.72rem">${k}</kbd>
          </div>`).join('')}
        <div style="font-size:0.67rem;color:var(--muted);margin-top:12px;text-align:center">Click anywhere to close</div>
      </div>
    </div>`;
  document.body.appendChild(div);
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportVisible() {
  const expenses = window.getFiltered ? getFiltered() : DB.getExpenses();
  exportCSV(expenses);
}

function exportCSV(expenses) {
  const header = ['Date', 'Category', 'Description', 'Amount', 'Payment', 'Notes'];
  const rows = expenses.map(e => [
    e.date, CATEGORIES[e.category]?.label || e.category,
    e.description || '', e.amount, e.payment || 'cash', e.notes || ''
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'xpense-export.csv' });
  a.click();
  showToast('CSV exported!');
}

// ─── JSON Backup / Restore ────────────────────────────────────────────────────
function exportJSON() {
  const data = {
    expenses: DB.getExpenses(),
    budgets: DB.getBudgets(),
    goals: DB.getGoals(),
    settings: DB.getSettings(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'xpense-backup.json' });
  a.click();
  showToast('Backup exported!');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.expenses) DB.saveExpenses(data.expenses);
      if (data.budgets) DB.saveBudgets(data.budgets);
      if (data.goals) DB.saveGoals(data.goals);
      if (data.settings) DB.saveSettings(data.settings);
      showToast(`Restored ${data.expenses?.length || 0} expenses!`);
      setTimeout(() => location.reload(), 900);
    } catch {
      showToast('Invalid backup file', 'error');
    }
  };
  reader.readAsText(file);
}

function importCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      showToast('CSV file is empty or invalid', 'error');
      return;
    }
    const [header, ...rows] = lines;
    const columns = header.split(',').map(c => c.trim().replace(/^"|"$/g, '').toLowerCase());
    const parsed = rows.map(row => {
      const values = row.match(/(?:\"([^\"]*)\"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      const record = {};
      values.forEach((value, index) => { record[columns[index]] = value; });
      return {
        date: record.date || new Date().toISOString().slice(0, 10),
        category: Object.keys(getActiveCategories()).find(k => getActiveCategories()[k].label.toLowerCase() === (record.category || '').toLowerCase()) || 'other',
        description: record.description || '',
        amount: Number(record.amount) || 0,
        payment: record.payment || 'cash',
        notes: record.notes || ''
      };
    }).filter(r => r.amount > 0);

    if (!parsed.length) {
      showToast('No valid rows found in CSV', 'error');
      return;
    }
    const existing = DB.getExpenses();
    DB.saveExpenses([...existing, ...parsed.map(exp => ({ ...exp, id: Date.now().toString() + Math.random(), createdAt: new Date().toISOString() }))]);
    showToast(`Imported ${parsed.length} expenses`);
    setTimeout(() => location.reload(), 900);
  };
  reader.readAsText(file);
}

// ─── Seed sample data if empty ────────────────────────────────────────────────
function seedIfEmpty() {
  if (DB.getExpenses().length > 0) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const pm = String(now.getMonth()).padStart(2, '0') || '12';
  const py = now.getMonth() === 0 ? y - 1 : y;
  const samples = [
    { amount: 850, category: 'food', description: 'Groceries', date: `${y}-${m}-05`, payment: 'upi' },
    { amount: 1200, category: 'food', description: 'Zomato dinner', date: `${y}-${m}-10`, payment: 'upi' },
    { amount: 450, category: 'transport', description: 'Monthly bus pass', date: `${y}-${m}-01`, payment: 'cash' },
    { amount: 800, category: 'transport', description: 'Uber rides', date: `${y}-${m}-14`, payment: 'upi' },
    { amount: 12000, category: 'housing', description: 'Rent', date: `${y}-${m}-01`, payment: 'netbanking' },
    { amount: 600, category: 'entertainment', description: 'Netflix + Spotify', date: `${y}-${m}-03`, payment: 'card' },
    { amount: 1500, category: 'shopping', description: 'Myntra clothes', date: `${y}-${m}-08`, payment: 'card' },
    { amount: 900, category: 'health', description: 'Pharmacy', date: `${y}-${m}-12`, payment: 'cash' },
    { amount: 2500, category: 'education', description: 'Udemy course', date: `${y}-${m}-15`, payment: 'card' },
    { amount: 300, category: 'other', description: 'Miscellaneous', date: `${y}-${m}-18`, payment: 'cash' },
    { amount: 780, category: 'food', description: 'Groceries', date: `${py}-${pm}-07`, payment: 'upi' },
    { amount: 450, category: 'transport', description: 'Bus pass', date: `${py}-${pm}-01`, payment: 'cash' },
    { amount: 12000, category: 'housing', description: 'Rent', date: `${py}-${pm}-01`, payment: 'netbanking' },
    { amount: 900, category: 'entertainment', description: 'Netflix + Spotify', date: `${py}-${pm}-15`, payment: 'card' },
    { amount: 3200, category: 'shopping', description: 'Myntra clothes', date: `${py}-${pm}-20`, payment: 'card' },
    { amount: 500, category: 'health', description: 'Doctor visit', date: `${py}-${pm}-10`, payment: 'cash' },
  ];
  samples.forEach(s => {
    const list = DB.getExpenses();
    list.push({ ...s, id: Date.now().toString() + Math.random(), createdAt: new Date().toISOString() });
    DB.saveExpenses(list);
  });
}

// ─── Render Sidebar Theme Toggle & Streak ─────────────────────────────────────
function renderSidebarExtras() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const settings = DB.getSettings();
  const streak = DB.getStreak();

  // Remove existing extras
  sidebar.querySelector('.sidebar-extras')?.remove();

  const extras = document.createElement('div');
  extras.className = 'sidebar-extras';
  extras.innerHTML = `
    <div class="sidebar-user-card">
      <div class="sidebar-user-avatar">${(sessionInitials() || 'U').toUpperCase()}</div>
      <div>
        <div class="sidebar-user-name">${getActiveSession()?.name || getActiveUsername() || 'Guest'}</div>
        <div class="sidebar-user-role">Logged in</div>
      </div>
    </div>
    <button class="sidebar-logout-btn" onclick="logoutUser()">Logout</button>
    <div class="sidebar-streak" title="Logging streak">
      🔥 <span>${streak.count}</span> day streak
    </div>
    <button id="themeToggle" class="sidebar-theme-btn" onclick="toggleTheme()" title="Toggle theme (T)">
      ${settings.theme === 'dark' ? '☀️' : '🌙'} ${settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
    <div class="sidebar-shortcut-hint" onclick="showKeyboardHelp()" title="Keyboard shortcuts">⌨️ Shortcuts (?)</div>
  `;
  sidebar.appendChild(extras);
}

function sessionInitials() {
  const name = getActiveSession()?.name || getActiveUsername() || '';
  return name.split(' ').map(part => part[0]).slice(0, 2).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  seedIfEmpty();
  setActiveNav();
  initKeyboardShortcuts();
  renderSidebarExtras();
  renderPageHeaderUser();
});
