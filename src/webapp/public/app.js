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

    const tg = window.Telegram?.WebApp;
    const userLang = tg?.initDataUnsafe?.user?.language_code || 'es';
    const isEnglish = userLang === 'en' || userLang === 'de' || userLang === 'nl'; // Fallback to EN for non-ES
    
    let allClubs = [];
    let savedClubs = JSON.parse(localStorage.getItem('vfpe_saved_clubs')) || [];
    let showOnlySaved = false;
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
                    html: `<span>${count}</span>`,
                    className: 'custom-marker',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
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

    // Fetch plugs from API
    async function fetchClubs() {
        statusMessage.textContent = "Loading verified plugs...";
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
                statusMessage.textContent = "No plugs found in this location yet. Expanding soon.";
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
            const isSaved = savedClubs.includes(club.id);
            const card = document.createElement('div');
            card.className = `club-card ${club.is_premium ? 'premium' : ''}`;
            
            let eventHtml = '';
            if (club.event_message && new Date(club.event_expires_at) > new Date()) {
                eventHtml = `<div class="event-banner">⚡ ${club.event_message}</div>`;
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span class="badge">${club.is_premium ? '⭐ PREMIUM' : 'VERIFIED'}</span>
                    <button class="save-btn" data-id="${club.id}" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">
                        ${isSaved ? '❤️' : '🤍'}
                    </button>
                </div>
                ${eventHtml}
                <h2>${club.name}</h2>
                <p class="location">📍 ${club.city}, ${club.country}</p>
            `;
            
            // Event delegation for the save button
            card.querySelector('.save-btn').onclick = (e) => {
                e.stopPropagation();
                toggleSaveClub(club.id);
            };

            card.onclick = () => {
                logClick(club.id);
                showDetail(club);
            };
            clubList.appendChild(card);
        });
    }

    function toggleSaveClub(id) {
        if (savedClubs.includes(id)) {
            savedClubs = savedClubs.filter(cid => cid !== id);
        } else {
            savedClubs.push(id);
        }
        localStorage.setItem('vfpe_saved_clubs', JSON.stringify(savedClubs));
        filterClubs(); // Re-render to update heart icons
        if (tg) tg.HapticFeedback.impactOccurred('light');
    }

    async function logClick(id) {
        try {
            fetch(`/api/clubs/click/${id}`, { method: 'POST' });
        } catch (e) {}
    }

    function showDetail(club) {
        document.getElementById('detail-name').textContent = club.name;
        document.getElementById('detail-location').textContent = `📍 ${club.city}, ${club.country}`;
        document.getElementById('detail-description').textContent = club.description || 'Verified plug operating under local guidelines.';
        
        const tgLink = document.getElementById('detail-tg-link');
        tgLink.href = `https://t.me/${club.telegram_username.replace('@', '')}`;
        
        const igLink = document.getElementById('detail-ig-link');
        if (club.instagram) {
            igLink.href = `https://instagram.com/${club.instagram.replace('@', '')}`;
            igLink.style.display = "block";
        } else {
            igLink.style.display = "none";
        }

        // Deep Link Share Button
        let shareBtn = document.getElementById('detail-share-btn');
        if (!shareBtn) {
            shareBtn = document.createElement('button');
            shareBtn.id = 'detail-share-btn';
            shareBtn.className = 'cta-secondary'; // Matched UI style
            shareBtn.style.marginTop = '10px';
            shareBtn.style.border = 'none'; // Overriding default button border
            shareBtn.style.cursor = 'pointer';
            document.querySelector('.detail-ctas').appendChild(shareBtn);
        }
        shareBtn.innerHTML = `🔗 ${isEnglish ? 'Share Plug' : 'Compartir Plug'}`;
        shareBtn.onclick = () => {
            const shareUrl = `https://t.me/VerifyPlugEU_bot?startapp=club_${club.id}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                shareBtn.innerHTML = `✅ ${isEnglish ? 'Copied!' : '¡Copiado!'}`;
                setTimeout(() => shareBtn.innerHTML = `🔗 ${isEnglish ? 'Share Plug' : 'Compartir Plug'}`, 2000);
            });
        };

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
        const country = countryFilter.value; // already 'all' | 'ES' | 'DE' | 'NL'
        
        const filtered = allClubs.filter(club => {
            const matchesSearch = club.name.toLowerCase().includes(searchTerm) || 
                                 club.city.toLowerCase().includes(searchTerm);
            const matchesCountry = country === 'all' || 
                                   (club.country || '').toUpperCase() === country.toUpperCase();
            const matchesSaved = !showOnlySaved || savedClubs.includes(club.id);
            return matchesSearch && matchesCountry && matchesSaved;
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

        // Capture the user's numeric ID for bot messaging
        data.tg_user_id = tg?.initDataUnsafe?.user?.id || null;

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                // Redirect to the unique pricing page, passing the username (without the @)
                const uname = data.telegram_username.replace('@', '');
                window.location.href = `/pricing.html?u=${uname}`;
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
    nearMeBtn.title = 'Plugs near me';
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
            alert(isEnglish ? 'Could not get location' : 'No se pudo obtener la ubicación');
            nearMeBtn.innerHTML = '📍';
        });
    };

    // Favorites "⭐ Guardados" filter button logic
    const filtersContainer = document.querySelector('.filters');
    const savedFilterBtn = document.createElement('button');
    savedFilterBtn.id = 'saved-filter-btn';
    savedFilterBtn.className = 'country-select'; // Reuse style
    savedFilterBtn.style.marginLeft = '10px';
    savedFilterBtn.style.cursor = 'pointer';
    savedFilterBtn.innerHTML = isEnglish ? '⭐ Saved' : '⭐ Guardados';
    filtersContainer.appendChild(savedFilterBtn);

    savedFilterBtn.onclick = () => {
        showOnlySaved = !showOnlySaved;
        savedFilterBtn.style.background = showOnlySaved ? '#00d26a' : '#111';
        savedFilterBtn.style.color = showOnlySaved ? '#000' : '#fff';
        filterClubs();
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

    // Self-Management for Plug Owners
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
            
            let eventInput = document.getElementById('edit-event-message');
            if (!eventInput) {
                const submitBtn = form.querySelector('button[type="submit"]');
                const eventGroup = document.createElement('div');
                eventGroup.style.marginBottom = '15px';
                eventGroup.innerHTML = `
                    <label style="font-size: 0.7rem; color: #00d26a; display: block; margin-bottom: 5px;">${isEnglish ? '24h Event / Announcement (PRO+)' : 'Anuncio 24h (Solo PRO+)'}</label>
                    <input type="text" id="edit-event-message" name="event_message" placeholder="Ej: Hoy DJ en vivo a las 22:00" maxlength="50" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #333; background: #222; color: white;">
                `;
                form.insertBefore(eventGroup, submitBtn);
                eventInput = document.getElementById('edit-event-message');
            }
            
            // Only show the event message if it hasn't expired
            if (club.event_message && new Date(club.event_expires_at) > new Date()) {
                eventInput.value = club.event_message;
            } else {
                eventInput.value = '';
            }

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
                description: formData.get('description'),
                event_message: formData.get('event_message')
            };

            const res = await fetch('/api/my-club/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                alert('Plug updated successfully!');
                modal.style.display = 'none';
                fetchClubs(); // Refresh main list
            } else {
                alert('Failed to update plug.');
            }
        };
    }

    // Initialize
    initMap();
    fetchClubs();

    // Telegram WebApp integration and Deep Link Handling
    if (tg) {
        tg.expand();
        tg.ready();
        
        // Auto-translate initial static text if English
        if (isEnglish) {
            searchInput.placeholder = "Search plug or city...";
            openApplyBtn.textContent = "Apply for Verification";
            // More static translations can be added here
        }

        // Handle Deep Link (startapp=club_123)
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith('club_')) {
            const clubId = parseInt(startParam.split('_')[1]);
            // Wait a moment for clubs to load, then open detail
            setTimeout(() => {
                const targetClub = allClubs.find(c => c.id === clubId);
                if (targetClub) {
                    showDetail(targetClub);
                }
            }, 1000);
        }
    }
});
