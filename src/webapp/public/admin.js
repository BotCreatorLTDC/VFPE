const tg = window.Telegram.WebApp;
let adminId = null;
let allClubs = [];
let currentFilter = 'pending';

const authLoading = document.getElementById('auth-loading');
const adminApp = document.getElementById('admin-app');
const clubsList = document.getElementById('clubs-list');
const analyticsView = document.getElementById('analytics-view');
const tabItems = document.querySelectorAll('.tab-item');

const statPending = document.getElementById('stat-pending');
const statClicks = document.getElementById('stat-clicks');

// Initialize Telegram WebApp
tg.expand();
tg.ready();

// Get Admin ID from Telegram
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    adminId = tg.initDataUnsafe.user.id;
    verifyAdmin();
} else {
    // For local testing if not in Telegram
    const urlParams = new URLSearchParams(window.location.search);
    adminId = urlParams.get('admin_id');
    if (adminId) verifyAdmin();
    else {
        authLoading.innerHTML = `<p style="color: #ff4d4d;">❌ Error: Open this from Telegram /admin</p>`;
    }
}

// ─── DEMO MODE ──────────────────────────────────────────────────────────
const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';
const DEMO_ANALYTICS = {
    total: 148,
    clicks: 12450,
    topCities: [
        { city: 'Ibiza', count: 42 },
        { city: 'Madrid', count: 38 },
        { city: 'Barcelona', count: 25 },
        { city: 'Berlin', count: 18 },
        { city: 'Amsterdam', count: 12 }
    ],
    topClubs: [
        { name: 'Cali King Ibiza', click_count: 3200 },
        { name: 'Space Club BCN', click_count: 2850 },
        { name: 'The High Lab', click_count: 2100 },
        { name: 'Green Garden', click_count: 1450 }
    ]
};
const DEMO_CLUBS = [
    { id: 101, name: 'Cloud Nine', city: 'Valencia', country: 'ES', telegram_username: '@CloudNineVAL', status: 'pending', selected_plan: 'Advanced', click_count: 0 },
    { id: 102, name: 'Bier & Bud', city: 'Munich', country: 'DE', telegram_username: '@BierBud', status: 'pending', selected_plan: 'PRO', click_count: 0 },
    { id: 103, name: 'Cali King Ibiza', city: 'Ibiza', country: 'ES', telegram_username: '@CaliKingIBZ', status: 'verified', selected_plan: 'Advanced', is_premium: true, click_count: 3200 },
    { id: 104, name: 'Amsterdam Express', city: 'Amsterdam', country: 'NL', telegram_username: '@AmsExp', status: 'accepted', selected_plan: 'Basic', click_count: 45 }
];
const DEMO_REPORTS = [
    { id: 1, club_name: 'Sketchy Club', reason: 'Invalid handle', details: 'The telegram username is not responding for 2 days.', reporter_handle: 'User99', created_at: new Date().toISOString() }
];

async function verifyAdmin() {
    if (isDemo) {
        authLoading.style.display = 'none';
        adminApp.style.display = 'block';
        fetchData();
        return;
    }
    try {
        const response = await fetch(`/api/admin/clubs?admin_id=${adminId}`);
        if (response.ok) {
            authLoading.style.display = 'none';
            adminApp.style.display = 'block';
            fetchData();
        } else {
            authLoading.innerHTML = `<p style="color: #ff4d4d;">❌ Access Denied: You are not an admin.</p>`;
        }
    } catch (e) {
        authLoading.innerHTML = `<p>⚠️ Connection Error. Retrying...</p>`;
        setTimeout(verifyAdmin, 3000);
    }
}

async function fetchData() {
    if (isDemo) {
        allClubs = DEMO_CLUBS;
        updateStats(DEMO_ANALYTICS);
        renderView(DEMO_REPORTS);
        renderAnalytics(DEMO_ANALYTICS);
        return;
    }
    try {
        const [clubsRes, analyticsRes, reportsRes] = await Promise.all([
            fetch(`/api/admin/clubs?admin_id=${adminId}`),
            fetch(`/api/admin/analytics?admin_id=${adminId}`),
            fetch(`/api/admin/reports?admin_id=${adminId}`)
        ]);
        
        allClubs = await clubsRes.json();
        const analytics = await analyticsRes.json();
        const reports = await reportsRes.json();
        
        updateStats(analytics);
        renderView(reports);
        renderAnalytics(analytics);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

function updateStats(data) {
    statPending.textContent = allClubs.filter(c => c.status === 'pending').length;
    statClicks.textContent = data.clicks;
}

function renderView(reports = []) {
    const reportsView = document.getElementById('reports-view');
    
    if (currentFilter === 'analytics') {
        clubsList.style.display = 'none';
        reportsView.style.display = 'none';
        analyticsView.style.display = 'block';
        return;
    }
    
    if (currentFilter === 'reports') {
        clubsList.style.display = 'none';
        analyticsView.style.display = 'none';
        reportsView.style.display = 'flex';
        renderReports(reports);
        return;
    }

    clubsList.style.display = 'flex';
    analyticsView.style.display = 'none';
    reportsView.style.display = 'none';

    const filtered = allClubs.filter(c => currentFilter === 'all' || c.status === currentFilter);
    clubsList.innerHTML = '';

    if (filtered.length === 0) {
        clubsList.innerHTML = `<div style="text-align:center; padding: 2rem; color: #8e8e93;">Empty list</div>`;
        return;
    }

    filtered.forEach(club => {
        const card = document.createElement('div');
        card.className = `club-card ${club.is_premium ? 'premium' : ''}`;
        
        let planBadge = '';
        if (club.selected_plan) {
            const planColor = club.selected_plan === 'Advanced' ? '#FFD700' : (club.selected_plan === 'PRO' ? '#00d26a' : '#fff');
            planBadge = `<span style="font-size:0.8rem; font-weight:bold; color:${planColor}; border:1px solid ${planColor}; padding:2px 6px; border-radius:10px; margin-left:10px;">${club.selected_plan}</span>`;
        }

        let actionButtons = '';
        if (club.status === 'pending') {
            actionButtons = `
                <button class="btn-m btn-approve" onclick="handleAction(${club.id}, 'accept')" style="width:100%; margin-bottom:5px;">Aceptar y Enviar Billetera 📥</button>
                <button class="btn-m btn-reject" onclick="handleAction(${club.id}, 'reject')">Reject</button>
            `;
        } else if (club.status === 'accepted') {
            actionButtons = `
                <button class="btn-m btn-approve" onclick="handleAction(${club.id}, 'publish')" style="width:100%; margin-bottom:5px; background:#FFD700; color:#000;">Confirmar Pago y Publicar 🚀</button>
                <button class="btn-m btn-reject" onclick="handleAction(${club.id}, 'reject')">Reject</button>
            `;
        } else if (club.status === 'verified') {
            actionButtons = `
                <button class="btn-m btn-promote" onclick="handleAction(${club.id}, 'promote')">
                    ${club.is_premium ? '💎 UNPROMOTE' : '⭐ PROMOTE'}
                </button>
            `;
        }

        card.innerHTML = `
            <div class="card-header">
                <h3><span style="color:#888; font-size:0.9rem;">#${club.id}</span> ${club.name} ${planBadge}</h3>
                <span class="loc">📍 ${club.city}, ${club.country}</span>
            </div>
            <div class="card-meta" style="display:flex; flex-direction:column; gap:5px;">
                <span>💬 ${club.telegram_username}</span>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>🖱 ${club.click_count || 0} clicks</span>
                    ${club.status === 'verified' ? `
                        <button onclick="copyDeepLink(${club.id})" style="background:#444; border:none; color:#fff; padding:2px 8px; border-radius:5px; font-size:0.7rem; cursor:pointer;">
                            🔗 Copiar Enlace
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="card-actions">
                ${actionButtons}
                <div style="display:flex; justify-content:space-between; margin-top:10px;">
                    <button class="btn-m btn-edit" onclick="openEditModal(${club.id})">✏️ Edit</button>
                    <button class="btn-m btn-delete" onclick="handleAction(${club.id}, 'delete')">Delete</button>
                </div>
            </div>
        `;
        clubsList.appendChild(card);
    });
}

function openEditModal(id) {
    const club = allClubs.find(c => c.id === id);
    if (!club) return;
    document.getElementById('edit-id').value      = club.id;
    document.getElementById('edit-name').value     = club.name;
    document.getElementById('edit-city').value     = club.city;
    document.getElementById('edit-country').value  = club.country;
    document.getElementById('edit-tg').value       = club.telegram_username;
    document.getElementById('edit-ig').value       = club.instagram || '';
    document.getElementById('edit-desc').value     = club.description || '';
    document.getElementById('edit-photo').value    = club.photo_url || '';

    // Service tags checkboxes
    const clubTags = Array.isArray(club.service_tags) ? club.service_tags : [];
    ['delivery', 'meetup', 'postal'].forEach(tag => {
        const cb = document.getElementById(`tag-${tag}`);
        if (cb) cb.checked = clubTags.includes(tag);
    });

    // FIX: Show event field only for Advanced plan
    const eventGroup = document.getElementById('event-group');
    if (club.selected_plan === 'Advanced') {
        eventGroup.style.display = 'block';
        document.getElementById('edit-event').value = club.event_message || '';
    } else {
        eventGroup.style.display = 'none';
        document.getElementById('edit-event').value = '';
    }
    
    document.getElementById('edit-modal').style.display = 'flex';
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('edit-modal').style.display = 'none';
};

document.getElementById('edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const selectedTags = ['delivery', 'meetup', 'postal'].filter(t => {
        const cb = document.getElementById(`tag-${t}`);
        return cb && cb.checked;
    });
    const data = {
        id:               document.getElementById('edit-id').value,
        name:             document.getElementById('edit-name').value,
        city:             document.getElementById('edit-city').value,
        country:          document.getElementById('edit-country').value,
        telegram_username: document.getElementById('edit-tg').value,
        instagram:        document.getElementById('edit-ig').value,
        description:      document.getElementById('edit-desc').value,
        event_message:    document.getElementById('edit-event').value,
        photo_url:        document.getElementById('edit-photo').value,
        service_tags:     selectedTags
    };

    const res = await fetch('/api/admin/update', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-admin-id': adminId
        },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        document.getElementById('edit-modal').style.display = 'none';
        fetchData();
        tg.HapticFeedback.notificationOccurred('success');
    } else {
        alert('Update failed');
    }
};

function renderAnalytics(data) {
    const citiesList = document.getElementById('top-cities-list');
    const clubsListAn = document.getElementById('top-clubs-list');

    citiesList.innerHTML = data.topCities.map(c => `<li><span class="n">${c.city}</span> <span class="v">${c.count} plugs</span></li>`).join('');
    clubsListAn.innerHTML = data.topClubs.map(c => `<li><span class="n">${c.name}</span> <span class="v">${c.click_count} clicks</span></li>`).join('');
}

function renderReports(reports) {
    const reportsView = document.getElementById('reports-view');
    reportsView.innerHTML = '';
    
    if (reports.length === 0) {
        reportsView.innerHTML = `<div style="text-align:center; padding:2rem; color:#888;">No pending reports ✅</div>`;
        return;
    }

    reports.forEach(r => {
        const card = document.createElement('div');
        card.className = 'club-card';
        card.style.borderLeft = '4px solid #ff4d4d';
        card.innerHTML = `
            <div class="card-header">
                <h3>⚠️ Report for ${r.club_name}</h3>
                <span class="loc">Reason: <strong>${r.reason}</strong></span>
            </div>
            <div class="card-meta">
                <p style="margin-bottom:10px;">"${r.details || 'No details provided'}"</p>
                <span style="font-size:0.75rem; color:#888;">By: @${r.reporter_handle} • ${new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            <div class="card-actions" style="display:flex; gap:10px; margin-top:10px;">
                <button class="btn-m btn-approve" onclick="handleReportAction(${r.id}, 'resolve')" style="flex:1;">Resolve</button>
                <button class="btn-m btn-reject" onclick="handleReportAction(${r.id}, 'dismiss')" style="flex:1;">Dismiss</button>
            </div>
        `;
        reportsView.appendChild(card);
    });
}

async function handleReportAction(id, action) {
    const response = await fetch('/api/admin/report-action', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-admin-id': adminId
        },
        body: JSON.stringify({ id, action })
    });
    if (response.ok) fetchData();
}

async function handleAction(id, action) {
    if (action === 'delete' && !confirm('Are you sure?')) return;
    
    tg.MainButton.setText('Processing...');
    tg.MainButton.show();

    try {
        const response = await fetch('/api/admin/action', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-id': adminId
            },
            body: JSON.stringify({ id, action })
        });
        
        if (response.ok) {
            fetchData();
            tg.HapticFeedback.notificationOccurred('success');
        } else {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            alert(`❌ Acción fallida: ${err.error || response.status}`);
            tg.HapticFeedback.notificationOccurred('error');
        }
    } catch (e) {
        alert('Action failed');
    } finally {
        tg.MainButton.hide();
    }
}

function copyDeepLink(id) {
    const shareUrl = `https://t.me/VerifyPlugEU_bot?startapp=club_${id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        tg.HapticFeedback.notificationOccurred('success');
        alert('Enlace copiado al portapapeles');
    }).catch(err => {
        console.error('Error copying link:', err);
    });
}

tabItems.forEach(item => {
    item.onclick = () => {
        tabItems.forEach(t => t.classList.remove('active'));
        item.classList.add('active');
        currentFilter = item.dataset.filter;
        renderView();
    };
});

document.getElementById('refresh-btn').onclick = fetchData;
