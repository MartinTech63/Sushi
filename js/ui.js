function adjustButtonPosition() {
  var footer = document.querySelector('footer');
  if (!footer) return;

  var footerRect = footer.getBoundingClientRect();
  var windowHeight = window.innerHeight;
  var stickyActive = document.body.classList.contains('has-table-sticky');
  var safeGap = 12;
  var footerPush = 0;

  if (footerRect.top < windowHeight) {
    footerPush = Math.max(0, windowHeight - footerRect.top);
  }

  var floatingBase = stickyActive ? 88 : 16;
  var dock = document.getElementById('fabDock');
  if (dock) {
    dock.style.bottom =
      'calc(' +
      (footerPush + floatingBase) +
      'px + env(safe-area-inset-bottom, 0px))';
  }

  var stickyBar = document.getElementById('tableStickyBar');
  if (stickyBar) {
    if (stickyActive && !stickyBar.hidden) {
      stickyBar.style.bottom =
        'calc(' + (footerPush + safeGap) + 'px + env(safe-area-inset-bottom, 0px))';
    } else {
      stickyBar.style.bottom = '';
    }
  }

  var toastHost = document.getElementById('toastHost');
  if (toastHost) {
    var toastBase = stickyActive ? 90 : 64;
    toastHost.style.bottom =
      'calc(' + (footerPush + toastBase) + 'px + env(safe-area-inset-bottom, 0px))';
  }
}

window.adjustButtonPosition = adjustButtonPosition;

function debounce(fn, delay) {
  var timer = null;
  return function () {
    var self = this;
    var args = arguments;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(self, args);
    }, delay);
  };
}

var debouncedAdjust = debounce(adjustButtonPosition, 80);
window.addEventListener('scroll', debouncedAdjust, { passive: true });
window.addEventListener('resize', debouncedAdjust);

function playSound() {
  var el = document.getElementById('logoSound');
  if (el && el.play) el.play().catch(function () {});
}

function topFunction() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.playSound = playSound;
window.topFunction = topFunction;

document.addEventListener('DOMContentLoaded', function () {
  adjustButtonPosition();

  // Le menu est injecté en async : au 1er calcul le footer est encore
  // dans le viewport et remonte les FAB. On recalcule quand la carte est prête.
  document.addEventListener('sushi:menu-ready', function () {
    requestAnimationFrame(adjustButtonPosition);
  });
  window.addEventListener('load', adjustButtonPosition);

  var logo = document.getElementById('mainLogo');
  if (logo) logo.addEventListener('click', playSound);

  var topBtn = document.getElementById('topBtn');
  if (topBtn) {
    topBtn.addEventListener('click', topFunction);
    window.addEventListener(
      'scroll',
      function () {
        var y = window.scrollY || document.documentElement.scrollTop;
        topBtn.classList.toggle('is-visible', y > 120);
      },
      { passive: true }
    );
  }

  var orderBtn = document.getElementById('orderSummaryBtn');
  if (orderBtn) {
    orderBtn.addEventListener('click', function () {
      if (typeof window.generateOrderSummary === 'function') window.generateOrderSummary();
    });
  }

  var resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (typeof window.resetOrder === 'function') window.resetOrder();
    });
  }

  var closeBtn = document.getElementById('popupCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      if (typeof window.closePopup === 'function') window.closePopup();
    });
  }

  fetch('/content/version.json', { cache: 'no-cache' })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (data) {
      if (!data || !data.version) return;
      var v = data.version;
      ['versionLink', 'footerVersionLink'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = v;
      });
    })
    .catch(function () {});
});
