(function () {
  const canvas = document.getElementById('petalsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  const isPetalSeason =
    (currentMonth === 2 && currentDay >= 25) ||
    (currentMonth === 3) ||
    (currentMonth === 4 && currentDay <= 10);

  let animationId;
  let petals = [];

  class Petal {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height - canvas.height;
      this.size = Math.random() * 5 + 5;
      this.speed = Math.random() * 2 + 1;
      this.angle = Math.random() * Math.PI * 2;
      this.spin = Math.random() * 0.05 - 0.025;
    }

    update() {
      this.y += this.speed;
      this.angle += this.spin;
      if (this.y > canvas.height) {
        this.y = -this.size;
        this.x = Math.random() * canvas.width;
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = 'rgba(255, 182, 193, 0.8)';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size, this.size / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function createPetals() {
    petals = [];
    for (let i = 0; i < 50; i++) {
      petals.push(new Petal());
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    petals.forEach(petal => {
      petal.update();
      petal.draw();
    });
    animationId = requestAnimationFrame(animate);
  }

  function stopPetals() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function startPetals() {
    // S'assure qu'une seule animation tourne à la fois
    stopPetals();
    createPetals();
    animate();
  }

  // Resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('petalToggle');
    const switchContainer = document.getElementById('petalSwitchContainer');

    // Si on ne trouve pas les éléments, on ne fait rien
    if (!toggle || !switchContainer) return;

    if (!isPetalSeason) {
      // Hors période : le switch disparaît complètement et les pétales sont coupées.
      switchContainer.style.display = 'none';
      toggle.checked = false;
      stopPetals();
    } else {
      // En période : switch visible, coché par défaut, pétales actives.
      switchContainer.style.display = '';
      toggle.checked = true;
      startPetals();

      toggle.addEventListener('change', function () {
        if (this.checked) {
          startPetals();
        } else {
          stopPetals();
        }
      });
    }
  });

  // Helpers de test pour la console (n'affectent pas la logique de dates)
  window.__petalsTest = {
    on() {
      const toggle = document.getElementById('petalToggle');
      const switchContainer = document.getElementById('petalSwitchContainer');
      if (switchContainer) switchContainer.style.display = '';
      if (toggle) toggle.checked = true;
      startPetals();
    },
    off() {
      const toggle = document.getElementById('petalToggle');
      const switchContainer = document.getElementById('petalSwitchContainer');
      if (switchContainer) switchContainer.style.display = '';
      if (toggle) toggle.checked = false;
      stopPetals();
    }
  };

  // La gestion de la popup (ouverture/fermeture + scroll lock)
  // est centralisée dans `popup.js` pour éviter les doublons.
})();