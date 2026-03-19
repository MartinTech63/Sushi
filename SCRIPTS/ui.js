function adjustButtonPosition() {
    var footer = document.querySelector('footer');
    if (!footer) return;

    var footerRect = footer.getBoundingClientRect();
    var windowHeight = window.innerHeight;

    var buttons = document.querySelectorAll('#topBtn, #orderSummaryBtn, #resetBtn');
    buttons.forEach(function(button) {
        if (!button) return;
        if (footerRect.top < windowHeight) {
            button.style.bottom = (windowHeight - footerRect.top + 20) + 'px';
        } else {
            button.style.bottom = '20px';
        }
    });
}

function debounce(fn, delay) {
    var timer = null;
    return function() {
        var self = this;
        var args = arguments;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(self, args); }, delay);
    };
}

var debouncedAdjust = debounce(adjustButtonPosition, 80);

window.addEventListener('scroll', debouncedAdjust);
window.addEventListener('resize', debouncedAdjust);
adjustButtonPosition();