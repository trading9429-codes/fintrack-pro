/**
 * Ultra-Robust HDFC Bank Statement Parser
 * Handles CSV, TSV (Tab-separated), Excel (.xls/.xlsx, including HDFC HTML tables with .xls extension),
 * PDF, and Pasted Text formats
 */
import { categorizeTransaction } from './categorizer.js';

export class HDFCParser {
  /**
   * Main entrypoint: parses file based on extension and content
   */
  static async parseFile(file, options = {}) {
    const fileName = (file.name || '').toLowerCase();
    
    try {
      if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        return await this.parsePDF(buffer, options.password);
      }

      if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        // Try SheetJS first if loaded
        const buffer = await file.arrayBuffer();
        try {
          return await this.parseExcel(buffer);
        } catch (excelErr) {
          console.warn('SheetJS binary parse failed, trying HTML/Text fallback:', excelErr);
          // HDFC frequently exports HTML tables with .xls extension
          const text = await file.text();
          if (text.includes('<table') || text.includes('<TABLE')) {
            return this.parseHTMLTable(text, file.name);
          }
          return this.parseCSV(text);
        }
      }

      // Default for .csv, .txt, or unknown
      const text = await file.text();

      // Check if it's an HTML export
      if (text.includes('<table') || text.includes('<TABLE')) {
        return this.parseHTMLTable(text, file.name);
      }

      return this.parseCSV(text);
    } catch (err) {
      console.error('HDFCParser error:', err);
      throw err;
    }
  }

  /**
   * Robust CSV/TSV Parser for HDFC statements
   * Handles arbitrary preambles, comma/tab/semicolon delimiters, multi-line narrations, and diverse date formats
   */
  static parseCSV(csvContent) {
    if (!csvContent || typeof csvContent !== 'string') {
      throw new Error('Empty statement content.');
    }

    const rawLines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      throw new Error('Statement file has no readable lines.');
    }

    // Detect delimiter: tab, semicolon, or comma
    const delimiter = detectDelimiter(rawLines);

    // Find header row by scanning for keywords
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rawLines.length, 50); i++) {
      const lineUpper = rawLines[i].toUpperCase();
      const hasDate = lineUpper.includes('DATE') || lineUpper.includes('VAL DT') || lineUpper.includes('TXN DATE');
      const hasNarration = lineUpper.includes('NARRATION') || lineUpper.includes('DESCRIPTION') || lineUpper.includes('PARTICULAR') || lineUpper.includes('DETAILS');
      const hasAmount = lineUpper.includes('WITHDRAWAL') || lineUpper.includes('DEBIT') || lineUpper.includes('DEPOSIT') || lineUpper.includes('CREDIT') || lineUpper.includes('AMOUNT');

      if ((hasDate && hasNarration) || (hasNarration && hasAmount) || (hasDate && hasAmount)) {
        headerIdx = i;
        break;
      }
    }

    // If no header found, check if line 0 looks like data
    if (headerIdx === -1) {
      headerIdx = 0;
    }

    const dataLines = rawLines.slice(headerIdx);
    const parsedRows = parseDelimitedRows(dataLines.join('\n'), delimiter);
    if (parsedRows.length < 2) {
      // Fallback to freeform text parser
      return this.parseText(csvContent, 'HDFC Statement');
    }

    const headers = parsedRows[0].map(h => String(h || '').toUpperCase().trim());
    
    // Locate column indices with robust multi-bank aliases (HDFC, ICICI, SBI, Axis, Kotak, Zerodha)
    let dateIdx = headers.findIndex(h => (h.includes('DATE') || h.includes('TXN') || h.includes('TRAN')) && !h.includes('VALUE') && !h.includes('POST'));
    if (dateIdx === -1) dateIdx = headers.findIndex(h => h.includes('DATE') || h.includes('DT') || h.includes('TRAN') || h.includes('TXN'));

    let narrationIdx = headers.findIndex(h => h.includes('NARRATION') || h.includes('DESCRIPTION') || h.includes('PARTICULAR') || h.includes('DETAIL') || h.includes('REMARK') || h.includes('TRANSACTION DETAILS'));
    let chqRefIdx = headers.findIndex(h => h.includes('CHQ') || h.includes('REF') || h.includes('CHEQUE') || h.includes('UTR') || h.includes('VCH'));
    let withdrawalIdx = headers.findIndex(h => h.includes('WITHDRAWAL') || h.includes('DEBIT') || h === 'DR' || h.startsWith('DR ') || h.endsWith(' DR') || h.includes('DEBIT AMOUNT'));
    let depositIdx = headers.findIndex(h => h.includes('DEPOSIT') || h.includes('CREDIT') || h === 'CR' || h.startsWith('CR ') || h.endsWith(' CR') || h.includes('CREDIT AMOUNT'));
    let balanceIdx = headers.findIndex(h => h.includes('BALANCE') || h.includes('CLOSING') || h === 'BAL');
    let genericAmtIdx = headers.findIndex(h => h === 'AMOUNT' || h.includes('AMT') || h.includes('NET AMOUNT') || h.includes('TRANSACTION AMOUNT'));

    const transactions = [];

    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (!row || row.length === 0) continue;

      const dateRaw = dateIdx !== -1 ? row[dateIdx] : row[0];
      const normalizedDate = normalizeHDFCDate(dateRaw);
      if (!normalizedDate) continue; // Skip preamble, footer, or blank lines

      let narration = (narrationIdx !== -1 ? row[narrationIdx] : row[1] || '').trim();
      if (!narration || narration.toUpperCase().includes('TOTAL') || narration.toUpperCase().includes('CLOSING BALANCE')) {
        continue;
      }

      const chqRef = chqRefIdx !== -1 ? String(row[chqRefIdx] || '').trim() : '';

      let withdrawal = 0;
      let deposit = 0;
      let balance = balanceIdx !== -1 ? cleanAmount(row[balanceIdx]) : 0;

      if (withdrawalIdx !== -1 && depositIdx !== -1) {
        withdrawal = cleanAmount(row[withdrawalIdx]);
        deposit = cleanAmount(row[depositIdx]);
      } else if (genericAmtIdx !== -1) {
        // Single amount column: check for Dr/Cr markers in narration or row
        const rowStr = row.join(' ').toUpperCase();
        const amt = cleanAmount(row[genericAmtIdx]);
        if (rowStr.includes(' CR') || rowStr.includes('CREDIT') || rowStr.includes('REFUND') || rowStr.includes('SALARY')) {
          deposit = amt;
        } else {
          withdrawal = amt;
        }
      } else {
        // Find numeric columns in row
        const numbers = row.map(cleanAmount).filter(n => n > 0);
        if (numbers.length >= 1) {
          withdrawal = numbers[0];
        }
      }

      if (withdrawal === 0 && deposit === 0) continue;

      const categorization = categorizeTransaction({ narration, withdrawal, deposit });

      transactions.push({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: normalizedDate,
        rawDate: String(dateRaw),
        narration,
        chqRef,
        withdrawal,
        deposit,
        balance,
        type: deposit > 0 ? 'income' : 'expense',
        amount: deposit > 0 ? deposit : withdrawal,
        ...categorization,
        source: 'HDFC Statement'
      });
    }

    if (transactions.length === 0) {
      // Last-ditch effort: try universal text line matching
      return this.parseText(csvContent, 'HDFC Statement (Raw)');
    }

    return transactions;
  }

  /**
   * HTML Table parser (for HDFC statement files that are HTML tables with .xls extension)
   */
  static parseHTMLTable(htmlString, sourceName = 'HDFC NetBanking HTML') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const table = doc.querySelector('table');
    if (!table) {
      throw new Error('No table found in HTML statement.');
    }

    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) {
      throw new Error('No transaction rows found in table.');
    }

    // Convert rows to 2D string array
    const grid = rows.map(tr => 
      Array.from(tr.querySelectorAll('th, td')).map(td => td.textContent.trim())
    );

    // Locate header
    let headerIdx = -1;
    for (let i = 0; i < Math.min(grid.length, 25); i++) {
      const text = grid[i].join(' ').toUpperCase();
      if ((text.includes('DATE') || text.includes('VAL DT')) && (text.includes('NARRATION') || text.includes('PARTICULAR'))) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) headerIdx = 0;

    const headers = grid[headerIdx].map(h => h.toUpperCase());
    const dateIdx = headers.findIndex(h => h.includes('DATE') || h.includes('DT'));
    const narrationIdx = headers.findIndex(h => h.includes('NARRATION') || h.includes('PARTICULAR'));
    const chqRefIdx = headers.findIndex(h => h.includes('CHQ') || h.includes('REF'));
    const withdrawalIdx = headers.findIndex(h => h.includes('WITHDRAWAL') || h.includes('DEBIT'));
    const depositIdx = headers.findIndex(h => h.includes('DEPOSIT') || h.includes('CREDIT'));
    const balanceIdx = headers.findIndex(h => h.includes('BALANCE'));

    const transactions = [];

    for (let i = headerIdx + 1; i < grid.length; i++) {
      const row = grid[i];
      if (!row || row.length === 0) continue;

      const dateRaw = dateIdx !== -1 ? row[dateIdx] : row[0];
      const normalizedDate = normalizeHDFCDate(dateRaw);
      if (!normalizedDate) continue;

      const narration = (narrationIdx !== -1 ? row[narrationIdx] : row[1] || '').trim();
      if (!narration || narration.toUpperCase().includes('TOTAL')) continue;

      const chqRef = chqRefIdx !== -1 ? row[chqRefIdx] : '';
      const withdrawal = cleanAmount(withdrawalIdx !== -1 ? row[withdrawalIdx] : '');
      const deposit = cleanAmount(depositIdx !== -1 ? row[depositIdx] : '');
      const balance = cleanAmount(balanceIdx !== -1 ? row[balanceIdx] : '');

      if (withdrawal === 0 && deposit === 0) continue;

      const categorization = categorizeTransaction({ narration, withdrawal, deposit });

      transactions.push({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: normalizedDate,
        rawDate: String(dateRaw),
        narration,
        chqRef,
        withdrawal,
        deposit,
        balance,
        type: deposit > 0 ? 'income' : 'expense',
        amount: deposit > 0 ? deposit : withdrawal,
        ...categorization,
        source: sourceName
      });
    }

    return transactions;
  }

  /**
   * Excel Parser using window.XLSX (SheetJS)
   */
  static parseExcel(arrayBuffer) {
    if (!window.XLSX) {
      throw new Error('SheetJS library is not available. Please try uploading the CSV version or paste statement text.');
    }

    const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Invalid Excel spreadsheet.');
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rows || rows.length === 0) {
      throw new Error('Spreadsheet sheet is empty.');
    }

    // Locate header row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const rowText = (rows[i] || []).join(' ').toUpperCase();
      if ((rowText.includes('NARRATION') || rowText.includes('PARTICULAR') || rowText.includes('DESCRIPTION')) &&
          (rowText.includes('WITHDRAWAL') || rowText.includes('DEPOSIT') || rowText.includes('DEBIT') || rowText.includes('CREDIT') || rowText.includes('AMOUNT'))) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) headerIdx = 0;

    const headers = (rows[headerIdx] || []).map(h => String(h || '').toUpperCase().trim());
    const dateIdx = headers.findIndex(h => h.includes('DATE') || h.includes('DT'));
    const narrationIdx = headers.findIndex(h => h.includes('NARRATION') || h.includes('PARTICULAR') || h.includes('DESCRIPTION'));
    const chqRefIdx = headers.findIndex(h => h.includes('CHQ') || h.includes('REF'));
    const withdrawalIdx = headers.findIndex(h => h.includes('WITHDRAWAL') || h.includes('DEBIT') || h.includes('DR'));
    const depositIdx = headers.findIndex(h => h.includes('DEPOSIT') || h.includes('CREDIT') || h.includes('CR'));
    const balanceIdx = headers.findIndex(h => h.includes('BALANCE'));

    const transactions = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const dateRaw = dateIdx !== -1 ? row[dateIdx] : row[0];
      const normalizedDate = normalizeHDFCDate(dateRaw);
      if (!normalizedDate) continue;

      const narration = String(narrationIdx !== -1 ? row[narrationIdx] : row[1] || '').trim();
      if (!narration || narration.toUpperCase().includes('TOTAL')) continue;

      const chqRef = String(chqRefIdx !== -1 ? row[chqRefIdx] : '').trim();
      const withdrawal = cleanAmount(withdrawalIdx !== -1 ? row[withdrawalIdx] : '');
      const deposit = cleanAmount(depositIdx !== -1 ? row[depositIdx] : '');
      const balance = cleanAmount(balanceIdx !== -1 ? row[balanceIdx] : '');

      if (withdrawal === 0 && deposit === 0) continue;

      const categorization = categorizeTransaction({ narration, withdrawal, deposit });

      transactions.push({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: normalizedDate,
        rawDate: String(dateRaw),
        narration,
        chqRef,
        withdrawal,
        deposit,
        balance,
        type: deposit > 0 ? 'income' : 'expense',
        amount: deposit > 0 ? deposit : withdrawal,
        ...categorization,
        source: 'HDFC Excel'
      });
    }

    return transactions;
  }

  /**
   * PDF Parser using window.pdfjsLib with full password handling
   */
  static async parsePDF(arrayBuffer, password = '') {
    if (!window.pdfjsLib) {
      throw new Error('PDF parsing library is not loaded. Please upload CSV/Excel or paste statement text.');
    }

    let pdf;
    try {
      const loadingTask = window.pdfjsLib.getDocument({
        data: arrayBuffer,
        password: password || undefined
      });
      pdf = await loadingTask.promise;
    } catch (err) {
      if (err.name === 'PasswordException' || String(err.message).includes('password')) {
        throw new Error('PASSWORD_REQUIRED: This HDFC PDF is encrypted. Enter your HDFC statement password in the box above (Customer ID or PAN in capital + DOB) and retry.');
      }
      throw new Error('PDF Error: ' + err.message);
    }

    const extractedLines = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Group items by vertical position Y
      const rowsByY = {};
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!rowsByY[y]) rowsByY[y] = [];
        rowsByY[y].push({ x: item.transform[4], text: item.str });
      });

      // Sort Y descending (top to bottom)
      const sortedY = Object.keys(rowsByY).sort((a, b) => Number(b) - Number(a));
      sortedY.forEach(y => {
        const sortedItems = rowsByY[y].sort((a, b) => a.x - b.x);
        const lineText = sortedItems.map(it => it.text).join(' ').trim();
        if (lineText) extractedLines.push(lineText);
      });
    }

    return this.parseText(extractedLines.join('\n'), 'HDFC Statement PDF');
  }

  /**
   * Universal Text / Regex Parser for extracted PDF lines or pasted text
   */
  static parseText(fullText, sourceName = 'Pasted Statement Text') {
    const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const transactions = [];

    // Supports:
    // "01/10/24 UPI-SWIGGY-... 489.00 124580.50"
    // "01-Oct-2024 INFOSYS SALARY 185000.00 CR"
    // "15/11/2026 ZERODHA SIP 35000.00"
    const dateRegex = /^(\d{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4}|\d{1,2}[\/\-\s][A-Za-z]{3}[\/\-\s]\d{2,4})\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(dateRegex);
      if (!match) continue;

      const rawDate = match[1];
      const normalizedDate = normalizeHDFCDate(rawDate);
      if (!normalizedDate) continue;

      const rest = match[2];

      // Extract numbers with 2 decimals
      const numberMatches = rest.match(/([0-9,]+\.\d{2})/g);
      if (!numberMatches || numberMatches.length === 0) continue;

      let withdrawal = 0;
      let deposit = 0;
      let balance = 0;

      const isCredit = /(?:CR|CREDIT|SALARY|INTEREST|REFUND|REVERSAL|DEPOSIT)/i.test(rest) && !/(?:DEBIT|DR|UPI\/|POS )/i.test(rest);

      if (numberMatches.length >= 2) {
        balance = cleanAmount(numberMatches[numberMatches.length - 1]);
        const txnAmount = cleanAmount(numberMatches[numberMatches.length - 2]);
        if (isCredit) {
          deposit = txnAmount;
        } else {
          withdrawal = txnAmount;
        }
      } else if (numberMatches.length === 1) {
        const amt = cleanAmount(numberMatches[0]);
        if (isCredit) {
          deposit = amt;
        } else {
          withdrawal = amt;
        }
      }

      // Extract narration without the trailing numbers
      let narration = rest.replace(/([0-9,]+\.\d{2})/g, '').replace(/\s+(CR|DR)\s*$/i, '').trim();

      // Read following lines if they are narration continuation
      let j = i + 1;
      while (j < lines.length && !lines[j].match(dateRegex) && !lines[j].toUpperCase().includes('TOTAL') && j - i <= 3) {
        const sub = lines[j].trim();
        if (sub && !sub.match(/^[0-9,]+\.\d{2}$/)) {
          narration += ' ' + sub;
        }
        j++;
      }

      if (withdrawal === 0 && deposit === 0) continue;

      const categorization = categorizeTransaction({ narration, withdrawal, deposit });

      transactions.push({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: normalizedDate,
        rawDate,
        narration,
        chqRef: '',
        withdrawal,
        deposit,
        balance,
        type: deposit > 0 ? 'income' : 'expense',
        amount: deposit > 0 ? deposit : withdrawal,
        ...categorization,
        source: sourceName
      });
    }

    return transactions;
  }
}

/**
 * Autodetects whether file is delimited by comma, tab, or semicolon
 */
function detectDelimiter(lines) {
  const sample = lines.slice(0, 15).join('\n');
  const tabs = (sample.match(/\t/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const semicolons = (sample.match(/;/g) || []).length;

  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas && semicolons > tabs) return ';';
  return ',';
}

/**
 * Universal delimited row parser respecting quotes and arbitrary delimiters
 */
function parseDelimitedRows(text, delimiter = ',') {
  const result = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let insideQuotes = false;
    let currentToken = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        row.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    row.push(currentToken.trim());
    result.push(row);
  }

  return result;
}

/**
 * Robust date normalizer: handles ISO, DD/MM/YYYY, DD-MM-YYYY, DD-Mon-YYYY ("01-Oct-2024"), and timestamps
 */
export function normalizeHDFCDate(dateVal) {
  if (!dateVal) return null;

  // Handle Date instance
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return dateVal.toISOString().slice(0, 10);
  }

  // Handle Excel serial date numbers
  if (typeof dateVal === 'number' && dateVal > 25000 && dateVal < 75000) {
    const d = new Date((dateVal - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const str = String(dateVal).trim();
  if (!str) return null;

  // Strip time if present: "01/10/2024 14:22:10" or "01/10/2024, 14:22"
  const dateOnly = str.split(/[T\s,]/)[0].trim();

  // Pattern 1: ISO YYYY-MM-DD
  const isoMatch = dateOnly.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Pattern 2: DD/MM/YY or DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numMatch = dateOnly.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    let year = numMatch[3];
    if (year.length === 2) {
      const yy = parseInt(year, 10);
      year = yy > 50 ? `19${year}` : `20${year}`;
    }
    const numMonth = parseInt(month, 10);
    const numDay = parseInt(day, 10);
    if (numMonth >= 1 && numMonth <= 12 && numDay >= 1 && numDay <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // Pattern 3: DD-Mon-YYYY e.g. "01-Oct-2024", "15-OCT-24", "01/Nov/2024", "01 Nov 2024"
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const monMatch = str.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3})[\/\-\s](\d{2,4})/i);
  if (monMatch) {
    const day = monMatch[1].padStart(2, '0');
    const monStr = monMatch[2].toLowerCase();
    const month = monthMap[monStr];
    let year = monMatch[3];
    if (year.length === 2) {
      const yy = parseInt(year, 10);
      year = yy > 50 ? `19${year}` : `20${year}`;
    }
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Converts currency string like "1,240.50", "450.00 Cr", "INR 120" into a clean float
 */
export function cleanAmount(val) {
  if (!val) return 0;
  if (typeof val === 'number') return Math.abs(val);

  const cleanStr = String(val)
    .replace(/,/g, '')
    .replace(/INR|RS\.?|CR|DR/gi, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
}
