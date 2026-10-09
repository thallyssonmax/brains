const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('#mobile-nav-links');
const mobileMenu = window.matchMedia('(max-width: 900px)');

function setMenuOpen(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  navLinks.classList.toggle('is-open', open);
  navLinks.inert = mobileMenu.matches && !open;
}

setMenuOpen(false);
menuButton.addEventListener('click', () => {
  setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
});

document.addEventListener('pointerdown', (event) => {
  if (mobileMenu.matches && !menuButton.contains(event.target) && !navLinks.contains(event.target)) {
    setMenuOpen(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false);
    menuButton.focus();
  }
});

navLinks.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenuOpen(false);
});

mobileMenu.addEventListener('change', () => setMenuOpen(false));
