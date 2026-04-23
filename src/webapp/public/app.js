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
    let map;
    let markers = [];

    const cityCoords = {
        'Madrid': [40.4168, -3.7038],
        'Barcelona': [41.3851, 2.1734],
        'Valencia': [39.4699, -0.3763],
        'Sevilla': [37.3891, -5.9845],
        'Berlin': [52.5200, 13.4050],
        'Amsterdam': [52.3676, 4.9041]
    };

    function initMap() {
        if (map) return;
        map = L.map('map', { zoomControl: false }).setView([40.4168, -3.7038], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    }

    function updateMapMarkers(clubs) {
        if (!map) return;
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        const citiesWithClubs = [...new Set(clubs.map(c => c.city))];
        citiesWithClubs.forEach(city => {
            const coords = cityCoords[city];
            if (coords) {
                const count = clubs.filter(c => c.city === city).length;
                
                const markerIcon = L.divIcon({
                    html: `<span>${count}</span>`,
                    className: 'custom-marker',
                    iconSize: [30, 30]
                });

                const marker = L.marker(coords, { icon: markerIcon }).addTo(map);
                marker.on('click', () => {
                    searchInput.value = city;
                    filterClubs();
                    map.setView(coords, 10);
                });
                markers.push(marker);
            }
        });
    }

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
                updateMapMarkers(allClubs);
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
    initMap();
    fetchClubs();

    // Telegram WebApp integration
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.ready();
    }
});
