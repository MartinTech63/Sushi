    document.querySelectorAll('.menu-item input[type="checkbox"]').forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            var targetId = this.getAttribute('data-target');
            if (targetId) {
                    var quantityInput = document.getElementById(targetId);
                if (this.checked) {
                     quantityInput.value = 1;
                } else {
                    quantityInput.value = 0;
                }
                 } else {
                    var quantityInput = this.nextElementSibling;
                if (this.checked) {
                    quantityInput.value = 1;
                } else {
                    quantityInput.value = 0;
                }
            }
        });
    });
 
    function generateOrderSummary() {
        var groupedSummary = {};
    
        document.querySelectorAll('.menu-item').forEach(function(item) {
            var itemName = item.querySelector('span')?.innerText || '';
            var categoryElement = item.closest('.menu-section')?.querySelector('h2');
            var category = categoryElement ? categoryElement.innerText : 'Autre';
    
            // Prépare la catégorie si besoin
            if (!groupedSummary[category]) {
                groupedSummary[category] = [];
            }
    
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
                return; // on ne traite pas plus loin ce bloc
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
    
        // ❌ Supprime les catégories vides
        Object.keys(groupedSummary).forEach(category => {
            if (groupedSummary[category].length === 0) {
                delete groupedSummary[category];
            }
        });
    
        // Canvas setup
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
        const safetyMargin = 80; // pour éviter les coupures en bas
        
        var canvasHeight = topPadding + (totalItems * itemSpacing) + (categoryCount * 10) + footerHeight + safetyMargin;
        
        
    
        canvas.width = 800 * scale;
        canvas.height = canvasHeight * scale;
        ctx.scale(scale, scale);
    
        var today = new Date();
        var day = String(today.getDate()).padStart(2, '0');
        var month = String(today.getMonth() + 1).padStart(2, '0');
        var year = today.getFullYear();
        var date = `${day}.${month}.${year}`;
    
        var logo = new Image();
        logo.src = 'SOURCES/logo.png';
        logo.onload = function () {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
    
            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;
    
            const boxPadding = 20;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(boxPadding, boxPadding, (canvas.width / scale) - 2 * boxPadding, (canvas.height / scale) - 2 * boxPadding);
            ctx.shadowBlur = 10;
    
            const titleText = `🧾 Liste de la commande du ${date}`;
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 26px Arial';
            const titleY = boxPadding + 40;
            ctx.fillText(titleText, boxPadding + 20, titleY);
    
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
    
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(boxPadding + 20, titleY + 15);
            ctx.lineTo((canvas.width / scale) - boxPadding - 20, titleY + 15);
            ctx.stroke();
    
            let currentY = titleY + 50;
    
            Object.keys(groupedSummary).forEach(function(category) {
                // === TITRE DE CATÉGORIE CENTRÉ + BACKGROUND ===
                const categoryText = `— ${category.toUpperCase()} —`;
                ctx.font = 'bold 22px Arial';
                const textWidth = ctx.measureText(categoryText).width;
                const centerX = ((canvas.width / scale) - textWidth) / 2;
    
                // Fond doux derrière
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(centerX - 10, currentY - 24, textWidth + 20, 32);
    
                // Texte orange centré
                ctx.fillStyle = '#ff9800';
                ctx.fillText(categoryText, centerX, currentY);
    
                currentY += itemSpacing;
    
                // === ITEMS DE LA CATÉGORIE ===
                ctx.fillStyle = '#555';
                ctx.font = '18px Arial';
    
                groupedSummary[category].forEach(function(item) {
                    ctx.fillText(`• ${item.name} - Quantité : ${item.quantity}`, boxPadding + 50, currentY);
                    currentY += itemSpacing;
                });
    
                currentY += categorySpacing;
            });
    
            // === FOOTER ===
            ctx.fillStyle = '#888';
            ctx.font = 'italic 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("Merci pour votre commande 🍨", (canvas.width / scale) / 2, (canvas.height / scale) - boxPadding - 40);
            ctx.fillText("https://sushi.martintech.fr/", (canvas.width / scale) / 2, (canvas.height / scale) - boxPadding - 20);
            ctx.textAlign = 'start';
    
            // Générer image PNG
            var img = canvas.toDataURL('image/png');
            var link = document.createElement('a');
            link.href = img;
            link.download = `Liste de la commande du ${date}.png`;
            link.click();
        };
    }
    