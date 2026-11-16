/**
 * FinTrack Pro - Main Frontend Application Logic
 */
import { CATEGORIES, GROUPINGS, categorizeTransaction, getCategoryMeta, detectTaxTags } from './categorizer.js';
import { HDFCParser } from './hdfc-parser.js';

class FinTrackApp {
  constructor() {
    this.transactions = [];
    this.activeTab = 'overview';
    this.period = 'monthly'; // 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'
    
    // Default to current date
    const now = new Date();
    this.currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    this.filters = {
      search: '',
      type: 'all',
      grouping: 'all',
      category: 'all'
    };

    this.sort = {
      field: 'date',
      direction: 'desc'
    };

    this.selectedIds = new Set();
    this.selectedHeatmapDate = null;
    this.parsedStaging = [];
    this.incomeMode = 'all'; // 'all' (Gross Bank Credits) | 'earned' (Net Earned Salary & Yield)
    this.currentDrilldownItems = [];

    // Categories tab state
    this.selectedCategoryForDrilldown = null;
    this.categoryTabFilter = 'expense'; // 'expense' | 'need' | 'want' | 'luxury' | 'savings' | 'income' | 'all'
    this.categorySearch = '';
    this.categoryViewAllTime = false; // toggle inside category drilldown

    // Advanced Financial Intelligence State
    this.privacyMode = localStorage.getItem('fintrack_privacy') === 'true';
    this.customRules = [];
    this.savingsReductionPct = 20; // default 20%
    this.detectedAnomalies = [];
    this.detectedRecurring = [];

    // Multi-Account, Budgets, and MoM State
    this.accountFilter = 'all'; // 'all' | 'hdfc_salary' | 'hdfc_cc' | 'secondary'
    this.categoryBudgets = {};
    this.momBaseMonth = null;
    this.momTargetMonth = null;

    // Tax & Splits State
    this.taxGrossSalary = 0;
    this.splits = [];
    this.upiVPA = 'user@hdfcbank';

    // Change Category State
    this.changeCategoryTargetIds = [];
    this.selectedNewCategory = null;
    this.changeCategoryGroupFilter = 'all';
    this.changeCategorySearch = '';

    // Chart instances
    this.cashflowChart = null;
    this.trioDonutChart = null;
    this.categoriesChart = null;
    this.incomeDonutChart = null;
    this.capitalLivingChart = null;
    this.multimonthChart = null;
    this.cumulativeWealthChart = null;
    this.paymentRailsChart = null;
    this.dayOfWeekChart = null;
    this.drilldownTrajectoryChart = null;
  }

  async init() {
    this.initPrivacyMode();
    this.initKeyboardShortcuts();
    this.populateCategoryDropdowns();
    await this.fetchRules();
    await this.fetchBudgets();
    await this.fetchSplits();
    await this.fetchTransactions();
    this.populateMoMMonths();

    // If transactions exist, sync reference date with most recent transaction if currentDate is beyond it
    if (this.transactions.length > 0) {
      const dates = this.transactions.map(t => new Date(t.date)).filter(d => !isNaN(d));
      const maxDate = new Date(Math.max(...dates));
      if (maxDate) {
        this.currentDate = maxDate;
      }
    }

    this.updatePeriodDisplay();
    this.renderAll();
    this.setupDropzone();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- API CALLS ---
  async fetchTransactions() {
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      if (data.success) {
        this.transactions = data.data || [];
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  }

  async resetSampleData() {
    if (!confirm('Load realistic HDFC demo statement transactions into your dashboard?')) return;
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.transactions = data.data || [];
        this.selectedIds.clear();
        if (window.confetti) {
          window.confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        }
        this.renderAll();
      }
    } catch (err) {
      alert('Error loading sample data: ' + err.message);
    }
  }

  async clearAllData() {
    if (!confirm('Are you sure you want to remove ALL dummy / existing transactions? This will give you a completely clean, empty dashboard ready for your real HDFC statements.')) return;
    try {
      const res = await fetch('/api/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.transactions = [];
        this.selectedIds.clear();
        this.selectedHeatmapDate = null;
        const drawer = document.getElementById('heatmap-day-details');
        if (drawer) drawer.classList.add('hidden');
        this.renderAll();
      }
    } catch (err) {
      alert('Error clearing data: ' + err.message);
    }
  }

  // --- TAB SWITCHING ---
  switchTab(tabName) {
    this.activeTab = tabName;
    const tabs = ['overview', 'categories', 'transactions', 'subscriptions', 'tax', 'splitwise', 'heatmap', 'budget'];

    // Close any open modals when switching tabs
    this.closeDrilldownModal();
    this.closeUploadModal();
    this.closeTxModal();
    this.closeRulesModal();
    this.closeCommandPalette();
    this.closeExecutiveReport();
    this.closeBackupModal();
    this.closeMerchantProfile();
    this.closeBudgetLimitsModal();
    this.closeSplitModal();
    this.closeChangeCategoryModal();
    this.closeMobileMoreMenu();
    const anomModal = document.getElementById('modal-anomalies');
    if (anomModal) anomModal.classList.add('hidden');

    // Scroll to top immediately so the new tab is viewed cleanly from the beginning
    window.scrollTo({ top: 0, behavior: 'instant' });

    tabs.forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      const btn = document.getElementById(`nav-btn-${t}`);
      const mobBtn = document.getElementById(`mob-nav-btn-${t}`);
      const isCurrent = (t === tabName);

      if (el) {
        if (isCurrent) {
          el.classList.remove('hidden');
          el.style.display = 'block';
          el.classList.remove('tab-pane');
          void el.offsetWidth; // Trigger reflow for silky animation
          el.classList.add('tab-pane');
        } else {
          el.classList.add('hidden');
          el.style.display = 'none';
        }
      }

      if (btn) {
        btn.classList.toggle('active', isCurrent);
        if (isCurrent) {
          btn.className = 'nav-tab-btn active px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition border border-transparent';
        } else {
          btn.className = 'nav-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent';
        }
      }

      if (mobBtn) {
        mobBtn.classList.toggle('active', isCurrent);
        if (isCurrent) {
          mobBtn.className = 'nav-tab-btn active px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap';
        } else {
          mobBtn.className = 'nav-tab-btn px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white whitespace-nowrap';
        }
      }
    });

    // Update mobile bottom dock buttons
    ['overview', 'categories', 'transactions', 'subscriptions'].forEach(t => {
      const dockBtn = document.getElementById(`dock-btn-${t}`);
      if (dockBtn) {
        if (t === tabName) {
          dockBtn.className = 'mob-dock-btn active flex flex-col items-center justify-center p-1.5 rounded-xl text-indigo-400 bg-indigo-500/10 transition min-w-[54px]';
        } else {
          dockBtn.className = 'mob-dock-btn flex flex-col items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-white transition min-w-[54px]';
        }
      }
    });

    const moreTabs = ['tax', 'splitwise', 'heatmap', 'budget'];
    const dockMore = document.getElementById('dock-btn-more');
    if (dockMore) {
      if (moreTabs.includes(tabName)) {
        dockMore.className = 'mob-dock-btn active flex flex-col items-center justify-center p-1.5 rounded-xl text-indigo-400 bg-indigo-500/10 transition min-w-[54px]';
      } else {
        dockMore.className = 'mob-dock-btn flex flex-col items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-white transition min-w-[54px]';
      }
    }

    // Update global indicators & badges for current timeframe
    this.renderKPIs();

    // Re-render and refresh all data for that specific tab
    if (tabName === 'categories') {
      this.renderCategoriesTab();
    } else if (tabName === 'heatmap') {
      this.renderHeatmap();
    } else if (tabName === 'overview') {
      this.renderCharts();
    } else if (tabName === 'transactions') {
      this.renderTransactionsTable();
    } else if (tabName === 'subscriptions') {
      this.renderSubscriptionsTab();
    } else if (tabName === 'tax') {
      this.renderTaxPlanner();
    } else if (tabName === 'splitwise') {
      this.renderSplitwiseTab();
    } else if (tabName === 'budget') {
      this.renderBudgetFramework();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- PERIOD SWITCHING ---
  setPeriod(p) {
    this.period = p;
    ['daily', 'weekly', 'monthly', 'yearly', 'all'].forEach(k => {
      const el = document.getElementById(`period-btn-${k}`);
      if (el) {
        if (k === p) {
          el.className = 'period-tab px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 text-white transition';
        } else {
          el.className = 'period-tab px-3 py-1 text-xs font-medium rounded-lg text-slate-400 hover:text-white transition';
        }
      }
    });

    this.updatePeriodDisplay();
    this.renderAll();
  }

  prevPeriod() {
    const d = new Date(this.currentDate);
    if (this.period === 'daily') d.setDate(d.getDate() - 1);
    else if (this.period === 'weekly') d.setDate(d.getDate() - 7);
    else if (this.period === 'monthly') d.setMonth(d.getMonth() - 1);
    else if (this.period === 'yearly') d.setFullYear(d.getFullYear() - 1);
    this.currentDate = d;
    this.updatePeriodDisplay();
    this.renderAll();
  }

  nextPeriod() {
    const d = new Date(this.currentDate);
    if (this.period === 'daily') d.setDate(d.getDate() + 1);
    else if (this.period === 'weekly') d.setDate(d.getDate() + 7);
    else if (this.period === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (this.period === 'yearly') d.setFullYear(d.getFullYear() + 1);
    this.currentDate = d;
    this.updatePeriodDisplay();
    this.renderAll();
  }

  jumpToCurrent() {
    const now = new Date();
    this.currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.updatePeriodDisplay();
    this.renderAll();
  }

  jumpToSpecificMonth(year, monthIdx) {
    this.period = 'monthly';
    this.currentDate = new Date(year, monthIdx, 1);
    this.setPeriod('monthly');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setIncomeMode(mode) {
    this.incomeMode = mode;
    const btnAll = document.getElementById('btn-mode-all-income');
    const btnEarned = document.getElementById('btn-mode-earned-income');

    if (mode === 'all') {
      if (btnAll) btnAll.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white shadow transition';
      if (btnEarned) btnEarned.className = 'px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition';
    } else {
      if (btnEarned) btnEarned.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow transition';
      if (btnAll) btnAll.className = 'px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition';
    }

    this.renderKPIs();
    this.renderIncomeStreamsChart(this.getFilteredTransactions());
  }

  updatePeriodDisplay() {
    const el = document.getElementById('current-period-display');
    if (!el) return;

    const d = this.currentDate;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (this.period === 'daily') {
      el.textContent = `${d.getDate()} ${months[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    } else if (this.period === 'weekly') {
      const start = new Date(d);
      start.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      el.textContent = `${start.getDate()} ${months[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${months[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
    } else if (this.period === 'monthly') {
      el.textContent = `${months[d.getMonth()]} ${d.getFullYear()}`;
    } else if (this.period === 'yearly') {
      el.textContent = `Year ${d.getFullYear()}`;
    } else {
      el.textContent = 'Entire History';
    }
  }

  // --- FILTERING ---
  getFilteredTransactions() {
    return this.transactions.filter(t => {
      const tDate = new Date(t.date);

      // Period filter
      if (this.period === 'daily') {
        const dStr = this.currentDate.toISOString().slice(0, 10);
        if (t.date !== dStr) return false;
      } else if (this.period === 'weekly') {
        const start = new Date(this.currentDate);
        start.setDate(this.currentDate.getDate() - ((this.currentDate.getDay() + 6) % 7));
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        if (tDate < start || tDate > end) return false;
      } else if (this.period === 'monthly') {
        if (tDate.getFullYear() !== this.currentDate.getFullYear() || tDate.getMonth() !== this.currentDate.getMonth()) {
          return false;
        }
      } else if (this.period === 'yearly') {
        if (tDate.getFullYear() !== this.currentDate.getFullYear()) {
          return false;
        }
      }

      // UI search & dropdown filters
      if (this.filters.type !== 'all' && t.type !== this.filters.type) return false;
      if (this.filters.grouping !== 'all' && t.grouping !== this.filters.grouping) return false;
      if (this.filters.category !== 'all' && t.category !== this.filters.category) return false;

      // Multi-Account filter
      if (this.accountFilter !== 'all') {
        const isCC = (t.category === 'emi_loans' && /CREDIT CARD|HDFC CC/i.test(t.narration)) || t.account === 'hdfc_cc';
        const isSec = (/ICICI|SBI|SELF/i.test(t.merchant || t.narration)) || t.account === 'secondary';
        if (this.accountFilter === 'hdfc_cc' && !isCC) return false;
        if (this.accountFilter === 'secondary' && !isSec) return false;
        if (this.accountFilter === 'hdfc_salary' && (isCC || isSec)) return false;
      }

      if (this.filters.search) {
        const q = this.filters.search.toLowerCase();
        const narration = (t.narration || '').toLowerCase();
        const merchant = (t.merchant || '').toLowerCase();
        const ref = (t.chqRef || '').toLowerCase();
        const amt = String(t.amount || '');
        if (!narration.includes(q) && !merchant.includes(q) && !ref.includes(q) && !amt.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }

  applyFilters() {
    const searchEl = document.getElementById('tx-search-input');
    const typeEl = document.getElementById('filter-type');
    const groupingEl = document.getElementById('filter-grouping');
    const categoryEl = document.getElementById('filter-category');

    this.filters.search = searchEl ? searchEl.value.trim() : '';
    this.filters.type = typeEl ? typeEl.value : 'all';
    this.filters.grouping = groupingEl ? groupingEl.value : 'all';
    this.filters.category = categoryEl ? categoryEl.value : 'all';

    this.renderTransactionsTable();
  }

  clearFilters() {
    const searchEl = document.getElementById('tx-search-input');
    const typeEl = document.getElementById('filter-type');
    const groupingEl = document.getElementById('filter-grouping');
    const categoryEl = document.getElementById('filter-category');

    if (searchEl) searchEl.value = '';
    if (typeEl) typeEl.value = 'all';
    if (groupingEl) groupingEl.value = 'all';
    if (categoryEl) categoryEl.value = 'all';

    this.filters = { search: '', type: 'all', grouping: 'all', category: 'all' };
    this.renderTransactionsTable();
  }

  filterTransactionsByDate(dateStr) {
    this.switchTab('transactions');
    const searchEl = document.getElementById('tx-search-input');
    if (searchEl) searchEl.value = dateStr;
    this.applyFilters();
  }

  sortBy(field) {
    if (this.sort.field === field) {
      this.sort.direction = this.sort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sort.field = field;
      this.sort.direction = 'desc';
    }
    this.renderTransactionsTable();
  }

  // --- RENDER ALL SECTIONS ---
  renderAll() {
    this.renderKPIs();
    this.renderCharts();
    this.renderTransactionsTable();
    this.renderCategoriesTab();
    this.renderBudgetFramework();
    this.renderCategoryBudgets();
    this.renderSankeyFlow();
    this.renderMoMComparison();
    this.renderFIREMetrics();
    this.renderSafeToSpend();
    this.renderSubscriptionsTab();
    this.renderTaxPlanner();
    this.renderSplitwiseTab();
    if (this.activeTab === 'heatmap') {
      this.renderHeatmap();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // --- KPI & BUDGET METRICS ---
  renderKPIs() {
    const txs = this.getFilteredTransactions();

    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    let salaryAmt = 0;
    let tradingInAmt = 0;
    let pfAmt = 0;
    let tradingOutAmt = 0;
    let propertyAmt = 0;
    let earnedIncome = 0;

    let needsAmt = 0;
    let wantsAmt = 0;
    let luxuryAmt = 0;
    let savingsAmt = 0;

    txs.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        totalIncome += amt;
        incomeCount++;

        if (t.category === 'salary') salaryAmt += amt;
        else if (t.category === 'investment_income') tradingInAmt += amt;
        else if (t.category === 'pf_retirement') pfAmt += amt;

        if (t.category === 'salary' || t.category === 'dividend' || t.category === 'interest' || t.category === 'refund') {
          earnedIncome += amt;
        }
      } else {
        totalExpense += amt;
        expenseCount++;

        if (t.category === 'trading_investment') tradingOutAmt += amt;
        else if (t.category === 'housing_property') propertyAmt += amt;

        if (t.grouping === GROUPINGS.NEED) needsAmt += amt;
        else if (t.grouping === GROUPINGS.WANT) wantsAmt += amt;
        else if (t.grouping === GROUPINGS.LUXURY) luxuryAmt += amt;
        else if (t.grouping === GROUPINGS.SAVINGS) savingsAmt += amt;
        else wantsAmt += amt; // default fallback
      }
    });

    const displayIncome = (this.incomeMode === 'earned') ? earnedIncome : totalIncome;
    const netSavings = displayIncome - totalExpense;
    const savingsRate = displayIncome > 0 ? Math.round((netSavings / displayIncome) * 100) : 0;

    // Days elapsed in current period for average
    let daysInPeriod = 30;
    if (this.period === 'daily') daysInPeriod = 1;
    else if (this.period === 'weekly') daysInPeriod = 7;
    else if (this.period === 'yearly') daysInPeriod = 365;
    else {
      const d = this.currentDate;
      daysInPeriod = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }
    const dailyAvg = Math.round(totalExpense / daysInPeriod);

    // Update KPI UI elements
    const incomeEl = document.getElementById('kpi-total-income');
    const expenseEl = document.getElementById('kpi-total-expense');
    const savingsEl = document.getElementById('kpi-net-savings');
    const badgeEl = document.getElementById('kpi-savings-rate-badge');

    if (incomeEl) incomeEl.textContent = formatINR(displayIncome);
    if (expenseEl) expenseEl.textContent = formatINR(totalExpense);
    if (savingsEl) {
      savingsEl.textContent = formatINR(netSavings);
      savingsEl.className = `text-2xl lg:text-3xl font-extrabold font-mono ${netSavings >= 0 ? 'text-indigo-400' : 'text-rose-400'}`;
    }

    // Sub-pills
    const salaryPill = document.getElementById('kpi-salary-pill');
    const tradingPill = document.getElementById('kpi-trading-pill');
    const pfPill = document.getElementById('kpi-pf-pill');
    const capitalPill = document.getElementById('kpi-capital-pill');
    const propertyPill = document.getElementById('kpi-property-pill');

    if (salaryPill) salaryPill.innerHTML = `💼 Salary: ${formatINR(salaryAmt)}`;
    if (tradingPill) tradingPill.innerHTML = `📈 Trading: ${formatINR(tradingInAmt)}`;
    if (pfPill) pfPill.innerHTML = `🛡️ PF: ${formatINR(pfAmt)}`;
    if (capitalPill) capitalPill.innerHTML = `📈 Trading Cap: ${formatINR(tradingOutAmt)}`;
    if (propertyPill) propertyPill.innerHTML = `🏢 Real Estate: ${formatINR(propertyAmt)}`;

    // Title label & Partial month notice
    const titleLabel = document.getElementById('kpi-income-title-label');
    if (titleLabel) {
      titleLabel.textContent = this.incomeMode === 'earned' ? 'EARNED SALARY & YIELD' : 'TOTAL INFLOWS (GROSS)';
    }

    const noticeEl = document.getElementById('income-period-notice');
    const noticeText = document.getElementById('income-period-notice-text');
    const isNov2026 = (this.period === 'monthly' && this.currentDate.getFullYear() === 2026 && this.currentDate.getMonth() === 10);
    if (noticeEl && noticeText) {
      if (isNov2026) {
        noticeEl.classList.remove('hidden');
        noticeText.textContent = "Viewing November 2026 (Nov 01 – Nov 15 statement window). Monthly corporate salary (₹2.48L) is credited around the 30th and has not arrived yet in this statement. Switch period to 'All Time' or select October 2026 to inspect full compensation.";
      } else {
        noticeEl.classList.add('hidden');
      }
    }

    if (badgeEl) {
      badgeEl.textContent = `${savingsRate}%`;
      if (savingsRate >= 30) {
        badgeEl.className = 'font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      } else if (savingsRate >= 15) {
        badgeEl.className = 'font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20';
      } else {
        badgeEl.className = 'font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20';
      }
    }

    const incCountEl = document.getElementById('kpi-income-tx-count');
    const expCountEl = document.getElementById('kpi-expense-tx-count');
    const dailyAvgEl = document.getElementById('kpi-daily-avg-spend');

    if (incCountEl) incCountEl.textContent = `${incomeCount} credits`;
    if (expCountEl) expCountEl.textContent = `${expenseCount} debits`;
    if (dailyAvgEl) dailyAvgEl.textContent = `Avg ${formatINR(dailyAvg)}/day`;

    // Trio Ratios
    const totalExpBase = totalExpense > 0 ? totalExpense : 1;
    const needsPct = Math.round((needsAmt / totalExpBase) * 100);
    const wantsPct = Math.round((wantsAmt / totalExpBase) * 100);
    const luxuryPct = Math.round((luxuryAmt / totalExpBase) * 100);

    const needsPctEl = document.getElementById('kpi-needs-percent');
    const wantsPctEl = document.getElementById('kpi-wants-percent');
    const luxuryPctEl = document.getElementById('kpi-luxury-percent');

    if (needsPctEl) needsPctEl.textContent = `${needsPct}%`;
    if (wantsPctEl) wantsPctEl.textContent = `${wantsPct}%`;
    if (luxuryPctEl) luxuryPctEl.textContent = `${luxuryPct}%`;

    // Quick stats in header
    const qNeeds = document.getElementById('quick-needs-stat');
    const qWants = document.getElementById('quick-wants-stat');
    const qLux = document.getElementById('quick-luxury-stat');
    if (qNeeds) qNeeds.textContent = formatINR(needsAmt);
    if (qWants) qWants.textContent = formatINR(wantsAmt);
    if (qLux) qLux.textContent = formatINR(luxuryAmt);

    // Update navigation tab badges for current timeframe
    const navTxBadge = document.getElementById('nav-tx-badge');
    if (navTxBadge) navTxBadge.textContent = String(txs.length);

    const activeCatCount = new Set(txs.map(t => t.category || t.categoryName)).size;
    const navCatBadge = document.getElementById('nav-cat-badge');
    if (navCatBadge) navCatBadge.textContent = String(activeCatCount);

    // 50/30/20 Progress Bars
    const totalIncBase = totalIncome > 0 ? totalIncome : totalExpense;
    const nIncPct = Math.min(100, Math.round((needsAmt / (totalIncBase || 1)) * 100));
    const wIncPct = Math.min(100, Math.round((wantsAmt / (totalIncBase || 1)) * 100));
    const lIncPct = Math.min(100, Math.round((luxuryAmt / (totalIncBase || 1)) * 100));
    const sIncPct = Math.min(100, Math.max(0, Math.round((netSavings / (totalIncBase || 1)) * 100)));

    const bNeeds = document.getElementById('box-needs-amount');
    const bWants = document.getElementById('box-wants-amount');
    const bLux = document.getElementById('box-luxury-amount');
    const bSav = document.getElementById('box-savings-amount');

    if (bNeeds) bNeeds.textContent = formatINR(needsAmt);
    if (bWants) bWants.textContent = formatINR(wantsAmt);
    if (bLux) bLux.textContent = formatINR(luxuryAmt);
    if (bSav) bSav.textContent = formatINR(netSavings + savingsAmt);

    const barNeeds = document.getElementById('bar-needs');
    const barWants = document.getElementById('bar-wants');
    const barLux = document.getElementById('bar-luxury');
    const barSav = document.getElementById('bar-savings');

    if (barNeeds) barNeeds.style.width = `${nIncPct}%`;
    if (barWants) barWants.style.width = `${wIncPct}%`;
    if (barLux) barLux.style.width = `${lIncPct}%`;
    if (barSav) barSav.style.width = `${sIncPct}%`;

    const pctNeeds = document.getElementById('box-needs-pct');
    const pctWants = document.getElementById('box-wants-pct');
    const pctLux = document.getElementById('box-luxury-pct');
    const pctSav = document.getElementById('box-savings-pct');

    if (pctNeeds) pctNeeds.textContent = `${nIncPct}% of income`;
    if (pctWants) pctWants.textContent = `${wIncPct}% of income`;
    if (pctLux) pctLux.textContent = `${lIncPct}% of income`;
    if (pctSav) pctSav.textContent = `${sIncPct}% retained`;

    // Health tag
    const healthTag = document.getElementById('budget-health-tag');
    if (healthTag) {
      if (luxuryPct > 25 || needsPct > 65) {
        healthTag.textContent = 'High Burn Rate ⚠️';
        healthTag.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 w-fit';
      } else if (savingsRate >= 25) {
        healthTag.textContent = 'Excellent Wealth Builder ✨';
        healthTag.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit';
      } else {
        healthTag.textContent = 'Balanced Budget';
        healthTag.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 w-fit';
      }
    }

    // Call advanced financial intelligence engines
    this.renderSpendForecastAndRunway(txs, totalExpense, needsAmt);
    this.detectAndRenderRecurring(this.transactions);
    this.detectAndRenderAnomalies(txs);
    this.updateSavingsSimulator(this.savingsReductionPct);
    this.renderTaxReadiness(txs);
    this.renderCategoryBudgets();
    this.renderSankeyFlow();
    this.renderMoMComparison();
    this.renderFIREMetrics();
  }

  renderBudgetFramework() {
    const txs = this.getFilteredTransactions();
    let needsAmt = 0;
    let wantsAmt = 0;
    let luxuryAmt = 0;
    let savingsAmt = 0;

    txs.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'expense') {
        if (t.grouping === GROUPINGS.NEED) needsAmt += amt;
        else if (t.grouping === GROUPINGS.WANT) wantsAmt += amt;
        else if (t.grouping === GROUPINGS.LUXURY) luxuryAmt += amt;
        else if (t.grouping === GROUPINGS.SAVINGS) savingsAmt += amt;
        else wantsAmt += amt;
      }
    });

    const bNeeds = document.getElementById('budget-needs-val');
    const bWants = document.getElementById('budget-wants-val');
    const bLux = document.getElementById('budget-luxury-val');
    const bSav = document.getElementById('budget-savings-val');

    if (bNeeds) bNeeds.textContent = formatINR(needsAmt);
    if (bWants) bWants.textContent = formatINR(wantsAmt);
    if (bLux) bLux.textContent = formatINR(luxuryAmt);
    if (bSav) bSav.textContent = formatINR(savingsAmt);
  }

  // --- CHARTS ENGINE (CHART.JS) ---
  renderCharts() {
    if (!window.Chart) return;
    const txs = this.getFilteredTransactions();

    this.renderCashflowChart(txs);
    this.renderTrioDonutChart(txs);
    this.renderCategoriesChart(txs);
    this.renderTopMerchants(txs);
    this.renderIncomeStreamsChart(txs);
    this.renderCapitalVsLivingChart(txs);
    this.renderMultiMonthCashflowChart();
    this.renderCumulativeWealthChart();
    this.renderPaymentRailsChart(txs);
    this.renderDayOfWeekChart(txs);
    this.renderLargeOutliers(txs);
    this.renderMonthlyMatrix();
  }

  renderCashflowChart(txs) {
    const ctx = document.getElementById('chart-cashflow');
    if (!ctx) return;

    // Group by time sub-buckets
    // If monthly: group by days (1 to 31)
    // If yearly: group by month (Jan to Dec)
    // If daily/weekly: group by day of week or hours
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    if (this.period === 'yearly') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 0; m < 12; m++) {
        labels.push(monthNames[m]);
        incomeData.push(0);
        expenseData.push(0);
      }
      txs.forEach(t => {
        const m = new Date(t.date).getMonth();
        if (t.type === 'income') incomeData[m] += Number(t.amount);
        else expenseData[m] += Number(t.amount);
      });
    } else {
      // Monthly or Weekly: show days
      const daysCount = 31;
      for (let d = 1; d <= daysCount; d++) {
        labels.push(`Day ${d}`);
        incomeData.push(0);
        expenseData.push(0);
      }
      txs.forEach(t => {
        const day = new Date(t.date).getDate();
        if (day >= 1 && day <= daysCount) {
          if (t.type === 'income') incomeData[day - 1] += Number(t.amount);
          else expenseData[day - 1] += Number(t.amount);
        }
      });
    }

    if (this.cashflowChart) this.cashflowChart.destroy();

    this.cashflowChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 4,
            barPercentage: 0.6,
          },
          {
            label: 'Expense',
            data: expenseData,
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            borderRadius: 4,
            barPercentage: 0.6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: { color: '#94A3B8', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 10 },
              callback: (val) => val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`
            }
          }
        }
      }
    });
  }

  renderTrioDonutChart(txs) {
    const ctx = document.getElementById('chart-trio-donut');
    if (!ctx) return;

    let needs = 0;
    let wants = 0;
    let luxury = 0;

    txs.forEach(t => {
      if (t.type === 'expense') {
        const amt = Number(t.amount) || 0;
        if (t.grouping === GROUPINGS.NEED) needs += amt;
        else if (t.grouping === GROUPINGS.LUXURY) luxury += amt;
        else wants += amt;
      }
    });

    const hasExpenses = (needs + wants + luxury) > 0;
    const total = (needs + wants + luxury) || 1;
    const pNeed = hasExpenses ? Math.round((needs / total) * 100) : 0;
    const pWant = hasExpenses ? Math.round((wants / total) * 100) : 0;
    const pLux = hasExpenses ? Math.round((luxury / total) * 100) : 0;

    const legendList = document.getElementById('trio-legend-list');
    if (legendList) {
      legendList.innerHTML = `
        <div class="bg-blue-950/30 p-2 rounded-lg border border-blue-900/30">
          <div class="text-[10px] text-blue-400 font-bold uppercase">Needs</div>
          <div class="font-mono text-xs font-bold text-white">${pNeed}%</div>
          <div class="text-[10px] text-slate-400">${formatINR(needs)}</div>
        </div>
        <div class="bg-amber-950/30 p-2 rounded-lg border border-amber-900/30">
          <div class="text-[10px] text-amber-400 font-bold uppercase">Wants</div>
          <div class="font-mono text-xs font-bold text-white">${pWant}%</div>
          <div class="text-[10px] text-slate-400">${formatINR(wants)}</div>
        </div>
        <div class="bg-fuchsia-950/30 p-2 rounded-lg border border-fuchsia-900/30">
          <div class="text-[10px] text-fuchsia-400 font-bold uppercase">Luxury</div>
          <div class="font-mono text-xs font-bold text-white">${pLux}%</div>
          <div class="text-[10px] text-slate-400">${formatINR(luxury)}</div>
        </div>
      `;
    }

    if (this.trioDonutChart) this.trioDonutChart.destroy();

    this.trioDonutChart = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasExpenses ? ['Needs', 'Wants', 'Luxury'] : ['No Expenses Recorded'],
        datasets: [{
          data: hasExpenses ? [needs, wants, luxury] : [1],
          backgroundColor: hasExpenses ? ['#3B82F6', '#F59E0B', '#D946EF'] : ['rgba(51, 65, 85, 0.4)'],
          borderColor: '#0F172A',
          borderWidth: 3,
          hoverOffset: hasExpenses ? 6 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasExpenses,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatINR(ctx.raw)} (${Math.round((ctx.raw / total) * 100)}%)`
            }
          }
        },
        cutout: '72%'
      }
    });
  }

  renderCategoriesChart(txs) {
    const ctx = document.getElementById('chart-categories');
    if (!ctx) return;

    // Aggregate by category for expenses
    const categoryTotals = {};
    txs.forEach(t => {
      if (t.type === 'expense') {
        const cat = t.categoryName || t.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(t.amount) || 0);
      }
    });

    const sorted = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // Top 8

    const hasData = sorted.length > 0;
    const labels = hasData ? sorted.map(s => s[0]) : ['No Expenses in Period'];
    const data = hasData ? sorted.map(s => s[1]) : [0];

    if (this.categoriesChart) this.categoriesChart.destroy();

    this.categoriesChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: hasData ? [
            '#3B82F6', '#10B981', '#F59E0B', '#EC4899',
            '#8B5CF6', '#F43F5E', '#06B6D4', '#64748B'
          ] : ['#334155'],
          borderRadius: 6,
          barPercentage: 0.65
        }]
      },
      options: {
        indexAxis: 'y', // horizontal bar chart
        responsive: true,
        maintainAspectRatio: false,
        onHover: (event, chartElement) => {
          event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        },
        onClick: (evt, elements) => {
          if (elements && elements.length > 0) {
            const idx = elements[0].index;
            const clickedLabel = labels[idx];
            const matchedCat = Object.values(CATEGORIES).find(c => c.name === clickedLabel || c.id === clickedLabel);
            if (matchedCat) {
              this.openCategoryTab(matchedCat.id);
            } else {
              this.switchTab('categories');
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Spent: ${formatINR(ctx.raw)} (Click to view transactions)`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 10 },
              callback: (val) => val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#E2E8F0', font: { size: 11 } }
          }
        }
      }
    });
  }

  renderTopMerchants(txs) {
    const container = document.getElementById('top-merchants-list');
    if (!container) return;

    const merchants = {};
    txs.forEach(t => {
      if (t.type === 'expense') {
        const m = t.merchant || 'Other Payee';
        merchants[m] = (merchants[m] || 0) + (Number(t.amount) || 0);
      }
    });

    const sorted = Object.entries(merchants)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    if (sorted.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-500 py-4 text-center">No merchant expenses recorded.</div>`;
      return;
    }

    container.innerHTML = sorted.map(([name, amt], idx) => {
      const txExample = txs.find(t => (t.merchant || '') === name);
      const meta = getCategoryMeta(txExample ? txExample.category : 'misc', 'expense');
      return `
        <div onclick="window.app.openMerchantProfile('${escapeHtml(name)}')" class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 transition cursor-pointer group" title="Click to view deep-dive merchant intelligence profile">
          <div class="flex items-center space-x-2.5 min-w-0">
            <span class="w-5 h-5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-400 flex items-center justify-center font-mono flex-shrink-0">
              ${idx + 1}
            </span>
            <div class="w-7 h-7 rounded-lg ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm">
              <i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i>
            </div>
            <div class="truncate">
              <div class="text-xs font-semibold text-slate-200 group-hover:text-white truncate">${escapeHtml(name)}</div>
              <div class="text-[10px] text-slate-400 truncate">${escapeHtml(meta.name)}</div>
            </div>
          </div>
          <span class="font-mono text-xs font-bold text-rose-400 ml-2 whitespace-nowrap">${formatINR(amt)}</span>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // --- NEW ADVANCED CHARTS & ANALYTICS ---

  renderIncomeStreamsChart(txs) {
    const ctx = document.getElementById('chart-income-donut');
    if (!ctx) return;

    // Use current filtered incomes or fallback to all incomes if none in current filter
    let incomes = txs.filter(t => t.type === 'income');
    const isFilteredEmpty = (incomes.length === 0);
    if (isFilteredEmpty) {
      incomes = this.transactions.filter(t => t.type === 'income');
    }

    let salary = 0;
    let trading = 0;
    let pf = 0;
    let yieldDividends = 0;
    let otherInflows = 0;

    incomes.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.category === 'salary') salary += amt;
      else if (t.category === 'investment_income') trading += amt;
      else if (t.category === 'pf_retirement') pf += amt;
      else if (t.category === 'dividend' || t.category === 'interest') yieldDividends += amt;
      else otherInflows += amt;
    });

    const total = (salary + trading + pf + yieldDividends + otherInflows) || 1;

    const legend = document.getElementById('income-streams-legend');
    if (legend) {
      legend.innerHTML = `
        <div class="bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/30">
          <div class="text-[9px] text-emerald-400 font-bold uppercase">Salary</div>
          <div class="font-mono text-xs font-bold text-white">${formatINR(salary)}</div>
          <div class="text-[9px] text-slate-400">${Math.round((salary / total) * 100)}%</div>
        </div>
        <div class="bg-blue-950/30 p-2 rounded-lg border border-blue-900/30">
          <div class="text-[9px] text-blue-400 font-bold uppercase">Trading Payouts</div>
          <div class="font-mono text-xs font-bold text-white">${formatINR(trading)}</div>
          <div class="text-[9px] text-slate-400">${Math.round((trading / total) * 100)}%</div>
        </div>
        <div class="bg-purple-950/30 p-2 rounded-lg border border-purple-900/30">
          <div class="text-[9px] text-purple-400 font-bold uppercase">PF Advance</div>
          <div class="font-mono text-xs font-bold text-white">${formatINR(pf)}</div>
          <div class="text-[9px] text-slate-400">${Math.round((pf / total) * 100)}%</div>
        </div>
        <div class="bg-teal-950/30 p-2 rounded-lg border border-teal-900/30">
          <div class="text-[9px] text-teal-400 font-bold uppercase">Yield & Transfers</div>
          <div class="font-mono text-xs font-bold text-white">${formatINR(yieldDividends + otherInflows)}</div>
          <div class="text-[9px] text-slate-400">${Math.round(((yieldDividends + otherInflows) / total) * 100)}%</div>
        </div>
      `;
    }

    if (this.incomeDonutChart) this.incomeDonutChart.destroy();

    this.incomeDonutChart = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Salary', 'Trading Payouts', 'PF Advance', 'Yield & Transfers'],
        datasets: [{
          data: [salary, trading, pf, (yieldDividends + otherInflows)],
          backgroundColor: ['#10B981', '#3B82F6', '#8B5CF6', '#14B8A6'],
          borderColor: '#0F172A',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatINR(ctx.raw)} (${Math.round((ctx.raw / total) * 100)}%)`
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  renderCapitalVsLivingChart(txs) {
    const ctx = document.getElementById('chart-capital-vs-living');
    if (!ctx) return;

    let expenses = txs.filter(t => t.type === 'expense');
    if (expenses.length === 0) {
      expenses = this.transactions.filter(t => t.type === 'expense');
    }

    let tradingCap = 0;
    let realEstate = 0;
    let familyTransfers = 0;
    let livingCosts = 0;

    expenses.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.category === 'trading_investment') tradingCap += amt;
      else if (t.category === 'housing_property' || t.category === 'govt_taxes') realEstate += amt;
      else if (t.category === 'family_support') familyTransfers += amt;
      else livingCosts += amt;
    });

    const total = (tradingCap + realEstate + familyTransfers + livingCosts) || 1;

    const legend = document.getElementById('capital-living-legend');
    if (legend) {
      legend.innerHTML = `
        <div class="bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/30">
          <div class="text-[9px] text-emerald-400 font-bold uppercase">Trading Capital</div>
          <div class="font-mono text-xs font-bold text-white">${formatINR(tradingCap)}</div>
          <div class="text-[9px] text-slate-400">${Math.round((tradingCap / total) * 100)}%</div>
        </div>
        <div class="bg-blue-950/30 p-2 rounded-lg border border-blue-900/30">
          <div class="text-[9px] text-blue-400 font-bold uppercase">Property & Govt Tax</div>
          <div class="font-mono text-xs font-bold text-white">${formatINR(realEstate)}</div>
          <div class="text-[9px] text-slate-400">${Math.round((realEstate / total) * 100)}%</div>
        </div>
        <div class="bg-amber-950/30 p-2 rounded-lg border border-amber-900/30">
          <div class="text-[9px] text-amber-400 font-bold uppercase">Living & Lifestyle</div>
          <div class="font-mono text-xs font-bold text-white">${formatINR(livingCosts + familyTransfers)}</div>
          <div class="text-[9px] text-slate-400">${Math.round(((livingCosts + familyTransfers) / total) * 100)}%</div>
        </div>
      `;
    }

    if (this.capitalLivingChart) this.capitalLivingChart.destroy();

    this.capitalLivingChart = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Trading Capital Inflow', 'Real Estate & Stamp Duty', 'Everyday Living & Family'],
        datasets: [{
          data: [tradingCap, realEstate, (livingCosts + familyTransfers)],
          backgroundColor: ['#22C55E', '#3B82F6', '#F59E0B'],
          borderColor: '#0F172A',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatINR(ctx.raw)} (${Math.round((ctx.raw / total) * 100)}%)`
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  renderMultiMonthCashflowChart() {
    const ctx = document.getElementById('chart-multimonth-cashflow');
    if (!ctx) return;

    // Group all transactions by month
    const monthsData = {};
    const monthOrder = [];

    this.transactions.forEach(t => {
      const ym = t.date.substring(0, 7); // YYYY-MM
      if (!monthsData[ym]) {
        monthsData[ym] = { income: 0, expense: 0, net: 0 };
        monthOrder.push(ym);
      }
      if (t.type === 'income') monthsData[ym].income += Number(t.amount) || 0;
      else monthsData[ym].expense += Number(t.amount) || 0;
    });

    monthOrder.sort();

    const monthLabels = monthOrder.map(ym => {
      const [y, m] = ym.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      return d.toLocaleDateString('default', { month: 'short', year: '2-digit' });
    });

    const incomeSeries = monthOrder.map(ym => monthsData[ym].income);
    const expenseSeries = monthOrder.map(ym => monthsData[ym].expense);
    const netSeries = monthOrder.map(ym => monthsData[ym].income - monthsData[ym].expense);

    if (this.multimonthChart) this.multimonthChart.destroy();

    this.multimonthChart = new window.Chart(ctx, {
      data: {
        labels: monthLabels,
        datasets: [
          {
            type: 'bar',
            label: 'Total Inflows',
            data: incomeSeries,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 6,
            barPercentage: 0.6,
            order: 2
          },
          {
            type: 'bar',
            label: 'Total Outflows',
            data: expenseSeries,
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            borderRadius: 6,
            barPercentage: 0.6,
            order: 2
          },
          {
            type: 'line',
            label: 'Net Surplus / Deficit',
            data: netSeries,
            borderColor: '#818CF8',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#818CF8',
            pointRadius: 4,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: { color: '#94A3B8', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 10 },
              callback: (val) => Math.abs(val) >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`
            }
          }
        }
      }
    });
  }

  renderCumulativeWealthChart() {
    const ctx = document.getElementById('chart-cumulative-wealth');
    const peakBadge = document.getElementById('cumulative-peak-badge');
    if (!ctx) return;

    const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    const monthLabels = ['Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26'];
    const monthlyNet = [0, 0, 0, 0, 0, 0, 0, 0];

    this.transactions.forEach(t => {
      const ym = t.date.substring(0, 7);
      const idx = months.indexOf(ym);
      if (idx !== -1) {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') monthlyNet[idx] += amt;
        else monthlyNet[idx] -= amt;
      }
    });

    let running = 0;
    const cumulativeVals = monthlyNet.map(net => {
      running += net;
      return running;
    });

    const maxVal = Math.max(...cumulativeVals);
    if (peakBadge) {
      peakBadge.textContent = `Peak Retained: ${formatINR(maxVal)}`;
    }

    if (this.cumulativeWealthChart) this.cumulativeWealthChart.destroy();

    this.cumulativeWealthChart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Cumulative Net Surplus',
          data: cumulativeVals,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#0F172A',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Cumulative Balance: ${formatINR(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: { color: '#94A3B8', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 11 },
              callback: (val) => {
                const abs = Math.abs(val);
                const sign = val < 0 ? '-' : '';
                return abs >= 100000 ? `${sign}₹${(abs / 100000).toFixed(1)}L` : (abs >= 1000 ? `${sign}₹${(abs / 1000).toFixed(0)}k` : `${sign}₹${abs}`);
              }
            }
          }
        }
      }
    });
  }

  renderPaymentRailsChart(txs) {
    const ctx = document.getElementById('chart-payment-rails');
    const legendContainer = document.getElementById('payment-rails-legend');
    if (!ctx) return;

    let upiAmt = 0;
    let neftAmt = 0;
    let cardAmt = 0;
    let achAmt = 0;
    let otherAmt = 0;

    txs.forEach(t => {
      if (t.type === 'expense') {
        const amt = Number(t.amount) || 0;
        const narr = (t.narration || '').toUpperCase();
        const mode = (t.mode || '').toUpperCase();

        if (mode.includes('UPI') || narr.startsWith('UPI-') || narr.includes('/UPI/')) {
          upiAmt += amt;
        } else if (mode.includes('NEFT') || mode.includes('IMPS') || mode.includes('NETBANKING') || narr.includes('NETBANKING') || narr.includes('NEFT-') || narr.includes('IMPS-') || narr.includes('TPT-')) {
          neftAmt += amt;
        } else if (mode.includes('ACH') || narr.startsWith('ACH D-')) {
          achAmt += amt;
        } else if (mode.includes('CARD') || mode.includes('POS') || narr.startsWith('POS ')) {
          cardAmt += amt;
        } else {
          otherAmt += amt;
        }
      }
    });

    const totalOut = upiAmt + neftAmt + cardAmt + achAmt + otherAmt || 1;
    const dataVals = [upiAmt, neftAmt, cardAmt, achAmt, otherAmt];
    const labels = ['UPI Rails', 'NetBanking / NEFT', 'Cards & POS', 'ACH Auto-Debit', 'Other Direct'];
    const colors = ['#0EA5E9', '#6366F1', '#EC4899', '#F59E0B', '#64748B'];

    if (this.paymentRailsChart) this.paymentRailsChart.destroy();

    this.paymentRailsChart = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: dataVals,
          backgroundColor: colors,
          borderColor: '#0F172A',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw || 0;
                const pct = Math.round((val / totalOut) * 100);
                return ` ${labels[ctx.dataIndex]}: ${formatINR(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    if (legendContainer) {
      legendContainer.innerHTML = labels.map((lbl, idx) => {
        const val = dataVals[idx];
        const pct = Math.round((val / totalOut) * 100);
        return `
          <div class="flex items-center space-x-2 text-left p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${colors[idx]}"></span>
            <div class="truncate">
              <div class="text-[10px] text-slate-400 truncate">${lbl}</div>
              <div class="font-mono text-xs font-bold text-slate-200">${pct}% <span class="text-[9px] text-slate-500 font-normal">(${formatINR(val)})</span></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  renderDayOfWeekChart(txs) {
    const ctx = document.getElementById('chart-day-of-week');
    if (!ctx) return;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const spendByDay = [0, 0, 0, 0, 0, 0, 0];

    txs.forEach(t => {
      if (t.type === 'expense') {
        const d = new Date(t.date);
        const dayIdx = (d.getDay() + 6) % 7; // Monday = 0
        spendByDay[dayIdx] += (Number(t.amount) || 0);
      }
    });

    if (this.dayOfWeekChart) this.dayOfWeekChart.destroy();

    this.dayOfWeekChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Total Spent',
          data: spendByDay,
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(99, 102, 241, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(244, 63, 94, 0.8)',
            'rgba(245, 158, 11, 0.85)',
            'rgba(249, 115, 22, 0.85)'
          ],
          borderRadius: 6,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatINR(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#CBD5E1', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 10 },
              callback: (val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)
            }
          }
        }
      }
    });
  }

  renderLargeOutliers(txs) {
    const container = document.getElementById('large-outliers-list');
    const badge = document.getElementById('outlier-count-badge');
    if (!container) return;

    // Filter outliers >= ₹25,000 from all transactions
    const outliers = this.transactions
      .filter(t => Number(t.amount) >= 25000)
      .sort((a, b) => Number(b.amount) - Number(a.amount));

    if (badge) badge.textContent = `${outliers.length} Outliers`;

    if (outliers.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-500 py-3 text-center">No transactions &ge; ₹25,000.</div>`;
      return;
    }

    container.innerHTML = outliers.slice(0, 8).map(t => {
      const isIncome = (t.type === 'income');
      const meta = getCategoryMeta(t.category, t.type);
      return `
        <div onclick="window.app.openDrilldownModal('${t.category}')" class="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition flex items-center justify-between group">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm">
              <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
            </div>
            <div class="truncate max-w-[150px] sm:max-w-[170px]">
              <div class="font-bold text-slate-200 text-xs truncate group-hover:text-white">${escapeHtml(t.merchant)}</div>
              <div class="text-[10px] text-slate-400 truncate">${t.date} • <span class="${meta.textClass} font-semibold">${escapeHtml(meta.name)}</span></div>
            </div>
          </div>
          <span class="font-mono text-xs font-extrabold ${isIncome ? 'text-emerald-400' : 'text-rose-400'} ml-2 whitespace-nowrap">
            ${isIncome ? '+' : '-'}${formatINR(t.amount)}
          </span>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  renderMonthlyMatrix() {
    const tbody = document.getElementById('monthly-matrix-body');
    if (!tbody) return;

    const byMonth = {};
    this.transactions.forEach(t => {
      const ym = t.date.substring(0, 7);
      if (!byMonth[ym]) {
        byMonth[ym] = {
          salary: 0,
          otherInflow: 0,
          totalInflow: 0,
          capitalOut: 0,
          livingOut: 0,
          totalOutflow: 0
        };
      }
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        byMonth[ym].totalInflow += amt;
        if (t.category === 'salary') byMonth[ym].salary += amt;
        else byMonth[ym].otherInflow += amt;
      } else {
        byMonth[ym].totalOutflow += amt;
        if (t.category === 'trading_investment' || t.category === 'housing_property' || t.category === 'govt_taxes') {
          byMonth[ym].capitalOut += amt;
        } else {
          byMonth[ym].livingOut += amt;
        }
      }
    });

    const months = Object.keys(byMonth).sort();

    tbody.innerHTML = months.map(ym => {
      const data = byMonth[ym];
      const [y, m] = ym.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const monthName = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
      const surplus = data.totalInflow - data.totalOutflow;

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="p-3 font-bold text-slate-200 whitespace-nowrap">${monthName}</td>
          <td class="p-3 text-emerald-400 whitespace-nowrap">${data.salary > 0 ? formatINR(data.salary) : '<span class="text-slate-600">-</span>'}</td>
          <td class="p-3 text-slate-300 whitespace-nowrap">${formatINR(data.otherInflow)}</td>
          <td class="p-3 font-bold text-emerald-300 whitespace-nowrap">${formatINR(data.totalInflow)}</td>
          <td class="p-3 text-blue-400 whitespace-nowrap">${formatINR(data.capitalOut)}</td>
          <td class="p-3 text-amber-400 whitespace-nowrap">${formatINR(data.livingOut)}</td>
          <td class="p-3 font-bold text-rose-300 whitespace-nowrap">${formatINR(data.totalOutflow)}</td>
          <td class="p-3 text-right font-bold whitespace-nowrap ${surplus >= 0 ? 'text-indigo-400' : 'text-rose-400'}">
            ${surplus >= 0 ? '+' : ''}${formatINR(surplus)}
          </td>
          <td class="p-3 text-center whitespace-nowrap">
            <button onclick="window.app.jumpToSpecificMonth(${parseInt(y)}, ${parseInt(m) - 1})" class="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-bold transition">
              Inspect
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- CATEGORIES & INSTANT TIMEFRAME DRILL-DOWN ENGINE ---

  openCategoryTab(catId) {
    if (catId) {
      this.selectedCategoryForDrilldown = catId;
      this.categoryViewAllTime = false;
    }
    this.switchTab('categories');
  }

  selectCategoryForDrilldown(catId) {
    this.selectedCategoryForDrilldown = catId;
    this.categoryViewAllTime = false;
    this.renderCategoriesTab();
  }

  setCategoryTabFilter(filter) {
    this.categoryTabFilter = filter;
    
    // Update chip styling
    const chips = ['expense', 'need', 'want', 'luxury', 'savings', 'income'];
    chips.forEach(c => {
      const el = document.getElementById(`chip-cat-${c}`);
      if (el) {
        if (c === filter) {
          el.className = 'px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white transition shadow shadow-indigo-600/25 border border-indigo-400/30';
        } else {
          el.className = 'px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition';
        }
      }
    });

    this.renderCategoriesTab();
  }

  onCategorySearch(val) {
    this.categorySearch = (val || '').trim().toLowerCase();
    this.renderCategoriesTab();
  }

  renderCategoriesTab() {
    const cardsContainer = document.getElementById('category-cards-container');
    const detailPanel = document.getElementById('category-detail-panel');
    const timeframeBadge = document.getElementById('cat-tab-timeframe-badge');
    const totalSpendEl = document.getElementById('cat-tab-total-spend');
    const activeCountEl = document.getElementById('cat-tab-active-count');
    const navCatBadge = document.getElementById('nav-cat-badge');

    if (!cardsContainer || !detailPanel) return;

    // Get transactions for currently selected timeframe
    const currentPeriodTxs = this.getFilteredTransactions();
    const periodDisplay = document.getElementById('current-period-display')?.textContent.trim() || 'Current Timeframe';
    
    if (timeframeBadge) {
      timeframeBadge.textContent = this.period === 'all' ? 'All Time Statement History' : periodDisplay;
    }

    // Calculate total period expense
    const periodExpenses = currentPeriodTxs.filter(t => t.type === 'expense');
    const totalPeriodExpense = periodExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    if (totalSpendEl) totalSpendEl.textContent = formatINR(totalPeriodExpense);

    // Build stats for EVERY category in the dictionary
    const allCategoriesList = Object.values(CATEGORIES);

    const categoryStats = allCategoriesList.map(cat => {
      const meta = getCategoryMeta(cat.id, cat.type);

      // Period transactions
      const pTxs = currentPeriodTxs.filter(t => t.category === cat.id || t.categoryName === cat.name);
      const pTotal = pTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const pCount = pTxs.length;

      // All-time transactions
      const aTxs = this.transactions.filter(t => t.category === cat.id || t.categoryName === cat.name);
      const aTotal = aTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const aCount = aTxs.length;

      return {
        ...cat,
        ...meta,
        pTotal,
        pCount,
        pTxs,
        aTotal,
        aCount,
        aTxs
      };
    });

    const activePeriodCategories = categoryStats.filter(c => c.pCount > 0);
    if (navCatBadge) navCatBadge.textContent = String(activePeriodCategories.length);

    // Filter categories based on categoryTabFilter AND require > 0 transactions in current timeframe
    let filtered = categoryStats.filter(c => {
      // REQUIREMENT: Show the categories ONLY if it has more than 0 transactions in the selected timeframe!
      if (c.pCount <= 0) return false;

      if (this.categoryTabFilter === 'expense') return c.type === 'expense';
      if (this.categoryTabFilter === 'income') return c.type === 'income';
      if (this.categoryTabFilter === 'need') return c.defaultGrouping === GROUPINGS.NEED;
      if (this.categoryTabFilter === 'want') return c.defaultGrouping === GROUPINGS.WANT;
      if (this.categoryTabFilter === 'luxury') return c.defaultGrouping === GROUPINGS.LUXURY;
      if (this.categoryTabFilter === 'savings') return c.defaultGrouping === GROUPINGS.SAVINGS;
      return true;
    });

    // Apply search filter if present
    if (this.categorySearch) {
      const q = this.categorySearch;
      filtered = filtered.filter(c => {
        return c.name.toLowerCase().includes(q) ||
               c.id.toLowerCase().includes(q) ||
               (c.defaultGrouping && c.defaultGrouping.toLowerCase().includes(q)) ||
               c.pTxs.some(t => (t.merchant || '').toLowerCase().includes(q));
      });
    }

    // Sort categories: Period spend descending, then all-time spend descending
    filtered.sort((a, b) => {
      if (b.pTotal !== a.pTotal) return b.pTotal - a.pTotal;
      if (b.pCount !== a.pCount) return b.pCount - a.pCount;
      return b.aTotal - a.aTotal;
    });

    if (activeCountEl) activeCountEl.textContent = `${filtered.length} active`;

    // Select default category if none or filtered out
    if (!this.selectedCategoryForDrilldown || !filtered.some(c => c.id === this.selectedCategoryForDrilldown)) {
      if (filtered.length > 0) {
        this.selectedCategoryForDrilldown = filtered[0].id;
      } else {
        this.selectedCategoryForDrilldown = null;
      }
    }

    // 1. RENDER LEFT COLUMN (CATEGORY CARDS)
    if (filtered.length === 0) {
      cardsContainer.innerHTML = `
        <div class="p-8 text-center text-xs text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
          <div class="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <i data-lucide="inbox" class="w-5 h-5"></i>
          </div>
          <div class="font-bold text-slate-200">No Categories with Transactions</div>
          <p class="text-[11px] text-slate-400">
            ${this.categorySearch ? `No categories match "${escapeHtml(this.categorySearch)}".` : `No transactions recorded under this filter for ${escapeHtml(periodDisplay)}.`}
          </p>
        </div>
      `;
    } else {
      cardsContainer.innerHTML = filtered.map(cat => {
        const isSelected = (cat.id === this.selectedCategoryForDrilldown);
        const pctOfTotal = (totalPeriodExpense > 0 && cat.type === 'expense') ? Math.round((cat.pTotal / totalPeriodExpense) * 100) : 0;

        let groupBadge = 'bg-slate-800 text-slate-400 border-slate-700';
        const grp = cat.defaultGrouping || cat.grouping;
        if (grp === GROUPINGS.NEED) groupBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        else if (grp === GROUPINGS.WANT) groupBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        else if (grp === GROUPINGS.LUXURY) groupBadge = 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
        else if (grp === GROUPINGS.SAVINGS) groupBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        else if (cat.type === 'income') groupBadge = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

        return `
          <div onclick="window.app.selectCategoryForDrilldown('${cat.id}')" 
               class="category-card p-3.5 rounded-2xl border cursor-pointer transition ${isSelected ? 'selected-category' : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80'}">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3 min-w-0">
                <!-- Squircle Icon -->
                <div class="w-10 h-10 rounded-xl ${cat.bgClass} ${cat.borderClass} ${cat.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm">
                  <i data-lucide="${cat.icon}" class="w-5 h-5"></i>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-slate-100 text-xs sm:text-sm truncate flex items-center space-x-1.5">
                    <span class="truncate">${escapeHtml(cat.name)}</span>
                    ${isSelected ? '<span class="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0 animate-pulse"></span>' : ''}
                  </div>
                  <div class="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-400">
                    <span class="px-2 py-0.2 rounded-md text-[10px] font-bold border ${groupBadge}">${grp || (cat.type === 'income' ? 'Income' : 'Want')}</span>
                    <span>•</span>
                    <span class="font-mono text-[10px] text-slate-300 font-medium">${cat.pCount} txs in timeframe</span>
                  </div>
                </div>
              </div>

              <!-- Amount & Share -->
              <div class="text-right flex-shrink-0 ml-3">
                <div class="font-mono text-sm sm:text-base font-extrabold ${cat.type === 'income' ? 'text-emerald-400' : (cat.pTotal > 0 ? 'text-rose-400' : 'text-slate-500')}">
                  ${cat.pTotal > 0 ? (cat.type === 'income' ? '+' : '-') + formatINR(cat.pTotal) : '₹0'}
                </div>
                <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                  ${cat.pTotal > 0 ? `<span class="text-indigo-300 font-semibold">${pctOfTotal}% of spend</span>` : `<span class="text-slate-500">All-time: ${formatINR(cat.aTotal)}</span>`}
                </div>
              </div>
            </div>

            <!-- Spending Progress Bar -->
            ${(cat.pTotal > 0 && cat.type === 'expense') ? `
              <div class="w-full bg-slate-800/80 rounded-full h-1.5 mt-3 overflow-hidden">
                <div class="h-1.5 rounded-full ${pctOfTotal > 30 ? 'bg-rose-500' : (pctOfTotal > 15 ? 'bg-amber-500' : 'bg-indigo-500')} transition-all duration-500" style="width: ${Math.min(100, Math.max(3, pctOfTotal))}%"></div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    // 2. RENDER RIGHT COLUMN (SELECTED CATEGORY TRANSACTION DRILLDOWN)
    const activeCategory = categoryStats.find(c => c.id === this.selectedCategoryForDrilldown);

    if (!activeCategory) {
      detailPanel.innerHTML = `
        <div class="p-12 text-center text-slate-500 text-xs">
          Select any category on the left to inspect all transactions.
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const showAllTime = this.categoryViewAllTime;
    const txsToDisplay = showAllTime ? activeCategory.aTxs : activeCategory.pTxs;
    const isIncome = (activeCategory.type === 'income');
    const totalVolume = txsToDisplay.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const avgTicket = txsToDisplay.length > 0 ? Math.round(totalVolume / txsToDisplay.length) : 0;
    const shareOfExpense = totalPeriodExpense > 0 ? Math.round((activeCategory.pTotal / totalPeriodExpense) * 100) : 0;

    let groupBadge = 'bg-slate-800 text-slate-400 border-slate-700';
    const grp = activeCategory.defaultGrouping || activeCategory.grouping;
    if (grp === GROUPINGS.NEED) groupBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    else if (grp === GROUPINGS.WANT) groupBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    else if (grp === GROUPINGS.LUXURY) groupBadge = 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
    else if (grp === GROUPINGS.SAVINGS) groupBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    else if (activeCategory.type === 'income') groupBadge = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

    detailPanel.innerHTML = `
      <!-- Category Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div class="flex items-center space-x-3.5">
          <div class="w-12 h-12 rounded-2xl ${activeCategory.bgClass} ${activeCategory.borderClass} ${activeCategory.textClass} border flex items-center justify-center cat-avatar shadow-lg shadow-indigo-500/10 flex-shrink-0">
            <i data-lucide="${activeCategory.icon}" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h2 class="text-lg font-bold text-white tracking-tight">${escapeHtml(activeCategory.name)}</h2>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold border ${groupBadge}">
                ${grp || (isIncome ? 'Income' : 'Want')}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              ${showAllTime ? 'Viewing All-Time Statement Records' : `Viewing ${periodDisplay} (${activeCategory.pCount} records)`}
            </p>
          </div>
        </div>

        <!-- Timeframe Toggle Pill -->
        <div class="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button onclick="window.app.categoryViewAllTime = false; window.app.renderCategoriesTab();" class="px-3 py-1 rounded-lg text-xs font-semibold transition ${!showAllTime ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}">
            Selected Timeframe (${activeCategory.pCount})
          </button>
          <button onclick="window.app.categoryViewAllTime = true; window.app.renderCategoriesTab();" class="px-3 py-1 rounded-lg text-xs font-semibold transition ${showAllTime ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}">
            All-Time (${activeCategory.aCount})
          </button>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Volume</span>
          <div class="font-mono text-lg font-extrabold ${isIncome ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">
            ${isIncome ? '+' : '-'}${formatINR(totalVolume)}
          </div>
        </div>
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transactions</span>
          <div class="font-mono text-lg font-extrabold text-indigo-400 mt-0.5">
            ${txsToDisplay.length}
          </div>
        </div>
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Ticket</span>
          <div class="font-mono text-lg font-extrabold text-slate-200 mt-0.5">
            ${formatINR(avgTicket)}
          </div>
        </div>
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Share of Outflows</span>
          <div class="font-mono text-lg font-extrabold text-amber-400 mt-0.5">
            ${shareOfExpense}%
          </div>
        </div>
      </div>

      <!-- Transactions List for this Category -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
            <i data-lucide="receipt" class="w-3.5 h-3.5 text-indigo-400"></i>
            <span>Transaction Records (${txsToDisplay.length})</span>
          </h4>
          <span class="text-[11px] text-slate-400 font-mono">Sorted newest to oldest</span>
        </div>

        ${txsToDisplay.length === 0 ? `
          <div class="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div class="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <i data-lucide="inbox" class="w-6 h-6"></i>
            </div>
            <div>
              <h5 class="text-sm font-bold text-slate-200">No Transactions in ${periodDisplay}</h5>
              <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No spending was recorded under <strong>${escapeHtml(activeCategory.name)}</strong> in this period.
                ${activeCategory.aCount > 0 ? `This category has <strong>${activeCategory.aCount} transactions</strong> (Total: <strong>${formatINR(activeCategory.aTotal)}</strong>) in other statement months.` : ''}
              </p>
            </div>
            ${activeCategory.aCount > 0 ? `
              <button onclick="window.app.categoryViewAllTime = true; window.app.renderCategoriesTab();" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow">
                View All-Time Records (${activeCategory.aCount} transactions) &rarr;
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="max-h-[500px] overflow-y-auto border border-slate-800/80 rounded-2xl divide-y divide-slate-800/60 bg-slate-950/60">
            ${txsToDisplay.map(t => {
              const isTxIncome = (t.type === 'income');
              return `
                <div class="p-3.5 hover:bg-slate-900/80 transition flex items-center justify-between group">
                  <div class="flex items-center space-x-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl ${activeCategory.bgClass} ${activeCategory.borderClass} ${activeCategory.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm">
                      <i data-lucide="${activeCategory.icon}" class="w-4 h-4"></i>
                    </div>
                    <div class="min-w-0">
                      <div class="font-bold text-slate-100 text-xs sm:text-sm truncate group-hover:text-white flex items-center space-x-1.5">
                        <span class="truncate">${escapeHtml(t.merchant || 'Payee')}</span>
                        ${t.confidence === 'high' ? '<span title="High confidence categorization" class="text-blue-400 text-[10px]">⚡</span>' : ''}
                      </div>
                      <div class="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md" title="${escapeHtml(t.narration)}">
                        <span class="font-mono text-slate-300 font-medium">${t.date}</span> • <span class="text-slate-300">${escapeHtml(t.mode || 'UPI')}</span> • ${escapeHtml(t.narration || '')}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center space-x-3 ml-3 flex-shrink-0">
                    <span class="font-mono text-xs sm:text-sm font-extrabold ${isTxIncome ? 'text-emerald-400' : 'text-rose-400'} whitespace-nowrap">
                      ${isTxIncome ? '+' : '-'}${formatINR(t.amount)}
                    </span>
                    <div class="hidden sm:flex items-center space-x-1">
                      <button onclick="window.app.openChangeCategoryModal('${t.id}')" title="Change Category" class="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition">
                        <i data-lucide="tag" class="w-3.5 h-3.5"></i>
                      </button>
                      <button onclick="window.app.openEditTxModal('${t.id}')" title="Edit" class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                      </button>
                      <button onclick="window.app.deleteTransaction('${t.id}')" title="Delete" class="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // --- INTERACTIVE DRILL-DOWN ENGINE ---

  openDrilldownModal(target) {
    const modal = document.getElementById('modal-drilldown');
    const title = document.getElementById('drilldown-title');
    const subtitle = document.getElementById('drilldown-subtitle');
    const badge = document.getElementById('drilldown-badge');
    const metricTotal = document.getElementById('drilldown-metric-total');
    const metricCount = document.getElementById('drilldown-metric-count');
    const metricAvg = document.getElementById('drilldown-metric-avg');
    const metricPct = document.getElementById('drilldown-metric-pct');
    const searchInput = document.getElementById('drilldown-search-input');

    if (searchInput) searchInput.value = '';

    let items = [];
    let modalTitle = 'Category Drilldown';
    let modalSubtitle = 'Sub-transactions and merchant distribution';
    let badgeText = 'Deep Dive';
    let baseFlowTotal = 1;

    const allIncomes = this.transactions.filter(t => t.type === 'income');
    const allExpenses = this.transactions.filter(t => t.type === 'expense');
    const totalInflow = allIncomes.reduce((s, t) => s + (Number(t.amount) || 0), 0) || 1;
    const totalOutflow = allExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0) || 1;

    if (target === 'income') {
      items = allIncomes;
      modalTitle = 'Income Streams & Inflows';
      modalSubtitle = 'Complete breakdown of salaries, trading payouts, PF advance & dividends';
      badgeText = 'Inflows Deep Dive';
      baseFlowTotal = totalInflow;
    } else if (target === 'expense' || target === 'all_categories') {
      items = allExpenses;
      modalTitle = 'Total Outflows & Expenditures';
      modalSubtitle = 'Detailed inspection across all 749 debit transactions';
      badgeText = 'Expenses Deep Dive';
      baseFlowTotal = totalOutflow;
    } else if (target === 'savings' || target === 'capital') {
      items = allExpenses.filter(t => t.category === 'trading_investment' || t.category === 'housing_property');
      modalTitle = 'Capital Inflows & Wealth Assets';
      modalSubtitle = 'Trading deposits (Fyers, Dhan) and real estate flat purchases';
      badgeText = 'Capital Deep Dive';
      baseFlowTotal = totalOutflow;
    } else if (target === 'trio') {
      items = allExpenses;
      modalTitle = 'Needs, Wants & Luxury Allocation';
      modalSubtitle = 'Examine how spending maps to survival needs, lifestyle wants, and splurges';
      badgeText = 'Trio Deep Dive';
      baseFlowTotal = totalOutflow;
    } else {
      // Specific Category ID or Name
      items = this.transactions.filter(t => t.category === target || t.categoryName === target);
      if (items.length === 0) {
        items = this.transactions.filter(t => (t.merchant || '').toLowerCase().includes(target.toLowerCase()));
      }
      const catObj = Object.values(CATEGORIES).find(c => c.id === target || c.name === target);
      modalTitle = catObj ? catObj.name : `Drilldown: ${target}`;
      modalSubtitle = `Detailed view of all transactions for ${modalTitle}`;
      badgeText = catObj ? catObj.type.toUpperCase() : 'CATEGORY';
      baseFlowTotal = (items[0] && items[0].type === 'income') ? totalInflow : totalOutflow;
    }

    this.currentDrilldownItems = items;

    // Calculate stats
    const totalVolume = items.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const count = items.length;
    const avgTicket = count > 0 ? Math.round(totalVolume / count) : 0;
    const pct = Math.round((totalVolume / baseFlowTotal) * 100);

    if (title) title.textContent = modalTitle;
    if (subtitle) subtitle.textContent = modalSubtitle;
    if (badge) badge.textContent = badgeText;
    if (metricTotal) metricTotal.textContent = formatINR(totalVolume);
    if (metricCount) metricCount.textContent = `${count}`;
    if (metricAvg) metricAvg.textContent = formatINR(avgTicket);
    if (metricPct) metricPct.textContent = `${pct}%`;

    // Dynamic header icon & style
    const iconBox = document.getElementById('drilldown-icon-box');
    const isTargetIncome = (target === 'income' || (items[0] && items[0].type === 'income'));
    const meta = getCategoryMeta(target, isTargetIncome ? 'income' : 'expense');
    if (iconBox) {
      iconBox.className = `w-10 h-10 rounded-xl ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center cat-avatar shadow-sm`;
      iconBox.innerHTML = `<i data-lucide="${meta.icon}" class="w-5 h-5"></i>`;
    }

    this.renderDrilldownTrajectory(items);
    this.populateDrilldownTable(items);

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  renderDrilldownTrajectory(items) {
    const ctx = document.getElementById('chart-drilldown-trajectory');
    if (!ctx) return;

    // Aggregate monthly for this subset
    const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    const monthLabels = ['Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26'];
    const monthlyVals = [0, 0, 0, 0, 0, 0, 0, 0];

    items.forEach(t => {
      const ym = t.date.substring(0, 7);
      const idx = months.indexOf(ym);
      if (idx !== -1) {
        monthlyVals[idx] += (Number(t.amount) || 0);
      }
    });

    if (this.drilldownTrajectoryChart) this.drilldownTrajectoryChart.destroy();

    this.drilldownTrajectoryChart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Volume',
          data: monthlyVals,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#10B981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Volume: ${formatINR(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: { color: '#94A3B8', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 10 },
              callback: (val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)
            }
          }
        }
      }
    });
  }

  populateDrilldownTable(items) {
    const listEl = document.getElementById('drilldown-tx-list');
    const footerInfo = document.getElementById('drilldown-footer-info');
    if (!listEl) return;

    if (footerInfo) footerInfo.textContent = `Showing ${items.length} sub-transactions`;

    if (items.length === 0) {
      listEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-500">No records found.</div>`;
      return;
    }

    listEl.innerHTML = items.map(t => {
      const isIncome = (t.type === 'income');
      const meta = getCategoryMeta(t.category, t.type);
      return `
        <div class="p-3 hover:bg-slate-900 transition flex items-center justify-between">
          <div class="flex items-center space-x-3 min-w-0">
            <div class="w-8 h-8 rounded-xl ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm">
              <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
            </div>
            <div class="truncate max-w-[280px] sm:max-w-md">
              <div class="font-bold text-slate-200 text-xs truncate">${escapeHtml(t.merchant)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5 truncate">${t.date} • <span class="${meta.textClass} font-semibold">${escapeHtml(meta.name)}</span> • <span class="text-indigo-400 font-medium">${t.grouping}</span> • ${escapeHtml(t.narration)}</div>
            </div>
          </div>
          <div class="flex items-center space-x-2 ml-3 flex-shrink-0">
            <span class="font-mono text-xs font-extrabold whitespace-nowrap ${isIncome ? 'text-emerald-400' : 'text-rose-400'}">
              ${isIncome ? '+' : '-'}${formatINR(t.amount)}
            </span>
            <button onclick="window.app.openChangeCategoryModal('${t.id}')" title="Change Category" class="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition">
              <i data-lucide="tag" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  filterDrilldownTable(query) {
    if (!this.currentDrilldownItems) return;
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.populateDrilldownTable(this.currentDrilldownItems);
      return;
    }
    const filtered = this.currentDrilldownItems.filter(t => {
      return (t.merchant || '').toLowerCase().includes(q) ||
             (t.narration || '').toLowerCase().includes(q) ||
             (t.categoryName || '').toLowerCase().includes(q) ||
             String(t.amount).includes(q) ||
             t.date.includes(q);
    });
    this.populateDrilldownTable(filtered);
  }

  closeDrilldownModal() {
    const modal = document.getElementById('modal-drilldown');
    if (modal) modal.classList.add('hidden');
  }

  // --- CALENDAR HEAT MAP (REQUIREMENT 5) ---
  renderHeatmap() {
    const gridContainer = document.getElementById('calendar-heatmap-grid');
    if (!gridContainer) return;

    // Aggregate daily expenses
    const dailySpend = {};
    const dailyTxCount = {};
    const dailyItems = {};

    this.transactions.forEach(t => {
      if (t.type === 'expense') {
        const d = t.date;
        const amt = Number(t.amount) || 0;
        dailySpend[d] = (dailySpend[d] || 0) + amt;
        dailyTxCount[d] = (dailyTxCount[d] || 0) + 1;
        if (!dailyItems[d]) dailyItems[d] = [];
        dailyItems[d].push(t);
      }
    });

    // Build Monthly Grid for the current selected month
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

    const monthName = firstDay.toLocaleString('default', { month: 'long' });

    let html = `
      <div class="mb-4 flex items-center justify-between">
        <h4 class="text-sm font-bold text-slate-200">${monthName} ${year} — Daily Breakdown</h4>
        <span class="text-xs text-slate-400">Total days: ${daysInMonth}</span>
      </div>
      <div class="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-2">
        <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
      </div>
      <div class="grid grid-cols-7 gap-2">
    `;

    // Blank cells before day 1
    for (let i = 0; i < startingDayOfWeek; i++) {
      html += `<div class="h-20 rounded-xl bg-slate-950/40 border border-slate-900"></div>`;
    }

    // Days 1 through daysInMonth
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const spend = dailySpend[dStr] || 0;
      const count = dailyTxCount[dStr] || 0;

      // Color intensity
      let bgClass = 'bg-slate-900 border-slate-800 text-slate-400';
      if (spend > 15000) {
        bgClass = 'bg-rose-950/80 border-rose-600/80 text-rose-300';
      } else if (spend > 5000) {
        bgClass = 'bg-amber-950/80 border-amber-600/80 text-amber-300';
      } else if (spend > 1500) {
        bgClass = 'bg-indigo-950/80 border-indigo-600/80 text-indigo-300';
      } else if (spend > 0) {
        bgClass = 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300';
      }

      html += `
        <div onclick="window.app.onHeatmapDayClick('${dStr}')" class="heatmap-cell h-20 p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition ${bgClass} hover:border-indigo-400">
          <div class="flex items-center justify-between text-xs font-bold">
            <span>${day}</span>
            ${count > 0 ? `<span class="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800/80">${count}</span>` : ''}
          </div>
          <div class="text-right">
            ${spend > 0 ? `<div class="font-mono text-xs font-extrabold tracking-tight">${formatINR(spend)}</div>` : `<span class="text-[10px] text-slate-600">₹0</span>`}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    gridContainer.innerHTML = html;
  }

  onHeatmapDayClick(dateStr) {
    this.selectedHeatmapDate = dateStr;
    const drawer = document.getElementById('heatmap-day-details');
    const dateTitle = document.getElementById('heatmap-selected-date');
    const totalEl = document.getElementById('heatmap-selected-total');
    const txList = document.getElementById('heatmap-day-tx-list');

    if (!drawer) return;

    const dayTxs = this.transactions.filter(t => t.date === dateStr);
    const dayExpense = dayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    drawer.classList.remove('hidden');
    if (dateTitle) dateTitle.textContent = `Activity on ${dateStr}`;
    if (totalEl) totalEl.textContent = `${formatINR(dayExpense)} Total Spent`;

    if (txList) {
      if (dayTxs.length === 0) {
        txList.innerHTML = `<div class="col-span-3 text-xs text-slate-500 py-3">No transactions recorded on this day.</div>`;
      } else {
        txList.innerHTML = dayTxs.map(t => {
          const meta = getCategoryMeta(t.category, t.type);
          return `
            <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
              <div class="flex items-center space-x-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm">
                  <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
                </div>
                <div class="truncate max-w-[170px]">
                  <div class="font-bold text-slate-200 truncate">${escapeHtml(t.merchant || t.narration)}</div>
                  <div class="text-[10px] text-slate-400 truncate">${escapeHtml(meta.name)} • <span class="text-indigo-400 font-medium">${t.grouping}</span></div>
                </div>
              </div>
              <span class="font-mono font-bold whitespace-nowrap ml-2 ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
                ${t.type === 'income' ? '+' : '-'}${formatINR(t.amount)}
              </span>
            </div>
          `;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  // --- TRANSACTIONS RECORD TABLE (REQUIREMENT 1, 2, 7) ---
  renderTransactionsTable() {
    const tbody = document.getElementById('tx-table-body');
    const emptyState = document.getElementById('tx-table-empty');
    const countIndicator = document.getElementById('tx-count-indicator');
    const navBadge = document.getElementById('nav-tx-badge');

    if (!tbody) return;

    let list = this.getFilteredTransactions();

    // Sort list
    list.sort((a, b) => {
      let valA = a[this.sort.field];
      let valB = b[this.sort.field];
      if (this.sort.field === 'amount') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }
      if (valA < valB) return this.sort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return this.sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    if (countIndicator) countIndicator.textContent = `Showing ${list.length} of ${this.transactions.length} transactions`;
    if (navBadge) navBadge.textContent = String(this.transactions.length);

    if (list.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = list.map(t => {
      const isChecked = this.selectedIds.has(t.id);
      const isIncome = t.type === 'income';
      const meta = getCategoryMeta(t.category, t.type);

      // Grouping pill color
      let groupBadge = 'bg-slate-800 text-slate-300 border-slate-700';
      if (t.grouping === GROUPINGS.NEED) groupBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      else if (t.grouping === GROUPINGS.WANT) groupBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      else if (t.grouping === GROUPINGS.LUXURY) groupBadge = 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
      else if (t.grouping === GROUPINGS.SAVINGS) groupBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      else if (t.grouping === GROUPINGS.INCOME) groupBadge = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="p-3.5 text-center">
            <input type="checkbox" onchange="window.app.toggleSelectTx('${t.id}', this.checked)" ${isChecked ? 'checked' : ''} class="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0">
          </td>
          <td class="p-3.5 font-mono text-slate-300 whitespace-nowrap">${t.date}</td>
          <td class="p-3.5">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 rounded-xl ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm">
                <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
              </div>
              <div class="min-w-0">
                <div class="font-bold text-slate-100 flex items-center space-x-1.5 truncate">
                  <span class="truncate hover:text-indigo-400 hover:underline cursor-pointer transition" title="Click to view deep-dive merchant profile" onclick="event.stopPropagation(); window.app.openMerchantProfile('${escapeHtml(t.merchant || '')}')">${escapeHtml(t.merchant || 'Unclassified Payee')}</span>
                  ${t.confidence === 'high' ? '<span title="High confidence auto-categorization" class="text-blue-400 text-[10px]">⚡</span>' : ''}
                </div>
                <div class="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md" title="${escapeHtml(t.narration)}">
                  ${escapeHtml(t.narration || '')}
                </div>
              </div>
            </div>
          </td>
          <td class="p-3.5 whitespace-nowrap">
            <button onclick="window.app.openChangeCategoryModal('${t.id}')" class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.bgClass} ${meta.textClass} border ${meta.borderClass} hover:brightness-125 hover:border-indigo-400/50 transition cursor-pointer group" title="Click to change category">
              <i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i>
              <span>${escapeHtml(meta.name || t.categoryName || 'General')}</span>
              <i data-lucide="pencil" class="w-3 h-3 opacity-40 group-hover:opacity-100 group-hover:text-indigo-300 ml-0.5 transition"></i>
            </button>
          </td>
          <td class="p-3.5 whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${groupBadge}">
              ${t.grouping || 'Want'}
            </span>
          </td>
          <td class="p-3.5 text-right font-mono font-bold whitespace-nowrap ${isIncome ? 'text-emerald-400' : 'text-rose-400'}">
            ${isIncome ? '+' : '-'}${formatINR(t.amount)}
          </td>
          <td class="p-3.5 text-center whitespace-nowrap">
            <div class="inline-flex items-center space-x-1">
              <button onclick="window.app.openChangeCategoryModal('${t.id}')" title="Change Category" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition">
                <i data-lucide="tag" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="window.app.openSplitModal('${t.id}')" title="Split Bill with Friends" class="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-slate-800 transition">
                <i data-lucide="users" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="window.app.promptCreateRuleFromTx('${escapeHtml(t.narration)}', '${escapeHtml(t.merchant)}', '${t.category}', '${t.grouping}')" title="Create Custom Rule from this Payee" class="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition">
                <i data-lucide="sliders" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="window.app.openEditTxModal('${t.id}')" title="Edit Transaction" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="window.app.deleteTransaction('${t.id}')" title="Delete Transaction" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.updateBulkBar();
    if (window.lucide) window.lucide.createIcons();
  }

  toggleSelectTx(id, checked) {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
    this.updateBulkBar();
  }

  toggleSelectAll(checked) {
    const list = this.getFilteredTransactions();
    if (checked) {
      list.forEach(t => this.selectedIds.add(t.id));
    } else {
      this.selectedIds.clear();
    }
    this.renderTransactionsTable();
  }

  updateBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    const countEl = document.getElementById('bulk-selected-count');
    if (!bar) return;

    if (this.selectedIds.size > 0) {
      bar.classList.remove('hidden');
      if (countEl) countEl.textContent = `${this.selectedIds.size} transactions selected`;
    } else {
      bar.classList.add('hidden');
    }
  }

  async bulkDeleteSelected() {
    if (!confirm(`Delete ${this.selectedIds.size} selected transactions?`)) return;
    try {
      const res = await fetch('/api/transactions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(this.selectedIds) })
      });
      const data = await res.json();
      if (data.success) {
        this.selectedIds.clear();
        await this.fetchTransactions();
        this.renderAll();
      }
    } catch (err) {
      alert('Failed to delete transactions: ' + err.message);
    }
  }

  async bulkRecategorizePrompt() {
    const newGrouping = prompt('Enter new Grouping (Need / Want / Luxury / Savings):', 'Want');
    if (!newGrouping) return;

    const valid = [GROUPINGS.NEED, GROUPINGS.WANT, GROUPINGS.LUXURY, GROUPINGS.SAVINGS, GROUPINGS.INCOME];
    const match = valid.find(v => v.toLowerCase() === newGrouping.trim().toLowerCase());
    if (!match) {
      alert('Invalid grouping! Choose Need, Want, Luxury, or Savings.');
      return;
    }

    // Update locally and persist
    for (const id of this.selectedIds) {
      const tx = this.transactions.find(t => t.id === id);
      if (tx) {
        tx.grouping = match;
        await fetch(`/api/transactions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grouping: match })
        });
      }
    }

    this.selectedIds.clear();
    this.renderAll();
  }

  // --- CHANGE CATEGORY ENGINE & MODAL ---

  openChangeCategoryModal(target) {
    if (!target) return;

    if (Array.isArray(target)) {
      this.changeCategoryTargetIds = target;
    } else {
      this.changeCategoryTargetIds = [target];
    }

    const modal = document.getElementById('modal-change-category');
    if (!modal) return;

    const titleEl = document.getElementById('modal-change-cat-title');
    const subtitleEl = document.getElementById('modal-change-cat-subtitle');
    const previewEl = document.getElementById('change-cat-tx-preview');
    const searchInput = document.getElementById('change-cat-search');
    const ruleLabel = document.getElementById('change-cat-rule-label');
    const ruleCheckbox = document.getElementById('change-cat-apply-rule');
    const ruleText = document.getElementById('change-cat-rule-text');

    if (searchInput) searchInput.value = '';
    this.changeCategorySearch = '';
    this.changeCategoryGroupFilter = 'all';

    // Reset filter chips visual state
    ['all', 'need', 'want', 'luxury', 'savings', 'income'].forEach(grp => {
      const chip = document.getElementById(`cat-filter-chip-${grp}`);
      if (chip) {
        if (grp === 'all') {
          chip.className = 'cat-filter-chip active px-3 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 text-white transition whitespace-nowrap shadow';
        } else {
          chip.className = `cat-filter-chip px-3 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
            grp === 'need' ? 'text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20' :
            grp === 'want' ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20' :
            grp === 'luxury' ? 'text-fuchsia-300 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20' :
            grp === 'savings' ? 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20' :
            'text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20'
          }`;
        }
      }
    });

    if (this.changeCategoryTargetIds.length === 1) {
      const tx = this.transactions.find(t => t.id === this.changeCategoryTargetIds[0]);
      if (!tx) return;

      this.selectedNewCategory = tx.category || 'misc';
      if (titleEl) titleEl.textContent = 'Change Category';
      if (subtitleEl) subtitleEl.textContent = `Reclassify transaction: ${tx.merchant || tx.narration}`;

      if (previewEl) {
        previewEl.classList.remove('hidden');
        const isIncome = tx.type === 'income';
        const meta = getCategoryMeta(tx.category, tx.type);

        const avatarEl = document.getElementById('change-cat-current-avatar');
        if (avatarEl) {
          avatarEl.className = `w-8 h-8 rounded-lg ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm`;
          avatarEl.innerHTML = `<i data-lucide="${meta.icon}" class="w-4 h-4"></i>`;
        }

        const merchantEl = document.getElementById('change-cat-merchant');
        if (merchantEl) merchantEl.textContent = tx.merchant || 'Payee';

        const narrationEl = document.getElementById('change-cat-narration');
        if (narrationEl) narrationEl.textContent = `${tx.date} • ${tx.narration || ''}`;

        const amountEl = document.getElementById('change-cat-amount');
        if (amountEl) {
          amountEl.className = `font-mono font-extrabold text-sm whitespace-nowrap ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`;
          amountEl.textContent = `${isIncome ? '+' : '-'}${formatINR(tx.amount)}`;
        }

        const labelEl = document.getElementById('change-cat-current-label');
        if (labelEl) labelEl.textContent = `Current: ${meta.name} (${tx.grouping || 'Want'})`;
      }

      // Check count of transactions from this same merchant
      const merchantKey = (tx.merchant || '').trim();
      const matchCount = merchantKey ? this.transactions.filter(t => (t.merchant || '').toLowerCase() === merchantKey.toLowerCase()).length : 1;

      if (ruleLabel && ruleCheckbox && ruleText) {
        if (merchantKey && matchCount > 1) {
          ruleLabel.classList.remove('hidden');
          ruleCheckbox.checked = true;
          ruleText.textContent = `Also update all ${matchCount} transactions for "${merchantKey}" & remember rule for future`;
        } else if (merchantKey) {
          ruleLabel.classList.remove('hidden');
          ruleCheckbox.checked = true;
          ruleText.textContent = `Remember rule for future "${merchantKey}" transactions`;
        } else {
          ruleLabel.classList.add('hidden');
          ruleCheckbox.checked = false;
        }
      }
    } else {
      // Bulk selection
      this.selectedNewCategory = null;
      if (titleEl) titleEl.textContent = 'Bulk Change Category';
      if (subtitleEl) subtitleEl.textContent = `Reclassify ${this.changeCategoryTargetIds.length} selected transactions`;

      if (previewEl) {
        previewEl.classList.remove('hidden');
        const selectedTxs = this.transactions.filter(t => this.changeCategoryTargetIds.includes(t.id));
        const totalAmount = selectedTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const avatarEl = document.getElementById('change-cat-current-avatar');
        if (avatarEl) {
          avatarEl.className = 'w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0';
          avatarEl.innerHTML = '<i data-lucide="layers" class="w-4 h-4"></i>';
        }

        const merchantEl = document.getElementById('change-cat-merchant');
        if (merchantEl) merchantEl.textContent = `${this.changeCategoryTargetIds.length} Transactions Selected`;

        const narrationEl = document.getElementById('change-cat-narration');
        if (narrationEl) narrationEl.textContent = 'Choose a new category to apply to all selected records';

        const amountEl = document.getElementById('change-cat-amount');
        if (amountEl) {
          amountEl.className = 'font-mono font-extrabold text-sm text-indigo-300';
          amountEl.textContent = formatINR(totalAmount);
        }

        const labelEl = document.getElementById('change-cat-current-label');
        if (labelEl) labelEl.textContent = 'Bulk Update';
      }

      if (ruleLabel) ruleLabel.classList.add('hidden');
      if (ruleCheckbox) ruleCheckbox.checked = false;
    }

    this.renderChangeCategoryGrid();
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  openBulkChangeCategoryModal() {
    if (this.selectedIds.size === 0) {
      alert('Please select one or more transactions using the checkboxes first.');
      return;
    }
    this.openChangeCategoryModal(Array.from(this.selectedIds));
  }

  closeChangeCategoryModal() {
    const modal = document.getElementById('modal-change-category');
    if (modal) modal.classList.add('hidden');
  }

  setChangeCategoryGroupFilter(grp) {
    this.changeCategoryGroupFilter = grp;
    ['all', 'need', 'want', 'luxury', 'savings', 'income'].forEach(k => {
      const chip = document.getElementById(`cat-filter-chip-${k}`);
      if (chip) {
        if (k === grp) {
          chip.className = 'cat-filter-chip active px-3 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 text-white transition whitespace-nowrap shadow';
        } else {
          chip.className = `cat-filter-chip px-3 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
            k === 'need' ? 'text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20' :
            k === 'want' ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20' :
            k === 'luxury' ? 'text-fuchsia-300 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20' :
            k === 'savings' ? 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20' :
            'text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20'
          }`;
        }
      }
    });
    this.renderChangeCategoryGrid();
  }

  filterChangeCategoryList(query) {
    this.changeCategorySearch = (query || '').toLowerCase().trim();
    this.renderChangeCategoryGrid();
  }

  renderChangeCategoryGrid() {
    const grid = document.getElementById('change-cat-grid');
    if (!grid) return;

    const query = this.changeCategorySearch || '';
    const grp = this.changeCategoryGroupFilter || 'all';

    let list = Object.values(CATEGORIES);

    // Grouping filter
    if (grp === 'need') {
      list = list.filter(c => c.defaultGrouping === GROUPINGS.NEED);
    } else if (grp === 'want') {
      list = list.filter(c => c.defaultGrouping === GROUPINGS.WANT);
    } else if (grp === 'luxury') {
      list = list.filter(c => c.defaultGrouping === GROUPINGS.LUXURY);
    } else if (grp === 'savings') {
      list = list.filter(c => c.defaultGrouping === GROUPINGS.SAVINGS);
    } else if (grp === 'income') {
      list = list.filter(c => c.type === 'income');
    }

    // Text search filter
    if (query) {
      list = list.filter(c => {
        return c.name.toLowerCase().includes(query) ||
               (c.id || '').toLowerCase().includes(query) ||
               (c.defaultGrouping || '').toLowerCase().includes(query);
      });
    }

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-8 text-center text-xs text-slate-400">
          No categories match "${escapeHtml(query)}". Try another search or clear the filter.
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(cat => {
      const isSelected = (cat.id === this.selectedNewCategory);
      const meta = getCategoryMeta(cat.id, cat.type);

      let groupBadge = 'bg-slate-800 text-slate-300 border-slate-700';
      if (cat.defaultGrouping === GROUPINGS.NEED) groupBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      else if (cat.defaultGrouping === GROUPINGS.WANT) groupBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      else if (cat.defaultGrouping === GROUPINGS.LUXURY) groupBadge = 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
      else if (cat.defaultGrouping === GROUPINGS.SAVINGS) groupBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      else if (cat.type === 'income') groupBadge = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

      return `
        <div onclick="window.app.selectCategoryForChange('${cat.id}')" class="p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between group ${
          isSelected 
            ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500' 
            : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
        }">
          <div class="flex items-center space-x-3 min-w-0">
            <div class="w-9 h-9 rounded-xl ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm group-hover:scale-105 transition">
              <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'} truncate">
                ${escapeHtml(cat.name)}
              </div>
              <div class="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1.5">
                <span class="inline-flex items-center px-1.5 py-0.2 rounded-full border text-[9px] font-semibold ${groupBadge}">
                  ${cat.type === 'income' ? 'Income' : (cat.defaultGrouping || 'Want')}
                </span>
              </div>
            </div>
          </div>

          <div class="ml-2 flex-shrink-0">
            ${isSelected ? `
              <div class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
              </div>
            ` : `
              <div class="w-6 h-6 rounded-full border border-slate-700 group-hover:border-slate-500 transition"></div>
            `}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  selectCategoryForChange(catId) {
    this.selectedNewCategory = catId;
    this.renderChangeCategoryGrid();
  }

  async applySelectedCategory() {
    if (!this.selectedNewCategory) {
      alert('Please select a category first.');
      return;
    }

    const catObj = Object.values(CATEGORIES).find(c => c.id === this.selectedNewCategory) || CATEGORIES.MISC;
    const targetGrouping = catObj.defaultGrouping || (catObj.type === 'income' ? GROUPINGS.INCOME : GROUPINGS.WANT);
    const updates = {
      category: catObj.id,
      categoryName: catObj.name,
      categoryIcon: catObj.icon,
      categoryColor: catObj.color,
      grouping: targetGrouping,
      type: catObj.type
    };

    const isBulk = this.changeCategoryTargetIds.length > 1;
    const applyRuleCheckbox = document.getElementById('change-cat-apply-rule');
    const shouldApplyRule = !isBulk && applyRuleCheckbox && applyRuleCheckbox.checked;

    try {
      if (isBulk) {
        // Bulk update all selected
        const res = await fetch('/api/transactions/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: this.changeCategoryTargetIds,
            updates
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to bulk update');

        // Update in-memory
        const idSet = new Set(this.changeCategoryTargetIds);
        this.transactions.forEach(t => {
          if (idSet.has(t.id)) {
            Object.assign(t, updates);
            if (t.type === 'expense') {
              t.withdrawal = t.amount;
              t.deposit = 0;
            } else {
              t.deposit = t.amount;
              t.withdrawal = 0;
            }
          }
        });
        this.selectedIds.clear();

      } else {
        // Single transaction
        const targetId = this.changeCategoryTargetIds[0];
        const tx = this.transactions.find(t => t.id === targetId);
        if (!tx) throw new Error('Transaction not found');

        if (shouldApplyRule && tx.merchant) {
          // 1. Create/save custom rule for merchant
          const keyword = tx.merchant.trim();
          const existingRuleIdx = this.customRules.findIndex(r => r.keyword.toLowerCase() === keyword.toLowerCase());
          const newRule = {
            keyword,
            merchant: tx.merchant,
            category: catObj.id,
            grouping: targetGrouping
          };

          if (existingRuleIdx !== -1) {
            this.customRules[existingRuleIdx] = newRule;
          } else {
            this.customRules.push(newRule);
          }

          await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: this.customRules })
          });

          // 2. Find all matching transactions from this merchant and update them
          const matchingIds = this.transactions
            .filter(t => (t.merchant || '').toLowerCase() === keyword.toLowerCase() || (t.narration || '').toLowerCase().includes(keyword.toLowerCase()))
            .map(t => t.id);

          if (!matchingIds.includes(targetId)) matchingIds.push(targetId);

          const res = await fetch('/api/transactions/bulk-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: matchingIds,
              updates
            })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Failed to update matching transactions');

          // Update matching in memory
          const matchSet = new Set(matchingIds);
          this.transactions.forEach(t => {
            if (matchSet.has(t.id)) {
              Object.assign(t, updates);
              if (t.type === 'expense') {
                t.withdrawal = t.amount;
                t.deposit = 0;
              } else {
                t.deposit = t.amount;
                t.withdrawal = 0;
              }
            }
          });

        } else {
          // Just update this single transaction
          const res = await fetch(`/api/transactions/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Failed to update transaction');

          Object.assign(tx, updates);
          if (tx.type === 'expense') {
            tx.withdrawal = tx.amount;
            tx.deposit = 0;
          } else {
            tx.deposit = tx.amount;
            tx.withdrawal = 0;
          }
        }
      }

      this.closeChangeCategoryModal();
      this.renderAll();

      // If categories tab is active and was drilled down, refresh it
      if (this.activeTab === 'categories') {
        this.renderCategoriesTab();
      }

      if (window.confetti) {
        window.confetti({ particleCount: 35, spread: 60, origin: { y: 0.65 } });
      }

    } catch (err) {
      alert('Error updating category: ' + err.message);
    }
  }

  // --- CRUD: ADD & EDIT TRANSACTION (REQUIREMENT 7) ---
  openAddTxModal() {
    document.getElementById('modal-tx-title').textContent = 'Add Transaction';
    document.getElementById('form-tx-id').value = '';
    document.getElementById('form-tx-amount').value = '';
    document.getElementById('form-tx-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('form-tx-merchant').value = '';
    document.getElementById('form-tx-narration').value = '';
    this.setFormType('expense');

    document.getElementById('modal-transaction').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  openEditTxModal(id) {
    const tx = this.transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById('modal-tx-title').textContent = 'Edit Transaction';
    document.getElementById('form-tx-id').value = tx.id;
    document.getElementById('form-tx-amount').value = tx.amount;
    document.getElementById('form-tx-date').value = tx.date;
    document.getElementById('form-tx-merchant').value = tx.merchant || '';
    document.getElementById('form-tx-narration').value = tx.narration || '';
    
    this.setFormType(tx.type || 'expense');
    document.getElementById('form-tx-category').value = tx.category || 'misc';
    document.getElementById('form-tx-grouping').value = tx.grouping || 'Want';

    document.getElementById('modal-transaction').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeTxModal() {
    document.getElementById('modal-transaction').classList.add('hidden');
  }

  setFormType(type) {
    const btnExp = document.getElementById('btn-form-expense');
    const btnInc = document.getElementById('btn-form-income');

    if (type === 'expense') {
      btnExp.className = 'py-2 text-xs font-bold rounded-lg bg-rose-600 text-white transition';
      btnInc.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition';
    } else {
      btnInc.className = 'py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white transition';
      btnExp.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition';
      document.getElementById('form-tx-grouping').value = GROUPINGS.INCOME;
    }

    this.populateCategoryDropdowns(type);
  }

  onCategoryChanged(catId) {
    const catObj = Object.values(CATEGORIES).find(c => c.id === catId);
    if (catObj && catObj.defaultGrouping) {
      document.getElementById('form-tx-grouping').value = catObj.defaultGrouping;
    }
  }

  async saveTransactionForm(e) {
    e.preventDefault();
    const id = document.getElementById('form-tx-id').value;
    const isEdit = Boolean(id);

    const isExpense = document.getElementById('btn-form-expense').classList.contains('bg-rose-600');
    const type = isExpense ? 'expense' : 'income';
    const amount = parseFloat(document.getElementById('form-tx-amount').value);
    const date = document.getElementById('form-tx-date').value;
    const merchant = document.getElementById('form-tx-merchant').value.trim();
    const narration = document.getElementById('form-tx-narration').value.trim() || merchant;
    const category = document.getElementById('form-tx-category').value;
    const grouping = document.getElementById('form-tx-grouping').value;
    const mode = document.getElementById('form-tx-mode').value;

    const catObj = Object.values(CATEGORIES).find(c => c.id === category) || CATEGORIES.MISC;

    const payload = {
      type,
      amount,
      date,
      rawDate: date.split('-').reverse().join('/'),
      narration,
      merchant,
      category,
      categoryName: catObj.name,
      categoryIcon: catObj.icon,
      categoryColor: catObj.color,
      grouping,
      mode,
      withdrawal: type === 'expense' ? amount : 0,
      deposit: type === 'income' ? amount : 0,
      source: 'Manual Entry'
    };

    try {
      if (isEdit) {
        await fetch(`/api/transactions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: payload })
        });
      }

      this.closeTxModal();
      await this.fetchTransactions();
      this.renderAll();

      if (window.confetti) {
        window.confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
      }
    } catch (err) {
      alert('Failed to save transaction: ' + err.message);
    }
  }

  async deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.fetchTransactions();
        this.renderAll();
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  // --- UPLOAD HDFC STATEMENT HANDLER (REQUIREMENT 1 & 2) ---
  openUploadModal() {
    this.parsedStaging = [];
    this.currentUploadedFile = null;
    this.hideUploadStatus();
    document.getElementById('upload-preview-container').classList.add('hidden');
    document.getElementById('btn-import-parsed').disabled = true;
    document.getElementById('btn-import-parsed').textContent = 'Import Transactions';
    document.getElementById('file-input').value = '';
    const retryBtn = document.getElementById('btn-retry-pdf');
    if (retryBtn) retryBtn.classList.add('hidden');

    this.setUploadMode('file');
    document.getElementById('modal-upload').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeUploadModal() {
    document.getElementById('modal-upload').classList.add('hidden');
    this.currentUploadedFile = null;
  }

  setUploadMode(mode) {
    const fileSec = document.getElementById('upload-mode-file');
    const textSec = document.getElementById('upload-mode-text');
    const btnFile = document.getElementById('tab-btn-fileupload');
    const btnText = document.getElementById('tab-btn-pastetext');

    if (mode === 'file') {
      if (fileSec) fileSec.classList.remove('hidden');
      if (textSec) textSec.classList.add('hidden');
      if (btnFile) btnFile.className = 'py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition flex items-center justify-center space-x-1.5';
      if (btnText) btnText.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center space-x-1.5';
    } else {
      if (fileSec) fileSec.classList.add('hidden');
      if (textSec) textSec.classList.remove('hidden');
      if (btnText) btnText.className = 'py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition flex items-center justify-center space-x-1.5';
      if (btnFile) btnFile.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center space-x-1.5';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  setupDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    if (!dropzone || !fileInput) return;

    // Prevent default browser file drop behavior (which opens file in browser window)
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);

    // Clicking dropzone triggers file picker
    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('border-indigo-500', 'bg-slate-900/80');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('border-indigo-500', 'bg-slate-900/80');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.currentUploadedFile = files[0];
        this.processUploadedFile(this.currentUploadedFile);
      }
    });
  }

  handleFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      this.currentUploadedFile = file;
      this.processUploadedFile(file);
    }
    // Reset input value so selecting the same file triggers change again
    e.target.value = '';
  }

  retryPDFWithPassword() {
    if (this.currentUploadedFile) {
      this.processUploadedFile(this.currentUploadedFile);
    } else {
      document.getElementById('file-input').click();
    }
  }

  showUploadSpinner(text = 'Parsing statement...') {
    const statusEl = document.getElementById('upload-status');
    const spinner = document.getElementById('upload-status-spinner');
    const statusText = document.getElementById('upload-status-text');
    const errorBox = document.getElementById('upload-error-box');

    if (statusEl) statusEl.classList.remove('hidden');
    if (spinner) spinner.classList.remove('hidden');
    if (statusText) statusText.textContent = text;
    if (errorBox) errorBox.classList.add('hidden');
  }

  showUploadError(msg) {
    const statusEl = document.getElementById('upload-status');
    const spinner = document.getElementById('upload-status-spinner');
    const errorBox = document.getElementById('upload-error-box');
    const errorMsg = document.getElementById('upload-error-msg');
    const retryBtn = document.getElementById('btn-retry-pdf');

    if (statusEl) statusEl.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
    if (errorBox) errorBox.classList.remove('hidden');
    if (errorMsg) errorMsg.textContent = msg;

    if (msg.includes('PASSWORD_REQUIRED') || msg.includes('password') || msg.includes('encrypted')) {
      if (retryBtn) retryBtn.classList.remove('hidden');
      document.getElementById('pdf-password-input').focus();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  hideUploadStatus() {
    const statusEl = document.getElementById('upload-status');
    if (statusEl) statusEl.classList.add('hidden');
  }

  async processUploadedFile(file) {
    this.showUploadSpinner(`Parsing statement: ${file.name}...`);

    const passwordInput = document.getElementById('pdf-password-input');
    const password = passwordInput ? passwordInput.value.trim() : '';

    try {
      const txs = await HDFCParser.parseFile(file, { password });

      if (!txs || txs.length === 0) {
        throw new Error('No transactions detected in file. Please verify it is an HDFC statement (or try copying & pasting text in the "Paste Statement Text" tab).');
      }

      this.displayParsedPreview(txs);
      this.hideUploadStatus();

    } catch (err) {
      console.error('File parse error:', err);
      this.showUploadError(err.message || 'Failed to parse file.');
    }
  }

  parsePastedText() {
    const input = document.getElementById('paste-statement-input');
    const text = input ? input.value.trim() : '';
    if (!text) {
      alert('Please paste some statement text first.');
      return;
    }

    this.showUploadSpinner('Parsing pasted statement text...');

    try {
      const txs = HDFCParser.parseCSV(text);
      if (!txs || txs.length === 0) {
        throw new Error('Could not identify any transactions in the pasted text. Ensure lines contain Date, Description, and Amounts.');
      }
      this.displayParsedPreview(txs);
      this.hideUploadStatus();
    } catch (err) {
      this.showUploadError(err.message);
    }
  }

  displayParsedPreview(txs) {
    this.parsedStaging = txs;

    const previewContainer = document.getElementById('upload-preview-container');
    const previewCount = document.getElementById('preview-count');
    const previewList = document.getElementById('preview-list');
    const btnImport = document.getElementById('btn-import-parsed');

    previewContainer.classList.remove('hidden');
    previewCount.textContent = `${txs.length} Transactions Auto-Identified!`;

    previewList.innerHTML = txs.slice(0, 10).map(t => {
      const meta = getCategoryMeta(t.category, t.type);
      return `
        <div class="p-2.5 flex items-center justify-between">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-7 h-7 rounded-lg ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar shadow-sm">
              <i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i>
            </div>
            <div class="truncate max-w-[260px]">
              <div class="font-bold text-slate-200">${escapeHtml(t.merchant || 'Payee')}</div>
              <div class="text-[10px] text-slate-400 truncate">${t.date} • <span class="${meta.textClass} font-semibold">${escapeHtml(meta.name)}</span> • <span class="text-indigo-400 font-semibold">${t.grouping}</span></div>
            </div>
          </div>
          <span class="font-mono font-bold whitespace-nowrap ml-2 ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
            ${t.type === 'income' ? '+' : '-'}${formatINR(t.amount)}
          </span>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    if (txs.length > 10) {
      previewList.innerHTML += `<div class="p-2 text-center text-[10px] text-slate-500 font-semibold">+ ${txs.length - 10} more transactions ready</div>`;
    }

    btnImport.disabled = false;
    btnImport.textContent = `Import ${txs.length} Transactions`;
  }

  async loadDemoStatementFile() {
    this.showUploadSpinner('Loading sample HDFC statement CSV...');

    try {
      const res = await fetch('/sample-hdfc-statement.csv');
      const csv = await res.text();
      const txs = HDFCParser.parseCSV(csv);
      this.displayParsedPreview(txs);
      this.hideUploadStatus();
    } catch (err) {
      this.showUploadError('Failed to load demo file: ' + err.message);
    }
  }

  async commitParsedTransactions() {
    if (!this.parsedStaging || this.parsedStaging.length === 0) return;

    const btn = document.getElementById('btn-import-parsed');
    btn.disabled = true;
    btn.textContent = 'Importing...';

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: this.parsedStaging })
      });
      const data = await res.json();
      if (data.success) {
        this.closeUploadModal();
        await this.fetchTransactions();
        this.renderAll();
        if (window.confetti) {
          window.confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
        }
      }
    } catch (err) {
      alert('Failed to commit transactions: ' + err.message);
      btn.disabled = false;
    }
  }

  exportCSV() {
    const list = this.getFilteredTransactions();
    if (list.length === 0) return alert('No transactions to export.');

    const headers = ['Date', 'Type', 'Amount (INR)', 'Merchant', 'Category', 'Grouping', 'Narration', 'Ref No'];
    const rows = list.map(t => [
      t.date,
      t.type,
      t.amount,
      `"${(t.merchant || '').replace(/"/g, '""')}"`,
      `"${(t.categoryName || t.category || '').replace(/"/g, '""')}"`,
      t.grouping,
      `"${(t.narration || '').replace(/"/g, '""')}"`,
      t.chqRef || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FinTrack_HDFC_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- DROPDOWN HELPERS ---
  populateCategoryDropdowns(filterType = null) {
    const filterCat = document.getElementById('filter-category');
    const formCat = document.getElementById('form-tx-category');

    const cats = Object.values(CATEGORIES);

    if (filterCat) {
      filterCat.innerHTML = `<option value="all">All Categories</option>` +
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    if (formCat) {
      const filtered = filterType ? cats.filter(c => c.type === filterType) : cats;
      formCat.innerHTML = filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  }

  // --- PRIVACY / INCOGNITO MODE (BLUR AMOUNTS) ---
  initPrivacyMode() {
    if (this.privacyMode) {
      document.body.classList.add('privacy-mode');
      const btn = document.getElementById('icon-privacy');
      if (btn) btn.setAttribute('data-lucide', 'eye-off');
    }
  }

  togglePrivacyMode() {
    this.privacyMode = !this.privacyMode;
    localStorage.setItem('fintrack_privacy', this.privacyMode ? 'true' : 'false');
    if (this.privacyMode) {
      document.body.classList.add('privacy-mode');
    } else {
      document.body.classList.remove('privacy-mode');
    }
    const btn = document.getElementById('icon-privacy');
    if (btn) {
      btn.setAttribute('data-lucide', this.privacyMode ? 'eye-off' : 'eye');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // --- KEYBOARD SHORTCUTS & COMMAND PALETTE (CMD+K / CTRL+K) ---
  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Cmd+K / Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
        return;
      }

      // Escape -> close any open modals
      if (e.key === 'Escape') {
        this.closeCommandPalette();
        this.closeDrilldownModal();
        this.closeUploadModal();
        this.closeTxModal();
        this.closeRulesModal();
        this.closeExecutiveReport();
        this.closeBackupModal();
        const anom = document.getElementById('modal-anomalies');
        if (anom) anom.classList.add('hidden');
        return;
      }

      // Shortcuts when NOT typing inside an input field
      if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          this.togglePrivacyMode();
        } else if (e.key === '1') {
          this.switchTab('overview');
        } else if (e.key === '2') {
          this.switchTab('categories');
        } else if (e.key === '3') {
          this.switchTab('transactions');
        } else if (e.key === '4') {
          this.switchTab('subscriptions');
        } else if (e.key === '5') {
          this.switchTab('tax');
        } else if (e.key === '6') {
          this.switchTab('splitwise');
        } else if (e.key === '7') {
          this.switchTab('heatmap');
        } else if (e.key === '8') {
          this.switchTab('budget');
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          this.openAddTxModal();
        } else if (e.key.toLowerCase() === 'u') {
          e.preventDefault();
          this.openUploadModal();
        }
      }
    });
  }

  openCommandPalette() {
    const modal = document.getElementById('modal-command-palette');
    const input = document.getElementById('cmd-palette-input');
    if (modal) modal.classList.remove('hidden');
    if (input) {
      input.value = '';
      input.focus();
    }
    this.filterCommandPalette('');
    if (window.lucide) window.lucide.createIcons();
  }

  closeCommandPalette() {
    const modal = document.getElementById('modal-command-palette');
    if (modal) modal.classList.add('hidden');
  }

  openMobileMoreMenu() {
    const modal = document.getElementById('modal-mobile-menu');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeMobileMoreMenu() {
    const modal = document.getElementById('modal-mobile-menu');
    if (modal) modal.classList.add('hidden');
  }

  filterCommandPalette(query) {
    const resultsContainer = document.getElementById('cmd-palette-results');
    if (!resultsContainer) return;

    const q = (query || '').trim().toLowerCase();

    // Built-in actions and navigation commands
    const actions = [
      { id: 'tab_overview', title: 'Go to Overview & Analytics Dashboard', icon: 'layout-dashboard', shortcut: '1', handler: () => this.switchTab('overview') },
      { id: 'tab_categories', title: 'Go to Category Intelligence & Drilldown', icon: 'layers', shortcut: '2', handler: () => this.switchTab('categories') },
      { id: 'tab_transactions', title: 'Go to Transactions Ledger', icon: 'receipt', shortcut: '3', handler: () => this.switchTab('transactions') },
      { id: 'tab_subscriptions', title: 'Go to Subscriptions & Zombie Hunter', icon: 'repeat', shortcut: '4', handler: () => this.switchTab('subscriptions') },
      { id: 'tab_tax', title: 'Go to Tax Planner & Deductions Ledger (80C/80D)', icon: 'percent', shortcut: '5', handler: () => this.switchTab('tax') },
      { id: 'tab_splitwise', title: 'Go to Shared Expenses & Bill Splitter', icon: 'users', shortcut: '6', handler: () => this.switchTab('splitwise') },
      { id: 'tab_heatmap', title: 'Go to Calendar Heatmap', icon: 'calendar', shortcut: '7', handler: () => this.switchTab('heatmap') },
      { id: 'tab_budget', title: 'Go to 50/30/20 Budget Framework', icon: 'target', shortcut: '8', handler: () => this.switchTab('budget') },
      { id: 'act_privacy', title: 'Toggle Privacy Mode (Incognito Blur)', icon: 'eye', shortcut: 'P', handler: () => this.togglePrivacyMode() },
      { id: 'act_upload', title: 'Upload HDFC Bank Statement (CSV, PDF, Excel)', icon: 'upload-cloud', shortcut: 'U', handler: () => this.openUploadModal() },
      { id: 'act_add', title: 'Add New Manual Transaction', icon: 'plus-circle', shortcut: 'N', handler: () => this.openAddTxModal() },
      { id: 'act_rules', title: 'Manage Custom Categorization Rules', icon: 'sliders', handler: () => this.openRulesModal() },
      { id: 'act_report', title: 'Generate 1-Page Executive Printable PDF Report', icon: 'printer', handler: () => this.openExecutiveReport() },
      { id: 'act_backup', title: 'Export or Restore System Backup Snapshot', icon: 'hard-drive', handler: () => this.openBackupModal() },
      { id: 'act_export_csv', title: 'Export Current Timeframe to CSV', icon: 'file-spreadsheet', handler: () => this.exportCSV() },
      { id: 'act_sample', title: 'Reset to Realistic HDFC Sample Statement', icon: 'rotate-ccw', handler: () => this.resetSampleData() },
    ];

    // Also include category jump commands
    Object.values(CATEGORIES).forEach(cat => {
      actions.push({
        id: `cat_${cat.id}`,
        title: `Filter Category: ${cat.name}`,
        subtitle: `${cat.type === 'income' ? 'Income Stream' : 'Expense Category'}`,
        icon: cat.icon,
        handler: () => {
          this.openCategoryTab(cat.id);
        }
      });
    });

    let matched = actions.filter(a => {
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || (a.subtitle && a.subtitle.toLowerCase().includes(q));
    });

    // Check for amount search (e.g. >5000 or <1000)
    let amountFilter = null;
    if (q.startsWith('>') || q.startsWith('<')) {
      const op = q.charAt(0);
      const val = parseFloat(q.slice(1).replace(/,/g, ''));
      if (!isNaN(val)) {
        amountFilter = { op, val };
      }
    }

    if (amountFilter) {
      const filteredTxs = this.transactions.filter(t => {
        const amt = Number(t.amount) || 0;
        return amountFilter.op === '>' ? amt > amountFilter.val : amt < amountFilter.val;
      }).slice(0, 10);

      resultsContainer.innerHTML = `
        <div class="px-3 py-1.5 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
          Transactions ${amountFilter.op} ₹${amountFilter.val.toLocaleString('en-IN')} (${filteredTxs.length} matches)
        </div>
        ${filteredTxs.map(t => `
          <div onclick="window.app.closeCommandPalette(); window.app.openEditTxModal('${t.id}')" class="p-2.5 rounded-xl hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-xs transition">
            <div class="flex items-center space-x-2.5">
              <span class="font-mono text-slate-400 text-[11px]">${t.date}</span>
              <span class="font-semibold text-slate-200">${escapeHtml(t.merchant || t.narration)}</span>
            </div>
            <span class="font-mono font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
              ${t.type === 'income' ? '+' : '-'}${formatINR(t.amount)}
            </span>
          </div>
        `).join('')}
      `;
      return;
    }

    if (matched.length === 0) {
      resultsContainer.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500">
          No commands, categories or payees matching "${escapeHtml(q)}".
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = matched.slice(0, 8).map(m => `
      <div onclick="window.app.closeCommandPalette(); (${m.handler.toString()})()" class="p-2.5 rounded-xl hover:bg-indigo-600/15 hover:border-indigo-500/30 border border-transparent cursor-pointer flex items-center justify-between text-xs transition group">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 group-hover:text-indigo-300 flex items-center justify-center flex-shrink-0">
            <i data-lucide="${m.icon}" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="font-semibold text-slate-100 group-hover:text-white">${escapeHtml(m.title)}</div>
            ${m.subtitle ? `<div class="text-[10px] text-slate-400">${escapeHtml(m.subtitle)}</div>` : ''}
          </div>
        </div>
        ${m.shortcut ? `<kbd class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 group-hover:text-slate-200">${m.shortcut}</kbd>` : ''}
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // --- MONTH-END SPEND FORECAST & EMERGENCY RUNWAY ---
  renderSpendForecastAndRunway(txs, totalExpense, needsAmt) {
    const elForecast = document.getElementById('forecast-projected-spend');
    const elVelocityNote = document.getElementById('forecast-velocity-note');
    const elRunway = document.getElementById('runway-months-val');
    const elRunwayNote = document.getElementById('runway-detail-note');

    if (!elForecast || !elRunway) return;

    const d = this.currentDate;
    const year = d.getFullYear();
    const month = d.getMonth();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    // Determine if selected month is the active current calendar month
    const now = new Date();
    const isCurrentCalendarMonth = (now.getFullYear() === year && now.getMonth() === month);

    let daysElapsed = totalDaysInMonth;
    let daysRemaining = 0;

    if (isCurrentCalendarMonth) {
      daysElapsed = Math.min(totalDaysInMonth, Math.max(1, now.getDate()));
      daysRemaining = Math.max(0, totalDaysInMonth - daysElapsed);
    }

    const dailyVelocity = totalExpense > 0 ? (totalExpense / daysElapsed) : 0;
    const projectedMonthEnd = isCurrentCalendarMonth ? (totalExpense + (dailyVelocity * daysRemaining)) : totalExpense;

    elForecast.textContent = formatINR(projectedMonthEnd);
    if (isCurrentCalendarMonth) {
      elVelocityNote.textContent = `Pacing at ${formatINR(dailyVelocity)}/day (${daysRemaining} days remaining)`;
    } else {
      elVelocityNote.textContent = `Completed month: Avg ${formatINR(dailyVelocity)}/day across ${totalDaysInMonth} days`;
    }

    // Emergency Runway: Liquid Surplus / Monthly Needs
    let allInflow = 0;
    let allOutflow = 0;
    this.transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') allInflow += amt;
      else allOutflow += amt;
    });
    const cumulativeSurplus = Math.max(0, allInflow - allOutflow);

    const monthlyNeeds = needsAmt > 0 ? needsAmt : 45000;
    const runwayMonths = monthlyNeeds > 0 ? (cumulativeSurplus / monthlyNeeds).toFixed(1) : '12+';

    elRunway.textContent = `${runwayMonths} Months`;
    elRunwayNote.textContent = `Liquid buffer: ${formatINR(cumulativeSurplus)} against ${formatINR(monthlyNeeds)}/mo needs`;

    // Safe-to-Spend Daily Allowance (Feature 3)
    const elSafeSpend = document.getElementById('safe-to-spend-daily-val');
    const elSafeNote = document.getElementById('safe-to-spend-note');
    if (elSafeSpend) {
      let totalIn = txs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      if (totalIn === 0) totalIn = 150000;
      const wantsSpent = txs.filter(t => t.grouping === GROUPINGS.WANT || t.grouping === GROUPINGS.LUXURY).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const discretionaryPool = Math.max(0, (totalIn * 0.35) - wantsSpent);
      const safeDaily = daysRemaining > 0 ? Math.round(discretionaryPool / daysRemaining) : Math.round(discretionaryPool / totalDaysInMonth);
      elSafeSpend.textContent = `${formatINR(safeDaily)} / day`;
      if (elSafeNote) {
        elSafeNote.textContent = isCurrentCalendarMonth 
          ? `Pool: ${formatINR(discretionaryPool)} (${daysRemaining} days left)`
          : `Total Pool: ${formatINR(discretionaryPool)}`;
      }
    }
  }

  renderSafeToSpend() {
    const txs = this.getFilteredTransactions();
    const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const needsAmt = txs.filter(t => t.grouping === GROUPINGS.NEED).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    this.renderSpendForecastAndRunway(txs, totalExpense, needsAmt);
  }

  // --- RECURRING SUBSCRIPTIONS & EMI TRACKER ---
  detectAndRenderRecurring(allTxs) {
    const listContainer = document.getElementById('recurring-items-list');
    const badgeEl = document.getElementById('recurring-total-badge');
    const footEl = document.getElementById('recurring-summary-foot');
    const kpiVal = document.getElementById('kpi-recurring-monthly-val');
    const kpiNote = document.getElementById('kpi-recurring-count-note');

    if (!listContainer) return;

    const expenses = allTxs.filter(t => t.type === 'expense');

    const groups = {};
    expenses.forEach(t => {
      const merchant = t.merchant || 'Direct Debit';
      const key = merchant.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          name: merchant,
          category: t.category,
          categoryName: t.categoryName,
          txs: []
        };
      }
      groups[key].txs.push(t);
    });

    const recurring = [];
    Object.values(groups).forEach(g => {
      const months = new Set(g.txs.map(t => t.date.slice(0, 7)));
      const isKnownRecurringCategory = (g.category === 'utilities' || g.category === 'emi_loans' || g.category === 'mutual_fund_sip' || g.category === 'insurance' || g.category === 'entertainment');

      if (months.size >= 2 || (isKnownRecurringCategory && g.txs.length >= 2)) {
        const amounts = g.txs.map(t => Number(t.amount) || 0);
        const avgAmt = Math.round(amounts.reduce((a, b) => a + b, 0) / months.size);
        const lastTx = g.txs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        const lastDay = new Date(lastTx.date).getDate();

        const s = ['th', 'st', 'nd', 'rd'];
        const v = lastDay % 100;
        const daySuffix = (s[(v - 20) % 10] || s[v] || s[0]);

        recurring.push({
          name: g.name,
          category: g.category,
          categoryName: g.categoryName,
          monthlyAmount: avgAmt,
          cycleDay: `${lastDay}${daySuffix} of every month`,
          frequency: months.size >= 4 ? 'Monthly Recurring' : 'Periodic (Multi-Month)',
          lastDate: lastTx.date,
          txCount: g.txs.length
        });
      }
    });

    recurring.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
    this.detectedRecurring = recurring;

    const totalMonthlyCommitment = recurring.reduce((s, r) => s + r.monthlyAmount, 0);

    if (badgeEl) badgeEl.textContent = `${formatINR(totalMonthlyCommitment)} / month`;
    if (kpiVal) kpiVal.textContent = `${formatINR(totalMonthlyCommitment)} / mo`;
    if (kpiNote) kpiNote.textContent = `${recurring.length} active recurring debits & EMIs`;
    if (footEl) footEl.textContent = `Auto-identified ${recurring.length} recurring commitments totaling ${formatINR(totalMonthlyCommitment)}/mo`;

    if (recurring.length === 0) {
      listContainer.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
          No recurring subscriptions or monthly EMIs detected yet.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = recurring.map(r => {
      const meta = getCategoryMeta(r.category, 'expense');
      return `
        <div class="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 flex items-center justify-between transition">
          <div class="flex items-center space-x-3 min-w-0">
            <div class="w-8 h-8 rounded-lg ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center flex-shrink-0 cat-avatar">
              <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-200 truncate">${escapeHtml(r.name)}</div>
              <div class="text-[10px] text-slate-400 flex items-center space-x-1.5">
                <span>${r.cycleDay}</span>
                <span>•</span>
                <span class="text-indigo-400">${r.txCount} debits detected</span>
              </div>
            </div>
          </div>
          <div class="text-right flex-shrink-0 ml-2">
            <div class="font-mono text-xs font-bold text-amber-400">${formatINR(r.monthlyAmount)}<span class="text-[10px] font-normal text-slate-400">/mo</span></div>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">Auto Debit</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // --- ACCIDENTAL DUPLICATE DEBITS & ANOMALY DETECTOR ---
  detectAndRenderAnomalies(txs) {
    const banner = document.getElementById('anomaly-alert-banner');
    const titleEl = document.getElementById('anomaly-banner-title');
    const descEl = document.getElementById('anomaly-banner-desc');

    if (!banner) return;

    const duplicates = [];
    const expenses = txs.filter(t => t.type === 'expense');

    for (let i = 0; i < expenses.length; i++) {
      for (let j = i + 1; j < expenses.length; j++) {
        const a = expenses[i];
        const b = expenses[j];

        if (a.amount === b.amount && (a.merchant === b.merchant || a.narration === b.narration)) {
          const d1 = new Date(a.date).getTime();
          const d2 = new Date(b.date).getTime();
          const diffHours = Math.abs(d1 - d2) / (1000 * 60 * 60);

          if (diffHours <= 48) {
            duplicates.push({ a, b, diffHours: Math.round(diffHours) });
          }
        }
      }
    }

    this.detectedAnomalies = duplicates;

    if (duplicates.length > 0) {
      banner.classList.remove('hidden');
      if (titleEl) titleEl.textContent = `${duplicates.length} Potential Duplicate Debit${duplicates.length > 1 ? 's' : ''} Detected`;
      if (descEl) descEl.textContent = `Identical debits charged within 48h to ${duplicates[0].a.merchant || 'merchant'} (${formatINR(duplicates[0].a.amount)}).`;
    } else {
      banner.classList.add('hidden');
    }
  }

  reviewDuplicateAnomalies() {
    const modal = document.getElementById('modal-anomalies');
    const list = document.getElementById('anomalies-list-container');
    if (!modal || !list) return;

    if (this.detectedAnomalies.length === 0) {
      list.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No duplicate debits found in current statement view.</div>`;
    } else {
      list.innerHTML = this.detectedAnomalies.map((pair, idx) => `
        <div class="p-4 rounded-2xl bg-slate-900 border border-rose-500/30 space-y-3">
          <div class="flex items-center justify-between text-xs font-bold text-rose-300">
            <span>Pair #${idx + 1}: ${escapeHtml(pair.a.merchant || pair.a.narration)}</span>
            <span class="font-mono text-white text-sm">${formatINR(pair.a.amount)} each</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div class="text-[10px] text-slate-400 uppercase font-bold">Transaction A</div>
              <div class="font-mono text-slate-200">${pair.a.date}</div>
              <div class="text-[11px] text-slate-400 truncate">${escapeHtml(pair.a.narration)}</div>
              <button onclick="window.app.deleteTransaction('${pair.a.id}')" class="mt-2 text-[10px] px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white transition">Delete A</button>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div class="text-[10px] text-slate-400 uppercase font-bold">Transaction B (${pair.diffHours}h apart)</div>
              <div class="font-mono text-slate-200">${pair.b.date}</div>
              <div class="text-[11px] text-slate-400 truncate">${escapeHtml(pair.b.narration)}</div>
              <button onclick="window.app.deleteTransaction('${pair.b.id}')" class="mt-2 text-[10px] px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white transition">Delete B</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }


  // --- "CUT-THE-FAT" DISCRETIONARY SAVINGS SIMULATOR ---
  updateSavingsSimulator(val) {
    if (val !== undefined) {
      this.savingsReductionPct = parseInt(val, 10);
    }
    const pct = this.savingsReductionPct || 20;

    const slider = document.getElementById('sim-slider');
    const badge = document.getElementById('sim-reduction-pct-badge');
    const label = document.getElementById('sim-slider-val-label');
    const monthlySavedEl = document.getElementById('sim-monthly-saved');
    const wealthEl = document.getElementById('sim-5yr-wealth');
    const verdictEl = document.getElementById('sim-verdict-note');

    if (slider) slider.value = pct;
    if (badge) badge.textContent = `-${pct}%`;
    if (label) label.textContent = `${pct}%`;

    const txs = this.getFilteredTransactions();
    let discretionarySpend = 0;
    txs.forEach(t => {
      if (t.type === 'expense' && (t.grouping === GROUPINGS.WANT || t.grouping === GROUPINGS.LUXURY)) {
        discretionarySpend += (Number(t.amount) || 0);
      }
    });

    if (discretionarySpend === 0) discretionarySpend = 35000;

    const monthlySaved = Math.round(discretionarySpend * (pct / 100));
    const fiveYearWealth = Math.round(monthlySaved * 82.486375);

    if (monthlySavedEl) monthlySavedEl.textContent = formatINR(monthlySaved);
    if (wealthEl) wealthEl.textContent = formatINR(fiveYearWealth);
    if (verdictEl) {
      verdictEl.textContent = `Trimming ${pct}% on food delivery & shopping compounds to ${formatINR(fiveYearWealth)} in your wealth portfolio in 5 years.`;
    }
  }

  // --- INDIAN TAX READINESS & SECTION 80C / 80D ESTIMATOR ---
  renderTaxReadiness(txs) {
    const badge = document.getElementById('tax-total-deductions-badge');
    const el80c = document.getElementById('tax-80c-val');
    const bar80c = document.getElementById('tax-80c-bar');
    const sub80c = document.getElementById('tax-80c-sub');

    const el80d = document.getElementById('tax-80d-val');
    const bar80d = document.getElementById('tax-80d-bar');
    const sub80d = document.getElementById('tax-80d-sub');

    const elNps = document.getElementById('tax-nps-val');
    const barNps = document.getElementById('tax-nps-bar');
    const subNps = document.getElementById('tax-nps-sub');

    if (!el80c || !el80d) return;

    let tot80C = 0;
    let cnt80C = 0;
    let tot80D = 0;
    let cnt80D = 0;
    let totNps = 0;
    let cntNps = 0;

    txs.forEach(t => {
      const tag = detectTaxTags(t);
      if (tag) {
        if (tag.section === '80C') {
          tot80C += tag.amount;
          cnt80C++;
        } else if (tag.section === '80D') {
          tot80D += tag.amount;
          cnt80D++;
        } else if (tag.section === '80CCD(1B)') {
          totNps += tag.amount;
          cntNps++;
        }
      }
    });

    const eligible80C = Math.min(150000, tot80C);
    const eligible80D = Math.min(25000, tot80D);
    const eligibleNps = Math.min(50000, totNps);
    const totalIdentified = eligible80C + eligible80D + eligibleNps;

    if (badge) badge.textContent = `Tax Savings: ${formatINR(totalIdentified)}`;

    if (el80c) el80c.textContent = formatINR(tot80C);
    if (bar80c) bar80c.style.width = `${Math.min(100, Math.round((tot80C / 150000) * 100))}%`;
    if (sub80c) sub80c.textContent = `${cnt80C} debits (Eligible Deduction: ${formatINR(eligible80C)} of ₹1.5L)`;

    if (el80d) el80d.textContent = formatINR(tot80D);
    if (bar80d) bar80d.style.width = `${Math.min(100, Math.round((tot80D / 25000) * 100))}%`;
    if (sub80d) sub80d.textContent = `${cnt80D} health insurance debits (Max ₹25k)`;

    if (elNps) elNps.textContent = formatINR(totNps);
    if (barNps) barNps.style.width = `${Math.min(100, Math.round((totNps / 50000) * 100))}%`;
    if (subNps) subNps.textContent = `${cntNps} NPS contributions (Max ₹50k)`;
  }

  // --- CUSTOM CATEGORIZATION RULES ENGINE ---
  async fetchRules() {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (data.success) {
        this.customRules = data.rules || [];
      }
    } catch (err) {
      console.warn('Could not load custom rules:', err);
    }
  }

  openRulesModal(prefillKeyword = '') {
    const modal = document.getElementById('modal-rules');
    if (!modal) return;

    const catSelect = document.getElementById('rule-category');
    if (catSelect) {
      catSelect.innerHTML = Object.values(CATEGORIES).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    if (prefillKeyword) {
      const kw = document.getElementById('rule-keyword');
      if (kw) kw.value = prefillKeyword;
    }

    this.renderRulesList();
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }


  closeRulesModal() {
    const modal = document.getElementById('modal-rules');
    if (modal) modal.classList.add('hidden');
  }

  promptCreateRuleFromTx(narration, merchant, category, grouping) {
    const kw = (merchant || narration || '').split(' ')[0] || '';
    this.openRulesModal(kw);
    const mInput = document.getElementById('rule-merchant');
    if (mInput && merchant) mInput.value = merchant;
    const catSelect = document.getElementById('rule-category');
    if (catSelect && category) catSelect.value = category;
    const grpSelect = document.getElementById('rule-grouping');
    if (grpSelect && grouping) grpSelect.value = grouping;
  }

  renderRulesList() {
    const container = document.getElementById('rules-list-container');
    const countEl = document.getElementById('rules-count-val');
    if (!container) return;

    if (countEl) countEl.textContent = String(this.customRules.length);

    if (this.customRules.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500">
          No custom rules defined yet. Create your first rule above!
        </div>
      `;
      return;
    }

    container.innerHTML = this.customRules.map((r, idx) => `
      <div class="p-3 flex items-center justify-between text-xs hover:bg-slate-900 transition">
        <div class="space-y-0.5">
          <div class="font-bold text-white flex items-center space-x-2">
            <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">CONTAINS</span>
            <span>"${escapeHtml(r.keyword)}"</span>
            ${r.merchant ? `<span class="text-slate-400 font-normal">&rarr; ${escapeHtml(r.merchant)}</span>` : ''}
          </div>
          <div class="text-[11px] text-slate-400 flex items-center space-x-2">
            <span>Category: <strong class="text-slate-200">${r.category}</strong></span>
            <span>•</span>
            <span>Tier: <strong class="text-slate-200">${r.grouping}</strong></span>
          </div>
        </div>
        <button onclick="window.app.deleteRule(${idx})" class="p-1.5 text-rose-400 hover:text-white rounded-lg hover:bg-rose-600 transition" title="Delete Rule">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  async saveNewRule(e) {
    e.preventDefault();
    const keyword = document.getElementById('rule-keyword').value.trim();
    const merchant = document.getElementById('rule-merchant').value.trim();
    const category = document.getElementById('rule-category').value;
    const grouping = document.getElementById('rule-grouping').value;

    if (!keyword) return alert('Keyword is required');

    this.customRules.push({ keyword, merchant, category, grouping });

    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: this.customRules })
      });
      document.getElementById('form-new-rule').reset();
      this.renderRulesList();
      alert(`Rule created! Click "Re-apply All Rules Now" to re-classify existing transactions.`);
    } catch (err) {
      alert('Failed to save rule: ' + err.message);
    }
  }

  async deleteRule(idx) {
    if (!confirm('Delete this categorization rule?')) return;
    this.customRules.splice(idx, 1);
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: this.customRules })
      });
      this.renderRulesList();
    } catch (err) {
      alert('Failed to delete rule: ' + err.message);
    }
  }

  async applyRulesToAllTransactions() {
    if (!confirm(`Re-apply all ${this.customRules.length} custom rules to your entire transaction history?`)) return;

    let updatedCount = 0;
    this.transactions.forEach(t => {
      const withdrawal = t.type === 'expense' ? t.amount : 0;
      const deposit = t.type === 'income' ? t.amount : 0;
      const cat = categorizeTransaction({ narration: t.narration, withdrawal, deposit }, this.customRules);

      if (cat.category !== t.category || cat.grouping !== t.grouping) {
        t.category = cat.category;
        t.categoryName = cat.categoryName;
        t.categoryIcon = cat.categoryIcon;
        t.categoryColor = cat.categoryColor;
        t.grouping = cat.grouping;
        if (cat.merchant) t.merchant = cat.merchant;
        updatedCount++;
      }
    });

    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: this.transactions })
      });
      await this.fetchTransactions();
      this.renderAll();
      if (window.confetti) window.confetti({ particleCount: 50, spread: 60 });
      alert(`Successfully re-classified ${updatedCount} transactions according to your custom rules!`);
    } catch (err) {
      alert('Error updating transactions: ' + err.message);
    }
  }

  // --- EXECUTIVE 1-PAGE PRINTABLE REPORT ---
  openExecutiveReport() {
    const modal = document.getElementById('modal-exec-report');
    const area = document.getElementById('report-printable-area');
    if (!modal || !area) return;

    const txs = this.getFilteredTransactions();
    const periodDisplay = document.getElementById('current-period-display')?.textContent.trim() || 'Current Period';

    let totalIn = 0;
    let totalOut = 0;
    let needs = 0;
    let wants = 0;
    let luxury = 0;
    let savings = 0;

    txs.forEach(t => {
      const a = Number(t.amount) || 0;
      if (t.type === 'income') totalIn += a;
      else {
        totalOut += a;
        if (t.grouping === GROUPINGS.NEED) needs += a;
        else if (t.grouping === GROUPINGS.WANT) wants += a;
        else if (t.grouping === GROUPINGS.LUXURY) luxury += a;
        else if (t.grouping === GROUPINGS.SAVINGS) savings += a;
      }
    });

    const netSurplus = totalIn - totalOut;
    const savingsRate = totalIn > 0 ? Math.round((netSurplus / totalIn) * 100) : 0;

    const catMap = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const name = t.categoryName || t.category || 'Other';
      catMap[name] = (catMap[name] || 0) + (Number(t.amount) || 0);
    });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const merchMap = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const name = t.merchant || 'Direct Debit';
      merchMap[name] = (merchMap[name] || 0) + (Number(t.amount) || 0);
    });
    const topMerchs = Object.entries(merchMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    area.innerHTML = `
      <div class="space-y-6">
        <!-- Report Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-700">
          <div>
            <h1 class="text-2xl font-extrabold tracking-tight">FinTrack Pro — HDFC Executive Statement Report</h1>
            <p class="text-xs text-slate-400 mt-1">Statement Period: <strong>${escapeHtml(periodDisplay)}</strong> | Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <div class="text-right">
            <span class="text-xs font-mono font-bold px-3 py-1 rounded-full ${savingsRate >= 20 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
              Savings Rate: ${savingsRate}%
            </span>
          </div>
        </div>

        <!-- Executive Financial Snapshot -->
        <div class="grid grid-cols-4 gap-4">
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div class="text-[10px] uppercase font-bold text-slate-400">Total Inflows (Credits)</div>
            <div class="text-lg font-bold font-mono text-emerald-400 mt-1">${formatINR(totalIn)}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div class="text-[10px] uppercase font-bold text-slate-400">Total Outflows (Debits)</div>
            <div class="text-lg font-bold font-mono text-rose-400 mt-1">${formatINR(totalOut)}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div class="text-[10px] uppercase font-bold text-slate-400">Net Retained Surplus</div>
            <div class="text-lg font-bold font-mono ${netSurplus >= 0 ? 'text-indigo-400' : 'text-rose-400'} mt-1">${netSurplus >= 0 ? '+' : ''}${formatINR(netSurplus)}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div class="text-[10px] uppercase font-bold text-slate-400">Statement Transactions</div>
            <div class="text-lg font-bold font-mono text-white mt-1">${txs.length}</div>
          </div>
        </div>

        <!-- 50/30/20 Benchmark Breakdown -->
        <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300">50/30/20 Budgeting Rule Analysis</h3>
          <div class="grid grid-cols-3 gap-3 text-xs">
            <div class="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div class="flex justify-between font-bold text-blue-400">
                <span>Needs (Essential)</span>
                <span>${totalOut > 0 ? Math.round((needs / totalOut) * 100) : 0}%</span>
              </div>
              <div class="font-mono text-base font-bold text-white mt-1">${formatINR(needs)}</div>
              <div class="text-[10px] text-slate-500 mt-1">Benchmark: &le; 50%</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div class="flex justify-between font-bold text-amber-400">
                <span>Wants (Lifestyle)</span>
                <span>${totalOut > 0 ? Math.round((wants / totalOut) * 100) : 0}%</span>
              </div>
              <div class="font-mono text-base font-bold text-white mt-1">${formatINR(wants)}</div>
              <div class="text-[10px] text-slate-500 mt-1">Benchmark: &le; 30%</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div class="flex justify-between font-bold text-fuchsia-400">
                <span>Luxury (Splurge)</span>
                <span>${totalOut > 0 ? Math.round((luxury / totalOut) * 100) : 0}%</span>
              </div>
              <div class="font-mono text-base font-bold text-white mt-1">${formatINR(luxury)}</div>
              <div class="text-[10px] text-slate-500 mt-1">Benchmark: &le; 10%</div>
            </div>
          </div>
        </div>

        <!-- Top Categories & Top Merchants Side-by-Side -->
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300">Top 5 Spending Categories</h4>
            <div class="space-y-1.5 divide-y divide-slate-800/60 text-xs">
              ${topCats.map(([cat, amt]) => `
                <div class="pt-1.5 flex justify-between items-center">
                  <span class="text-slate-300 truncate">${escapeHtml(cat)}</span>
                  <span class="font-mono font-bold text-rose-400">${formatINR(amt)}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300">Top 5 Payees & Merchants</h4>
            <div class="space-y-1.5 divide-y divide-slate-800/60 text-xs">
              ${topMerchs.map(([m, amt]) => `
                <div class="pt-1.5 flex justify-between items-center">
                  <span class="text-slate-300 truncate">${escapeHtml(m)}</span>
                  <span class="font-mono font-bold text-amber-400">${formatINR(amt)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Footer Signoff -->
        <div class="pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
          <span>Prepared via FinTrack Pro Local-First HDFC Intelligence Engine</span>
          <span>Confidential Personal Financial Statement</span>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }


  closeExecutiveReport() {
    const modal = document.getElementById('modal-exec-report');
    if (modal) modal.classList.add('hidden');
  }

  // --- FULL SYSTEM BACKUP & RESTORE ---
  openBackupModal() {
    const modal = document.getElementById('modal-backup');
    if (modal) modal.classList.remove('hidden');
  }

  closeBackupModal() {
    const modal = document.getElementById('modal-backup');
    if (modal) modal.classList.add('hidden');
  }

  async downloadFullBackup() {
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Backup export failed');

      const jsonString = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data.backup, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `FinTrack_HDFC_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('Error creating backup: ' + err.message);
    }
  }

  async restoreFromBackupFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm(`Restore all transactions and rules from "${file.name}"? This will update your current database.`)) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.closeBackupModal();
        await this.fetchRules();
        await this.fetchTransactions();
        this.renderAll();
        if (window.confetti) window.confetti({ particleCount: 70, spread: 80 });
        alert(`Backup restored successfully! Loaded ${data.restoredTransactions} transactions and ${data.restoredRules} custom rules.`);
      } else {
        alert('Restore failed: ' + data.error);
      }
    } catch (err) {
      alert('Error reading backup file: ' + err.message);
    }
  }

  // --- MULTI-ACCOUNT FILTER ---
  setAccountFilter(val) {
    this.accountFilter = val;
    this.renderAll();
  }

  // --- "ASK FINTRACK" NATURAL LANGUAGE CONVERSATIONAL FINANCIAL SEARCH ---
  askFinTrack(query) {
    const q = (query || '').trim();
    const answerContainer = document.getElementById('ask-fintrack-answer');
    if (!answerContainer) return;
    if (!q) return;

    answerContainer.classList.remove('hidden');

    const lower = q.toLowerCase();

    // 1. Detect target month if mentioned in query (e.g. October, November, September, etc.)
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    let targetMonthIdx = -1;
    months.forEach((m, idx) => {
      if (lower.includes(m) || lower.includes(m.slice(0, 3))) {
        targetMonthIdx = idx;
      }
    });

    let targetYear = 2026;
    if (lower.includes('2025')) targetYear = 2025;

    // Filter candidate transactions
    let pool = this.transactions;
    if (targetMonthIdx !== -1) {
      pool = pool.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === targetMonthIdx && d.getFullYear() === targetYear;
      });
    }

    const monthLabel = targetMonthIdx !== -1 ? `${months[targetMonthIdx].charAt(0).toUpperCase() + months[targetMonthIdx].slice(1)} ${targetYear}` : 'all statement history';

    let matchedTxs = [];
    let narrative = '';
    let categoryFound = null;

    // A. Amount filters (e.g. >10000 or debits above 10000)
    const amtMatch = lower.match(/(?:>|above|over|greater than)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)/i);
    const amtLessMatch = lower.match(/(?:<|below|under|less than)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)/i);

    if (amtMatch) {
      const thresh = parseFloat(amtMatch[1].replace(/,/g, ''));
      matchedTxs = pool.filter(t => (Number(t.amount) || 0) > thresh && t.type === 'expense');
      const total = matchedTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      narrative = `Found <strong>${matchedTxs.length} expenses</strong> exceeding <strong>₹${thresh.toLocaleString('en-IN')}</strong> in ${monthLabel}, totaling <strong>${formatINR(total)}</strong>.`;
    } else if (amtLessMatch) {
      const thresh = parseFloat(amtLessMatch[1].replace(/,/g, ''));
      matchedTxs = pool.filter(t => (Number(t.amount) || 0) < thresh && t.type === 'expense');
      const total = matchedTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      narrative = `Found <strong>${matchedTxs.length} micro-expenses</strong> under <strong>₹${thresh.toLocaleString('en-IN')}</strong> in ${monthLabel}, totaling <strong>${formatINR(total)}</strong>.`;
    } else if (lower.includes('biggest') || lower.includes('highest') || lower.includes('largest') || lower.includes('max')) {
      const isIncome = lower.includes('credit') || lower.includes('inflow') || lower.includes('income');
      const subPool = pool.filter(t => isIncome ? t.type === 'income' : t.type === 'expense');
      const sorted = subPool.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
      if (sorted.length > 0) {
        matchedTxs = sorted.slice(0, 5);
        narrative = `Your largest single ${isIncome ? 'inflow' : 'debit'} in ${monthLabel} was <strong>${formatINR(matchedTxs[0].amount)}</strong> on <strong>${matchedTxs[0].date}</strong> to <strong>${escapeHtml(matchedTxs[0].merchant || matchedTxs[0].narration)}</strong> (${matchedTxs[0].categoryName || matchedTxs[0].category}).`;
      }
    } else if (lower.includes('trading') || lower.includes('dhan') || lower.includes('fyers') || lower.includes('broker') || lower.includes('zerodha')) {
      matchedTxs = pool.filter(t => (t.narration || '').toUpperCase().includes('FYERS') || (t.narration || '').toUpperCase().includes('RAISE') || (t.narration || '').toUpperCase().includes('MONEYLICIOUS') || t.category === 'investment_income' || t.category === 'trading_investment');
      const inflows = matchedTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const outflows = matchedTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      narrative = `Across trading accounts in ${monthLabel}: You received <strong>${formatINR(inflows)}</strong> in capital payouts and deployed <strong>${formatINR(outflows)}</strong> in market capital.`;
    } else if (lower.includes('salary') || lower.includes('ascendion') || lower.includes('payroll')) {
      matchedTxs = pool.filter(t => t.category === 'salary' || (t.narration || '').includes('ASCENDION'));
      const total = matchedTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      narrative = `Ascendion engineering payroll credits in ${monthLabel}: <strong>${formatINR(total)}</strong> across <strong>${matchedTxs.length} salary credits</strong>.`;
    } else {
      for (const cat of Object.values(CATEGORIES)) {
        if (lower.includes(cat.name.toLowerCase()) || lower.includes(cat.id.toLowerCase()) || (cat.id === 'dining' && (lower.includes('food') || lower.includes('swiggy') || lower.includes('zomato') || lower.includes('eating'))) || (cat.id === 'shopping' && (lower.includes('clothes') || lower.includes('zudio') || lower.includes('amazon')))) {
          categoryFound = cat;
          break;
        }
      }

      if (categoryFound) {
        matchedTxs = pool.filter(t => t.category === categoryFound.id || (t.narration || '').toLowerCase().includes(categoryFound.id));
        const total = matchedTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const avg = matchedTxs.length > 0 ? Math.round(total / matchedTxs.length) : 0;
        narrative = `You spent a total of <strong>${formatINR(total)}</strong> on <strong>${escapeHtml(categoryFound.name)}</strong> across <strong>${matchedTxs.length} transactions</strong> in ${monthLabel} (Average order: <strong>${formatINR(avg)}</strong>).`;
      } else {
        const words = lower.split(' ').filter(w => w.length > 2 && !['how', 'much', 'did', 'spend', 'what', 'show', 'all', 'the', 'for'].includes(w));
        matchedTxs = pool.filter(t => words.some(w => (t.merchant || '').toLowerCase().includes(w) || (t.narration || '').toLowerCase().includes(w)));
        const total = matchedTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        narrative = `Found <strong>${matchedTxs.length} transactions</strong> matching "${escapeHtml(words.join(' '))}" in ${monthLabel}, totaling <strong>${formatINR(total)}</strong>.`;
      }
    }

    if (matchedTxs.length === 0) {
      answerContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
          No matching transactions found for "${escapeHtml(q)}". Try searching for "dining", "Zudio", "Ascendion", or ">10000".
        </div>
      `;
      return;
    }

    answerContainer.innerHTML = `
      <div class="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/40 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="text-xs text-slate-200 leading-relaxed">${narrative}</div>
          <button onclick="document.getElementById('ask-fintrack-answer').classList.add('hidden')" class="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <div class="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto">
          ${matchedTxs.slice(0, 8).map(t => {
            const isInc = t.type === 'income';
            return `
              <div onclick="window.app.openEditTxModal('${t.id}')" class="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 cursor-pointer flex items-center space-x-2 text-xs transition group">
                <span class="font-mono text-[10px] text-slate-400">${t.date}</span>
                <span class="font-semibold text-slate-200 group-hover:text-white truncate max-w-[140px]">${escapeHtml(t.merchant || t.narration)}</span>
                <span class="font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-rose-400'}">${isInc ? '+' : '-'}${formatINR(t.amount)}</span>
              </div>
            `;
          }).join('')}
          ${matchedTxs.length > 8 ? `<span class="text-[11px] text-slate-500 self-center">+ ${matchedTxs.length - 8} more</span>` : ''}
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // --- CATEGORY MONTHLY BUDGET LIMITS & OVERSPENDING GUARDRAILS ---
  async fetchBudgets() {
    try {
      const res = await fetch('/api/budgets');
      const data = await res.json();
      if (data.success) {
        this.categoryBudgets = data.budgets || {};
      }
    } catch (err) {
      console.warn('Could not load budgets:', err);
    }
  }

  openBudgetLimitsModal() {
    const modal = document.getElementById('modal-budget-limits');
    const container = document.getElementById('budget-inputs-container');
    if (!modal || !container) return;

    const expenseCats = Object.values(CATEGORIES).filter(c => c.type === 'expense');

    container.innerHTML = expenseCats.map(cat => {
      const currentVal = this.categoryBudgets[cat.id] || '';
      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0">
              <i data-lucide="${cat.icon}" class="w-3.5 h-3.5"></i>
            </div>
            <span class="font-bold text-slate-200 truncate">${escapeHtml(cat.name)}</span>
          </div>
          <div class="flex items-center space-x-2 flex-shrink-0">
            <span class="text-slate-500 text-xs font-mono">₹</span>
            <input type="number" name="budget_${cat.id}" value="${currentVal}" placeholder="No limit" class="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white text-right focus:outline-none focus:border-indigo-500">
          </div>
        </div>
      `;
    }).join('');

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }


  closeBudgetLimitsModal() {
    const modal = document.getElementById('modal-budget-limits');
    if (modal) modal.classList.add('hidden');
  }

  async saveBudgetLimits(e) {
    e.preventDefault();
    const form = document.getElementById('form-budget-limits');
    const formData = new FormData(form);
    const newBudgets = {};

    for (const [key, val] of formData.entries()) {
      if (key.startsWith('budget_')) {
        const catId = key.replace('budget_', '');
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
          newBudgets[catId] = num;
        }
      }
    }

    this.categoryBudgets = newBudgets;

    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgets: newBudgets })
      });
      this.closeBudgetLimitsModal();
      this.renderCategoryBudgets();
      alert('Monthly category budget caps saved successfully!');
    } catch (err) {
      alert('Failed to save budgets: ' + err.message);
    }
  }

  renderCategoryBudgets() {
    const grid = document.getElementById('category-budget-gauges-grid');
    const badge = document.getElementById('budget-overall-status-badge');
    const warningBanner = document.getElementById('overbudget-warning-banner');
    const warningText = document.getElementById('overbudget-warning-text');
    if (!grid) return;

    const txs = this.getFilteredTransactions();
    const spendByCat = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      spendByCat[t.category] = (spendByCat[t.category] || 0) + (Number(t.amount) || 0);
    });

    const budgetKeys = Object.keys(this.categoryBudgets);
    if (budgetKeys.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
          No category budgets set yet. Click "Set Limits" above to establish guardrails on Dining, Groceries, Shopping, etc.
        </div>
      `;
      if (warningBanner) warningBanner.classList.add('hidden');
      return;
    }

    const overspentList = [];

    grid.innerHTML = budgetKeys.map(catId => {
      const cat = Object.values(CATEGORIES).find(c => c.id === catId) || { name: catId, icon: 'tag' };
      const budget = this.categoryBudgets[catId] || 1;
      const spent = spendByCat[catId] || 0;
      const pct = Math.round((spent / budget) * 100);
      const isOver = (spent > budget);

      if (isOver) {
        overspentList.push(`${cat.name} (+${formatINR(spent - budget)})`);
      }

      let fillClass = 'bg-emerald-500';
      let textClass = 'text-emerald-400';
      if (pct >= 100) {
        fillClass = 'bg-rose-500';
        textClass = 'text-rose-400';
      } else if (pct >= 75) {
        fillClass = 'bg-amber-500';
        textClass = 'text-amber-400';
      }

      return `
        <div onclick="window.app.openCategoryTab('${catId}')" class="p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border ${isOver ? 'border-rose-500/50 shadow-sm shadow-rose-500/10' : 'border-slate-800'} cursor-pointer transition space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200 truncate flex items-center space-x-1.5">
              <i data-lucide="${cat.icon}" class="w-3.5 h-3.5 text-slate-400"></i>
              <span class="truncate">${escapeHtml(cat.name)}</span>
            </span>
            <span class="font-mono font-bold text-[11px] ${textClass}">${pct}%</span>
          </div>

          <div class="budget-meter-track">
            <div class="budget-meter-fill ${fillClass}" style="width: ${Math.min(100, pct)}%"></div>
          </div>

          <div class="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>Spent: ${formatINR(spent)}</span>
            <span>Limit: ${formatINR(budget)}</span>
          </div>
        </div>
      `;
    }).join('');

    if (overspentList.length > 0) {
      if (warningBanner) {
        warningBanner.classList.remove('hidden');
        if (warningText) warningText.textContent = `Warning: You exceeded your monthly cap in ${overspentList.join(', ')}!`;
      }
      if (badge) {
        badge.textContent = `${overspentList.length} Categories Over Budget ⚠️`;
        badge.className = 'px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20';
      }
    } else {
      if (warningBanner) warningBanner.classList.add('hidden');
      if (badge) {
        badge.textContent = 'All Budgets On Track ✨';
        badge.className = 'px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- MONTH-OVER-MONTH (MoM) COMPARISON & LIFESTYLE CREEP DETECTOR ---
  populateMoMMonths() {
    const selBase = document.getElementById('mom-base-month');
    const selTarget = document.getElementById('mom-target-month');
    if (!selBase || !selTarget) return;

    const ymSet = new Set();
    this.transactions.forEach(t => {
      if (t.date) ymSet.add(t.date.slice(0, 7));
    });

    const sortedYm = Array.from(ymSet).sort().reverse();
    if (sortedYm.length === 0) return;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatYm = ym => {
      const [y, m] = ym.split('-');
      return `${months[parseInt(m, 10) - 1]} ${y}`;
    };

    selBase.innerHTML = sortedYm.map(ym => `<option value="${ym}">${formatYm(ym)}</option>`).join('');
    selTarget.innerHTML = sortedYm.map(ym => `<option value="${ym}">${formatYm(ym)}</option>`).join('');

    selTarget.value = sortedYm[0];
    selBase.value = sortedYm.length > 1 ? sortedYm[1] : sortedYm[0];

    this.renderMoMComparison();
  }

  renderMoMComparison() {
    const selBase = document.getElementById('mom-base-month');
    const selTarget = document.getElementById('mom-target-month');
    const deltaCards = document.getElementById('mom-delta-cards');
    const tableBody = document.getElementById('mom-table-body');
    const thBase = document.getElementById('mom-th-base');
    const thTarget = document.getElementById('mom-th-target');

    if (!selBase || !selTarget || !deltaCards || !tableBody) return;

    const baseYM = selBase.value;
    const targetYM = selTarget.value;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatLabel = ym => {
      if (!ym) return 'Month';
      const [y, m] = ym.split('-');
      return `${months[parseInt(m, 10) - 1]} ${y}`;
    };

    if (thBase) thBase.textContent = formatLabel(baseYM);
    if (thTarget) thTarget.textContent = formatLabel(targetYM);

    const baseTxs = this.transactions.filter(t => (t.date || '').startsWith(baseYM));
    const targetTxs = this.transactions.filter(t => (t.date || '').startsWith(targetYM));

    let baseIn = 0, baseOut = 0;
    baseTxs.forEach(t => {
      const a = Number(t.amount) || 0;
      if (t.type === 'income') baseIn += a;
      else baseOut += a;
    });
    const baseSurplus = baseIn - baseOut;

    let targetIn = 0, targetOut = 0;
    targetTxs.forEach(t => {
      const a = Number(t.amount) || 0;
      if (t.type === 'income') targetIn += a;
      else targetOut += a;
    });
    const targetSurplus = targetIn - targetOut;

    const deltaIn = targetIn - baseIn;
    const deltaOut = targetOut - baseOut;
    const deltaSurplus = targetSurplus - baseSurplus;

    deltaCards.innerHTML = `
      <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span class="text-[10px] uppercase font-bold text-slate-400">Total Inflow Delta</span>
        <div class="text-base font-bold font-mono ${deltaIn >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          ${deltaIn >= 0 ? '+' : ''}${formatINR(deltaIn)}
        </div>
        <p class="text-[10px] text-slate-500">${formatINR(baseIn)} &rarr; ${formatINR(targetIn)}</p>
      </div>

      <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span class="text-[10px] uppercase font-bold text-slate-400">Outflow Variance</span>
        <div class="text-base font-bold font-mono ${deltaOut <= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          ${deltaOut >= 0 ? '+' : ''}${formatINR(deltaOut)}
        </div>
        <p class="text-[10px] text-slate-500">${formatINR(baseOut)} &rarr; ${formatINR(targetOut)} (${deltaOut > 0 ? 'Spent More' : 'Saved More'})</p>
      </div>

      <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span class="text-[10px] uppercase font-bold text-slate-400">Net Surplus Change</span>
        <div class="text-base font-bold font-mono ${deltaSurplus >= 0 ? 'text-indigo-400' : 'text-rose-400'}">
          ${deltaSurplus >= 0 ? '+' : ''}${formatINR(deltaSurplus)}
        </div>
        <p class="text-[10px] text-slate-500">Retained wealth difference</p>
      </div>
    `;

    const allCats = Object.values(CATEGORIES).filter(c => c.type === 'expense');
    const baseCatMap = {};
    baseTxs.filter(t => t.type === 'expense').forEach(t => {
      baseCatMap[t.category] = (baseCatMap[t.category] || 0) + (Number(t.amount) || 0);
    });
    const targetCatMap = {};
    targetTxs.filter(t => t.type === 'expense').forEach(t => {
      targetCatMap[t.category] = (targetCatMap[t.category] || 0) + (Number(t.amount) || 0);
    });

    const catRows = allCats.map(cat => {
      const bAmt = baseCatMap[cat.id] || 0;
      const tAmt = targetCatMap[cat.id] || 0;
      const diff = tAmt - bAmt;

      if (bAmt === 0 && tAmt === 0) return null;

      let pctChange = 0;
      if (bAmt > 0) {
        pctChange = Math.round((diff / bAmt) * 100);
      }

      let badgeHtml = '';
      if (diff > 1500 && pctChange >= 25) {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">Spiked +${pctChange}% 🔺</span>`;
      } else if (diff < -1500 && pctChange <= -20) {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Trimmed ${pctChange}% 🔻</span>`;
      } else if (bAmt === 0 && tAmt > 0) {
        badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">New Outflow</span>`;
      } else {
        badgeHtml = `<span class="text-slate-500 text-[10px]">Normal (${pctChange >= 0 ? '+' : ''}${pctChange}%)</span>`;
      }

      return {
        cat,
        bAmt,
        tAmt,
        diff,
        badgeHtml
      };
    }).filter(Boolean);

    catRows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    tableBody.innerHTML = catRows.map(r => `
      <tr class="hover:bg-slate-900/60 transition cursor-pointer" onclick="window.app.openCategoryTab('${r.cat.id}')">
        <td class="p-3 text-slate-200 font-bold flex items-center space-x-2">
          <i data-lucide="${r.cat.icon}" class="w-3.5 h-3.5 text-indigo-400"></i>
          <span>${escapeHtml(r.cat.name)}</span>
        </td>
        <td class="p-3 text-slate-400">${formatINR(r.bAmt)}</td>
        <td class="p-3 text-slate-200 font-bold">${formatINR(r.tAmt)}</td>
        <td class="p-3 font-bold ${r.diff > 0 ? 'text-rose-400' : (r.diff < 0 ? 'text-emerald-400' : 'text-slate-500')}">
          ${r.diff > 0 ? '+' : ''}${formatINR(r.diff)}
        </td>
        <td class="p-3 text-right whitespace-nowrap">${r.badgeHtml}</td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // --- MERCHANT DEEP-DIVE PROFILE MODAL ---
  openMerchantProfile(merchantName) {
    const modal = document.getElementById('modal-merchant-profile');
    const nameEl = document.getElementById('merchant-profile-name');
    const catBadge = document.getElementById('merchant-profile-cat-badge');
    const datesEl = document.getElementById('merchant-profile-dates');
    const statTotal = document.getElementById('merchant-stat-total');
    const statCount = document.getElementById('merchant-stat-count');
    const statAvg = document.getElementById('merchant-stat-avg');
    const statMax = document.getElementById('merchant-stat-max');
    const txsList = document.getElementById('merchant-profile-txs');
    const iconEl = document.getElementById('merchant-profile-icon');

    if (!modal) return;

    const m = (merchantName || '').trim().toLowerCase();
    const matched = this.transactions.filter(t => {
      const merch = (t.merchant || '').toLowerCase();
      const narr = (t.narration || '').toLowerCase();
      return merch === m || merch.includes(m) || narr.includes(m);
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (matched.length === 0) return alert(`No detailed history found for "${merchantName}".`);

    const total = matched.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const avg = Math.round(total / matched.length);
    const max = Math.max(...matched.map(t => Number(t.amount) || 0));

    const dates = matched.map(t => t.date).sort();
    const firstSeen = dates[0];
    const lastSeen = dates[dates.length - 1];

    const firstTx = matched[0];
    const meta = getCategoryMeta(firstTx.category, firstTx.type);

    if (nameEl) nameEl.textContent = firstTx.merchant || merchantName;
    if (catBadge) {
      catBadge.textContent = meta.name;
      catBadge.className = `px-2 py-0.5 rounded-md text-[10px] font-bold ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`;
    }
    if (datesEl) datesEl.textContent = `Active from ${firstSeen} to ${lastSeen} (${matched.length} debits)`;

    if (statTotal) statTotal.textContent = formatINR(total);
    if (statCount) statCount.textContent = String(matched.length);
    if (statAvg) statAvg.textContent = formatINR(avg);
    if (statMax) statMax.textContent = formatINR(max);

    if (iconEl) {
      iconEl.className = `w-12 h-12 rounded-2xl ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center cat-avatar shadow`;
      iconEl.innerHTML = `<i data-lucide="${meta.icon}" class="w-6 h-6"></i>`;
    }

    if (txsList) {
      txsList.innerHTML = matched.map(t => `
        <div class="p-3 flex items-center justify-between hover:bg-slate-900 transition">
          <div class="space-y-0.5 min-w-0 pr-2">
            <div class="font-mono text-slate-400 text-[11px]">${t.date}</div>
            <div class="text-slate-300 text-xs truncate font-medium">${escapeHtml(t.narration)}</div>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="font-mono font-bold text-sm ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
              ${t.type === 'income' ? '+' : '-'}${formatINR(t.amount)}
            </span>
          </div>
        </div>
      `).join('');
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeMerchantProfile() {
    const modal = document.getElementById('modal-merchant-profile');
    if (modal) modal.classList.add('hidden');
  }

  // --- INTERACTIVE SANKEY CASH FLOW PIPELINE ---
  renderSankeyFlow() {
    const container = document.getElementById('sankey-container');
    const tagEl = document.getElementById('sankey-timeframe-tag');
    if (!container) return;

    const txs = this.getFilteredTransactions();
    const periodDisplay = document.getElementById('current-period-display')?.textContent.trim() || 'Current Period';
    if (tagEl) tagEl.textContent = periodDisplay;

    let salaryIn = 0, tradingIn = 0, pfIn = 0, otherIn = 0;
    let needsOut = 0, wantsOut = 0, luxuryOut = 0, savingsOut = 0;
    const catOut = {};

    txs.forEach(t => {
      const a = Number(t.amount) || 0;
      if (t.type === 'income') {
        if (t.category === 'salary') salaryIn += a;
        else if (t.category === 'investment_income') tradingIn += a;
        else if (t.category === 'pf_retirement') pfIn += a;
        else otherIn += a;
      } else {
        if (t.grouping === GROUPINGS.NEED) needsOut += a;
        else if (t.grouping === GROUPINGS.WANT) wantsOut += a;
        else if (t.grouping === GROUPINGS.LUXURY) luxuryOut += a;
        else if (t.grouping === GROUPINGS.SAVINGS) savingsOut += a;

        catOut[t.category] = (catOut[t.category] || 0) + a;
      }
    });

    const totalIn = salaryIn + tradingIn + pfIn + otherIn;
    const totalOut = needsOut + wantsOut + luxuryOut + savingsOut;
    const netRetained = Math.max(0, totalIn - totalOut);

    const top5Cats = Object.entries(catOut).sort((a, b) => b[1] - a[1]).slice(0, 5);

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <!-- Stage 1: Inflow Sources -->
        <div class="sankey-column">
          <div class="text-[10px] uppercase font-bold text-emerald-400 tracking-wider mb-1">1. Inflow Sources</div>
          <div class="sankey-node bg-emerald-950/40 border border-emerald-600/40 text-emerald-200">
            <div class="flex justify-between font-bold text-xs"><span>Salary</span><span>${formatINR(salaryIn)}</span></div>
          </div>
          <div class="sankey-node bg-teal-950/40 border border-teal-600/40 text-teal-200">
            <div class="flex justify-between font-bold text-xs"><span>Trading Payouts</span><span>${formatINR(tradingIn)}</span></div>
          </div>
          <div class="sankey-node bg-cyan-950/40 border border-cyan-600/40 text-cyan-200">
            <div class="flex justify-between font-bold text-xs"><span>PF Advance</span><span>${formatINR(pfIn)}</span></div>
          </div>
          <div class="sankey-node bg-slate-900 border border-slate-800 text-slate-300">
            <div class="flex justify-between font-bold text-xs"><span>Other Inflows</span><span>${formatINR(otherIn)}</span></div>
          </div>
        </div>

        <!-- Stage 2: Central Bank Hub -->
        <div class="sankey-column justify-center">
          <div class="text-[10px] uppercase font-bold text-indigo-400 tracking-wider mb-1">2. Central Bank Hub</div>
          <div class="sankey-node bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/50 p-4 text-center">
            <div class="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">HDFC Primary Inflows</div>
            <div class="font-mono text-xl font-extrabold text-white mt-1">${formatINR(totalIn)}</div>
            <div class="text-[10px] text-indigo-200/80 mt-1">${txs.filter(t => t.type === 'income').length} credit events</div>
          </div>
        </div>

        <!-- Stage 3: 50/30/20 Budget Tiers -->
        <div class="sankey-column">
          <div class="text-[10px] uppercase font-bold text-amber-400 tracking-wider mb-1">3. Budget Allocation</div>
          <div class="sankey-node bg-blue-950/40 border border-blue-600/40 text-blue-200">
            <div class="flex justify-between font-bold text-xs"><span>Needs (50%)</span><span>${formatINR(needsOut)}</span></div>
          </div>
          <div class="sankey-node bg-amber-950/40 border border-amber-600/40 text-amber-200">
            <div class="flex justify-between font-bold text-xs"><span>Wants (30%)</span><span>${formatINR(wantsOut)}</span></div>
          </div>
          <div class="sankey-node bg-fuchsia-950/40 border border-fuchsia-600/40 text-fuchsia-200">
            <div class="flex justify-between font-bold text-xs"><span>Luxury (10%)</span><span>${formatINR(luxuryOut)}</span></div>
          </div>
          <div class="sankey-node bg-emerald-950/40 border border-emerald-600/40 text-emerald-200">
            <div class="flex justify-between font-bold text-xs"><span>Savings & Retained</span><span>${formatINR(savingsOut + netRetained)}</span></div>
          </div>
        </div>

        <!-- Stage 4: Outflow Destinations -->
        <div class="sankey-column">
          <div class="text-[10px] uppercase font-bold text-rose-400 tracking-wider mb-1">4. Top Spend Destinations</div>
          ${top5Cats.map(([catId, amt]) => {
            const cat = Object.values(CATEGORIES).find(c => c.id === catId) || { name: catId };
            return `
              <div onclick="window.app.openCategoryTab('${catId}')" class="sankey-node bg-slate-900 border border-slate-800 hover:border-indigo-400 text-slate-200">
                <div class="flex justify-between font-bold text-xs truncate">
                  <span class="truncate">${escapeHtml(cat.name)}</span>
                  <span class="font-mono text-rose-400 ml-1">${formatINR(amt)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // --- FIRE & FINANCIAL FREEDOM CALCULATOR ---
  renderFIREMetrics() {
    const elBurn = document.getElementById('fire-annual-burn');
    const elStd = document.getElementById('fire-standard-target');
    const elLean = document.getElementById('fire-lean-target');
    const elFat = document.getElementById('fire-fat-target');
    const elBadge = document.getElementById('fire-freedom-days-badge');
    const elVerdict = document.getElementById('fire-verdict-text');

    if (!elBurn || !elStd) return;

    const txs = this.getFilteredTransactions();
    let totalIn = 0, totalOut = 0, livingOut = 0;
    txs.forEach(t => {
      const a = Number(t.amount) || 0;
      if (t.type === 'income') totalIn += a;
      else {
        totalOut += a;
        if (t.grouping !== GROUPINGS.SAVINGS) livingOut += a;
      }
    });

    const monthlyLiving = livingOut > 0 ? livingOut : 45000;
    const annualLiving = monthlyLiving * 12;

    const stdFire = annualLiving * 25; // 4% rule
    const leanFire = (annualLiving * 0.8) * 20; // 5% rule for essential survival
    const fatFire = (annualLiving * 1.5) * 33; // 3% rule for luxury

    const netSurplus = Math.max(0, totalIn - totalOut);
    const dailyLivingCost = Math.max(1, Math.round(monthlyLiving / 30));
    const freedomDays = Math.round(netSurplus / dailyLivingCost);

    elBurn.textContent = formatINR(annualLiving);
    elStd.textContent = formatINR(stdFire);
    elLean.textContent = formatINR(leanFire);
    elFat.textContent = formatINR(fatFire);

    if (elBadge) elBadge.textContent = `${freedomDays} Freedom Days Earned! 🏖️`;
    if (elVerdict) {
      elVerdict.textContent = `At your current savings velocity, every month of work is funding ${freedomDays} days of complete financial freedom.`;
    }
  }

  // --- RECURRING SUBSCRIPTIONS & ZOMBIE HUNTER (FEATURE 1) ---
  renderSubscriptionsTab() {
    const kpiMonthly = document.getElementById('sub-kpi-monthly');
    const kpiAnnual = document.getElementById('sub-kpi-annual');
    const kpiCount = document.getElementById('sub-kpi-count');
    const kpiZombie = document.getElementById('sub-kpi-zombie');
    const timelineContainer = document.getElementById('sub-timeline-container');
    const cardsGrid = document.getElementById('sub-cards-grid');
    const countBadge = document.getElementById('sub-detected-badge');

    if (!cardsGrid) return;

    const expenses = this.transactions.filter(t => t.type === 'expense');
    const groups = {};

    expenses.forEach(t => {
      const merchant = t.merchant || 'Direct Debit';
      const key = merchant.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          name: merchant,
          category: t.category,
          categoryName: t.categoryName,
          txs: []
        };
      }
      groups[key].txs.push(t);
    });

    const recurring = [];
    let zombieTotalMonthly = 0;

    Object.values(groups).forEach(g => {
      const months = new Set(g.txs.map(t => t.date.slice(0, 7)));
      const isKnownService = /netflix|spotify|prime|amazon|youtube|apple|google|hotstar|cult|airtel|jio|broadband|wifi|gym|fit|insurance|lic|sip|zerodha|groww/i.test(g.name);
      
      if (months.size >= 2 || (isKnownService && g.txs.length >= 1)) {
        const amounts = g.txs.map(t => Number(t.amount) || 0);
        const avgAmt = Math.round(amounts.reduce((a, b) => a + b, 0) / Math.max(1, months.size));
        const sortedTxs = g.txs.sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastTx = sortedTxs[0];
        const lastDay = new Date(lastTx.date).getDate();

        let priceCreep = false;
        if (sortedTxs.length >= 2) {
          const oldest = Number(sortedTxs[sortedTxs.length - 1].amount) || 0;
          const newest = Number(lastTx.amount) || 0;
          if (newest > oldest * 1.05 && oldest > 0) priceCreep = true;
        }

        const isZombie = (g.category === 'entertainment' || /netflix|spotify|prime|hotstar|youtube|patreon/i.test(g.name)) && avgAmt < 2000;
        if (isZombie) zombieTotalMonthly += avgAmt;

        const now = new Date();
        const nextChargeMonth = (now.getDate() > lastDay) ? now.getMonth() + 1 : now.getMonth();
        const nextChargeDate = new Date(now.getFullYear(), nextChargeMonth, Math.min(lastDay, 28));
        const dateStr = nextChargeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        recurring.push({
          name: g.name,
          category: g.category,
          categoryName: g.categoryName,
          monthlyAmount: avgAmt,
          lastDay,
          nextChargeStr: dateStr,
          priceCreep,
          isZombie,
          lastDate: lastTx.date,
          count: g.txs.length
        });
      }
    });

    recurring.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

    const totalMonthly = recurring.reduce((s, r) => s + r.monthlyAmount, 0);
    const totalAnnual = totalMonthly * 12;

    if (kpiMonthly) kpiMonthly.textContent = `${formatINR(totalMonthly)} / mo`;
    if (kpiAnnual) kpiAnnual.textContent = `${formatINR(totalAnnual)} / yr`;
    if (kpiCount) kpiCount.textContent = String(recurring.length);
    if (kpiZombie) kpiZombie.textContent = `${formatINR(zombieTotalMonthly)} / mo`;
    if (countBadge) countBadge.textContent = `${recurring.length} services`;

    if (timelineContainer) {
      if (recurring.length === 0) {
        timelineContainer.innerHTML = `<div class="text-xs text-slate-500 py-2">No upcoming subscriptions recorded.</div>`;
      } else {
        timelineContainer.innerHTML = recurring.slice(0, 10).map(r => {
          const meta = getCategoryMeta(r.category, 'expense');
          return `
            <div class="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-2.5 flex-shrink-0">
              <div class="w-7 h-7 rounded-lg ${meta.bgClass} ${meta.textClass} flex items-center justify-center font-bold text-xs">
                <i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i>
              </div>
              <div>
                <div class="text-xs font-bold text-slate-200 truncate max-w-[120px]">${escapeHtml(r.name)}</div>
                <div class="text-[10px] font-mono text-amber-400 font-bold">${formatINR(r.monthlyAmount)} &bull; ${r.nextChargeStr}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (recurring.length === 0) {
      cardsGrid.innerHTML = `<div class="col-span-3 p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">No recurring subscriptions or commitments identified yet. Upload multi-month bank statements to auto-detect.</div>`;
    } else {
      cardsGrid.innerHTML = recurring.map(r => {
        const meta = getCategoryMeta(r.category, 'expense');
        return `
          <div class="glass-card rounded-2xl p-5 border border-slate-800 space-y-3 sub-card">
            <div class="flex items-start justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl ${meta.bgClass} ${meta.borderClass} ${meta.textClass} border flex items-center justify-center cat-avatar shadow">
                  <i data-lucide="${meta.icon}" class="w-5 h-5"></i>
                </div>
                <div>
                  <h4 class="font-bold text-slate-100 text-sm">${escapeHtml(r.name)}</h4>
                  <span class="text-[10px] text-slate-400">${escapeHtml(r.categoryName || meta.name)}</span>
                </div>
              </div>
              <div class="text-right">
                <div class="font-mono text-base font-extrabold text-white">${formatINR(r.monthlyAmount)}</div>
                <span class="text-[10px] text-slate-400 font-medium">per month</span>
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5 pt-1 text-[10px]">
              <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">📅 Charges on ${r.lastDay}th</span>
              <span class="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-mono">Next: ${r.nextChargeStr}</span>
              ${r.priceCreep ? '<span class="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">⚠️ Price Creep</span>' : '<span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300">✓ Steady Price</span>'}
              ${r.isZombie ? '<span class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">🧟 Zombie Alert</span>' : ''}
            </div>

            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span class="text-[11px] text-slate-500 font-mono">${r.count} debits recorded</span>
              <button onclick="window.app.openMerchantProfile('${escapeHtml(r.name)}')" class="text-indigo-400 hover:text-indigo-300 text-xs font-semibold hover:underline">
                View Ledger &rarr;
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- INDIAN INCOME TAX PLANNER & DEDUCTIONS LEDGER (FEATURE 2) ---
  renderTaxPlanner() {
    const inputGross = document.getElementById('tax-gross-salary-input');
    
    if (!this.taxGrossSalary) {
      const salaryTxs = this.transactions.filter(t => t.category === 'salary');
      if (salaryTxs.length > 0) {
        const totalSalary = salaryTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const months = new Set(salaryTxs.map(t => t.date.slice(0, 7))).size || 1;
        this.taxGrossSalary = Math.round((totalSalary / months) * 12);
      } else {
        this.taxGrossSalary = 1800000;
      }
    }

    if (inputGross && !inputGross.value) {
      inputGross.value = this.taxGrossSalary;
    }

    this.recalculateTax();
  }

  recalculateTax() {
    const inputGross = document.getElementById('tax-gross-salary-input');
    if (inputGross && Number(inputGross.value) > 0) {
      this.taxGrossSalary = Number(inputGross.value);
    }

    const gross = this.taxGrossSalary || 1800000;

    let tot80C = 0, tot80D = 0, totNps = 0;
    const deductibleTxs = [];

    this.transactions.forEach(t => {
      const tag = detectTaxTags(t);
      if (tag) {
        deductibleTxs.push({ tx: t, tag });
        if (tag.section === '80C') tot80C += tag.amount;
        else if (tag.section === '80D') tot80D += tag.amount;
        else if (tag.section === '80CCD(1B)') totNps += tag.amount;
      }
    });

    const eligible80C = Math.min(150000, tot80C);
    const eligible80D = Math.min(75000, tot80D);
    const eligibleNps = Math.min(50000, totNps);
    const totalDeductionsClaimed = eligible80C + eligible80D + eligibleNps;

    // NEW TAX REGIME
    const newStdDeduction = 75000;
    const newTaxable = Math.max(0, gross - newStdDeduction);
    let newTax = 0;

    if (newTaxable > 1500000) {
      newTax += (newTaxable - 1500000) * 0.30;
      newTax += 300000 * 0.20;
      newTax += 200000 * 0.15;
      newTax += 300000 * 0.10;
      newTax += 400000 * 0.05;
    } else if (newTaxable > 1200000) {
      newTax += (newTaxable - 1200000) * 0.20;
      newTax += 200000 * 0.15;
      newTax += 300000 * 0.10;
      newTax += 400000 * 0.05;
    } else if (newTaxable > 1000000) {
      newTax += (newTaxable - 1000000) * 0.15;
      newTax += 300000 * 0.10;
      newTax += 400000 * 0.05;
    } else if (newTaxable > 700000) {
      newTax += (newTaxable - 700000) * 0.10;
      newTax += 400000 * 0.05;
    } else if (newTaxable > 300000) {
      newTax += (newTaxable - 300000) * 0.05;
    }

    let newRebate = 0;
    if (newTaxable <= 700000) {
      newRebate = newTax;
      newTax = 0;
    }
    const newCess = Math.round(newTax * 0.04);
    const newTotalPayable = Math.round(newTax + newCess);

    // OLD TAX REGIME
    const oldStdDeduction = 50000;
    const oldTaxable = Math.max(0, gross - oldStdDeduction - totalDeductionsClaimed);
    let oldTax = 0;

    if (oldTaxable > 1000000) {
      oldTax += (oldTaxable - 1000000) * 0.30;
      oldTax += 500000 * 0.20;
      oldTax += 250000 * 0.05;
    } else if (oldTaxable > 500000) {
      oldTax += (oldTaxable - 500000) * 0.20;
      oldTax += 250000 * 0.05;
    } else if (oldTaxable > 250000) {
      oldTax += (oldTaxable - 250000) * 0.05;
    }

    if (oldTaxable <= 500000) oldTax = 0;
    const oldCess = Math.round(oldTax * 0.04);
    const oldTotalPayable = Math.round(oldTax + oldCess);

    // Update UI elements
    const elNewGross = document.getElementById('new-regime-gross');
    const elNewTaxable = document.getElementById('new-regime-taxable');
    const elNewRebate = document.getElementById('new-regime-rebate');
    const elNewCess = document.getElementById('new-regime-cess');
    const elNewTotal = document.getElementById('new-regime-total-tax');

    if (elNewGross) elNewGross.textContent = formatINR(gross);
    if (elNewTaxable) elNewTaxable.textContent = formatINR(newTaxable);
    if (elNewRebate) elNewRebate.textContent = newRebate > 0 ? `-${formatINR(newRebate)}` : '₹0';
    if (elNewCess) elNewCess.textContent = formatINR(newCess);
    if (elNewTotal) elNewTotal.textContent = formatINR(newTotalPayable);

    const elOldGross = document.getElementById('old-regime-gross');
    const elOldDeductions = document.getElementById('old-regime-deductions');
    const elOldTaxable = document.getElementById('old-regime-taxable');
    const elOldCess = document.getElementById('old-regime-cess');
    const elOldTotal = document.getElementById('old-regime-total-tax');

    if (elOldGross) elOldGross.textContent = formatINR(gross);
    if (elOldDeductions) elOldDeductions.textContent = `-${formatINR(totalDeductionsClaimed)}`;
    if (elOldTaxable) elOldTaxable.textContent = formatINR(oldTaxable);
    if (elOldCess) elOldCess.textContent = formatINR(oldCess);
    if (elOldTotal) elOldTotal.textContent = formatINR(oldTotalPayable);

    const winnerHeadline = document.getElementById('tax-winner-headline');
    const winnerSubtext = document.getElementById('tax-winner-subtext');
    const savingsDiff = document.getElementById('tax-savings-diff-val');
    const newCard = document.getElementById('card-new-tax-regime');
    const oldCard = document.getElementById('card-old-tax-regime');

    const diff = Math.abs(oldTotalPayable - newTotalPayable);
    if (savingsDiff) savingsDiff.textContent = formatINR(diff);

    if (newTotalPayable < oldTotalPayable) {
      if (winnerHeadline) winnerHeadline.textContent = `🎉 Switch to New Tax Regime (Saves ${formatINR(diff)}!)`;
      if (winnerSubtext) winnerSubtext.textContent = `Standard deduction and streamlined slabs provide maximum take-home cash.`;
      if (newCard) newCard.classList.add('border-emerald-500/60', 'shadow-emerald-500/10');
      if (oldCard) oldCard.classList.remove('border-emerald-500/60', 'shadow-emerald-500/10');
    } else if (oldTotalPayable < newTotalPayable) {
      if (winnerHeadline) winnerHeadline.textContent = `🎉 Opt for Old Tax Regime (Saves ${formatINR(diff)}!)`;
      if (winnerSubtext) winnerSubtext.textContent = `Your high investments in Section 80C, 80D, and NPS make Old Regime more tax-efficient.`;
      if (oldCard) oldCard.classList.add('border-emerald-500/60', 'shadow-emerald-500/10');
      if (newCard) newCard.classList.remove('border-emerald-500/60', 'shadow-emerald-500/10');
    } else {
      if (winnerHeadline) winnerHeadline.textContent = `Equally Efficient Under Both Regimes`;
      if (winnerSubtext) winnerSubtext.textContent = `Both regimes produce the same total tax liability.`;
    }

    const fill80c = document.getElementById('tax-80c-meter-fill');
    const badge80c = document.getElementById('tax-80c-gap-badge');
    const claim80c = document.getElementById('tax-80c-claimed');
    const gap80c = document.getElementById('tax-80c-gap');

    if (fill80c) fill80c.style.width = `${Math.min(100, Math.round((eligible80C / 150000) * 100))}%`;
    if (badge80c) badge80c.textContent = `${formatINR(eligible80C)} / ₹1.5L`;
    if (claim80c) claim80c.textContent = `Claimed: ${formatINR(eligible80C)}`;
    if (gap80c) gap80c.textContent = `Gap: ${formatINR(Math.max(0, 150000 - eligible80C))} left`;

    const fillNps = document.getElementById('tax-nps-meter-fill');
    const badgeNps = document.getElementById('tax-nps-gap-badge');
    const claimNps = document.getElementById('tax-nps-claimed');
    const gapNps = document.getElementById('tax-nps-gap');

    if (fillNps) fillNps.style.width = `${Math.min(100, Math.round((eligibleNps / 50000) * 100))}%`;
    if (badgeNps) badgeNps.textContent = `${formatINR(eligibleNps)} / ₹50k`;
    if (claimNps) claimNps.textContent = `Claimed: ${formatINR(eligibleNps)}`;
    if (gapNps) gapNps.textContent = `Gap: ${formatINR(Math.max(0, 50000 - eligibleNps))} left`;

    const fill80d = document.getElementById('tax-80d-meter-fill');
    const badge80d = document.getElementById('tax-80d-gap-badge');
    const claim80d = document.getElementById('tax-80d-claimed');
    const gap80d = document.getElementById('tax-80d-gap');

    if (fill80d) fill80d.style.width = `${Math.min(100, Math.round((eligible80D / 75000) * 100))}%`;
    if (badge80d) badge80d.textContent = `${formatINR(eligible80D)} / ₹75k`;
    if (claim80d) claim80d.textContent = `Claimed: ${formatINR(eligible80D)}`;
    if (gap80d) gap80d.textContent = `Gap: ${formatINR(Math.max(0, 75000 - eligible80D))} left`;

    const tbody = document.getElementById('tax-deductions-table-body');
    const countEl = document.getElementById('tax-deductions-count');
    if (countEl) countEl.textContent = `${deductibleTxs.length} items`;

    if (tbody) {
      if (deductibleTxs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">No tax-saving investments identified in statement yet.</td></tr>`;
      } else {
        tbody.innerHTML = deductibleTxs.map(({ tx, tag }) => `
          <tr class="hover:bg-slate-900/60 transition">
            <td class="p-3 text-slate-400 whitespace-nowrap">${tx.date}</td>
            <td class="p-3 font-semibold text-slate-200">${escapeHtml(tx.merchant || tx.narration)}</td>
            <td class="p-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                ${tag.section}
              </span>
            </td>
            <td class="p-3 text-right font-bold text-emerald-400 font-mono">${formatINR(tx.amount)}</td>
          </tr>
        `).join('');
      }
    }
  }

  // --- SHARED EXPENSES & GROUP SPLITTER + LIVE UPI QR (FEATURE 5) ---
  async fetchSplits() {
    try {
      const res = await fetch('/api/splits');
      const data = await res.json();
      if (data.success) {
        this.splits = data.splits || [];
      }
    } catch (err) {
      console.warn('Could not load splits:', err);
    }
  }

  async saveSplits() {
    try {
      await fetch('/api/splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splits: this.splits })
      });
    } catch (err) {
      console.error('Failed to save splits:', err);
    }
  }

  openSplitModal(txId = null) {
    const modal = document.getElementById('modal-split-expense');
    const titleInput = document.getElementById('split-title-input');
    const amountInput = document.getElementById('split-total-amount-input');

    if (!modal) return;

    if (txId) {
      const tx = this.transactions.find(t => t.id === txId);
      if (tx) {
        if (titleInput) titleInput.value = tx.merchant || tx.narration;
        if (amountInput) amountInput.value = tx.amount;
      }
    } else {
      if (titleInput) titleInput.value = '';
      if (amountInput) amountInput.value = '';
    }

    this.recalculateSplitPreview();
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeSplitModal() {
    const modal = document.getElementById('modal-split-expense');
    if (modal) modal.classList.add('hidden');
  }

  recalculateSplitPreview() {
    const amountInput = document.getElementById('split-total-amount-input');
    const friendsInput = document.getElementById('split-friends-input');
    const previewEl = document.getElementById('split-shares-preview');

    if (!previewEl) return;

    const total = Number(amountInput ? amountInput.value : 0) || 0;
    const friendsStr = friendsInput ? friendsInput.value : '';
    const friends = friendsStr.split(',').map(f => f.trim()).filter(Boolean);

    const numPeople = friends.length + 1;
    const sharePerPerson = total > 0 ? (total / numPeople) : 0;

    previewEl.innerHTML = `
      <div class="flex justify-between text-slate-300 font-semibold mb-1">
        <span>Dividing among ${numPeople} people:</span>
        <span class="text-emerald-400 font-bold">${formatINR(sharePerPerson)} / person</span>
      </div>
      <div class="text-[10px] text-slate-400 space-y-0.5">
        <div>&bull; You absorb: ${formatINR(sharePerPerson)}</div>
        ${friends.map(f => `<div>&bull; ${escapeHtml(f)} owes you: ${formatINR(sharePerPerson)}</div>`).join('')}
      </div>
    `;
  }

  async saveSplitExpense(e) {
    e.preventDefault();
    const titleInput = document.getElementById('split-title-input');
    const amountInput = document.getElementById('split-total-amount-input');
    const friendsInput = document.getElementById('split-friends-input');

    const total = Number(amountInput ? amountInput.value : 0) || 0;
    const title = (titleInput ? titleInput.value : '').trim();
    const friendsStr = friendsInput ? friendsInput.value : '';
    const friends = friendsStr.split(',').map(f => f.trim()).filter(Boolean);

    if (total <= 0 || !title || friends.length === 0) {
      alert('Please fill out all split fields.');
      return;
    }

    const share = Math.round((total / (friends.length + 1)) * 100) / 100;
    const newSplit = {
      id: `split_${Date.now()}`,
      title,
      total,
      date: new Date().toISOString().slice(0, 10),
      sharePerPerson: share,
      friends: friends.map(f => ({ name: f, owed: share, settled: false }))
    };

    this.splits.unshift(newSplit);
    await this.saveSplits();
    this.closeSplitModal();
    this.renderSplitwiseTab();
  }

  renderSplitwiseTab() {
    const kpiTotal = document.getElementById('split-kpi-total');
    const kpiOwed = document.getElementById('split-kpi-owed-to-you');
    const kpiYouOwe = document.getElementById('split-kpi-you-owe');
    const kpiFriends = document.getElementById('split-kpi-friends');
    const friendsList = document.getElementById('split-friends-list');
    const historyList = document.getElementById('split-history-list');

    if (!friendsList) return;

    const friendBalances = {};
    let totalShared = 0;
    let totalOwedToYou = 0;

    this.splits.forEach(s => {
      totalShared += s.total;
      (s.friends || []).forEach(f => {
        if (!friendBalances[f.name]) friendBalances[f.name] = { owed: 0, count: 0 };
        if (!f.settled) {
          friendBalances[f.name].owed += f.owed;
          totalOwedToYou += f.owed;
        }
        friendBalances[f.name].count++;
      });
    });

    const activeFriends = Object.keys(friendBalances);

    if (kpiTotal) kpiTotal.textContent = formatINR(totalShared);
    if (kpiOwed) kpiOwed.textContent = `+${formatINR(totalOwedToYou)}`;
    if (kpiYouOwe) kpiYouOwe.textContent = '₹0';
    if (kpiFriends) kpiFriends.textContent = String(activeFriends.length);

    if (activeFriends.length === 0) {
      friendsList.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
          No shared expenses recorded yet. Click "Split an Expense" above or click the split icon on any transaction in the ledger.
        </div>
      `;
    } else {
      friendsList.innerHTML = activeFriends.map(fName => {
        const bal = friendBalances[fName];
        return `
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-300 font-bold flex items-center justify-center border border-violet-500/30">
                ${escapeHtml(fName.charAt(0).toUpperCase())}
              </div>
              <div>
                <div class="text-xs font-bold text-white">${escapeHtml(fName)}</div>
                <div class="text-[10px] text-slate-400 font-mono">${bal.count} shared bills</div>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <div class="text-right">
                <span class="font-mono font-black text-sm ${bal.owed > 0 ? 'text-emerald-400' : 'text-slate-400'}">
                  ${bal.owed > 0 ? '+' : ''}${formatINR(bal.owed)}
                </span>
                <span class="text-[10px] text-slate-400 block">${bal.owed > 0 ? 'owes you' : 'Settled up'}</span>
              </div>
              ${bal.owed > 0 ? `
                <button onclick="window.app.requestUPIForFriend('${escapeHtml(fName)}', ${bal.owed})" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition flex items-center space-x-1 shadow">
                  <i data-lucide="qr-code" class="w-3 h-3"></i>
                  <span>UPI QR</span>
                </button>
                <button onclick="window.app.settleFriendBalance('${escapeHtml(fName)}')" class="px-2 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Mark settled">
                  ✓
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    if (this.splits.length === 0) {
      if (historyList) historyList.innerHTML = `<div class="p-4 text-center text-xs text-slate-500">No split history yet.</div>`;
    } else {
      if (historyList) {
        historyList.innerHTML = this.splits.slice(0, 10).map(s => `
          <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <div class="font-bold text-slate-200">${escapeHtml(s.title)}</div>
              <div class="text-[10px] text-slate-400 font-mono">${s.date} &bull; ${(s.friends || []).map(f => f.name).join(', ')}</div>
            </div>
            <div class="text-right">
              <span class="font-mono font-bold text-white">${formatINR(s.total)}</span>
              <span class="text-[10px] text-violet-400 block font-mono">${formatINR(s.sharePerPerson)} / person</span>
            </div>
          </div>
        `).join('');
      }
    }

    this.updateUPIQRCode();
    if (window.lucide) window.lucide.createIcons();
  }

  requestUPIForFriend(friendName, amount) {
    const amtInput = document.getElementById('upi-amount-input');
    const noteInput = document.getElementById('upi-note-input');
    if (amtInput) amtInput.value = Math.round(amount);
    if (noteInput) noteInput.value = `${friendName} Split Settlement`;
    this.updateUPIQRCode();
  }

  async settleFriendBalance(friendName) {
    if (!confirm(`Mark all pending debts for ${friendName} as settled?`)) return;
    this.splits.forEach(s => {
      (s.friends || []).forEach(f => {
        if (f.name === friendName) f.settled = true;
      });
    });
    await this.saveSplits();
    this.renderSplitwiseTab();
  }

  updateUPIQRCode() {
    const vpaInput = document.getElementById('upi-vpa-input');
    const amtInput = document.getElementById('upi-amount-input');
    const noteInput = document.getElementById('upi-note-input');
    const qrDisplay = document.getElementById('upi-qr-display');
    const amtText = document.getElementById('upi-intent-amount-text');
    const deeplinkBtn = document.getElementById('upi-deeplink-btn');

    if (!qrDisplay) return;

    const vpa = (vpaInput ? vpaInput.value : '').trim() || 'user@hdfcbank';
    const amount = Number(amtInput ? amtInput.value : 0) || 500;
    const note = (noteInput ? noteInput.value : '').trim() || 'Split Settlement';

    this.upiVPA = vpa;

    const upiUri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent("FinTrack User")}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(note)}`;

    if (amtText) amtText.textContent = formatINR(amount);
    if (deeplinkBtn) deeplinkBtn.href = upiUri;

    qrDisplay.innerHTML = '';
    if (window.QRCode) {
      try {
        new window.QRCode(qrDisplay, {
          text: upiUri,
          width: 160,
          height: 160,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
        return;
      } catch (e) {
        console.warn('QRCode generation failed, using web fallback:', e);
      }
    }

    qrDisplay.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiUri)}" alt="UPI QR" class="w-40 h-40 rounded-xl" />`;
  }
}

// Global Currency Formatter (INR with Lakhs & Crores commas)
export function formatINR(val) {
  const num = Math.abs(Number(val) || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.app = new FinTrackApp();
  window.app.init();
});
