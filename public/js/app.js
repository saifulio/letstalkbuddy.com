// Shared helpers used across pages.
const API = {
  async get(url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
};

const AVATAR_COLORS = ['#E8603C', '#3E9C5C', '#4A72C4', '#B0472C', '#8A5FBF', '#C48A2B', '#2B8FA3'];

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function avatarHTML(name, size, online) {
  const color = AVATAR_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return `
    <div class="avatar" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.round(size * 0.36)}px">
      ${initials(name)}
      ${online ? '<div class="online-dot"></div>' : ''}
    </div>`;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtRate(rate) { return `$${Number(rate).toFixed(2)}/min`; }
function fmtResponse(min) { return `~${min} min`; }

function advisorCardHTML(a, { withBio = false } = {}) {
  const name = escapeHTML(a.name);
  const profileUrl = `/profile.html?id=${a.id}`;
  return `
    <div class="card">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:${withBio ? 12 : 14}px">
        <a href="${profileUrl}" style="text-decoration:none;flex-shrink:0">${avatarHTML(name, withBio ? 52 : 56, !!a.is_online)}</a>
        <div style="min-width:0">
          <a href="${profileUrl}" style="display:block;font-weight:700;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:inherit;text-decoration:none">${name}</a>
          ${withBio
            ? `<div class="tag" style="margin-top:3px;background:${a.tag_bg};color:${a.tag_color}">${escapeHTML(a.category)}</div>`
            : `<div style="font-size:13px;color:oklch(50% 0.02 60)">${escapeHTML(a.category)}</div>`}
        </div>
      </div>
      ${withBio ? `<p style="font-size:13px;line-height:1.5;margin:0 0 12px;min-height:38px" class="muted">${escapeHTML(a.bio)}</p>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:${withBio ? 12.5 : 13.5}px;margin-bottom:14px" class="muted">
        <span>★ ${a.rating}${withBio ? ` (${a.reviews_count})` : ''}</span>
        <span>${fmtResponse(a.response_minutes)} reply</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:800;font-size:${withBio ? 15.5 : 16}px">${fmtRate(a.rate_per_min)}</span>
        <button class="btn btn-dark" style="padding:8px 14px;border-radius:8px;font-size:${withBio ? 12.5 : 13}px" onclick="bookAdvisor(${a.id})">Book now</button>
      </div>
    </div>`;
}

function bookAdvisor(id) {
  window.location.href = `/profile.html?id=${id}`;
}

// Swap Login/Signup buttons for the logged-in state.
async function initAuthNav() {
  const slot = document.getElementById('nav-auth');
  if (!slot) return;
  try {
    const { user } = await API.get('/api/auth/me');
    if (user) {
      slot.innerHTML = `
        <span style="font-weight:700;font-size:14px">Hi, ${escapeHTML(user.name.split(' ')[0])}</span>
        <button class="btn btn-outline" id="logout-btn" style="padding:9px 18px;font-size:13.5px">Log out</button>`;
      document.getElementById('logout-btn').addEventListener('click', async () => {
        await API.post('/api/auth/logout');
        window.location.reload();
      });
    }
  } catch { /* keep default buttons */ }
}

document.addEventListener('DOMContentLoaded', initAuthNav);
