# FinTrack Pro — HDFC Expense & Income Intelligence Web App

A modern, local-first web application designed specifically for Indian HDFC Bank account holders to track income and expenses, auto-identify and auto-categorize bank statements, and group expenditures into **Needs**, **Wants**, and **Luxury** according to the modern 50/30/20 budgeting rule.

---

## 🌟 Key Features

1. **HDFC Bank Statement Upload & Auto-Identification**:
   - Supports **CSV**, **Excel (.xls / .xlsx)**, **PDF** (including password-encrypted HDFC statements), and **Pasted Text**.
   - Decodes Indian UPI handles (`UPI-SWIGGY-...`, `UPI-BLINKIT-...`, `UPI-AMAZON-...`), NEFT credits, IMPS transfers, POS card swipes, ACH loan debits, salary credits, and bank interest.
   - Cleans messy raw bank narrations into readable merchant names (e.g. *Swiggy*, *Blinkit*, *Apollo Pharmacy*, *Zara*, *Cult.fit*, *Zerodha*).

2. **Automatic Income & Expense Categorization**:
   - **Income**: Salary & Compensation, Dividends & Capital Gains, Bank Interest, Freelance & Invoicing, Refunds & Cashbacks.
   - **Expenses**: Rent & Housing, Groceries & Essentials, Utilities & Power/Broadband, Commute & Fuel, Healthcare, Shopping, Dining & Food Delivery, OTT & Subscriptions, Fitness, Personal Care, Bank Charges.

3. **High-Level Need vs. Want vs. Luxury Grouping**:
   - **Needs (Target &le; 50%)**: Essential survival expenses (Rent, Home Loan EMI, Groceries, Electricity BESCOM, Medicines, Fuel/Metro).
   - **Wants (Target &le; 30%)**: Lifestyle expenses (Food delivery, casual dining, shopping, Netflix/Spotify subscriptions, movies).
   - **Luxury (Target &le; 10%)**: High-ticket splurges (Taj/Marriott luxury resorts, Apple Store electronics, premium breweries like Toit, designer shopping).
   - **Wealth / Savings (Target &ge; 20%)**: Mutual Fund SIPs, Index Funds, retained surplus.

4. **Basic & Advanced Metrics, Charts & Graphs**:
   - Total Income, Total Expenses, Net Surplus, Savings Rate (%) with financial health status badges.
   - **Income vs Expense Cash Flow**: Comparative Bar & Area Chart.
   - **Expenditure Composition Donut**: Visual breakdown of Needs vs Wants vs Luxury.
   - **Category Distribution**: Horizontal ranking bar chart of top spending categories.
   - **Top Payees / Merchants Leaderboard**: Live ranking of where money flows.

5. **Interactive Calendar Heat Map**:
   - GitHub-style / monthly expenditure heat map showing daily spending density.
   - Color coding: Light Spend (&le; ₹1k), Medium Spend (₹1k-₹3k), High Spend (₹3k-₹10k), and Heavy Splurge (>₹10k).
   - Interactive hover tooltips & click-to-filter drawer to immediately isolate transactions for any date.

6. **Daily, Weekly, Monthly & Yearly Views**:
   - Instant period switcher with intuitive month/year navigation buttons and "Current" quick jump.

7. **Manual CRUD Controls**:
   - Full manual Add, Edit, and Delete transactions.
   - Custom merchant, amount, category, grouping (Need/Want/Luxury), and payment channel.
   - Multi-select bulk actions (bulk delete, bulk recategorize).
   - One-click CSV export and instant Demo Data reset.

---

## 🚀 Running the App Locally

The application runs using native Node.js without heavy npm dependencies:

```bash
cd hdfc-expense-tracker
node server.mjs
```

Open your browser at:
👉 **`http://localhost:3000`**

---

## 🔒 100% Privacy & Local-First Security
Financial bank statements are parsed entirely inside your browser using client-side JavaScript, SheetJS, and PDF.js. No sensitive financial information or statement files are sent to external servers or third-party cloud services.
