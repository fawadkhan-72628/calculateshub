(function(){
  function slug(s){
    return String(s || "").toLowerCase().replace(/\s+/g, "-");
  }

  function el(tag, attrs){
    const node = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([k,v]) => {
        if(k === "text") node.textContent = String(v);
        else node.setAttribute(k, String(v));
      });
    }
    return node;
  }

  const TAXONOMY = [
    {
      category: "Financial",
      subs: [
        { name: "Loans & Credit", calculators: [
          "Mortgage Calculator",
          "Loan Payment Calculator",
          "Auto Loan Calculator",
          "Refinance Calculator",
          "Amortization Schedule Calculator",
          "Credit Card Interest Calculator",
          "Credit Card Minimum Payment Calculator",
          "Loan Eligibility Calculator"
        ]},
        { name: "Savings & Investments", calculators: [
          "Compound Interest Calculator",
          "Simple Interest Calculator",
          "Savings Calculator",
          "CAGR Calculator",
          "Return on Investment (ROI) Calculator",
          "Retirement Savings Calculator"
        ]},
        { name: "Personal Finance & Planning", calculators: [
          "Net Worth Calculator",
          "Debt Snowball Calculator",
          "Debt Avalanche Calculator",
          "Emergency Fund Calculator"
        ]},
        { name: "Economic Factors", calculators: [
          "Inflation Calculator"
        ]}
      ]
    },
    {
      category: "Business",
      subs: [
        { name: "Profitability & Margins", calculators: [
          "Profit Margin Calculator",
          "Gross Profit Calculator",
          "Net Profit Calculator",
          "Operating Margin Calculator",
          "Markup Calculator"
        ]},
        { name: "Costs & Pricing", calculators: [
          "Break-Even Calculator",
          "Cost Per Unit Calculator",
          "Discount Calculator",
          "Commission Calculator"
        ]},
        { name: "Financial Health", calculators: [
          "Cash Ratio Calculator",
          "Working Capital Calculator"
        ]},
        { name: "Taxes", calculators: [
          "Goods and Services Tax (GST) Calculator",
          "Sales Tax Calculator",
          "Value-Added Tax (VAT) Calculator"
        ]},
        { name: "Growth Metrics", calculators: [
          "Revenue Growth Rate Calculator",
          "Customer Lifetime Value (CLV) Calculator"
        ]}
      ]
    },
    {
      category: "E-commerce",
      subs: [
        { name: "Marketing & Advertising Metrics", calculators: [
          "Return on Ad Spend (ROAS) Calculator",
          "Advertising Cost of Sales (ACoS) Calculator",
          "Break-Even ROAS Calculator",
          "Email Marketing ROI Calculator",
          "Click-Through Rate (CTR) Calculator",
          "Cost Per Click (CPC) Calculator",
          "Cost Per Mille (CPM) Calculator",
          "Influencer ROI Calculator"
        ]},
        { name: "Sales & Conversion Metrics", calculators: [
          "E-commerce Conversion Rate Calculator",
          "Cart Abandonment Rate Calculator",
          "Average Order Value (AOV) Calculator",
          "Refund Rate Calculator"
        ]},
        { name: "Customer Metrics", calculators: [
          "Customer Acquisition Cost (CAC) Calculator",
          "Customer Retention Rate Calculator",
          "Churn Rate Calculator",
          "Subscription MRR Calculator",
          "Subscription ARPU Calculator"
        ]},
        { name: "Pricing & Fees", calculators: [
          "Profit Per Order Calculator",
          "Price for Target Margin Calculator",
          "Marketplace Fee Calculator",
          "Payment Processing Fee Calculator",
          "Landed Cost Calculator"
        ]},
        { name: "Inventory Management", calculators: [
          "Inventory Turnover Calculator",
          "Reorder Point Calculator",
          "Days of Inventory Calculator"
        ]}
      ]
    },
    {
      category: "Math",
      subs: [
        { name: "Basic Math", calculators: [
          "Square Root Calculator",
          "Power Calculator (x^y)",
          "Factorial Calculator"
        ]},
        { name: "Percentages & Statistics", calculators: [
          "Percentage Calculator",
          "Percentage Change Calculator",
          "Mean, Median, Mode Calculator",
          "Standard Deviation Calculator"
        ]},
        { name: "Number Theory", calculators: [
          "Prime Number Checker",
          "Least Common Multiple (LCM) Calculator"
        ]},
        { name: "Fractions & Rounding", calculators: [
          "Fraction Simplifier",
          "Rounding Numbers Calculator"
        ]}
      ]
    },
    {
      category: "Conversions",
      subs: [
        { name: "Unit Conversions", calculators: [
          "Temperature Conversion",
          "Length Conversion",
          "Area Conversion",
          "Volume Conversion",
          "Weight Conversion",
          "Pressure Conversion",
          "Time Conversion",
          "Speed Conversion Calculator",
          "Energy Conversion Calculator",
          "Angle Conversion (Degrees ↔ Radians)"
        ]},
        { name: "Number Conversions", calculators: [
          "Decimal to Fraction Calculator",
          "Decimal to Percent Calculator",
          "Fraction to Decimal Calculator",
          "Fraction to Percent Calculator",
          "Percent to Decimal Calculator",
          "Percent to Fraction Calculator",
          "Roman Numeral Converter"
        ]},
        { name: "Specialized Conversions", calculators: [
          "Currency Converter (USD ↔ CAD)",
          "Fuel Efficiency Converter (MPG ↔ L/100km)",
          "Data Storage Converter (KB to TB)"
        ]}
      ]
    },
    {
      category: "Miscellaneous",
      subs: [
        { name: "Health & Fitness", calculators: [
          "BMI Calculator",
          "BMR Calculator"
        ]},
        { name: "Date & Time", calculators: [
          "Age Calculator",
          "Day of the Week Calculator",
          "Date Difference Calculator",
          "Time Zone Converter (US & Canada)"
        ]},
        { name: "Utilities", calculators: [
          "Tip Calculator",
          "Grade Point Average (GPA) Calculator",
          "Password Generator",
          "Random Number Generator"
        ]}
      ]
    }
  ];

  function card(calc){
    const href = (window.OCCalculators && window.OCCalculators.urlForTool) ? window.OCCalculators.urlForTool(calc) : ("calculator.html?tool=" + encodeURIComponent(calc.id));
    const a = el("a", { href });
    a.textContent = String(calc.name || "");
    return a;
  }

  function renderDirectory(filterText){
    const root = document.getElementById("directory-root");
    if(!root || !window.OCCalculators) return;
    const list = window.OCCalculators.list.slice();
    const text = String(filterText || "").trim().toLowerCase();
    const hash = String(location.hash || "").replace(/^#/, "").trim().toLowerCase();
    const parts = hash ? hash.split("/").filter(Boolean) : [];
    const catFilter = parts[0] || "";
    const subFilter = parts[1] || "";
    function findCalcByName(name){
      const n = String(name || "").toLowerCase();
      return list.find(c => String(c.name || "").toLowerCase() === n);
    }
    function matchesSearch(name){
      if(!text) return true;
      return String(name || "").toLowerCase().includes(text);
    }

    root.innerHTML = "";
    TAXONOMY.forEach(group => {
      const catSlug = slug(group.category);
      if(catFilter && catFilter !== catSlug) return;
      const section = el("section", { class: "section", id: catSlug });
      const head = el("div", { class: "section-head" });
      const left = el("div");
      left.appendChild(el("h2", { text: group.category }));
      left.appendChild(el("p", { text: (group.subs || []).length + " sub-categories" }));
      head.appendChild(left);
      section.appendChild(head);

      (group.subs || []).forEach(sub => {
        const subSlug = slug(sub.name);
        if(subFilter && subFilter !== subSlug) return;
        const subWrap = el("div", { style: "margin-top:10px" });
        const subHead = el("div", { class: "section-head" });
        const subLeft = el("div");
        subLeft.appendChild(el("h2", { text: sub.name }));
        const subLink = el("a", { href: "#" + catSlug + "/" + subSlug, class: "muted" });
        subLink.textContent = "Filter";
        subHead.appendChild(subLeft);
        subHead.appendChild(subLink);
        subWrap.appendChild(subHead);
        const grid = el("div", { class: "grid", style: "grid-template-columns:1fr" });
        sub.calculators.forEach(n => {
          if(!matchesSearch(n)) return;
          const calc = findCalcByName(n);
          if(!calc) return;
          grid.appendChild(card(calc));
        });
        if(grid.children.length === 0) return;
        subWrap.appendChild(grid);
        section.appendChild(subWrap);
      });
      root.appendChild(section);
    });
    if(!root.children.length){
      const empty = el("div", { class: "panel", style: "margin-top:14px" });
      empty.appendChild(el("h2", { text: "No tools found" }));
      empty.appendChild(el("p", { class: "muted", text: "Try a different search, clear filters, or pick another category." }));
      const actions = el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin-top:10px" });
      const clear = el("button", { class: "button", type: "button" });
      clear.textContent = "Clear filters";
      clear.addEventListener("click", () => {
        const input = document.getElementById("calc-search");
        if(input) input.value = "";
        if(location.hash) history.replaceState(null, "", location.pathname + location.search);
        renderDirectory("");
        const btn = document.getElementById("calc-search-clear");
        if(btn) btn.hidden = true;
        if(input) input.focus();
      });
      actions.appendChild(clear);
      empty.appendChild(actions);
      root.appendChild(empty);
    }
  }

  function wireSearch(){
    const input = document.getElementById("calc-search");
    if(!input) return;
    const clearBtn = document.getElementById("calc-search-clear");
    let t = null;
    function syncClear(){
      if(!clearBtn) return;
      clearBtn.hidden = !String(input.value || "").trim();
    }
    function update(){
      window.clearTimeout(t);
      t = window.setTimeout(() => renderDirectory(input.value), 80);
      syncClear();
    }
    input.addEventListener("input", () => {
      update();
    });
    input.addEventListener("keydown", (e) => {
      if(e.key === "Escape"){
        input.value = "";
        renderDirectory("");
        syncClear();
      }
    });
    if(clearBtn){
      clearBtn.addEventListener("click", () => {
        input.value = "";
        renderDirectory("");
        input.focus();
        syncClear();
      });
    }
    syncClear();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(location.search);
    const q = String(params.get("q") || "");
    const input = document.getElementById("calc-search");
    if(input && q){ input.value = q; }
    renderDirectory(q);
    wireSearch();
    function toggleHead(){
      const head = document.getElementById("tools-head");
      const intro = document.getElementById("tools-intro");
      const chips = document.getElementById("tools-chips");
      const hash = String(location.hash || "").replace(/^#/, "").trim();
      const hasQuery = !!String(new URLSearchParams(location.search).get("q") || "").trim();
      const hide = !!hash || hasQuery;
      if(intro){ intro.style.display = hide ? "none" : ""; }
      if(chips){ chips.style.display = hide ? "none" : ""; }
      if(head){ head.style.display = ""; }
      const adTop = document.getElementById("ad-directory-top");
      if(adTop){ adTop.style.display = hide ? "none" : ""; }
      const hint = document.querySelector("#tools-head .hint");
      if(hint){ hint.style.display = hide ? "none" : ""; }
    }
    toggleHead();
    const topAd = document.getElementById("ad-directory-top");
    if(topAd && window.OCHelpers && typeof window.OCHelpers.renderAdInto === "function"){
      window.OCHelpers.renderAdInto(topAd, "directory_top", { format: "auto" });
    }
    if(window.OCHelpers && typeof window.OCHelpers.setSeoMeta === "function"){
      const proto = location && location.protocol ? String(location.protocol) : "";
      const isHttp = proto === "http:" || proto === "https:";
      const canonicalUrl = isHttp ? (String(location.origin || "").replace(/\/$/, "") + "/tools") : "";
      window.OCHelpers.setSeoMeta({
        title: "All Calculators by Category | calculateshub",
        description: "Browse calculators by category and search tools to find the right calculator fast.",
        canonicalUrl
      });
      try{
        const origin = String(location.origin || "").replace(/\/$/, "");
        const list = (window.OCCalculators && Array.isArray(window.OCCalculators.list)) ? window.OCCalculators.list.slice(0, 50) : [];
        const items = list.map((c, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "name": String(c.name || "Calculator"),
          "url": (window.OCCalculators && typeof window.OCCalculators.canonicalUrlForTool === "function")
            ? window.OCCalculators.canonicalUrlForTool(c)
            : (origin + "/tools")
        }));
        const itemList = { "@context": "https://schema.org", "@type": "ItemList", "itemListElement": items };
        window.OCHelpers.setJsonLd("schema-itemlist", itemList);
        const crumbs = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": origin + "/" },
            { "@type": "ListItem", "position": 2, "name": "Tools", "item": origin + "/tools" }
          ]
        };
        window.OCHelpers.setJsonLd("schema-tools-breadcrumbs", crumbs);
        const catBase = origin + "/tools";
        const catItems = (TAXONOMY || []).map((group, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "name": String(group.category || ""),
          "url": catBase + "#" + slug(group.category)
        }));
        const categoriesList = { "@context": "https://schema.org", "@type": "ItemList", "itemListElement": catItems };
        window.OCHelpers.setJsonLd("schema-categories", categoriesList);
        (TAXONOMY || []).forEach(group => {
          const catSlug = slug(group.category);
          const subs = (group.subs || []);
          const subItems = subs.map((sub, j) => ({
            "@type": "ListItem",
            "position": j + 1,
            "name": String(sub.name || ""),
            "url": catBase + "#" + catSlug + "/" + slug(sub.name)
          }));
          const subList = { "@context": "https://schema.org", "@type": "ItemList", "itemListElement": subItems };
          window.OCHelpers.setJsonLd("schema-subcategories-" + catSlug, subList);
        });
      }catch(_e){
      }
    }
    window.addEventListener("hashchange", () => {
      const input = document.getElementById("calc-search");
      renderDirectory(input ? input.value : "");
      toggleHead();
    });
    window.addEventListener("popstate", () => {
      const input = document.getElementById("calc-search");
      const q = String(new URLSearchParams(location.search).get("q") || "");
      if(input) input.value = q;
      renderDirectory(q || (input ? input.value : ""));
      toggleHead();
    });
  });
})();
