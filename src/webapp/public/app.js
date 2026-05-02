document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM REFS ────────────────────────────────────────────────────────────
    const clubList        = document.getElementById('club-list');
    const searchInput     = document.getElementById('search-input');
    const countryFilter   = document.getElementById('country-filter');
    const clubCount       = document.getElementById('club-count');
    const statusMessage   = document.getElementById('status-message');
    const applyModal      = document.getElementById('apply-modal');
    const detailScreen    = document.getElementById('detail-screen');
    const openApplyBtn    = document.getElementById('open-apply-modal');
    const closeApplyBtn   = document.querySelector('#apply-modal .close');
    const closeDetailBtn  = document.getElementById('close-detail');
    const applyForm       = document.getElementById('apply-form');
    const reviewModal     = document.getElementById('review-modal');
    const closeReviewBtn  = document.getElementById('close-review');

    // ─── TELEGRAM ────────────────────────────────────────────────────────────
    const tg         = window.Telegram?.WebApp;
    const userLang   = tg?.initDataUnsafe?.user?.language_code || 'es';
    const isEnglish  = (userLang !== 'es');
    const tgUserId   = tg?.initDataUnsafe?.user?.id;
    const tgUsername = tg?.initDataUnsafe?.user?.username;

    // User fingerprint: TG user ID (string) or persistent UUID fallback
    let userFingerprint = tgUserId
        ? String(tgUserId)
        : localStorage.getItem('vfpe_fp') || (() => {
            const fp = crypto.randomUUID();
            localStorage.setItem('vfpe_fp', fp);
            return fp;
        })();

    // ─── STATE ───────────────────────────────────────────────────────────────
    let allClubs    = [];
    let likedClubs  = new Set(JSON.parse(localStorage.getItem('vfpe_liked_clubs') || '[]'));
    let activeTag   = 'all';
    let currentClub = null;
    let selectedRating = 0;
    let map;
    let markers = [];

    // ─── CITY COORDS (kept from v1) ──────────────────────────────────────────
    const cityCoords = {
        'Madrid': [40.4168, -3.7038], 'Barcelona': [41.3851, 2.1734], 'Valencia': [39.4699, -0.3763],
        'Sevilla': [37.3891, -5.9845], 'Zaragoza': [41.6488, -0.8891], 'Málaga': [36.7213, -4.4214],
        'Murcia': [37.9922, -1.1307], 'Palma': [39.5696, 2.6502], 'Las Palmas': [28.1248, -15.4300],
        'Bilbao': [43.2630, -2.9350], 'Alicante': [38.3452, -0.4810], 'Córdoba': [37.8882, -4.7794],
        'Valladolid': [41.6523, -4.7245], 'Vigo': [42.2406, -8.7207], 'Gijón': [43.5357, -5.6615],
        'Granada': [37.1773, -3.5986], 'Tarragona': [41.1189, 1.2445], 'San Sebastián': [43.3183, -1.9812],
        'Ibiza': [38.9067, 1.4206], 'Marbella': [36.5100, -4.8800], 'Tenerife': [28.2916, -16.6291],
        'Berlin': [52.5200, 13.4050], 'Hamburg': [53.5511, 9.9937], 'Munich': [48.1351, 11.5820],
        'Cologne': [50.9375, 6.9603], 'Frankfurt': [50.1109, 8.6821],
        'Amsterdam': [52.3676, 4.9041], 'Rotterdam': [51.9225, 4.4792], 'The Hague': [52.0705, 4.3007],
        'Utrecht': [52.0907, 5.1214], 'Eindhoven': [51.4416, 5.4697]
    };

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    function getColorIndex(name) {
        let sum = 0;
        for (const c of name) sum += c.charCodeAt(0);
        return sum % 5;
    }

    function getTagEmoji(tag) {
        return { delivery: '🚚', meetup: '🤝', postal: '📬' }[tag] || '🏷';
    }

    function renderStars(rating, total = 5) {
        const filled = Math.round(rating);
        return '★'.repeat(filled) + '☆'.repeat(total - filled);
    }

    function getTimeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr);
        const d = Math.floor(diff / 86400000);
        if (d === 0) return 'Today';
        if (d === 1) return 'Yesterday';
        if (d < 7)  return `${d}d ago`;
        if (d < 30) return `${Math.floor(d / 7)}w ago`;
        return `${Math.floor(d / 30)}mo ago`;
    }

    // ─── MAP ─────────────────────────────────────────────────────────────────
    function initMap() {
        if (map) return;
        map = L.map('map', { zoomControl: false }).setView([40.4168, -3.7038], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    }

    function updateMapMarkers(clubs) {
        if (!map) return;
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        const cities = [...new Set(clubs.map(c => c.city))];
        cities.forEach(city => {
            const coords = cityCoords[city];
            if (!coords) return;
            const count = clubs.filter(c => c.city === city).length;
            const icon = L.divIcon({
                html: `<span>${count}</span>`,
                className: 'custom-marker',
                iconSize: [32, 32], iconAnchor: [16, 32]
            });
            const m = L.marker(coords, { icon }).addTo(map);
            m.on('click', () => { searchInput.value = city; filterClubs(); map.setView(coords, 10); });
            markers.push(m);
        });
    }

    // ─── NEAR ME BUTTON ──────────────────────────────────────────────────────
    const nearMeBtn = document.createElement('button');
    nearMeBtn.id = 'near-me-btn';
    nearMeBtn.innerHTML = '📍';
    nearMeBtn.title = 'Plugs near me';
    document.getElementById('map-container').appendChild(nearMeBtn);
    nearMeBtn.onclick = () => {
        if (!navigator.geolocation) return alert('Geolocation not supported');
        nearMeBtn.innerHTML = '⌛';
        navigator.geolocation.getCurrentPosition(pos => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 12);
            L.circle([pos.coords.latitude, pos.coords.longitude], { radius: 200, color: '#00d26a' }).addTo(map);
            nearMeBtn.innerHTML = '📍';
        }, () => { nearMeBtn.innerHTML = '📍'; });
    };

    const urlParams = new URLSearchParams(window.location.search);
    const isDemo = urlParams.get('demo') === 'true';
    const isDemoOwner = urlParams.get('owner') === 'true';
    
    const DEMO_CLUBS = [
        { id: 999, name: 'Cali King Ibiza', city: 'Ibiza', country: 'ES', telegram_username: '@CaliKingIBZ', instagram: '@caliking_ibiza', description: 'Top shelf boutique imports. Only for connoisseurs in the island.', status: 'verified', is_premium: true, selected_plan: 'Advanced', event_message: '⚡ NEW CALI DROPPING TODAY!', event_expires_at: new Date(Date.now() + 86400000).toISOString(), rating_avg: 4.9, reviews_count: 124, likes_count: 850, view_count: 5400, click_count: 1200, service_tags: ['delivery', 'meetup'], photo_url: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=800' },
        { id: 998, name: 'The High Lab', city: 'Berlin', country: 'DE', telegram_username: '@HighLabBerlin', instagram: '@highlab_de', description: 'The original underground spot in Berlin. Best extracts in the city.', status: 'verified', is_premium: true, selected_plan: 'Advanced', event_message: '🔥 Live Resin tasting event', event_expires_at: new Date(Date.now() + 86400000).toISOString(), rating_avg: 4.7, reviews_count: 89, likes_count: 420, view_count: 3100, click_count: 800, service_tags: ['meetup'], photo_url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&q=80&w=800' },
        { id: 997, name: 'Green Garden', city: 'Madrid', country: 'ES', telegram_username: '@GreenGardenMAD', instagram: '@greengarden_mad', description: 'Organic flowers grown with love. Center city delivery.', status: 'verified', is_premium: false, selected_plan: 'PRO', rating_avg: 4.5, reviews_count: 56, likes_count: 210, view_count: 1500, click_count: 340, service_tags: ['delivery'], photo_url: '' },
        { id: 996, name: 'Dutch Delight', city: 'Amsterdam', country: 'NL', telegram_username: '@DutchDelightAMS', instagram: '@dutch_delight', description: 'Real amsterdam genetics. Shipping available worldwide.', status: 'verified', is_premium: false, selected_plan: 'Basic', rating_avg: 4.2, reviews_count: 34, likes_count: 150, view_count: 900, click_count: 120, service_tags: ['postal'], photo_url: '' },
        { id: 995, name: 'Space Club', city: 'Barcelona', country: 'ES', telegram_username: '@SpaceClubBCN', instagram: '@spaceclub_bcn', description: 'The cosmic experience in Barcelona. High THC strains.', status: 'verified', is_premium: true, selected_plan: 'Advanced', rating_avg: 4.8, reviews_count: 110, likes_count: 670, view_count: 4200, click_count: 950, service_tags: ['delivery', 'meetup'], photo_url: 'https://images.unsplash.com/photo-1594498257602-32638e98587a?auto=format&fit=crop&q=80&w=800' }
    ];

    const DEMO_REVIEWS = [
        { id: 1, reviewer_handle: '@User123', rating: 5, review_text: 'Best quality I found in the island. Very professional.', created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 2, reviewer_handle: '@SmokeMaster', rating: 5, review_text: 'Fast delivery and amazing smell. 10/10.', created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, reviewer_handle: '@Tester', rating: 4, review_text: 'Good stuff but a bit expensive.', created_at: new Date(Date.now() - 172800000).toISOString() }
    ];

    // ─── FETCH ───────────────────────────────────────────────────────────────
    async function fetchClubs() {
        if (isDemo) {
            console.log(`[Demo] Loading dummy data (Owner: ${isDemoOwner})...`);
            allClubs = DEMO_CLUBS;
            clubCount.textContent = allClubs.length;
            statusMessage.textContent = '';
            filterClubs();
            // Force owner tools for demo ONLY IF owner=true
            if (isDemoOwner) showOwnerTools(DEMO_CLUBS[0]);
            return;
        }
        statusMessage.textContent = 'Loading verified plugs...';
        try {
            const data = await fetch('/api/clubs').then(r => r.json());
            if (!Array.isArray(data)) { statusMessage.textContent = '⚠️ Failed to load plugs'; return; }
            allClubs = data;
            clubCount.textContent = allClubs.length;
            statusMessage.textContent = '';
            filterClubs();
        } catch (e) {
            statusMessage.textContent = 'Connection error. Please try again.';
        }
    }

    // ─── FILTER ──────────────────────────────────────────────────────────────
    function filterClubs() {
        const search  = searchInput.value.toLowerCase();
        const country = countryFilter.value;

        const filtered = allClubs.filter(c => {
            const matchSearch  = c.name.toLowerCase().includes(search) || c.city.toLowerCase().includes(search);
            const matchCountry = country === 'all' || (c.country || '').toUpperCase() === country.toUpperCase();
            const matchTag     = activeTag === 'all' || (c.service_tags || []).includes(activeTag);
            return matchSearch && matchCountry && matchTag;
        });

        renderClubs(filtered);
        updateMapMarkers(filtered);
    }

    searchInput.addEventListener('input', filterClubs);
    countryFilter.addEventListener('change', filterClubs);

    // Service tag filters
    document.querySelectorAll('.tag-filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTag = btn.dataset.tag;
            filterClubs();
        };
    });

    // ─── RENDER CARDS ────────────────────────────────────────────────────────
    function renderClubs(clubs) {
        clubList.innerHTML = '';
        if (clubs.length === 0) {
            statusMessage.textContent = search => `No results. Try a different filter.`;
            return;
        }
        statusMessage.textContent = '';

        const sorted = [...clubs].sort((a, b) => (b.is_premium ? 1 : 0) - (a.is_premium ? 1 : 0));

        sorted.forEach(club => {
            const isLiked = likedClubs.has(Number(club.id));
            const tags    = Array.isArray(club.service_tags) ? club.service_tags : [];
            const idx     = getColorIndex(club.name);

            const photoStyle = club.photo_url
                ? `background-image: url('${club.photo_url}');`
                : '';
            const photoClass = club.photo_url ? '' : `club-gradient-${idx}`;

            const eventHtml = (club.selected_plan === 'Advanced' && club.event_message && new Date(club.event_expires_at) > new Date())
                ? `<div class="event-banner">⚡ ${club.event_message}</div>`
                : '';

            const ratingHtml = (club.rating_avg > 0)
                ? `<span class="card-rating">⭐ ${club.rating_avg}</span>`
                : '';

            const tagsHtml = tags.map(t => `<span class="tag-chip">${getTagEmoji(t)} ${t}</span>`).join('');

            const card = document.createElement('div');
            card.className = `club-card ${club.is_premium ? 'premium' : ''}`;
            card.innerHTML = `
                <div class="card-photo ${photoClass}" style="${photoStyle}">
                    <div class="card-photo-overlay">
                        <span class="badge ${club.is_premium ? 'premium-badge' : ''}">${club.is_premium ? '⭐ PREMIUM' : '✅ VERIFIED'}</span>
                        <button class="card-like-btn ${isLiked ? 'liked' : ''}" data-id="${club.id}">
                            ${isLiked ? '❤️' : '🤍'} ${club.likes_count || 0}
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${eventHtml}
                    <h2>${club.name}</h2>
                    <p class="location">📍 ${club.city}, ${club.country}</p>
                    <div class="card-meta-row">
                        ${ratingHtml}
                        <div class="card-tags">${tagsHtml}</div>
                    </div>
                </div>
            `;

            // Like button — stop propagation so it doesn't open detail
            card.querySelector('.card-like-btn').onclick = e => {
                e.stopPropagation();
                toggleLike(club.id);
            };

            card.onclick = () => { 
                logClick(club.id); 
                logView(club.id);
                showDetail(club); 
            };
            clubList.appendChild(card);
        });
    }

    // ─── LIKES ───────────────────────────────────────────────────────────────
    async function toggleLike(clubId) {
        const id      = Number(clubId);
        const isLiked = likedClubs.has(id);

        // Optimistic update
        const club = allClubs.find(c => Number(c.id) === id);
        if (isLiked) {
            likedClubs.delete(id);
            if (club) club.likes_count = Math.max(0, (club.likes_count || 0) - 1);
        } else {
            likedClubs.add(id);
            if (club) club.likes_count = (club.likes_count || 0) + 1;
        }
        localStorage.setItem('vfpe_liked_clubs', JSON.stringify([...likedClubs]));

        // Update current detail if open
        if (currentClub && Number(currentClub.id) === id) updateDetailLike();

        filterClubs(); // Re-render cards
        if (tg) tg.HapticFeedback.impactOccurred('light');

        // Persist to server (fire-and-forget)
        fetch(`/api/clubs/${clubId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fingerprint: userFingerprint })
        }).catch(() => {});
    }

    function updateDetailLike() {
        if (!currentClub) return;
        const isLiked = likedClubs.has(Number(currentClub.id));
        const btn     = document.getElementById('detail-like-btn');
        const icon    = document.getElementById('detail-like-icon');
        const count   = document.getElementById('detail-likes-count');
        if (btn)   btn.classList.toggle('liked', isLiked);
        if (icon)  icon.textContent = isLiked ? '❤️' : '🤍';
        if (count) count.textContent = currentClub.likes_count || 0;
    }

    async function logClick(id) {
        fetch(`/api/clubs/click/${id}`, { method: 'POST' }).catch(() => {});
    }

    async function logView(id) {
        fetch(`/api/clubs/view/${id}`, { method: 'POST' }).catch(() => {});
    }

    // ─── REPORTING ───────────────────────────────────────────────────────────
    const reportModal = document.getElementById('report-modal');
    const closeReport = document.getElementById('close-report');
    
    document.getElementById('open-report-btn').onclick = () => {
        if (!currentClub) return;
        reportModal.style.display = 'block';
    };

    closeReport.onclick = () => { reportModal.style.display = 'none'; };

    document.getElementById('submit-report-btn').onclick = async () => {
        if (!currentClub) return;
        const reason  = document.getElementById('report-reason').value;
        const details = document.getElementById('report-details').value.trim();
        
        const btn = document.getElementById('submit-report-btn');
        btn.disabled = true; btn.textContent = 'Sending...';

        try {
            const res = await fetch(`/api/clubs/report/${currentClub.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, details, reporter_handle: tgUsername || 'anonymous' })
            });
            if (res.ok) {
                alert('Thank you. Our moderators will review this plug.');
                reportModal.style.display = 'none';
            }
        } catch { alert('Error sending report.'); }
        finally { btn.disabled = false; btn.textContent = 'Send Report'; }
    };

    // ─── SHOW DETAIL ─────────────────────────────────────────────────────────
    function showDetail(club) {
        currentClub = club;
        const tags    = Array.isArray(club.service_tags) ? club.service_tags : [];
        const isLiked = likedClubs.has(Number(club.id));

        // Hero background
        const hero  = document.getElementById('detail-hero');
        const idx   = getColorIndex(club.name);
        if (club.photo_url) {
            hero.style.backgroundImage = `url('${club.photo_url}')`;
            hero.className = 'detail-hero';
        } else {
            hero.style.backgroundImage = '';
            hero.className = `detail-hero club-gradient-${idx}`;
        }

        // Badges
        const badgesEl = document.getElementById('detail-badges');
        badgesEl.innerHTML = `<span class="detail-badge verified">✅ VERIFIED</span>` +
            (club.is_premium ? `<span class="detail-badge premium">⭐ PREMIUM</span>` : '');

        // Name & location
        document.getElementById('detail-name').textContent     = club.name;
        document.getElementById('detail-location').textContent = `📍 ${club.city}, ${club.country}`;

        // Stats bar
        document.getElementById('detail-like-btn').classList.toggle('liked', isLiked);
        document.getElementById('detail-like-icon').textContent  = isLiked ? '❤️' : '🤍';
        document.getElementById('detail-likes-count').textContent = club.likes_count || 0;
        document.getElementById('detail-stars-display').textContent = renderStars(club.rating_avg || 0);
        document.getElementById('detail-rating-val').textContent = club.rating_avg > 0 ? club.rating_avg : '—';
        document.getElementById('detail-reviews-count').textContent = `${club.reviews_count || 0} reviews`;

        // Service tags
        const tagsRow = document.getElementById('detail-tags-row');
        tagsRow.innerHTML = tags.map(t => `<span class="detail-tag-chip">${getTagEmoji(t)} ${t}</span>`).join('');

        // Event banner
        const eventBanner = document.getElementById('detail-event-banner');
        if (club.selected_plan === 'Advanced' && club.event_message && new Date(club.event_expires_at) > new Date()) {
            eventBanner.textContent = `⚡ ${club.event_message}`;
            eventBanner.style.display = 'block';
        } else {
            eventBanner.style.display = 'none';
        }

        // CTA links
        document.getElementById('detail-tg-link').href = `https://t.me/${club.telegram_username.replace('@', '')}`;
        const igLink = document.getElementById('detail-ig-link');
        if (club.instagram) {
            igLink.href = `https://instagram.com/${club.instagram.replace('@', '')}`;
            igLink.style.display = 'block';
        } else {
            igLink.style.display = 'none';
        }

        // Share button
        document.getElementById('detail-share-btn').onclick = () => {
            const url = `https://t.me/VerifyPlugEU_bot?startapp=club_${club.id}`;
            navigator.clipboard.writeText(url).then(() => {
                const btn = document.getElementById('detail-share-btn');
                btn.textContent = '✅ Copied!';
                setTimeout(() => { btn.textContent = '🔗 Share Plug'; }, 2000);
            });
        };

        // Description
        document.getElementById('detail-description').textContent =
            club.description || 'Verified plug operating under local guidelines.';

        // Show screen
        detailScreen.style.display = 'flex';
        detailScreen.style.flexDirection = 'column';
        detailScreen.scrollTop = 0;
        document.body.style.overflow = 'hidden';

        // Load reviews async
        loadReviews(club.id);

        // Like button in detail
        document.getElementById('detail-like-btn').onclick = () => toggleLike(club.id);
    }

    function hideDetail() {
        detailScreen.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentClub = null;
    }

    // ─── REVIEWS ─────────────────────────────────────────────────────────────
    async function loadReviews(clubId) {
        const list = document.getElementById('reviews-list');
        list.innerHTML = `<p style="color:#555; font-size:0.85rem; text-align:center; padding:10px;">Loading reviews...</p>`;
        
        if (isDemo) {
            const reviews = DEMO_REVIEWS;
            list.innerHTML = reviews.map(r => `
                <div class="review-card">
                    <div class="review-header">
                        <span class="review-handle">@${r.reviewer_handle.replace('@', '')}</span>
                        <span class="review-stars">${renderStars(r.rating)}</span>
                        <span class="review-date">${getTimeAgo(r.created_at)}</span>
                    </div>
                    ${r.review_text ? `<p class="review-text">${r.review_text}</p>` : ''}
                </div>
            `).join('');
            return;
        }

        try {
            const reviews = await fetch(`/api/clubs/${clubId}/reviews`).then(r => r.json());
            if (!reviews.length) {
                list.innerHTML = `<div class="no-reviews-msg">No reviews yet. Be the first!</div>`;
                return;
            }
            list.innerHTML = reviews.map(r => `
                <div class="review-card">
                    <div class="review-header">
                        <span class="review-handle">@${r.reviewer_handle.replace('@', '')}</span>
                        <span class="review-stars">${renderStars(r.rating)}</span>
                        <span class="review-date">${getTimeAgo(r.created_at)}</span>
                    </div>
                    ${r.review_text ? `<p class="review-text">${r.review_text}</p>` : ''}
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = `<div class="no-reviews-msg">Could not load reviews.</div>`;
        }
    }

    // ─── REVIEW MODAL ────────────────────────────────────────────────────────
    document.getElementById('write-review-btn').onclick = () => {
        if (!currentClub) return;
        // Pre-fill handle from TG
        const handleInput = document.getElementById('review-handle');
        handleInput.value = tgUsername ? `@${tgUsername}` : '';
        handleInput.readOnly = !!tgUsername;
        selectedRating = 0;
        document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
        document.getElementById('star-label').textContent = 'Tap to rate';
        document.getElementById('review-text').value = '';
        reviewModal.style.display = 'block';
    };

    closeReviewBtn.onclick = () => { reviewModal.style.display = 'none'; };

    // Star picker logic
    const starLabels = ['', 'Poor 😕', 'Fair 😐', 'Good 👍', 'Very Good 😊', 'Excellent 🤩'];
    document.querySelectorAll('.star').forEach(star => {
        star.onclick = () => {
            selectedRating = parseInt(star.dataset.val);
            document.querySelectorAll('.star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.val) <= selectedRating);
            });
            document.getElementById('star-label').textContent = starLabels[selectedRating];
        };
    });

    document.getElementById('submit-review-btn').onclick = async () => {
        if (!currentClub) return;
        if (selectedRating === 0) { alert('Please select a rating!'); return; }

        const handle = document.getElementById('review-handle').value.trim();
        const text   = document.getElementById('review-text').value.trim();

        if (!handle) { alert('Please enter your Telegram @handle'); return; }

        const btn = document.getElementById('submit-review-btn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
            const res = await fetch(`/api/clubs/${currentClub.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: selectedRating, review_text: text, reviewer_handle: handle })
            });
            const result = await res.json();
            if (result.success) {
                reviewModal.style.display = 'none';
                // Update local club state
                currentClub.reviews_count = (currentClub.reviews_count || 0) + 1;
                document.getElementById('detail-reviews-count').textContent = `${currentClub.reviews_count} reviews`;
                loadReviews(currentClub.id);
                if (tg) tg.HapticFeedback.notificationOccurred('success');
            } else {
                alert('❌ Failed to submit review.');
            }
        } catch (e) {
            alert('❌ Connection error.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit Review';
        }
    };

    // ─── APPLY MODAL ─────────────────────────────────────────────────────────
    openApplyBtn.onclick  = () => { applyModal.style.display  = 'block'; };
    closeApplyBtn.onclick = () => { applyModal.style.display  = 'none';  };
    closeDetailBtn.onclick = hideDetail;

    window.onclick = e => {
        if (e.target === applyModal)  applyModal.style.display  = 'none';
        if (e.target === reviewModal) reviewModal.style.display = 'none';
    };

    // Dynamic city dropdown in apply form
    const countrySelect = document.getElementById('form-country');
    const citySelect    = document.getElementById('form-city');
    const CITIES_BY_COUNTRY = {
        'ES': ['Madrid','Barcelona','Valencia','Sevilla','Zaragoza','Málaga','Murcia','Palma','Las Palmas','Bilbao','Alicante','Córdoba','Valladolid','Vigo','Granada','San Sebastián','Ibiza','Marbella','Tenerife'],
        'DE': ['Berlin','Hamburg','Munich','Cologne','Frankfurt','Stuttgart','Düsseldorf','Bremen','Leipzig','Dresden'],
        'NL': ['Amsterdam','Rotterdam','The Hague','Utrecht','Eindhoven','Tilburg','Groningen','Haarlem']
    };
    countrySelect.onchange = () => {
        const cities = CITIES_BY_COUNTRY[countrySelect.value] || [];
        citySelect.innerHTML = '<option value="" disabled selected>2. Select city</option>';
        cities.forEach(c => { const o = document.createElement('option'); o.value = o.textContent = c; citySelect.appendChild(o); });
        citySelect.disabled = false;
    };

    applyForm.onsubmit = async e => {
        e.preventDefault();
        const btn = applyForm.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Sending...';
        const data = Object.fromEntries(new FormData(applyForm).entries());
        if (!data.telegram_username.startsWith('@')) data.telegram_username = '@' + data.telegram_username;
        data.tg_user_id = tgUserId || null;
        // Collect service tags from checkboxes
        data.service_tags = [...document.querySelectorAll('.apply-tag:checked')].map(cb => cb.value);
        try {
            const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await res.json();
            if (result.success) {
                window.location.href = `/pricing.html?u=${data.telegram_username.replace('@', '')}`;
            } else {
                alert('❌ Error: ' + (result.error || 'Unknown'));
            }
        } catch { alert('❌ Connection error.'); }
        finally { btn.disabled = false; btn.textContent = 'Submit Verification Request'; }
    };

    // ─── OWNER SELF-MANAGEMENT (unchanged) ───────────────────────────────────
    if (tgUsername) checkOwnerStatus(tgUsername);

    async function checkOwnerStatus(uname) {
        try {
            const res = await fetch(`/api/my-club?username=${uname}`);
            if (res.ok) showOwnerTools(await res.json());
        } catch {}
    }

    function showOwnerTools(club) {
        const tools = document.getElementById('owner-tools');
        tools.style.display = 'block';
        document.getElementById('open-edit-btn').onclick = () => {
            document.getElementById('edit-id').value            = club.id;
            document.getElementById('edit-name-display').value  = club.name;
            document.getElementById('edit-instagram').value     = club.instagram || '';
            document.getElementById('edit-photo-url').value    = club.photo_url || '';
            document.getElementById('edit-description').value   = club.description || '';
            
            // Advanced Plan Feature
            const eventGroup = document.getElementById('edit-event-group');
            if (club.selected_plan === 'Advanced') {
                eventGroup.style.display = 'block';
                document.getElementById('edit-event-message').value = club.event_message || '';
            } else {
                eventGroup.style.display = 'none';
            }

            // V2: Populate Owner Stats
            document.getElementById('owner-views').textContent  = club.view_count || 0;
            document.getElementById('owner-clicks').textContent = club.click_count || 0;
            document.getElementById('owner-likes').textContent  = club.likes_count || 0;

            // Populate service tag checkboxes
            const clubTags = Array.isArray(club.service_tags) ? club.service_tags : [];
            ['delivery', 'meetup', 'postal'].forEach(tag => {
                const cb = document.getElementById(`owner-tag-${tag}`);
                if (cb) cb.checked = clubTags.includes(tag);
            });
            document.getElementById('edit-modal').style.display = 'block';
        };
        document.getElementById('close-edit').onclick = () => { document.getElementById('edit-modal').style.display = 'none'; };
        document.getElementById('edit-form').onsubmit = async e => {
            e.preventDefault();
            const fd = new FormData(document.getElementById('edit-form'));
            const selectedTags = ['delivery', 'meetup', 'postal'].filter(t => {
                const cb = document.getElementById(`owner-tag-${t}`);
                return cb && cb.checked;
            });
            const res = await fetch('/api/my-club/update', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: fd.get('id'),
                    username: tgUsername || 'DEMO_USER', // Fallback for demo
                    instagram: fd.get('instagram'),
                    photo_url: fd.get('photo_url'),
                    description: fd.get('description'),
                    event_message: fd.get('event_message'),
                    service_tags: selectedTags
                })
            });
            if (res.ok) { document.getElementById('edit-modal').style.display = 'none'; fetchClubs(); }
            else alert('Failed to update plug.');
        };
    }

    // ─── DEEP LINK HANDLING ──────────────────────────────────────────────────
    if (tg) {
        tg.expand();
        tg.ready();
        if (isEnglish) {
            searchInput.placeholder = 'Search plug or city...';
            openApplyBtn.textContent = 'Apply for Verification';
        }
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam?.startsWith('club_')) {
            const clubId = parseInt(startParam.split('_')[1]);
            setTimeout(() => {
                const target = allClubs.find(c => c.id === clubId);
                if (target) showDetail(target);
            }, 1200);
        }
    }

    // ─── INIT ────────────────────────────────────────────────────────────────
    initMap();
    fetchClubs();
});
