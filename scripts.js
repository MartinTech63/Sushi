function adjustButtonPosition() {
    var footer = document.querySelector('footer');
    var footerRect = footer.getBoundingClientRect();
    var windowHeight = window.innerHeight;

    var buttons = document.querySelectorAll('#topBtn, #orderSummaryBtn, #resetBtn');
    buttons.forEach(function(button) {
        if (footerRect.top < windowHeight) {
            button.style.bottom = (windowHeight - footerRect.top + 20) + 'px';
        } else {
            button.style.bottom = '20px';
        }
    });
}

window.addEventListener('scroll', adjustButtonPosition);
window.addEventListener('resize', adjustButtonPosition);
adjustButtonPosition();

// Gestion des quantités et cases à cocher

document.querySelectorAll('.menu-item input[type="checkbox"]').forEach(function(checkbox) {
    checkbox.addEventListener('change', function() {
        var targetId = this.getAttribute('data-target');
        var quantityInput = targetId ? document.getElementById(targetId) : this.nextElementSibling;
        quantityInput.value = this.checked ? 1 : 0;
    });
});

// Bouton retour en haut
var mybutton = document.getElementById("topBtn");
window.onscroll = function() { scrollFunction(); };

function scrollFunction() {
    mybutton.style.opacity = (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) ? "1" : "0";
}

function topFunction() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Génération du résumé de commande
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
    canvas.width = 800;
    canvas.height = 600;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText('Liste de la commande :', 20, 40);
    orderSummary.forEach(function(item, index) {
        ctx.fillText(item.name + ' - Quantité : ' + item.quantity, 20, 80 + index * 30);
    });

    var img = canvas.toDataURL('image/png');
    var link = document.createElement('a');
    link.href = img;
    var today = new Date();
    var date = today.getDate() + '.' + (today.getMonth() + 1) + '.' + today.getFullYear();
    link.download = 'Liste de la commande du ' + date + '.png';
    link.click();
}

// Réinitialisation de la commande
function resetOrder() {
    document.querySelectorAll('.menu-item input[type="checkbox"]').forEach(function(checkbox) {
        checkbox.checked = false;
    });
    document.querySelectorAll('.menu-item input[type="number"]').forEach(function(numberInput) {
        numberInput.value = 0;
    });
}