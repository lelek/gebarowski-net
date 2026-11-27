const menu = document.querySelector('.menu');
const button = menu.querySelector('.menu-button');

function setOpen(open) {
    menu.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
}

button.addEventListener('click', () => setOpen(!menu.classList.contains('open')));

document.addEventListener('click', event => {
    if (!menu.contains(event.target)) setOpen(false);
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !menu.classList.contains('open')) return;
    setOpen(false);
    button.focus();
});
