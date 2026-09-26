const field = document.getElementById('q');
const form = document.getElementById('search-form');
const list = document.getElementById('suggestions');
let suggestions = [];
let selected = -1;
let requestId = 0;

function clear() {
  suggestions = [];
  selected = -1;
  list.replaceChildren();
  list.hidden = true;
  field.setAttribute('aria-expanded', 'false');
  field.removeAttribute('aria-activedescendant');
}

function select(index) {
  selected = index;
  for (const [position, item] of [...list.children].entries()) {
    item.classList.toggle('selected', position === index);
    item.setAttribute('aria-selected', String(position === index));
  }
  if (index >= 0) field.setAttribute('aria-activedescendant', `suggestion-${index}`);
  else field.removeAttribute('aria-activedescendant');
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

async function update() {
  const query = field.value.trim();
  const current = ++requestId;
  if (!query) {
    clear();
    return;
  }
  try {
    const response = await fetch(`yalqen://newtab/suggestions?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`Suggestions: ${response.status}`);
    const results = await response.json();
    if (current !== requestId || field.value.trim() !== query) return;
    clear();
    suggestions = results;
    for (const [index, suggestion] of results.entries()) {
      const item = document.createElement('li');
      item.id = `suggestion-${index}`;
      item.role = 'option';
      item.setAttribute('aria-selected', 'false');
      const link = document.createElement('a');
      link.href = suggestion.url;
      link.addEventListener('mousedown', (event) => event.preventDefault());
      const kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = suggestion.kind === 'bookmark' ? '★' : '◷';
      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = suggestion.title || hostOf(suggestion.url);
      const host = document.createElement('span');
      host.className = 'host';
      host.textContent = hostOf(suggestion.url);
      link.append(kind, title, host);
      item.append(link);
      list.append(item);
    }
    list.hidden = results.length === 0;
    field.setAttribute('aria-expanded', String(results.length > 0));
  } catch {
    if (current === requestId) clear();
  }
}

field.addEventListener('input', update);
field.addEventListener('focus', update);
field.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    ++requestId;
    clear();
  } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length > 0) {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    select(((selected + 1 + step + suggestions.length + 1) % (suggestions.length + 1)) - 1);
  }
});

form.addEventListener('submit', (event) => {
  if (selected < 0 || !suggestions[selected]) return;
  event.preventDefault();
  location.assign(suggestions[selected].url);
});
