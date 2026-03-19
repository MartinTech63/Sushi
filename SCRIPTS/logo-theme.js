/* Gestion du changement de logo selon le thème (ex: Halloween) */
document.addEventListener("DOMContentLoaded", function () {
  var logoEl = document.getElementById("mainLogo");
  if (!logoEl) return;

  function updateLogo() {
    if (document.body.classList.contains("halloween")) {
      logoEl.src = "SOURCES/logo_white.png";
    } else {
      logoEl.src = "SOURCES/logo.png";
    }
  }

  updateLogo();

  var observer = new MutationObserver(updateLogo);
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
});
