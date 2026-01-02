(function(){
  function qs(sel, root){
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function setMetaByName(name, content){
    if(!name) return;
    const c = String(content == null ? "" : content);
    let el = qs(`meta[name="${CSS.escape(name)}"]`);
    if(!el){
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", c);
  }

  function setMetaByProperty(prop, content){
    if(!prop) return;
    const c = String(content == null ? "" : content);
    let el = qs(`meta[property="${CSS.escape(prop)}"]`);
    if(!el){
      el = document.createElement("meta");
      el.setAttribute("property", prop);
      document.head.appendChild(el);
    }
    el.setAttribute("content", c);
  }

  function setCanonical(url){
    const href = String(url || "").trim();
    if(!href) return;
    let link = qs('link[rel="canonical"]');
    if(!link){
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
  }

  function setJsonLd(id, obj){
    const key = String(id || "").trim() || "oc-jsonld";
    let script = qs(`script[type="application/ld+json"][data-jsonld="${CSS.escape(key)}"]`);
    if(!script){
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-jsonld", key);
      document.head.appendChild(script);
    }
    script.text = JSON.stringify(obj);
  }

  function setSeoMeta({ title, description, canonicalUrl }){
    const site = "calculateshub";
    const t = String(title || "").trim() || site;
    const d = String(description || "").trim();
    document.title = t;
    if(d) setMetaByName("description", d);
    if(canonicalUrl) setCanonical(canonicalUrl);
    setMetaByProperty("og:site_name", site);
    setMetaByProperty("og:title", t);
    if(d) setMetaByProperty("og:description", d);
    if(canonicalUrl) setMetaByProperty("og:url", canonicalUrl);
    setMetaByProperty("og:type", "website");
    setMetaByName("twitter:card", "summary");
    setMetaByName("twitter:title", t);
    if(d) setMetaByName("twitter:description", d);
  }

  function isHttp(){
    const proto = location && location.protocol ? String(location.protocol) : "";
    return proto === "http:" || proto === "https:";
  }

  function getActiveKey(){
    if(!isHttp()) return getCurrentFile();
    const path = String(location.pathname || "/");
    if(path === "/" || path === "" || /\/index\.html$/i.test(path)) return "home";
    if(/^\/tools(\/|$)/i.test(path)) return "tools";
    if(/^\/about(\/|$)/i.test(path)) return "about";
    if(/^\/faq(\/|$)/i.test(path)) return "faq";
    if(/^\/contact(\/|$)/i.test(path)) return "contact";
    if(/^\/privacy(\/|$)/i.test(path)) return "privacy";
    if(/^\/terms(\/|$)/i.test(path)) return "terms";
    if(/^\/disclaimer(\/|$)/i.test(path)) return "disclaimer";
    return "";
  }

  function getCurrentFile(){
    const p = location.pathname.split("/").pop();
    return p || "index.html";
  }

  function prefixToRoot(){
    const parts = String(location.pathname || "").split("/").filter(Boolean);
    if(parts[0] !== "tools") return "";
    return "../".repeat(parts.length);
  }

  function getQueryParam(key){
    const params = new URLSearchParams(location.search);
    return params.get(key);
  }

  function setActiveNav(){
    const key = getActiveKey();
    const links = qsa('a[data-nav]');
    links.forEach(a => a.removeAttribute("aria-current"));
    const active = links.find(a => String(a.getAttribute("data-nav") || "") === String(key || "")) || null;
    if(active) active.setAttribute("aria-current", "page");
  }

  function toast(message){
    let el = qs("#oc-toast");
    if(!el){
      el = document.createElement("div");
      el.id = "oc-toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    window.clearTimeout(el._t);
    el._t = window.setTimeout(() => el.classList.remove("show"), 2600);
  }

  function headerHtml(){
    const pre = prefixToRoot();
    const http = isHttp();
    const homeHref = http ? "/" : (pre + "index.html");
    const toolsHref = http ? "/tools" : (pre + "calculators.html");
    const catHref = (slug) => http ? (`/tools#${slug}`) : (pre + `calculators.html#${slug}`);
    const slugifyLocal = (s) => (window.OCCalculators && typeof window.OCCalculators.slugify === "function")
      ? window.OCCalculators.slugify(s)
      : String(s || "").toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const subsMap = {
      "financial": ["Loans & Credit", "Savings & Investments", "Personal Finance & Planning", "Economic Factors"],
      "business": ["Profitability & Margins", "Costs & Pricing", "Financial Health", "Taxes", "Growth Metrics"],
      "e-commerce": ["Marketing & Advertising Metrics", "Sales & Conversion Metrics", "Customer Metrics", "Pricing & Fees", "Inventory Management"],
      "math": ["Basic Math", "Percentages & Statistics", "Number Theory", "Fractions & Rounding"],
      "conversions": ["Unit Conversions", "Number Conversions", "Specialized Conversions"],
      "miscellaneous": ["Health & Fitness", "Date & Time", "Utilities"]
    };
    const subLinksHtml = (catKey) => {
      const items = subsMap[catKey] || [];
      if(!items.length) return "";
      const base = http ? "/tools" : (pre + "calculators.html");
      return `<div class="nav-dropdown">${
        items.map(n => {
          const subSlug = slugifyLocal(n);
          const href = `${base}#${catKey}/${subSlug}`;
          return `<a href="${href}">${n}</a>`;
        }).join("")
      }</div>`;
    };
    const pageHref = (path, file) => http ? path : (pre + file);
    const menuLinks = [
      { href: homeHref, label: "Home", nav: "home" },
      { href: toolsHref, label: "Tools", nav: "tools" },
      { href: catHref("financial"), label: "Financial" },
      { href: catHref("business"), label: "Business" },
      { href: catHref("e-commerce"), label: "E-commerce" },
      { href: catHref("math"), label: "Math" },
      { href: catHref("conversions"), label: "Conversions" },
      { href: catHref("miscellaneous"), label: "Miscellaneous" },
      { href: pageHref("/faq", "faq.html"), label: "FAQ", nav: "faq" },
      { href: pageHref("/contact", "contact.html"), label: "Contact", nav: "contact" }
    ];

    const desktopLinks = menuLinks.slice(0, 7);
    const mobileLinks = menuLinks;

    return `
      <header class="topbar">
        <style>
          .nav .nav-links{display:flex;gap:12px;align-items:center}
          .nav .has-dropdown{position:relative}
          .nav .has-dropdown>a{display:inline-block}
          .nav .nav-dropdown{position:absolute;top:100%;left:0;display:none;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.12);padding:8px 0;min-width:220px;z-index:1000}
          .nav .has-dropdown:hover .nav-dropdown{display:block}
          .nav .nav-dropdown a{display:block;padding:8px 14px;color:inherit;text-decoration:none;white-space:nowrap}
          .nav .nav-dropdown a:hover{background:#f8fafc}
        </style>
        <a class="skip-link" href="#main">Skip to content</a>
        <div class="container">
          <div class="topbar-inner">
            <a class="brand" href="${homeHref}" data-nav="home">
              <img class="brand-logo" src="${pre}favicon.svg" alt="calculateshub" onload="this.nextElementSibling.style.display='none'" onerror="this.style.display='none'" />
              <span class="brand-badge" aria-hidden="true"></span>
              <span>calculateshub</span>
            </a>
            <nav class="nav" aria-label="Primary">
              <div class="nav-links">
                ${desktopLinks.map(l => {
                  const key = l.label.toLowerCase();
                  const isCat = key === "financial" || key === "business" || key === "e-commerce" || key === "math" || key === "conversions";
                  if(isCat){
                    return `<div class="has-dropdown"><a href="${l.href}">${l.label}</a>${subLinksHtml(key)}</div>`;
                  }
                  return `<a href="${l.href}" ${l.nav ? `data-nav="${l.nav}"` : ""}>${l.label}</a>`;
                }).join("")}
              </div>
              <div class="nav-right">
                <button class="button menu-button" type="button" aria-label="Menu" data-action="menu">Menu</button>
              </div>
            </nav>
          </div>
          <div class="mobile-drawer" id="oc-mobile-drawer">
            <div class="mobile-links">
              ${mobileLinks.map(l => `<a href="${l.href}">${l.label}</a>`).join("")}
            </div>
          </div>
        </div>
      </header>
    `;
  }

  function footerHtml(){
    const pre = prefixToRoot();
    const http = isHttp();
    const pageHref = (path, file) => http ? path : (pre + file);
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <h4>calculateshub</h4>
              <p>Fast, mobile-friendly calculators across finance, business, math, and conversions.</p>
            </div>
            <div>
              <h4>Pages</h4>
              <div class="footer-links">
                <a href="${pageHref("/about", "about.html")}">About</a>
                <a href="${pageHref("/faq", "faq.html")}">FAQ</a>
                <a href="${pageHref("/contact", "contact.html")}">Contact</a>
              </div>
            </div>
            <div>
              <h4>Legal</h4>
              <div class="footer-links">
                <a href="${pageHref("/privacy", "privacy.html")}">Privacy Policy</a>
                <a href="${pageHref("/terms", "terms.html")}">Terms of Service</a>
                <a href="${pageHref("/disclaimer", "disclaimer.html")}">Disclaimer</a>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} calculateshub</span>
            <span>Estimates only. Always verify critical numbers.</span>
          </div>
        </div>
      </footer>
    `;
  }

  function mountShell(){
    const headerRoot = qs("#site-header");
    const footerRoot = qs("#site-footer");
    if(headerRoot) headerRoot.innerHTML = headerHtml();
    if(footerRoot) footerRoot.innerHTML = footerHtml();
    setActiveNav();
    const cfg = getAdConfig();
    ensureAdSenseScript(cfg.client);
    if(isHttp()){
      const origin = String(location.origin || "").replace(/\/$/, "");
      let path = String(location.pathname || "");
      if(/\/index\.html$/i.test(path)) path = "/";
      else if(/\/calculators\.html$/i.test(path)) path = "/tools";
      else if(/\/calculator\.html$/i.test(path)) path = "/calculator";
      else if(/\/(about|contact|faq|privacy|terms|disclaimer)\.html$/i.test(path)){
        path = path.replace(/\/(about|contact|faq|privacy|terms|disclaimer)\.html$/i, "/$1");
      }
      const url = origin + path;
      setCanonical(url);
      try{
        const website = {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "calculateshub",
          "url": origin + "/",
          "potentialAction": {
            "@type": "SearchAction",
            "target": origin + "/tools?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        };
        setJsonLd("schema-website", website);
        const org = {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "calculateshub",
          "url": origin + "/",
          "logo": origin + "/favicon.svg"
        };
        setJsonLd("schema-org", org);
        const key = getActiveKey();
        const page = {
          "@context": "https://schema.org",
          "@type": key === "about" ? "AboutPage" : key === "contact" ? "ContactPage" : key === "faq" ? "FAQPage" : "WebPage",
          "name": document.title,
          "url": url
        };
        setJsonLd("schema-page", page);
        if(key === "faq"){
          const faq = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "Are the results accurate?", "acceptedAnswer": { "@type": "Answer", "text": "Calculators provide estimates based on standard formulas. Confirm important decisions with official sources or a professional." } },
              { "@type": "Question", "name": "How are calculators built?", "acceptedAnswer": { "@type": "Answer", "text": "Each calculator uses standard formulas and updates instantly when you calculate results." } },
              { "@type": "Question", "name": "Do you store my inputs?", "acceptedAnswer": { "@type": "Answer", "text": "Inputs and results are computed in your browser and are not sent to a server." } },
              { "@type": "Question", "name": "Can I request a new calculator?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Use the contact page to send an idea for a new calculator or report an issue." } }
            ]
          };
          setJsonLd("schema-faq", faq);
        }
      }catch(_e){
      }
    }

    const drawer = qs("#oc-mobile-drawer");
    const menuBtn = qs('[data-action="menu"]');
    if(menuBtn && drawer){
      function setOpen(next){
        drawer.classList.toggle("open", next);
        menuBtn.setAttribute("aria-expanded", next ? "true" : "false");
      }
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setOpen(!drawer.classList.contains("open"));
      });
      drawer.addEventListener("click", (e) => {
        const a = e.target && e.target.closest ? e.target.closest("a") : null;
        if(a) setOpen(false);
      });
      document.addEventListener("click", (e) => {
        if(!drawer.classList.contains("open")) return;
        const t = e.target;
        if(t === menuBtn || (menuBtn.contains && menuBtn.contains(t))) return;
        if(t === drawer || (drawer.contains && drawer.contains(t))) return;
        setOpen(false);
      });
    }
  }

  function getAdConfig(){
    const meta = qs('meta[name="google-adsense-account"]');
    const client = String(meta && meta.getAttribute("content") ? meta.getAttribute("content") : "").trim();
    const validClient = client.startsWith("ca-pub-") ? client : "";
    const slots = (window.OCAdConfig && window.OCAdConfig.slots) ? window.OCAdConfig.slots : {};
    return { client: (window.OCAdConfig && window.OCAdConfig.client ? window.OCAdConfig.client : validClient), slots };
  }

  function ensureAdSenseScript(clientId){
    const client = String(clientId || "").trim();
    if(!client) return false;
    if(qs('script[data-adsense="true"]')) return true;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-adsense", "true");
    document.head.appendChild(s);
    return true;
  }

  function renderAdInto(root, slotKey, options){
    const host = root;
    if(!host) return;
    const { client, slots } = getAdConfig();
    const slot = slots && slotKey ? String(slots[slotKey] || "").trim() : "";
    if(!(client && slot)){
      host.innerHTML = "";
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.innerHTML = "";
    const label = document.createElement("div");
    label.className = "ad-label";
    label.textContent = "Advertisement";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", slot);
    ins.setAttribute("data-full-width-responsive", "true");
    ins.setAttribute("data-ad-format", (options && options.format) ? String(options.format) : "auto");
    host.appendChild(label);
    host.appendChild(ins);
    ensureAdSenseScript(client);
    try{
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    }catch(_e){
    }
  }

  window.OCHelpers = { toast, getQueryParam, setSeoMeta, setJsonLd, renderAdInto };

  document.addEventListener("DOMContentLoaded", mountShell);
})();
