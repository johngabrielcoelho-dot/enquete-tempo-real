import { createPoll } from '../api';
import { $, copyToClipboard, pageUrl } from '../util';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

const form = $<HTMLFormElement>('#create-form');
const questionInput = $<HTMLInputElement>('#question');
const optionList = $<HTMLOListElement>('#options');
const addButton = $<HTMLButtonElement>('#add-option');
const errorBox = $('#error');
const created = $('#created');
const voteLink = $<HTMLInputElement>('#vote-link');

function optionInputs(): HTMLInputElement[] {
  return [...optionList.querySelectorAll<HTMLInputElement>('input')];
}

function refreshOptionControls() {
  const rows = optionList.children.length;
  addButton.hidden = rows >= MAX_OPTIONS;
  optionList.querySelectorAll<HTMLButtonElement>('.remove').forEach((btn) => {
    btn.disabled = rows <= MIN_OPTIONS;
  });
  optionInputs().forEach((input, i) => input.setAttribute('aria-label', `Opção ${i + 1}`));
}

function addOption(focus = false) {
  const li = document.createElement('li');
  li.className = 'option-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 100;
  input.placeholder = `Opção ${optionList.children.length + 1}`;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-ghost remove';
  remove.textContent = '✕';
  remove.title = 'Remover opção';
  remove.addEventListener('click', () => {
    li.remove();
    refreshOptionControls();
  });

  li.append(input, remove);
  optionList.append(li);
  refreshOptionControls();
  if (focus) input.focus();
}

function showError(message: string | null) {
  errorBox.textContent = message ?? '';
  errorBox.hidden = message === null;
}

function reset() {
  form.reset();
  optionList.replaceChildren();
  for (let i = 0; i < MIN_OPTIONS; i++) addOption();
  showError(null);
  created.hidden = true;
  form.hidden = false;
  questionInput.focus();
}

addButton.addEventListener('click', () => addOption(true));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  const options = optionInputs()
    .map((i) => i.value.trim())
    .filter((v) => v !== '');

  if (question === '') return showError('Escreva a pergunta.');
  if (options.length < MIN_OPTIONS) return showError('Preencha pelo menos 2 opções.');

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  showError(null);

  try {
    const poll = await createPoll(question, options);
    voteLink.value = pageUrl('vote.html', poll.id);
    $<HTMLAnchorElement>('#go-vote').href = pageUrl('vote.html', poll.id);
    $<HTMLAnchorElement>('#go-result').href = pageUrl('result.html', poll.id);
    form.hidden = true;
    created.hidden = false;
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Erro inesperado.');
  } finally {
    submit.disabled = false;
  }
});

$<HTMLButtonElement>('#copy-link').addEventListener('click', (e) =>
  copyToClipboard(voteLink.value, e.currentTarget as HTMLButtonElement),
);
$('#new-poll').addEventListener('click', reset);

reset();
