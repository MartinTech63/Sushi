// This script generates a unique order ID based on the selected menu items and their quantities.
function generateOrderId() {
    var orderData = [];

    function updateOrderId() {
        var orderId = btoa(JSON.stringify(orderData));
        console.log("Updated Order ID:", orderId);
        return orderId;
    }

    document.querySelectorAll('.menu-item').forEach(function(item) {
        var checkbox = item.querySelector('input[type="checkbox"]');
        var quantityInput = item.querySelector('input[type="number"]');

        checkbox.addEventListener('change', function() {
            var itemName = item.querySelector('span').innerText.split(' | ')[0]; // Extract the number before the " | "
            var quantity = quantityInput.value;

            if (checkbox.checked) {
                if (itemName === 'Boule de glace') {
                    item.querySelectorAll('input[type="checkbox"]').forEach(function(flavorCheckbox) {
                        if (flavorCheckbox.checked) {
                            var flavorQuantity = item.querySelector('#' + flavorCheckbox.getAttribute('data-target')).value;
                            orderData.push({
                                name: itemName,
                                quantity: flavorQuantity
                            });
                        }
                    });
                } else {
                    orderData.push({
                        name: itemName,
                        quantity: quantity
                    });
                }
            } else {
                orderData = orderData.filter(function(orderItem) {
                    return orderItem.name !== itemName;
                });
            }
            updateOrderId();
        });

        quantityInput.addEventListener('input', function() {
            var itemName = item.querySelector('span').innerText.split(' | ')[0]; // Extract the number before the " | "
            var quantity = quantityInput.value;

            if (checkbox.checked) {
                var existingItem = orderData.find(function(orderItem) {
                    return orderItem.name === itemName;
                });

                if (existingItem) {
                    existingItem.quantity = quantity;
                } else {
                    orderData.push({
                        name: itemName,
                        quantity: quantity
                    });
                }
            } else {
                orderData = orderData.filter(function(orderItem) {
                    return orderItem.name !== itemName;
                });
            }

            updateOrderId();
        });
    });

    return updateOrderId();
}

// Example usage
var orderId = generateOrderId();
