/** Sakura petals effect — loaded by seasons.js when in season. */
(function () {
  'use strict';

  var canvas = document.getElementById('petalsCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'petalsCanvas';
    canvas.className = 'petals-canvas';
    document.body.appendChild(canvas);
  }
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var animationId = null;
  var petals = [];
  var running = false;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function Petal() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height - canvas.height;
    this.size = Math.random() * 5 + 5;
    this.speed = Math.random() * 2 + 1;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = Math.random() * 0.05 - 0.025;
  }

  Petal.prototype.update = function () {
    this.y += this.speed;
    this.angle += this.spin;
    if (this.y > canvas.height) {
      this.y = -this.size;
      this.x = Math.random() * canvas.width;
    }
  };

  Petal.prototype.draw = function () {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = 'rgba(255, 182, 193, 0.8)';
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    petals.forEach(function (p) {
      p.update();
      p.draw();
    });
    animationId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function start() {
    stop();
    running = true;
    resize();
    petals = [];
    for (var i = 0; i < 50; i++) petals.push(new Petal());
    animate();
  }

  window.addEventListener('resize', function () {
    if (running) resize();
  });

  document.addEventListener('sushi:season-toggle', function (e) {
    if (!e.detail || e.detail.id !== 'sakura') return;
    if (e.detail.enabled) start();
    else stop();
  });

  // Default on when effect script loads (toggle may fire shortly after).
  start();
})();
