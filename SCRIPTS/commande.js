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
        var orderSummary = [];
        document.querySelectorAll('.menu-item').forEach(function(item) {
            var checkbox = item.querySelector('input[type="checkbox"]');
            var quantityInput = item.querySelector('input[type="number"]');
            if (checkbox.checked) {
                var itemName = item.querySelector('span').innerText;
                var quantity = quantityInput.value;
                if (itemName === 'Boule de glace') {
                    item.querySelectorAll('input[type="checkbox"]').forEach(function(flavorCheckbox) {
                        if (flavorCheckbox.checked) {
                            var flavorName = flavorCheckbox.nextSibling.textContent.trim();
                            var flavorQuantity = item.querySelector('#' + flavorCheckbox.getAttribute('data-target')).value;
                            orderSummary.push({ name: itemName + ' - ' + flavorName, quantity: flavorQuantity });
                        }
                    });
                } else {
                    orderSummary.push({ name: itemName, quantity: quantity });
                }
            }
        });
    
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
    
        var itemSpacing = 35;
        var topPadding = 120;
        var footerHeight = 80;
        var canvasHeight = topPadding + orderSummary.length * itemSpacing + footerHeight;
    
        canvas.width = 800;
        canvas.height = canvasHeight;
    
        var today = new Date();
        var day = String(today.getDate()).padStart(2, '0');
        var month = String(today.getMonth() + 1).padStart(2, '0');
        var year = today.getFullYear();
        var date = `${day}.${month}.${year}`;
    
        var logo = new Image();
        logo.src = 'SOURCES/logo.png';
        logo.onload = function () {
            // Fond principal
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
    
            // Ombre
            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;
    
            // Boîte blanche
            const boxPadding = 20;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(boxPadding, boxPadding, canvas.width - 2 * boxPadding, canvas.height - 2 * boxPadding);
            ctx.shadowBlur = 0;
    
            // Titre
            const titleText = `🧾 Liste de la commande du ${date}`;
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 26px Arial';
            const titleY = boxPadding + 40;
            ctx.fillText(titleText, boxPadding + 20, titleY);
    
            // Logo à droite du titre
            const logoHeight = 55;
            const aspectRatio = logo.width / logo.height;
            const logoWidth = logoHeight * aspectRatio;
            ctx.drawImage(
                logo,
                canvas.width - boxPadding - logoWidth - 10,
                boxPadding + 0,
                logoWidth,
                logoHeight
            );
    
            // Ligne orange
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(boxPadding + 20, titleY + 15);
            ctx.lineTo(canvas.width - boxPadding - 20, titleY + 15);
            ctx.stroke();
    
            // Contenu
            ctx.fillStyle = '#555';
            ctx.font = '18px Arial';
            orderSummary.forEach(function(item, index) {
                ctx.fillText(
                    `• ${item.name} - Quantité : ${item.quantity}`,
                    boxPadding + 30,
                    titleY + 50 + index * itemSpacing
                );
            });
    
            // Pied de page (dans la boîte blanche)
            ctx.fillStyle = '#888';
            ctx.font = 'italic 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("Merci pour votre commande 🍨", canvas.width / 2, canvas.height - boxPadding - 40);
            ctx.fillText("https://sushi.martintech.fr/", canvas.width / 2, canvas.height - boxPadding - 20);
            ctx.textAlign = 'start';
    
            // Téléchargement
            var img = canvas.toDataURL('image/png');
            var link = document.createElement('a');
            link.href = img;
            link.download = `Liste de la commande du ${date}.png`;
            link.click();
        };
    }
    