import { ApiError, getPoll, vote, type Poll } from '../api';
import { $, hasVoted, markVoted, pageUrl, pollIdFromUrl } from '../util';

const loading = $('#loading');
const form = $<HTMLFormElement>('#vote-form');
const choices = $<HTMLFieldSetElement>('#choices');
const errorBox = $('#error');

function show(section: HTMLElement) {
  loading.hidden = true;
  section.hidden = false;
}

function showAlreadyVoted(pollId: string) {
  form.hidden = true;
  $<HTMLAnchorElement>('#already-result').href = pageUrl('result.html', pollId);
  show($('#already'));
}

function renderPoll(poll: Poll) {
  document.title = `Votar: ${poll.question}`;
  $('#question').textContent = poll.question;

  for (const option of poll.options) {
    const label = document.createElement('label');
    label.className = 'choice';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'option';
    radio.value = option.id;
    radio.required = true;

    const text = document.createElement('span');
    text.textContent = option.text;

    label.append(radio, text);
    choices.append(label);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const selected = form.querySelector<HTMLInputElement>('input[name="option"]:checked');
    if (!selected) {
      errorBox.textContent = 'Escolha uma opção.';
      errorBox.hidden = false;
      return;
    }

    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    errorBox.hidden = true;

    try {
      await vote(poll.id, selected.value);
      markVoted(poll.id);
      window.location.href = pageUrl('result.html', poll.id);
    } catch (err) {
      errorBox.textContent = err instanceof Error ? err.message : 'Erro inesperado.';
      errorBox.hidden = false;
      submit.disabled = false;
    }
  });

  show(form);
}

async function main() {
  const pollId = pollIdFromUrl();
  if (!pollId) return show($('#not-found'));
  if (hasVoted(pollId)) return showAlreadyVoted(pollId);

  try {
    renderPoll(await getPoll(pollId));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return show($('#not-found'));
    loading.textContent = 'Não foi possível carregar a enquete. Tente recarregar a página.';
  }
}

main();
