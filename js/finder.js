// Postcode-based verified-stockist finder (Action A). Talks to the Worker's
// GET /api/stockists endpoint. See worker/src/stockists.js for the backend
// logic and worker/README.md + scripts/ingest/ for how stockist data gets
// into D1 in the first place.

const API_BASE = window.API_BASE_URL || '';

const form = document.getElementById('finderForm');
const input = document.getElementById('postcodeInput');
const submitBtn = document.getElementById('finderSubmitBtn');
const statusEl = document.getElementById('finderStatus');
const resultsEl = document.getElementById('finderResults');
const messagePanel = document.getElementById('finderMessagePanel');

function reportHit(type) {
  if (window.__campaignHit) window.__campaignHit(type);
}

function formatDate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function setStatus(message, tone) {
  statusEl.textContent = message || '';
  statusEl.className = 'finder-status' + (tone ? ` finder-status--${tone}` : '');
}

function clearResults() {
  resultsEl.innerHTML = '';
  messagePanel.hidden = true;
  messagePanel.innerHTML = '';
}

function emptyStateNode(message) {
  const wrap = document.createElement('div');
  wrap.className = 'finder-empty';
  const p = document.createElement('p');
  p.textContent = message;
  wrap.appendChild(p);

  const actions = document.createElement('div');
  actions.className = 'btn-row';

  const retailersBtn = document.createElement('a');
  retailersBtn.className = 'link-btn';
  retailersBtn.href = '#retailers';
  retailersBtn.textContent = 'Ask a national retailer instead';
  actions.appendChild(retailersBtn);

  const petitionBtn = document.createElement('a');
  petitionBtn.className = 'link-btn';
  petitionBtn.href = '#petition';
  petitionBtn.textContent = 'Sign the petition instead';
  actions.appendChild(petitionBtn);

  wrap.appendChild(actions);
  return wrap;
}

function displayName(chainName, branchName) {
  if (branchName && branchName.toLowerCase().includes(chainName.toLowerCase())) return branchName;
  return `${chainName} — ${branchName}`;
}

function buildMessageTemplate(name) {
  return `Subject: Please stop selling camera-equipped smart glasses

Dear ${name},

I'm asking you to stop selling camera-equipped smart glasses, including Ray-Ban Meta glasses.

As a local optician, you're an important part of your high street and community. You may have known some of your customers and their families for years. People trust you with their sight, their health and the products you recommend.

So why sell a device that can be used to record those same customers – and other people in your community – without their knowledge or consent?

Smart glasses allow people to film those around them without holding up a phone or camera. The person buying the glasses chooses to wear a camera on their face. The people around them get no such choice.

Women. Children. Older people. People with disabilities. Vulnerable people. Your customers, their families and your neighbours.

And the danger isn't hypothetical. Smart glasses have already been linked to cases involving non-consensual intimate recording, sextortion and blackmail:

Non-consensual intimate recording:
https://www.telegraph.co.uk/news/2026/01/09/man-smart-glasses-illegally-record-sex-spared-jail/

Sextortion:
https://www.ubergizmo.com/2026/05/can-smart-glasses-be-used-for-extortion/

Blackmail:
https://www.bbc.co.uk/news/articles/cwy87wqz0q9o

A small LED recording light is not consent, or an adequate safeguard. Cheap stickers capable of obscuring LED lights are readily available.

Meta has already helped put millions of camera-equipped glasses into circulation, and other technology companies are developing smart eyewear of their own. We need to stop cameras worn on people's faces becoming normal.

Your business is built around helping people see clearly.

We're asking you to open your eyes to the dangers of camera-equipped smart glasses – and stop selling them.

Protect the trust your community places in you. Don't help normalise a technology that allows people to record others without their knowledge or consent.

You can read more about the campaign and the evidence behind it here:
[CAMPAIGN WEBSITE]

Yours Sincerely,
[Your name]`;
}

function mailtoUrl(text, recipient) {
  const lines = text.split('\n');
  const subjectLine = lines[0].replace(/^Subject:\s*/i, '');
  const body = lines.slice(1).join('\n').trim();
  const to = recipient ? encodeURIComponent(recipient) : '';
  return `mailto:${to}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
}

function renderMessagePanel(stockist) {
  const name = displayName(stockist.chain.name, stockist.branchName);
  const text = buildMessageTemplate(name);
  const contact = stockist.contact || {};

  messagePanel.innerHTML = '';
  messagePanel.hidden = false;

  const heading = document.createElement('h3');
  heading.textContent = `Message to ${name}`;
  messagePanel.appendChild(heading);

  const label = document.createElement('label');
  label.className = 'field-label visually-hidden';
  label.setAttribute('for', 'finderMessageBody');
  label.textContent = 'Message text';
  messagePanel.appendChild(label);

  const textarea = document.createElement('textarea');
  textarea.id = 'finderMessageBody';
  textarea.value = text;
  messagePanel.appendChild(textarea);

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy message';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(textarea.value).then(() => {
      copiedMsg.classList.add('show');
      setTimeout(() => copiedMsg.classList.remove('show'), 1800);
    });
    reportHit('retailer_action_started');
  });
  btnRow.appendChild(copyBtn);

  // Contact preference order: email > contact_form > branch_page /
  // central_contact > phone. Only one secondary action is shown — the best
  // one actually available for this branch, so the supporter never has to
  // work out which channel to use themselves.
  if (contact.type === 'email' && contact.value) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary';
    btn.textContent = 'Open in email app';
    btn.addEventListener('click', () => {
      window.location.href = mailtoUrl(textarea.value, contact.value);
      reportHit('retailer_action_started');
    });
    btnRow.appendChild(btn);
  } else if ((contact.type === 'contact_form' || contact.type === 'branch_page' || contact.type === 'central_contact') && contact.url) {
    const btn = document.createElement('a');
    btn.className = 'link-btn';
    btn.href = contact.url;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.textContent =
      contact.type === 'contact_form' ? 'Open contact form ↗' : contact.type === 'branch_page' ? 'Visit branch page ↗' : "Visit retailer's contact page ↗";
    btn.addEventListener('click', () => reportHit('retailer_action_started'));
    btnRow.appendChild(btn);
  } else if (contact.phone) {
    const btn = document.createElement('a');
    btn.className = 'link-btn';
    btn.href = `tel:${contact.phone.replace(/\s+/g, '')}`;
    btn.textContent = `Call this branch — ${contact.phone}`;
    btn.addEventListener('click', () => reportHit('retailer_action_started'));
    btnRow.appendChild(btn);
  }

  messagePanel.appendChild(btnRow);

  const copiedMsg = document.createElement('span');
  copiedMsg.className = 'copied-msg';
  copiedMsg.textContent = 'Copied ✓';
  btnRow.appendChild(copiedMsg);

  messagePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderCard(stockist) {
  const card = document.createElement('div');
  card.className = 'card stockist-card';

  const name = displayName(stockist.chain.name, stockist.branchName);

  const heading = document.createElement('h3');
  heading.className = 'stockist-card__name';
  heading.textContent = name;
  card.appendChild(heading);

  const distance = document.createElement('div');
  distance.className = 'stockist-card__distance';
  distance.textContent = `${stockist.distanceMiles} miles away`;
  card.appendChild(distance);

  const address = document.createElement('div');
  address.className = 'stockist-card__address';
  address.textContent = `${stockist.location.address}, ${stockist.location.postcode}`;
  card.appendChild(address);

  const badge = document.createElement('div');
  badge.className = 'verified-badge';
  badge.textContent = 'Verified Meta Ray-Ban seller';
  card.appendChild(badge);

  const sourceLine = document.createElement('div');
  sourceLine.className = 'source-note';
  const checkedDate = formatDate(stockist.verification.lastVerifiedAt);
  sourceLine.textContent = `${stockist.verification.sourceLabel || "Verified from the retailer's own website"}${checkedDate ? ` · checked ${checkedDate}` : ''}`;
  card.appendChild(sourceLine);

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.textContent = 'Ask this retailer to stop';
  actionBtn.addEventListener('click', () => {
    reportHit('stockist_selected');
    renderMessagePanel(stockist);
  });
  btnRow.appendChild(actionBtn);

  if (stockist.verification.sourceUrl) {
    const sourceBtn = document.createElement('a');
    sourceBtn.className = 'secondary-link';
    sourceBtn.href = stockist.verification.sourceUrl;
    sourceBtn.target = '_blank';
    sourceBtn.rel = 'noopener';
    sourceBtn.textContent = 'See source';
    btnRow.appendChild(sourceBtn);
  }

  card.appendChild(btnRow);
  return card;
}

async function runSearch(postcode) {
  clearResults();

  if (!API_BASE) {
    setStatus('Search is being set up for this campaign right now — in the meantime, you can contact opticians, Ray-Ban, or major retailers directly using the actions below.', 'info');
    return;
  }

  setStatus('Searching…', 'info');
  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/stockists?postcode=${encodeURIComponent(postcode)}`);
    const data = await res.json();

    if (data.error === 'missing_postcode') {
      setStatus(data.message, 'error');
      return;
    }

    // Invalid postcode / lookup-unavailable are corrective messages the
    // supporter needs to act on (fix their input, or try again shortly) —
    // shown as a plain status line, no "browse retailers instead" clutter.
    // Only a genuine "valid postcode, nothing verified nearby yet" result
    // gets the richer empty state with next-action buttons.
    if (data.reason === 'invalid_postcode' || data.reason === 'lookup_unavailable' || data.reason === 'eircode_not_supported') {
      setStatus(data.message, 'error');
      return;
    }

    reportHit('finder_search');

    if (!data.results || data.results.length === 0) {
      setStatus('', null);
      resultsEl.appendChild(emptyStateNode(data.message || "We haven't verified a Meta Ray-Ban seller near this postcode yet."));
      return;
    }

    setStatus(`${data.results.length} verified seller${data.results.length === 1 ? '' : 's'} found${data.radiusMiles ? ` within ${data.radiusMiles} miles` : ''}.`, 'success');
    for (const stockist of data.results) {
      resultsEl.appendChild(renderCard(stockist));
    }
  } catch (err) {
    // Fail gracefully — the rest of the campaign page must keep working
    // even if the finder API is unreachable.
    setStatus('Search is temporarily unavailable — please try again shortly, or use the actions below in the meantime.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const postcode = input.value.trim();
  if (!postcode) {
    setStatus('Enter a postcode to search.', 'error');
    return;
  }
  runSearch(postcode);
});
