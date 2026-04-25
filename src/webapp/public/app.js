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
        // España
        'Madrid': [40.4168, -3.7038], 'Barcelona': [41.3851, 2.1734], 'Valencia': [39.4699, -0.3763],
        'Sevilla': [37.3891, -5.9845], 'Zaragoza': [41.6488, -0.8891], 'Málaga': [36.7213, -4.4214],
        'Murcia': [37.9922, -1.1307], 'Palma': [39.5696, 2.6502], 'Las Palmas': [28.1248, -15.4300],
        'Bilbao': [43.2630, -2.9350], 'Alicante': [38.3452, -0.4810], 'Córdoba': [37.8882, -4.7794],
        'Valladolid': [41.6523, -4.7245], 'Vigo': [42.2406, -8.7207], 'Gijón': [43.5357, -5.6615],
        'Granada': [37.1773, -3.5986], 'Tarragona': [41.1189, 1.2445], 'San Sebastián': [43.3183, -1.9812],
        'Santander': [43.4623, -3.8099], 'Ibiza': [38.9067, 1.4206], 'Marbella': [36.5100, -4.8800],
        'Almería': [36.8340, -2.4637], 'Tenerife': [28.2916, -16.6291],
        // Alemania
        'Berlin': [52.5200, 13.4050], 'Hamburg': [53.5511, 9.9937], 'Munich': [48.1351, 11.5820],
        'Cologne': [50.9375, 6.9603], 'Frankfurt': [50.1109, 8.6821], 'Stuttgart': [48.7758, 9.1829],
        'Düsseldorf': [51.2277, 6.7735], 'Dortmund': [51.5136, 7.4653], 'Essen': [51.4556, 7.0116],
        'Bremen': [53.0793, 8.8017], 'Leipzig': [51.3397, 12.3731], 'Dresden': [51.0504, 13.7373],
        'Hanover': [52.3759, 9.7320], 'Nuremberg': [49.4521, 11.0767],
        // Netherlands
        'Amsterdam': [52.3676, 4.9041], 'Rotterdam': [51.9225, 4.4792], 'The Hague': [52.0705, 4.3007],
        'Utrecht': [52.0907, 5.1214], 'Eindhoven': [51.4416, 5.4697], 'Tilburg': [51.5555, 5.0913],
        'Groningen': [53.2192, 6.5667], 'Almere': [52.3702, 5.2141], 'Breda': [51.5895, 4.7734],
        'Nijmegen': [51.8126, 5.8372], 'Haarlem': [52.3874, 4.6462], 'Enschede': [52.2215, 6.8937]
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
                    html: `${count}`,
                    className: 'custom-marker',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
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
            const data = await response.json();
            
            if (data.error || !Array.isArray(data)) {
                statusMessage.textContent = `⚠️ ${data.error || "Failed to load clubs"}`;
                return;
            }

            allClubs = data;
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

    // Dynamic City Dropdown for Apply Form
    const countrySelect = document.getElementById('form-country');
    const citySelect = document.getElementById('form-city');

    const CITIES_BY_COUNTRY = {
        'ES': ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Granada', 'Tarragona', 'San Sebastián', 'Santander', 'Ibiza', 'Marbella', 'Almería', 'Tenerife'],
        'DE': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Bremen', 'Leipzig', 'Dresden', 'Hanover', 'Nuremberg'],
        'NL': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen', 'Haarlem', 'Enschede']
    };

    countrySelect.onchange = () => {
        const country = countrySelect.value;
        const cities = CITIES_BY_COUNTRY[country] || [];
        
        citySelect.innerHTML = '<option value="" disabled selected>2. Select city</option>';
        cities.forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            citySelect.appendChild(opt);
        });
        
        citySelect.disabled = false;
    };

    // Self-Management for Club Owners
    const tg = window.Telegram?.WebApp;
    const username = tg?.initDataUnsafe?.user?.username;

    if (username) {
        checkOwnerStatus(username);
    }

    async function checkOwnerStatus(uname) {
        try {
            const response = await fetch(`/api/my-club?username=${uname}`);
            if (response.ok) {
                const club = await response.json();
                showOwnerTools(club);
            }
        } catch (e) {}
    }

    function showOwnerTools(club) {
        const tools = document.getElementById('owner-tools');
        const openBtn = document.getElementById('open-edit-btn');
        const modal = document.getElementById('edit-modal');
        const closeBtn = document.getElementById('close-edit');
        const form = document.getElementById('edit-form');

        tools.style.display = 'block';
        
        openBtn.onclick = () => {
            document.getElementById('edit-id').value = club.id;
            document.getElementById('edit-name-display').value = club.name;
            document.getElementById('edit-instagram').value = club.instagram || '';
            document.getElementById('edit-description').value = club.description || '';
            modal.style.display = 'block';
        };

        closeBtn.onclick = () => modal.style.display = 'none';

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                id: formData.get('id'),
                username: username,
                instagram: formData.get('instagram'),
                description: formData.get('description')
            };

            const res = await fetch('/api/my-club/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                alert('Club updated successfully!');
                modal.style.display = 'none';
                fetchClubs(); // Refresh main list
            } else {
                alert('Failed to update club.');
            }
        };
    }

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
