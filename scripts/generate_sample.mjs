import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import categorizer
import { categorizeTransaction, GROUPINGS, CATEGORIES } from '../public/categorizer.js';

const transactions = [];

function addTx(date, narration, withdrawal, deposit, balance) {
  const cat = categorizeTransaction({ narration, withdrawal, deposit });
  transactions.push({
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    date,
    rawDate: date.split('-').reverse().join('/'),
    narration,
    chqRef: 'REF' + Math.floor(1000000000 + Math.random() * 9000000000),
    withdrawal: withdrawal || 0,
    deposit: deposit || 0,
    balance: balance || 120000,
    type: deposit > 0 ? 'income' : 'expense',
    amount: deposit > 0 ? deposit : withdrawal,
    ...cat,
    source: 'HDFC NetBanking'
  });
}

// Generate data across June 2026 - Nov 2026
const months = [
  { year: 2026, month: 6, days: 30, salary: 185000 },
  { year: 2026, month: 7, days: 31, salary: 185000 },
  { year: 2026, month: 8, days: 31, salary: 185000 },
  { year: 2026, month: 9, days: 30, salary: 195000 },
  { year: 2026, month: 10, days: 31, salary: 195000 },
  { year: 2026, month: 11, days: 16, salary: 195000 }
];

let curBal = 145000;

for (const m of months) {
  const y = m.year;
  const mm = String(m.month).padStart(2, '0');

  // Day 1: Rent / Society
  const d01 = `${y}-${mm}-01`;
  curBal -= 38000;
  addTx(d01, 'UPI-MYGATE-mygate@hdfcbank-UPI/40192831/Society Maintenance and Rent', 38000, 0, curBal);

  // Day 1: Blinkit Groceries
  curBal -= 1840;
  addTx(d01, 'UPI-BLINKIT-blinkit@axl-UPI/40192842/Fresh vegetables fruits groceries', 1840, 0, curBal);

  // Day 3: Home Loan EMI
  const d03 = `${y}-${mm}-03`;
  curBal -= 42500;
  addTx(d03, 'ACH D-HDFC HOME LOAN-100294821-EMI AUTO DEBIT', 42500, 0, curBal);

  // Day 4: Commute / Petrol
  const d04 = `${y}-${mm}-04`;
  curBal -= 2800;
  addTx(d04, 'UPI-HPCL PETROL-hpcl@icici-UPI/40219821/Fuel refill sedan', 2800, 0, curBal);

  // Day 5: Electricity Bill BESCOM
  const d05 = `${y}-${mm}-05`;
  const elec = 2800 + Math.floor(Math.random() * 800);
  curBal -= elec;
  addTx(d05, 'UPI-BESCOM ELECTRICITY-bescom@sbi-UPI/40319281/Monthly electricity power bill', elec, 0, curBal);

  // Day 6: Dining out Swiggy / Zomato
  const d06 = `${y}-${mm}-06`;
  curBal -= 890;
  addTx(d06, 'UPI-SWIGGY-swiggy@icici-UPI/40419282/Weekend dinner gourmet delivery', 890, 0, curBal);

  // Day 7: Broadband / Mobile
  const d07 = `${y}-${mm}-07`;
  curBal -= 1179;
  addTx(d07, 'UPI-AIRTEL BROADBAND-airtel@icici-UPI/40519281/Fiber 300 Mbps unlimited plan', 1179, 0, curBal);

  // Day 9: Zepto quick groceries
  const d09 = `${y}-${mm}-09`;
  curBal -= 720;
  addTx(d09, 'UPI-ZEPTO-zepto@hdfcbank-UPI/40619281/Breakfast eggs bread coffee', 720, 0, curBal);

  // Day 10: Subscriptions (Netflix + Spotify)
  const d10 = `${y}-${mm}-10`;
  curBal -= 649;
  addTx(d10, 'UPI-NETFLIX-netflix@citibank-UPI/40719281/Premium 4K UHD subscription', 649, 0, curBal);
  curBal -= 199;
  addTx(d10, 'UPI-SPOTIFY-spotify@yesbank-UPI/40719282/Music streaming duo subscription', 199, 0, curBal);

  // Day 12: Dining / Pub (Weekend)
  const d12 = `${y}-${mm}-12`;
  if (m.month % 2 === 0) {
    // Luxury Fine Dining
    curBal -= 7450;
    addTx(d12, 'POS 4160XXXXXXXX1029 TOIT BREWPUB INDIRANAGAR BANGALORE', 7450, 0, curBal);
  } else {
    curBal -= 1650;
    addTx(d12, 'UPI-ZOMATO-zomato@hdfcbank-UPI/40819281/Casual Italian dinner cafe', 1650, 0, curBal);
  }

  // Day 14: Health / Medicines
  const d14 = `${y}-${mm}-14`;
  curBal -= 1640;
  addTx(d14, 'UPI-APOLLO PHARMACY-apollo@icici-UPI/40919281/Prescription meds health supplements', 1640, 0, curBal);

  // Day 15: SALARY CREDIT!
  const d15 = `${y}-${mm}-15`;
  curBal += m.salary;
  addTx(d15, `NEFT CR-INFOSYS TECHNOLOGIES-SALARY ${m.month}/2026-INFY${y}${mm}`, 0, m.salary, curBal);

  // Day 16: Systematic Investment Plan (SIP)
  const d16 = `${y}-${mm}-16`;
  curBal -= 35000;
  addTx(d16, 'UPI-ZERODHA BROKING-zerodha@hdfcbank-UPI/41192811/Nifty 50 Index Fund Monthly SIP', 35000, 0, curBal);

  if (m.days >= 20) {
    // Day 18: Shopping or Luxury
    const d18 = `${y}-${mm}-18`;
    if (m.month === 10) {
      // Luxury Diwali purchase
      curBal -= 89900;
      addTx(d18, 'POS 4160XXXXXXXX1029 APPLE STORE BKC MUMBAI ELECTRONICS', 89900, 0, curBal);
    } else if (m.month === 8) {
      // Luxury Staycation
      curBal -= 28500;
      addTx(d18, 'UPI-TAJ HOTELS-taj@hdfcbank-UPI/41392811/Luxury Weekend staycation booking', 28500, 0, curBal);
    } else {
      curBal -= 4590;
      addTx(d18, 'POS 4160XXXXXXXX1029 ZARA INDIRANAGAR FASHION APPAREL', 4590, 0, curBal);
    }

    // Day 20: BigBasket Monthly Pantry
    const d20 = `${y}-${mm}-20`;
    curBal -= 3850;
    addTx(d20, 'UPI-BIGBASKET-bigbasket@icici-UPI/41492811/Monthly pantry staples dry fruits', 3850, 0, curBal);

    // Day 22: Quarterly Interest or Freelance
    const d22 = `${y}-${mm}-22`;
    if (m.month === 6 || m.month === 9) {
      curBal += 1840;
      addTx(d22, 'INT.PD: HDFC SAVINGS ACCOUNT QUARTERLY INTEREST CREDIT', 0, 1840, curBal);
    } else if (m.month === 7 || m.month === 11) {
      curBal += 45000;
      addTx(d22, 'NEFT CR-CLIENT CONSULTING SERVICES-FREELANCE TECH ARCHITECTURE', 0, 45000, curBal);
    }

    // Day 24: Starbucks / Cafe Meet
    const d24 = `${y}-${mm}-24`;
    curBal -= 740;
    addTx(d24, 'UPI-STARBUCKS-starbucks@hdfcbank-UPI/41692811/Caramel Frappuccino cold brew', 740, 0, curBal);

    // Day 26: Cult.fit Gym or Uber
    const d26 = `${y}-${mm}-26`;
    if (m.month === 7) {
      curBal -= 14500;
      addTx(d26, 'UPI-CULT FIT-cultfit@axisbank-UPI/41792811/Annual Gym Cult Pass Elite membership', 14500, 0, curBal);
    } else {
      curBal -= 480;
      addTx(d26, 'UPI-UBER INDIA-uber@hdfcbank-UPI/41792812/Airport cab trip', 480, 0, curBal);
    }

    // Day 28: Credit Card Settlement
    const d28 = `${y}-${mm}-28`;
    const ccAmt = 21000 + Math.floor(Math.random() * 6000);
    curBal -= ccAmt;
    addTx(d28, 'CRED/PAYMENT/HDFC CC/41892811/Credit card monthly statement bill', ccAmt, 0, curBal);

    // Day 29: Amazon / Flipkart Shopping
    const d29 = `${y}-${mm}-29`;
    curBal -= 3299;
    addTx(d29, 'UPI-AMAZON PAY-amazon@apl-UPI/41992811/Household gadgets books accessories', 3299, 0, curBal);
  }
}

// Sort transactions descending by date
transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

const outDir = path.join(__dirname, '../data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'sample_hdfc_transactions.json'), JSON.stringify(transactions, null, 2), 'utf-8');
fs.writeFileSync(path.join(outDir, 'transactions.json'), JSON.stringify(transactions, null, 2), 'utf-8');

console.log(`Generated ${transactions.length} realistic HDFC transactions.`);
