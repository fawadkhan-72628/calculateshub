(function(){
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

  function card(calc){
    const href = (window.OCCalculators && window.OCCalculators.urlForTool) ? window.OCCalculators.urlForTool(calc) : ("calculator.html?tool=" + encodeURIComponent(calc.id));
    const a = el("a", { href });
    a.textContent = String(calc.name || "");
    return a;
  }

  function render(){
    if(!window.OCCalculators) return;
    const list = window.OCCalculators.list.slice();
    const quickRoot = document.getElementById("quick-pick");
    if(quickRoot){
      quickRoot.innerHTML = "";
      const proto = location && location.protocol ? String(location.protocol) : "";
      const isHttp = proto === "http:" || proto === "https:";
      const a = el("a", { class: "button", href: isHttp ? "/tools" : "calculators.html" });
      a.textContent = "View all";
      quickRoot.appendChild(a);
    }

    const popularRoot = document.getElementById("popular-grid");
    if(popularRoot){
      popularRoot.innerHTML = "";
      const popular = list.filter(c => c.popular).slice(0, 6);
      const picks = popular.length ? popular : list.slice(0, 6);
      picks.forEach(c => popularRoot.appendChild(card(c)));
    }

    const latestRoot = document.getElementById("latest-grid");
    if(latestRoot){
      latestRoot.innerHTML = "";
      const latest = list
        .filter(c => c.addedAt)
        .slice()
        .sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)))
        .slice(0, 6);
      const picks = latest.length ? latest : list.slice(0, 6);
      picks.forEach(c => latestRoot.appendChild(card(c)));
    }

    const topAd = document.getElementById("ad-home-top");
    if(topAd && window.OCHelpers && typeof window.OCHelpers.renderAdInto === "function"){
      window.OCHelpers.renderAdInto(topAd, "home_top", { format: "auto" });
    }

    if(window.OCHelpers && typeof window.OCHelpers.setSeoMeta === "function"){
      const proto = location && location.protocol ? String(location.protocol) : "";
      const isHttp = proto === "http:" || proto === "https:";
      const canonicalUrl = isHttp ? (String(location.origin || "").replace(/\/$/, "") + "/") : "";
      window.OCHelpers.setSeoMeta({
        title: "calculateshub | Free Online Calculators",
        description: "Fast, mobile-friendly calculators across finance, business, math, conversions, and more.",
        canonicalUrl
      });
    }

    function wireHomeSearch(){
      const input = document.getElementById("home-search");
      const go = document.getElementById("home-search-go");
      if(!input || !go) return;
      function navigate(){
        const q = String(input.value || "").trim();
        const proto = location && location.protocol ? String(location.protocol) : "";
        const isHttp = proto === "http:" || proto === "https:";
        const base = isHttp ? "/tools" : "calculators.html";
        const url = q ? (base + "?q=" + encodeURIComponent(q)) : base;
        location.href = url;
      }
      go.addEventListener("click", navigate);
      input.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){ e.preventDefault(); navigate(); }
      });
    }

    wireHomeSearch();
  }

  document.addEventListener("DOMContentLoaded", render);
})();
