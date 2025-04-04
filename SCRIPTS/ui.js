    function adjustButtonPosition() {
        var footer = document.querySelector('footer');
        var footerRect = footer.getBoundingClientRect();
        var windowHeight = window.innerHeight;

        var buttons = document.querySelectorAll('#topBtn, #orderSummaryBtn, #resetBtn');
        buttons.forEach(function(button) {
            var buttonRect = button.getBoundingClientRect();
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
