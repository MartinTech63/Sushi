    function resetOrder() {
        document.querySelectorAll('.menu-item input[type="checkbox"]').forEach(function(checkbox) {
            checkbox.checked = false;
        });
        document.querySelectorAll('.menu-item input[type="number"]').forEach(function(numberInput) {
            numberInput.value = 0;
        });
    }
