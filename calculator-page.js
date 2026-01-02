(function(){
  function el(tag, attrs){
    const node = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([k,v]) => {
        if(k === "text") node.textContent = String(v);
        else if(k === "html") node.innerHTML = String(v);
        else node.setAttribute(k, String(v));
      });
    }
    return node;
  }

  function monthlyPayment(principal, annualRatePct, months){
    const P = Number(principal);
    const n = Number(months);
    const r = (Number(annualRatePct) / 100) / 12;
    if(!Number.isFinite(P) || !Number.isFinite(n) || n <= 0) return NaN;
    if(!Number.isFinite(r) || r === 0) return P / n;
    const pow = Math.pow(1 + r, n);
    return P * (r * pow) / (pow - 1);
  }

  function amortizationRows(principal, annualRatePct, months){
    const P = Number(principal);
    const n = Math.trunc(Number(months));
    const r = (Number(annualRatePct) / 100) / 12;
    if(!(Number.isFinite(P) && Number.isFinite(n) && n > 0 && Number.isFinite(r) && r >= 0)) return null;
    const pay = monthlyPayment(P, annualRatePct, n);
    if(!Number.isFinite(pay)) return null;
    let bal = P;
    const rows = [];
    for(let i = 1; i <= n; i++){
      const interest = r === 0 ? 0 : bal * r;
      let principalPaid = pay - interest;
      if(principalPaid > bal) principalPaid = bal;
      bal = bal - principalPaid;
      if(bal < 1e-8) bal = 0;
      rows.push({ month: i, payment: pay, principal: principalPaid, interest, balance: bal });
      if(bal === 0) break;
    }
    return rows;
  }

  function getQueryParam(key){
    return window.OCHelpers ? window.OCHelpers.getQueryParam(key) : new URLSearchParams(location.search).get(key);
  }

  function getToolSlugFromPath(){
    const m = String(location.pathname || "").match(/\/tools\/([^\/?#]+)\/?$/i);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function prefixToRoot(){
    const parts = String(location.pathname || "").split("/").filter(Boolean);
    if(parts[0] !== "tools") return "";
    return "../".repeat(parts.length);
  }

  function isHttp(){
    const proto = location && location.protocol ? String(location.protocol) : "";
    return proto === "http:" || proto === "https:";
  }

  function toolsListHref(){
    return isHttp() ? "/tools" : (prefixToRoot() + "calculators.html");
  }

  function toolsCategoryHref(slug){
    const s = String(slug || "");
    return isHttp() ? (`/tools#${s}`) : (prefixToRoot() + `calculators.html#${s}`);
  }

  function setPageSeo(calc){
    const base = "calculateshub";
    if(!calc){
      if(window.OCHelpers && typeof window.OCHelpers.setSeoMeta === "function"){
        window.OCHelpers.setSeoMeta({ title: base, description: "Fast, mobile-friendly calculators across finance, business, math, conversions, and more." });
      }else{
        document.title = base;
      }
      return;
    }

    const seo = (window.OCCalculators && typeof window.OCCalculators.getSeo === "function")
      ? window.OCCalculators.getSeo(calc)
      : null;
    const canonicalUrl = (window.OCCalculators && typeof window.OCCalculators.canonicalUrlForTool === "function")
      ? window.OCCalculators.canonicalUrlForTool(calc)
      : "";
    const title = (seo && seo.title) ? seo.title : (calc.name + " | " + base);
    const description = (seo && seo.description) ? seo.description : String(calc.description || "");

    if(window.OCHelpers && typeof window.OCHelpers.setSeoMeta === "function"){
      window.OCHelpers.setSeoMeta({ title, description, canonicalUrl });
    }else{
      document.title = title;
    }

    if(window.OCHelpers && typeof window.OCHelpers.setJsonLd === "function"){
      const url = canonicalUrl || String(location.href || "");
      const app = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": String(calc.name || "Calculator"),
        "applicationCategory": "Calculator",
        "operatingSystem": "Any",
        "description": description,
        "url": url,
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
      };
      window.OCHelpers.setJsonLd("calc-app", app);

      if(seo && Array.isArray(seo.faqs) && seo.faqs.length){
        const faq = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": seo.faqs.map(f => ({
            "@type": "Question",
            "name": String(f.q || ""),
            "acceptedAnswer": { "@type": "Answer", "text": String(f.a || "") }
          }))
        };
        window.OCHelpers.setJsonLd("calc-faq", faq);
      }
    }
  }

  function normalizeDateValue(value){
    if(value) return value;
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function buildValues(def){
    const values = {};
    def.fields.forEach((f, idx) => {
      if(f.type === "date"){
        if(f.key === "start") values[f.key] = normalizeDateValue(f.defaultValue);
        else if(f.key === "end"){
          const start = new Date(normalizeDateValue(def.fields.find(x => x.key === "start")?.defaultValue || ""));
          const end = new Date(start.getTime() + 7 * 24*60*60*1000);
          const yyyy = end.getFullYear();
          const mm = String(end.getMonth() + 1).padStart(2, "0");
          const dd = String(end.getDate()).padStart(2, "0");
          values[f.key] = `${yyyy}-${mm}-${dd}`;
        }else{
          values[f.key] = normalizeDateValue(f.defaultValue);
        }
      }else{
        values[f.key] = f.defaultValue ?? "";
      }
      if(idx === 0 && f.type === "select" && (values[f.key] === "" || values[f.key] == null)){
        values[f.key] = (f.options && f.options[0] && f.options[0].value) ? f.options[0].value : "";
      }
    });
    return values;
  }

  function renderField(field, value){
    const wrapper = el("div", { class: "field", "data-field": field.key });
    const labelRow = el("div", { class: "label-row" });
    const label = el("label", { for: "f_" + field.key, text: field.label });
    labelRow.appendChild(label);
    const hint = el("span", { class: "hint", text: field.unit || "" });
    labelRow.appendChild(hint);
    wrapper.appendChild(labelRow);

    let input;
    if(field.type === "select"){
      input = el("select", { class: "input", id: "f_" + field.key, name: field.key });
      (field.options || []).forEach(opt => {
        const o = el("option", { value: opt.value, text: opt.label });
        if(String(value) === String(opt.value)) o.selected = true;
        input.appendChild(o);
      });
    }else if(field.type === "date"){
      input = el("input", { class: "input", id: "f_" + field.key, name: field.key, type: "date", value: String(value || "") });
    }else{
      input = el("input", { class: "input", id: "f_" + field.key, name: field.key, type: "number", value: String(value ?? "") });
      if(field.min != null) input.setAttribute("min", String(field.min));
      if(field.max != null) input.setAttribute("max", String(field.max));
      if(field.step != null) input.setAttribute("step", String(field.step));
      if(field.placeholder != null) input.setAttribute("placeholder", String(field.placeholder));
    }

    wrapper.appendChild(input);
    return { wrapper, input };
  }

  function applyVisibility(def, values, root){
    const visFn = def.fieldVisibility;
    if(typeof visFn !== "function") return;
    const map = visFn(values) || {};
    def.fields.forEach(f => {
      if(map[f.key] == null) return;
      const fieldEl = root.querySelector(`[data-field="${f.key}"]`);
      if(!fieldEl) return;
      fieldEl.style.display = map[f.key] ? "" : "none";
    });
  }

  function renderResults(results, root){
    root.innerHTML = "";
    if(!Array.isArray(results) || results.length === 0){
      const empty = el("div", { class: "muted", text: "Enter values to see results." });
      root.appendChild(empty);
      return;
    }
    results.forEach(r => {
      const row = el("div", { class: "result-row" + (r.emphasis ? " emphasis" : "") });
      const left = el("div", { class: "label", text: r.label });
      const right = el("strong", { text: String(r.value) });
      row.appendChild(left);
      row.appendChild(right);
      root.appendChild(row);
    });
  }

  function visibleFieldKeys(def, values){
    const out = new Set(def.fields.map(f => f.key));
    if(typeof def.fieldVisibility !== "function") return out;
    const map = def.fieldVisibility(values) || {};
    Object.entries(map).forEach(([k, v]) => {
      if(v === false) out.delete(k);
    });
    return out;
  }

  function getSelectLabel(field, value){
    const opts = field && field.options ? field.options : null;
    if(!Array.isArray(opts)) return null;
    const v = String(value);
    const found = opts.find(o => String(o.value) === v);
    return found ? String(found.label) : null;
  }

  function formatInputValue(field, raw){
    if(field.type === "select"){
      return getSelectLabel(field, raw) || String(raw ?? "—");
    }
    if(field.type === "date"){
      const s = String(raw || "").trim();
      return s || "—";
    }
    const s = String(raw ?? "").trim();
    if(s === "") return "—";
    if(field.unit) return `${s} ${field.unit}`;
    return s;
  }

  function renderParagraphs(paragraphs, root){
    root.innerHTML = "";
    if(!Array.isArray(paragraphs) || paragraphs.length === 0) return;
    paragraphs.forEach(t => {
      const p = el("p", { text: t });
      root.appendChild(p);
    });
  }

  function explainResultLabel(label){
    const l = String(label || "").toLowerCase();
    if(l.includes("monthly")) return "This is the amount per month, based on your inputs.";
    if(l.includes("per person")) return "This is the share each person pays after splitting the total.";
    if(l.includes("principal")) return "This part goes toward paying down the original amount (not interest).";
    if(l.includes("interest")) return "This is the cost of borrowing (or earnings) from interest over time.";
    if(l.includes("tax")) return "This is the tax amount computed from the base value and the selected rate.";
    if(l.includes("total")) return "This is the overall total after applying the calculation across the whole period.";
    if(l.includes("amount")) return "This is the computed amount after applying the tool’s formula to your inputs.";
    if(l.includes("percent") || l.includes("%")) return "This value is expressed as a percentage, which is a rate per 100.";
    if(l.includes("gpa")) return "This is your weighted average grade points across the courses you entered.";
    if(l.includes("age")) return "This is the time difference between the dates you selected.";
    if(l.includes("password")) return "This is a randomly generated password based on your settings.";
    if(l.includes("roman")) return "This is the converted value in Roman numeral format.";
    if(l.includes("day")) return "This is the weekday that corresponds to the selected date.";
    return "This value is calculated from your inputs using a standard, commonly used formula for this tool.";
  }

  function buildHowItWorks(def, values){
    const keySet = visibleFieldKeys(def, values);
    const inputList = def.fields
      .filter(f => keySet.has(f.key))
      .map(f => `${f.label}: ${formatInputValue(f, values[f.key])}`);

    const base = [
      def.description || "Enter your inputs and calculate results.",
      inputList.length
        ? ("Inputs used: " + inputList.join(" • ") + ".")
        : "Enter the inputs shown above, then calculate results.",
      "When you click “Calculate”, this tool applies standard formulas and shows the most important outputs in plain English."
    ];

    const id = String(def.id || "");
    if(id === "mortgage"){
      base.push("Mortgage payments are computed using an amortization model: each monthly payment covers interest for the month plus a portion that reduces the loan balance. Optional taxes, insurance, and PMI are added to estimate a full monthly housing payment.");
    }else if(id === "loan"){
      base.push("Loan payments are computed using an amortization formula. The monthly payment is designed so the loan balance reaches zero after the selected term at the given interest rate.");
    }else if(id === "compound-interest"){
      base.push("Compound interest grows your balance by applying interest not only to the initial principal, but also to previously earned interest. The compounding frequency and time period affect the final amount.");
    }else if(id === "cagr"){
      base.push("CAGR (Compound Annual Growth Rate) expresses growth as a smooth yearly rate between a starting value and an ending value, even if real growth was uneven year to year.");
    }else if(id === "break-even"){
      base.push("Break-even analysis finds the point where total revenue equals total costs. Fixed costs stay the same; variable costs scale with the number of units sold.");
    }else if(id === "profit-margin"){
      base.push("Profit margin measures how much profit remains after costs, expressed as a percentage of revenue. Higher margins generally mean more efficiency or pricing power.");
    }else if(id.endsWith("conversion") || id === "length"){
      base.push("Unit conversions work by converting your input to a base unit, then converting that base into each target unit. The outputs are equivalent values in different units.");
    }else if(id === "password-generator"){
      base.push("Passwords are built from the character types you choose. If your browser supports secure randomness, it is used to generate stronger unpredictable passwords.");
    }else if(id === "random-number"){
      base.push("Random numbers are generated within your min/max range. For integers, the tool returns a whole number; for decimals, it returns a rounded value to your selected decimal places.");
    }else if(id === "gpa"){
      base.push("GPA is computed as a weighted average: each course grade is multiplied by its credits, then divided by the total credits.");
    }else if(id === "age"){
      base.push("Age is computed as the difference between your birth date and the “as of” date, shown in years, months, and days.");
    }else if(id === "day-of-week"){
      base.push("The weekday is computed directly from the calendar date you select.");
    }
    return base;
  }

  function buildResultsExplanation(def, values, results){
    if(!Array.isArray(results) || results.length === 0){
      return [
        "Click “Calculate” to calculate outputs.",
        "If you change any inputs, click “Calculate” again to refresh the numbers."
      ];
    }

    const keySet = visibleFieldKeys(def, values);
    const inputSummary = def.fields
      .filter(f => keySet.has(f.key))
      .map(f => `${f.label}: ${formatInputValue(f, values[f.key])}`)
      .join(" • ");

    const out = [
      inputSummary ? ("Based on your inputs (" + inputSummary + "), the tool produces the results below.") : "Based on your inputs, the tool produces the results below.",
      "Read each result as a specific answer to a question the calculator is designed to solve."
    ];

    results.forEach(r => {
      const label = String(r.label || "Result");
      const value = String(r.value ?? "—");
      out.push(`${label}: ${value}. ${explainResultLabel(label)}`);
    });

    const id = String(def.id || "");
    if(id === "mortgage"){
      out.push("Mortgage results are estimates. Real payments can vary based on lender fees, escrow rules, and local taxes/insurance. For decisions, compare against your official loan estimate.");
    }else if(id === "loan"){
      out.push("Loan results assume a fixed rate and regular monthly payments. If your loan has fees, variable rates, or early payments, the real total interest may differ.");
    }else if(id === "password-generator"){
      out.push("For better security, use longer passwords and include multiple character types. Avoid reusing passwords across accounts.");
    }else if(id === "random-number"){
      out.push("If you need cryptographically secure randomness, use a modern browser that supports secure random generation.");
    }
    return out;
  }

  function buildMathExplanation(def, values){
    const id = String(def.id || "");
    if(id === "mortgage"){
      return [
        "Math (Principal & Interest):",
        "Monthly rate: r = (APR / 100) / 12",
        "Number of payments: n = years × 12",
        "Monthly payment: M = P × (r(1+r)^n) / ((1+r)^n − 1)",
        "Total interest (term): (M × n) − P"
      ];
    }
    if(id === "loan"){
      return [
        "Math:",
        "Monthly rate: r = (APR / 100) / 12",
        "Monthly payment: M = P × (r(1+r)^n) / ((1+r)^n − 1)",
        "Total paid: M × n",
        "Total interest: (M × n) − P"
      ];
    }
    if(id === "compound-interest"){
      return [
        "Math (concept):",
        "Compound growth multiplies your balance by (1 + rate) repeatedly over time.",
        "With periodic compounding, the periodic rate is: periodicRate = (APR / 100) / compoundsPerYear."
      ];
    }
    if(id === "cagr"){
      return [
        "Math:",
        "CAGR = (End / Start)^(1 / years) − 1"
      ];
    }
    if(id === "profit-margin"){
      return [
        "Math:",
        "Profit margin (%) = (Profit / Revenue) × 100"
      ];
    }
    if(id === "break-even"){
      return [
        "Math:",
        "Break-even units = Fixed costs / (Price per unit − Variable cost per unit)"
      ];
    }
    return [
      "Math:",
      "This tool applies standard formulas to your inputs to produce the results."
    ];
  }

  function renderSchedule(def, values, root){
    root.innerHTML = "";
    const id = String(def.id || "");
    let principal = NaN;
    let rate = NaN;
    let months = NaN;
    if(id === "mortgage"){
      const homePrice = Number(values.homePrice);
      const downPayment = Number(values.downPayment);
      principal = homePrice - downPayment;
      rate = Number(values.interestRate);
      months = Number(values.termYears) * 12;
    }else if(id === "loan"){
      principal = Number(values.principal);
      rate = Number(values.interestRate);
      months = Number(values.termMonths);
    }else{
      return;
    }

    const rows = amortizationRows(principal, rate, months);
    if(!rows || rows.length === 0) return;

    const fmtMoney = window.OCCalculators && window.OCCalculators.formatMoney
      ? window.OCCalculators.formatMoney
      : (v => String(v));

    const details = el("details", { class: "schedule" });
    const summary = el("summary", { text: "Amortization Schedule" });
    details.appendChild(summary);

    const wrap = el("div", { class: "schedule-wrap" });
    const table = el("table", { class: "schedule-table" });
    const thead = el("thead");
    const trh = el("tr");
    ["Month","Payment","Principal","Interest","Balance"].forEach(h => trh.appendChild(el("th", { text: h })));
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const frag = document.createDocumentFragment();
    for(let i = 0; i < rows.length; i++){
      const r = rows[i];
      const tr = document.createElement("tr");

      const c1 = document.createElement("td");
      c1.textContent = String(r.month);
      tr.appendChild(c1);

      const c2 = document.createElement("td");
      c2.textContent = String(fmtMoney(r.payment));
      tr.appendChild(c2);

      const c3 = document.createElement("td");
      c3.textContent = String(fmtMoney(r.principal));
      tr.appendChild(c3);

      const c4 = document.createElement("td");
      c4.textContent = String(fmtMoney(r.interest));
      tr.appendChild(c4);

      const c5 = document.createElement("td");
      c5.textContent = String(fmtMoney(r.balance));
      tr.appendChild(c5);

      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
    table.appendChild(tbody);
    wrap.appendChild(table);
    details.appendChild(wrap);
    root.appendChild(details);
  }

  function render(){
    if(!window.OCCalculators) return;
    const toolId = String(getQueryParam("tool") || "").trim();
    const toolSlug = String(getToolSlugFromPath() || "").trim();
    const def = toolId
      ? window.OCCalculators.byId[toolId]
      : (toolSlug && window.OCCalculators.bySlug ? window.OCCalculators.bySlug[toolSlug] : null);
    const shell = document.getElementById("calculator-shell");
    if(!shell) return;

    if(!def){
      setPageSeo(null);
      const crumb = document.getElementById("crumb-current");
      if(crumb) crumb.textContent = "Calculator";
      shell.innerHTML = `<h1 style="margin:0 0 8px;font-size:22px">Calculator not found</h1><p class="muted" style="margin:0">Pick a tool from the calculators list.</p><div style="height:14px"></div><a class="button" href="${toolsListHref()}">Browse calculators</a>`;
      return;
    }

    const proto = location && location.protocol ? String(location.protocol) : "";
    const isHttp = proto === "http:" || proto === "https:";
    if(isHttp && toolId && def.slug){
      const target = String(location.origin || "").replace(/\/$/, "") + `/tools/${encodeURIComponent(def.slug)}/`;
      if(String(location.href || "") !== target){
        location.replace(target);
        return;
      }
    }

    setPageSeo(def);
    const crumb = document.getElementById("crumb-current");
    if(crumb) crumb.textContent = def.name;
    const values = buildValues(def);
    shell.innerHTML = "";

    const head = el("div");
    const headTop = el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between" });
    const left = el("div");
    const title = el("h1", { text: def.name, style: "margin:0 0 6px;font-size:22px;letter-spacing:-0.02em" });
    left.appendChild(title);
    headTop.appendChild(left);

    const right = el("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end" });
    const cat = el("span", { class: "pill", text: def.category });
    right.appendChild(cat);
    headTop.appendChild(right);
    head.appendChild(headTop);


    const seo = (window.OCCalculators && typeof window.OCCalculators.getSeo === "function")
      ? window.OCCalculators.getSeo(def)
      : null;
    try{
      const origin = String(location.origin || "").replace(/\/$/, "");
      const canonical = (window.OCCalculators && typeof window.OCCalculators.canonicalUrlForTool === "function")
        ? window.OCCalculators.canonicalUrlForTool(def)
        : (origin + "/calculator");
      const crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": origin + "/" },
          { "@type": "ListItem", "position": 2, "name": "Tools", "item": origin + "/tools" },
          { "@type": "ListItem", "position": 3, "name": String(def.name || "Calculator"), "item": canonical }
        ]
      };
      if(window.OCHelpers && typeof window.OCHelpers.setJsonLd === "function"){
        window.OCHelpers.setJsonLd("schema-calc-breadcrumbs", crumbs);
      }
    }catch(_e){
    }

    const topAd = document.getElementById("ad-calculator-top");
    if(topAd && window.OCHelpers && typeof window.OCHelpers.renderAdInto === "function"){
      window.OCHelpers.renderAdInto(topAd, "calculator_top", { format: "auto" });
    }


    const layout = el("div", { class: "calc-layout", style: "margin-top:14px" });
    const leftPanel = el("div");
    const adPanel = el("aside", { class: "ad-panel" });
    const sidebarAd = el("div", { class: "ad-slot", id: "ad-calculator-sidebar" });
    adPanel.appendChild(sidebarAd);
    if(sidebarAd && window.OCHelpers && typeof window.OCHelpers.renderAdInto === "function"){
      window.OCHelpers.renderAdInto(sidebarAd, "calculator_sidebar", { format: "auto" });
    }

    const inputsPanel = el("section", { class: "panel" });
    inputsPanel.appendChild(el("h2", { text: "Inputs", style: "margin:0 0 10px;font-size:16px" }));
    const form = el("form", { class: "form", id: "calc-form" });
    const fieldRefs = [];
    def.fields.forEach(f => {
      const rendered = renderField(f, values[f.key]);
      fieldRefs.push({ field: f, input: rendered.input, wrapper: rendered.wrapper });
      form.appendChild(rendered.wrapper);
    });
    const submitRow = el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center" });
    const showBtn = el("button", { class: "button primary", type: "submit", text: "Calculate" });
    const note = el("span", { class: "hint", text: "Results appear below after you click Calculate." });
    submitRow.appendChild(showBtn);
    submitRow.appendChild(note);
    form.appendChild(submitRow);
    inputsPanel.appendChild(form);
    leftPanel.appendChild(inputsPanel);

    const resultsPanel = el("section", { class: "panel", style: "margin-top:14px" });
    resultsPanel.appendChild(el("h2", { text: "Results", style: "margin:0 0 10px;font-size:16px" }));
    const resultsRoot = el("div", { class: "results", id: "calc-results" });
    resultsPanel.appendChild(resultsRoot);
    leftPanel.appendChild(resultsPanel);

    const explainRoot = el("div", { class: "explain", style: "margin-top:14px" });
    leftPanel.appendChild(explainRoot);

    const schedulePanel = el("section", { class: "panel", style: "margin-top:12px" });
    const schedRoot = el("div");
    schedulePanel.appendChild(schedRoot);
    leftPanel.appendChild(schedulePanel);

    const relatedPanel = el("section", { style: "margin-top:14px" });
    relatedPanel.appendChild(el("h2", { text: "Related tools", style: "margin:0 0 10px;font-size:16px" }));
    const relatedGrid = el("div", { class: "grid", style: "grid-template-columns:1fr;gap:8px" });
    const related = (window.OCCalculators && typeof window.OCCalculators.getRelated === "function")
      ? window.OCCalculators.getRelated(def, 6)
      : [];
    related.slice(0, 6).forEach(c => {
      const href = (window.OCCalculators && typeof window.OCCalculators.urlForTool === "function")
        ? window.OCCalculators.urlForTool(c)
        : ("calculator.html?tool=" + encodeURIComponent(c.id));
      const a = el("a", { href });
      a.textContent = String(c.name || "");
      relatedGrid.appendChild(a);
    });
    relatedPanel.appendChild(relatedGrid);
    leftPanel.appendChild(relatedPanel);

    // FAQ section removed per request

    const bottomAd = el("div", { id: "ad-calculator-bottom", class: "ad-slot", style: "margin-top:14px" });
    leftPanel.appendChild(bottomAd);
    if(bottomAd && window.OCHelpers && typeof window.OCHelpers.renderAdInto === "function"){
      window.OCHelpers.renderAdInto(bottomAd, "calculator_bottom", { format: "auto" });
    }

    layout.appendChild(leftPanel);
    layout.appendChild(adPanel);

    shell.appendChild(head);
    shell.appendChild(layout);
    // Dynamically render content if available in calculator-content.js
    if (window.OCContent && window.OCContent[def.id]) {
      const contentList = window.OCContent[def.id];
      const blog = el("section", { class: "prose", style: "margin-top:14px" });
      contentList.forEach(item => {
        const props = {};
        if (item.text) props.text = item.text;
        if (item.html) props.html = item.html;
        blog.appendChild(el(item.tag, props));
      });
      leftPanel.insertBefore(blog, relatedPanel);
    }

    function computeAndRender(){
      const prevText = showBtn.textContent;
      showBtn.disabled = true;
      showBtn.textContent = "Calculating…";
      resultsRoot.innerHTML = `<div class="muted">Calculating…</div>`;
      explainRoot.innerHTML = "";
      schedRoot.innerHTML = "";

      requestAnimationFrame(() => {
        window.setTimeout(() => {
          try{
            const results = def.compute(values);
            renderResults(results, resultsRoot);
            applyVisibility(def, values, form);
            renderParagraphs(
              [...buildResultsExplanation(def, values, results), ...buildMathExplanation(def, values)],
              explainRoot
            );
            renderSchedule(def, values, schedRoot);
          }catch(err){
            resultsRoot.innerHTML = `<div class="muted">Could not calculate results. Please check your inputs.</div>`;
            explainRoot.innerHTML = "";
            schedRoot.innerHTML = "";
          }finally{
            showBtn.disabled = false;
            showBtn.textContent = prevText || "Calculate";
          }
        }, 0);
      });
    }


    function syncInput(key, raw){
      values[key] = raw;
    }

    fieldRefs.forEach(({ field, input }) => {
      const evt = field.type === "select" ? "change" : "input";
      input.addEventListener(evt, () => syncInput(field.key, input.value));
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      computeAndRender();
    });

    renderResults([], resultsRoot);
    applyVisibility(def, values, form);
    renderParagraphs(
      [...buildResultsExplanation(def, values, []), ...buildMathExplanation(def, values)],
      explainRoot
    );
    renderSchedule(def, values, schedRoot);
  }

  document.addEventListener("DOMContentLoaded", render);
})();
