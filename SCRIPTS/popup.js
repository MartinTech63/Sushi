window.onload = function () {
  const popup = document.getElementById("popupOverlay");
  popup.style.display = "flex";

  // Empêche le scroll
  document.body.classList.add("noscroll");

  // Déclenche l'animation de fondu après un petit délai
  setTimeout(() => {
    popup.classList.add("show");
  }, 10);
};

function closePopup() {
  const popup = document.getElementById("popupOverlay");
  popup.classList.remove("show");

  // Retire la classe qui bloque le scroll
  document.body.classList.remove("noscroll");

  // Cache le popup après la transition
  setTimeout(() => {
    popup.style.display = "none";
  }, 500);
}
