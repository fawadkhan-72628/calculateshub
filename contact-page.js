(function(){
  function buildMailto(name, email, message){
    const subject = encodeURIComponent("calculateshub — Contact");
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    return `mailto:contact@example.com?subject=${subject}&body=${body}`;
  }

  function wire(){
    const form = document.getElementById("contact-form");
    const copyBtn = document.getElementById("contact-copy");
    if(!form) return;

    function getValues(){
      const name = document.getElementById("c-name")?.value || "";
      const email = document.getElementById("c-email")?.value || "";
      const message = document.getElementById("c-message")?.value || "";
      return { name, email, message };
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const { name, email, message } = getValues();
      const mailto = buildMailto(name, email, message);
      location.href = mailto;
    });

    copyBtn.addEventListener("click", async () => {
      const { name, email, message } = getValues();
      const text = `Name: ${name}\nEmail: ${email}\n\n${message}`;
      try{
        await navigator.clipboard.writeText(text);
        if(window.OCHelpers) window.OCHelpers.toast("Message copied");
      }catch{
        if(window.OCHelpers) window.OCHelpers.toast("Copy failed");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", wire);
})();
