(function () {
  'use strict';

  var overlay = null;
  var imgEl = null;
  var captionEl = null;
  var previousActive = null;

  function ensureLightbox() {
    overlay = document.getElementById('imageLightbox');
    if (!overlay) return false;
    imgEl = document.getElementById('imageLightboxImg');
    captionEl = document.getElementById('imageLightboxCaption');
    return !!(imgEl && captionEl);
  }

  function openLightbox(src, alt) {
    if (!ensureLightbox()) return;
    previousActive = document.activeElement;
    imgEl.src = src;
    imgEl.alt = alt || '';
    captionEl.textContent = alt || '';
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('noscroll');
    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
      var closeBtn = document.getElementById('imageLightboxClose');
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeLightbox() {
    if (!ensureLightbox() || overlay.hidden) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('noscroll');
    setTimeout(function () {
      if (!overlay.classList.contains('is-open')) {
        overlay.hidden = true;
        imgEl.removeAttribute('src');
        imgEl.alt = '';
        captionEl.textContent = '';
      }
    }, 180);
    if (previousActive && typeof previousActive.focus === 'function') {
      previousActive.focus();
    }
  }

  document.addEventListener('click', function (e) {
    var thumb = e.target.closest && e.target.closest('.menu-item-thumb');
    if (thumb) {
      e.preventDefault();
      var img = thumb.querySelector('img');
      if (!img || !img.src) return;
      var item = thumb.closest('.menu-item');
      var nameEl = item && item.querySelector('.menu-item-name');
      var label = nameEl
        ? (nameEl.textContent || '').replace(/\s+/g, ' ').trim()
        : img.alt || '';
      openLightbox(img.currentSrc || img.src, label);
      return;
    }
    if (!overlay || overlay.hidden) return;
    if (e.target === overlay || e.target.id === 'imageLightboxClose') {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && !overlay.hidden) {
      closeLightbox();
    }
  });
})();
