const card = document.querySelector('#demo-card');

if (card) {
  const front = card.querySelector('.demo-card-front');
  const back = card.querySelector('.demo-card-back');

  card.querySelectorAll('[data-flip]').forEach(button => {
    button.addEventListener('click', () => {
      const showingBack = card.classList.toggle('is-flipped');
      front.inert = showingBack;
      back.inert = !showingBack;
      front.setAttribute('aria-hidden', String(showingBack));
      back.setAttribute('aria-hidden', String(!showingBack));
      (showingBack ? back : front).querySelector('[data-flip]').focus({ preventScroll: true });
    });
  });
}

const howStep = document.querySelector('#como-usar .steps li');
const howIllustration = document.querySelector('#como-usar .illustration');

if (howStep && howIllustration && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    howIllustration.style.setProperty('--how-step-height', `${howStep.getBoundingClientRect().height}px`);
  }).observe(howStep);
}
