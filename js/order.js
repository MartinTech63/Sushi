
/*! commande.js — sync + auto-add (aucune modif d'export)
 *  - Coche -> quantité = 1 (si 0/vide). Décoche -> 0
 *  - Saisie quantité > 0 -> coche la case, 0 -> décoche
 *  - DISPATCH 'change' sur la checkbox si son état change (met à jour le bouton "Ajouter/Ajouté")
 *  - Gère data-target (Boule de glace) et cas général
 *  - Ne touche PAS à generateOrderSummary()
 */
(function () {
  'use strict';

  function linkCheckbox(cb) {
    // Cas explicite: data-target pointe vers l'input number
    const targetId = cb.getAttribute('data-target');
    if (targetId) {
      const qty = document.getElementById(targetId);
      if (qty && qty.type === 'number') {
        if (!qty.hasAttribute('min') || parseInt(qty.getAttribute('min'),10) > 0) {
          qty.setAttribute('min', '0'); // autorise redescendre à 0
        }
        cb.addEventListener('change', () => {
          if (cb.checked) {
            const v = parseInt(qty.value, 10);
            if (!v || v < 1) qty.value = 1;
          } else {
            qty.value = 0;
          }
        });
      }
      return;
    }

    // Cas général: même .menu-item
    const item = cb.closest('.menu-item');
    if (!item) return;
    const qty = item.querySelector('input[type="number"]');
    if (!qty) return;
    if (!qty.hasAttribute('min') || parseInt(qty.getAttribute('min'),10) > 0) {
      qty.setAttribute('min', '0');
    }
    cb.addEventListener('change', () => {
      if (cb.checked) {
        const v = parseInt(qty.value, 10);
        if (!v || v < 1) qty.value = 1;
      } else {
        qty.value = 0;
      }
    });
  }

  function linkNumber(qty) {
    if (!qty.hasAttribute('min') || parseInt(qty.getAttribute('min'),10) > 0) {
      qty.setAttribute('min', '0'); // autorise 0
    }

    // Trouver la checkbox associée
    let cb = null;
    const id = qty.id;
    if (id) {
      cb = document.querySelector(`input[type="checkbox"][data-target="${CSS.escape(id)}"]`);
    }
    if (!cb) {
      const item = qty.closest('.menu-item');
      if (item) cb = item.querySelector('input[type="checkbox"]');
    }
    if (!cb) return;

    const sync = () => {
      let v = parseInt(qty.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      qty.value = v;
      const prev = cb.checked;
      cb.checked = v > 0;
      if (cb.checked !== prev) {
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    qty.addEventListener('input', sync);
    qty.addEventListener('change', sync);
  }

  // --- Nouvelle fonctionnalité : boutons + / - tactiles ---
  function attachQuantityButtons(container) {
    const inputs = container.querySelectorAll('input[type="number"]');
    if (!inputs || inputs.length === 0) return;

    inputs.forEach((input) => {
      if (!input) return;

      // Évite de ré-injecter si l'input est déjà dans un wrapper.
      if (input.closest('.quantity-container')) return;

      const btnMinus = document.createElement('button');
      btnMinus.type = 'button';
      btnMinus.className = 'quantity-btn';
      btnMinus.textContent = '-';

      const btnPlus = document.createElement('button');
      btnPlus.type = 'button';
      btnPlus.className = 'quantity-btn';
      btnPlus.textContent = '+';

      // Wrap input dans un conteneur
      const wrapper = document.createElement('div');
      wrapper.className = 'quantity-container';

      const parent = input.parentNode;
      if (!parent) return;

      parent.insertBefore(wrapper, input);
      wrapper.appendChild(btnMinus);
      wrapper.appendChild(input);
      wrapper.appendChild(btnPlus);

      // Actions des boutons
      btnMinus.addEventListener('click', () => {
        const min = parseInt(input.min, 10) || 0;
        let val = parseInt(input.value, 10) || 0;
        if (val > min) input.value = val - 1;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      btnPlus.addEventListener('click', () => {
        const max = parseInt(input.max, 10) || 10;
        let val = parseInt(input.value, 10) || 0;
        if (val < max) input.value = val + 1;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  var LS_ORDER_DRAFT = 'sushi_order_draft';
  var ORDER_DRAFT_TTL_MS = 4 * 60 * 60 * 1000; // aligné sur TTL table / popup
  var orderDraftSaveTimer = null;
  var orderDraftBound = false;
  var restoringOrderDraft = false;

  function collectOrderDraft() {
    var items = {};
    document.querySelectorAll('.menu-item input[type="number"]').forEach(function (qty) {
      var key = qty.name || qty.id;
      if (!key) return;
      var v = parseInt(qty.value, 10) || 0;
      if (v > 0) items[key] = v;
    });
    return items;
  }

  function clearOrderDraft() {
    try {
      localStorage.removeItem(LS_ORDER_DRAFT);
    } catch (e) {}
  }

  function saveOrderDraft() {
    if (restoringOrderDraft) return;
    try {
      var items = collectOrderDraft();
      if (!Object.keys(items).length) {
        clearOrderDraft();
        return;
      }
      localStorage.setItem(
        LS_ORDER_DRAFT,
        JSON.stringify({
          expiresAt: new Date(Date.now() + ORDER_DRAFT_TTL_MS).toISOString(),
          items: items
        })
      );
    } catch (e) {}
  }

  function scheduleSaveOrderDraft() {
    if (restoringOrderDraft) return;
    if (orderDraftSaveTimer) clearTimeout(orderDraftSaveTimer);
    orderDraftSaveTimer = setTimeout(saveOrderDraft, 120);
  }

  function loadOrderDraft() {
    try {
      var raw = localStorage.getItem(LS_ORDER_DRAFT);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.items || !data.expiresAt) {
        clearOrderDraft();
        return null;
      }
      var t = Date.parse(data.expiresAt);
      if (Number.isNaN(t) || Date.now() >= t) {
        clearOrderDraft();
        return null;
      }
      return data.items;
    } catch (e) {
      clearOrderDraft();
      return null;
    }
  }

  function applyOrderDraft(items) {
    if (!items) return;
    restoringOrderDraft = true;
    try {
      var restored = false;
      document.querySelectorAll('.menu-item input[type="number"]').forEach(function (qty) {
        var key = qty.name || qty.id;
        if (!key || !Object.prototype.hasOwnProperty.call(items, key)) return;
        var v = parseInt(items[key], 10) || 0;
        if (v < 0) v = 0;
        qty.value = String(v);
        qty.dispatchEvent(new Event('input', { bubbles: true }));
        qty.dispatchEvent(new Event('change', { bubbles: true }));
        restored = true;
      });
      if (restored && typeof window.__forceSelectionUISync === 'function') {
        window.__forceSelectionUISync();
      }
    } finally {
      restoringOrderDraft = false;
    }
  }

  function ensureOrderDraftPersistence() {
    if (orderDraftBound) return;
    orderDraftBound = true;
    var root = document.getElementById('menuRoot') || document;
    root.addEventListener(
      'change',
      function (e) {
        var t = e.target;
        if (!t || !t.matches) return;
        if (t.matches('input[type="number"]') || t.matches('input[type="checkbox"]')) {
          scheduleSaveOrderDraft();
        }
      },
      true
    );
    root.addEventListener(
      'input',
      function (e) {
        var t = e.target;
        if (!t || !t.matches) return;
        if (t.matches('input[type="number"]')) {
          scheduleSaveOrderDraft();
        }
      },
      true
    );
    // Clics sur +/- / Ajouter : capture aussi après coup.
    root.addEventListener(
      'click',
      function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('.quantity-btn') || t.closest('.select-btn')) {
          scheduleSaveOrderDraft();
        }
      },
      true
    );
  }

  window.__clearOrderDraft = clearOrderDraft;

  function bindOrderControls() {
    document.querySelectorAll('.menu-item input[type="checkbox"]').forEach(linkCheckbox);
    document.querySelectorAll('.menu-item input[type="number"]').forEach(linkNumber);

    document.querySelectorAll('.menu-item').forEach(item => {
      attachQuantityButtons(item);
    });

    document.querySelectorAll('.menu-item input[type="number"]').forEach(qty => {
      let v = parseInt(qty.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      qty.value = v;

      const id = qty.id;
      let cb = null;
      if (id) cb = document.querySelector(`input[type="checkbox"][data-target="${CSS.escape(id)}"]`);
      if (!cb) {
        const item = qty.closest('.menu-item');
        if (item) cb = item.querySelector('input[type="checkbox"]');
      }
      if (cb) {
        const prev = cb.checked;
        cb.checked = v > 0;
        if (cb.checked !== prev) {
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    ensureOrderDraftPersistence();
    // Laisse select-ui accrocher les pills, puis restaure la sélection.
    setTimeout(function () {
      applyOrderDraft(loadOrderDraft());
    }, 50);
  }

  document.addEventListener('sushi:menu-ready', bindOrderControls);
  document.addEventListener('DOMContentLoaded', function () {
    // If menu already rendered synchronously (cached), bind once.
    if (document.querySelector('.menu-item')) bindOrderControls();
  });
})();

function resetOrder() {
  if (!confirm('Êtes-vous sûr de vouloir réinitialiser toute la commande ?')) return;
  document.querySelectorAll('.menu-item input[type="checkbox"]').forEach(function (checkbox) {
    checkbox.checked = false;
  });
  document.querySelectorAll('.menu-item input[type="number"]').forEach(function (numberInput) {
    numberInput.value = 0;
  });
  if (typeof window.__clearOrderDraft === 'function') {
    window.__clearOrderDraft();
  }
  if (typeof window.__forceSelectionUISync === 'function') {
    window.__forceSelectionUISync();
  }
}

window.resetOrder = resetOrder;

function computeCurrentOrderSummary() {
  var groupedSummary = {};

  document.querySelectorAll('.menu-item').forEach(function(item) {
    var itemName = item.querySelector('.menu-item-name')?.innerText || item.querySelector('span')?.innerText || '';
    var categoryElement = item.closest('.menu-section')?.querySelector('h2');
    var category = categoryElement ? categoryElement.innerText : 'Autre';

    if (!groupedSummary[category]) groupedSummary[category] = [];

    // Cas glaces : data-target
    if (item.classList.contains('menu-item--flavors') || itemName === 'Boule de glace') {
      item.querySelectorAll('input[type="checkbox"]').forEach(function(flavorCheckbox) {
        if (flavorCheckbox.checked) {
          var labelEl = flavorCheckbox.closest('.menu-item-flavor')?.querySelector('.menu-item-flavor-label');
          var labelText = labelEl
            ? labelEl.textContent.trim()
            : (flavorCheckbox.parentElement.textContent.split(':')[0].trim());
          var quantityInput = document.getElementById(flavorCheckbox.dataset.target);
          if (!quantityInput) return;
          groupedSummary[category].push({
            name: `Boule de glace - ${labelText}`,
            quantity: quantityInput.value
          });
        }
      });
      return;
    }

    // Cas général
    var checkbox = item.querySelector('.menu-item-actions input[type="checkbox"]') || item.querySelector('input[type="checkbox"]');
    var quantityInput = item.querySelector('.menu-item-actions input[type="number"]') || item.querySelector('input[type="number"]');
    if (checkbox && checkbox.checked && quantityInput) {
      groupedSummary[category].push({
        name: itemName,
        quantity: quantityInput.value
      });
    }
  });

  // Supprimer catégories vides
  Object.keys(groupedSummary).forEach(function(category) {
    if (groupedSummary[category].length === 0) delete groupedSummary[category];
  });

  return groupedSummary;
}

function getCurrentOrderItems() {
  var groupedSummary = computeCurrentOrderSummary();
  var items = [];

  Object.keys(groupedSummary).forEach(function(category) {
    groupedSummary[category].forEach(function(it) {
      items.push({
        name: it.name,
        quantity: parseInt(it.quantity, 10) || 0
      });
    });
  });

  return items;
}

// --- generateOrderSummary() — même identité visuelle que l'UI ---
var __orderLogoCache = Object.create(null);
var __orderLogoImages = Object.create(null);

function loadOrderLogo(src) {
  if (__orderLogoCache[src]) return __orderLogoCache[src];

  __orderLogoCache[src] = new Promise(function (resolve) {
    var img = new Image();
    var settled = false;
    function done(value) {
      if (settled) return;
      settled = true;
      if (value) __orderLogoImages[src] = value;
      resolve(value);
    }
    function finishOk() {
      if (img.naturalWidth) done(img);
      else done(null);
    }
    img.onload = function () {
      if (img.decode) {
        img.decode().then(finishOk).catch(finishOk);
      } else {
        finishOk();
      }
    };
    img.onerror = function () { done(null); };
    img.src = src;
  });

  return __orderLogoCache[src];
}

function whenFontsReady(timeoutMs) {
  if (!document.fonts || !document.fonts.ready) {
    return Promise.resolve();
  }
  // Ne jamais bloquer indéfiniment si Google Fonts est lent / bloqué
  return Promise.race([
    document.fonts.ready.then(function () {}, function () {}),
    new Promise(function (resolve) {
      setTimeout(resolve, timeoutMs || 350);
    })
  ]);
}

function triggerPngDownload(dataUrl, filename) {
  var link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Précharge les logos pour que l’export reste synchrone au clic (geste utilisateur)
loadOrderLogo('/assets/logo.png');
loadOrderLogo('/assets/logo_white.png');

function generateOrderSummary() {
  var groupedSummary = computeCurrentOrderSummary();
  if (!Object.keys(groupedSummary).length) {
    alert('Ajoute au moins un plat avant d’exporter.');
    return;
  }

  var isHalloween = document.body.classList.contains('halloween');
  var logoSrc = isHalloween ? '/assets/logo_white.png' : '/assets/logo.png';
  // Charte site (:root + halloween.css)
  var colors = isHalloween
    ? {
        pageBg: '#0a0a0a',
        cardBg: '#141414',
        headerBg: '#1a1a1a',
        headerBg2: '#2a1608',
        navBg: '#111111',
        ink: '#f4f0e6',
        muted: '#c8c0b4',
        accent: '#ff6600',
        accentSoft: '#ff9f1c',
        line: '#333333',
        qtyBg: '#1b1b1b',
        qtyInk: '#ffd8a8',
        onAccent: '#ffffff',
        border: '#3a1a0f'
      }
    : {
        pageBg: '#f5f2ec',
        cardBg: '#ffffff',
        headerBg: '#ff9800',
        headerBg2: '#e68900',
        navBg: '#2b2620',
        ink: '#1c1917',
        muted: '#5c564e',
        accent: '#ff9800',
        accentSoft: '#fff3e0',
        line: '#ddd6cb',
        qtyBg: '#fff3e0',
        qtyInk: '#1c1917',
        onAccent: '#ffffff',
        border: '#1c1917'
      };

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  if (!ctx) {
    alert("Impossible de générer l'image (canvas indisponible).");
    return;
  }
  var scale = 2;
  var width = 800;
  var pad = 28;
  var rowH = 44;
  var catGap = 18;
  var headerH = 108;
  var navH = 36;
  var footerH = 72;
  var catTitleH = 48;

  var categories = Object.keys(groupedSummary);
  var contentH = 20;
  categories.forEach(function (cat) {
    contentH += catTitleH + groupedSummary[cat].length * rowH + catGap;
  });
  var height = headerH + navH + contentH + footerH + 24;

  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  var today = new Date();
  var date =
    String(today.getDate()).padStart(2, '0') +
    '.' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '.' +
    today.getFullYear();

  var totalPieces = 0;
  categories.forEach(function (cat) {
    groupedSummary[cat].forEach(function (it) {
      totalPieces += parseInt(it.quantity, 10) || 0;
    });
  });

  function roundRect(x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fillTopRoundedRect(x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }

  function fillBottomRoundedRect(x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }

  function paintHeaderGradient(x, y, w, h) {
    if (isHalloween) {
      var g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, colors.headerBg);
      g.addColorStop(1, colors.headerBg2);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = colors.headerBg;
    }
    fillTopRoundedRect(x, y, w, h, 8);
  }

  function drawAndDownload(logoImage) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);

    var cardX = 16;
    var cardY = 16;
    var cardW = width - 32;
    var cardH = height - 32;
    var footerY = cardY + cardH - footerH;
    var radius = 8;
    var innerL = cardX + pad;
    var innerR = cardX + cardW - pad;

    // Fond washi
    ctx.fillStyle = colors.pageBg;
    ctx.fillRect(0, 0, width, height);

    // Carte
    ctx.fillStyle = colors.cardBg;
    roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();

    // —— Header (comme .site-header) ——
    paintHeaderGradient(cardX, cardY, cardW, headerH);
    ctx.fillStyle = colors.border;
    ctx.fillRect(cardX, cardY + headerH - 2, cardW, 2);

    var textLeft = cardX + 22;
    if (logoImage && logoImage.naturalWidth && logoImage.naturalHeight) {
      try {
        var logoH = 56;
        var logoW = (logoImage.naturalWidth / logoImage.naturalHeight) * logoH;
        ctx.drawImage(logoImage, cardX + 20, cardY + (headerH - logoH) / 2, logoW, logoH);
        textLeft = cardX + 20 + logoW + 14;
      } catch (eLogo) {
        console.warn('Logo export skip', eLogo);
      }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHalloween ? colors.accentSoft : 'rgba(255,255,255,0.88)';
    ctx.font = '700 11px "Noto Sans JP", sans-serif';
    ctx.fillText('HANAMI', textLeft, cardY + 34);

    ctx.fillStyle = isHalloween ? colors.accentSoft : colors.onAccent;
    ctx.font = '400 28px "Dela Gothic One", "Noto Sans JP", sans-serif';
    ctx.fillText('Manger des Sushis', textLeft, cardY + 62);

    ctx.fillStyle = isHalloween ? 'rgba(255,183,71,0.85)' : 'rgba(255,255,255,0.9)';
    ctx.font = '500 13px "Noto Sans JP", sans-serif';
    ctx.fillText('Commande du ' + date, textLeft, cardY + 88);

    // —— Bandeau nav (comme .nav-bar) ——
    var navY = cardY + headerH;
    ctx.fillStyle = colors.navBg;
    ctx.fillRect(cardX, navY, cardW, navH);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(cardX, navY + navH - 3, 120, 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px "Noto Sans JP", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Carte', innerL, navY + navH / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '500 12px "Noto Sans JP", sans-serif';
    var piecesLabel =
      totalPieces + ' pièce' + (totalPieces > 1 ? 's' : '');
    ctx.fillText(piecesLabel, innerR, navY + navH / 2);
    ctx.textAlign = 'left';

    // —— Contenu (sections comme .menu-section) ——
    var y = navY + navH + 28;

    categories.forEach(function (category, catIdx) {
      if (catIdx > 0) y += 6;

      // Titre catégorie centré + soulignement shu
      ctx.fillStyle = isHalloween ? colors.accentSoft : colors.ink;
      ctx.font = '400 22px "Dela Gothic One", "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(category, cardX + cardW / 2, y);

      var titleW = ctx.measureText(category).width;
      var ruleY = y + 10;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cardX + cardW / 2 - Math.max(titleW / 2, 40) - 8, ruleY);
      ctx.lineTo(cardX + cardW / 2 + Math.max(titleW / 2, 40) + 8, ruleY);
      ctx.stroke();
      ctx.textAlign = 'left';

      y = ruleY + 22;

      groupedSummary[category].forEach(function (item, idx) {
        var rowTop = y - 8;

        if (idx > 0) {
          ctx.strokeStyle = colors.line;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(innerL, rowTop);
          ctx.lineTo(innerR, rowTop);
          ctx.stroke();
        }

        var qty = String(item.quantity);
        ctx.font = '700 15px "Noto Sans JP", sans-serif';
        var qtyLabel = '×' + qty;
        var qtyW = Math.max(48, ctx.measureText(qtyLabel).width + 20);
        var qtyH = 28;
        var qtyX = innerR - qtyW;
        var qtyY = y + 2;

        // Badge quantité (shu-soft + bordure ink)
        ctx.fillStyle = colors.qtyBg;
        roundRect(qtyX, qtyY, qtyW, qtyH, 6);
        ctx.fill();
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = colors.qtyInk;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(qtyLabel, qtyX + qtyW / 2, qtyY + qtyH / 2);

        ctx.textAlign = 'left';
        ctx.fillStyle = isHalloween ? colors.qtyInk : colors.ink;
        ctx.font = '500 16px "Noto Sans JP", sans-serif';
        var maxNameW = qtyX - innerL - 14;
        var name = String(item.name);
        while (ctx.measureText(name).width > maxNameW && name.length > 3) {
          name = name.slice(0, -2) + '…';
        }
        ctx.textBaseline = 'middle';
        ctx.fillText(name, innerL, qtyY + qtyH / 2);

        y += rowH;
      });

      y += catGap;
    });

    // —— Footer (comme .site-footer) ——
    if (isHalloween) {
      var fg = ctx.createLinearGradient(cardX, footerY, cardX + cardW, footerY + footerH);
      fg.addColorStop(0, colors.headerBg);
      fg.addColorStop(1, colors.headerBg2);
      ctx.fillStyle = fg;
    } else {
      ctx.fillStyle = colors.headerBg;
    }
    fillBottomRoundedRect(cardX, footerY, cardW, cardH - (footerY - cardY), radius);
    ctx.fillStyle = colors.border;
    ctx.fillRect(cardX, footerY, cardW, 2);

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.stroke();

    ctx.fillStyle = isHalloween ? colors.accentSoft : colors.onAccent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px "Noto Sans JP", sans-serif';
    ctx.fillText(
      isHalloween ? 'Merci pour votre commande 👻' : 'Merci pour votre commande 🍨',
      width / 2,
      footerY + 26
    );
    ctx.fillStyle = isHalloween ? 'rgba(255,183,71,0.8)' : 'rgba(255,255,255,0.92)';
    ctx.font = '500 12px "Noto Sans JP", sans-serif';
    ctx.fillText('https://sushi.martintech.fr/', width / 2, footerY + 50);
    ctx.textAlign = 'start';

    try {
      var img = canvas.toDataURL('image/png');
      triggerPngDownload(img, 'Liste de la commande du ' + date + '.png');
    } catch (e) {
      alert(
        "Impossible de générer l'image de la commande dans ce contexte.\n" +
          'Utilise le site en ligne (https://sushi.martintech.fr/).'
      );
      console.error(e);
    }
  }

  function pickLogo() {
    if (__orderLogoImages[logoSrc]) return __orderLogoImages[logoSrc];
    var mainLogo = document.getElementById('mainLogo');
    if (
      mainLogo &&
      mainLogo.complete &&
      mainLogo.naturalWidth &&
      mainLogo.currentSrc &&
      mainLogo.currentSrc.indexOf(logoSrc) !== -1
    ) {
      return mainLogo;
    }
    return null;
  }

  var readyLogo = pickLogo();
  if (readyLogo) {
    drawAndDownload(readyLogo);
    return;
  }

  Promise.all([loadOrderLogo(logoSrc), whenFontsReady(350)]).then(function (results) {
    drawAndDownload(results[0]);
  });
}

window.getCurrentOrderItems = getCurrentOrderItems;
window.generateOrderSummary = generateOrderSummary;

