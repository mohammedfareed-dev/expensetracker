/**
 * storage.js
 * Centralized LocalStorage persistence layer.
 * All data access is isolated here so LocalStorage can be replaced
 * with REST API calls (e.g. fetch('/api/transactions')) in future backend phases
 * without modifying UI components or calculation modules.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
};

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getOffsetMonthKey(monthsBack = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function clampDayForMonth(monthKey, day) {
  const [year, month] = monthKey.split('-').map(Number);
  const maxDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(Math.max(1, day), maxDay);
  return `${monthKey}-${String(safeDay).padStart(2, '0')}`;
}

function buildInitialSeedTransactions() {
  const m0 = getOffsetMonthKey(0);
  const m1 = getOffsetMonthKey(1);
  const m2 = getOffsetMonthKey(2);
  const m3 = getOffsetMonthKey(3);
  const m4 = getOffsetMonthKey(4);
  const m5 = getOffsetMonthKey(5);

  const todayDay = Math.min(new Date().getDate(), 28);

  return [
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: clampDayForMonth(m0, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: clampDayForMonth(m0, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'UI Design Retainer',
      amount: 850,
      category: 'Freelance',
      type: 'income',
      date: clampDayForMonth(m0, Math.min(todayDay, 5)),
      description: 'Client product audit milestone',
    },
    {
      id: generateId(),
      title: 'Whole Foods Market',
      amount: 248.6,
      category: 'Food',
      type: 'expense',
      date: clampDayForMonth(m0, Math.min(todayDay, 7)),
      description: 'Weekly groceries and pantry staples',
    },
    {
      id: generateId(),
      title: 'Electric & Fiber Internet',
      amount: 164.25,
      category: 'Utilities',
      type: 'expense',
      date: clampDayForMonth(m0, Math.min(todayDay, 9)),
      description: 'Monthly municipal power and internet bill',
    },
    {
      id: generateId(),
      title: 'Metro Transit & Fuel',
      amount: 118.4,
      category: 'Transport',
      type: 'expense',
      date: clampDayForMonth(m0, Math.min(todayDay, 10)),
      description: 'Commuter pass and fuel refill',
    },
    {
      id: generateId(),
      title: 'Dental Checkup',
      amount: 145,
      category: 'Healthcare',
      type: 'expense',
      date: clampDayForMonth(m0, Math.min(todayDay, 11)),
      description: 'Routine cleaning co-pay',
    },
    {
      id: generateId(),
      title: 'Grocery Shopping',
      amount: 214.8,
      category: 'Food',
      type: 'expense',
      date: clampDayForMonth(m0, todayDay),
      description: 'Fresh produce and household items',
    },
    // Previous Month (m1)
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: clampDayForMonth(m1, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: clampDayForMonth(m1, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Grocery & Dining',
      amount: 492.3,
      category: 'Food',
      type: 'expense',
      date: clampDayForMonth(m1, 14),
      description: 'Monthly groceries and team lunches',
    },
    {
      id: generateId(),
      title: 'Utilities & Mobile',
      amount: 198.5,
      category: 'Utilities',
      type: 'expense',
      date: clampDayForMonth(m1, 16),
      description: 'Electricity, water, and mobile plan',
    },
    {
      id: generateId(),
      title: 'Autumn Apparel',
      amount: 265,
      category: 'Shopping',
      type: 'expense',
      date: clampDayForMonth(m1, 21),
      description: 'Jacket and running shoes',
    },
    {
      id: generateId(),
      title: 'Quarterly Dividend',
      amount: 310,
      category: 'Investments',
      type: 'income',
      date: clampDayForMonth(m1, 25),
      description: 'Index fund distribution',
    },
    // m2
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: clampDayForMonth(m2, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: clampDayForMonth(m2, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Supermarket Run',
      amount: 435.9,
      category: 'Food',
      type: 'expense',
      date: clampDayForMonth(m2, 12),
      description: 'Groceries and household essentials',
    },
    {
      id: generateId(),
      title: 'Online Course Subscription',
      amount: 180,
      category: 'Education',
      type: 'expense',
      date: clampDayForMonth(m2, 18),
      description: 'Annual technical workshop access',
    },
    {
      id: generateId(),
      title: 'Streaming & Cinema',
      amount: 94.5,
      category: 'Entertainment',
      type: 'expense',
      date: clampDayForMonth(m2, 23),
      description: 'Subscriptions and weekend tickets',
    },
    // m3
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: clampDayForMonth(m3, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Freelance Advisory',
      amount: 640,
      category: 'Freelance',
      type: 'income',
      date: clampDayForMonth(m3, 15),
      description: 'Architecture review session',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: clampDayForMonth(m3, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Market',
      amount: 410.4,
      category: 'Food',
      type: 'expense',
      date: clampDayForMonth(m3, 11),
      description: 'Monthly food expenses',
    },
    {
      id: generateId(),
      title: 'Train & Ride-share',
      amount: 162,
      category: 'Transport',
      type: 'expense',
      date: clampDayForMonth(m3, 20),
      description: 'Regional travel',
    },
    // m4
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: clampDayForMonth(m4, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: clampDayForMonth(m4, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Produce',
      amount: 395,
      category: 'Food',
      type: 'expense',
      date: clampDayForMonth(m4, 13),
      description: 'Weekly food shopping',
    },
    {
      id: generateId(),
      title: 'Utilities Bundle',
      amount: 185,
      category: 'Utilities',
      type: 'expense',
      date: clampDayForMonth(m4, 19),
      description: 'Power, water, and internet',
    },
    // m5
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: clampDayForMonth(m5, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: clampDayForMonth(m5, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Food & Coffee',
      amount: 382.2,
      category: 'Food',
      type: 'expense',
      date: clampDayForMonth(m5, 14),
      description: 'Groceries and cafes',
    },
    {
      id: generateId(),
      title: 'Electronics Accessory',
      amount: 219,
      category: 'Shopping',
      type: 'expense',
      date: clampDayForMonth(m5, 22),
      description: 'USB-C hub and desk stand',
    },
  ];
}

function normalizeTransaction(raw, existingId = null) {
  return {
    id: existingId || raw.id || generateId(),
    title: String(raw.title || '').trim(),
    amount: Math.round(Number(raw.amount) * 100) / 100,
    category: String(raw.category || 'Other').trim(),
    type: raw.type === 'income' ? 'income' : 'expense',
    date: String(raw.date || '').trim(),
    description: String(raw.description || '').trim(),
  };
}

export const StorageService = {
  init() {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      const seed = buildInitialSeedTransactions();
      this.saveTransactions(seed);
      this.saveBudgetConfig({
        defaultLimit: 3200,
        byMonth: {},
      });
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  },

  getTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((item) => normalizeTransaction(item, item.id)) : [];
    } catch (error) {
      console.error('Failed to read transactions from LocalStorage:', error);
      return [];
    }
  },

  saveTransactions(transactions) {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      return true;
    } catch (error) {
      console.error('Failed to save transactions to LocalStorage:', error);
      return false;
    }
  },

  addTransaction(transactionInput) {
    const transactions = this.getTransactions();
    const created = normalizeTransaction(transactionInput, generateId());
    transactions.push(created);
    this.saveTransactions(transactions);
    return created;
  },

  updateTransaction(id, updates) {
    const transactions = this.getTransactions();
    const index = transactions.findIndex((tx) => tx.id === id);
    if (index === -1) return null;

    const updated = normalizeTransaction({ ...transactions[index], ...updates }, id);
    transactions[index] = updated;
    this.saveTransactions(transactions);
    return updated;
  },

  deleteTransaction(id) {
    const transactions = this.getTransactions();
    const next = transactions.filter((tx) => tx.id !== id);
    if (next.length === transactions.length) return false;
    this.saveTransactions(next);
    return true;
  },

  getBudgetConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
      if (!raw) {
        return { defaultLimit: 3200, byMonth: {} };
      }
      const parsed = JSON.parse(raw);
      return {
        defaultLimit: Number(parsed.defaultLimit) > 0 ? Number(parsed.defaultLimit) : 0,
        byMonth: parsed.byMonth && typeof parsed.byMonth === 'object' ? parsed.byMonth : {},
      };
    } catch (error) {
      console.error('Failed to read budget config from LocalStorage:', error);
      return { defaultLimit: 0, byMonth: {} };
    }
  },

  saveBudgetConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Failed to save budget config to LocalStorage:', error);
      return false;
    }
  },

  getMonthlyBudget(monthKey) {
    const config = this.getBudgetConfig();
    if (monthKey && Object.prototype.hasOwnProperty.call(config.byMonth, monthKey)) {
      return Number(config.byMonth[monthKey]) || 0;
    }
    return Number(config.defaultLimit) || 0;
  },

  setMonthlyBudget(monthKey, amount) {
    const config = this.getBudgetConfig();
    const numericAmount = Math.round(Number(amount) * 100) / 100;
    if (monthKey) {
      config.byMonth[monthKey] = numericAmount;
    }
    config.defaultLimit = numericAmount;
    this.saveBudgetConfig(config);
    return numericAmount;
  },

  clearAllData() {
    this.saveTransactions([]);
    this.saveBudgetConfig({ defaultLimit: 0, byMonth: {} });
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  },

  resetDemoData() {
    const seed = buildInitialSeedTransactions();
    this.saveTransactions(seed);
    this.saveBudgetConfig({ defaultLimit: 3200, byMonth: {} });
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  },
};
