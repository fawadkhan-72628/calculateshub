(function(){
  const moneyFmt = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
  const intFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const percentFmt = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 });

  function toNumber(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function clamp(n, min, max){
    if(!Number.isFinite(n)) return n;
    if(Number.isFinite(min)) n = Math.max(min, n);
    if(Number.isFinite(max)) n = Math.min(max, n);
    return n;
  }

  function formatMoney(v){
    if(!Number.isFinite(v)) return "—";
    return moneyFmt.format(v);
  }

  function formatNumber(v){
    if(!Number.isFinite(v)) return "—";
    return numberFmt.format(v);
  }

  function formatInt(v){
    if(!Number.isFinite(v)) return "—";
    return intFmt.format(v);
  }

  function formatPercentFromRate(rate){
    if(!Number.isFinite(rate)) return "—";
    return percentFmt.format(rate);
  }

  function monthlyPayment(principal, annualRatePct, months){
    const P = principal;
    const n = months;
    const r = (annualRatePct / 100) / 12;
    if(!Number.isFinite(P) || !Number.isFinite(n) || n <= 0) return NaN;
    if(!Number.isFinite(r) || r === 0) return P / n;
    const pow = Math.pow(1 + r, n);
    return P * (r * pow) / (pow - 1);
  }

  function simulateDebtPayoff(debts, extraPayment, mode){
    const list = Array.isArray(debts) ? debts.map(d => ({
      name: String(d.name || "Debt"),
      balance: Number(d.balance),
      apr: Number(d.apr),
      min: Number(d.min)
    })) : [];

    const cleaned = list.filter(d => Number.isFinite(d.balance) && d.balance > 0 && Number.isFinite(d.apr) && d.apr >= 0 && Number.isFinite(d.min) && d.min >= 0);
    if(cleaned.length === 0) return null;

    const extra = Number(extraPayment);
    const extraSafe = Number.isFinite(extra) && extra >= 0 ? extra : 0;

    function priorityIndex(d){
      if(mode === "avalanche") return -d.apr;
      return d.balance;
    }

    cleaned.sort((a, b) => {
      const pa = priorityIndex(a);
      const pb = priorityIndex(b);
      if(pa !== pb) return pa < pb ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });

    let months = 0;
    let totalInterest = 0;
    let totalPaid = 0;
    const maxMonths = 1200;

    while(months < maxMonths){
      const active = cleaned.filter(d => d.balance > 0);
      if(active.length === 0) break;

      months += 1;

      active.forEach(d => {
        const r = (d.apr / 100) / 12;
        const interest = r > 0 ? d.balance * r : 0;
        d.balance += interest;
        totalInterest += interest;
      });

      const budget = active.reduce((sum, d) => sum + d.min, 0) + extraSafe;
      let remaining = budget;

      active.forEach(d => {
        if(remaining <= 0) return;
        const pay = Math.min(d.balance, Math.max(0, d.min), remaining);
        d.balance -= pay;
        remaining -= pay;
        totalPaid += pay;
      });

      const stillActive = cleaned.filter(d => d.balance > 0);
      for(let i = 0; i < stillActive.length && remaining > 0; i++){
        const d = stillActive[i];
        const pay = Math.min(d.balance, remaining);
        d.balance -= pay;
        remaining -= pay;
        totalPaid += pay;
      }
    }

    const leftover = cleaned.filter(d => d.balance > 0);
    if(leftover.length) return null;
    return {
      months,
      totalInterest,
      totalPaid,
      order: cleaned.map(d => d.name).join(" → ")
    };
  }

  function safeDiv(a, b){
    if(!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return NaN;
    return a / b;
  }

  function gcdInt(a, b){
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    if(!Number.isFinite(x) || !Number.isFinite(y)) return 1;
    while(y !== 0){
      const t = x % y;
      x = y;
      y = t;
    }
    return x || 1;
  }

  function lcmInt(a, b){
    const x = Math.trunc(a);
    const y = Math.trunc(b);
    if(x === 0 || y === 0) return 0;
    return Math.abs((x / gcdInt(x, y)) * y);
  }

  function simplifyFraction(n, d){
    const nn = Math.trunc(n);
    const dd = Math.trunc(d);
    if(!Number.isFinite(nn) || !Number.isFinite(dd) || dd === 0) return null;
    const sign = dd < 0 ? -1 : 1;
    const g = gcdInt(nn, dd);
    return { n: (nn / g) * sign, d: Math.abs(dd / g) };
  }

  function parseFractionString(text){
    const raw = String(text || "").trim();
    if(!raw) return null;
    const m = raw.match(/^([+-]?\d+)\s*\/\s*([+-]?\d+)$/);
    if(!m) return null;
    const n = Number(m[1]);
    const d = Number(m[2]);
    return simplifyFraction(n, d);
  }

  function bestRational(x, maxDen){
    const value = Number(x);
    const maxD = Math.max(1, Math.trunc(maxDen || 10000));
    if(!Number.isFinite(value)) return null;

    const sign = value < 0 ? -1 : 1;
    let z = Math.abs(value);
    if(Math.abs(z - Math.round(z)) < 1e-12){
      return { n: sign * Math.round(z), d: 1 };
    }

    let h1 = 1, h2 = 0;
    let k1 = 0, k2 = 1;
    let b = z;
    for(let i = 0; i < 64; i++){
      const a = Math.floor(b);
      const h = a * h1 + h2;
      const k = a * k1 + k2;
      if(k > maxD){
        const t = Math.floor((maxD - k2) / k1);
        const hn = t * h1 + h2;
        const kn = t * k1 + k2;
        return simplifyFraction(sign * hn, kn);
      }
      if(Math.abs(z - h / k) < 1e-12){
        return simplifyFraction(sign * h, k);
      }
      h2 = h1; h1 = h;
      k2 = k1; k1 = k;
      const frac = b - a;
      if(frac === 0) break;
      b = 1 / frac;
    }
    return simplifyFraction(sign * h1, k1);
  }

  function fractionToMixedString(fr){
    if(!fr) return "—";
    const n = fr.n;
    const d = fr.d;
    if(d === 1) return String(n);
    const absN = Math.abs(n);
    const whole = Math.trunc(absN / d);
    const rem = absN % d;
    if(whole === 0) return `${n}/${d}`;
    const sign = n < 0 ? "-" : "";
    if(rem === 0) return sign + String(whole);
    return `${sign}${whole} ${rem}/${d}`;
  }

  function romanToInt(input){
    const s = String(input || "").trim().toUpperCase();
    if(!s) return null;
    const map = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
    let total = 0;
    let prev = 0;
    for(let i = s.length - 1; i >= 0; i--){
      const v = map[s[i]];
      if(!v) return null;
      if(v < prev) total -= v;
      else total += v;
      prev = v;
    }
    if(total <= 0 || total > 3999) return null;
    if(intToRoman(total) !== s) return null;
    return total;
  }

  function intToRoman(num){
    const n = Math.trunc(num);
    if(!(n >= 1 && n <= 3999)) return null;
    const table = [
      ["M",1000],["CM",900],["D",500],["CD",400],
      ["C",100],["XC",90],["L",50],["XL",40],
      ["X",10],["IX",9],["V",5],["IV",4],["I",1]
    ];
    let x = n;
    let out = "";
    for(const [sym, val] of table){
      while(x >= val){
        out += sym;
        x -= val;
      }
    }
    return out;
  }

  function parseDateUTC(raw){
    const s = String(raw || "").trim();
    if(!s) return null;
    const d = new Date(s + "T00:00:00Z");
    if(!Number.isFinite(d.getTime())) return null;
    return d;
  }

  function daysInMonthUTC(y, m){
    return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  }

  function addMonthsUTC(date, months){
    const d = new Date(date.getTime());
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const targetM = m + months;
    const ny = y + Math.floor(targetM / 12);
    const nm = ((targetM % 12) + 12) % 12;
    const maxDay = daysInMonthUTC(ny, nm);
    const nd = Math.min(day, maxDay);
    return new Date(Date.UTC(ny, nm, nd));
  }

  function diffYMDUTC(start, end){
    if(!start || !end) return null;
    const s = start.getTime();
    const e = end.getTime();
    if(!(Number.isFinite(s) && Number.isFinite(e)) || e < s) return null;

    const y1 = start.getUTCFullYear();
    const m1 = start.getUTCMonth();
    const d1 = start.getUTCDate();
    const y2 = end.getUTCFullYear();
    const m2 = end.getUTCMonth();
    const d2 = end.getUTCDate();

    let years = y2 - y1;
    if(m2 < m1 || (m2 === m1 && d2 < d1)) years--;

    let cursor = new Date(Date.UTC(y1 + years, m1, Math.min(d1, daysInMonthUTC(y1 + years, m1))));
    let months = 0;
    for(let i = 0; i < 24; i++){
      const next = addMonthsUTC(cursor, 1);
      if(next.getTime() <= e){
        cursor = next;
        months++;
      }else{
        break;
      }
    }

    const days = Math.round((e - cursor.getTime()) / (24 * 60 * 60 * 1000));
    const totalDays = Math.round((e - s) / (24 * 60 * 60 * 1000));
    return { years, months, days, totalDays };
  }

  function randomU32(){
    const cryptoObj = (typeof globalThis !== "undefined" && globalThis.crypto) ? globalThis.crypto : null;
    if(cryptoObj && typeof cryptoObj.getRandomValues === "function"){
      const a = new Uint32Array(1);
      cryptoObj.getRandomValues(a);
      return a[0];
    }
    return Math.floor(Math.random() * 0x100000000);
  }

  function randomFloat01(){
    return randomU32() / 0x100000000;
  }

  function randomIntInclusive(min, max){
    const lo = Math.ceil(Number(min));
    const hi = Math.floor(Number(max));
    if(!(Number.isFinite(lo) && Number.isFinite(hi))) return null;
    if(hi < lo) return null;
    const range = hi - lo + 1;
    if(!(range >= 1 && range <= 0x100000000)) return null;
    const bucket = Math.floor(0x100000000 / range) * range;
    let r = randomU32();
    while(r >= bucket) r = randomU32();
    return lo + (r % range);
  }

  function makePassword(opts){
    const length = Math.max(4, Math.min(64, Math.trunc(opts.length || 16)));
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums = "0123456789";
    const syms = "!@#$%^&*()-_=+[]{};:,.?/|~";
    const ambiguous = "Il1O0";

    const sets = [];
    if(opts.lower) sets.push(lower);
    if(opts.upper) sets.push(upper);
    if(opts.numbers) sets.push(nums);
    if(opts.symbols) sets.push(syms);
    if(sets.length === 0) sets.push(lower + upper + nums);

    let pool = sets.join("");
    if(opts.excludeAmbiguous){
      pool = Array.from(pool).filter(ch => !ambiguous.includes(ch)).join("");
    }
    if(!pool) pool = lower + upper + nums;

    const chars = [];
    sets.forEach(set => {
      let s = set;
      if(opts.excludeAmbiguous) s = Array.from(s).filter(ch => !ambiguous.includes(ch)).join("");
      if(!s) return;
      const idx = randomIntInclusive(0, s.length - 1);
      if(idx == null) return;
      chars.push(s[idx]);
    });
    while(chars.length < length){
      const idx = randomIntInclusive(0, pool.length - 1);
      if(idx == null) break;
      chars.push(pool[idx]);
    }
    for(let i = chars.length - 1; i > 0; i--){
      const j = randomIntInclusive(0, i);
      if(j == null) continue;
      const t = chars[i];
      chars[i] = chars[j];
      chars[j] = t;
    }
    return chars.join("");
  }

  function convertUnits(value, from, table){
    const v = Number(value);
    if(!Number.isFinite(v)) return null;
    const f = table[from];
    if(!f) return null;
    const base = v * f;
    const out = {};
    Object.keys(table).forEach(k => { out[k] = base / table[k]; });
    return out;
  }

  const CALCULATORS = [
    {
      id: "mortgage",
      category: "Financial",
      name: "Mortgage Calculator",
      description: "Estimate monthly payments with taxes, insurance, and PMI.",
      addedAt: "2025-12-25",
      popular: true,
      fields: [
        { key: "homePrice", label: "Home price", type: "number", unit: "USD", min: 0, step: 1000, defaultValue: 400000 },
        { key: "downPayment", label: "Down payment", type: "number", unit: "USD", min: 0, step: 1000, defaultValue: 80000 },
        { key: "interestRate", label: "Interest rate", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 6.25 },
        { key: "termYears", label: "Loan term", type: "number", unit: "years", min: 1, step: 1, defaultValue: 30 },
        { key: "propertyTax", label: "Property tax", type: "number", unit: "USD/year", min: 0, step: 100, defaultValue: 4200 },
        { key: "homeInsurance", label: "Home insurance", type: "number", unit: "USD/year", min: 0, step: 100, defaultValue: 1600 },
        { key: "pmiRate", label: "PMI rate (optional)", type: "number", unit: "%/year", min: 0, step: 0.01, defaultValue: 0.5 }
      ],
      compute(values){
        const homePrice = toNumber(values.homePrice);
        const downPayment = toNumber(values.downPayment);
        const interestRate = toNumber(values.interestRate);
        const termYears = toNumber(values.termYears);
        const propertyTax = toNumber(values.propertyTax);
        const homeInsurance = toNumber(values.homeInsurance);
        const pmiRate = toNumber(values.pmiRate);

        const loanAmount = homePrice - downPayment;
        const months = termYears * 12;
        const pi = monthlyPayment(loanAmount, interestRate, months);
        const monthlyTax = propertyTax / 12;
        const monthlyIns = homeInsurance / 12;
        const ltv = safeDiv(loanAmount, homePrice);
        const pmiMonthly = (Number.isFinite(ltv) && ltv > 0.80 && Number.isFinite(pmiRate) && pmiRate > 0) ? (loanAmount * (pmiRate / 100) / 12) : 0;
        const totalMonthly = pi + monthlyTax + monthlyIns + pmiMonthly;
        const totalPaid = pi * months;
        const totalInterest = totalPaid - loanAmount;

        return [
          { label: "Total monthly payment", value: formatMoney(totalMonthly), emphasis: true },
          { label: "Principal & interest", value: formatMoney(pi) },
          { label: "Property tax", value: formatMoney(monthlyTax) },
          { label: "Insurance", value: formatMoney(monthlyIns) },
          { label: "PMI", value: formatMoney(pmiMonthly) },
          { label: "Loan amount", value: formatMoney(loanAmount) },
          { label: "Total interest (term)", value: formatMoney(totalInterest) }
        ];
      }
    },
    {
      id: "loan",
      category: "Financial",
      name: "Loan Payment Calculator",
      description: "Calculate monthly payment, interest, and total cost.",
      addedAt: "2025-12-22",
      popular: true,
      fields: [
        { key: "principal", label: "Loan amount", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 15000 },
        { key: "interestRate", label: "Interest rate", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 8.9 },
        { key: "termMonths", label: "Term", type: "number", unit: "months", min: 1, step: 1, defaultValue: 60 }
      ],
      compute(values){
        const principal = toNumber(values.principal);
        const interestRate = toNumber(values.interestRate);
        const termMonths = toNumber(values.termMonths);
        const payment = monthlyPayment(principal, interestRate, termMonths);
        const totalPaid = payment * termMonths;
        const totalInterest = totalPaid - principal;
        return [
          { label: "Monthly payment", value: formatMoney(payment), emphasis: true },
          { label: "Total interest", value: formatMoney(totalInterest) },
          { label: "Total paid", value: formatMoney(totalPaid) }
        ];
      }
    },
    {
      id: "compound-interest",
      category: "Financial",
      name: "Compound Interest Calculator",
      description: "Project investment growth with contributions over time.",
      addedAt: "2025-12-20",
      popular: true,
      fields: [
        { key: "principal", label: "Starting amount", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 10000 },
        { key: "contribution", label: "Monthly contribution", type: "number", unit: "USD", min: 0, step: 10, defaultValue: 250 },
        { key: "annualRate", label: "Annual return", type: "number", unit: "%", min: -100, step: 0.01, defaultValue: 7.0 },
        { key: "years", label: "Years", type: "number", unit: "years", min: 0, step: 1, defaultValue: 20 },
        { key: "compoundsPerYear", label: "Compounds per year", type: "select", defaultValue: "12", options: [
          { value: "1", label: "1 (Yearly)" },
          { value: "4", label: "4 (Quarterly)" },
          { value: "12", label: "12 (Monthly)" },
          { value: "365", label: "365 (Daily)" }
        ] }
      ],
      compute(values){
        const principal = clamp(toNumber(values.principal), 0, Infinity);
        const contribution = clamp(toNumber(values.contribution), 0, Infinity);
        const annualRate = toNumber(values.annualRate);
        const years = clamp(toNumber(values.years), 0, 200);
        const m = clamp(toNumber(values.compoundsPerYear), 1, 365);
        const months = Math.round(years * 12);

        if(!Number.isFinite(principal) || !Number.isFinite(contribution) || !Number.isFinite(annualRate) || !Number.isFinite(months) || months < 0) return [];

        const periodicRate = (annualRate / 100) / m;
        const monthlyRate = Math.pow(1 + periodicRate, m / 12) - 1;
        let balance = principal;
        let totalContrib = 0;
        for(let i=0;i<months;i++){
          balance = balance * (1 + monthlyRate);
          balance = balance + contribution;
          totalContrib += contribution;
        }
        const totalInvested = principal + totalContrib;
        const gain = balance - totalInvested;
        return [
          { label: "Ending balance", value: formatMoney(balance), emphasis: true },
          { label: "Total invested", value: formatMoney(totalInvested) },
          { label: "Total gain", value: formatMoney(gain) }
        ];
      }
    },
    {
      id: "cagr",
      category: "Financial",
      name: "CAGR Calculator",
      description: "Find compound annual growth rate between two values.",
      addedAt: "2025-12-18",
      popular: false,
      fields: [
        { key: "startValue", label: "Starting value", type: "number", min: 0, step: 0.01, defaultValue: 10000 },
        { key: "endValue", label: "Ending value", type: "number", min: 0, step: 0.01, defaultValue: 18000 },
        { key: "years", label: "Years", type: "number", min: 0.01, step: 0.01, defaultValue: 3 }
      ],
      compute(values){
        const startValue = toNumber(values.startValue);
        const endValue = toNumber(values.endValue);
        const years = toNumber(values.years);
        if(!(startValue > 0) || !(endValue > 0) || !(years > 0)) return [];
        const cagr = Math.pow(endValue / startValue, 1 / years) - 1;
        return [
          { label: "CAGR", value: formatPercentFromRate(cagr), emphasis: true },
          { label: "Growth multiple", value: formatNumber(endValue / startValue) }
        ];
      }
    },
    {
      id: "simple-interest",
      category: "Financial",
      name: "Simple Interest Calculator",
      description: "Calculate simple interest and total amount.",
      addedAt: "2025-12-08",
      popular: false,
      fields: [
        { key: "principal", label: "Principal", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 5000 },
        { key: "annualRate", label: "Annual rate", type: "number", unit: "%", step: 0.01, defaultValue: 6 },
        { key: "years", label: "Time", type: "number", unit: "years", min: 0, step: 0.01, defaultValue: 3 }
      ],
      compute(values){
        const p = toNumber(values.principal);
        const r = toNumber(values.annualRate) / 100;
        const t = toNumber(values.years);
        if(!Number.isFinite(p) || !Number.isFinite(r) || !Number.isFinite(t)) return [];
        const interest = p * r * t;
        const total = p + interest;
        return [
          { label: "Total amount", value: formatMoney(total), emphasis: true },
          { label: "Interest", value: formatMoney(interest) }
        ];
      }
    },
    {
      id: "savings",
      category: "Financial",
      name: "Savings Calculator",
      description: "Estimate future value with regular monthly savings.",
      addedAt: "2025-12-07",
      popular: false,
      fields: [
        { key: "initial", label: "Starting amount", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 2000 },
        { key: "monthly", label: "Monthly contribution", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 200 },
        { key: "annualRate", label: "Annual interest rate", type: "number", unit: "%", step: 0.01, defaultValue: 4.5 },
        { key: "years", label: "Years", type: "number", min: 0, step: 0.1, defaultValue: 10 }
      ],
      compute(values){
        const initial = clamp(toNumber(values.initial), 0, Infinity);
        const monthly = clamp(toNumber(values.monthly), 0, Infinity);
        const annualRate = toNumber(values.annualRate);
        const years = clamp(toNumber(values.years), 0, 200);
        if(!Number.isFinite(initial) || !Number.isFinite(monthly) || !Number.isFinite(annualRate) || !Number.isFinite(years)) return [];
        const months = Math.round(years * 12);
        const r = (annualRate / 100) / 12;
        let balance = initial;
        let contributed = 0;
        for(let i = 0; i < months; i++){
          balance = balance * (1 + r);
          balance += monthly;
          contributed += monthly;
        }
        const totalContrib = initial + contributed;
        const interest = balance - totalContrib;
        return [
          { label: "Ending balance", value: formatMoney(balance), emphasis: true },
          { label: "Total contributed", value: formatMoney(totalContrib) },
          { label: "Interest earned", value: formatMoney(interest) }
        ];
      }
    },
    {
      id: "roi",
      category: "Financial",
      name: "Return on Investment (ROI) Calculator",
      description: "Calculate ROI from cost and current value.",
      addedAt: "2025-12-06",
      popular: false,
      fields: [
        { key: "cost", label: "Cost (investment)", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 10000 },
        { key: "value", label: "Current value", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 13500 }
      ],
      compute(values){
        const cost = toNumber(values.cost);
        const value = toNumber(values.value);
        if(!(cost > 0) || !Number.isFinite(value)) return [];
        const profit = value - cost;
        const roi = profit / cost;
        return [
          { label: "ROI", value: formatPercentFromRate(roi), emphasis: true },
          { label: "Profit", value: formatMoney(profit) }
        ];
      }
    },
    {
      id: "net-worth",
      category: "Financial",
      name: "Net Worth Calculator",
      description: "Compute net worth from assets and liabilities.",
      addedAt: "2025-12-05",
      popular: false,
      fields: [
        { key: "assets", label: "Total assets", type: "number", unit: "USD", step: 0.01, defaultValue: 250000 },
        { key: "liabilities", label: "Total liabilities", type: "number", unit: "USD", step: 0.01, defaultValue: 145000 }
      ],
      compute(values){
        const assets = toNumber(values.assets);
        const liabilities = toNumber(values.liabilities);
        if(!Number.isFinite(assets) || !Number.isFinite(liabilities)) return [];
        const netWorth = assets - liabilities;
        const debtRatio = liabilities === 0 ? 0 : (liabilities / Math.max(assets, 1e-9));
        return [
          { label: "Net worth", value: formatMoney(netWorth), emphasis: true },
          { label: "Assets", value: formatMoney(assets) },
          { label: "Liabilities", value: formatMoney(liabilities) },
          { label: "Liabilities / assets", value: formatPercentFromRate(debtRatio) }
        ];
      }
    },
    {
      id: "credit-card-interest",
      category: "Financial",
      name: "Credit Card Interest Calculator",
      description: "Estimate monthly and daily interest from balance and APR.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "balance", label: "Current balance", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 2500 },
        { key: "apr", label: "APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 24.99 }
      ],
      compute(values){
        const bal = toNumber(values.balance);
        const apr = toNumber(values.apr);
        if(!Number.isFinite(bal) || bal < 0 || !Number.isFinite(apr) || apr < 0) return [];
        const daily = bal * (apr / 100) / 365;
        const monthly = bal * (apr / 100) / 12;
        return [
          { label: "Estimated monthly interest", value: formatMoney(monthly), emphasis: true },
          { label: "Estimated daily interest", value: formatMoney(daily) },
          { label: "Balance", value: formatMoney(bal) }
        ];
      }
    },
    {
      id: "credit-card-minimum-payment",
      category: "Financial",
      name: "Credit Card Minimum Payment Calculator",
      description: "Estimate payoff time and interest using a minimum payment rule.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "balance", label: "Starting balance", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 4200 },
        { key: "apr", label: "APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 24.99 },
        { key: "minPct", label: "Minimum payment percent", type: "number", unit: "%", min: 0, step: 0.1, defaultValue: 2 },
        { key: "minDollar", label: "Minimum payment floor", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 35 },
        { key: "extra", label: "Extra payment", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 50 }
      ],
      compute(values){
        let bal = toNumber(values.balance);
        const apr = toNumber(values.apr);
        const minPct = toNumber(values.minPct);
        const minDollar = toNumber(values.minDollar);
        const extra = toNumber(values.extra);
        if(!Number.isFinite(bal) || bal <= 0) return [];
        if(!Number.isFinite(apr) || apr < 0) return [];
        if(!Number.isFinite(minPct) || minPct < 0) return [];
        if(!Number.isFinite(minDollar) || minDollar < 0) return [];
        if(!Number.isFinite(extra) || extra < 0) return [];

        const r = (apr / 100) / 12;
        let months = 0;
        let totalInterest = 0;
        let totalPaid = 0;
        const maxMonths = 1200;
        for(let i = 0; i < maxMonths && bal > 0.005; i++){
          months += 1;
          const interest = r > 0 ? bal * r : 0;
          bal += interest;
          totalInterest += interest;

          const minPay = Math.max(minDollar, bal * (minPct / 100));
          let pay = minPay + extra;
          if(pay > bal) pay = bal;
          if(pay <= 0) break;
          bal -= pay;
          totalPaid += pay;
        }
        const done = bal <= 0.005;
        const years = months / 12;
        return [
          { label: "Payoff time", value: done ? `${formatInt(months)} months (${formatNumber(years)} years)` : `> ${formatInt(maxMonths)} months`, emphasis: true },
          { label: "Total interest", value: formatMoney(totalInterest) },
          { label: "Total paid", value: formatMoney(totalPaid) }
        ];
      }
    },
    {
      id: "debt-snowball",
      category: "Financial",
      name: "Debt Snowball Calculator",
      description: "Estimate payoff time by paying smallest balance first.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "d1Name", label: "Debt 1 name", type: "text", defaultValue: "Card A" },
        { key: "d1Bal", label: "Debt 1 balance", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 1200 },
        { key: "d1Apr", label: "Debt 1 APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 26.99 },
        { key: "d1Min", label: "Debt 1 minimum", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 40 },
        { key: "d2Name", label: "Debt 2 name", type: "text", defaultValue: "Card B" },
        { key: "d2Bal", label: "Debt 2 balance", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 3400 },
        { key: "d2Apr", label: "Debt 2 APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 21.99 },
        { key: "d2Min", label: "Debt 2 minimum", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 85 },
        { key: "d3Name", label: "Debt 3 name", type: "text", defaultValue: "Loan" },
        { key: "d3Bal", label: "Debt 3 balance", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 7800 },
        { key: "d3Apr", label: "Debt 3 APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 11.5 },
        { key: "d3Min", label: "Debt 3 minimum", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 210 },
        { key: "extra", label: "Extra monthly payment", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 100 }
      ],
      compute(values){
        const debts = [
          { name: values.d1Name, balance: toNumber(values.d1Bal), apr: toNumber(values.d1Apr), min: toNumber(values.d1Min) },
          { name: values.d2Name, balance: toNumber(values.d2Bal), apr: toNumber(values.d2Apr), min: toNumber(values.d2Min) },
          { name: values.d3Name, balance: toNumber(values.d3Bal), apr: toNumber(values.d3Apr), min: toNumber(values.d3Min) }
        ];
        const extra = toNumber(values.extra);
        const sim = simulateDebtPayoff(debts, extra, "snowball");
        if(!sim) return [];
        const years = sim.months / 12;
        return [
          { label: "Payoff time", value: `${formatInt(sim.months)} months (${formatNumber(years)} years)`, emphasis: true },
          { label: "Total interest", value: formatMoney(sim.totalInterest) },
          { label: "Total paid", value: formatMoney(sim.totalPaid) },
          { label: "Payoff order", value: sim.order }
        ];
      }
    },
    {
      id: "debt-avalanche",
      category: "Financial",
      name: "Debt Avalanche Calculator",
      description: "Estimate payoff time by paying highest APR first.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "d1Name", label: "Debt 1 name", type: "text", defaultValue: "Card A" },
        { key: "d1Bal", label: "Debt 1 balance", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 1200 },
        { key: "d1Apr", label: "Debt 1 APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 26.99 },
        { key: "d1Min", label: "Debt 1 minimum", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 40 },
        { key: "d2Name", label: "Debt 2 name", type: "text", defaultValue: "Card B" },
        { key: "d2Bal", label: "Debt 2 balance", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 3400 },
        { key: "d2Apr", label: "Debt 2 APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 21.99 },
        { key: "d2Min", label: "Debt 2 minimum", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 85 },
        { key: "d3Name", label: "Debt 3 name", type: "text", defaultValue: "Loan" },
        { key: "d3Bal", label: "Debt 3 balance", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 7800 },
        { key: "d3Apr", label: "Debt 3 APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 11.5 },
        { key: "d3Min", label: "Debt 3 minimum", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 210 },
        { key: "extra", label: "Extra monthly payment", type: "number", unit: "USD", min: 0, step: 1, defaultValue: 100 }
      ],
      compute(values){
        const debts = [
          { name: values.d1Name, balance: toNumber(values.d1Bal), apr: toNumber(values.d1Apr), min: toNumber(values.d1Min) },
          { name: values.d2Name, balance: toNumber(values.d2Bal), apr: toNumber(values.d2Apr), min: toNumber(values.d2Min) },
          { name: values.d3Name, balance: toNumber(values.d3Bal), apr: toNumber(values.d3Apr), min: toNumber(values.d3Min) }
        ];
        const extra = toNumber(values.extra);
        const sim = simulateDebtPayoff(debts, extra, "avalanche");
        if(!sim) return [];
        const years = sim.months / 12;
        return [
          { label: "Payoff time", value: `${formatInt(sim.months)} months (${formatNumber(years)} years)`, emphasis: true },
          { label: "Total interest", value: formatMoney(sim.totalInterest) },
          { label: "Total paid", value: formatMoney(sim.totalPaid) },
          { label: "Payoff order", value: sim.order }
        ];
      }
    },
    {
      id: "auto-loan",
      category: "Financial",
      name: "Auto Loan Calculator",
      description: "Estimate monthly car payment and total interest.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "price", label: "Vehicle price", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 28000 },
        { key: "down", label: "Down payment", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 3000 },
        { key: "trade", label: "Trade-in value", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 0 },
        { key: "tax", label: "Sales tax", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 7 },
        { key: "apr", label: "APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 6.5 },
        { key: "months", label: "Term", type: "number", unit: "months", min: 1, step: 1, defaultValue: 60 }
      ],
      compute(values){
        const price = toNumber(values.price);
        const down = toNumber(values.down);
        const trade = toNumber(values.trade);
        const tax = toNumber(values.tax);
        const apr = toNumber(values.apr);
        const months = toNumber(values.months);
        if(!Number.isFinite(price) || price < 0) return [];
        if(!Number.isFinite(down) || down < 0) return [];
        if(!Number.isFinite(trade) || trade < 0) return [];
        if(!Number.isFinite(tax) || tax < 0) return [];
        if(!Number.isFinite(apr) || apr < 0) return [];
        if(!(months > 0)) return [];
        const taxable = Math.max(0, price - down - trade);
        const loan = taxable * (1 + tax / 100);
        const pay = monthlyPayment(loan, apr, months);
        const totalPaid = pay * months;
        const interest = totalPaid - loan;
        return [
          { label: "Monthly payment", value: formatMoney(pay), emphasis: true },
          { label: "Loan amount", value: formatMoney(loan) },
          { label: "Total interest", value: formatMoney(interest) }
        ];
      }
    },
    {
      id: "refinance",
      category: "Financial",
      name: "Refinance Calculator",
      description: "Compare current loan vs refinance to estimate savings.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "balance", label: "Current loan balance", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 185000 },
        { key: "currentRate", label: "Current APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 7.25 },
        { key: "remainingMonths", label: "Remaining term", type: "number", unit: "months", min: 1, step: 1, defaultValue: 300 },
        { key: "newRate", label: "New APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 6.25 },
        { key: "newMonths", label: "New term", type: "number", unit: "months", min: 1, step: 1, defaultValue: 300 },
        { key: "closing", label: "Closing costs", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 3500 }
      ],
      compute(values){
        const bal = toNumber(values.balance);
        const cr = toNumber(values.currentRate);
        const rm = toNumber(values.remainingMonths);
        const nr = toNumber(values.newRate);
        const nm = toNumber(values.newMonths);
        const closing = toNumber(values.closing);
        if(!Number.isFinite(bal) || bal <= 0) return [];
        if(!Number.isFinite(cr) || cr < 0) return [];
        if(!(rm > 0)) return [];
        if(!Number.isFinite(nr) || nr < 0) return [];
        if(!(nm > 0)) return [];
        if(!Number.isFinite(closing) || closing < 0) return [];

        const currentPay = monthlyPayment(bal, cr, rm);
        const newPay = monthlyPayment(bal, nr, nm);
        const monthlySavings = currentPay - newPay;
        const breakeven = monthlySavings > 0 ? (closing / monthlySavings) : NaN;
        const currentInterest = currentPay * rm - bal;
        const newInterest = newPay * nm - bal;
        const interestDiff = currentInterest - newInterest;
        return [
          { label: "Monthly savings", value: Number.isFinite(monthlySavings) ? formatMoney(monthlySavings) : "—", emphasis: true },
          { label: "Current payment", value: formatMoney(currentPay) },
          { label: "New payment", value: formatMoney(newPay) },
          { label: "Break-even (months)", value: Number.isFinite(breakeven) ? formatNumber(breakeven) : "—" },
          { label: "Interest saved (approx)", value: formatMoney(interestDiff) }
        ];
      }
    },
    {
      id: "amortization-schedule",
      category: "Financial",
      name: "Amortization Schedule Calculator",
      description: "Calculate payment and show an amortization schedule for a loan.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "principal", label: "Loan amount", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 250000 },
        { key: "interestRate", label: "APR", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 6.25 },
        { key: "termMonths", label: "Term", type: "number", unit: "months", min: 1, step: 1, defaultValue: 360 }
      ],
      compute(values){
        const p = toNumber(values.principal);
        const r = toNumber(values.interestRate);
        const n = toNumber(values.termMonths);
        if(!(p > 0) || !Number.isFinite(r) || r < 0 || !(n > 0)) return [];
        const pay = monthlyPayment(p, r, n);
        const totalPaid = pay * n;
        const interest = totalPaid - p;
        return [
          { label: "Monthly payment", value: formatMoney(pay), emphasis: true },
          { label: "Total interest", value: formatMoney(interest) },
          { label: "Total paid", value: formatMoney(totalPaid) }
        ];
      }
    },
    {
      id: "inflation",
      category: "Financial",
      name: "Inflation Calculator",
      description: "Estimate future value or purchasing power after inflation.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "amount", label: "Amount today", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 1000 },
        { key: "rate", label: "Annual inflation rate", type: "number", unit: "%", step: 0.01, defaultValue: 3.2 },
        { key: "years", label: "Years", type: "number", min: 0, step: 0.1, defaultValue: 10 }
      ],
      compute(values){
        const amt = toNumber(values.amount);
        const rate = toNumber(values.rate);
        const years = toNumber(values.years);
        if(!Number.isFinite(amt) || amt < 0 || !Number.isFinite(rate) || !Number.isFinite(years) || years < 0) return [];
        const r = rate / 100;
        const factor = Math.pow(1 + r, years);
        const future = amt * factor;
        const purchasing = factor === 0 ? NaN : (amt / factor);
        return [
          { label: "Future value", value: formatMoney(future), emphasis: true },
          { label: "Purchasing power (today's dollars)", value: formatMoney(purchasing) },
          { label: "Inflation factor", value: formatNumber(factor) }
        ];
      }
    },
    {
      id: "emergency-fund",
      category: "Financial",
      name: "Emergency Fund Calculator",
      description: "Estimate emergency fund target based on monthly expenses.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "expenses", label: "Monthly expenses", type: "number", unit: "USD", min: 0, step: 10, defaultValue: 3200 },
        { key: "months", label: "Months of coverage", type: "number", min: 0, step: 1, defaultValue: 6 },
        { key: "saved", label: "Current emergency savings", type: "number", unit: "USD", min: 0, step: 10, defaultValue: 2500 }
      ],
      compute(values){
        const expenses = toNumber(values.expenses);
        const months = toNumber(values.months);
        const saved = toNumber(values.saved);
        if(!Number.isFinite(expenses) || expenses < 0 || !Number.isFinite(months) || months < 0 || !Number.isFinite(saved) || saved < 0) return [];
        const target = expenses * months;
        const gap = Math.max(0, target - saved);
        const currentMonths = expenses === 0 ? (saved === 0 ? 0 : Infinity) : (saved / expenses);
        return [
          { label: "Target emergency fund", value: formatMoney(target), emphasis: true },
          { label: "Shortfall", value: formatMoney(gap) },
          { label: "Current coverage", value: Number.isFinite(currentMonths) ? (formatNumber(currentMonths) + " months") : "∞" }
        ];
      }
    },
    {
      id: "retirement-savings",
      category: "Financial",
      name: "Retirement Savings Calculator",
      description: "Estimate retirement balance from savings rate and returns.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "currentAge", label: "Current age", type: "number", min: 0, step: 1, defaultValue: 30 },
        { key: "retireAge", label: "Retirement age", type: "number", min: 0, step: 1, defaultValue: 65 },
        { key: "current", label: "Current savings", type: "number", unit: "USD", min: 0, step: 100, defaultValue: 15000 },
        { key: "monthly", label: "Monthly contribution", type: "number", unit: "USD", min: 0, step: 10, defaultValue: 400 },
        { key: "return", label: "Expected annual return", type: "number", unit: "%", step: 0.01, defaultValue: 7 }
      ],
      compute(values){
        const currentAge = toNumber(values.currentAge);
        const retireAge = toNumber(values.retireAge);
        const current = toNumber(values.current);
        const monthly = toNumber(values.monthly);
        const rPct = toNumber(values.return);
        if(!Number.isFinite(currentAge) || currentAge < 0) return [];
        if(!Number.isFinite(retireAge) || retireAge <= currentAge) return [];
        if(!Number.isFinite(current) || current < 0) return [];
        if(!Number.isFinite(monthly) || monthly < 0) return [];
        if(!Number.isFinite(rPct)) return [];
        const years = retireAge - currentAge;
        const months = Math.round(years * 12);
        const r = (rPct / 100) / 12;
        const pow = Math.pow(1 + r, months);
        const fvPrincipal = current * pow;
        const fvContrib = r === 0 ? (monthly * months) : (monthly * ((pow - 1) / r));
        const fv = fvPrincipal + fvContrib;
        const invested = current + monthly * months;
        const gain = fv - invested;
        return [
          { label: "Estimated balance at retirement", value: formatMoney(fv), emphasis: true },
          { label: "Total contributed", value: formatMoney(invested) },
          { label: "Estimated growth", value: formatMoney(gain) }
        ];
      }
    },
    {
      id: "break-even",
      category: "Business",
      name: "Break-Even Calculator",
      description: "Estimate how many units you need to break even.",
      addedAt: "2025-12-19",
      popular: false,
      fields: [
        { key: "fixedCosts", label: "Fixed costs", type: "number", unit: "USD", min: 0, step: 50, defaultValue: 2500 },
        { key: "pricePerUnit", label: "Price per unit", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 25 },
        { key: "variableCostPerUnit", label: "Variable cost per unit", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 8 }
      ],
      compute(values){
        const fixed = toNumber(values.fixedCosts);
        const price = toNumber(values.pricePerUnit);
        const variable = toNumber(values.variableCostPerUnit);
        const contribution = price - variable;
        const units = safeDiv(fixed, contribution);
        return [
          { label: "Break-even units", value: formatNumber(units), emphasis: true },
          { label: "Contribution per unit", value: formatMoney(contribution) }
        ];
      }
    },
    {
      id: "profit-margin",
      category: "Business",
      name: "Profit Margin Calculator",
      description: "Compute margin and markup from revenue and costs.",
      addedAt: "2025-12-17",
      popular: false,
      fields: [
        { key: "revenue", label: "Revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 10000 },
        { key: "cost", label: "Cost", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 7200 }
      ],
      compute(values){
        const revenue = toNumber(values.revenue);
        const cost = toNumber(values.cost);
        if(!(revenue > 0) || !Number.isFinite(cost)) return [];
        const profit = revenue - cost;
        const margin = profit / revenue;
        const markup = safeDiv(profit, cost);
        return [
          { label: "Profit", value: formatMoney(profit), emphasis: true },
          { label: "Margin", value: formatPercentFromRate(margin) },
          { label: "Markup", value: formatPercentFromRate(markup) }
        ];
      }
    },
    {
      id: "cash-ratio",
      category: "Business",
      name: "Cash Ratio Calculator",
      description: "Measure cash and equivalents against current liabilities.",
      addedAt: "2025-12-04",
      popular: false,
      fields: [
        { key: "cash", label: "Cash", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 12000 },
        { key: "equivalents", label: "Cash equivalents", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 8000 },
        { key: "liabilities", label: "Current liabilities", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 25000 }
      ],
      compute(values){
        const cash = toNumber(values.cash);
        const eq = toNumber(values.equivalents);
        const liab = toNumber(values.liabilities);
        if(!Number.isFinite(cash) || !Number.isFinite(eq) || !(liab > 0)) return [];
        const ratio = (cash + eq) / liab;
        return [
          { label: "Cash ratio", value: formatNumber(ratio), emphasis: true },
          { label: "Cash + equivalents", value: formatMoney(cash + eq) }
        ];
      }
    },
    {
      id: "commission",
      category: "Business",
      name: "Commission Calculator",
      description: "Calculate commission from sales and commission rate.",
      addedAt: "2025-12-03",
      popular: false,
      fields: [
        { key: "sales", label: "Sales amount", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 5000 },
        { key: "rate", label: "Commission rate", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 7.5 }
      ],
      compute(values){
        const sales = toNumber(values.sales);
        const rate = toNumber(values.rate);
        if(!Number.isFinite(sales) || !Number.isFinite(rate)) return [];
        const commission = sales * (rate / 100);
        return [
          { label: "Commission", value: formatMoney(commission), emphasis: true },
          { label: "Sales", value: formatMoney(sales) }
        ];
      }
    },
    {
      id: "discount",
      category: "Business",
      name: "Discount Calculator",
      description: "Find discounted price from original price and percent off.",
      addedAt: "2025-12-02",
      popular: false,
      fields: [
        { key: "original", label: "Original price", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 120 },
        { key: "percent", label: "Discount", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 15 }
      ],
      compute(values){
        const original = toNumber(values.original);
        const percent = toNumber(values.percent);
        if(!Number.isFinite(original) || !Number.isFinite(percent)) return [];
        const discountAmount = original * (percent / 100);
        const finalPrice = original - discountAmount;
        return [
          { label: "Final price", value: formatMoney(finalPrice), emphasis: true },
          { label: "Discount amount", value: formatMoney(discountAmount) }
        ];
      }
    },
    {
      id: "gst",
      category: "Business",
      name: "Goods and Services Tax (GST) Calculator",
      description: "Add or extract GST from an amount.",
      addedAt: "2025-12-01",
      popular: false,
      fields: [
        { key: "amount", label: "Amount", type: "number", unit: "USD", step: 0.01, defaultValue: 100 },
        { key: "rate", label: "GST rate", type: "number", unit: "%", step: 0.01, defaultValue: 10 },
        { key: "mode", label: "Mode", type: "select", defaultValue: "exclusive", options: [
          { value: "exclusive", label: "Tax exclusive (add tax)" },
          { value: "inclusive", label: "Tax inclusive (extract tax)" }
        ] }
      ],
      compute(values){
        const amount = toNumber(values.amount);
        const rate = toNumber(values.rate) / 100;
        const mode = String(values.mode || "exclusive");
        if(!Number.isFinite(amount) || !Number.isFinite(rate) || rate < 0) return [];
        if(mode === "inclusive"){
          const base = amount / (1 + rate);
          const tax = amount - base;
          return [
            { label: "Tax", value: formatMoney(tax), emphasis: true },
            { label: "Base amount", value: formatMoney(base) },
            { label: "Total (inclusive)", value: formatMoney(amount) }
          ];
        }
        const tax = amount * rate;
        const total = amount + tax;
        return [
          { label: "Total (with GST)", value: formatMoney(total), emphasis: true },
          { label: "GST", value: formatMoney(tax) }
        ];
      }
    },
    {
      id: "sales-tax",
      category: "Business",
      name: "Sales Tax Calculator",
      description: "Add or extract sales tax from an amount.",
      addedAt: "2025-11-30",
      popular: false,
      fields: [
        { key: "amount", label: "Amount", type: "number", unit: "USD", step: 0.01, defaultValue: 100 },
        { key: "rate", label: "Sales tax rate", type: "number", unit: "%", step: 0.01, defaultValue: 8.25 },
        { key: "mode", label: "Mode", type: "select", defaultValue: "exclusive", options: [
          { value: "exclusive", label: "Tax exclusive (add tax)" },
          { value: "inclusive", label: "Tax inclusive (extract tax)" }
        ] }
      ],
      compute(values){
        const amount = toNumber(values.amount);
        const rate = toNumber(values.rate) / 100;
        const mode = String(values.mode || "exclusive");
        if(!Number.isFinite(amount) || !Number.isFinite(rate) || rate < 0) return [];
        if(mode === "inclusive"){
          const base = amount / (1 + rate);
          const tax = amount - base;
          return [
            { label: "Tax", value: formatMoney(tax), emphasis: true },
            { label: "Base amount", value: formatMoney(base) },
            { label: "Total (inclusive)", value: formatMoney(amount) }
          ];
        }
        const tax = amount * rate;
        const total = amount + tax;
        return [
          { label: "Total (with tax)", value: formatMoney(total), emphasis: true },
          { label: "Tax", value: formatMoney(tax) }
        ];
      }
    },
    {
      id: "vat",
      category: "Business",
      name: "Value-Added Tax (VAT) Calculator",
      description: "Add or extract VAT from an amount.",
      addedAt: "2025-11-29",
      popular: false,
      fields: [
        { key: "amount", label: "Amount", type: "number", unit: "USD", step: 0.01, defaultValue: 100 },
        { key: "rate", label: "VAT rate", type: "number", unit: "%", step: 0.01, defaultValue: 20 },
        { key: "mode", label: "Mode", type: "select", defaultValue: "exclusive", options: [
          { value: "exclusive", label: "Tax exclusive (add tax)" },
          { value: "inclusive", label: "Tax inclusive (extract tax)" }
        ] }
      ],
      compute(values){
        const amount = toNumber(values.amount);
        const rate = toNumber(values.rate) / 100;
        const mode = String(values.mode || "exclusive");
        if(!Number.isFinite(amount) || !Number.isFinite(rate) || rate < 0) return [];
        if(mode === "inclusive"){
          const base = amount / (1 + rate);
          const tax = amount - base;
          return [
            { label: "VAT", value: formatMoney(tax), emphasis: true },
            { label: "Base amount", value: formatMoney(base) },
            { label: "Total (inclusive)", value: formatMoney(amount) }
          ];
        }
        const tax = amount * rate;
        const total = amount + tax;
        return [
          { label: "Total (with VAT)", value: formatMoney(total), emphasis: true },
          { label: "VAT", value: formatMoney(tax) }
        ];
      }
    },
    {
      id: "ecom-conversion-rate",
      category: "E-commerce",
      name: "E-commerce Conversion Rate Calculator",
      description: "Calculate conversion rate from sessions and orders.",
      addedAt: "2025-12-29",
      popular: true,
      fields: [
        { key: "sessions", label: "Sessions", type: "number", min: 0, step: 1, defaultValue: 10000 },
        { key: "orders", label: "Orders", type: "number", min: 0, step: 1, defaultValue: 250 }
      ],
      compute(values){
        const sessions = toNumber(values.sessions);
        const orders = toNumber(values.orders);
        if(!(sessions > 0) || !Number.isFinite(orders) || orders < 0) return [];
        const rate = orders / sessions;
        return [
          { label: "Conversion rate", value: formatPercentFromRate(rate), emphasis: true },
          { label: "Orders", value: formatNumber(orders) },
          { label: "Sessions", value: formatNumber(sessions) }
        ];
      }
    },
    {
      id: "cart-abandonment-rate",
      category: "E-commerce",
      name: "Cart Abandonment Rate Calculator",
      description: "Calculate cart abandonment rate from checkouts started and orders.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "checkoutsStarted", label: "Checkouts started", type: "number", min: 0, step: 1, defaultValue: 1200 },
        { key: "orders", label: "Orders (completed)", type: "number", min: 0, step: 1, defaultValue: 300 }
      ],
      compute(values){
        const started = toNumber(values.checkoutsStarted);
        const orders = toNumber(values.orders);
        if(!(started > 0) || !Number.isFinite(orders) || orders < 0) return [];
        const completion = Math.min(1, Math.max(0, orders / started));
        const abandonment = 1 - completion;
        return [
          { label: "Cart abandonment rate", value: formatPercentFromRate(abandonment), emphasis: true },
          { label: "Checkout completion rate", value: formatPercentFromRate(completion) },
          { label: "Checkouts started", value: formatNumber(started) }
        ];
      }
    },
    {
      id: "average-order-value",
      category: "E-commerce",
      name: "Average Order Value (AOV) Calculator",
      description: "Calculate AOV from revenue and orders.",
      addedAt: "2025-12-29",
      popular: true,
      fields: [
        { key: "revenue", label: "Revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 25000 },
        { key: "orders", label: "Orders", type: "number", min: 0, step: 1, defaultValue: 400 }
      ],
      compute(values){
        const revenue = toNumber(values.revenue);
        const orders = toNumber(values.orders);
        if(!Number.isFinite(revenue) || revenue < 0 || !(orders > 0)) return [];
        const aov = revenue / orders;
        return [
          { label: "Average order value", value: formatMoney(aov), emphasis: true },
          { label: "Revenue", value: formatMoney(revenue) },
          { label: "Orders", value: formatNumber(orders) }
        ];
      }
    },
    {
      id: "customer-acquisition-cost",
      category: "E-commerce",
      name: "Customer Acquisition Cost (CAC) Calculator",
      description: "Calculate CAC from marketing spend and new customers.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "spend", label: "Marketing spend", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 5000 },
        { key: "newCustomers", label: "New customers", type: "number", min: 0, step: 1, defaultValue: 200 }
      ],
      compute(values){
        const spend = toNumber(values.spend);
        const customers = toNumber(values.newCustomers);
        if(!Number.isFinite(spend) || spend < 0 || !(customers > 0)) return [];
        const cac = spend / customers;
        return [
          { label: "CAC", value: formatMoney(cac), emphasis: true },
          { label: "Spend", value: formatMoney(spend) },
          { label: "New customers", value: formatNumber(customers) }
        ];
      }
    },
    {
      id: "return-on-ad-spend",
      category: "E-commerce",
      name: "Return on Ad Spend (ROAS) Calculator",
      description: "Calculate ROAS from ad revenue and ad spend.",
      addedAt: "2025-12-29",
      popular: true,
      fields: [
        { key: "adRevenue", label: "Revenue from ads", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 18000 },
        { key: "adSpend", label: "Ad spend", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 6000 }
      ],
      compute(values){
        const rev = toNumber(values.adRevenue);
        const spend = toNumber(values.adSpend);
        if(!Number.isFinite(rev) || rev < 0 || !Number.isFinite(spend) || spend < 0) return [];
        const roas = spend === 0 ? (rev === 0 ? 0 : Infinity) : (rev / spend);
        return [
          { label: "ROAS", value: Number.isFinite(roas) ? (formatNumber(roas) + "x") : "∞", emphasis: true },
          { label: "Revenue", value: formatMoney(rev) },
          { label: "Spend", value: formatMoney(spend) }
        ];
      }
    },
    {
      id: "acos",
      category: "E-commerce",
      name: "Advertising Cost of Sales (ACoS) Calculator",
      description: "Calculate ACoS from ad spend and ad revenue.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "adSpend", label: "Ad spend", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 6000 },
        { key: "adRevenue", label: "Revenue from ads", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 18000 }
      ],
      compute(values){
        const spend = toNumber(values.adSpend);
        const rev = toNumber(values.adRevenue);
        if(!Number.isFinite(spend) || spend < 0 || !Number.isFinite(rev) || rev < 0) return [];
        const acos = rev === 0 ? (spend === 0 ? 0 : Infinity) : (spend / rev);
        return [
          { label: "ACoS", value: Number.isFinite(acos) ? formatPercentFromRate(acos) : "∞", emphasis: true },
          { label: "Spend", value: formatMoney(spend) },
          { label: "Revenue", value: formatMoney(rev) }
        ];
      }
    },
    {
      id: "profit-per-order",
      category: "E-commerce",
      name: "Profit Per Order Calculator",
      description: "Estimate profit per order after costs and fees.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "salePrice", label: "Sale price", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 49.99 },
        { key: "cogs", label: "Product cost (COGS)", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 18 },
        { key: "shipping", label: "Shipping cost", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 6 },
        { key: "fees", label: "Marketplace/payment fees", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 4.25 },
        { key: "adCost", label: "Ad cost per order", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 7.5 }
      ],
      compute(values){
        const sale = toNumber(values.salePrice);
        const cogs = toNumber(values.cogs);
        const ship = toNumber(values.shipping);
        const fees = toNumber(values.fees);
        const ad = toNumber(values.adCost);
        if(!Number.isFinite(sale) || sale < 0) return [];
        if(!Number.isFinite(cogs) || cogs < 0) return [];
        if(!Number.isFinite(ship) || ship < 0) return [];
        if(!Number.isFinite(fees) || fees < 0) return [];
        if(!Number.isFinite(ad) || ad < 0) return [];
        const totalCosts = cogs + ship + fees + ad;
        const profit = sale - totalCosts;
        const margin = sale === 0 ? 0 : (profit / sale);
        return [
          { label: "Profit per order", value: formatMoney(profit), emphasis: true },
          { label: "Profit margin", value: formatPercentFromRate(margin) },
          { label: "Total costs", value: formatMoney(totalCosts) }
        ];
      }
    },
    {
      id: "break-even-roas",
      category: "E-commerce",
      name: "Break-Even ROAS Calculator",
      description: "Estimate the ROAS needed to break even.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "grossMargin", label: "Gross margin", type: "number", unit: "%", min: 0, max: 100, step: 0.1, defaultValue: 35 }
      ],
      compute(values){
        const marginPct = toNumber(values.grossMargin);
        if(!Number.isFinite(marginPct) || marginPct <= 0) return [];
        const m = marginPct / 100;
        const roas = 1 / m;
        return [
          { label: "Break-even ROAS", value: formatNumber(roas) + "x", emphasis: true },
          { label: "Gross margin", value: formatPercentFromRate(m) }
        ];
      }
    },
    {
      id: "landed-cost",
      category: "E-commerce",
      name: "Landed Cost Calculator",
      description: "Calculate total landed cost per unit.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "productCost", label: "Product cost", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 8 },
        { key: "shipping", label: "Shipping", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 1.25 },
        { key: "duty", label: "Duty", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 0.4 },
        { key: "other", label: "Other costs", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 0.35 }
      ],
      compute(values){
        const product = toNumber(values.productCost);
        const ship = toNumber(values.shipping);
        const duty = toNumber(values.duty);
        const other = toNumber(values.other);
        if(!Number.isFinite(product) || product < 0) return [];
        if(!Number.isFinite(ship) || ship < 0) return [];
        if(!Number.isFinite(duty) || duty < 0) return [];
        if(!Number.isFinite(other) || other < 0) return [];
        const total = product + ship + duty + other;
        return [
          { label: "Landed cost", value: formatMoney(total), emphasis: true },
          { label: "Product", value: formatMoney(product) },
          { label: "Shipping", value: formatMoney(ship) }
        ];
      }
    },
    {
      id: "price-for-margin",
      category: "E-commerce",
      name: "Price for Target Margin Calculator",
      description: "Calculate price needed to hit a target margin.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "cost", label: "Unit cost", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 18 },
        { key: "targetMargin", label: "Target margin", type: "number", unit: "%", min: 0, max: 99.9, step: 0.1, defaultValue: 35 }
      ],
      compute(values){
        const cost = toNumber(values.cost);
        const marginPct = toNumber(values.targetMargin);
        if(!Number.isFinite(cost) || cost < 0) return [];
        if(!Number.isFinite(marginPct) || marginPct < 0 || marginPct >= 100) return [];
        const m = marginPct / 100;
        const price = (1 - m) === 0 ? Infinity : (cost / (1 - m));
        const profit = Number.isFinite(price) ? (price - cost) : Infinity;
        return [
          { label: "Required price", value: Number.isFinite(price) ? formatMoney(price) : "∞", emphasis: true },
          { label: "Profit per unit", value: Number.isFinite(profit) ? formatMoney(profit) : "∞" }
        ];
      }
    },
    {
      id: "marketplace-fee",
      category: "E-commerce",
      name: "Marketplace Fee Calculator",
      description: "Estimate marketplace fees and net payout.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "salePrice", label: "Sale price", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 49.99 },
        { key: "feeRate", label: "Fee rate", type: "number", unit: "%", min: 0, step: 0.1, defaultValue: 15 }
      ],
      compute(values){
        const sale = toNumber(values.salePrice);
        const rate = toNumber(values.feeRate);
        if(!Number.isFinite(sale) || sale < 0 || !Number.isFinite(rate) || rate < 0) return [];
        const fee = sale * (rate / 100);
        const net = sale - fee;
        return [
          { label: "Fee", value: formatMoney(fee), emphasis: true },
          { label: "Net payout", value: formatMoney(net) }
        ];
      }
    },
    {
      id: "payment-processing-fee",
      category: "E-commerce",
      name: "Payment Processing Fee Calculator",
      description: "Estimate payment processing fees for an order.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "amount", label: "Order amount", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 49.99 },
        { key: "percentFee", label: "Percent fee", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 2.9 },
        { key: "fixedFee", label: "Fixed fee", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 0.3 }
      ],
      compute(values){
        const amount = toNumber(values.amount);
        const pct = toNumber(values.percentFee);
        const fixed = toNumber(values.fixedFee);
        if(!Number.isFinite(amount) || amount < 0 || !Number.isFinite(pct) || pct < 0 || !Number.isFinite(fixed) || fixed < 0) return [];
        const fee = amount * (pct / 100) + fixed;
        const net = amount - fee;
        return [
          { label: "Processing fee", value: formatMoney(fee), emphasis: true },
          { label: "Net received", value: formatMoney(net) }
        ];
      }
    },
    {
      id: "inventory-turnover",
      category: "E-commerce",
      name: "Inventory Turnover Calculator",
      description: "Calculate inventory turnover from COGS and average inventory.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "cogs", label: "COGS (period)", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 120000 },
        { key: "avgInventory", label: "Average inventory", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 30000 }
      ],
      compute(values){
        const cogs = toNumber(values.cogs);
        const inv = toNumber(values.avgInventory);
        if(!Number.isFinite(cogs) || cogs < 0 || !Number.isFinite(inv) || inv < 0) return [];
        const turnover = inv === 0 ? (cogs === 0 ? 0 : Infinity) : (cogs / inv);
        return [
          { label: "Inventory turnover", value: Number.isFinite(turnover) ? formatNumber(turnover) : "∞", emphasis: true },
          { label: "COGS", value: formatMoney(cogs) },
          { label: "Avg inventory", value: formatMoney(inv) }
        ];
      }
    },
    {
      id: "reorder-point",
      category: "E-commerce",
      name: "Reorder Point Calculator",
      description: "Estimate reorder point using daily sales and lead time.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "dailySales", label: "Average daily sales (units)", type: "number", min: 0, step: 0.1, defaultValue: 12 },
        { key: "leadTime", label: "Lead time (days)", type: "number", min: 0, step: 1, defaultValue: 14 },
        { key: "safetyStock", label: "Safety stock (units)", type: "number", min: 0, step: 1, defaultValue: 50 }
      ],
      compute(values){
        const daily = toNumber(values.dailySales);
        const lead = toNumber(values.leadTime);
        const safety = toNumber(values.safetyStock);
        if(!Number.isFinite(daily) || daily < 0 || !Number.isFinite(lead) || lead < 0 || !Number.isFinite(safety) || safety < 0) return [];
        const point = daily * lead + safety;
        return [
          { label: "Reorder point", value: formatNumber(point), emphasis: true },
          { label: "Lead-time demand", value: formatNumber(daily * lead) }
        ];
      }
    },
    {
      id: "days-of-inventory",
      category: "E-commerce",
      name: "Days of Inventory Calculator",
      description: "Estimate days of inventory remaining.",
      addedAt: "2025-12-29",
      popular: false,
      fields: [
        { key: "inventory", label: "Inventory on hand (units)", type: "number", min: 0, step: 1, defaultValue: 600 },
        { key: "dailySales", label: "Average daily sales (units)", type: "number", min: 0, step: 0.1, defaultValue: 12 }
      ],
      compute(values){
        const inv = toNumber(values.inventory);
        const daily = toNumber(values.dailySales);
        if(!Number.isFinite(inv) || inv < 0 || !Number.isFinite(daily) || daily < 0) return [];
        const days = daily === 0 ? (inv === 0 ? 0 : Infinity) : (inv / daily);
        return [
          { label: "Days of inventory", value: Number.isFinite(days) ? formatNumber(days) : "∞", emphasis: true },
          { label: "Inventory", value: formatNumber(inv) },
          { label: "Daily sales", value: formatNumber(daily) }
        ];
      }
    },
    {
      id: "percentage",
      category: "Math",
      name: "Percentage Calculator",
      description: "Find X% of a value and the resulting total.",
      addedAt: "2025-12-14",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.01, defaultValue: 250 },
        { key: "percent", label: "Percent", type: "number", unit: "%", step: 0.01, defaultValue: 15 }
      ],
      compute(values){
        const value = toNumber(values.value);
        const percent = toNumber(values.percent);
        if(!Number.isFinite(value) || !Number.isFinite(percent)) return [];
        const part = value * (percent / 100);
        return [
          { label: "Result", value: formatNumber(part), emphasis: true },
          { label: "Value + result", value: formatNumber(value + part) }
        ];
      }
    },
    {
      id: "square-root",
      category: "Math",
      name: "Square Root Calculator",
      description: "Calculate √x for a number.",
      addedAt: "2025-11-28",
      popular: false,
      fields: [
        { key: "value", label: "Number", type: "number", step: 0.000001, defaultValue: 144 }
      ],
      compute(values){
        const v = toNumber(values.value);
        if(!Number.isFinite(v)) return [];
        const root = v < 0 ? NaN : Math.sqrt(v);
        return [
          { label: "Square root", value: formatNumber(root), emphasis: true }
        ];
      }
    },
    {
      id: "rounding",
      category: "Math",
      name: "Rounding Numbers Calculator",
      description: "Round a number to a chosen number of decimals.",
      addedAt: "2025-11-27",
      popular: false,
      fields: [
        { key: "value", label: "Number", type: "number", step: 0.000001, defaultValue: 12.34567 },
        { key: "decimals", label: "Decimals", type: "number", min: 0, step: 1, defaultValue: 2 }
      ],
      compute(values){
        const v = toNumber(values.value);
        const d = clamp(toNumber(values.decimals), 0, 12);
        if(!Number.isFinite(v) || !Number.isFinite(d)) return [];
        const factor = Math.pow(10, d);
        const rounded = Math.round(v * factor) / factor;
        return [
          { label: "Rounded", value: formatNumber(rounded), emphasis: true }
        ];
      }
    },
    {
      id: "fraction-simplifier",
      category: "Math",
      name: "Fraction Simplifier",
      description: "Reduce a fraction to its simplest form.",
      addedAt: "2025-11-26",
      popular: false,
      fields: [
        { key: "fraction", label: "Fraction", type: "text", defaultValue: "42/56" }
      ],
      compute(values){
        const fr = parseFractionString(values.fraction);
        if(!fr) return [];
        return [
          { label: "Simplified", value: `${fr.n}/${fr.d}`, emphasis: true },
          { label: "Mixed number", value: fractionToMixedString(fr) }
        ];
      }
    },
    {
      id: "lcm",
      category: "Math",
      name: "Least Common Multiple (LCM) Calculator",
      description: "Find the LCM of two integers.",
      addedAt: "2025-11-25",
      popular: false,
      fields: [
        { key: "a", label: "First integer", type: "number", step: 1, defaultValue: 12 },
        { key: "b", label: "Second integer", type: "number", step: 1, defaultValue: 18 }
      ],
      compute(values){
        const a = toNumber(values.a);
        const b = toNumber(values.b);
        if(!Number.isFinite(a) || !Number.isFinite(b)) return [];
        const l = lcmInt(a, b);
        return [
          { label: "LCM", value: formatInt(l), emphasis: true }
        ];
      }
    },
    {
      id: "temperature",
      category: "Conversions",
      name: "Temperature Conversion",
      description: "Convert between Celsius, Fahrenheit, and Kelvin.",
      addedAt: "2025-12-12",
      popular: true,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.01, defaultValue: 25 },
        { key: "from", label: "From", type: "select", defaultValue: "C", options: [
          { value: "C", label: "Celsius (°C)" },
          { value: "F", label: "Fahrenheit (°F)" },
          { value: "K", label: "Kelvin (K)" }
        ] }
      ],
      compute(values){
        const val = toNumber(values.value);
        const from = String(values.from || "C");
        if(!Number.isFinite(val)) return [];
        let c;
        if(from === "F") c = (val - 32) * (5/9);
        else if(from === "K") c = val - 273.15;
        else c = val;
        const f = c * (9/5) + 32;
        const k = c + 273.15;
        return [
          { label: "Celsius (°C)", value: formatNumber(c), emphasis: true },
          { label: "Fahrenheit (°F)", value: formatNumber(f) },
          { label: "Kelvin (K)", value: formatNumber(k) }
        ];
      }
    },
    {
      id: "length",
      category: "Conversions",
      name: "Length Conversion",
      description: "Convert between meters, kilometers, miles, feet, and inches.",
      addedAt: "2025-12-11",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.0001, defaultValue: 1 },
        { key: "from", label: "From", type: "select", defaultValue: "m", options: [
          { value: "m", label: "Meters (m)" },
          { value: "km", label: "Kilometers (km)" },
          { value: "mi", label: "Miles (mi)" },
          { value: "ft", label: "Feet (ft)" },
          { value: "in", label: "Inches (in)" }
        ] }
      ],
      compute(values){
        const val = toNumber(values.value);
        const from = String(values.from || "m");
        if(!Number.isFinite(val)) return [];
        const toMeters = {
          m: 1,
          km: 1000,
          mi: 1609.344,
          ft: 0.3048,
          in: 0.0254
        }[from];
        const meters = val * toMeters;
        return [
          { label: "Meters (m)", value: formatNumber(meters), emphasis: true },
          { label: "Kilometers (km)", value: formatNumber(meters / 1000) },
          { label: "Miles (mi)", value: formatNumber(meters / 1609.344) },
          { label: "Feet (ft)", value: formatNumber(meters / 0.3048) },
          { label: "Inches (in)", value: formatNumber(meters / 0.0254) }
        ];
      }
    },
    {
      id: "area-conversion",
      category: "Conversions",
      name: "Area Conversion",
      description: "Convert between common area units.",
      addedAt: "2025-11-24",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.000001, defaultValue: 1 },
        { key: "from", label: "From", type: "select", defaultValue: "m2", options: [
          { value: "m2", label: "Square meters (m²)" },
          { value: "km2", label: "Square kilometers (km²)" },
          { value: "ft2", label: "Square feet (ft²)" },
          { value: "in2", label: "Square inches (in²)" },
          { value: "yd2", label: "Square yards (yd²)" },
          { value: "acre", label: "Acres" },
          { value: "ha", label: "Hectares (ha)" }
        ] }
      ],
      compute(values){
        const table = {
          m2: 1,
          km2: 1_000_000,
          ft2: 0.09290304,
          in2: 0.00064516,
          yd2: 0.83612736,
          acre: 4046.8564224,
          ha: 10000
        };
        const out = convertUnits(values.value, String(values.from || "m2"), table);
        if(!out) return [];
        return [
          { label: "Square meters (m²)", value: formatNumber(out.m2), emphasis: true },
          { label: "Square kilometers (km²)", value: formatNumber(out.km2) },
          { label: "Square feet (ft²)", value: formatNumber(out.ft2) },
          { label: "Square inches (in²)", value: formatNumber(out.in2) },
          { label: "Square yards (yd²)", value: formatNumber(out.yd2) },
          { label: "Acres", value: formatNumber(out.acre) },
          { label: "Hectares (ha)", value: formatNumber(out.ha) }
        ];
      }
    },
    {
      id: "pressure-conversion",
      category: "Conversions",
      name: "Pressure Conversion",
      description: "Convert between Pa, kPa, bar, psi, atm, and mmHg.",
      addedAt: "2025-11-23",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.000001, defaultValue: 101325 },
        { key: "from", label: "From", type: "select", defaultValue: "Pa", options: [
          { value: "Pa", label: "Pascal (Pa)" },
          { value: "kPa", label: "Kilopascal (kPa)" },
          { value: "bar", label: "Bar (bar)" },
          { value: "psi", label: "PSI (psi)" },
          { value: "atm", label: "Atmosphere (atm)" },
          { value: "mmHg", label: "Millimeter of mercury (mmHg)" }
        ] }
      ],
      compute(values){
        const table = {
          Pa: 1,
          kPa: 1000,
          bar: 100000,
          psi: 6894.757293168,
          atm: 101325,
          mmHg: 133.322387415
        };
        const out = convertUnits(values.value, String(values.from || "Pa"), table);
        if(!out) return [];
        return [
          { label: "Pascal (Pa)", value: formatNumber(out.Pa), emphasis: true },
          { label: "Kilopascal (kPa)", value: formatNumber(out.kPa) },
          { label: "Bar (bar)", value: formatNumber(out.bar) },
          { label: "PSI (psi)", value: formatNumber(out.psi) },
          { label: "Atmosphere (atm)", value: formatNumber(out.atm) },
          { label: "Millimeter of mercury (mmHg)", value: formatNumber(out.mmHg) }
        ];
      }
    },
    {
      id: "time-conversion",
      category: "Conversions",
      name: "Time Conversion",
      description: "Convert between seconds, minutes, hours, days, weeks, and years.",
      addedAt: "2025-11-22",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.000001, defaultValue: 3600 },
        { key: "from", label: "From", type: "select", defaultValue: "s", options: [
          { value: "s", label: "Seconds" },
          { value: "min", label: "Minutes" },
          { value: "hr", label: "Hours" },
          { value: "day", label: "Days" },
          { value: "week", label: "Weeks" },
          { value: "year", label: "Years (365 days)" }
        ] }
      ],
      compute(values){
        const table = {
          s: 1,
          min: 60,
          hr: 3600,
          day: 86400,
          week: 604800,
          year: 31536000
        };
        const out = convertUnits(values.value, String(values.from || "s"), table);
        if(!out) return [];
        return [
          { label: "Seconds", value: formatNumber(out.s), emphasis: true },
          { label: "Minutes", value: formatNumber(out.min) },
          { label: "Hours", value: formatNumber(out.hr) },
          { label: "Days", value: formatNumber(out.day) },
          { label: "Weeks", value: formatNumber(out.week) },
          { label: "Years (365 days)", value: formatNumber(out.year) }
        ];
      }
    },
    {
      id: "volume-conversion",
      category: "Conversions",
      name: "Volume Conversion",
      description: "Convert between liters, milliliters, cubic meters, and US units.",
      addedAt: "2025-11-21",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.000001, defaultValue: 1 },
        { key: "from", label: "From", type: "select", defaultValue: "L", options: [
          { value: "mL", label: "Milliliters (mL)" },
          { value: "L", label: "Liters (L)" },
          { value: "m3", label: "Cubic meters (m³)" },
          { value: "gal", label: "US gallons (gal)" },
          { value: "qt", label: "US quarts (qt)" },
          { value: "cup", label: "US cups (cup)" },
          { value: "floz", label: "US fluid ounces (fl oz)" }
        ] }
      ],
      compute(values){
        const table = {
          mL: 0.001,
          L: 1,
          m3: 1000,
          gal: 3.785411784,
          qt: 0.946352946,
          cup: 0.2365882365,
          floz: 0.0295735295625
        };
        const out = convertUnits(values.value, String(values.from || "L"), table);
        if(!out) return [];
        return [
          { label: "Liters (L)", value: formatNumber(out.L), emphasis: true },
          { label: "Milliliters (mL)", value: formatNumber(out.mL) },
          { label: "Cubic meters (m³)", value: formatNumber(out.m3) },
          { label: "US gallons (gal)", value: formatNumber(out.gal) },
          { label: "US quarts (qt)", value: formatNumber(out.qt) },
          { label: "US cups (cup)", value: formatNumber(out.cup) },
          { label: "US fluid ounces (fl oz)", value: formatNumber(out.floz) }
        ];
      }
    },
    {
      id: "weight-conversion",
      category: "Conversions",
      name: "Weight Conversion",
      description: "Convert between kg, g, lb, oz, and tonnes.",
      addedAt: "2025-11-20",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.000001, defaultValue: 70 },
        { key: "from", label: "From", type: "select", defaultValue: "kg", options: [
          { value: "g", label: "Grams (g)" },
          { value: "kg", label: "Kilograms (kg)" },
          { value: "t", label: "Tonnes (t)" },
          { value: "lb", label: "Pounds (lb)" },
          { value: "oz", label: "Ounces (oz)" }
        ] }
      ],
      compute(values){
        const table = {
          g: 0.001,
          kg: 1,
          t: 1000,
          lb: 0.45359237,
          oz: 0.028349523125
        };
        const out = convertUnits(values.value, String(values.from || "kg"), table);
        if(!out) return [];
        return [
          { label: "Kilograms (kg)", value: formatNumber(out.kg), emphasis: true },
          { label: "Grams (g)", value: formatNumber(out.g) },
          { label: "Tonnes (t)", value: formatNumber(out.t) },
          { label: "Pounds (lb)", value: formatNumber(out.lb) },
          { label: "Ounces (oz)", value: formatNumber(out.oz) }
        ];
      }
    },
    {
      id: "decimal-to-fraction",
      category: "Conversions",
      name: "Decimal to Fraction Calculator",
      description: "Convert a decimal to a simplified fraction.",
      addedAt: "2025-11-19",
      popular: false,
      fields: [
        { key: "decimal", label: "Decimal", type: "number", step: 0.0000001, defaultValue: 0.875 },
        { key: "maxDen", label: "Max denominator", type: "number", min: 1, step: 1, defaultValue: 10000 }
      ],
      compute(values){
        const dec = toNumber(values.decimal);
        const maxDen = toNumber(values.maxDen);
        const fr = bestRational(dec, maxDen);
        if(!fr) return [];
        return [
          { label: "Fraction", value: `${fr.n}/${fr.d}`, emphasis: true },
          { label: "Mixed number", value: fractionToMixedString(fr) }
        ];
      }
    },
    {
      id: "decimal-to-percent",
      category: "Conversions",
      name: "Decimal to Percent Calculator",
      description: "Convert a decimal to a percent.",
      addedAt: "2025-11-18",
      popular: false,
      fields: [
        { key: "decimal", label: "Decimal", type: "number", step: 0.0000001, defaultValue: 0.125 }
      ],
      compute(values){
        const dec = toNumber(values.decimal);
        if(!Number.isFinite(dec)) return [];
        return [
          { label: "Percent", value: formatPercentFromRate(dec), emphasis: true }
        ];
      }
    },
    {
      id: "fraction-to-decimal",
      category: "Conversions",
      name: "Fraction To Decimal Calculator",
      description: "Convert a fraction to a decimal.",
      addedAt: "2025-11-17",
      popular: false,
      fields: [
        { key: "fraction", label: "Fraction", type: "text", defaultValue: "3/8" }
      ],
      compute(values){
        const fr = parseFractionString(values.fraction);
        if(!fr) return [];
        return [
          { label: "Decimal", value: formatNumber(fr.n / fr.d), emphasis: true }
        ];
      }
    },
    {
      id: "fraction-to-percent",
      category: "Conversions",
      name: "Fraction to Percent Calculator",
      description: "Convert a fraction to a percent.",
      addedAt: "2025-11-16",
      popular: false,
      fields: [
        { key: "fraction", label: "Fraction", type: "text", defaultValue: "3/8" }
      ],
      compute(values){
        const fr = parseFractionString(values.fraction);
        if(!fr) return [];
        return [
          { label: "Percent", value: formatPercentFromRate(fr.n / fr.d), emphasis: true }
        ];
      }
    },
    {
      id: "percent-to-decimal",
      category: "Conversions",
      name: "Percent to Decimal Calculator",
      description: "Convert a percent to a decimal.",
      addedAt: "2025-11-15",
      popular: false,
      fields: [
        { key: "percent", label: "Percent", type: "number", step: 0.01, defaultValue: 12.5 }
      ],
      compute(values){
        const p = toNumber(values.percent);
        if(!Number.isFinite(p)) return [];
        return [
          { label: "Decimal", value: formatNumber(p / 100), emphasis: true }
        ];
      }
    },
    {
      id: "percent-to-fraction",
      category: "Conversions",
      name: "Percent to Fraction Calculator",
      description: "Convert a percent to a simplified fraction.",
      addedAt: "2025-11-14",
      popular: false,
      fields: [
        { key: "percent", label: "Percent", type: "number", step: 0.01, defaultValue: 12.5 }
      ],
      compute(values){
        const p = toNumber(values.percent);
        if(!Number.isFinite(p)) return [];
        const fr = bestRational(p / 100, 10000);
        if(!fr) return [];
        return [
          { label: "Fraction", value: `${fr.n}/${fr.d}`, emphasis: true },
          { label: "Mixed number", value: fractionToMixedString(fr) }
        ];
      }
    },
    {
      id: "roman-numeral",
      category: "Conversions",
      name: "Roman Numeral Converter",
      description: "Convert between numbers and Roman numerals (I–MMMCMXCIX).",
      addedAt: "2025-11-11",
      popular: false,
      fields: [
        { key: "mode", label: "Convert", type: "select", defaultValue: "toRoman", options: [
          { value: "toRoman", label: "Number → Roman numeral" },
          { value: "toNumber", label: "Roman numeral → Number" }
        ] },
        { key: "number", label: "Number (1–3999)", type: "number", min: 1, step: 1, defaultValue: 2025 },
        { key: "roman", label: "Roman numeral", type: "text", defaultValue: "MMXXV" }
      ],
      fieldVisibility(values){
        const mode = String(values.mode || "toRoman");
        return { number: mode === "toRoman", roman: mode === "toNumber" };
      },
      compute(values){
        const mode = String(values.mode || "toRoman");
        if(mode === "toNumber"){
          const n = romanToInt(values.roman);
          return [
            { label: "Number", value: n == null ? "—" : formatInt(n), emphasis: true }
          ];
        }
        const n = toNumber(values.number);
        const roman = intToRoman(n);
        return [
          { label: "Roman numeral", value: roman || "—", emphasis: true }
        ];
      }
    },
    {
      id: "tip",
      category: "Miscellaneous",
      name: "Tip Calculator",
      description: "Split a bill with tip across multiple people.",
      addedAt: "2025-12-10",
      popular: false,
      fields: [
        { key: "bill", label: "Bill amount", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 74.50 },
        { key: "tipPercent", label: "Tip percent", type: "number", unit: "%", min: 0, step: 0.1, defaultValue: 18 },
        { key: "people", label: "People", type: "number", min: 1, step: 1, defaultValue: 2 }
      ],
      compute(values){
        const bill = toNumber(values.bill);
        const tipPercent = toNumber(values.tipPercent);
        const people = toNumber(values.people);
        if(!Number.isFinite(bill) || !Number.isFinite(tipPercent) || !(people >= 1)) return [];
        const tip = bill * (tipPercent / 100);
        const total = bill + tip;
        const perPerson = total / people;
        return [
          { label: "Total", value: formatMoney(total), emphasis: true },
          { label: "Tip", value: formatMoney(tip) },
          { label: "Per person", value: formatMoney(perPerson) }
        ];
      }
    },
    {
      id: "age",
      category: "Miscellaneous",
      name: "Age Calculator",
      description: "Calculate age from a birth date.",
      addedAt: "2025-12-25",
      popular: false,
      fields: [
        { key: "birth", label: "Birth date", type: "date", defaultValue: "1995-01-01" },
        { key: "asOf", label: "As of date", type: "date", defaultValue: "" }
      ],
      compute(values){
        const birth = parseDateUTC(values.birth);
        const asOf = parseDateUTC(values.asOf);
        const end = asOf || new Date();
        const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
        const diff = diffYMDUTC(birth, endUtc);
        if(!diff) return [];
        return [
          { label: "Age", value: `${diff.years} years, ${diff.months} months, ${diff.days} days`, emphasis: true },
          { label: "Total days", value: formatInt(diff.totalDays) }
        ];
      }
    },
    {
      id: "day-of-week",
      category: "Miscellaneous",
      name: "Day of the Week Calculator",
      description: "Find the weekday for a given date.",
      addedAt: "2025-12-25",
      popular: false,
      fields: [
        { key: "date", label: "Date", type: "date", defaultValue: "" }
      ],
      compute(values){
        const d = parseDateUTC(values.date);
        if(!d) return [];
        const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d);
        const longDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(d);
        return [
          { label: "Day", value: weekday, emphasis: true },
          { label: "Date", value: longDate }
        ];
      }
    },
    {
      id: "gpa",
      category: "Miscellaneous",
      name: "Grade Point Average (GPA) Calculator",
      description: "Estimate GPA from course grades and credits.",
      addedAt: "2025-12-25",
      popular: false,
      fields: [
        { key: "g1", label: "Course 1 grade", type: "select", defaultValue: "4", options: [
          { value: "4", label: "A (4.0)" },{ value: "3.7", label: "A- (3.7)" },{ value: "3.3", label: "B+ (3.3)" },
          { value: "3", label: "B (3.0)" },{ value: "2.7", label: "B- (2.7)" },{ value: "2.3", label: "C+ (2.3)" },
          { value: "2", label: "C (2.0)" },{ value: "1.7", label: "C- (1.7)" },{ value: "1.3", label: "D+ (1.3)" },
          { value: "1", label: "D (1.0)" },{ value: "0", label: "F (0.0)" }
        ] },
        { key: "c1", label: "Course 1 credits", type: "number", min: 0, step: 0.5, defaultValue: 3 },
        { key: "g2", label: "Course 2 grade", type: "select", defaultValue: "4", options: [
          { value: "4", label: "A (4.0)" },{ value: "3.7", label: "A- (3.7)" },{ value: "3.3", label: "B+ (3.3)" },
          { value: "3", label: "B (3.0)" },{ value: "2.7", label: "B- (2.7)" },{ value: "2.3", label: "C+ (2.3)" },
          { value: "2", label: "C (2.0)" },{ value: "1.7", label: "C- (1.7)" },{ value: "1.3", label: "D+ (1.3)" },
          { value: "1", label: "D (1.0)" },{ value: "0", label: "F (0.0)" }
        ] },
        { key: "c2", label: "Course 2 credits", type: "number", min: 0, step: 0.5, defaultValue: 3 },
        { key: "g3", label: "Course 3 grade", type: "select", defaultValue: "4", options: [
          { value: "4", label: "A (4.0)" },{ value: "3.7", label: "A- (3.7)" },{ value: "3.3", label: "B+ (3.3)" },
          { value: "3", label: "B (3.0)" },{ value: "2.7", label: "B- (2.7)" },{ value: "2.3", label: "C+ (2.3)" },
          { value: "2", label: "C (2.0)" },{ value: "1.7", label: "C- (1.7)" },{ value: "1.3", label: "D+ (1.3)" },
          { value: "1", label: "D (1.0)" },{ value: "0", label: "F (0.0)" }
        ] },
        { key: "c3", label: "Course 3 credits", type: "number", min: 0, step: 0.5, defaultValue: 3 },
        { key: "g4", label: "Course 4 grade", type: "select", defaultValue: "4", options: [
          { value: "4", label: "A (4.0)" },{ value: "3.7", label: "A- (3.7)" },{ value: "3.3", label: "B+ (3.3)" },
          { value: "3", label: "B (3.0)" },{ value: "2.7", label: "B- (2.7)" },{ value: "2.3", label: "C+ (2.3)" },
          { value: "2", label: "C (2.0)" },{ value: "1.7", label: "C- (1.7)" },{ value: "1.3", label: "D+ (1.3)" },
          { value: "1", label: "D (1.0)" },{ value: "0", label: "F (0.0)" }
        ] },
        { key: "c4", label: "Course 4 credits", type: "number", min: 0, step: 0.5, defaultValue: 0 },
        { key: "g5", label: "Course 5 grade", type: "select", defaultValue: "4", options: [
          { value: "4", label: "A (4.0)" },{ value: "3.7", label: "A- (3.7)" },{ value: "3.3", label: "B+ (3.3)" },
          { value: "3", label: "B (3.0)" },{ value: "2.7", label: "B- (2.7)" },{ value: "2.3", label: "C+ (2.3)" },
          { value: "2", label: "C (2.0)" },{ value: "1.7", label: "C- (1.7)" },{ value: "1.3", label: "D+ (1.3)" },
          { value: "1", label: "D (1.0)" },{ value: "0", label: "F (0.0)" }
        ] },
        { key: "c5", label: "Course 5 credits", type: "number", min: 0, step: 0.5, defaultValue: 0 },
        { key: "g6", label: "Course 6 grade", type: "select", defaultValue: "4", options: [
          { value: "4", label: "A (4.0)" },{ value: "3.7", label: "A- (3.7)" },{ value: "3.3", label: "B+ (3.3)" },
          { value: "3", label: "B (3.0)" },{ value: "2.7", label: "B- (2.7)" },{ value: "2.3", label: "C+ (2.3)" },
          { value: "2", label: "C (2.0)" },{ value: "1.7", label: "C- (1.7)" },{ value: "1.3", label: "D+ (1.3)" },
          { value: "1", label: "D (1.0)" },{ value: "0", label: "F (0.0)" }
        ] },
        { key: "c6", label: "Course 6 credits", type: "number", min: 0, step: 0.5, defaultValue: 0 }
      ],
      compute(values){
        const pairs = [
          { g: toNumber(values.g1), c: toNumber(values.c1) },
          { g: toNumber(values.g2), c: toNumber(values.c2) },
          { g: toNumber(values.g3), c: toNumber(values.c3) },
          { g: toNumber(values.g4), c: toNumber(values.c4) },
          { g: toNumber(values.g5), c: toNumber(values.c5) },
          { g: toNumber(values.g6), c: toNumber(values.c6) }
        ];
        let credits = 0;
        let points = 0;
        pairs.forEach(p => {
          if(!(Number.isFinite(p.g) && Number.isFinite(p.c) && p.c > 0)) return;
          credits += p.c;
          points += p.g * p.c;
        });
        if(!(credits > 0)) return [];
        const gpa = points / credits;
        return [
          { label: "GPA", value: formatNumber(gpa), emphasis: true },
          { label: "Total credits", value: formatNumber(credits) }
        ];
      }
    },
    {
      id: "password-generator",
      category: "Miscellaneous",
      name: "Password Generator",
      description: "Generate a strong password based on your preferences.",
      addedAt: "2025-12-25",
      popular: false,
      fields: [
        { key: "length", label: "Password length", type: "number", min: 4, max: 64, step: 1, defaultValue: 16 },
        { key: "lower", label: "Include lowercase", type: "select", defaultValue: "yes", options: [ { value: "yes", label: "Yes" }, { value: "no", label: "No" } ] },
        { key: "upper", label: "Include uppercase", type: "select", defaultValue: "yes", options: [ { value: "yes", label: "Yes" }, { value: "no", label: "No" } ] },
        { key: "numbers", label: "Include numbers", type: "select", defaultValue: "yes", options: [ { value: "yes", label: "Yes" }, { value: "no", label: "No" } ] },
        { key: "symbols", label: "Include symbols", type: "select", defaultValue: "no", options: [ { value: "yes", label: "Yes" }, { value: "no", label: "No" } ] },
        { key: "excludeAmbiguous", label: "Exclude ambiguous (Il1O0)", type: "select", defaultValue: "yes", options: [ { value: "yes", label: "Yes" }, { value: "no", label: "No" } ] }
      ],
      compute(values){
        const length = toNumber(values.length);
        const pw = makePassword({
          length,
          lower: String(values.lower) === "yes",
          upper: String(values.upper) === "yes",
          numbers: String(values.numbers) === "yes",
          symbols: String(values.symbols) === "yes",
          excludeAmbiguous: String(values.excludeAmbiguous) === "yes"
        });
        return [
          { label: "Password", value: pw, emphasis: true },
          { label: "Length", value: formatInt(pw.length) }
        ];
      }
    },
    {
      id: "random-number",
      category: "Miscellaneous",
      name: "Random Number Generator",
      description: "Generate a random integer or decimal between two numbers.",
      addedAt: "2025-12-25",
      popular: false,
      fields: [
        { key: "min", label: "Minimum", type: "number", step: 1, defaultValue: 1 },
        { key: "max", label: "Maximum", type: "number", step: 1, defaultValue: 100 },
        { key: "mode", label: "Mode", type: "select", defaultValue: "integer", options: [
          { value: "integer", label: "Integer" },
          { value: "decimal", label: "Decimal" }
        ] },
        { key: "decimals", label: "Decimal places", type: "number", min: 0, max: 10, step: 1, defaultValue: 2 }
      ],
      fieldVisibility(values){
        return { decimals: String(values.mode || "integer") === "decimal" };
      },
      compute(values){
        const min = toNumber(values.min);
        const max = toNumber(values.max);
        const mode = String(values.mode || "integer");
        if(!(Number.isFinite(min) && Number.isFinite(max))) return [];
        if(mode === "decimal"){
          const decimals = Math.max(0, Math.min(10, Math.trunc(toNumber(values.decimals))));
          const lo = Math.min(min, max);
          const hi = Math.max(min, max);
          const r = lo + randomFloat01() * (hi - lo);
          const factor = Math.pow(10, decimals);
          const out = Math.round(r * factor) / factor;
          return [
            { label: "Random number", value: formatNumber(out), emphasis: true }
          ];
        }
        const lo = Math.min(min, max);
        const hi = Math.max(min, max);
        const n = randomIntInclusive(lo, hi);
        if(n == null) return [];
        return [
          { label: "Random integer", value: formatInt(n), emphasis: true }
        ];
      }
    },
    {
      id: "gross-profit",
      category: "Business",
      name: "Gross Profit Calculator",
      description: "Calculate gross profit and margin from revenue and COGS.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "revenue", label: "Revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 50000 },
        { key: "cogs", label: "COGS", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 28000 }
      ],
      compute(values){
        const revenue = toNumber(values.revenue);
        const cogs = toNumber(values.cogs);
        if(!Number.isFinite(revenue) || revenue < 0 || !Number.isFinite(cogs) || cogs < 0) return [];
        const profit = revenue - cogs;
        const margin = revenue === 0 ? 0 : profit / revenue;
        return [
          { label: "Gross profit", value: formatMoney(profit), emphasis: true },
          { label: "Gross margin", value: formatPercentFromRate(margin) },
          { label: "Revenue", value: formatMoney(revenue) }
        ];
      }
    },
    {
      id: "net-profit",
      category: "Business",
      name: "Net Profit Calculator",
      description: "Calculate net profit and net margin.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "revenue", label: "Revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 60000 },
        { key: "expenses", label: "Total expenses", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 42000 }
      ],
      compute(values){
        const revenue = toNumber(values.revenue);
        const expenses = toNumber(values.expenses);
        if(!Number.isFinite(revenue) || revenue < 0 || !Number.isFinite(expenses) || expenses < 0) return [];
        const profit = revenue - expenses;
        const margin = revenue === 0 ? 0 : profit / revenue;
        return [
          { label: "Net profit", value: formatMoney(profit), emphasis: true },
          { label: "Net margin", value: formatPercentFromRate(margin) },
          { label: "Revenue", value: formatMoney(revenue) }
        ];
      }
    },
    {
      id: "operating-margin",
      category: "Business",
      name: "Operating Margin Calculator",
      description: "Measure operating margin from operating income and revenue.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "operatingIncome", label: "Operating income", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 12000 },
        { key: "revenue", label: "Revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 60000 }
      ],
      compute(values){
        const op = toNumber(values.operatingIncome);
        const rev = toNumber(values.revenue);
        if(!Number.isFinite(op) || op < 0 || !Number.isFinite(rev) || rev < 0) return [];
        const margin = rev === 0 ? 0 : op / rev;
        return [
          { label: "Operating margin", value: formatPercentFromRate(margin), emphasis: true },
          { label: "Operating income", value: formatMoney(op) },
          { label: "Revenue", value: formatMoney(rev) }
        ];
      }
    },
    {
      id: "working-capital",
      category: "Business",
      name: "Working Capital Calculator",
      description: "Compute working capital and current ratio.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "assets", label: "Current assets", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 35000 },
        { key: "liabilities", label: "Current liabilities", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 21000 }
      ],
      compute(values){
        const a = toNumber(values.assets);
        const l = toNumber(values.liabilities);
        if(!Number.isFinite(a) || a < 0 || !Number.isFinite(l) || l < 0) return [];
        const wc = a - l;
        const ratio = l === 0 ? NaN : a / l;
        return [
          { label: "Working capital", value: formatMoney(wc), emphasis: true },
          { label: "Current ratio", value: formatNumber(ratio) },
          { label: "Assets", value: formatMoney(a) }
        ];
      }
    },
    {
      id: "cost-per-unit",
      category: "Business",
      name: "Cost Per Unit Calculator",
      description: "Compute cost per unit from total cost and units produced.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "totalCost", label: "Total cost", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 12000 },
        { key: "units", label: "Units", type: "number", min: 1, step: 1, defaultValue: 300 }
      ],
      compute(values){
        const c = toNumber(values.totalCost);
        const u = toNumber(values.units);
        if(!Number.isFinite(c) || c < 0 || !Number.isFinite(u) || u <= 0) return [];
        const cpu = c / u;
        return [
          { label: "Cost per unit", value: formatMoney(cpu), emphasis: true },
          { label: "Total cost", value: formatMoney(c) },
          { label: "Units", value: formatInt(u) }
        ];
      }
    },
    {
      id: "markup",
      category: "Business",
      name: "Markup Calculator",
      description: "Calculate markup percent and profit per unit.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "cost", label: "Unit cost", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 12 },
        { key: "price", label: "Unit price", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 20 }
      ],
      compute(values){
        const cost = toNumber(values.cost);
        const price = toNumber(values.price);
        if(!Number.isFinite(cost) || cost < 0 || !Number.isFinite(price) || price < 0) return [];
        const profit = price - cost;
        const markupPct = cost === 0 ? NaN : profit / cost;
        return [
          { label: "Markup", value: formatPercentFromRate(markupPct), emphasis: true },
          { label: "Profit per unit", value: formatMoney(profit) },
          { label: "Price", value: formatMoney(price) }
        ];
      }
    },
    {
      id: "revenue-growth",
      category: "Business",
      name: "Revenue Growth Rate Calculator",
      description: "Measure period-over-period revenue growth.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "prior", label: "Prior period revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 50000 },
        { key: "current", label: "Current period revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 57500 }
      ],
      compute(values){
        const a = toNumber(values.prior);
        const b = toNumber(values.current);
        if(!Number.isFinite(a) || a < 0 || !Number.isFinite(b) || b < 0) return [];
        const growth = a === 0 ? NaN : (b - a) / a;
        return [
          { label: "Growth rate", value: formatPercentFromRate(growth), emphasis: true },
          { label: "Prior", value: formatMoney(a) },
          { label: "Current", value: formatMoney(b) }
        ];
      }
    },
    {
      id: "clv",
      category: "Business",
      name: "Customer Lifetime Value (CLV) Calculator",
      description: "Estimate CLV from AOV, frequency, retention, and margin.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "aov", label: "Average order value", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 60 },
        { key: "freq", label: "Purchases per year", type: "number", min: 0, step: 0.01, defaultValue: 3 },
        { key: "years", label: "Retention (years)", type: "number", min: 0, step: 0.1, defaultValue: 2 },
        { key: "margin", label: "Gross margin", type: "number", unit: "%", min: 0, step: 0.01, defaultValue: 45 }
      ],
      compute(values){
        const aov = toNumber(values.aov);
        const f = toNumber(values.freq);
        const y = toNumber(values.years);
        const m = toNumber(values.margin);
        if(!Number.isFinite(aov) || aov < 0) return [];
        if(!Number.isFinite(f) || f < 0) return [];
        if(!Number.isFinite(y) || y < 0) return [];
        if(!Number.isFinite(m) || m < 0) return [];
        const clv = aov * f * y * (m / 100);
        return [
          { label: "Estimated CLV", value: formatMoney(clv), emphasis: true },
          { label: "AOV", value: formatMoney(aov) },
          { label: "Purchases/year", value: formatNumber(f) }
        ];
      }
    },
    {
      id: "email-roi",
      category: "E-commerce",
      name: "Email Marketing ROI Calculator",
      description: "Compute ROI from campaign revenue and cost.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "revenue", label: "Campaign revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 8000 },
        { key: "cost", label: "Campaign cost", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 2000 }
      ],
      compute(values){
        const rev = toNumber(values.revenue);
        const cost = toNumber(values.cost);
        if(!Number.isFinite(rev) || rev < 0 || !Number.isFinite(cost) || cost < 0) return [];
        const roi = cost === 0 ? NaN : (rev - cost) / cost;
        return [
          { label: "ROI", value: formatPercentFromRate(roi), emphasis: true },
          { label: "Revenue", value: formatMoney(rev) },
          { label: "Cost", value: formatMoney(cost) }
        ];
      }
    },
    {
      id: "ctr",
      category: "E-commerce",
      name: "Click-Through Rate (CTR) Calculator",
      description: "Calculate CTR from clicks and impressions.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "clicks", label: "Clicks", type: "number", min: 0, step: 1, defaultValue: 420 },
        { key: "impressions", label: "Impressions", type: "number", min: 0, step: 1, defaultValue: 28000 }
      ],
      compute(values){
        const c = toNumber(values.clicks);
        const i = toNumber(values.impressions);
        if(!Number.isFinite(c) || c < 0 || !Number.isFinite(i) || i <= 0) return [];
        const ctr = c / i;
        return [
          { label: "CTR", value: formatPercentFromRate(ctr), emphasis: true },
          { label: "Clicks", value: formatInt(c) },
          { label: "Impressions", value: formatInt(i) }
        ];
      }
    },
    {
      id: "cpc",
      category: "E-commerce",
      name: "Cost Per Click (CPC) Calculator",
      description: "Compute CPC from ad spend and clicks.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "cost", label: "Ad spend", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 1200 },
        { key: "clicks", label: "Clicks", type: "number", min: 0, step: 1, defaultValue: 2400 }
      ],
      compute(values){
        const cost = toNumber(values.cost);
        const clicks = toNumber(values.clicks);
        if(!Number.isFinite(cost) || cost < 0 || !Number.isFinite(clicks) || clicks <= 0) return [];
        const cpc = cost / clicks;
        return [
          { label: "CPC", value: formatMoney(cpc), emphasis: true },
          { label: "Spend", value: formatMoney(cost) },
          { label: "Clicks", value: formatInt(clicks) }
        ];
      }
    },
    {
      id: "cpm",
      category: "E-commerce",
      name: "Cost Per Mille (CPM) Calculator",
      description: "Compute CPM from ad spend and impressions.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "cost", label: "Ad spend", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 800 },
        { key: "impressions", label: "Impressions", type: "number", min: 0, step: 1, defaultValue: 160000 }
      ],
      compute(values){
        const cost = toNumber(values.cost);
        const imp = toNumber(values.impressions);
        if(!Number.isFinite(cost) || cost < 0 || !Number.isFinite(imp) || imp <= 0) return [];
        const cpm = (cost / imp) * 1000;
        return [
          { label: "CPM", value: formatMoney(cpm), emphasis: true },
          { label: "Spend", value: formatMoney(cost) },
          { label: "Impressions", value: formatInt(imp) }
        ];
      }
    },
    {
      id: "retention-rate",
      category: "E-commerce",
      name: "Customer Retention Rate Calculator",
      description: "Estimate retention from period start, end, and new customers.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "start", label: "Start customers", type: "number", min: 0, step: 1, defaultValue: 5000 },
        { key: "end", label: "End customers", type: "number", min: 0, step: 1, defaultValue: 5200 },
        { key: "new", label: "New customers", type: "number", min: 0, step: 1, defaultValue: 400 }
      ],
      compute(values){
        const s = toNumber(values.start);
        const e = toNumber(values.end);
        const n = toNumber(values.new);
        if(!Number.isFinite(s) || s <= 0) return [];
        if(!Number.isFinite(e) || e < 0) return [];
        if(!Number.isFinite(n) || n < 0) return [];
        const retained = e - n;
        const rate = retained / s;
        return [
          { label: "Retention rate", value: formatPercentFromRate(rate), emphasis: true },
          { label: "Retained customers", value: formatInt(Math.max(0, Math.round(retained))) },
          { label: "Start customers", value: formatInt(Math.round(s)) }
        ];
      }
    },
    {
      id: "refund-rate",
      category: "E-commerce",
      name: "Refund Rate Calculator",
      description: "Compute refund percentage from refunds and orders.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "refunds", label: "Refunds", type: "number", min: 0, step: 1, defaultValue: 42 },
        { key: "orders", label: "Total orders", type: "number", min: 0, step: 1, defaultValue: 5200 }
      ],
      compute(values){
        const r = toNumber(values.refunds);
        const o = toNumber(values.orders);
        if(!Number.isFinite(r) || r < 0 || !Number.isFinite(o) || o <= 0) return [];
        const rate = r / o;
        return [
          { label: "Refund rate", value: formatPercentFromRate(rate), emphasis: true },
          { label: "Refunds", value: formatInt(Math.round(r)) },
          { label: "Orders", value: formatInt(Math.round(o)) }
        ];
      }
    },
    {
      id: "churn-rate",
      category: "E-commerce",
      name: "Churn Rate Calculator",
      description: "Compute churn from customers lost and starting customers.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "lost", label: "Customers lost", type: "number", min: 0, step: 1, defaultValue: 120 },
        { key: "start", label: "Start customers", type: "number", min: 0, step: 1, defaultValue: 5000 }
      ],
      compute(values){
        const lost = toNumber(values.lost);
        const start = toNumber(values.start);
        if(!Number.isFinite(lost) || lost < 0 || !Number.isFinite(start) || start <= 0) return [];
        const churn = lost / start;
        return [
          { label: "Churn rate", value: formatPercentFromRate(churn), emphasis: true },
          { label: "Lost customers", value: formatInt(Math.round(lost)) },
          { label: "Start customers", value: formatInt(Math.round(start)) }
        ];
      }
    },
    {
      id: "subscription-mrr",
      category: "E-commerce",
      name: "Subscription MRR Calculator",
      description: "Compute monthly recurring revenue from subscribers and price.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "subs", label: "Subscribers", type: "number", min: 0, step: 1, defaultValue: 1200 },
        { key: "price", label: "Price per month", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 12 }
      ],
      compute(values){
        const s = toNumber(values.subs);
        const p = toNumber(values.price);
        if(!Number.isFinite(s) || s < 0 || !Number.isFinite(p) || p < 0) return [];
        const mrr = s * p;
        return [
          { label: "MRR", value: formatMoney(mrr), emphasis: true },
          { label: "Subscribers", value: formatInt(Math.round(s)) },
          { label: "Price", value: formatMoney(p) }
        ];
      }
    },
    {
      id: "subscription-arpu",
      category: "E-commerce",
      name: "Subscription ARPU Calculator",
      description: "Compute ARPU from revenue and active users.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "revenue", label: "Monthly revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 24000 },
        { key: "users", label: "Active users", type: "number", min: 0, step: 1, defaultValue: 3000 }
      ],
      compute(values){
        const r = toNumber(values.revenue);
        const u = toNumber(values.users);
        if(!Number.isFinite(r) || r < 0 || !Number.isFinite(u) || u <= 0) return [];
        const arpu = r / u;
        return [
          { label: "ARPU", value: formatMoney(arpu), emphasis: true },
          { label: "Revenue", value: formatMoney(r) },
          { label: "Users", value: formatInt(Math.round(u)) }
        ];
      }
    },
    {
      id: "influencer-roi",
      category: "E-commerce",
      name: "Influencer ROI Calculator",
      description: "Compute ROI of influencer campaign from revenue and cost.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "revenue", label: "Attributed revenue", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 5000 },
        { key: "cost", label: "Influencer cost", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 1500 }
      ],
      compute(values){
        const r = toNumber(values.revenue);
        const c = toNumber(values.cost);
        if(!Number.isFinite(r) || r < 0 || !Number.isFinite(c) || c < 0) return [];
        const roi = c === 0 ? NaN : (r - c) / c;
        return [
          { label: "ROI", value: formatPercentFromRate(roi), emphasis: true },
          { label: "Revenue", value: formatMoney(r) },
          { label: "Cost", value: formatMoney(c) }
        ];
      }
    },
    {
      id: "power",
      category: "Math",
      name: "Power Calculator (x^y)",
      description: "Compute x raised to the power y.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "x", label: "Base (x)", type: "number", step: 0.01, defaultValue: 2 },
        { key: "y", label: "Exponent (y)", type: "number", step: 0.01, defaultValue: 8 }
      ],
      compute(values){
        const x = toNumber(values.x);
        const y = toNumber(values.y);
        if(!Number.isFinite(x) || !Number.isFinite(y)) return [];
        const v = Math.pow(x, y);
        return [
          { label: "Result", value: formatNumber(v), emphasis: true },
          { label: "Base", value: formatNumber(x) },
          { label: "Exponent", value: formatNumber(y) }
        ];
      }
    },
    {
      id: "percentage-change",
      category: "Math",
      name: "Percentage Change Calculator",
      description: "Compute percent change from start to end value.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "start", label: "Start", type: "number", step: 0.01, defaultValue: 100 },
        { key: "end", label: "End", type: "number", step: 0.01, defaultValue: 115 }
      ],
      compute(values){
        const a = toNumber(values.start);
        const b = toNumber(values.end);
        if(!Number.isFinite(a) || !Number.isFinite(b)) return [];
        const change = a === 0 ? NaN : (b - a) / a;
        return [
          { label: "Percent change", value: formatPercentFromRate(change), emphasis: true },
          { label: "Start", value: formatNumber(a) },
          { label: "End", value: formatNumber(b) }
        ];
      }
    },
    {
      id: "mean-median-mode",
      category: "Math",
      name: "Mean, Median, Mode Calculator",
      description: "Compute mean, median, and mode of up to 5 values.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "v1", label: "Value 1", type: "number", step: 0.01, defaultValue: 10 },
        { key: "v2", label: "Value 2", type: "number", step: 0.01, defaultValue: 12 },
        { key: "v3", label: "Value 3", type: "number", step: 0.01, defaultValue: 15 },
        { key: "v4", label: "Value 4", type: "number", step: 0.01, defaultValue: 15 },
        { key: "v5", label: "Value 5", type: "number", step: 0.01, defaultValue: 20 }
      ],
      compute(values){
        const arr = [values.v1, values.v2, values.v3, values.v4, values.v5].map(toNumber).filter(n => Number.isFinite(n));
        if(arr.length === 0) return [];
        const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        const counts = new Map();
        sorted.forEach(n => counts.set(n, (counts.get(n) || 0) + 1));
        let maxC = 0; let mode = sorted[0];
        counts.forEach((c, n) => { if(c > maxC) { maxC = c; mode = n; } });
        return [
          { label: "Mean", value: formatNumber(mean), emphasis: true },
          { label: "Median", value: formatNumber(median) },
          { label: "Mode", value: formatNumber(mode) }
        ];
      }
    },
    {
      id: "standard-deviation",
      category: "Math",
      name: "Standard Deviation Calculator",
      description: "Compute population standard deviation of up to 5 values.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "v1", label: "Value 1", type: "number", step: 0.01, defaultValue: 10 },
        { key: "v2", label: "Value 2", type: "number", step: 0.01, defaultValue: 12 },
        { key: "v3", label: "Value 3", type: "number", step: 0.01, defaultValue: 15 },
        { key: "v4", label: "Value 4", type: "number", step: 0.01, defaultValue: 18 },
        { key: "v5", label: "Value 5", type: "number", step: 0.01, defaultValue: 20 }
      ],
      compute(values){
        const arr = [values.v1, values.v2, values.v3, values.v4, values.v5].map(toNumber).filter(n => Number.isFinite(n));
        if(arr.length === 0) return [];
        const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
        const varPop = arr.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / arr.length;
        const sd = Math.sqrt(varPop);
        return [
          { label: "Std deviation", value: formatNumber(sd), emphasis: true },
          { label: "Mean", value: formatNumber(mean) },
          { label: "Count", value: formatInt(arr.length) }
        ];
      }
    },
    {
      id: "prime-checker",
      category: "Math",
      name: "Prime Number Checker",
      description: "Check if a number is prime.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "n", label: "Number", type: "number", step: 1, defaultValue: 97 }
      ],
      compute(values){
        const n = Math.trunc(toNumber(values.n));
        if(!Number.isFinite(n)) return [];
        if(n < 2) return [ { label: "Prime?", value: "No", emphasis: true }, { label: "Number", value: formatInt(n) } ];
        if(n % 2 === 0) return [ { label: "Prime?", value: (n === 2 ? "Yes" : "No"), emphasis: true }, { label: "Number", value: formatInt(n) } ];
        const r = Math.floor(Math.sqrt(n));
        for(let i = 3; i <= r; i += 2){ if(n % i === 0) return [ { label: "Prime?", value: "No", emphasis: true }, { label: "Number", value: formatInt(n) } ]; }
        return [ { label: "Prime?", value: "Yes", emphasis: true }, { label: "Number", value: formatInt(n) } ];
      }
    },
    {
      id: "factorial",
      category: "Math",
      name: "Factorial Calculator",
      description: "Compute n! for integers up to 20.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "n", label: "n", type: "number", min: 0, step: 1, defaultValue: 8 }
      ],
      compute(values){
        let n = Math.trunc(toNumber(values.n));
        if(!Number.isFinite(n) || n < 0) return [];
        n = Math.min(20, n);
        let v = 1;
        for(let i = 2; i <= n; i++) v *= i;
        return [
          { label: "n!", value: String(v), emphasis: true },
          { label: "n", value: formatInt(n) }
        ];
      }
    },
    {
      id: "currency-converter",
      category: "Conversions",
      name: "Currency Converter (USD ↔ CAD)",
      description: "Convert between USD and CAD using a rate you enter.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "amount", label: "Amount", type: "number", unit: "money", min: 0, step: 0.01, defaultValue: 100 },
        { key: "dir", label: "Direction", type: "select", defaultValue: "usd-cad", options: [
          { value: "usd-cad", label: "USD → CAD" },
          { value: "cad-usd", label: "CAD → USD" }
        ] },
        { key: "rate", label: "CAD per USD (rate)", type: "number", step: 0.0001, defaultValue: 1.34 }
      ],
      compute(values){
        const amt = toNumber(values.amount);
        const rate = toNumber(values.rate);
        const dir = String(values.dir || "usd-cad");
        if(!Number.isFinite(amt) || amt < 0) return [];
        if(!Number.isFinite(rate) || rate <= 0) return [];
        const out = dir === "usd-cad" ? (amt * rate) : (amt / rate);
        const inLabel = dir === "usd-cad" ? "$ USD" : "$ CAD";
        const outLabel = dir === "usd-cad" ? "$ CAD" : "$ USD";
        return [
          { label: "Converted", value: formatMoney(out), emphasis: true },
          { label: "Input", value: `${formatMoney(amt)} ${inLabel}` },
          { label: "Output", value: outLabel }
        ];
      }
    },
    {
      id: "speed-conversion",
      category: "Conversions",
      name: "Speed Conversion Calculator",
      description: "Convert speed between m/s, km/h, and mph.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.01, defaultValue: 60 },
        { key: "unit", label: "Unit", type: "select", defaultValue: "kmh", options: [
          { value: "ms", label: "m/s" },
          { value: "kmh", label: "km/h" },
          { value: "mph", label: "mph" }
        ] }
      ],
      compute(values){
        const v = toNumber(values.value);
        const unit = String(values.unit || "kmh");
        if(!Number.isFinite(v)) return [];
        const table = { ms: 1, kmh: (1000/3600), mph: 0.44704 };
        const all = convertUnits(v, unit, table);
        if(!all) return [];
        return [
          { label: "m/s", value: formatNumber(all.ms), emphasis: unit === "ms" },
          { label: "km/h", value: formatNumber(all.kmh), emphasis: unit === "kmh" },
          { label: "mph", value: formatNumber(all.mph), emphasis: unit === "mph" }
        ];
      }
    },
    {
      id: "energy-conversion",
      category: "Conversions",
      name: "Energy Conversion Calculator",
      description: "Convert energy between J, kJ, kcal, and Wh.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.01, defaultValue: 1000 },
        { key: "unit", label: "Unit", type: "select", defaultValue: "J", options: [
          { value: "J", label: "Joule (J)" },
          { value: "kJ", label: "Kilojoule (kJ)" },
          { value: "kcal", label: "Kilocalorie (kcal)" },
          { value: "Wh", label: "Watt-hour (Wh)" }
        ] }
      ],
      compute(values){
        const v = toNumber(values.value);
        const unit = String(values.unit || "J");
        if(!Number.isFinite(v)) return [];
        const table = { J: 1, kJ: 1000, kcal: 4184, Wh: 3600 };
        const all = convertUnits(v, unit, table);
        if(!all) return [];
        return [
          { label: "J", value: formatNumber(all.J), emphasis: unit === "J" },
          { label: "kJ", value: formatNumber(all.kJ), emphasis: unit === "kJ" },
          { label: "kcal", value: formatNumber(all.kcal), emphasis: unit === "kcal" },
          { label: "Wh", value: formatNumber(all.Wh), emphasis: unit === "Wh" }
        ];
      }
    },
    {
      id: "fuel-efficiency",
      category: "Conversions",
      name: "Fuel Efficiency Converter (MPG ↔ L/100km)",
      description: "Convert between MPG and L/100km.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.01, defaultValue: 30 },
        { key: "mode", label: "Mode", type: "select", defaultValue: "mpg-l100", options: [
          { value: "mpg-l100", label: "MPG → L/100km" },
          { value: "l100-mpg", label: "L/100km → MPG" }
        ] }
      ],
      compute(values){
        const v = toNumber(values.value);
        const mode = String(values.mode || "mpg-l100");
        if(!Number.isFinite(v) || v <= 0) return [];
        const k = 235.214583;
        const out = mode === "mpg-l100" ? (k / v) : (k / v);
        const label = mode === "mpg-l100" ? "L/100km" : "MPG";
        return [
          { label, value: formatNumber(out), emphasis: true },
          { label: "Input", value: formatNumber(v) }
        ];
      }
    },
    {
      id: "data-storage",
      category: "Conversions",
      name: "Data Storage Converter (KB to TB)",
      description: "Convert between KB, MB, GB, and TB.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.01, defaultValue: 1024 },
        { key: "unit", label: "Unit", type: "select", defaultValue: "KB", options: [
          { value: "KB", label: "KB" },
          { value: "MB", label: "MB" },
          { value: "GB", label: "GB" },
          { value: "TB", label: "TB" }
        ] }
      ],
      compute(values){
        const v = toNumber(values.value);
        const unit = String(values.unit || "KB");
        if(!Number.isFinite(v)) return [];
        const table = { KB: 1024, MB: 1024*1024, GB: 1024*1024*1024, TB: 1024*1024*1024*1024 };
        const all = convertUnits(v, unit, table);
        if(!all) return [];
        return [
          { label: "KB", value: formatNumber(all.KB), emphasis: unit === "KB" },
          { label: "MB", value: formatNumber(all.MB), emphasis: unit === "MB" },
          { label: "GB", value: formatNumber(all.GB), emphasis: unit === "GB" },
          { label: "TB", value: formatNumber(all.TB), emphasis: unit === "TB" }
        ];
      }
    },
    {
      id: "angle-conversion",
      category: "Conversions",
      name: "Angle Conversion (Degrees ↔ Radians)",
      description: "Convert angle between degrees and radians.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "value", label: "Value", type: "number", step: 0.0001, defaultValue: 180 },
        { key: "mode", label: "Mode", type: "select", defaultValue: "deg-rad", options: [
          { value: "deg-rad", label: "Degrees → Radians" },
          { value: "rad-deg", label: "Radians → Degrees" }
        ] }
      ],
      compute(values){
        const v = toNumber(values.value);
        const mode = String(values.mode || "deg-rad");
        if(!Number.isFinite(v)) return [];
        const out = mode === "deg-rad" ? (v * Math.PI / 180) : (v * 180 / Math.PI);
        const label = mode === "deg-rad" ? "Radians" : "Degrees";
        return [
          { label, value: formatNumber(out), emphasis: true },
          { label: "Input", value: formatNumber(v) }
        ];
      }
    },
    {
      id: "date-difference",
      category: "Miscellaneous",
      name: "Date Difference Calculator",
      description: "Compute time between two dates in years, months, and days.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "start", label: "Start date", type: "date", defaultValue: "" },
        { key: "end", label: "End date", type: "date", defaultValue: "" }
      ],
      compute(values){
        const s = new Date(String(values.start || ""));
        const e = new Date(String(values.end || ""));
        if(!(s instanceof Date) || !(e instanceof Date) || isNaN(s) || isNaN(e)) return [];
        const diff = (function(){
          const S = s.getTime();
          const E = e.getTime();
          const cursor = new Date(S);
          let years = 0; let months = 0;
          while(true){
            const nextY = new Date(cursor.getFullYear()+1, cursor.getMonth(), cursor.getDate());
            if(nextY.getTime() <= E){ cursor.setFullYear(cursor.getFullYear()+1); years++; } else break;
          }
          while(true){
            const nextM = new Date(cursor.getFullYear(), cursor.getMonth()+1, cursor.getDate());
            if(nextM.getTime() <= E){ cursor.setMonth(cursor.getMonth()+1); months++; } else break;
          }
          const days = Math.round((E - cursor.getTime()) / (24*60*60*1000));
          const totalDays = Math.round((E - S) / (24*60*60*1000));
          return { years, months, days, totalDays };
        })();
        return [
          { label: "Difference", value: `${formatInt(diff.years)}y ${formatInt(diff.months)}m ${formatInt(diff.days)}d`, emphasis: true },
          { label: "Total days", value: formatInt(diff.totalDays) }
        ];
      }
    },
    {
      id: "time-zone-converter",
      category: "Miscellaneous",
      name: "Time Zone Converter (US & Canada)",
      description: "Convert local time between common US/Canada zones.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "date", label: "Date", type: "date", defaultValue: "" },
        { key: "hour", label: "Hour (0–23)", type: "number", min: 0, max: 23, step: 1, defaultValue: 9 },
        { key: "minute", label: "Minute", type: "number", min: 0, max: 59, step: 1, defaultValue: 30 },
        { key: "from", label: "From zone", type: "select", defaultValue: "EST", options: [
          { value: "PST", label: "Pacific (PST)" },
          { value: "MST", label: "Mountain (MST)" },
          { value: "CST", label: "Central (CST)" },
          { value: "EST", label: "Eastern (EST)" },
          { value: "AST", label: "Atlantic (AST)" },
          { value: "NST", label: "Newfoundland (NST)" },
          { value: "AKST", label: "Alaska (AKST)" },
          { value: "HST", label: "Hawaii (HST)" }
        ] },
        { key: "to", label: "To zone", type: "select", defaultValue: "PST", options: [
          { value: "PST", label: "Pacific (PST)" },
          { value: "MST", label: "Mountain (MST)" },
          { value: "CST", label: "Central (CST)" },
          { value: "EST", label: "Eastern (EST)" },
          { value: "AST", label: "Atlantic (AST)" },
          { value: "NST", label: "Newfoundland (NST)" },
          { value: "AKST", label: "Alaska (AKST)" },
          { value: "HST", label: "Hawaii (HST)" }
        ] }
      ],
      compute(values){
        const dateStr = String(values.date || "");
        const h = Math.trunc(toNumber(values.hour));
        const m = Math.trunc(toNumber(values.minute));
        const from = String(values.from || "EST");
        const to = String(values.to || "PST");
        if(!(Number.isFinite(h) && h >= 0 && h <= 23)) return [];
        if(!(Number.isFinite(m) && m >= 0 && m <= 59)) return [];
        const offsets = { PST:-8, MST:-7, CST:-6, EST:-5, AST:-4, NST:-3.5, AKST:-9, HST:-10 };
        const offFrom = offsets[from];
        const offTo = offsets[to];
        if(offFrom == null || offTo == null) return [];
        const deltaMin = Math.round((offTo - offFrom) * 60);
        const base = new Date(dateStr || (new Date()).toISOString().slice(0,10));
        if(isNaN(base)) return [];
        const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0);
        dt.setMinutes(dt.getMinutes() + deltaMin);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth()+1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        const hh = String(dt.getHours()).padStart(2, "0");
        const min = String(dt.getMinutes()).padStart(2, "0");
        return [
          { label: "Converted time", value: `${yyyy}-${mm}-${dd} ${hh}:${min} ${to}`, emphasis: true },
          { label: "Original", value: `${String(values.date || "").slice(0,10)} ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")} ${from}` }
        ];
      }
    },
    {
      id: "bmi",
      category: "Miscellaneous",
      name: "BMI Calculator",
      description: "Compute Body Mass Index in metric or imperial units.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "unit", label: "Units", type: "select", defaultValue: "metric", options: [
          { value: "metric", label: "Metric (kg, cm)" },
          { value: "imperial", label: "Imperial (lb, in)" }
        ] },
        { key: "weight", label: "Weight", type: "number", min: 0, step: 0.1, defaultValue: 70 },
        { key: "height", label: "Height", type: "number", min: 0, step: 0.1, defaultValue: 175 }
      ],
      fieldVisibility(values){
        const u = String(values.unit || "metric");
        return { };
      },
      compute(values){
        const unit = String(values.unit || "metric");
        let w = toNumber(values.weight);
        let h = toNumber(values.height);
        if(!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) return [];
        if(unit === "imperial"){
          w = w * 0.45359237;
          h = h * 2.54;
        }
        const m = h / 100;
        const bmi = w / (m*m);
        let cat = "Normal";
        if(bmi < 18.5) cat = "Underweight";
        else if(bmi < 25) cat = "Normal";
        else if(bmi < 30) cat = "Overweight";
        else cat = "Obese";
        return [
          { label: "BMI", value: formatNumber(bmi), emphasis: true },
          { label: "Category", value: cat }
        ];
      }
    },
    {
      id: "bmr",
      category: "Miscellaneous",
      name: "BMR Calculator",
      description: "Estimate Basal Metabolic Rate (Mifflin–St Jeor).",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "gender", label: "Gender", type: "select", defaultValue: "male", options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" }
        ] },
        { key: "age", label: "Age", type: "number", min: 0, step: 1, defaultValue: 30 },
        { key: "weight", label: "Weight (kg)", type: "number", min: 0, step: 0.1, defaultValue: 70 },
        { key: "height", label: "Height (cm)", type: "number", min: 0, step: 0.1, defaultValue: 175 }
      ],
      compute(values){
        const g = String(values.gender || "male");
        const age = toNumber(values.age);
        const w = toNumber(values.weight);
        const h = toNumber(values.height);
        if(!Number.isFinite(age) || age <= 0) return [];
        if(!Number.isFinite(w) || w <= 0) return [];
        if(!Number.isFinite(h) || h <= 0) return [];
        const s = g === "male" ? 5 : -161;
        const bmr = 10*w + 6.25*h - 5*age + s;
        return [
          { label: "BMR", value: formatNumber(bmr), emphasis: true },
          { label: "Gender", value: g === "male" ? "Male" : "Female" }
        ];
      }
    },
    {
      id: "loan-eligibility",
      category: "Miscellaneous",
      name: "Loan Eligibility Calculator",
      description: "Estimate DTI ratio and simple eligibility flag.",
      addedAt: "2025-12-30",
      popular: false,
      fields: [
        { key: "income", label: "Monthly income", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 4500 },
        { key: "debts", label: "Current monthly debts", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 800 },
        { key: "payment", label: "Proposed loan payment", type: "number", unit: "USD", min: 0, step: 0.01, defaultValue: 900 }
      ],
      compute(values){
        const inc = toNumber(values.income);
        const debts = toNumber(values.debts);
        const pay = toNumber(values.payment);
        if(!Number.isFinite(inc) || inc <= 0) return [];
        if(!Number.isFinite(debts) || debts < 0) return [];
        if(!Number.isFinite(pay) || pay < 0) return [];
        const dti = (debts + pay) / inc;
        const verdict = dti < 0.36 ? "Likely eligible" : (dti < 0.43 ? "Borderline" : "High DTI");
        return [
          { label: "DTI", value: formatPercentFromRate(dti), emphasis: true },
          { label: "Verdict", value: verdict }
        ];
      }
    }
  ];

  const byId = Object.fromEntries(CALCULATORS.map(c => [c.id, c]));
  const categories = Array.from(new Set(CALCULATORS.map(c => c.category)));

  function slugify(input){
    return String(input || "")
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function uniqueSlugs(list){
    const used = new Map();
    list.forEach(c => {
      const base = slugify(c.name) || slugify(c.id) || "tool";
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      c.slug = count === 1 ? base : `${base}-${count}`;
    });
  }

  uniqueSlugs(CALCULATORS);

  const bySlug = Object.fromEntries(CALCULATORS.map(c => [c.slug, c]));

  function prefixToRoot(){
    const parts = String(location.pathname || "").split("/").filter(Boolean);
    if(parts[0] !== "tools") return "";
    return "../".repeat(parts.length);
  }

  function urlForTool(calc){
    const slug = calc && calc.slug ? calc.slug : "";
    const proto = location && location.protocol ? String(location.protocol) : "";
    const isHttp = proto === "http:" || proto === "https:";
    if(!slug) return isHttp ? (prefixToRoot() + "tools/") : "calculators.html";
    return isHttp ? (prefixToRoot() + `tools/${encodeURIComponent(slug)}/`) : ("calculator.html?tool=" + encodeURIComponent(calc.id));
  }

  function canonicalUrlForTool(calc){
    const slug = calc && calc.slug ? calc.slug : "";
    if(!slug) return "";
    const proto = location && location.protocol ? String(location.protocol) : "";
    const isHttp = proto === "http:" || proto === "https:";
    if(!isHttp) return "";
    const origin = location && location.origin ? location.origin : "";
    const base = origin ? origin.replace(/\/$/, "") + "/" : "/";
    return base + `tools/${encodeURIComponent(slug)}/`;
  }

  function buildSeo(calc){
    const name = String(calc?.name || "Calculator");
    const category = String(calc?.category || "Tools");
    const shortDesc = String(calc?.description || "").trim();

    const title = `${name} (Free Online) | calculateshub`;
    const description = shortDesc
      ? `${shortDesc} Free online ${name.toLowerCase()} with instant results.`
      : `Free online ${name.toLowerCase()} with instant results and simple inputs.`;

    const intro = [
      `${name} helps you get quick, accurate estimates without spreadsheets or sign-ups.`,
      `Enter your inputs and click Calculate. Everything runs locally in your browser for speed and privacy.`
    ];

    const outro = [
      `If you also work with ${category.toLowerCase()} numbers, browse related tools to double-check results and explore alternatives.`,
      `Use results as estimates only and verify critical numbers with official sources.`
    ];

    const faqs = [
      {
        q: `How does the ${name} work?`,
        a: `It applies standard formulas to your inputs and updates the outputs instantly in your browser. Results are estimates based on the values you enter.`
      },
      {
        q: `Is the ${name} accurate?`,
        a: `It’s accurate for the formula it uses, but your real-world outcome can differ due to fees, rounding, rules, or provider-specific terms.`
      },
      {
        q: `Do you store my inputs?`,
        a: `No. Inputs are processed locally in your browser and are not sent to a server by this tool.`
      },
      {
        q: `What should I do if the result looks wrong?`,
        a: `Double-check units and inputs (percent vs. decimal, months vs. years). Try a related tool for comparison, or contact us with a screenshot.`
      }
    ];

    return { title, description, intro, outro, faqs };
  }

  function getSeo(calc){
    if(!calc) return buildSeo(null);
    if(calc._seo) return calc._seo;
    calc._seo = buildSeo(calc);
    return calc._seo;
  }

  function getRelated(calc, limit){
    const max = Math.max(0, Math.trunc(limit || 6));
    if(!calc || max === 0) return [];
    const sameCategory = CALCULATORS.filter(c => c.id !== calc.id && c.category === calc.category);
    const out = sameCategory.slice(0, max);
    if(out.length < max){
      const rest = CALCULATORS.filter(c => c.id !== calc.id && c.category !== calc.category);
      out.push(...rest.slice(0, max - out.length));
    }
    return out;
  }

  window.OCCalculators = {
    list: CALCULATORS,
    byId,
    bySlug,
    categories,
    formatMoney,
    formatNumber,
    slugify,
    urlForTool,
    canonicalUrlForTool,
    getSeo,
    getRelated
  };
})();
