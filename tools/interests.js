import data from './data.js';
import { resolveRanking, joinWithAnd, pickedOrderMarkup } from './ranking.js';
import { readSaved, save, forget } from './storage.js';

const { types, items, answers: answerLabels, itemsPerScreen } = data.interests;
const STORAGE_KEY = 'interests';
const CODE_LENGTH = 3;
const MAX_SCORE = 40;
const SCREENS = items.length / itemsPerScreen;
const ONET_URL = 'https://www.onetonline.org/explore/interests/';
const ONET_NAMES = { R: 'Realistic', I: 'Investigative', A: 'Artistic', S: 'Social', E: 'Enterprising', C: 'Conventional' };

const SUMMARIES = {
    R: 'sprzęt, technika, rzemiosło',
    I: 'analiza, nauka, logika',
    A: 'tworzenie, forma, swoboda',
    S: 'pomaganie, uczenie',
    E: 'wpływ, sprzedaż, ryzyko',
    C: 'porządek, liczby, procedury',
};

const saved = readSaved(STORAGE_KEY);
const state = {
    answers: saved?.answers ?? Array(items.length).fill(null),
    picks: saved?.picks ?? [],
    screen: saved?.screen ?? 0,
    finished: saved?.finished ?? false,
};

const form = document.getElementById('questionnaire');
const questionList = document.getElementById('questions');
const screenLabel = document.getElementById('screen-label');
const progressLabel = document.getElementById('progress-label');
const progressFill = document.getElementById('progress-fill');
const missingNote = document.getElementById('missing');
const backButton = document.getElementById('back');
const nextButton = document.getElementById('next');
const result = document.getElementById('result');

function persist() {
    save(STORAGE_KEY, state);
}

function screenIndexes(screen) {
    const first = screen * itemsPerScreen;
    return Array.from({ length: itemsPerScreen }, (_, offset) => first + offset);
}

function optionMarkup(index, value) {
    const checked = state.answers[index] === value ? ' checked' : '';
    return `<label class="option">
        <input type="radio" name="q${index}" value="${value}"${checked} aria-label="${answerLabels[value]}">
        <span class="dot" aria-hidden="true">${value}</span>
    </label>`;
}

function questionMarkup(index) {
    const options = answerLabels.map((_, value) => optionMarkup(index, value)).join('');
    return `<li class="question" data-index="${index}">
        <p class="question-text" id="q${index}-text"><span class="number">${index + 1}</span><span>${items[index].text}</span></p>
        <div class="options" role="radiogroup" aria-labelledby="q${index}-text">${options}</div>
        <p class="scale-ends" aria-hidden="true"><span>0: ${answerLabels[0]}</span><span>${answerLabels.length - 1}: ${answerLabels.at(-1)}</span></p>
    </li>`;
}

function answeredCount() {
    return state.answers.filter((answer) => answer !== null).length;
}

function renderProgress() {
    const answered = answeredCount();
    screenLabel.textContent = `Ekran ${state.screen + 1} z ${SCREENS}`;
    progressLabel.textContent = `${answered} z ${items.length} odpowiedzi`;
    progressFill.style.width = `${(answered / items.length) * 100}%`;
}

function renderScreen() {
    questionList.innerHTML = screenIndexes(state.screen).map(questionMarkup).join('');
    backButton.disabled = state.screen === 0;
    nextButton.textContent = state.screen === SCREENS - 1 ? 'Pokaż wynik' : 'Dalej';
    missingNote.textContent = '';
    renderProgress();
}

function unansweredOnScreen() {
    return screenIndexes(state.screen).filter((index) => state.answers[index] === null);
}

function showMissing(unanswered) {
    const numbers = unanswered.map((index) => index + 1);
    const noun = numbers.length === 1 ? 'pytaniu' : 'pytaniach';
    missingNote.textContent = `Brakuje odpowiedzi przy ${noun}: ${numbers.join(', ')}.`;
    const first = questionList.querySelector(`[data-index="${unanswered[0]}"]`);
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    first.querySelector('input').focus({ preventScroll: true });
}

function goToScreen(screen) {
    state.screen = screen;
    persist();
    renderScreen();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scores() {
    const totals = new Map(types.map(({ letter }) => [letter, 0]));
    items.forEach((item, index) => totals.set(item.type, totals.get(item.type) + state.answers[index]));
    return totals;
}

function typeName(letter) {
    return types.find((type) => type.letter === letter).name;
}

function barMarkup(letter, score, isTop) {
    return `<li class="bar${isTop ? ' top' : ''}">
        <span class="bar-label"><strong>${letter} ${typeName(letter)}</strong><small>${SUMMARIES[letter]}</small></span>
        <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${(score / MAX_SCORE) * 100}%"></span></span>
        <span class="bar-score">${score}<small> / ${MAX_SCORE}</small></span>
    </li>`;
}

function codeMarkup(ranking) {
    return Array.from({ length: CODE_LENGTH }, (_, slot) => {
        const letter = ranking[slot];
        return letter
            ? `<span class="code-cell" title="${typeName(letter)}">${letter}</span>`
            : '<span class="code-cell empty" aria-label="do wyboru">?</span>';
    }).join('');
}

function tieMarkup(tied, totals) {
    const names = joinWithAnd(tied.map(typeName));
    const buttons = tied
        .map((letter) => `<button type="button" class="button secondary" data-pick="${letter}">${letter} ${typeName(letter)}</button>`)
        .join('');
    return `<div class="tie no-print">
        <p><strong>Remis.</strong> ${names} mają po ${totals.get(tied[0])} pkt. Który typ czynności bardziej do Ciebie pasuje? Możesz wrócić do pytań i zobaczyć, które czynności z tych typów ocenił(a)ś wyżej.</p>
        <div class="actions">${buttons}</div>
    </div>`;
}

function tieAreaMarkup(tied, totals) {
    if (tied.length) return tieMarkup(tied, totals);
    return state.picks.length ? pickedOrderMarkup() : '';
}

function renderResult() {
    const totals = scores();
    const { ranking, tied } = resolveRanking(totals, CODE_LENGTH, state.picks);
    document.getElementById('bars').innerHTML = types
        .map(({ letter }) => barMarkup(letter, totals.get(letter), ranking.includes(letter) || tied.includes(letter)))
        .join('');
    document.getElementById('code').innerHTML = codeMarkup(ranking);
    document.getElementById('tie').innerHTML = tieAreaMarkup(tied, totals);
    const complete = ranking.length === CODE_LENGTH;
    document.getElementById('code-text').textContent = complete
        ? `Twój kod zainteresowań: ${ranking.join('')} (${ranking.map(typeName).join(', ').toLowerCase()}).`
        : 'Wybierz typ przy remisie, żeby uzupełnić kod.';
    document.getElementById('onet-code').textContent = complete ? ranking.join('') : 'zainteresowań';
    document.getElementById('onet-link').href = ONET_URL + ranking.map((letter) => ONET_NAMES[letter]).join('/');
}

function showResult() {
    state.finished = true;
    persist();
    form.hidden = true;
    result.hidden = false;
    renderResult();
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showForm(screen) {
    state.finished = false;
    result.hidden = true;
    form.hidden = false;
    goToScreen(screen);
}

questionList.addEventListener('change', (event) => {
    const index = Number(event.target.closest('.question').dataset.index);
    state.answers[index] = Number(event.target.value);
    persist();
    renderProgress();
    if (unansweredOnScreen().length === 0) missingNote.textContent = '';
});

nextButton.addEventListener('click', () => {
    const unanswered = unansweredOnScreen();
    if (unanswered.length) return showMissing(unanswered);
    if (state.screen === SCREENS - 1) return showResult();
    goToScreen(state.screen + 1);
});

backButton.addEventListener('click', () => goToScreen(state.screen - 1));

document.getElementById('tie').addEventListener('click', (event) => {
    const pick = event.target.closest('[data-pick]');
    const reset = event.target.closest('[data-reset]');
    if (!pick && !reset) return;
    state.picks = reset ? [] : [...state.picks, pick.dataset.pick];
    persist();
    renderResult();
});

document.getElementById('print').addEventListener('click', () => window.print());

document.getElementById('edit').addEventListener('click', () => {
    state.picks = [];
    showForm(0);
});

document.getElementById('restart').addEventListener('click', () => {
    forget(STORAGE_KEY);
    state.answers = Array(items.length).fill(null);
    state.picks = [];
    showForm(0);
});

renderScreen();
if (state.finished) {
    form.hidden = true;
    result.hidden = false;
    renderResult();
}
