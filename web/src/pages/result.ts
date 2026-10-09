import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { io } from 'socket.io-client';
import { API_URL, ApiError, getPoll, type Poll, type PollOption, type VotesUpdate } from '../api';
import { $, copyToClipboard, pageUrl, percentages, pluralVotes, pollIdFromUrl, totalVotes } from '../util';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const loading = $('#loading');
const statusPill = $('#status');
const totalText = $('#total');

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setStatus(state: 'connecting' | 'live' | 'offline') {
  const labels = { connecting: 'Conectando…', live: 'Ao vivo', offline: 'Reconectando…' };
  statusPill.dataset.state = state;
  statusPill.textContent = labels[state];
}

function labelsFor(options: PollOption[]): string[] {
  const pct = percentages(options);
  return options.map((o, i) => `${o.text} (${pct[i]}%)`);
}

function createChart(poll: Poll): Chart<'bar'> {
  Chart.defaults.color = cssVar('--muted');
  Chart.defaults.font.family = cssVar('--font');

  // Altura proporcional ao número de opções, para as barras não ficarem espremidas
  $('.chart-box').style.height = `${Math.max(220, poll.options.length * 64)}px`;

  return new Chart($<HTMLCanvasElement>('#chart'), {
    type: 'bar',
    data: {
      labels: labelsFor(poll.options),
      datasets: [
        {
          label: 'Votos',
          data: poll.options.map((o) => o.votes),
          backgroundColor: cssVar('--accent'),
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: cssVar('--grid') } },
        y: { grid: { display: false }, ticks: { color: cssVar('--text'), font: { size: 14 } } },
      },
      plugins: {
        tooltip: { callbacks: { label: (ctx) => pluralVotes(ctx.parsed.x ?? 0) } },
      },
    },
  });
}

function updateChart(chart: Chart<'bar'>, options: PollOption[]) {
  chart.data.labels = labelsFor(options);
  chart.data.datasets[0].data = options.map((o) => o.votes);
  chart.update();
  totalText.textContent = `Total: ${pluralVotes(totalVotes(options))}`;
}

function listenLive(pollId: string, chart: Chart<'bar'>) {
  // Sem URL = mesma origem; o proxy (Vite/Nginx) leva /socket.io até a API.
  const socket = API_URL ? io(API_URL) : io();

  socket.on('connect', async () => {
    try {
      await socket.timeout(5000).emitWithAck('poll:join', { pollId });
      // Rebusca depois de entrar na sala para não perder votos dados
      // antes da conexão (ou durante uma queda).
      updateChart(chart, (await getPoll(pollId)).options);
      setStatus('live');
    } catch {
      setStatus('offline');
    }
  });

  socket.on('disconnect', () => setStatus('offline'));
  socket.io.on('reconnect_attempt', () => setStatus('offline'));

  socket.on('votes:update', (update: VotesUpdate) => {
    if (update.pollId === pollId) updateChart(chart, update.options);
  });
}

async function main() {
  const pollId = pollIdFromUrl();
  if (!pollId) {
    loading.hidden = true;
    $('#not-found').hidden = false;
    return;
  }

  let poll: Poll;
  try {
    poll = await getPoll(pollId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      loading.hidden = true;
      $('#not-found').hidden = false;
    } else {
      loading.textContent = 'Não foi possível carregar o resultado. Tente recarregar a página.';
    }
    return;
  }

  document.title = `Resultado: ${poll.question}`;
  $('#question').textContent = poll.question;
  const link = pageUrl('vote.html', poll.id);
  $<HTMLInputElement>('#vote-link').value = link;
  $<HTMLButtonElement>('#copy-link').addEventListener('click', (e) =>
    copyToClipboard(link, e.currentTarget as HTMLButtonElement),
  );

  loading.hidden = true;
  $('#result').hidden = false;

  const chart = createChart(poll);
  updateChart(chart, poll.options);
  listenLive(poll.id, chart);
}

main();
