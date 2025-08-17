// === Chauves-souris qui tombent avec image (Halloween) ===
(function () {
  // --- Dates Halloween ---
  const now = new Date();
  const m = now.getMonth(); // 0=Jan, 9=Oct
  const d = now.getDate();
  const isBatsSeason = (m === 9 && d >= 10) || (m === 10 && d <= 10);

  // === Canvas setup ===
  let canvas, ctx, animationId;
  let bats = [];

  const batImg = new Image();
  batImg.src = "SOURCES/bat.png"; 

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "batsCanvas";
    Object.assign(canvas.style, {
      position: "fixed",
      top: 0,
      left: 0,
      pointerEvents: "none",
      zIndex: 0
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Bat {
    constructor() {
      this.reset(true);
    }
    reset(spawnTop = false) {
      this.size = Math.random() * 40 + 20;
      this.x = Math.random() * (canvas ? canvas.width : window.innerWidth);
      this.y = spawnTop ? -this.size : Math.random() * -window.innerHeight;
      this.speed = Math.random() * 2 + 1;
      this.swing = Math.random() * 0.05 + 0.02;
      this.angle = Math.random() * Math.PI * 2;
    }
    update() {
      this.y += this.speed;
      this.x += Math.sin(this.angle) * 2;
      this.angle += this.swing;
      if (canvas && this.y > canvas.height + this.size) this.reset(true);
    }
    draw(ctx) {
      ctx.drawImage(batImg, this.x, this.y, this.size, this.size);
    }
  }

  function createBats(count = 15) {
    bats = [];
    for (let i = 0; i < count; i++) bats.push(new Bat());
  }

  function drawBats() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bats.forEach(b => {
      b.update();
      b.draw(ctx);
    });
    animationId = requestAnimationFrame(drawBats);
  }

  function startBats() {
    ensureCanvas();
    createBats(20);
    cancelAnimationFrame(animationId);
    drawBats();
  }

  function stopBats() {
    cancelAnimationFrame(animationId);
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // === Intégration au popup (switch ON/OFF) ===
  document.addEventListener("DOMContentLoaded", () => {
    if (!isBatsSeason) return;

    // Active automatiquement le thème Halloween
    document.body.classList.add("halloween");

    // Ajout du switch dans le popup (après celui des pétales)
    const petalContainer = document.getElementById("petalSwitchContainer");
    if (petalContainer && !document.getElementById("batsSwitchContainer")) {
      const batsContainer = document.createElement("div");
      batsContainer.id = "batsSwitchContainer";
      batsContainer.className = "switch-container";
      batsContainer.innerHTML = `
        <span>Chauves-souris 🦇</span>
        <label class="switch">
          <input type="checkbox" id="batsToggle">
          <span class="slider round"></span>
        </label>
      `;
      petalContainer.insertAdjacentElement("afterend", batsContainer);

      // Démarrage ON par défaut
      const toggle = document.getElementById("batsToggle");
      toggle.checked = true;
      startBats();

      toggle.addEventListener("change", function () {
        if (this.checked) startBats(); else stopBats();
      });
    }
  });

  // Sécurité : si popup jamais ouvert → démarre quand même
  if (isBatsSeason) {
    window.addEventListener("load", () => {
      if (!document.getElementById("batsSwitchContainer")) {
        startBats();
      }
    });
  }
})();
