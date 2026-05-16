// Configuration
const firebaseConfig = {
    databaseURL: "https://ghana-ambulance-60a8d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.database();
} catch (err) {
    console.error("Firebase Init Error:", err);
}

// State
let map;
let userMarker;
let ambulances = [];
let userLocation = { lat: 5.6037, lng: -0.1870 }; // Default Accra

// Init App
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initMap();
    setupEventListeners();
    fetchAmbulancesFromFirebase();
    startClock();
});

function startClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;
    setInterval(() => {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString();
    }, 1000);
}

function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        const userName = localStorage.getItem('userName');
        if (userName) {
            document.getElementById('user-display-name').innerText = userName;
        }
        showScreen('main-screen');
    } else {
        showScreen('auth-screen');
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
    
    if (screenId === 'main-screen' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

function initMap() {
    map = L.map('map', {
        zoomControl: false
    }).setView([userLocation.lat, userLocation.lng], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const userIcon = L.divIcon({
        className: 'user-marker',
        html: '<div style="background: #FCD116; width: 15px; height: 15px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #FCD116;"></div>',
        iconSize: [20, 20]
    });

    userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            userLocation.lat = position.coords.latitude;
            userLocation.lng = position.coords.longitude;
            userMarker.setLatLng([userLocation.lat, userLocation.lng]);
            map.setView([userLocation.lat, userLocation.lng], 14);
        });
    }

    renderAmbulances();
}

function renderAmbulances() {
    ambulances.forEach(amb => {
        if (amb.marker) {
            amb.marker.setLatLng([amb.lat, amb.lng]);
        } else {
            const ambIcon = L.divIcon({
                className: 'ambulance-marker',
                html: `<div style="background: #E03C31; padding: 5px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 0 10px rgba(224, 60, 49, 0.5);">
                        <i class="fas fa-truck-medical" style="font-size: 12px;"></i>
                       </div>`,
                iconSize: [30, 30]
            });
            amb.marker = L.marker([amb.lat, amb.lng], { icon: ambIcon }).addTo(map)
                .bindPopup(`<b>Ambulance ${amb.id}</b><br>Status: ${amb.status}`);
        }
    });
}

// Simulation removed as we now use real-time Firebase data

function fetchAmbulancesFromFirebase() {
    if (!window.db) return;
    window.db.ref('ambulances').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const fbAmbulances = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
            if (fbAmbulances.length > 0) {
                ambulances = fbAmbulances;
                renderAmbulances();
            }
        }
    });
}

function setupEventListeners() {
    // Toggle Screens
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen('register-screen');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen('auth-screen');
    });

    // Login
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('password').value;

        if (window.db) {
            window.db.ref(`users/${phone}`).once('value', (snap) => {
                const userData = snap.val();
                if (userData && userData.password === password) {
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('userPhone', phone);
                    localStorage.setItem('userName', userData.name);

                    document.getElementById('user-display-name').innerText = userData.name;
                    showScreen('main-screen');
                } else {
                    alert("Invalid Phone Number or Password.");
                }
            });
        } else {
            // Fallback for development if no DB
            localStorage.setItem('isLoggedIn', 'true');
            showScreen('main-screen');
        }
    });

    // Register
    document.getElementById('register-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const phone = document.getElementById('reg-phone').value;
        const ghCard = document.getElementById('reg-ghana-card').value;
        const password = document.getElementById('reg-password').value;

        if (window.db) {
            window.db.ref(`users/${phone}`).once('value', (snap) => {
                if (snap.exists()) {
                    alert("A user with this phone number already exists.");
                } else {
                    window.db.ref(`users/${phone}`).set({
                        name: name,
                        phone: phone,
                        ghana_card: ghCard,
                        password: password,
                        registered_at: Date.now()
                    }).then(() => {
                        alert(`Account created for ${name}! You can now login.`);
                        showScreen('auth-screen');
                        e.target.reset();
                    }).catch(err => {
                        console.error("Registration Error:", err);
                        alert("Error creating account. Please try again.");
                    });
                }
            });
        } else {
            alert("Database not connected. Please check your connection.");
        }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.setItem('isLoggedIn', 'false');
        document.getElementById('sidebar')?.classList.remove('active');
        showScreen('auth-screen');
    });

    // Sidebar
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const closeSidebar = document.getElementById('close-sidebar');

    menuBtn?.addEventListener('click', () => sidebar?.classList.add('active'));
    closeSidebar?.addEventListener('click', () => sidebar?.classList.remove('active'));

    // Sidebar nav items
    document.getElementById('nav-first-aid')?.addEventListener('click', (e) => {
        e.preventDefault();
        sidebar?.classList.remove('active');
        document.getElementById('first-aid-modal')?.classList.add('active');
    });

    document.getElementById('nav-history')?.addEventListener('click', (e) => {
        e.preventDefault();
        sidebar?.classList.remove('active');
        document.getElementById('history-modal')?.classList.add('active');
    });

    document.getElementById('nav-profile')?.addEventListener('click', (e) => {
        e.preventDefault();
        sidebar?.classList.remove('active');
        document.getElementById('profile-modal')?.classList.add('active');
    });

    document.getElementById('nav-settings')?.addEventListener('click', (e) => {
        e.preventDefault();
        sidebar?.classList.remove('active');
        document.getElementById('settings-modal')?.classList.add('active');
    });

    // Emergency FAB
    document.getElementById('emergency-fab')?.addEventListener('click', () => {
        document.getElementById('emergency-modal')?.classList.add('active');
    });

    // Emergency Type Selection
    document.querySelectorAll('.emergency-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('emergency-modal')?.classList.remove('active');
            startScanning(btn.getAttribute('data-type'));
        });
    });

    // Close Modals — all wired by ID (no inline onclick needed)
    const closeModalMap = {
        'close-modal':      'emergency-modal',
        'close-result':     'result-card',
        'close-first-aid':  'first-aid-modal',
        'close-history':    'history-modal',
        'close-profile':    'profile-modal',
        'close-settings':   'settings-modal'
    };
    Object.entries(closeModalMap).forEach(([btnId, modalId]) => {
        document.getElementById(btnId)?.addEventListener('click', () => {
            document.getElementById(modalId)?.classList.remove('active');
        });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Global Click Outside sidebar
    document.addEventListener('click', (e) => {
        if (sidebar?.classList.contains('active') && !sidebar.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
}

function startScanning(emergencyType) {
    const overlay = document.getElementById('scanning-overlay');
    const status = document.getElementById('scanning-status');
    overlay?.classList.add('active');
    if (status) status.innerText = `Analyzing ${emergencyType} request...`;

    setTimeout(() => {
        const nearest = findNearestAmbulance();
        if (nearest) {
            overlay?.classList.remove('active');
            showResult(nearest);
            if (window.db) {
                const reqRef = window.db.ref('requests').push();
                reqRef.set({
                    type: emergencyType,
                    user_lat: userLocation.lat,
                    user_lng: userLocation.lng,
                    timestamp: Date.now(),
                    status: 'Pending',
                    assigned_ambulance: nearest.id
                });
                
                reqRef.on('value', (snap) => {
                    const req = snap.val();
                    if (req && req.status === 'Accepted') {
                        const btn = document.querySelector('#result-card .btn-primary');
                        if (btn) {
                            btn.innerHTML = "<i class='fas fa-check-circle'></i> Driver En Route";
                            btn.style.background = "var(--primary-green)";
                        }
                    } else if (req && req.status === 'Declined') {
                        alert("The driver declined the request. Please request help again.");
                        document.getElementById('result-card').classList.remove('active');
                        reqRef.off();
                    } else if (req && req.status === 'Completed') {
                        alert("Mission Completed. Driver has arrived/dropped off.");
                        document.getElementById('result-card').classList.remove('active');
                        reqRef.off();
                    }
                });
            }
        } else {
            if (status) status.innerHTML = "<span style='color: #E03C31; font-weight: bold;'>NO AMBULANCE AVAILABLE NOW.</span><br><br>Please call 193 or 999 immediately.";
            setTimeout(() => overlay?.classList.remove('active'), 4000);
        }
    }, 3000);
}

function findNearestAmbulance() {
    // Only count ambulances marked as "Available"
    const availableAmbs = ambulances.filter(a => a.status === "Available");
    if (availableAmbs.length === 0) return null;
    
    let nearest = null;
    let minDistance = Infinity;

    availableAmbs.forEach(amb => {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, amb.lat, amb.lng);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = { ...amb, distance: dist };
        }
    });

    return nearest;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function showResult(ambulance) {
    const card = document.getElementById('result-card');
    document.getElementById('amb-id').innerText = ambulance.id;
    document.getElementById('amb-dist').innerText = `Distance: ${ambulance.distance.toFixed(2)} km`;
    document.getElementById('amb-eta').innerText = `${Math.ceil(ambulance.distance * 2 + 2)} mins`;
    card?.classList.add('active');
    map.flyTo([ambulance.lat, ambulance.lng], 15);
}
