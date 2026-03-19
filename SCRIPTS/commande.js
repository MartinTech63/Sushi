
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
    const input = container.querySelector('input[type="number"]');
    if (!input) return;

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
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Synchronisation checkbox ↔ input
    document.querySelectorAll('.menu-item input[type="checkbox"]').forEach(linkCheckbox);
    document.querySelectorAll('.menu-item input[type="number"]').forEach(linkNumber);

    // Injections boutons + / - pour tous les champs number
    document.querySelectorAll('.menu-item').forEach(item => {
      attachQuantityButtons(item);
    });

    // Synchronisation initiale
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
  });
})();

// --- generateOrderSummary() inchangé ---
function generateOrderSummary() {
  var groupedSummary = {};

  document.querySelectorAll('.menu-item').forEach(function(item) {
    var itemName = item.querySelector('span')?.innerText || '';
    var categoryElement = item.closest('.menu-section')?.querySelector('h2');
    var category = categoryElement ? categoryElement.innerText : 'Autre';

    if (!groupedSummary[category]) groupedSummary[category] = [];

    // Boules de glace : cas spécial
    if (itemName === 'Boule de glace') {
      item.querySelectorAll('input[type="checkbox"]').forEach(function(flavorCheckbox) {
        if (flavorCheckbox.checked) {
          var labelText = flavorCheckbox.parentElement.textContent.split(':')[0].trim();
          var quantityInput = document.getElementById(flavorCheckbox.dataset.target);
          groupedSummary[category].push({
            name: `Boule de glace - ${labelText}`,
            quantity: quantityInput.value
          });
        }
      });
      return;
    }

    // Cas général
    var checkbox = item.querySelector('input[type="checkbox"]');
    var quantityInput = item.querySelector('input[type="number"]');
    if (checkbox && checkbox.checked) {
      groupedSummary[category].push({
        name: itemName,
        quantity: quantityInput.value
      });
    }
  });

  // Supprimer catégories vides
  Object.keys(groupedSummary).forEach(category => {
    if (groupedSummary[category].length === 0) delete groupedSummary[category];
  });

  // Vérifie si Halloween est actif
  const isHalloween = document.body.classList.contains("halloween");

  // Palette couleurs
  const colors = isHalloween ? {
    pageBg: '#111111',
    boxBg: '#0b0b0b',
    text: '#eaeaea',
    accent: '#ff6600',
    line: '#ff6600',
    footer: '#ff6600',
    titleEmoji: '🎃 '
  } : {
    pageBg: '#ffffff',
    boxBg: '#ffffff',
    text: '#555555',
    accent: '#ff9800',
    line: '#ff9800',
    footer: '#888888',
    titleEmoji: '🧾 '
  };

  // Création canvas et export PNG (inchangé)
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');

  var scale = 2;
  var itemSpacing = 30;
  var topPadding = 120;
  var footerHeight = 80;
  var categorySpacing = 30;
  var totalItems = 0;

  Object.values(groupedSummary).forEach(list => {
    totalItems += list.length + 1;
  });

  const categoryCount = Object.keys(groupedSummary).length;
  const safetyMargin = 80;
  var canvasHeight = topPadding + (totalItems * itemSpacing) + (categoryCount * 10) + footerHeight + safetyMargin;

  canvas.width = 800 * scale;
  canvas.height = canvasHeight * scale;
  ctx.scale(scale, scale);

  var today = new Date();
  var day = String(today.getDate()).padStart(2, '0');
  var month = String(today.getMonth() + 1).padStart(2, '0');
  var year = today.getFullYear();
  var date = `${day}.${month}.${year}`;

  function drawAndDownload(logoImage) {
    ctx.fillStyle = colors.pageBg;
    ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

    var boxPadding = 20;
    ctx.shadowColor = isHalloween ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = isHalloween ? 16 : 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isHalloween ? 6 : 4;

    ctx.fillStyle = colors.boxBg;
    ctx.fillRect(boxPadding, boxPadding, (canvas.width / scale) - 2 * boxPadding, (canvas.height / scale) - 2 * boxPadding);
    ctx.shadowBlur = 10;

    var titleText = colors.titleEmoji + 'Liste de la commande du ' + date;
    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 26px Arial';
    var titleY = boxPadding + 40;
    ctx.fillText(titleText, boxPadding + 20, titleY);

    if (logoImage && logoImage.width && logoImage.height) {
      var logoHeight = 55;
      var aspectRatio = logoImage.width / logoImage.height;
      var logoWidth = logoHeight * aspectRatio;
      ctx.drawImage(logoImage, (canvas.width / scale) - boxPadding - logoWidth - 10, boxPadding + 0, logoWidth, logoHeight);
    }

    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boxPadding + 20, titleY + 15);
    ctx.lineTo((canvas.width / scale) - boxPadding - 20, titleY + 15);
    ctx.stroke();

    var currentY = titleY + 50;
    Object.keys(groupedSummary).forEach(function(category) {
      var categoryText = '— ' + category.toUpperCase() + ' —';
      ctx.font = 'bold 22px Arial';
      var textWidth = ctx.measureText(categoryText).width;
      var centerX = ((canvas.width / scale) - textWidth) / 2;

      ctx.fillStyle = colors.boxBg;
      ctx.fillRect(centerX - 10, currentY - 24, textWidth + 20, 32);

      ctx.fillStyle = colors.accent;
      ctx.fillText(categoryText, centerX, currentY);

      currentY += itemSpacing;

      ctx.fillStyle = colors.text;
      ctx.font = '18px Arial';
      groupedSummary[category].forEach(function(item) {
        ctx.fillText('• ' + item.name + ' - Quantité : ' + item.quantity, boxPadding + 50, currentY);
        currentY += itemSpacing;
      });

      currentY += categorySpacing;
    });

    ctx.fillStyle = colors.footer;
    ctx.font = 'italic 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(isHalloween ? "Merci pour votre commande 👻" : "Merci pour votre commande 🍨",
                 (canvas.width / scale) / 2, (canvas.height / scale) - boxPadding - 40);
    ctx.fillText("https://sushi.martintech.fr/", (canvas.width / scale) / 2, (canvas.height / scale) - boxPadding - 20);
    ctx.textAlign = 'start';

    try {
      var img = canvas.toDataURL('image/png');
      var link = document.createElement('a');
      link.href = img;
      link.download = 'Liste de la commande du ' + date + '.png';
      link.click();
    } catch (e) {
      // En local (file://) avec des images non CORS, certains navigateurs
      // bloquent toDataURL pour des raisons de sécurité.
      alert("Impossible de générer l'image de la commande dans ce contexte (sécurité du navigateur).\\n" +
            "Le téléchargement fonctionnera correctement depuis le site en ligne (https://sushi.martintech.fr/).");
      console.error(e);
    }
  }

  var logo = new Image();
  logo.onload = function () { drawAndDownload(logo); };
  logo.onerror = function () { drawAndDownload(null); };
  logo.src = isHalloween ? 'SOURCES/logo_white.png' : 'SOURCES/logo.png';
}

