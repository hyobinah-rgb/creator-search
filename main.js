const API_KEY = 'AIzaSyAIZGkHmFHwK5wyNnda9cfwFlt86B3vXgg';

const input = document.getElementById('keyword-input');
const searchBtn = document.getElementById('search-btn');
const resultsGrid = document.getElementById('results-grid');
const statusMsg = document.getElementById('status-msg');

searchBtn.addEventListener('click', runSearch);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});

async function runSearch() {
  const query = input.value.trim();
  if (!query) return;

  setStatus('Searching...', false);
  resultsGrid.innerHTML = '';
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

    // Step 2: fetch channel statistics (subscriber count etc.)
    const channelIds = items.map(item => item.snippet.channelId).join(',');
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds}&key=${API_KEY}`
    );
    const statsData = await statsRes.json();

    const statsMap = {};
    for (const ch of (statsData.items || [])) {
      statsMap[ch.id] = ch;
    }

    clearStatus();
    renderResults(items, statsMap);
  } catch (err) {
    setStatus('Network error. Check your API key and connection.', true);
    console.error(err);
  } finally {
    searchBtn.disabled = false;
  }
}

function renderResults(items, statsMap) {
  for (const item of items) {
    const channelId = item.snippet.channelId;
    const stats = statsMap[channelId];
    const snippet = stats ? stats.snippet : item.snippet;

    const name = snippet.title;
    const description = snippet.description || 'No description available.';
    const thumbnail =
      (snippet.thumbnails?.high || snippet.thumbnails?.default)?.url || '';
    const subs = stats?.statistics?.subscriberCount
      ? formatCount(stats.statistics.subscriberCount)
      : 'Hidden';
    const videoCount = stats?.statistics?.videoCount
      ? Number(stats.statistics.videoCount).toLocaleString()
      : '—';
    const channelUrl = `https://www.youtube.com/channel/${channelId}`;

    const card = document.createElement('a');
    card.className = 'card';
    card.href = channelUrl;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `
      <img src="${thumbnail}" alt="${escapeHtml(name)}" />
      <div class="card-body">
        <h2>${escapeHtml(name)}</h2>
        <div class="card-meta">
          <span>${subs} subscribers</span>
          <span>${videoCount} videos</span>
        </div>
        <p>${escapeHtml(description.slice(0, 120))}${description.length > 120 ? '…' : ''}</p>
      </div>
    `;
    resultsGrid.appendChild(card);
  }
}

function formatCount(n) {
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
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
