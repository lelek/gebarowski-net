function highestRemaining(scores, ranked) {
    const remaining = [...scores.keys()].filter((key) => !ranked.includes(key));
    const best = Math.max(...remaining.map((key) => scores.get(key)));
    return remaining.filter((key) => scores.get(key) === best);
}

export function resolveRanking(scores, length, picks) {
    const ranking = [];
    let pickIndex = 0;
    while (ranking.length < length) {
        const tied = highestRemaining(scores, ranking);
        if (tied.length === 1) {
            ranking.push(tied[0]);
            continue;
        }
        const pick = picks[pickIndex];
        if (!tied.includes(pick)) return { ranking, tied };
        ranking.push(pick);
        pickIndex += 1;
    }
    return { ranking, tied: [] };
}

export function joinWithAnd(words) {
    if (words.length < 2) return words.join('');
    return `${words.slice(0, -1).join(', ')} i ${words.at(-1)}`;
}

export function pickedOrderMarkup() {
    return `<p class="note no-print">Kolejność przy remisie wybrał(a)ś sam(a). <button type="button" class="text-button" data-reset>Zmień wybór</button></p>`;
}
