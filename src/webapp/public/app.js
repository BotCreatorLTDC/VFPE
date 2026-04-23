document.addEventListener('DOMContentLoaded', () => {
    const clubList = document.getElementById('club-list');
    const searchInput = document.getElementById('search-input');
    const countryFilter = document.getElementById('country-filter');
    const clubCount = document.getElementById('club-count');
    const statusMessage = document.getElementById('status-message');
    
    const applyModal = document.getElementById('apply-modal');
    const detailScreen = document.getElementById('detail-screen');
    
    const openApplyBtn = document.getElementById('open-apply-modal');
    const closeApplyBtn = document.querySelector('.close');
    const closeDetailBtn = document.getElementById('close-detail');
    const applyForm = document.getElementById('apply-form');

    let allClubs = [];

    // Fetch clubs from API
    async function fetchClubs() {
        statusMessage.textContent = "Loading verified clubs...";
        try {
            const response = await fetch('/api/clubs');
            allClubs = await response.json();
            clubCount.textContent = allClubs.length;
            
            if (allClubs.length === 0) {
                statusMessage.textContent = "No clubs found in this location yet. Expanding soon.";
            } else {
                statusMessage.textContent = "";
                renderClubs(allClubs);
            }
        } catch (err) {
            statusMessage.textContent = "Connection error. Please try again.";
            console.error("Error fetching clubs:", err);
        }
    }

    function renderClubs(clubs) {
        clubList.innerHTML = '';
        if (clubs.length === 0) {
            statusMessage.textContent = `No results for "${searchInput.value}". Try a different city.`;
            return;
        } else {
            statusMessage.textContent = "";
        }

        clubs.forEach(club => {
            const card = document.createElement('div');
            card.className = 'club-card';
            card.innerHTML = `
                <span class="badge">VERIFIED</span>
                <h2>${club.name}</h2>
                <p class="location">📍 ${club.city}, ${club.country}</p>
            `;
            card.onclick = () => showDetail(club);
            clubList.appendChild(card);
        });
    }

    function showDetail(club) {
        document.getElementById('detail-name').textContent = club.name;
        document.getElementById('detail-location').textContent = `📍 ${club.city}, ${club.country}`;
        document.getElementById('detail-description').textContent = club.description || 'Verified cannabis social club operating under local law.';
        
        const tgLink = document.getElementById('detail-tg-link');
        tgLink.href = `https://t.me/${club.telegram_username.replace('@', '')}`;
        
        const igLink = document.getElementById('detail-ig-link');
        if (club.instagram) {
            igLink.href = `https://instagram.com/${club.instagram.replace('@', '')}`;
            igLink.style.display = "block";
        } else {
            igLink.style.display = "none";
        }

        detailScreen.style.display = "block";
        document.body.style.overflow = "hidden"; // Prevent scroll
    }

    function hideDetail() {
        detailScreen.style.display = "none";
        document.body.style.overflow = "auto";
    }

    // Filter logic
    function filterClubs() {
        const searchTerm = searchInput.value.toLowerCase();
        const country = countryFilter.value;
        
        const filtered = allClubs.filter(club => {
            const matchesSearch = club.name.toLowerCase().includes(searchTerm) || 
                                 club.city.toLowerCase().includes(searchTerm);
            const matchesCountry = country === 'all' || club.country === country;
            return matchesSearch && matchesCountry;
        });
        
        renderClubs(filtered);
    }

    searchInput.addEventListener('input', filterClubs);
    countryFilter.addEventListener('change', filterClubs);

    // Navigation
    openApplyBtn.onclick = () => applyModal.style.display = "block";
    closeApplyBtn.onclick = () => applyModal.style.display = "none";
    closeDetailBtn.onclick = hideDetail;

    window.onclick = (event) => {
        if (event.target == applyModal) applyModal.style.display = "none";
    }

    // Form submission
    applyForm.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(applyForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                alert("Request received! We'll review your club within 24-48 hours.");
                applyModal.style.display = "none";
                applyForm.reset();
            }
        } catch (err) {
            alert("Error submitting request.");
        }
    };

    // Initialize
    fetchClubs();

    // Telegram WebApp integration
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.ready();
    }
});
