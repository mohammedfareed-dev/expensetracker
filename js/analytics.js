/**
 * analytics.js
 * Pure expense analytics calculations and dynamic Chart.js visualizations
 * for Category Breakdown, Monthly Income vs Expenses, Spending Distribution,
 * Highest Spending Category, and Total Savings.
 */

import { escapeHTML, formatCurrency, formatMonthLabel } from './transactions.js';

const ANALYTICS_PALETTE = [
  '#0f766e',
  '#2563eb',
  '#d97706',
  '#0891b2',
  '#16a34a',
  '#dc2626',
  '#475569',
  '#7c3aed',
  '#0284c7',
];

let incomeExpenseChart = null;
let categoryBarChart = null;
let distributionChart = null;

function getMonthRangeKeys(referenceMonth, count) {
  const [y, m] = referenceMonth.split('-').map(Number);
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function filterTransactionsByTimeframe(transactions, timeframe, referenceMonth) {
  if (timeframe === 'month') {
    return transactions.filter((tx) => tx.date.startsWith(referenceMonth));
  }
  if (timeframe === '3m') {
    const allowed = new Set(getMonthRangeKeys(referenceMonth, 3));
    return transactions.filter((tx) => allowed.has(tx.date.slice(0, 7)));
  }
  if (timeframe === '6m') {
    const allowed = new Set(getMonthRangeKeys(referenceMonth, 6));
    return transactions.filter((tx) => allowed.has(tx.date.slice(0, 7)));
  }
  return [...transactions];
}

export function calculateAnalyticsMetrics(filteredTransactions, timeframe, referenceMonth) {
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryMap = new Map();
  const monthMap = new Map();

  for (const tx of filteredTransactions) {
    const monthKey = tx.date.slice(0, 7);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { income: 0, expense: 0 });
    }
    const monthBucket = monthMap.get(monthKey);

    if (tx.type === 'income') {
      totalIncome += tx.amount;
      monthBucket.income += tx.amount;
    } else {
      totalExpenses += tx.amount;
      monthBucket.expense += tx.amount;

      const existing = categoryMap.get(tx.category) || { category: tx.category, amount: 0, count: 0 };
      existing.amount += tx.amount;
      existing.count += 1;
      categoryMap.set(tx.category, existing);
    }
  }

  const totalSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  const categoryBreakdown = Array.from(categoryMap.values())
    .map((item) => ({
      ...item,
      amount: Math.round(item.amount * 100) / 100,
      percentage: totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const highestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;

  let monthKeys;
  if (timeframe === 'month') {
    monthKeys = [referenceMonth];
  } else if (timeframe === '3m') {
    monthKeys = getMonthRangeKeys(referenceMonth, 3);
  } else if (timeframe === '6m') {
    monthKeys = getMonthRangeKeys(referenceMonth, 6);
  } else {
    monthKeys = Array.from(monthMap.keys()).sort();
  }

  const monthlySeries = monthKeys.map((key) => {
    const [yr, mo] = key.split('-').map(Number);
    const label = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: '2-digit',
    }).format(new Date(yr, mo - 1, 1));
    const bucket = monthMap.get(key) || { income: 0, expense: 0 };
    return {
      key,
      label,
      income: Math.round(bucket.income * 100) / 100,
      expense: Math.round(bucket.expense * 100) / 100,
    };
  });

  const activeMonthCount = Math.max(1, monthKeys.length);
  const avgMonthlyExpense = totalExpenses / activeMonthCount;

  return {
    totalIncome,
    totalExpenses,
    totalSavings,
    savingsRate,
    highestCategory,
    categoryBreakdown,
    monthlySeries,
    avgMonthlyExpense,
    transactionCount: filteredTransactions.length,
  };
}

function renderIncomeExpenseChart(monthlySeries) {
  const canvas = document.getElementById('chart-analytics-income-expense');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (incomeExpenseChart) {
    incomeExpenseChart.destroy();
    incomeExpenseChart = null;
  }

  incomeExpenseChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: monthlySeries.map((m) => m.label),
      datasets: [
        {
          label: 'Income',
          data: monthlySeries.map((m) => m.income),
          backgroundColor: '#16a34a',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.6,
        },
        {
          label: 'Expenses',
          data: monthlySeries.map((m) => m.expense),
          backgroundColor: '#dc2626',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.6,
        },
      ],
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
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
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
          ticks: { color: '#64748b', font: { size: 11.5 } },
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

function renderCategoryBarChart(breakdown) {
  const canvas = document.getElementById('chart-analytics-category-bar');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (categoryBarChart) {
    categoryBarChart.destroy();
    categoryBarChart = null;
  }

  const hasData = breakdown.length > 0;
  categoryBarChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: hasData ? breakdown.map((b) => b.category) : ['No Expenses'],
      datasets: [
        {
          label: 'Spend',
          data: hasData ? breakdown.map((b) => b.amount) : [0],
          backgroundColor: hasData
            ? breakdown.map((_, i) => ANALYTICS_PALETTE[i % ANALYTICS_PALETTE.length])
            : ['#e2e8f0'],
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: hasData,
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.x),
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString('en-US')}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#334155', font: { size: 12 } },
        },
      },
    },
  });
}

function renderDistributionChart(breakdown) {
  const canvas = document.getElementById('chart-analytics-distribution');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (distributionChart) {
    distributionChart.destroy();
    distributionChart = null;
  }

  const hasData = breakdown.length > 0;
  distributionChart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: hasData ? breakdown.map((b) => b.category) : ['No Data'],
      datasets: [
        {
          data: hasData ? breakdown.map((b) => b.amount) : [1],
          backgroundColor: hasData
            ? breakdown.map((_, i) => ANALYTICS_PALETTE[i % ANALYTICS_PALETTE.length])
            : ['#e2e8f0'],
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          display: hasData,
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: '#475569',
            font: { size: 11.5 },
          },
        },
        tooltip: {
          enabled: hasData,
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

function renderCategoryTable(breakdown) {
  const container = document.getElementById('analytics-category-table');
  if (!container) return;

  if (breakdown.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="bar-chart-2"></i>
        <h3 class="empty-state-title">No expense data in this period</h3>
        <p class="empty-state-desc">Add expense transactions or switch to a wider timeframe to inspect category analytics.</p>
      </div>
    `;
    return;
  }

  const rows = breakdown
    .map(
      (item, index) => `
      <tr>
        <td>
          <div class="legend-left">
            <span class="legend-swatch" style="background:${ANALYTICS_PALETTE[index % ANALYTICS_PALETTE.length]}"></span>
            <span class="tx-title-text">${escapeHTML(item.category)}</span>
          </div>
        </td>
        <td class="align-right tabular-nums">${item.count}</td>
        <td class="align-right tabular-nums tx-amount">${formatCurrency(item.amount)}</td>
        <td class="align-right tabular-nums">${item.percentage.toFixed(1)}%</td>
      </tr>
    `
    )
    .join('');

  container.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th class="align-right">Transactions</th>
            <th class="align-right">Total Spent</th>
            <th class="align-right">Share</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAnalyticsView(allTransactions, timeframe, selectedMonth) {
  const filtered = filterTransactionsByTimeframe(allTransactions, timeframe, selectedMonth);
  const metrics = calculateAnalyticsMetrics(filtered, timeframe, selectedMonth);

  const savingsEl = document.getElementById('analytics-total-savings');
  const savingsRateEl = document.getElementById('analytics-savings-rate');
  const topCatEl = document.getElementById('analytics-top-category');
  const topCatMetaEl = document.getElementById('analytics-top-category-meta');
  const avgExpEl = document.getElementById('analytics-avg-expense');
  const avgMetaEl = document.getElementById('analytics-avg-meta');
  const periodExpEl = document.getElementById('analytics-period-expense');
  const txCountEl = document.getElementById('analytics-tx-count');

  if (savingsEl) {
    savingsEl.textContent = formatCurrency(metrics.totalSavings);
    savingsEl.classList.toggle('is-income', metrics.totalSavings > 0);
    savingsEl.classList.toggle('is-expense', metrics.totalSavings < 0);
  }
  if (savingsRateEl) {
    savingsRateEl.textContent =
      metrics.totalIncome > 0
        ? `${metrics.savingsRate.toFixed(1)}% of income saved`
        : 'No income recorded in period';
  }

  if (topCatEl && topCatMetaEl) {
    if (metrics.highestCategory) {
      topCatEl.textContent = metrics.highestCategory.category;
      topCatMetaEl.textContent = `${formatCurrency(metrics.highestCategory.amount)} (${metrics.highestCategory.percentage.toFixed(1)}% of spend)`;
    } else {
      topCatEl.textContent = '—';
      topCatMetaEl.textContent = 'No expense data';
    }
  }

  if (avgExpEl) avgExpEl.textContent = formatCurrency(metrics.avgMonthlyExpense);
  if (avgMetaEl) {
    avgMetaEl.textContent =
      timeframe === 'month'
        ? formatMonthLabel(selectedMonth)
        : `Across ${metrics.monthlySeries.length} month${metrics.monthlySeries.length === 1 ? '' : 's'}`;
  }
  if (periodExpEl) periodExpEl.textContent = formatCurrency(metrics.totalExpenses);
  if (txCountEl) {
    txCountEl.textContent = `${metrics.transactionCount} transaction${metrics.transactionCount === 1 ? '' : 's'}`;
  }

  renderIncomeExpenseChart(metrics.monthlySeries);
  renderCategoryBarChart(metrics.categoryBreakdown);
  renderDistributionChart(metrics.categoryBreakdown);
  renderCategoryTable(metrics.categoryBreakdown);
}
