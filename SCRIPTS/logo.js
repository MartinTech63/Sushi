function playSound() {
    var el = document.getElementById("logoSound");
    if (el && el.play) el.play().catch(function () {});
}
