
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
  var colors = isHalloween
    ? {
        pageBg: '#111111',
        cardBg: '#1a1a1a',
        headerBg: '#ff6600',
        ink: '#f4f0e6',
        muted: '#c8c0b4',
        accent: '#ff6600',
        line: '#333333',
        qtyBg: '#2a2a2a'
      }
    : {
        pageBg: '#f5f2ec',
        cardBg: '#ffffff',
        headerBg: '#ff9800',
        ink: '#1c1917',
        muted: '#5c564e',
        accent: '#ff9800',
        line: '#ddd6cb',
        qtyBg: '#f5f2ec'
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
  var rowH = 36;
  var catGap = 22;
  var headerH = 96;
  var footerH = 64;

  var contentH = 24;
  Object.keys(groupedSummary).forEach(function (cat) {
    contentH += 40 + groupedSummary[cat].length * rowH + catGap;
  });
  var height = headerH + contentH + footerH + 24;

  canvas.width = width * scale;
  canvas.height = height * scale;
  // setTransform (pas scale cumulatif) : évite les PNG « étirés » si redraw
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  var today = new Date();
  var date =
    String(today.getDate()).padStart(2, '0') +
    '.' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '.' +
    today.getFullYear();

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

  // Arrondi uniquement en haut (header) — sans clip sur toute la carte
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

  function drawAndDownload(logoImage) {
    // Reset propre à chaque rendu
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);

    var cardX = 16;
    var cardY = 16;
    var cardW = width - 32;
    var cardH = height - 32;
    var footerY = cardY + cardH - footerH;
    var radius = 8;

    // Fond page
    ctx.fillStyle = colors.pageBg;
    ctx.fillRect(0, 0, width, height);

    // Carte
    ctx.fillStyle = colors.cardBg;
    roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();

    // Header arrondi en haut (PAS de clip global — cause des PNG vides / « striés »)
    ctx.fillStyle = colors.headerBg;
    fillTopRoundedRect(cardX, cardY, cardW, headerH, radius);
    ctx.fillStyle = colors.ink;
    ctx.fillRect(cardX, cardY + headerH - 2, cardW, 2);

    // Logo
    var textLeft = cardX + 22;
    if (logoImage && logoImage.naturalWidth && logoImage.naturalHeight) {
      try {
        var logoH = 52;
        var logoW = (logoImage.naturalWidth / logoImage.naturalHeight) * logoH;
        ctx.drawImage(logoImage, cardX + 18, cardY + (headerH - logoH) / 2, logoW, logoH);
        textLeft = cardX + 18 + logoW + 14;
      } catch (eLogo) {
        console.warn('Logo export skip', eLogo);
      }
    }

    // Titre brand + date
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '400 26px "Dela Gothic One", "Noto Sans JP", sans-serif';
    ctx.fillText('Manger des Sushis', textLeft, cardY + headerH / 2 - 10);
    ctx.font = '700 14px "Noto Sans JP", sans-serif';
    ctx.fillText('Commande du ' + date, textLeft, cardY + headerH / 2 + 14);

    // Contenu
    var y = cardY + headerH + 30;
    var innerL = cardX + pad;
    var innerR = cardX + cardW - pad;

    Object.keys(groupedSummary).forEach(function (category) {
      ctx.fillStyle = colors.ink;
      ctx.font = '400 22px "Dela Gothic One", "Noto Sans JP", sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText(category, innerL, y);

      y += 10;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(innerL, y);
      ctx.lineTo(innerR, y);
      ctx.stroke();
      y += 22;

      groupedSummary[category].forEach(function (item, idx) {
        if (idx > 0) {
          ctx.strokeStyle = colors.line;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(innerL, y - 14);
          ctx.lineTo(innerR, y - 14);
          ctx.stroke();
        }

        var qty = String(item.quantity);
        ctx.font = '700 16px "Noto Sans JP", sans-serif';
        var qtyLabel = '×' + qty;
        var qtyW = Math.max(44, ctx.measureText(qtyLabel).width + 16);
        var qtyX = innerR - qtyW;
        var qtyY = y - 16;

        ctx.fillStyle = colors.qtyBg;
        roundRect(qtyX, qtyY, qtyW, 26, 6);
        ctx.fill();
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = colors.ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(qtyLabel, qtyX + qtyW / 2, qtyY + 13);

        ctx.textAlign = 'left';
        ctx.font = '500 16px "Noto Sans JP", sans-serif';
        var maxNameW = qtyX - innerL - 12;
        var name = String(item.name);
        while (ctx.measureText(name).width > maxNameW && name.length > 3) {
          name = name.slice(0, -2) + '…';
        }
        ctx.fillText(name, innerL, y - 3);

        y += rowH;
      });

      y += catGap - 8;
    });

    // Footer arrondi en bas
    ctx.fillStyle = colors.headerBg;
    fillBottomRoundedRect(cardX, footerY, cardW, cardH - (footerY - cardY), radius);
    ctx.fillStyle = colors.ink;
    ctx.fillRect(cardX, footerY, cardW, 2);

    // Bordure carte par-dessus
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 2;
    roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px "Noto Sans JP", sans-serif';
    ctx.fillText(
      isHalloween ? 'Merci pour votre commande 👻' : 'Merci pour votre commande 🍨',
      width / 2,
      footerY + 24
    );
    ctx.font = '500 13px "Noto Sans JP", sans-serif';
    ctx.fillText('https://sushi.martintech.fr/', width / 2, footerY + 44);
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
    // Logo déjà affiché dans la page = forcément décodé
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

