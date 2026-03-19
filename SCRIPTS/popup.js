(function () {
  "use strict";

  var popup = null;
  var previousActiveElement = null;

  var FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])";

  function getFocusables(container) {
    if (!container) return [];
    var nodes = container.querySelectorAll(FOCUSABLE);
    return Array.prototype.filter.call(nodes, function (el) {
      return el.offsetParent !== null && !el.disabled;
    });
  }

  function trapFocus(e) {
    if (!popup || !popup.classList.contains("show")) return;
    var focusables = getFocusables(popup);
    if (focusables.length === 0) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.key !== "Tab") return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openPopup() {
    popup = document.getElementById("popupOverlay");
    if (!popup) return;

    previousActiveElement = document.activeElement;
    popup.style.display = "flex";
    popup.setAttribute("aria-hidden", "false");
    document.body.classList.add("noscroll");

    setTimeout(function () {
      popup.classList.add("show");
      var focusables = getFocusables(popup);
      var closeBtn = popup.querySelector(".popup-btn");
      if (closeBtn) closeBtn.focus();
      else if (focusables.length) focusables[0].focus();
    }, 10);
  }

  function closePopup() {
    if (!popup) popup = document.getElementById("popupOverlay");
    if (!popup) return;

    popup.classList.remove("show");
    popup.setAttribute("aria-hidden", "true");
    document.body.classList.remove("noscroll");

    setTimeout(function () {
      popup.style.display = "none";
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    }, 500);
  }

  window.closePopup = closePopup;

  window.addEventListener("load", function () {
    openPopup();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (popup && popup.classList.contains("show")) closePopup();
    }
    trapFocus(e);
  });

  document.addEventListener("touchmove", function (e) {
    if (document.body.classList.contains("noscroll")) e.preventDefault();
  }, { passive: false });

  document.addEventListener("wheel", function (e) {
    if (document.body.classList.contains("noscroll")) e.preventDefault();
  }, { passive: false });
})();
