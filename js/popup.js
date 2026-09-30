(function () {
  "use strict";

  var popup = null;
  var previousActiveElement = null;
  var LS_DISMISS_UNTIL = "sushi_popup_dismiss_until";
  // Aligné sur le TTL table (3h) : après fermeture, ne plus réafficher pendant 3h.
  var POPUP_TTL_MS = 3 * 60 * 60 * 1000;

  var FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])";

  function shouldShowPopup() {
    try {
      var raw = localStorage.getItem(LS_DISMISS_UNTIL);
      if (!raw) return true;
      var until = Date.parse(raw);
      if (Number.isNaN(until)) {
        localStorage.removeItem(LS_DISMISS_UNTIL);
        return true;
      }
      if (Date.now() >= until) {
        localStorage.removeItem(LS_DISMISS_UNTIL);
        return true;
      }
      return false;
    } catch (e) {
      return true;
    }
  }

  function rememberPopupDismissed() {
    try {
      localStorage.setItem(
        LS_DISMISS_UNTIL,
        new Date(Date.now() + POPUP_TTL_MS).toISOString()
      );
    } catch (e) {}
  }

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

    // Assure que la variable de décalage du menu fixe existe (fallback).
    try {
      var nav = document.querySelector('nav.nav-bar');
      if (nav) {
        var rect = nav.getBoundingClientRect();
        document.documentElement.style.setProperty('--menu-offset', rect.bottom + 'px');
      }
    } catch (e) {}

    previousActiveElement = document.activeElement;
    popup.hidden = false;
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

    rememberPopupDismissed();
    popup.classList.remove("show");
    popup.setAttribute("aria-hidden", "true");
    document.body.classList.remove("noscroll");

    setTimeout(function () {
      popup.style.display = "none";
      popup.hidden = true;
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    }, 500);
  }

  window.closePopup = closePopup;

  window.addEventListener("load", function () {
    if (shouldShowPopup()) openPopup();
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
