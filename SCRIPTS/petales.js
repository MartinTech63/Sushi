  const canvas = document.getElementById('petalsCanvas');
  const ctx = canvas.getContext('2d');
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

  function startPetals() {
    createPetals();
    animate();
  }

  function stopPetals() {
    cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('petalToggle');
    const switchContainer = document.getElementById('petalSwitchContainer');

    if (!isPetalSeason) {
      // Cacher le switch ET désactiver les pétales
      switchContainer.style.display = 'none';
      stopPetals();
    } else {
      // Période autorisée → démarrer + afficher le switch
      startPetals();
      toggle.checked = true;

      toggle.addEventListener('change', function () {
        if (this.checked) {
          startPetals();
        } else {
          stopPetals();
        }
      });
    }
  });

  // Popup fade + scroll lock
  window.onload = function () {
    const popup = document.getElementById("popupOverlay");
    popup.style.display = "flex";
    document.body.classList.add("noscroll");
    setTimeout(() => {
      popup.classList.add("show");
    }, 10);
  };

  function closePopup() {
    const popup = document.getElementById("popupOverlay");
    popup.classList.remove("show");
    document.body.classList.remove("noscroll");
    setTimeout(() => {
      popup.style.display = "none";
    }, 500);
  }
