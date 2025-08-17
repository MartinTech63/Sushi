function generateOrderSummary() {
  var groupedSummary = {};

  document.querySelectorAll('.menu-item').forEach(function(item) {
    var itemName = item.querySelector('span')?.innerText || '';
    var categoryElement = item.closest('.menu-section')?.querySelector('h2');
    var category = categoryElement ? categoryElement.innerText : 'Autre';

    if (!groupedSummary[category]) groupedSummary[category] = [];

    // === Boules de glace : cas spécial ===
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

    // === Cas général ===
    var checkbox = item.querySelector('input[type="checkbox"]');
    var quantityInput = item.querySelector('input[type="number"]');
    if (checkbox && checkbox.checked) {
      groupedSummary[category].push({
        name: itemName,
        quantity: quantityInput.value
      });
    }
  });

  // Supprimer les catégories vides
  Object.keys(groupedSummary).forEach(category => {
    if (groupedSummary[category].length === 0) delete groupedSummary[category];
  });

  // Vérifie si Halloween est actif
  const isHalloween = document.body.classList.contains("halloween");

  // ==== Palette couleurs ====
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

  // ==== Canvas ====
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

  // Logo dynamique selon mode
  var logo = new Image();
  logo.src = isHalloween ? 'SOURCES/logo_white.png' : 'SOURCES/logo.png';

  logo.onload = function () {
    // Fond global
    ctx.fillStyle = colors.pageBg;
    ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

    // Box
    const boxPadding = 20;
    ctx.shadowColor = isHalloween ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = isHalloween ? 16 : 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isHalloween ? 6 : 4;

    ctx.fillStyle = colors.boxBg;
    ctx.fillRect(boxPadding, boxPadding, (canvas.width / scale) - 2 * boxPadding, (canvas.height / scale) - 2 * boxPadding);
    ctx.shadowBlur = 10;

    // Titre
    const titleText = `${colors.titleEmoji}Liste de la commande du ${date}`;
    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 26px Arial';
    const titleY = boxPadding + 40;
    ctx.fillText(titleText, boxPadding + 20, titleY);

    // Logo
    const logoHeight = 55;
    const aspectRatio = logo.width / logo.height;
    const logoWidth = logoHeight * aspectRatio;
    ctx.drawImage(
      logo,
      (canvas.width / scale) - boxPadding - logoWidth - 10,
      boxPadding + 0,
      logoWidth,
      logoHeight
    );

    // Ligne
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boxPadding + 20, titleY + 15);
    ctx.lineTo((canvas.width / scale) - boxPadding - 20, titleY + 15);
    ctx.stroke();

    // Contenu
    let currentY = titleY + 50;

    Object.keys(groupedSummary).forEach(function(category) {
      const categoryText = `— ${category.toUpperCase()} —`;
      ctx.font = 'bold 22px Arial';
      const textWidth = ctx.measureText(categoryText).width;
      const centerX = ((canvas.width / scale) - textWidth) / 2;

      ctx.fillStyle = colors.boxBg;
      ctx.fillRect(centerX - 10, currentY - 24, textWidth + 20, 32);

      ctx.fillStyle = colors.accent;
      ctx.fillText(categoryText, centerX, currentY);

      currentY += itemSpacing;

      // Items
      ctx.fillStyle = colors.text;
      ctx.font = '18px Arial';
      groupedSummary[category].forEach(function(item) {
        ctx.fillText(`• ${item.name} - Quantité : ${item.quantity}`, boxPadding + 50, currentY);
        currentY += itemSpacing;
      });

      currentY += categorySpacing;
    });

    // Footer
    ctx.fillStyle = colors.footer;
    ctx.font = 'italic 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      isHalloween ? "Merci pour votre commande 👻" : "Merci pour votre commande 🍨",
      (canvas.width / scale) / 2,
      (canvas.height / scale) - boxPadding - 40
    );
    ctx.fillText("https://sushi.martintech.fr/", (canvas.width / scale) / 2, (canvas.height / scale) - boxPadding - 20);
    ctx.textAlign = 'start';

    // Export PNG
    var img = canvas.toDataURL('image/png');
    var link = document.createElement('a');
    link.href = img;
    link.download = `Liste de la commande du ${date}.png`;
    link.click();
  };
}
