import { getMonthKey, toMonthKey } from './utils'
import { getBillPeriodInfo } from './bills'

// Generate a monthly report as a printable HTML page
// Uses browser print dialog — no external PDF library needed

export function generateMonthlyReport(data, profile, year, month, symbol) {
  const s = symbol || '₱'
  const ym = toMonthKey(year, month)
  const monthLabel = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })

  const income = data.income.filter(t => getMonthKey(t.date) === ym)
  const expenses = data.expenses.filter(t => getMonthKey(t.date) === ym)
  const bills = data.bills
  const goals = data.goals

  const totalIncome = income.reduce((s, t) => s + (t.amount || 0), 0)
  const totalExpense = expenses.reduce((s, t) => s + (t.amount || 0), 0)
  const totalBills = bills.reduce((s, b) => s + (b.amount || 0), 0)
  const net = totalIncome - totalExpense
  const savingsTotal = goals.reduce((s, g) => s + (g.current || 0), 0)
  const rate = totalIncome ? Math.round((net / totalIncome) * 100) : 0

  const fmt = (n) => s + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Group expenses by category
  const expCats = {}
  expenses.forEach(t => { expCats[t.cat] = (expCats[t.cat] || 0) + (t.amount || 0) })
  const catRows = Object.entries(expCats).sort((a, b) => b[1] - a[1])

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Buhay Report — ${monthLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; font-size: 13px; color: #111; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 28px; color: #16a34a; letter-spacing: -0.5px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  .stat { background: #f8f8f8; border-radius: 8px; padding: 16px; }
  .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 6px; }
  .stat-val { font-size: 20px; font-weight: 700; font-family: monospace; }
  .green { color: #16a34a; } .red { color: #dc2626; } .blue { color: #2563eb; } .amber { color: #d97706; }
  h2 { font-size: 15px; font-weight: 700; color: #111; margin: 24px 0 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; color: #888; border-bottom: 1px solid #eee; }
  td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:last-child td { border-bottom: none; }
  .amt { font-family: monospace; font-weight: 600; text-align: right; }
  .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>Buhay</h1>
<div class="sub">Monthly Report — ${monthLabel} · Generated ${new Date().toLocaleDateString()}</div>

<div class="grid">
  <div class="stat"><div class="stat-label">Total Income</div><div class="stat-val green">${fmt(totalIncome)}</div></div>
  <div class="stat"><div class="stat-label">Total Expenses</div><div class="stat-val red">${fmt(totalExpense)}</div></div>
  <div class="stat"><div class="stat-label">Net Balance</div><div class="stat-val ${net >= 0 ? 'blue' : 'red'}">${fmt(net)}</div></div>
  <div class="stat"><div class="stat-label">Savings Rate</div><div class="stat-val amber">${rate}%</div></div>
</div>

<h2>Income (${income.length} entries)</h2>
<table>
  <thead><tr><th>Description</th><th>Category</th><th>Date</th><th class="amt">Amount</th></tr></thead>
  <tbody>
    ${income.map(t => `<tr><td>${t.desc || ''}</td><td>${[t.cat, t.subcat].filter(Boolean).join(' · ')}</td><td>${t.date || ''}</td><td class="amt green">${fmt(t.amount)}</td></tr>`).join('') || '<tr><td colspan="4" style="color:#aaa;text-align:center">No income this month</td></tr>'}
    <tr style="background:#f0fff4"><td colspan="3" style="font-weight:700">Total</td><td class="amt green" style="font-weight:700">${fmt(totalIncome)}</td></tr>
  </tbody>
</table>

<h2>Expenses (${expenses.length} entries)</h2>
<table>
  <thead><tr><th>Description</th><th>Category</th><th>Date</th><th class="amt">Amount</th></tr></thead>
  <tbody>
    ${expenses.map(t => `<tr><td>${t.desc || ''}</td><td>${[t.cat, t.subcat].filter(Boolean).join(' · ')}</td><td>${t.date || ''}</td><td class="amt red">${fmt(t.amount)}</td></tr>`).join('') || '<tr><td colspan="4" style="color:#aaa;text-align:center">No expenses this month</td></tr>'}
    <tr style="background:#fff5f5"><td colspan="3" style="font-weight:700">Total</td><td class="amt red" style="font-weight:700">${fmt(totalExpense)}</td></tr>
  </tbody>
</table>

<h2>Spending by Category</h2>
<table>
  <thead><tr><th>Category</th><th class="amt">Amount</th><th class="amt">% of expenses</th></tr></thead>
  <tbody>
    ${catRows.map(([cat, amt]) => `<tr><td>${cat}</td><td class="amt">${fmt(amt)}</td><td class="amt">${totalExpense ? Math.round((amt / totalExpense) * 100) : 0}%</td></tr>`).join('')}
  </tbody>
</table>

<h2>Bills (${bills.length} total)</h2>
<table>
  <thead><tr><th>Name</th><th>Category</th><th>Due Day</th><th>Frequency</th><th class="amt">Amount</th><th>Status</th></tr></thead>
  <tbody>
    ${bills.map(b => {
      const period = getBillPeriodInfo(b, new Date(year, month, 1))
      return `<tr><td>${b.name || ''}</td><td>${b.subcat || b.cat || ''}</td><td>Day ${b.due}</td><td>${b.freq || ''}</td><td class="amt amber">${fmt(b.amount)}</td><td>${period.paid ? 'Paid' : period.label}</td></tr>`
    }).join('') || '<tr><td colspan="6" style="color:#aaa;text-align:center">No bills</td></tr>'}
    <tr style="background:#fffbeb"><td colspan="4" style="font-weight:700">Total monthly bills</td><td class="amt amber" style="font-weight:700">${fmt(totalBills)}</td><td></td></tr>
  </tbody>
</table>

<h2>Savings Goals</h2>
<table>
  <thead><tr><th>Goal</th><th class="amt">Saved</th><th class="amt">Target</th><th class="amt">Progress</th></tr></thead>
  <tbody>
    ${goals.map(g => `<tr><td>${g.name}</td><td class="amt green">${fmt(g.current || 0)}</td><td class="amt">${fmt(g.target)}</td><td class="amt">${Math.min(100, Math.round(((g.current || 0) / (g.target || 1)) * 100))}%</td></tr>`).join('') || '<tr><td colspan="4" style="color:#aaa;text-align:center">No goals</td></tr>'}
    <tr style="background:#f0f9ff"><td style="font-weight:700">Total saved</td><td class="amt blue" style="font-weight:700">${fmt(savingsTotal)}</td><td colspan="2"></td></tr>
  </tbody>
</table>

<div class="footer">Generated by Buhay · Bawat araw, mas malinaw.</div>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}
