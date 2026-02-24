const API_KEY = 'AIzaSyAIZGkHmFHwK5wyNnda9cfwFlt86B3vXgg';

const FILTERS = [
  { label: '0 – 10K',      min: 0,      max: 10000   },
  { label: '10K – 100K',   min: 10001,  max: 100000  },
  { label: '100K – 500K',  min: 100001, max: 500000  },
  { label: '500K – 800K',  min: 500001, max: 800000  },
  { label: '800K – 1.5M',  min: 800001, max: 1500000 },
];

const input      = document.getElementById('keyword-input');
const searchBtn  = document.getElementById('search-btn');
const resultsGrid = document.getElementById('results-grid');
const statusMsg  = document.getElementById('status-msg');
const filterBar  = document.getElementById('filter-bar');
const filterBtns = document.querySelectorAll('.filter-btn');

let allChannels   = [];   // all fetched channel objects
let activeFilter  = 'all'; // 'all' or a FILTERS index (0-4)

// Filter button clicks
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.index === 'all' ? 'all' : Number(btn.dataset.index);
    filterBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    applyFilter();
  });
});

searchBtn.addEventListener('click', runSearch);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});

async function runSearch() {
  const query = input.value.trim();
  if (!query) return;

  setStatus('Searching...', false);
  resultsGrid.innerHTML = '';
  filterBar.classList.add('hidden');
  allChannels = [];
  activeFilter = 'all';
  filterBtns.forEach(b => b.classList.remove('selected'));
  document.querySelector('.filter-btn[data-index="all"]').classList.add('selected');
  searchBtn.disabled = true;

  try {
    // Step 1: search for channels matching the keyword
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=12&key=${API_KEY}`
    );
    const searchData = await searchRes.json();

    if (searchData.error) {
      setStatus(`API error: ${searchData.error.message}`, true);
      return;
    }

    const items = searchData.items || [];
    if (items.length === 0) {
      setStatus('No creators found for that keyword.', false);
      return;
    }

    // Step 2: fetch channel statistics
    const channelIds = items.map(item => item.snippet.channelId).join(',');
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds}&key=${API_KEY}`
    );
    const statsData = await statsRes.json();

    const statsMap = {};
    for (const ch of (statsData.items || [])) {
      statsMap[ch.id] = ch;
    }

    // Build unified channel list with raw subscriber count for filtering
    allChannels = items.map(item => {
      const channelId = item.snippet.channelId;
      const stats = statsMap[channelId];
      const snippet = stats ? stats.snippet : item.snippet;
      return {
        channelId,
        name: snippet.title,
        description: snippet.description || 'No description available.',
        thumbnail: (snippet.thumbnails?.high || snippet.thumbnails?.default)?.url || '',
        subscriberCount: stats?.statistics?.subscriberCount != null
          ? Number(stats.statistics.subscriberCount)
          : null,
        videoCount: stats?.statistics?.videoCount
          ? Number(stats.statistics.videoCount).toLocaleString()
          : '—',
      };
    });

    clearStatus();
    filterBar.classList.remove('hidden');
    applyFilter();
  } catch (err) {
    setStatus('Network error. Check your API key and connection.', true);
    console.error(err);
  } finally {
    searchBtn.disabled = false;
  }
}

function applyFilter() {
  let visible = allChannels;

  if (activeFilter !== 'all') {
    const { min, max } = FILTERS[activeFilter];
    visible = allChannels.filter(ch =>
      ch.subscriberCount !== null &&
      ch.subscriberCount >= min &&
      ch.subscriberCount <= max
    );
  }

  resultsGrid.innerHTML = '';

  if (visible.length === 0) {
    setStatus('No creators match this filter.', false);
    return;
  }

  clearStatus();
  for (const ch of visible) {
    const subsDisplay = ch.subscriberCount !== null
      ? formatCount(ch.subscriberCount) + ' subscribers'
      : 'Subscribers hidden';

    const card = document.createElement('a');
    card.className = 'card';
    card.href = `https://www.youtube.com/channel/${ch.channelId}`;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `
      <img src="${ch.thumbnail}" alt="${escapeHtml(ch.name)}" />
      <div class="card-body">
        <h2>${escapeHtml(ch.name)}</h2>
        <div class="card-meta">
          <span>${subsDisplay}</span>
          <span>${ch.videoCount} videos</span>
        </div>
        <p>${escapeHtml(ch.description.slice(0, 120))}${ch.description.length > 120 ? '…' : ''}</p>
      </div>
    `;
    resultsGrid.appendChild(card);
  }
}

function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setStatus(msg, isError) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg' + (isError ? ' error' : '');
}

function clearStatus() {
  statusMsg.textContent = '';
  statusMsg.className = 'status-msg hidden';
}
