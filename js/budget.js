/**
 * budget.js
 * Pure monthly budget calculations, 80% warning & 100% exceeded threshold evaluation,
 * cumulative spending pace chart, and Budget Management view rendering.
 */

import { escapeHTML, formatCurrency, formatMonthLabel } from './transactions.js';

let budgetPaceChart = null;

export function calculateBudgetStatus(transactions, selectedMonth, monthlyLimit) {
  const limit = Number(monthlyLimit) || 0;
  const monthlyExpenses = transactions
    .filter((tx) => tx.type === 'expense' && tx.date.startsWith(selectedMonth))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const remaining = limit - monthlyExpenses;
  const utilizationPercent = limit > 0 ? (monthlyExpenses / limit) * 100 : 0;

  let status = 'unset';
  if (limit > 0) {
    if (utilizationPercent >= 100) {
      status = 'exceeded';
    } else if (utilizationPercent >= 80) {
      status = 'warning';
    } else {
      status = 'nominal';
    }
  }

  return {
    monthlyLimit: Math.round(limit * 100) / 100,
    monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    utilizationPercent,
    status,
  };
}

export function getDailyCumulativeSeries(transactions, selectedMonth, monthlyLimit) {
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyTotals = new Array(daysInMonth).fill(0);

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date.startsWith(selectedMonth)) continue;
    const day = Number(tx.date.split('-')[2]);
    if (day >= 1 && day <= daysInMonth) {
      dailyTotals[day - 1] += tx.amount;
    }
  }

  const labels = [];
  const cumulative = [];
  const limitLine = [];
  let running = 0;

  for (let i = 0; i < daysInMonth; i++) {
    running += dailyTotals[i];
    labels.push(String(i + 1));
    cumulative.push(Math.round(running * 100) / 100);
    limitLine.push(monthlyLimit > 0 ? monthlyLimit : null);
  }

  return { labels, cumulative, limitLine };
}

export function getMonthlyCategoryShares(transactions, selectedMonth, monthlyLimit) {
  const map = new Map();
  let totalSpent = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date.startsWith(selectedMonth)) continue;
    map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
    totalSpent += tx.amount;
  }

  const denominator = monthlyLimit > 0 ? monthlyLimit : totalSpent;

  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      shareOfBudget: denominator > 0 ? (amount / denominator) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function renderBudgetAlertBanner(statusObj, selectedMonth) {
  const container = document.getElementById('budget-alert-banner');
  if (!container) return;

  const monthLabel = formatMonthLabel(selectedMonth);

  if (statusObj.status === 'unset') {
    container.innerHTML = `
      <div class="alert-banner" role="status">
        <div class="alert-banner-content">
          <i data-lucide="info"></i>
          <div>
            <span class="alert-banner-title">No Budget Set:</span>
            <span>Enter a monthly budget limit below to track utilization and receive 80% spending alerts for ${escapeHTML(monthLabel)}.</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (statusObj.status === 'exceeded') {
    container.innerHTML = `
      <div class="alert-banner is-exceeded" role="alert">
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon"></i>
          <div>
            <span class="alert-banner-title">Budget Exceeded (${statusObj.utilizationPercent.toFixed(1)}%):</span>
            <span>Your ${escapeHTML(monthLabel)} spending of ${formatCurrency(statusObj.monthlyExpenses)} has exceeded your ${formatCurrency(statusObj.monthlyLimit)} limit by ${formatCurrency(Math.abs(statusObj.remaining))}.</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (statusObj.status === 'warning') {
    container.innerHTML = `
      <div class="alert-banner is-warning" role="status">
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle"></i>
          <div>
            <span class="alert-banner-title">Approaching Budget Limit (${statusObj.utilizationPercent.toFixed(1)}%):</span>
            <span>You have crossed the 80% spending warning threshold for ${escapeHTML(monthLabel)}. ${formatCurrency(statusObj.remaining)} remaining.</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="alert-banner is-nominal" role="status">
      <div class="alert-banner-content">
        <i data-lucide="check-circle-2"></i>
        <div>
          <span class="alert-banner-title">On Track (${statusObj.utilizationPercent.toFixed(1)}%):</span>
          <span>${escapeHTML(monthLabel)} spending is within budget with ${formatCurrency(statusObj.remaining)} remaining.</span>
        </div>
      </div>
    </div>
  `;
}

function renderBudgetPaceChart(transactions, selectedMonth, monthlyLimit) {
  const canvas = document.getElementById('chart-budget-pace');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (budgetPaceChart) {
    budgetPaceChart.destroy();
    budgetPaceChart = null;
  }

  const series = getDailyCumulativeSeries(transactions, selectedMonth, monthlyLimit);

  const datasets = [
    {
      label: 'Cumulative Spend',
      data: series.cumulative,
      borderColor: '#0f766e',
      backgroundColor: 'rgba(15, 118, 110, 0.08)',
      fill: true,
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
    },
  ];

  if (monthlyLimit > 0) {
    datasets.push({
      label: 'Monthly Budget Cap',
      data: series.limitLine,
      borderColor: '#dc2626',
      borderDash: [6, 4],
      fill: false,
      pointRadius: 0,
      borderWidth: 1.5,
    });
  }

  budgetPaceChart = new window.Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: series.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 12,
            color: '#475569',
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => `Day ${items[0].label} of ${formatMonthLabel(selectedMonth)}`,
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 10,
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
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

function renderBudgetCategoryBreakdown(transactions, selectedMonth, monthlyLimit) {
  const container = document.getElementById('budget-category-breakdown');
  if (!container) return;

  const shares = getMonthlyCategoryShares(transactions, selectedMonth, monthlyLimit);

  if (shares.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="layers"></i>
        <h3 class="empty-state-title">No monthly expenses yet</h3>
        <p class="empty-state-desc">Expenses logged in ${escapeHTML(formatMonthLabel(selectedMonth))} will appear here by category.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="budget-cat-list">
      ${shares
        .map((item) => {
          const barWidth = Math.min(100, Math.max(2, item.shareOfBudget));
          return `
            <div class="budget-cat-row">
              <div class="budget-cat-head">
                <span class="budget-cat-name">${escapeHTML(item.category)}</span>
                <span class="budget-cat-nums tabular-nums">
                  ${formatCurrency(item.amount)} (${item.shareOfBudget.toFixed(1)}%)
                </span>
              </div>
              <div class="budget-cat-bar-bg">
                <div class="budget-cat-bar-fill" style="width: ${barWidth.toFixed(1)}%"></div>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

export function renderBudgetView(transactions, selectedMonth, monthlyLimit) {
  const statusObj = calculateBudgetStatus(transactions, selectedMonth, monthlyLimit);

  const monthSubtitleEl = document.getElementById('budget-month-subtitle');
  const inputEl = document.getElementById('budget-limit-input');
  const badgeEl = document.getElementById('budget-utilization-badge');
  const fillEl = document.getElementById('budget-progress-fill');
  const roleEl = document.getElementById('budget-progressbar-role');
  const valLimitEl = document.getElementById('budget-val-limit');
  const valSpentEl = document.getElementById('budget-val-spent');
  const valRemainingEl = document.getElementById('budget-val-remaining');
  const remainingLabelEl = document.getElementById('budget-remaining-label');

  if (monthSubtitleEl) {
    monthSubtitleEl.textContent = `Spending ceiling for ${formatMonthLabel(selectedMonth)}`;
  }

  if (inputEl && document.activeElement !== inputEl) {
    inputEl.value = statusObj.monthlyLimit > 0 ? statusObj.monthlyLimit : '';
  }

  if (badgeEl) {
    badgeEl.textContent =
      statusObj.monthlyLimit > 0 ? `${statusObj.utilizationPercent.toFixed(1)}%` : 'Not Set';
    badgeEl.className = 'budget-status-text tabular-nums';
    if (statusObj.status === 'exceeded') badgeEl.classList.add('is-exceeded');
    else if (statusObj.status === 'warning') badgeEl.classList.add('is-warning');
    else if (statusObj.status === 'nominal') badgeEl.classList.add('is-nominal');
  }

  if (fillEl) {
    const clampedWidth = Math.min(100, Math.max(0, statusObj.utilizationPercent));
    fillEl.style.width = `${clampedWidth.toFixed(1)}%`;
    fillEl.className = 'budget-progress-fill';
    if (statusObj.status === 'exceeded') fillEl.classList.add('is-exceeded');
    else if (statusObj.status === 'warning') fillEl.classList.add('is-warning');
  }

  if (roleEl) {
    roleEl.setAttribute('aria-valuenow', String(Math.round(statusObj.utilizationPercent)));
  }

  if (valLimitEl) valLimitEl.textContent = formatCurrency(statusObj.monthlyLimit);
  if (valSpentEl) valSpentEl.textContent = formatCurrency(statusObj.monthlyExpenses);

  if (valRemainingEl && remainingLabelEl) {
    valRemainingEl.className = 'budget-metric-value tabular-nums';
    if (statusObj.monthlyLimit === 0) {
      remainingLabelEl.textContent = 'Remaining Budget';
      valRemainingEl.textContent = '$0.00';
    } else if (statusObj.remaining < 0) {
      remainingLabelEl.textContent = 'Over Budget By';
      valRemainingEl.textContent = formatCurrency(Math.abs(statusObj.remaining));
      valRemainingEl.classList.add('is-exceeded');
    } else {
      remainingLabelEl.textContent = 'Remaining Budget';
      valRemainingEl.textContent = formatCurrency(statusObj.remaining);
      valRemainingEl.classList.add('is-nominal');
    }
  }

  renderBudgetAlertBanner(statusObj, selectedMonth);
  renderBudgetPaceChart(transactions, selectedMonth, statusObj.monthlyLimit);
  renderBudgetCategoryBreakdown(transactions, selectedMonth, statusObj.monthlyLimit);
}

export function bindBudgetEvents({ onSaveBudget }) {
  const form = document.getElementById('budget-form');
  const input = document.getElementById('budget-limit-input');
  const errEl = document.getElementById('err-budget-limit');

  function clearBudgetError() {
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    input?.classList.remove('has-error');
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearBudgetError();

    const value = Number(input.value);
    if (!Number.isFinite(value) || value <= 0) {
      if (errEl) {
        errEl.textContent = 'Please enter a valid monthly budget greater than $0.';
        errEl.hidden = false;
      }
      input.classList.add('has-error');
      return;
    }

    onSaveBudget(value);
  });

  document.querySelectorAll('[data-budget-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearBudgetError();
      const amount = Number(btn.dataset.budgetPreset);
      if (input) input.value = amount;
      onSaveBudget(amount);
    });
  });
}
