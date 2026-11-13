/**
 * app.js
 * Application bootstrap and view coordinator.
 * Connects StorageService with Dashboard, Transactions, Analytics, and Budget modules.
 */

import { StorageService } from './storage.js';
import {
  createTransactionModalController,
  exportTransactionsToCSV,
  getCurrentMonthKey,
  getTodayDateString,
  renderTransactionsView,
} from './transactions.js';
import { renderDashboardView } from './dashboard.js';
import { renderAnalyticsView } from './analytics.js';
import { bindBudgetEvents, renderBudgetView } from './budget.js';

const VIEW_LABELS = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget',
};

const appState = {
  activeView: 'dashboard',
  selectedMonth: getCurrentMonthKey(),
  analyticsTimeframe: '6m',
  txFilters: {
    search: '',
    type: 'all',
    category: 'all',
    sort: 'date-desc',
  },
};

function refreshIcons() {
  if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, variant = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'error' ? 'is-error' : ''}`;
  toast.innerHTML = `
    <i data-lucide="${variant === 'error' ? 'alert-circle' : 'check'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function createConfirmModalController() {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const messageEl = document.getElementById('confirm-modal-message');
  const acceptBtn = document.getElementById('btn-accept-confirm');
  let pendingAction = null;

  function close() {
    modal.hidden = true;
    pendingAction = null;
  }

  function open({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm }) {
    titleEl.textContent = title;
    messageEl.textContent = message;
    acceptBtn.textContent = confirmLabel;
    acceptBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    pendingAction = onConfirm;
    modal.hidden = false;
    acceptBtn.focus();
  }

  document.getElementById('btn-close-confirm-modal')?.addEventListener('click', close);
  document.getElementById('btn-cancel-confirm')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  acceptBtn.addEventListener('click', () => {
    const fn = pendingAction;
    close();
    if (typeof fn === 'function') fn();
  });

  return { open, close };
}

function initApp() {
  StorageService.init();

  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const monthPicker = document.getElementById('global-month-picker');
  const topbarTitle = document.getElementById('topbar-view-title');

  if (monthPicker) {
    monthPicker.value = appState.selectedMonth;
  }

  function closeMobileSidebar() {
    sidebar?.classList.remove('is-open');
    if (sidebarBackdrop) sidebarBackdrop.hidden = true;
  }

  function openMobileSidebar() {
    sidebar?.classList.add('is-open');
    if (sidebarBackdrop) sidebarBackdrop.hidden = false;
  }

  const confirmModal = createConfirmModalController();

  const txModal = createTransactionModalController({
    onSave: (existingId, payload) => {
      if (existingId) {
        StorageService.updateTransaction(existingId, payload);
        showToast('Transaction updated');
      } else {
        StorageService.addTransaction(payload);
        showToast('Transaction added');
      }
      renderActiveView();
    },
  });

  function switchView(viewName) {
    if (!VIEW_LABELS[viewName]) return;
    appState.activeView = viewName;

    document.querySelectorAll('.view-section').forEach((section) => {
      const isTarget = section.id === `view-${viewName}`;
      section.hidden = !isTarget;
      section.classList.toggle('is-active', isTarget);
    });

    document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.view === viewName);
    });

    if (topbarTitle) {
      topbarTitle.textContent = VIEW_LABELS[viewName];
    }

    closeMobileSidebar();
    renderActiveView();
  }

  function openAddTransactionForSelectedMonth() {
    const today = getTodayDateString();
    const defaultDate = today.startsWith(appState.selectedMonth)
      ? today
      : `${appState.selectedMonth}-01`;
    txModal.openAdd(defaultDate);
  }

  function handleEditTransaction(id) {
    const transactions = StorageService.getTransactions();
    const target = transactions.find((tx) => tx.id === id);
    if (target) txModal.openEdit(target);
  }

  function handleDeleteTransaction(id) {
    const transactions = StorageService.getTransactions();
    const target = transactions.find((tx) => tx.id === id);
    if (!target) return;

    confirmModal.open({
      title: 'Delete Transaction',
      message: `Are you sure you want to delete "${target.title}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        StorageService.deleteTransaction(id);
        showToast('Transaction deleted');
        renderActiveView();
      },
    });
  }

  function resetTransactionFilters() {
    appState.txFilters = {
      search: '',
      type: 'all',
      category: 'all',
      sort: 'date-desc',
    };

    const searchInput = document.getElementById('tx-search');
    const catSelect = document.getElementById('tx-filter-category');
    const sortSelect = document.getElementById('tx-sort');

    if (searchInput) searchInput.value = '';
    if (catSelect) catSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'date-desc';

    document.querySelectorAll('[data-type-filter]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.typeFilter === 'all');
    });

    renderActiveView();
  }

  function renderActiveView() {
    const transactions = StorageService.getTransactions();
    const monthlyBudgetLimit = StorageService.getMonthlyBudget(appState.selectedMonth);

    switch (appState.activeView) {
      case 'dashboard':
        renderDashboardView(transactions, appState.selectedMonth, monthlyBudgetLimit, {
          onAddNew: openAddTransactionForSelectedMonth,
          onNavigate: switchView,
        });
        break;
      case 'transactions':
        renderTransactionsView(transactions, appState.txFilters, {
          onEdit: handleEditTransaction,
          onDelete: handleDeleteTransaction,
          onAddNew: openAddTransactionForSelectedMonth,
          onResetFilters: resetTransactionFilters,
        });
        break;
      case 'analytics':
        renderAnalyticsView(
          transactions,
          appState.analyticsTimeframe,
          appState.selectedMonth
        );
        break;
      case 'budget':
        renderBudgetView(transactions, appState.selectedMonth, monthlyBudgetLimit);
        break;
    }

    refreshIcons();
  }

  // Navigation Events
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(el.dataset.nav);
    });
  });

  // Mobile Drawer Events
  document.getElementById('btn-mobile-menu')?.addEventListener('click', openMobileSidebar);
  document.getElementById('btn-close-sidebar')?.addEventListener('click', closeMobileSidebar);
  sidebarBackdrop?.addEventListener('click', closeMobileSidebar);

  // Topbar Global Controls
  monthPicker?.addEventListener('change', (e) => {
    if (e.target.value) {
      appState.selectedMonth = e.target.value;
      renderActiveView();
    }
  });

  document
    .getElementById('btn-open-add-modal')
    ?.addEventListener('click', openAddTransactionForSelectedMonth);

  // Transaction History Filters
  document.getElementById('tx-search')?.addEventListener('input', (e) => {
    appState.txFilters.search = e.target.value;
    renderActiveView();
  });

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.txFilters.type = btn.dataset.typeFilter;
      document.querySelectorAll('[data-type-filter]').forEach((item) => {
        item.classList.toggle('is-active', item === btn);
      });
      renderActiveView();
    });
  });

  document.getElementById('tx-filter-category')?.addEventListener('change', (e) => {
    appState.txFilters.category = e.target.value;
    renderActiveView();
  });

  document.getElementById('tx-sort')?.addEventListener('change', (e) => {
    appState.txFilters.sort = e.target.value;
    renderActiveView();
  });

  document
    .getElementById('tx-clear-filters')
    ?.addEventListener('click', resetTransactionFilters);

  // Analytics Timeframe Controls
  document.querySelectorAll('#analytics-timeframe-group [data-timeframe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.analyticsTimeframe = btn.dataset.timeframe;
      document
        .querySelectorAll('#analytics-timeframe-group [data-timeframe]')
        .forEach((item) => item.classList.toggle('is-active', item === btn));
      renderActiveView();
    });
  });

  // Budget Events
  bindBudgetEvents({
    onSaveBudget: (amount) => {
      StorageService.setMonthlyBudget(appState.selectedMonth, amount);
      showToast('Monthly budget updated');
      renderActiveView();
    },
  });

  // Data Tools (Export CSV, Load Sample Data, Clear All Data)
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const transactions = StorageService.getTransactions();
    if (transactions.length === 0) {
      showToast('No transactions to export', 'error');
      return;
    }
    exportTransactionsToCSV(transactions);
    showToast('CSV exported');
  });

  document.getElementById('btn-reset-demo')?.addEventListener('click', () => {
    confirmModal.open({
      title: 'Load Sample Data',
      message:
        'This will replace your current transactions and budget with the sample dataset. Continue?',
      confirmLabel: 'Load Sample Data',
      danger: false,
      onConfirm: () => {
        StorageService.resetDemoData();
        showToast('Sample data loaded');
        renderActiveView();
      },
    });
  });

  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    confirmModal.open({
      title: 'Clear All Data',
      message:
        'This will permanently delete all transactions and budget settings from LocalStorage.',
      confirmLabel: 'Clear Everything',
      danger: true,
      onConfirm: () => {
        StorageService.clearAllData();
        showToast('All data cleared');
        renderActiveView();
      },
    });
  });

  // Keyboard Escape handler for modals & drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      txModal.close();
      confirmModal.close();
      closeMobileSidebar();
    }
  });

  // Initial Render
  renderActiveView();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
