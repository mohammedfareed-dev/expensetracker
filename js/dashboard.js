/**
 * dashboard.js
 * Pure dashboard financial calculations and Chart.js visualizations
 * for Balance, Income, Expenses, Monthly Spending, Recent Transactions,
 * Monthly Overview, and Category Breakdown.
 */

import {
  escapeHTML,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  sortTransactions,
} from './transactions.js';
import { calculateBudgetStatus } from './budget.js';

const CHART_PALETTE = [
  '#0f766e',
  '#2563eb',
  '#d97706',
  '#64748b',
  '#0891b2',
  '#16a34a',
  '#dc2626',
  '#475569',
  '#0284c7',
];

let monthlyOverviewChart = null;
let categoryBreakdownChart = null;

export function calculateDashboardMetrics(transactions, selectedMonth) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlySpending = 0;
  let monthlyIncome = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
      if (tx.date.startsWith(selectedMonth)) {
        monthlyIncome += tx.amount;
      }
    } else if (tx.type === 'expense') {
      totalExpenses += tx.amount;
      if (tx.date.startsWith(selectedMonth)) {
        monthlySpending += tx.amount;
      }
    }
  }

  return {
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
    monthlySpending,
    monthlyIncome,
  };
}

export function getRecentTransactions(transactions, limit = 6) {
  return sortTransactions(transactions, 'date-desc').slice(0, limit);
}

export function getMonthlyOverviewSeries(transactions, referenceMonth, monthsCount = 6) {
  const [refYear, refMonth] = referenceMonth.split('-').map(Number);
  const months = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(refYear, refMonth - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: '2-digit',
    }).format(d);
    months.push({ key, label, income: 0, expense: 0 });
  }

  const monthMap = new Map(months.map((m) => [m.key, m]));

  for (const tx of transactions) {
    const key = tx.date.slice(0, 7);
    const bucket = monthMap.get(key);
    if (!bucket) continue;
    if (tx.type === 'income') bucket.income += tx.amount;
    else bucket.expense += tx.amount;
  }

  return {
    labels: months.map((m) => m.label),
    incomeSeries: months.map((m) => Math.round(m.income * 100) / 100),
    expenseSeries: months.map((m) => Math.round(m.expense * 100) / 100),
  };
}

export function getExpenseCategoryBreakdown(transactions, selectedMonth) {
  const map = new Map();
  let total = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (selectedMonth && !tx.date.startsWith(selectedMonth)) continue;
    map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
    total += tx.amount;
  }

  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function renderMonthlyChart(series) {
  const canvas = document.getElementById('chart-dashboard-monthly');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (monthlyOverviewChart) {
    monthlyOverviewChart.destroy();
    monthlyOverviewChart = null;
  }

  monthlyOverviewChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Income',
          data: series.incomeSeries,
          backgroundColor: '#16a34a',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: series.expenseSeries,
          backgroundColor: '#0f172a',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11.5 },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString('en-US')}`,
          },
        },
      },
    },
  });
}

function renderCategoryChartAndLegend(breakdown, selectedMonth) {
  const canvas = document.getElementById('chart-dashboard-categories');
  const legendEl = document.getElementById('dashboard-category-legend');
  const subtitleEl = document.getElementById('dashboard-category-subtitle');

  if (subtitleEl) {
    subtitleEl.textContent = `${formatMonthLabel(selectedMonth)} expenses`;
  }

  if (categoryBreakdownChart) {
    categoryBreakdownChart.destroy();
    categoryBreakdownChart = null;
  }

  if (breakdown.length === 0) {
    if (legendEl) {
      legendEl.innerHTML = `
        <div class="empty-state" style="padding: 18px 8px;">
          <p class="empty-state-desc">No expenses recorded for ${escapeHTML(formatMonthLabel(selectedMonth))}.</p>
        </div>
      `;
    }
    if (canvas && typeof window.Chart !== 'undefined') {
      categoryBreakdownChart = new window.Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['No Expenses'],
          datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        },
      });
    }
    return;
  }

  if (legendEl) {
    legendEl.innerHTML = breakdown
      .slice(0, 6)
      .map((item, idx) => {
        const color = CHART_PALETTE[idx % CHART_PALETTE.length];
        return `
          <div class="legend-row">
            <div class="legend-left">
              <span class="legend-swatch" style="background:${color}"></span>
              <span class="legend-name">${escapeHTML(item.category)}</span>
            </div>
            <div class="legend-right tabular-nums">
              <span>${formatCurrency(item.amount)}</span>
              <span class="legend-pct">${item.percentage.toFixed(0)}%</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  if (canvas && typeof window.Chart !== 'undefined') {
    categoryBreakdownChart = new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: breakdown.map((b) => b.category),
        datasets: [
          {
            data: breakdown.map((b) => b.amount),
            backgroundColor: breakdown.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = breakdown[ctx.dataIndex];
                return `${item.category}: ${formatCurrency(item.amount)} (${item.percentage.toFixed(1)}%)`;
              },
            },
          },
        },
      },
    });
  }
}

function renderRecentTransactionsList(recent, handlers) {
  const container = document.getElementById('dashboard-recent-transactions');
  if (!container) return;

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="wallet"></i>
        <h3 class="empty-state-title">No transactions yet</h3>
        <p class="empty-state-desc">Record an income or expense entry to see recent ledger activity here.</p>
        <button type="button" class="btn btn-primary btn-sm" id="btn-dash-empty-add">
          <i data-lucide="plus"></i>
          <span>Add Transaction</span>
        </button>
      </div>
    `;
    document.getElementById('btn-dash-empty-add')?.addEventListener('click', () => {
      if (handlers?.onAddNew) handlers.onAddNew();
    });
    return;
  }

  const rowsHtml = recent
    .map((tx) => {
      const sign = tx.type === 'income' ? '+' : '-';
      const cls = tx.type === 'income' ? 'is-income' : 'is-expense';
      return `
        <tr>
          <td class="tabular-nums tx-meta-inline">${formatDate(tx.date)}</td>
          <td>
            <div class="tx-primary-cell">
              <span class="tx-title-text">${escapeHTML(tx.title)}</span>
              ${tx.description ? `<span class="tx-desc-text">${escapeHTML(tx.description)}</span>` : ''}
            </div>
          </td>
          <td class="tx-meta-inline">${escapeHTML(tx.category)}</td>
          <td class="align-right tabular-nums tx-amount ${cls}">
            ${sign}${formatCurrency(tx.amount)}
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
            <th class="align-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

export function renderDashboardView(transactions, selectedMonth, monthlyBudgetLimit, handlers) {
  const metrics = calculateDashboardMetrics(transactions, selectedMonth);

  const balanceEl = document.getElementById('kpi-total-balance');
  const incomeEl = document.getElementById('kpi-total-income');
  const expensesEl = document.getElementById('kpi-total-expenses');
  const monthlyEl = document.getElementById('kpi-monthly-spending');
  const monthlyMetaEl = document.getElementById('kpi-monthly-meta');
  const alertSlot = document.getElementById('dashboard-budget-alert');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(metrics.totalBalance);
    balanceEl.classList.toggle('is-expense', metrics.totalBalance < 0);
  }
  if (incomeEl) incomeEl.textContent = formatCurrency(metrics.totalIncome);
  if (expensesEl) expensesEl.textContent = formatCurrency(metrics.totalExpenses);
  if (monthlyEl) monthlyEl.textContent = formatCurrency(metrics.monthlySpending);
  if (monthlyMetaEl) {
    monthlyMetaEl.textContent = `${formatMonthLabel(selectedMonth)} expenses`;
  }

  // Surface concise budget alert on dashboard when >= 80% or exceeded
  if (alertSlot) {
    const budgetStatus = calculateBudgetStatus(transactions, selectedMonth, monthlyBudgetLimit);
    if (budgetStatus.status === 'warning' || budgetStatus.status === 'exceeded') {
      const isExceeded = budgetStatus.status === 'exceeded';
      alertSlot.hidden = false;
      alertSlot.innerHTML = `
        <div class="alert-banner ${isExceeded ? 'is-exceeded' : 'is-warning'}" role="status">
          <div class="alert-banner-content">
            <i data-lucide="${isExceeded ? 'alert-octagon' : 'alert-triangle'}"></i>
            <div>
              <span class="alert-banner-title">${isExceeded ? 'Budget Exceeded:' : 'Budget Warning:'}</span>
              <span>
                ${
                  isExceeded
                    ? `${formatMonthLabel(selectedMonth)} spending (${formatCurrency(budgetStatus.monthlyExpenses)}) has exceeded your ${formatCurrency(budgetStatus.monthlyLimit)} limit by ${formatCurrency(Math.abs(budgetStatus.remaining))}.`
                    : `You have reached ${budgetStatus.utilizationPercent.toFixed(1)}% of your ${formatCurrency(budgetStatus.monthlyLimit)} budget for ${formatMonthLabel(selectedMonth)}.`
                }
              </span>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-xs" id="btn-dash-view-budget">
            Manage Budget
          </button>
        </div>
      `;
      document.getElementById('btn-dash-view-budget')?.addEventListener('click', () => {
        if (handlers?.onNavigate) handlers.onNavigate('budget');
      });
    } else {
      alertSlot.hidden = true;
      alertSlot.innerHTML = '';
    }
  }

  const series = getMonthlyOverviewSeries(transactions, selectedMonth, 6);
  renderMonthlyChart(series);

  const breakdown = getExpenseCategoryBreakdown(transactions, selectedMonth);
  renderCategoryChartAndLegend(breakdown, selectedMonth);

  const recent = getRecentTransactions(transactions, 6);
  renderRecentTransactionsList(recent, handlers);
}
