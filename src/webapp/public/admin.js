let adminSecret = localStorage.getItem('vfpe_admin_secret') || '';
let allClubs = [];
let currentFilter = 'all';

const authOverlay = document.getElementById('auth-overlay');
const dashboard = document.querySelector('.dashboard-container');
const secretInput = document.getElementById('admin-secret-input');
const loginBtn = document.getElementById('login-btn');
const authError = document.getElementById('auth-error');

const clubsBody = document.getElementById('clubs-body');
const navItems = document.querySelectorAll('.nav-item');
const viewTitle = document.getElementById('view-title');

const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statVerified = document.getElementById('stat-verified');

// Check auth on load
if (adminSecret) {
    verifyAuth();
}

loginBtn.onclick = () => {
    adminSecret = secretInput.value;
    verifyAuth();
};

async function verifyAuth() {
    try {
        const response = await fetch('/api/admin/clubs', {
            headers: { 'x-admin-secret': adminSecret }
        });
        
        if (response.ok) {
            localStorage.setItem('vfpe_admin_secret', adminSecret);
            authOverlay.style.display = 'none';
            dashboard.style.display = 'flex';
            fetchClubs();
        } else {
            authError.textContent = '❌ Invalid secret key.';
            localStorage.removeItem('vfpe_admin_secret');
        }
    } catch (e) {
        authError.textContent = '❌ Connection error.';
    }
}

async function fetchClubs() {
    try {
        const response = await fetch('/api/admin/clubs', {
            headers: { 'x-admin-secret': adminSecret }
        });
        allClubs = await response.json();
        updateStats();
        renderTable();
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

function updateStats() {
    statTotal.textContent = allClubs.length;
    statPending.textContent = allClubs.filter(c => c.status === 'pending').length;
    statVerified.textContent = allClubs.filter(c => c.status === 'verified').length;
}

function renderTable() {
    const filtered = allClubs.filter(c => currentFilter === 'all' || c.status === currentFilter);
    clubsBody.innerHTML = '';

    filtered.forEach(club => {
        const row = document.createElement('tr');
        const date = new Date(club.created_at).toLocaleDateString();
        
        row.innerHTML = `
            <td><strong>${club.name}</strong></td>
            <td>${club.city}, ${club.country}</td>
            <td>${club.telegram_username}</td>
            <td><span class="status-badge status-${club.status}">${club.status.toUpperCase()}</span></td>
            <td>${date}</td>
            <td>
                <div class="action-btns">
                    ${club.status !== 'verified' ? `<button class="btn-action btn-approve" onclick="handleAction(${club.id}, 'approve')">Approve</button>` : ''}
                    ${club.status === 'pending' ? `<button class="btn-action btn-reject" onclick="handleAction(${club.id}, 'reject')">Reject</button>` : ''}
                    <button class="btn-action btn-delete" onclick="handleAction(${club.id}, 'delete')">Delete</button>
                </div>
            </td>
        `;
        clubsBody.appendChild(row);
    });
}

async function handleAction(id, action) {
    if (action === 'delete' && !confirm('Are you sure you want to permanently delete this club?')) return;

    try {
        const response = await fetch('/api/admin/action', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-secret': adminSecret
            },
            body: JSON.stringify({ id, action })
        });
        
        if (response.ok) {
            fetchClubs(); // Refresh
        } else {
            alert('Action failed.');
        }
    } catch (e) {
        alert('Connection error.');
    }
}

// Navigation
navItems.forEach(item => {
    item.onclick = () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        currentFilter = item.dataset.filter;
        viewTitle.textContent = item.textContent;
        renderTable();
    };
});

document.getElementById('refresh-btn').onclick = fetchClubs;

document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('vfpe_admin_secret');
    window.location.reload();
};
