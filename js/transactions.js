/**
 * transactions.js
 * Pure transaction domain logic (validation, filtering, sorting, formatting, CSV export)
 * plus Transaction History view rendering and Add/Edit Transaction modal handling.
 */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Shopping',
  'Entertainment',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Bonus',
  'Gift',
  'Other',
];

export const ALL_CATEGORIES = Array.from(
  new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
).sort();

export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCurrency(amount) {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return 'Selected Month';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function validateTransactionInput(data) {
  const errors = {};
  const title = String(data.title || '').trim();
  const amount = Number(data.amount);
  const category = String(data.category || '').trim();
  const date = String(data.date || '').trim();
  const type = data.type;

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length > 80) {
    errors.title = 'Title must be 80 characters or fewer.';
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a valid amount greater than 0.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount exceeds maximum allowed limit.';
  }

  if (!category) {
    errors.category = 'Select a category.';
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Select a valid date.';
  }

  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Choose income or expense.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function filterTransactions(transactions, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  const type = filters.type || 'all';
  const category = filters.category || 'all';

  return transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;

    if (search) {
      const haystack = `${tx.title} ${tx.category} ${tx.description}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

export function sortTransactions(transactions, sortBy = 'date-desc') {
  const copy = [...transactions];
  copy.sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':
        return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
      case 'amount-desc':
        return b.amount - a.amount || b.date.localeCompare(a.date);
      case 'amount-asc':
        return a.amount - b.amount || b.date.localeCompare(a.date);
      case 'date-desc':
      default:
        return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
    }
  });
  return copy;
}

export function exportTransactionsToCSV(transactions) {
  const headers = ['ID', 'Title', 'Type', 'Category', 'Amount', 'Date', 'Description'];
  const escapeCSV = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const rows = sortTransactions(transactions, 'date-desc').map((tx) =>
    [
      escapeCSV(tx.id),
      escapeCSV(tx.title),
      escapeCSV(tx.type),
      escapeCSV(tx.category),
      tx.amount.toFixed(2),
      escapeCSV(tx.date),
      escapeCSV(tx.description),
    ].join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clearledger-transactions-${getTodayDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function populateCategoryFilterDropdown(selectEl, transactions = []) {
  if (!selectEl) return;
  const currentValue = selectEl.value || 'all';
  const usedCategories = Array.from(
    new Set([...ALL_CATEGORIES, ...transactions.map((t) => t.category)])
  ).sort();

  selectEl.innerHTML = [
    '<option value="all">All Categories</option>',
    ...usedCategories.map(
      (cat) => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`
    ),
  ].join('');

  if (usedCategories.includes(currentValue)) {
    selectEl.value = currentValue;
  } else {
    selectEl.value = 'all';
  }
}

export function renderTransactionsView(transactions, filters, handlers) {
  const container = document.getElementById('transactions-table-container');
  const summaryEl = document.getElementById('tx-filtered-summary');
  const categorySelect = document.getElementById('tx-filter-category');

  populateCategoryFilterDropdown(categorySelect, transactions);

  const filtered = filterTransactions(transactions, filters);
  const sorted = sortTransactions(filtered, filters.sort);

  const totalIncome = filtered
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = filtered
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (summaryEl) {
    summaryEl.innerHTML = `
      <span>Showing <strong class="tabular-nums">${sorted.length}</strong> of <strong class="tabular-nums">${transactions.length}</strong> transactions</span>
      <span class="tabular-nums">
        Income: <strong style="color: var(--income)">${formatCurrency(totalIncome)}</strong>
        &nbsp;·&nbsp;
        Expenses: <strong style="color: var(--text-primary)">${formatCurrency(totalExpense)}</strong>
      </span>
    `;
  }

  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="receipt"></i>
        <h3 class="empty-state-title">No transactions recorded</h3>
        <p class="empty-state-desc">Add your first income or expense entry to start building your financial ledger.</p>
        <button type="button" class="btn btn-primary btn-sm" id="btn-empty-add-tx">
          <i data-lucide="plus"></i>
          <span>Add Transaction</span>
        </button>
      </div>
    `;
    const addBtn = document.getElementById('btn-empty-add-tx');
    if (addBtn && handlers?.onAddNew) {
      addBtn.addEventListener('click', handlers.onAddNew);
    }
    return;
  }

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="search-x"></i>
        <h3 class="empty-state-title">No matching transactions</h3>
        <p class="empty-state-desc">Try adjusting your search query, category filter, or transaction type.</p>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-empty-reset-filters">
          Reset Filters
        </button>
      </div>
    `;
    const resetBtn = document.getElementById('btn-empty-reset-filters');
    if (resetBtn && handlers?.onResetFilters) {
      resetBtn.addEventListener('click', handlers.onResetFilters);
    }
    return;
  }

  const rowsHtml = sorted
    .map((tx) => {
      const sign = tx.type === 'income' ? '+' : '-';
      const amountClass = tx.type === 'income' ? 'is-income' : 'is-expense';
      const typeLabel = tx.type === 'income' ? 'Income' : 'Expense';
      const desc = tx.description ? escapeHTML(tx.description) : '';

      return `
        <tr data-tx-id="${escapeHTML(tx.id)}">
          <td class="tabular-nums tx-meta-inline">${formatDate(tx.date)}</td>
          <td>
            <div class="tx-primary-cell">
              <span class="tx-title-text">${escapeHTML(tx.title)}</span>
              ${desc ? `<span class="tx-desc-text" title="${desc}">${desc}</span>` : ''}
            </div>
          </td>
          <td class="tx-meta-inline">${escapeHTML(tx.category)}</td>
          <td>
            <span class="tx-type-label ${amountClass}">${typeLabel}</span>
          </td>
          <td class="align-right tabular-nums tx-amount ${amountClass}">
            ${sign}${formatCurrency(tx.amount)}
          </td>
          <td class="align-right">
            <div class="row-actions">
              <button
                type="button"
                class="icon-btn"
                data-action="edit"
                data-id="${escapeHTML(tx.id)}"
                aria-label="Edit ${escapeHTML(tx.title)}"
                title="Edit transaction"
              >
                <i data-lucide="pencil"></i>
              </button>
              <button
                type="button"
                class="icon-btn is-danger"
                data-action="delete"
                data-id="${escapeHTML(tx.id)}"
                aria-label="Delete ${escapeHTML(tx.title)}"
                title="Delete transaction"
              >
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th class="align-right">Amount</th>
            <th class="align-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (handlers?.onEdit) handlers.onEdit(btn.dataset.id);
    });
  });

  container.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (handlers?.onDelete) handlers.onDelete(btn.dataset.id);
    });
  });
}

export function createTransactionModalController({ onSave }) {
  const modal = document.getElementById('tx-modal');
  const modalTitle = document.getElementById('tx-modal-title');
  const form = document.getElementById('tx-form');
  const idInput = document.getElementById('tx-id');
  const typeInput = document.getElementById('tx-type');
  const titleInput = document.getElementById('tx-title');
  const amountInput = document.getElementById('tx-amount');
  const categorySelect = document.getElementById('tx-category');
  const dateInput = document.getElementById('tx-date');
  const descInput = document.getElementById('tx-description');
  const submitBtn = document.getElementById('btn-submit-tx');
  const typeButtons = modal.querySelectorAll('[data-form-type]');

  function populateCategoryOptions(type, selectedValue = '') {
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    categorySelect.innerHTML = categories
      .map((cat) => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`)
      .join('');

    if (selectedValue && categories.includes(selectedValue)) {
      categorySelect.value = selectedValue;
    } else if (selectedValue && !categories.includes(selectedValue)) {
      const opt = document.createElement('option');
      opt.value = selectedValue;
      opt.textContent = selectedValue;
      categorySelect.appendChild(opt);
      categorySelect.value = selectedValue;
    }
  }

  function setType(type, preserveCategory = false) {
    const prevCategory = preserveCategory ? categorySelect.value : '';
    typeInput.value = type;
    typeButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.formType === type);
    });
    populateCategoryOptions(type, prevCategory);
  }

  function clearErrors() {
    ['title', 'amount', 'category', 'date'].forEach((field) => {
      const errEl = document.getElementById(`err-tx-${field}`);
      const inputEl = document.getElementById(`tx-${field}`);
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = '';
      }
      if (inputEl) {
        inputEl.classList.remove('has-error');
      }
    });
  }

  function showErrors(errors) {
    Object.entries(errors).forEach(([field, msg]) => {
      const errEl = document.getElementById(`err-tx-${field}`);
      const inputEl = document.getElementById(`tx-${field}`);
      if (errEl) {
        errEl.textContent = msg;
        errEl.hidden = false;
      }
      if (inputEl) {
        inputEl.classList.add('has-error');
      }
    });
  }

  function openAdd(defaultDate = getTodayDateString()) {
    clearErrors();
    form.reset();
    idInput.value = '';
    modalTitle.textContent = 'Add Transaction';
    submitBtn.textContent = 'Save Transaction';
    setType('expense');
    dateInput.value = defaultDate;
    modal.hidden = false;
    titleInput.focus();
  }

  function openEdit(tx) {
    if (!tx) return;
    clearErrors();
    idInput.value = tx.id;
    modalTitle.textContent = 'Edit Transaction';
    submitBtn.textContent = 'Update Transaction';
    setType(tx.type);
    titleInput.value = tx.title;
    amountInput.value = tx.amount;
    populateCategoryOptions(tx.type, tx.category);
    dateInput.value = tx.date;
    descInput.value = tx.description || '';
    modal.hidden = false;
    titleInput.focus();
  }

  function close() {
    modal.hidden = true;
    clearErrors();
  }

  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setType(btn.dataset.formType, false);
    });
  });

  document.getElementById('btn-close-tx-modal')?.addEventListener('click', close);
  document.getElementById('btn-cancel-tx-modal')?.addEventListener('click', close);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();

    const payload = {
      type: typeInput.value,
      title: titleInput.value,
      amount: amountInput.value,
      category: categorySelect.value,
      date: dateInput.value,
      description: descInput.value,
    };

    const validation = validateTransactionInput(payload);
    if (!validation.valid) {
      showErrors(validation.errors);
      return;
    }

    const existingId = idInput.value.trim() || null;
    onSave(existingId, payload);
    close();
  });

  return {
    openAdd,
    openEdit,
    close,
  };
}
