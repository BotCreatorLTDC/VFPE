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
                    iconSize: [35, 43],
                    iconAnchor: [17, 43]
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

        // Sort: Premium first
        const sorted = [...clubs].sort((a, b) => (b.is_premium ? 1 : 0) - (a.is_premium ? 1 : 0));

        sorted.forEach(club => {
            const card = document.createElement('div');
            card.className = `club-card ${club.is_premium ? 'premium' : ''}`;
            card.innerHTML = `
                <span class="badge">${club.is_premium ? '⭐ PREMIUM' : 'VERIFIED'}</span>
                <h2>${club.name}</h2>
                <p class="location">📍 ${club.city}, ${club.country}</p>
            `;
            card.onclick = () => {
                logClick(club.id);
                showDetail(club);
            };
            clubList.appendChild(card);
        });
    }

    async function logClick(id) {
        try {
            fetch(`/api/clubs/click/${id}`, { method: 'POST' });
        } catch (e) {}
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
    // FIX: country filter now uses ISO codes ('ES', 'DE', 'NL') matching what's stored in DB
    function filterClubs() {
        const searchTerm = searchInput.value.toLowerCase();
        const country = countryFilter.value; // already 'all' | 'ES' | 'DE' | 'NL'
        
        const filtered = allClubs.filter(club => {
            const matchesSearch = club.name.toLowerCase().includes(searchTerm) || 
                                 club.city.toLowerCase().includes(searchTerm);
            // Normalize both sides to uppercase for safe comparison
            const matchesCountry = country === 'all' || 
                                   (club.country || '').toUpperCase() === country.toUpperCase();
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
        const submitBtn = applyForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        const formData = new FormData(applyForm);
        const data = Object.fromEntries(formData.entries());

        // FIX: Validate @username format on client side too
        if (!data.telegram_username.startsWith('@')) {
            data.telegram_username = '@' + data.telegram_username;
        }

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                alert("✅ Request received! We'll review your club within 24-48 hours.");
                applyModal.style.display = "none";
                applyForm.reset();
            } else {
                alert('❌ Error: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert("❌ Connection error. Please try again.");
            console.error('Submit error:', err);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Verification Request';
        }
    };

    // Geolocation "Near Me"
    const nearMeBtn = document.createElement('button');
    nearMeBtn.id = 'near-me-btn';
    nearMeBtn.innerHTML = '📍';
    nearMeBtn.title = 'Clubs near me';
    document.getElementById('map-container').appendChild(nearMeBtn);

    nearMeBtn.onclick = () => {
        if (!navigator.geolocation) return alert('Geolocation not supported');
        
        nearMeBtn.innerHTML = '⌛';
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], 12);
            
            // Add user marker
            L.circle([latitude, longitude], { radius: 200, color: '#00d26a' }).addTo(map);
            nearMeBtn.innerHTML = '📍';
        }, (err) => {
            alert('Could not get location');
            nearMeBtn.innerHTML = '📍';
        });
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
