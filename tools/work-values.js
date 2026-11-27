import data from './data.js';
import { resolveRanking, joinWithAnd, pickedOrderMarkup } from './ranking.js';
import { readSaved, save, forget } from './storage.js';

const { sentences, values, columns, sentencesPerColumn } = data.workValues;
const STORAGE_KEY = 'work-values';
const TOP_VALUES = 2;
const MAX_SCORE = 30;

const SUMMARIES = {
    'Osiągnięcia': 'wykorzystujesz swoje zdolności i widzisz efekty pracy',
    'Niezależność': 'własne pomysły, własne decyzje, mało nadzoru',
    'Uznanie': 'awans, kierowanie innymi, docenienie',
    'Relacje': 'dobrzy współpracownicy, zgodność z zasadami, pomaganie innym',
    'Wsparcie': 'uczciwy pracodawca, przełożeni, którzy stają za Tobą i Cię uczą',
    'Warunki pracy': 'zajęcie, zarobki, stałość, bezpieczeństwo, różnorodność, praca w pojedynkę',
};

const saved = readSaved(STORAGE_KEY);
const state = {
    placement: saved?.placement ?? Array(sentences.length).fill(null),
    picks: saved?.picks ?? [],
    finished: saved?.finished ?? false,
};

const form = document.getElementById('sorting');
const sentenceList = document.getElementById('sentences');
const board = document.getElementById('board');
const placedLabel = document.getElementById('placed-label');
const showButton = document.getElementById('show-result');
const result = document.getElementById('result');

function persist() {
    save(STORAGE_KEY, state);
}

function sentencesIn(points) {
    return state.placement
        .map((placed, index) => (placed === points ? index + 1 : null))
        .filter((number) => number !== null);
}

function isFull(points) {
    return sentencesIn(points).length >= sentencesPerColumn;
}

function optionMarkup(index, { label, points }) {
    return `<label class="option">
        <input type="radio" name="s${index}" value="${points}" aria-label="${label}, ${points} pkt">
        <span class="dot" aria-hidden="true">${points}</span>
    </label>`;
}

function sentenceMarkup(text, index) {
    const options = columns.map((column) => optionMarkup(index, column)).join('');
    const [first, last] = [columns[0], columns.at(-1)];
    return `<li class="question" data-index="${index}">
        <p class="question-text" id="s${index}-text"><span class="number">${index + 1}</span><span>${text}</span></p>
        <div class="options" role="radiogroup" aria-labelledby="s${index}-text">${options}</div>
        <p class="scale-ends" aria-hidden="true"><span>${first.points}: ${first.label.toLowerCase()}</span><span>${last.points}: ${last.label.toLowerCase()}</span></p>
    </li>`;
}

function boardColumnMarkup({ label, points }) {
    const placed = sentencesIn(points);
    const slots = Array.from({ length: sentencesPerColumn }, (_, slot) => {
        const number = placed[slot];
        return number
            ? `<button type="button" class="slot filled" data-remove="${number}" aria-label="Wyjmij zdanie ${number}">${number}</button>`
            : '<span class="slot"></span>';
    }).join('');
    return `<div class="board-column${placed.length === sentencesPerColumn ? ' full' : ''}">
        <span class="board-title"><span class="board-name">${label}</span><span>${points} pkt</span><span class="board-count">${placed.length}/${sentencesPerColumn}</span></span>
        <span class="slots">${slots}</span>
    </div>`;
}

function placedCount() {
    return state.placement.filter((points) => points !== null).length;
}

function syncSentences() {
    sentenceList.querySelectorAll('input').forEach((input) => {
        const index = Number(input.closest('.question').dataset.index);
        const points = Number(input.value);
        input.checked = state.placement[index] === points;
        input.disabled = !input.checked && isFull(points);
    });
}

function renderSorting() {
    syncSentences();
    board.innerHTML = columns.map(boardColumnMarkup).join('');
    const placed = placedCount();
    placedLabel.textContent = `Ułożone zdania: ${placed} z ${sentences.length}`;
    showButton.disabled = placed < sentences.length;
}

function scores() {
    return new Map(values.map(({ name, sentences: numbers, multiplier }) => {
        const sum = numbers.reduce((total, number) => total + state.placement[number - 1], 0);
        return [name, sum * multiplier];
    }));
}

function barMarkup(name, score, isTop) {
    return `<li class="bar${isTop ? ' top' : ''}">
        <span class="bar-label"><strong>${name}</strong><small>${SUMMARIES[name]}</small></span>
        <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${(score / MAX_SCORE) * 100}%"></span></span>
        <span class="bar-score">${score}<small> / ${MAX_SCORE}</small></span>
    </li>`;
}

function tieMarkup(tied, totals) {
    const buttons = tied
        .map((name) => `<button type="button" class="button secondary" data-pick="${name}">${name}</button>`)
        .join('');
    return `<div class="tie no-print">
        <p><strong>Remis.</strong> ${joinWithAnd(tied)} mają po ${totals.get(tied[0])} pkt. Która z tych wartości jest dla Ciebie ważniejsza?</p>
        <div class="actions">${buttons}</div>
    </div>`;
}

function topValuesMarkup(ranking, totals) {
    return Array.from({ length: TOP_VALUES }, (_, slot) => {
        const name = ranking[slot];
        return name
            ? `<li><strong>${name}</strong>, ${totals.get(name)} pkt</li>`
            : '<li class="pending">do wyboru przy remisie</li>';
    }).join('');
}

function keyRowMarkup({ name, sentences: numbers, multiplier }) {
    const points = numbers.map((number) => `${number}: ${state.placement[number - 1]}`).join(', ');
    return `<tr><td>${name}</td><td>${points}</td><td>× ${multiplier}</td></tr>`;
}

function tieAreaMarkup(tied, totals) {
    if (tied.length) return tieMarkup(tied, totals);
    return state.picks.length ? pickedOrderMarkup() : '';
}

function renderResult() {
    const totals = scores();
    const { ranking, tied } = resolveRanking(totals, TOP_VALUES, state.picks);
    const rankOf = (name) => (ranking.includes(name) ? ranking.indexOf(name) : ranking.length);
    const byScore = [...values].sort((a, b) => totals.get(b.name) - totals.get(a.name) || rankOf(a.name) - rankOf(b.name));
    document.getElementById('bars').innerHTML = byScore
        .map(({ name }) => barMarkup(name, totals.get(name), ranking.includes(name) || tied.includes(name)))
        .join('');
    document.getElementById('top-values').innerHTML = topValuesMarkup(ranking, totals);
    document.getElementById('tie').innerHTML = tieAreaMarkup(tied, totals);
    document.getElementById('key').innerHTML = values.map(keyRowMarkup).join('');
}

function showResult() {
    state.finished = true;
    persist();
    form.hidden = true;
    result.hidden = false;
    renderResult();
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showSorting() {
    state.finished = false;
    state.picks = [];
    persist();
    result.hidden = true;
    form.hidden = false;
    renderSorting();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function place(index, points) {
    state.placement[index] = points;
    persist();
    renderSorting();
}

function indexOf(input) {
    return Number(input.closest('.question').dataset.index);
}

sentenceList.addEventListener('click', (event) => {
    if (!event.target.matches('input')) return;
    const index = indexOf(event.target);
    if (state.placement[index] === Number(event.target.value)) place(index, null);
});

sentenceList.addEventListener('change', (event) => {
    place(indexOf(event.target), Number(event.target.value));
});

board.addEventListener('click', (event) => {
    const slot = event.target.closest('[data-remove]');
    if (!slot) return;
    const index = Number(slot.dataset.remove) - 1;
    place(index, null);
    const row = sentenceList.querySelector(`[data-index="${index}"]`);
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.querySelector('input:not(:disabled)').focus({ preventScroll: true });
});

showButton.addEventListener('click', showResult);

document.getElementById('clear').addEventListener('click', () => {
    state.placement = Array(sentences.length).fill(null);
    showSorting();
});

document.getElementById('tie').addEventListener('click', (event) => {
    const pick = event.target.closest('[data-pick]');
    const reset = event.target.closest('[data-reset]');
    if (!pick && !reset) return;
    state.picks = reset ? [] : [...state.picks, pick.dataset.pick];
    persist();
    renderResult();
});

document.getElementById('print').addEventListener('click', () => window.print());
document.getElementById('edit').addEventListener('click', showSorting);

document.getElementById('restart').addEventListener('click', () => {
    forget(STORAGE_KEY);
    state.placement = Array(sentences.length).fill(null);
    showSorting();
});

sentenceList.innerHTML = sentences.map(sentenceMarkup).join('');
renderSorting();
if (state.finished) {
    form.hidden = true;
    result.hidden = false;
    renderResult();
}
