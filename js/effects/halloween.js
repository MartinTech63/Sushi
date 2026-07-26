/** Halloween bats effect — loaded by seasons.js when in season. */
(function () {
  'use strict';

  var canvas = null;
  var ctx = null;
  var animationId = null;
  var bats = [];
  var running = false;

  var batImg = new Image();
  batImg.src = '/assets/bat.png';

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'batsCanvas';
    canvas.className = 'season-fx-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', function () {
      if (running) resize();
    });
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function Bat() {
    this.reset(true);
  }

  Bat.prototype.reset = function (spawnTop) {
    this.size = Math.random() * 40 + 20;
    this.x = Math.random() * (canvas ? canvas.width : window.innerWidth);
    this.y = spawnTop ? -this.size : Math.random() * -window.innerHeight;
    this.speed = Math.random() * 2 + 1;
    this.swing = Math.random() * 0.05 + 0.02;
    this.angle = Math.random() * Math.PI * 2;
  };

  Bat.prototype.update = function () {
    this.y += this.speed;
    this.x += Math.sin(this.angle) * 2;
    this.angle += this.swing;
    if (canvas && this.y > canvas.height + this.size) this.reset(true);
  };

  Bat.prototype.draw = function () {
    ctx.drawImage(batImg, this.x, this.y, this.size, this.size);
  };

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bats.forEach(function (b) {
      b.update();
      b.draw();
    });
    animationId = requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function start() {
    ensureCanvas();
    stop();
    running = true;
    bats = [];
    for (var i = 0; i < 20; i++) bats.push(new Bat());
    draw();
  }

  document.addEventListener('sushi:season-toggle', function (e) {
    if (!e.detail || e.detail.id !== 'halloween') return;
    if (e.detail.enabled) start();
    else stop();
  });

  start();
})();
