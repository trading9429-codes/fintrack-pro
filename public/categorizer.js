/**
 * Intelligent HDFC Categorizer & Grouping Engine
 * Enhanced with real Indian banking narration patterns, UPI merchants, and corporate payroll
 */

export const GROUPINGS = {
  NEED: 'Need',
  WANT: 'Want',
  LUXURY: 'Luxury',
  SAVINGS: 'Savings',
  INCOME: 'Income',
};

export const CATEGORIES = {
  // Income
  SALARY: { id: 'salary', name: 'Salary & Compensation', type: 'income', icon: 'briefcase', color: '#10B981' },
  PF_RETIREMENT: { id: 'pf_retirement', name: 'Provident Fund (PF) & Gratuity', type: 'income', icon: 'shield', color: '#047857' },
  INVESTMENT_INCOME: { id: 'investment_income', name: 'Trading Payouts & Capital Gains', type: 'income', icon: 'trending-up', color: '#065F46' },
  DIVIDEND: { id: 'dividend', name: 'Stock Dividends', type: 'income', icon: 'pie-chart', color: '#059669' },
  INTEREST: { id: 'interest', name: 'Bank Interest & Returns', type: 'income', icon: 'percent', color: '#34D399' },
  FREELANCE: { id: 'freelance', name: 'Freelance & Business', type: 'income', icon: 'laptop', color: '#10B981' },
  REFUND: { id: 'refund', name: 'Refunds & Reimbursements', type: 'income', icon: 'rotate-ccw', color: '#6EE7B7' },
  FAMILY_INFLOW: { id: 'family_inflow', name: 'Family & Received Transfers', type: 'income', icon: 'user-check', color: '#A7F3D0' },
  OTHER_INCOME: { id: 'other_income', name: 'Other Credits & Inflows', type: 'income', icon: 'plus-circle', color: '#D1FAE5' },

  // Expenses - Needs
  HOUSING_PROPERTY: { id: 'housing_property', name: 'Real Estate & Property', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'home', color: '#3B82F6' },
  INSURANCE: { id: 'insurance', name: 'Insurance (Health, Term, Motor)', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'shield-check', color: '#2563EB' },
  GOVT_TAXES: { id: 'govt_taxes', name: 'Govt Stamp Duty, e-Gras & Taxes', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'landmark', color: '#1D4ED8' },
  GROCERIES: { id: 'groceries', name: 'Groceries, Meat & Daily Essentials', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'shopping-cart', color: '#10B981' },
  UTILITIES: { id: 'utilities', name: 'Utilities & Bills (Mobile, WiFi, Power)', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'zap', color: '#F59E0B' },
  HEALTH: { id: 'health', name: 'Healthcare, Meds & Physiotherapy', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'activity', color: '#EC4899' },
  COMMUTE: { id: 'commute', name: 'Fuel, Fastag & Daily Commute', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'navigation', color: '#6366F1' },
  EMI_LOANS: { id: 'emi_loans', name: 'Credit Card Bill & Loan EMIs', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'credit-card', color: '#EF4444' },
  FAMILY_SUPPORT: { id: 'family_support', name: 'Family Support & Remittances', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'heart', color: '#8B5CF6' },
  BANK_CHARGES: { id: 'bank_charges', name: 'Bank Charges & GST', type: 'expense', defaultGrouping: GROUPINGS.NEED, icon: 'shield-alert', color: '#64748B' },

  // Expenses - Wants
  DINING: { id: 'dining', name: 'Dining Out, Food & Restaurants', type: 'expense', defaultGrouping: GROUPINGS.WANT, icon: 'coffee', color: '#F97316' },
  SWEETS_SNACKS: { id: 'sweets_snacks', name: 'Sweets, Snacks & Bakery', type: 'expense', defaultGrouping: GROUPINGS.WANT, icon: 'cake', color: '#FB923C' },
  SHOPPING: { id: 'shopping', name: 'Shopping & Fashion Retail (Zudio, Amazon)', type: 'expense', defaultGrouping: GROUPINGS.WANT, icon: 'shopping-bag', color: '#EC4899' },
  ENTERTAINMENT: { id: 'entertainment', name: 'OTT, Movies & Leisure', type: 'expense', defaultGrouping: GROUPINGS.WANT, icon: 'tv', color: '#A855F7' },
  PERSONAL_CARE: { id: 'personal_care', name: 'Salons, Hair Care & Grooming', type: 'expense', defaultGrouping: GROUPINGS.WANT, icon: 'smile', color: '#14B8A6' },
  TRAVEL_LEISURE: { id: 'travel_leisure', name: 'Travel & Trips (EaseMyTrip)', type: 'expense', defaultGrouping: GROUPINGS.WANT, icon: 'plane', color: '#0EA5E9' },

  // Expenses - Luxury
  LUXURY_TRAVEL: { id: 'luxury_travel', name: 'High-Ticket Flights & Resorts', type: 'expense', defaultGrouping: GROUPINGS.LUXURY, icon: 'compass', color: '#D946EF' },
  LUXURY_SHOPPING: { id: 'luxury_shopping', name: 'Luxury Purchases & Electronics', type: 'expense', defaultGrouping: GROUPINGS.LUXURY, icon: 'gem', color: '#F43F5E' },
  FINE_DINING: { id: 'fine_dining', name: 'Fine Dining & Luxury Pubs', type: 'expense', defaultGrouping: GROUPINGS.LUXURY, icon: 'wine', color: '#C026D3' },

  // Savings / Wealth
  TRADING_INVESTMENT: { id: 'trading_investment', name: 'Trading & Stock Market Capital (Fyers, Dhan)', type: 'expense', defaultGrouping: GROUPINGS.SAVINGS, icon: 'trending-up', color: '#22C55E' },
  MUTUAL_FUND_SIP: { id: 'mutual_fund_sip', name: 'Mutual Funds & SIPs', type: 'expense', defaultGrouping: GROUPINGS.SAVINGS, icon: 'pie-chart', color: '#16A34A' },

  // Others
  MISC: { id: 'misc', name: 'General & Miscellaneous UPI', type: 'expense', defaultGrouping: GROUPINGS.WANT, icon: 'layers', color: '#94A3B8' },
};

/**
 * Intelligent pattern dictionary for Indian HDFC Statement Narrations
 */
const PATTERNS = [
  // --- INCOMES ---
  {
    regex: /(ASCENDION|INFOSYS|TCS|WIPRO|GOOGLE|MICROSOFT|ACCENTURE|PAYROLL|SALARY|CMS\/|CORP PAY)/i,
    category: CATEGORIES.SALARY,
    grouping: GROUPINGS.INCOME,
    type: 'income',
    merchant: (n) => n.includes('ASCENDION') ? 'Ascendion Engineering (Salary)' : extractMerchant(n, 'Corporate Salary')
  },
  {
    regex: /(PF ADVAN|PF WITHDRAWAL|PROVIDENT FUND|EPFO|CMP000000015)/i,
    category: CATEGORIES.PF_RETIREMENT,
    grouping: GROUPINGS.INCOME,
    type: 'income',
    merchant: () => 'Provident Fund (PF) Advance'
  },
  {
    regex: /(RAISE SECURITIES|FYERS SECURITIES|MONEYLICIOUS|ZERODHA|GROWW|UPSTOX|SHAREKHAN|ANGEL ONE)/i,
    category: CATEGORIES.INVESTMENT_INCOME,
    grouping: GROUPINGS.INCOME,
    type: 'income',
    merchant: (n) => extractBrokerName(n) + ' (Capital Payout)'
  },
  {
    regex: /(DIVIDEND|ACH C-.*DIV|FINDIV|CANBANK DIV|CEMINDIA|AXIS BANK LIMITED.*DIV|SJVN|IRCON|HFCL|AUSOM ENTERPRISE.*DIV|ZUARI INDUSTRIES)/i,
    category: CATEGORIES.DIVIDEND,
    grouping: GROUPINGS.INCOME,
    type: 'income',
    merchant: (n) => extractDividendCompany(n)
  },
  {
    regex: /(INTEREST PAID|INT\.PD|INTEREST CREDIT|CAPITALIZED)/i,
    category: CATEGORIES.INTEREST,
    grouping: GROUPINGS.INCOME,
    type: 'income',
    merchant: () => 'HDFC Bank Interest'
  },
  {
    regex: /(EXPENSE REIM|REFUND|REVERSAL|REV-UPI|UPIRET|AMAZON\.REFUNDS|HEADPHONEZONE.*REFUND|CASHBACK)/i,
    category: CATEGORIES.REFUND,
    grouping: GROUPINGS.INCOME,
    type: 'income',
    merchant: (n) => extractRefundSource(n)
  },

  // --- TRADING & INVESTMENTS (EXPENSES -> SAVINGS/CAPITAL) ---
  {
    regex: /(FYERSSECURITIES|FYERS SECURITIES|RAISE SECURITIES|RAISE\.RZP|RAISE\.PAYU|MONEYLICIOUS|RAZPMONEYLICIOUS|ZERODHA|GROWW|UPSTOX|ANGEL ONE)/i,
    category: CATEGORIES.TRADING_INVESTMENT,
    grouping: GROUPINGS.SAVINGS,
    type: 'expense',
    merchant: (n) => extractBrokerName(n)
  },

  // --- HOUSING, REAL ESTATE & GOVT PROPERTY TAX (NEED) ---
  {
    regex: /(CHHEDA DEVELOPMENTS|AVIGHNA|BUILDER|HOUSING BOARD|LODHA|GODREJ PROP|SOBHA|PRESTIGE)/i,
    category: CATEGORIES.HOUSING_PROPERTY,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: () => 'Chheda Developments (Avighna)'
  },
  {
    regex: /(SBIEPYEGARSMAH|EGRAS|STAMP DUTY|REGISTRATION|MUNICIPAL CORP|PROPERTY TAX)/i,
    category: CATEGORIES.GOVT_TAXES,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: () => 'e-Gras Maharashtra Govt (Stamp Duty / Tax)'
  },

  // --- INSURANCE (NEED) ---
  {
    regex: /(POLICYBAZAAR|PBSI|GODIGIT|HDFC ERGO|ICICI LOMBARD|MAX LIFE|STAR HEALTH|TATA AIG|NIVA BUPA|CARE HEALTH|LIC OF INDIA)/i,
    category: CATEGORIES.INSURANCE,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: (n) => n.includes('POLICYBAZAAR') ? 'PolicyBazaar Insurance' : (n.includes('GODIGIT') ? 'Go Digit General Insurance' : 'Insurance Premium')
  },

  // --- HEALTHCARE & MEDICINES (NEED) ---
  {
    regex: /(WELLNESS FOREVER|MJ MEDICAL|NIRMAL PHYSIOTHERAPY|APOLLO|PHARMACY|CLINIC|HOSPITAL|1MG|NETMEDS|MEDPLUS|DR\s+|DENTAL|DIAGNOSTIC)/i,
    category: CATEGORIES.HEALTH,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: (n) => extractHealthcareName(n)
  },

  // --- UTILITIES, BILLS & RECHARGES (NEED) ---
  {
    regex: /(JIO PREPAID|JIOMOBILITY|AIRTEL|VODAFONE|VI RECHARGE|B NETWORKS|BROADBAND|BESCOM|TATA POWER|ADANI ELEC|MSEDCL|MAHADISCOM|IGL|GAS|WATER BILL|ELECTRICITY|GPAY-UTILITY|MOBIKWIKMERCHANT)/i,
    category: CATEGORIES.UTILITIES,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: (n) => extractUtilityName(n)
  },

  // --- CREDIT CARD AUTOPAY (NEED) ---
  {
    regex: /(AUTOPAY SI-TAD|CREDIT CARD AUTOPAY|HDFC CC|CRED\/PAYMENT|CRED APP)/i,
    category: CATEGORIES.EMI_LOANS,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: () => 'HDFC Credit Card AutoPay'
  },

  // --- TRAVEL & FLIGHTS (WANT / LUXURY IF HIGH TICKET) ---
  {
    regex: /(EASY TRIP|EASEMYTRIP|MAKEMYTRIP|GOIBIBO|IRCTC|INDIGO|AIR INDIA|VISTARA|AKASA|AGODA|AIRBNB|HOTEL UDUPI|HOTEL)/i,
    category: CATEGORIES.TRAVEL_LEISURE,
    grouping: GROUPINGS.WANT, // can be upgraded to LUXURY if > ₹15,000
    type: 'expense',
    merchant: (n) => extractTravelName(n)
  },

  // --- COMMUTE & FUEL (NEED) ---
  {
    regex: /(MISHRA FILLING|PETROL|HPCL|BPCL|IOCL|SHELL|FUEL|UBER|OLA|RAPIDO|FASTAG|METRO|DMRC)/i,
    category: CATEGORIES.COMMUTE,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: (n) => extractCommuteName(n)
  },

  // --- GROCERIES, FRESH PRODUCE & MEAT (NEED) ---
  {
    regex: /(BLINKIT|ZEPTO|INSTAMART|BIGBASKET|SMART POINT|RADHIKA DEPARTMENTAL|NURNAHAR FISH|HAJI CHICKEN|CHICKEN|MUTTON|MEAT|SAVERA|GIRADHAR|KIRANA|SUPERMARKET|PRODUCE|VEGETABLE|SONKAR|PRAJAPAT)/i,
    category: CATEGORIES.GROCERIES,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: (n) => extractGroceryName(n)
  },

  // --- DINING OUT & RESTAURANTS (WANT) ---
  {
    regex: /(BARBEQUE NATION|BARBEQUENATION|HOTEL UDUPI|CHINESE CORNER|SHREE SAI CHINESE|MARI ANNA|MARIAPPAN|RESTAURANT|DHABA|CAFE|SWIGGY|ZOMATO|MCDONALD|BURGER|PIZZA|FOOD)/i,
    category: CATEGORIES.DINING,
    grouping: GROUPINGS.WANT,
    type: 'expense',
    merchant: (n) => extractDiningName(n)
  },

  // --- SWEETS, SNACKS & BAKERY (WANT) ---
  {
    regex: /(AARADHANA SWEETS|SRIRAM SWEETS|BHAWANI SWEETS|NEW PANEER CHAT|THE CAKE TIME|OMLASSIBHANDAR|SWEETS|BAKERY|CAKE|CHATPATA|SNACKS|LASSI)/i,
    category: CATEGORIES.SWEETS_SNACKS,
    grouping: GROUPINGS.WANT,
    type: 'expense',
    merchant: (n) => extractSweetsName(n)
  },

  // --- SHOPPING & FASHION RETAIL (WANT) ---
  {
    regex: /(ZUDIO|TRENT|GDSK RETAILS|SHREEJI ENTER|KIRAN ENTERPRISES|LAL AND CO|AMAZON|FLIPKART|MYNTRA|AJIO|MAXUS MALL|SHOPPING|RETAIL|CLOTHING|APPAREL)/i,
    category: CATEGORIES.SHOPPING,
    grouping: GROUPINGS.WANT,
    type: 'expense',
    merchant: (n) => extractShoppingName(n)
  },

  // --- PERSONAL CARE & SALONS (WANT) ---
  {
    regex: /(NUPUR HAIR CARE|HAIR CARE|SALON|BEAUTY|SPA|PARLOUR|BARBER)/i,
    category: CATEGORIES.PERSONAL_CARE,
    grouping: GROUPINGS.WANT,
    type: 'expense',
    merchant: () => 'Nupur Hair Care & Salon'
  },

  // --- FAMILY & PERSONAL TRANSFERS ---
  {
    regex: /(RAMSAMUJH CHAUHAN|AKANKSHA SINGH|SANJIV RAMSAMUJH|ASHOK KR SINGH|MAYA SINGH|PUSHPA RAMSAMUJH|SUMAN DHARMVEER|MANISH CHUNILAL|SUNNY RAMSAMUJH)/i,
    category: CATEGORIES.FAMILY_SUPPORT,
    grouping: GROUPINGS.NEED,
    type: 'expense',
    merchant: (n) => extractFamilyMember(n)
  },
];

/**
 * Intelligent categorization and grouping assignment for any HDFC transaction
 */
export function categorizeTransaction({ narration, withdrawal, deposit }, customRules = []) {
  const isIncome = (deposit > 0);
  const amount = isIncome ? deposit : withdrawal;
  const text = (narration || '').toUpperCase();

  // 1. Prioritize user custom rules
  if (Array.isArray(customRules) && customRules.length > 0) {
    for (const cr of customRules) {
      if (cr.keyword && text.includes(cr.keyword.toUpperCase())) {
        const catObj = Object.values(CATEGORIES).find(c => c.id === cr.category) || CATEGORIES.MISC;
        return {
          category: catObj.id,
          categoryName: catObj.name,
          categoryIcon: catObj.icon,
          categoryColor: catObj.color,
          grouping: cr.grouping || catObj.defaultGrouping || (isIncome ? GROUPINGS.INCOME : GROUPINGS.WANT),
          merchant: cr.merchant || extractMerchant(narration, 'Custom Payee'),
          isAutoCategorized: true,
          confidence: 'high',
          matchedRule: cr.keyword
        };
      }
    }
  }

  // Try matching rule dictionary
  for (const rule of PATTERNS) {
    if (rule.type === (isIncome ? 'income' : 'expense') && rule.regex.test(text)) {
      let grouping = rule.grouping;
      let category = rule.category;

      // Smart Luxury Escalation for Expenses:
      // If flights/travel > ₹15,000 or shopping > ₹25,000 or dining > ₹5,000, elevate to Luxury
      if (!isIncome) {
        if (category.id === 'travel_leisure' && amount >= 15000) {
          grouping = GROUPINGS.LUXURY;
          category = CATEGORIES.LUXURY_TRAVEL;
        } else if (category.id === 'shopping' && amount >= 25000) {
          grouping = GROUPINGS.LUXURY;
          category = CATEGORIES.LUXURY_SHOPPING;
        } else if (category.id === 'dining' && amount >= 5000) {
          grouping = GROUPINGS.LUXURY;
          category = CATEGORIES.FINE_DINING;
        }
      }

      const merchant = typeof rule.merchant === 'function' ? rule.merchant(narration) : 'Identified Merchant';

      return {
        category: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        grouping,
        merchant,
        isAutoCategorized: true,
        confidence: 'high'
      };
    }
  }

  // Fallbacks
  if (isIncome) {
    return {
      category: CATEGORIES.OTHER_INCOME.id,
      categoryName: CATEGORIES.OTHER_INCOME.name,
      categoryIcon: CATEGORIES.OTHER_INCOME.icon,
      categoryColor: CATEGORIES.OTHER_INCOME.color,
      grouping: GROUPINGS.INCOME,
      merchant: extractMerchant(narration, 'Direct Credit / Transfer'),
      isAutoCategorized: false,
      confidence: 'medium'
    };
  } else {
    // If expense is over ₹25,000 and not identified as need/investment, classify as Luxury
    const isHighValue = amount >= 25000;
    return {
      category: CATEGORIES.MISC.id,
      categoryName: CATEGORIES.MISC.name,
      categoryIcon: CATEGORIES.MISC.icon,
      categoryColor: CATEGORIES.MISC.color,
      grouping: isHighValue ? GROUPINGS.LUXURY : GROUPINGS.WANT,
      merchant: extractMerchant(narration, 'UPI / Merchant Payment'),
      isAutoCategorized: false,
      confidence: 'low'
    };
  }
}

/**
 * Returns comprehensive category metadata, icons, and theme styles for any category ID or Name
 */
export function getCategoryMeta(categoryIdOrName, txType = 'expense') {
  const query = (categoryIdOrName || '').toLowerCase().trim();
  
  // Find matching category
  let cat = Object.values(CATEGORIES).find(c => 
    c.id.toLowerCase() === query || 
    c.name.toLowerCase() === query ||
    c.id.toLowerCase().replace(/_/g, '') === query.replace(/[^a-z0-9]/g, '')
  );

  if (!cat) {
    cat = (txType === 'income') ? CATEGORIES.OTHER_INCOME : CATEGORIES.MISC;
  }

  const styleMap = {
    // Income
    salary: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    pf_retirement: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30', glow: 'shadow-teal-500/20' },
    investment_income: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
    dividend: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    interest: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    freelance: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', glow: 'shadow-green-500/20' },
    refund: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20' },
    family_inflow: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', glow: 'shadow-violet-500/20' },
    other_income: { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30', glow: 'shadow-slate-500/20' },

    // Needs
    housing_property: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
    insurance: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', glow: 'shadow-sky-500/20' },
    govt_taxes: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20' },
    groceries: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    utilities: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
    health: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
    commute: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20' },
    emi_loans: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
    family_support: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
    bank_charges: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', glow: 'shadow-slate-500/20' },

    // Wants
    dining: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
    sweets_snacks: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
    shopping: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30', glow: 'shadow-pink-500/20' },
    entertainment: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
    personal_care: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30', glow: 'shadow-teal-500/20' },
    travel_leisure: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', glow: 'shadow-sky-500/20' },

    // Luxury
    luxury_travel: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', glow: 'shadow-fuchsia-500/20' },
    luxury_shopping: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
    fine_dining: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },

    // Savings
    trading_investment: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    mutual_fund_sip: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    misc: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', glow: 'shadow-slate-500/20' }
  };

  const st = styleMap[cat.id] || { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30', glow: 'shadow-slate-500/20' };

  return {
    ...cat,
    bgClass: st.bg,
    textClass: st.text,
    borderClass: st.border,
    glowClass: st.glow
  };
}

// --- HELPER EXTRACTORS FOR CLEAN MERCHANT NAMES ---

export function extractMerchant(narration, fallback = 'UPI / Payment') {
  if (!narration) return fallback;

  // Case: UPI-NAME-VPA@bank-...
  if (narration.startsWith('UPI-')) {
    const parts = narration.split('-');
    if (parts.length >= 2 && parts[1].trim()) {
      return cleanName(parts[1]);
    }
  }

  // Case: IMPS-REF-NAME-BANK-...
  if (narration.startsWith('IMPS-')) {
    const parts = narration.split('-');
    if (parts.length >= 3 && parts[2].trim()) {
      return cleanName(parts[2]);
    }
  }

  // Case: NEFT CR-IFSC-NAME-...
  if (narration.startsWith('NEFT CR-')) {
    const parts = narration.split('-');
    if (parts.length >= 3 && parts[2].trim()) {
      return cleanName(parts[2]);
    }
  }

  // Case: ACH D- NAME-... or ACH C- NAME-...
  if (narration.startsWith('ACH ')) {
    const parts = narration.split('-');
    if (parts.length >= 2 && parts[1].trim()) {
      return cleanName(parts[1]);
    }
  }

  // Case: FT - DR - ACCT - NAME
  if (narration.includes('FT - DR -') || narration.includes('FT - CR -')) {
    const parts = narration.split('-');
    if (parts.length >= 4 && parts[3].trim()) {
      return cleanName(parts[3]);
    }
  }

  // Clean numbers and slash prefixes e.g. 26840849995905503/FYERSSECURITIESPVTLT
  if (narration.includes('/')) {
    const afterSlash = narration.split('/')[1];
    if (afterSlash && afterSlash.length > 3) {
      return cleanName(afterSlash);
    }
  }

  return cleanName(narration.split(/[\/\-:]/)[0]);
}

function extractBrokerName(n) {
  if (/FYERS/i.test(n)) return 'Fyers Securities (Trading)';
  if (/RAISE/i.test(n)) return 'Dhan / Raise Securities (Trading)';
  if (/MONEYLICIOUS/i.test(n)) return 'Moneylicious Securities (Trading)';
  if (/ZERODHA/i.test(n)) return 'Zerodha Broking';
  if (/GROWW/i.test(n)) return 'Groww Investments';
  return 'Stock Market Broker';
}

function extractDividendCompany(n) {
  if (/RALLIS/i.test(n)) return 'Rallis India Dividend';
  if (/CANBANK/i.test(n)) return 'Canara Bank Dividend';
  if (/CEMINDIA/i.test(n)) return 'Cemindia Projects Dividend';
  if (/AXIS BANK/i.test(n)) return 'Axis Bank Dividend';
  if (/SJVN/i.test(n)) return 'SJVN Ltd Dividend';
  if (/IRCON/i.test(n)) return 'Ircon International Dividend';
  if (/HFCL/i.test(n)) return 'HFCL Ltd Dividend';
  if (/AUSOM/i.test(n)) return 'Ausom Enterprise Dividend';
  if (/ZUARI/i.test(n)) return 'Zuari Industries Dividend';
  return 'Stock Dividend';
}

function extractRefundSource(n) {
  if (/AMAZON/i.test(n)) return 'Amazon India (Refund)';
  if (/HEADPHONE/i.test(n)) return 'Headphone Zone (Refund)';
  if (/EXPENSE REIM/i.test(n)) return 'Expense Reimbursement';
  return 'Refund / UPI Reversal';
}

function extractHealthcareName(n) {
  if (/WELLNESS FOREVER/i.test(n)) return 'Wellness Forever Pharmacy';
  if (/MJ MEDICAL/i.test(n)) return 'MJ Medical Store';
  if (/NIRMAL PHYSIOTHERAPY/i.test(n)) return 'Nirmal Physiotherapy Clinic';
  return extractMerchant(n, 'Healthcare & Medical');
}

function extractUtilityName(n) {
  if (/JIOMOBILITY|JIO PREPAID/i.test(n)) return 'Jio Prepaid Mobile';
  if (/B NETWORKS/i.test(n)) return 'B Networks Broadband';
  if (/GPAY-UTILITY/i.test(n)) return 'Google Pay Utility Bill';
  if (/MOBIKWIK/i.test(n)) return 'MobiKwik Utility';
  return extractMerchant(n, 'Utilities & Bills');
}

function extractTravelName(n) {
  if (/EASY TRIP|EASEMYTRIP/i.test(n)) return 'EaseMyTrip Flights & Travel';
  if (/MAKEMYTRIP/i.test(n)) return 'MakeMyTrip';
  if (/IRCTC/i.test(n)) return 'IRCTC Train Booking';
  return extractMerchant(n, 'Travel & Bookings');
}

function extractCommuteName(n) {
  if (/MISHRA FILLING/i.test(n)) return 'Mishra Fuel Station';
  return extractMerchant(n, 'Fuel & Commute');
}

function extractGroceryName(n) {
  if (/BLINKIT/i.test(n)) return 'Blinkit Instant Groceries';
  if (/SMART POINT/i.test(n)) return 'Reliance Smart Point Groceries';
  if (/RADHIKA DEPARTMENTAL/i.test(n)) return 'Radhika Departmental Store';
  if (/NURNAHAR FISH/i.test(n)) return 'Nurnahar Fish Center';
  if (/HAJI CHICKEN/i.test(n)) return 'Haji Chicken Center';
  return extractMerchant(n, 'Groceries & Produce');
}

function extractDiningName(n) {
  if (/BARBEQUE NATION|BARBEQUENATION/i.test(n)) return 'Barbeque Nation';
  if (/HOTEL UDUPI/i.test(n)) return 'Hotel Udupi Pure Veg';
  if (/CHINESE CORNER/i.test(n)) return 'Chinese Corner';
  if (/SHREE SAI CHINESE/i.test(n)) return 'Shree Sai Chinese';
  return extractMerchant(n, 'Restaurant & Dining');
}

function extractSweetsName(n) {
  if (/AARADHANA/i.test(n)) return 'Aaradhana Sweets';
  if (/SRIRAM SWEETS/i.test(n)) return 'Sriram Sweets';
  if (/BHAWANI SWEETS/i.test(n)) return 'Bhawani Sweets & Dry Fruits';
  if (/NEW PANEER CHAT/i.test(n)) return 'New Paneer Chat Bhandar';
  if (/THE CAKE TIME/i.test(n)) return 'The Cake Time Bakery';
  if (/OMLASSIBHANDAR/i.test(n)) return 'Om Lassi Bhandar';
  return extractMerchant(n, 'Sweets & Snacks');
}

function extractShoppingName(n) {
  if (/ZUDIO/i.test(n)) return 'Zudio (Tata Trent)';
  if (/GDSK RETAILS/i.test(n)) return 'GDSK Retails';
  if (/SHREEJI/i.test(n)) return 'Shreeji Enterprises';
  if (/MAXUS MALL/i.test(n)) return 'Maxus Mall';
  return extractMerchant(n, 'Shopping Retail');
}

function extractFamilyMember(n) {
  if (/SUNNY RAMSAMUJH/i.test(n)) return 'Sunny Ramsamujh Chauhan (Self ICICI)';
  if (/AKANKSHA SINGH/i.test(n)) return 'Akanksha Singh (Family)';
  if (/RAMSAMUJH CHAUHAN/i.test(n)) return 'Ramsamujh Chauhan (Family)';
  if (/SANJIV RAMSAMUJH/i.test(n)) return 'Sanjiv Chauhan (Family)';
  if (/ASHOK KR SINGH/i.test(n)) return 'Ashok Kumar Singh';
  if (/MAYA SINGH/i.test(n)) return 'Maya Singh';
  return extractMerchant(n, 'Personal Transfer');
}

function cleanName(str) {
  if (!str) return 'Direct Payee';
  let cleaned = str
    .replace(/^UPI\s*/i, '')
    .replace(/^POS\s*/i, '')
    .replace(/^ACH\s+[CD]-/i, '')
    .replace(/Q[0-9]{8,12}@.*/i, '')
    .replace(/PAYTMQR[A-Z0-9]+@.*/i, '')
    .replace(/@.*/, '')
    .replace(/[0-9]{8,}/g, '')
    .replace(/BANGALORE|MUMBAI|DELHI|VARANASI|IN$/i, '')
    .trim();

  if (!cleaned || cleaned.length < 2) return 'Direct Payee';

  return cleaned
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Intelligent Tax & Deduction detector for Indian Income Tax (80C, 80D, NPS)
 */
export function detectTaxTags(tx) {
  const n = (tx.narration || '').toUpperCase();
  const cat = tx.category || '';
  const amt = Number(tx.amount) || 0;

  // 80C: PPF, EPF, ELSS, Mutual Fund SIP, LIC, HDFC Life, ICICI Pru, Max Life, SBI Life, Principal Home loan
  if (/PPF|PROVIDENT FUND|EPFO|ELSS|HDFC LIFE|ICICI PRU|MAX LIFE|TATA AIA|LIC OF INDIA|LIFE INSUR|SBI LIFE|PRINCIPAL.*LOAN/i.test(n) || cat === 'mutual_fund_sip' || cat === 'pf_retirement') {
    return {
      section: '80C',
      label: 'Section 80C (Tax Saving / Insurance / PF)',
      eligible: true,
      deductionLimit: 150000,
      amount: amt
    };
  }

  // 80D: Health Insurance
  if (/STAR HEALTH|NIVA BUPA|CARE HEALTH|RELIGARE|HDFC ERGO HEALTH|MEDICLAIM|HEALTH INS/i.test(n) || (cat === 'insurance' && /HEALTH|CARE|STAR|NIVA|MED/i.test(n))) {
    return {
      section: '80D',
      label: 'Section 80D (Health Insurance Premium)',
      eligible: true,
      deductionLimit: 25000,
      amount: amt
    };
  }

  // NPS: National Pension Scheme
  if (/NPS|PFRDA|NATIONAL PENSION/i.test(n)) {
    return {
      section: '80CCD(1B)',
      label: 'Section 80CCD (National Pension System)',
      eligible: true,
      deductionLimit: 50000,
      amount: amt
    };
  }

  return null;
}
