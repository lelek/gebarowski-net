// The address is assembled here so that it never appears whole in the HTML, which keeps it away from spam harvesters.
function emailAddress(link) {
    return `${link.dataset.emailUser}@${link.dataset.emailDomain}`;
}

function revealEmail(link) {
    const address = emailAddress(link);
    link.href = `mailto:${address}`;
    if (link.hasAttribute('data-email-show')) link.textContent = address;
}

document.querySelectorAll('[data-email-user]').forEach(revealEmail);
