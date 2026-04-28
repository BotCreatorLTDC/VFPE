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

async function verifyAdmin() {
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
    try {
        const [clubsRes, analyticsRes] = await Promise.all([
            fetch(`/api/admin/clubs?admin_id=${adminId}`),
            fetch(`/api/admin/analytics?admin_id=${adminId}`)
        ]);
        
        allClubs = await clubsRes.json();
        const analytics = await analyticsRes.json();
        
        updateStats(analytics);
        renderView();
        renderAnalytics(analytics);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

function updateStats(data) {
    statPending.textContent = allClubs.filter(c => c.status === 'pending').length;
    statClicks.textContent = data.clicks;
}

function renderView() {
    if (currentFilter === 'analytics') {
        clubsList.style.display = 'none';
        analyticsView.style.display = 'block';
        return;
    }

    clubsList.style.display = 'flex';
    analyticsView.style.display = 'none';

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
                <h3>${club.name} ${planBadge}</h3>
                <span class="loc">📍 ${club.city}, ${club.country}</span>
            </div>
            <div class="card-meta">
                <span>💬 ${club.telegram_username}</span>
                <span>🖱 ${club.click_count || 0} clicks</span>
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
    document.getElementById('edit-id').value = club.id;
    document.getElementById('edit-name').value = club.name;
    document.getElementById('edit-city').value = club.city;
    document.getElementById('edit-country').value = club.country;
    document.getElementById('edit-tg').value = club.telegram_username;
    document.getElementById('edit-ig').value = club.instagram || '';
    document.getElementById('edit-desc').value = club.description || '';
    document.getElementById('edit-modal').style.display = 'flex';
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('edit-modal').style.display = 'none';
};

document.getElementById('edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        id: document.getElementById('edit-id').value,
        name: document.getElementById('edit-name').value,
        city: document.getElementById('edit-city').value,
        country: document.getElementById('edit-country').value,
        telegram_username: document.getElementById('edit-tg').value,
        instagram: document.getElementById('edit-ig').value,
        description: document.getElementById('edit-desc').value
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
        }
    } catch (e) {
        alert('Action failed');
    } finally {
        tg.MainButton.hide();
    }
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
