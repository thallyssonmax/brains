const flip = document.querySelector('#flip');
let showingBack = false;
flip.addEventListener('click', () => {
  showingBack = !showingBack;
  document.querySelector('#card-side').textContent = showingBack ? 'VERSO DO CARTÃO' : 'FRENTE DO CARTÃO';
  document.querySelector('#card-word').textContent = showingBack ? 'É isso aí.' : 'That’s it.';
  document.querySelector('#card-meaning').textContent = showingBack ? 'Ou “Só isso”, dependendo do contexto.' : 'Você lembra o que significa?';
  flip.textContent = showingBack ? 'Voltar à expressão ↻' : 'Conferir significado ↻';
});
