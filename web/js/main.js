/**
 * Biffage Landing Page - Animations & Effects
 */

// ===== FLOATING SHAPES ANIMATION =====
class FloatingShapeAnimator {
  constructor() {
    this.shapes = document.querySelectorAll('.floating-shape');
    this.animationFrames = [];
  }

  init() {
    // Make shapes visible with staggered delay
    this.shapes.forEach((shape, index) => {
      setTimeout(() => {
        shape.classList.add('visible');
      }, index * 200);
    });

    // Start floating animation
    this.shapes.forEach((shape, index) => {
      this.animateShape(shape, index);
    });
  }

  animateShape(shape, index) {
    const baseDelay = index * 2500;
    let startTime = null;
    const duration = 15000 + (index * 2000);

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = ((timestamp - startTime + baseDelay) % duration) / duration;
      
      const x = Math.sin(progress * Math.PI * 2) * 30;
      const y = Math.cos(progress * Math.PI * 2) * 30;
      const rotation = progress * 360;
      const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.1;

      shape.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
      
      this.animationFrames[index] = requestAnimationFrame(animate);
    };

    this.animationFrames[index] = requestAnimationFrame(animate);
  }
}

// ===== FLOATING EMOJIS =====
class FloatingEmojis {
  constructor(container) {
    this.container = container;
    this.emojis = ['🎉', '🎮', '🤪', '😂', '🏆', '✨', '🔥', '🎯', '💫', '🤣'];
    this.emojiElements = [];
  }

  init() {
    this.createEmojis();
    this.animateEmojis();
  }

  createEmojis() {
    this.emojis.forEach((emoji, index) => {
      const el = document.createElement('div');
      el.className = 'floating-emoji';
      el.textContent = emoji;
      el.style.left = `${5 + (index * 10)}%`;
      el.style.top = `${15 + ((index * 17) % 70)}%`;
      
      this.container.appendChild(el);
      this.emojiElements.push(el);

      // Staggered visibility
      setTimeout(() => {
        el.classList.add('visible');
      }, 500 + index * 150);
    });
  }

  animateEmojis() {
    this.emojiElements.forEach((el, index) => {
      const duration = 4000 + (index * 500);
      const delay = index * 300;
      let startTime = null;

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = ((timestamp - startTime + delay) % duration) / duration;

        const y = Math.sin(progress * Math.PI * 2) * 25;
        const rotation = Math.sin(progress * Math.PI * 2) * 15;
        const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.1;

        el.style.transform = `translateY(${y}px) rotate(${rotation}deg) scale(${scale})`;
        
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    });
  }
}

// ===== LOGO WIGGLE ANIMATION =====
class LogoAnimator {
  constructor(logo) {
    this.logo = logo;
    this.startTime = null;
  }

  init() {
    // Initial entrance animation
    setTimeout(() => {
      this.logo.classList.add('visible');
    }, 100);

    // Continuous wiggle
    setTimeout(() => {
      this.startWiggle();
    }, 900);
  }

  startWiggle() {
    const animate = (timestamp) => {
      if (!this.startTime) this.startTime = timestamp;
      const progress = (timestamp - this.startTime) / 3000;

      const rotation = Math.sin(progress * Math.PI * 2) * 2;
      const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.02;

      this.logo.style.transform = `rotate(${rotation}deg) scale(${scale})`;
      
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }
}

// ===== RAINBOW TEXT ANIMATION =====
class RainbowTextAnimator {
  constructor() {
    this.elements = document.querySelectorAll('.rainbow-text');
  }

  init() {
    this.elements.forEach(el => {
      let position = 0;
      
      const animate = () => {
        position = (position + 0.5) % 200;
        el.style.backgroundPosition = `${position}% center`;
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    });
  }
}

// ===== SCROLL HINT BOUNCE =====
class ScrollHintAnimator {
  constructor(element) {
    this.element = element;
    this.startTime = null;
  }

  init() {
    setTimeout(() => {
      this.element.classList.add('visible');
      this.startBounce();
    }, 800);

    // Hide on scroll
    window.addEventListener('scroll', () => {
      if (window.scrollY > 100) {
        this.element.style.opacity = '0';
      } else {
        this.element.style.opacity = '';
      }
    }, { passive: true });
  }

  startBounce() {
    const arrow = this.element.querySelector('span');
    
    const animate = (timestamp) => {
      if (!this.startTime) this.startTime = timestamp;
      const progress = (timestamp - this.startTime) / 1500;

      const y = Math.sin(progress * Math.PI * 2) * 10;
      arrow.style.transform = `translateY(${y}px)`;
      
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }
}

// ===== SCROLL REVEAL ANIMATIONS =====
class ScrollReveal {
  constructor() {
    this.elements = document.querySelectorAll(
      '.section-title, .step-card, .feature-card, .cta-section h2, .cta-section p, .cta-section .cta-group'
    );
  }

  init() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add staggered delay for cards
          const card = entry.target;
          const parent = card.parentElement;
          
          if (parent && (parent.classList.contains('steps-grid') || parent.classList.contains('features-grid'))) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(card);
            
            setTimeout(() => {
              card.classList.add('visible');
            }, index * 100);
          } else {
            card.classList.add('visible');
          }
          
          observer.unobserve(entry.target);
        }
      });
    }, { 
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    this.elements.forEach(el => observer.observe(el));
  }
}

// ===== PARTICLE EFFECT =====
class ParticleEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.colors = ['#ffe66d', '#ff6eb4', '#38bdf8', '#a855f7', '#ff6b35'];
    this.mouseX = 0;
    this.mouseY = 0;
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Track mouse for interactive particles
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    // Create initial particles
    for (let i = 0; i < 50; i++) {
      this.createParticle();
    }

    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createParticle(x, y) {
    const particle = {
      x: x || Math.random() * this.canvas.width,
      y: y || Math.random() * this.canvas.height,
      size: Math.random() * 4 + 1,
      speedX: (Math.random() - 0.5) * 0.5,
      speedY: (Math.random() - 0.5) * 0.5,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      opacity: Math.random() * 0.5 + 0.1,
      life: 1
    };
    this.particles.push(particle);
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p, index) => {
      // Update position
      p.x += p.speedX;
      p.y += p.speedY;

      // Slight attraction to mouse
      const dx = this.mouseX - p.x;
      const dy = this.mouseY - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 200) {
        p.speedX += dx * 0.00005;
        p.speedY += dy * 0.00005;
      }

      // Wrap around screen
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1;
    requestAnimationFrame(() => this.animate());
  }
}

// ===== BUTTON RIPPLE EFFECT =====
class ButtonEffects {
  constructor() {
    this.buttons = document.querySelectorAll('.btn-cartoon');
  }

  init() {
    this.buttons.forEach(btn => {
      btn.addEventListener('mouseenter', (e) => {
        this.createSparkle(e, btn);
      });
    });
  }

  createSparkle(e, btn) {
    const rect = btn.getBoundingClientRect();
    const sparkles = 5;

    for (let i = 0; i < sparkles; i++) {
      const sparkle = document.createElement('span');
      sparkle.style.cssText = `
        position: fixed;
        pointer-events: none;
        font-size: ${12 + Math.random() * 8}px;
        left: ${rect.left + Math.random() * rect.width}px;
        top: ${rect.top + Math.random() * rect.height}px;
        z-index: 1000;
        animation: sparkleFloat 0.8s ease-out forwards;
      `;
      sparkle.textContent = ['✨', '⭐', '💫'][Math.floor(Math.random() * 3)];
      document.body.appendChild(sparkle);

      setTimeout(() => sparkle.remove(), 800);
    }
  }
}

// Add sparkle animation styles dynamically
const sparkleStyles = document.createElement('style');
sparkleStyles.textContent = `
  @keyframes sparkleFloat {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-40px) scale(0.5);
    }
  }
`;
document.head.appendChild(sparkleStyles);

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all animations
  const floatingShapes = new FloatingShapeAnimator();
  floatingShapes.init();

  const emojisContainer = document.querySelector('.floating-emojis');
  if (emojisContainer) {
    const floatingEmojis = new FloatingEmojis(emojisContainer);
    floatingEmojis.init();
  }

  const logo = document.querySelector('.logo');
  if (logo) {
    const logoAnimator = new LogoAnimator(logo);
    logoAnimator.init();
  }

  const rainbowText = new RainbowTextAnimator();
  rainbowText.init();

  const scrollHint = document.querySelector('.scroll-hint');
  if (scrollHint) {
    const scrollHintAnimator = new ScrollHintAnimator(scrollHint);
    scrollHintAnimator.init();
  }

  const scrollReveal = new ScrollReveal();
  scrollReveal.init();

  const particleCanvas = document.getElementById('particle-canvas');
  if (particleCanvas) {
    const particleEffect = new ParticleEffect(particleCanvas);
    particleEffect.init();
  }

  const buttonEffects = new ButtonEffects();
  buttonEffects.init();

  // Hero elements entrance animation
  const tagline = document.querySelector('.tagline');
  const ctaGroup = document.querySelector('.hero .cta-group');
  
  setTimeout(() => tagline?.classList.add('visible'), 300);
  setTimeout(() => ctaGroup?.classList.add('visible'), 500);
});

// ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

