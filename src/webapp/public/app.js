document.addEventListener('DOMContentLoaded', () => {
    const clubList = document.getElementById('club-list');
    const searchInput = document.getElementById('search-input');
    const countryFilter = document.getElementById('country-filter');
    const clubCount = document.getElementById('club-count');
    const modal = document.getElementById('apply-modal');
    const openBtn = document.getElementById('open-apply-modal');
    const closeBtn = document.getElementsByClassName('close')[0];
    const applyForm = document.getElementById('apply-form');

    let allClubs = [];

    // Fetch clubs from API
    async function fetchClubs() {
        try {
            const response = await fetch('/api/clubs');
            allClubs = await response.json();
            renderClubs(allClubs);
            clubCount.textContent = allClubs.length;
        } catch (err) {
            console.error("Error fetching clubs:", err);
        }
    }

    function renderClubs(clubs) {
        clubList.innerHTML = '';
        clubs.forEach(club => {
            const card = document.createElement('div');
            card.className = 'club-card';
            card.innerHTML = `
                <span class="badge">VERIFIED</span>
                <h2>${club.name}</h2>
                <p class="location">📍 ${club.city}, ${club.country}</p>
                <p>${club.description || 'No description provided.'}</p>
                <a href="https://t.me/${club.telegram_username.replace('@', '')}" class="cta">Contact on Telegram →</a>
            `;
            clubList.appendChild(card);
        });
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

    // Modal logic
    openBtn.onclick = () => modal.style.display = "block";
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
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
                modal.style.display = "none";
                applyForm.reset();
            }
        } catch (err) {
            alert("Error submitting request. Please try again.");
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
