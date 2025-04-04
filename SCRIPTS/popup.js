window.onload = function () {
  const popup = document.getElementById("popupOverlay");
  popup.style.display = "flex";

  document.body.classList.add("noscroll");

  setTimeout(() => {
    popup.classList.add("show");
  }, 10);
};

function closePopup() {
  const popup = document.getElementById("popupOverlay");
  popup.classList.remove("show");

  document.body.classList.remove("noscroll");

  setTimeout(() => {
    popup.style.display = "none";
  }, 500);
}
