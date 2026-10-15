// Ani Dimension V2 - Portal Logic
let currentUser = null;
let currentToken = localStorage.getItem('ani_v2_token') || null;

document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    setInterval(checkServerStatus, 5000);
    loadPaises();
    checkExistingSession();
});

// 1. Monitoreo de Estado del Servidor V2 (Sin mostrar IPs)
async function checkServerStatus() {
    const pill = document.getElementById('serverStatusBadge');
    const label = document.getElementById('statusLabel');

    try {
        const res = await fetch('/api/server-status');
        const data = await res.json();

        if (data.online) {
            pill.className = 'server-status-pill status-online';
            label.textContent = 'SERVIDOR: CONECTADO';
        } else {
            pill.className = 'server-status-pill status-offline';
            label.textContent = 'SERVIDOR: DESCONECTADO';
        }
    } catch (err) {
        pill.className = 'server-status-pill status-offline';
        label.textContent = 'SERVIDOR: DESCONECTADO';
    }
}

// 2. Cargar Catálogo de Países desde SQL Server
async function loadPaises() {
    const select = document.getElementById('regPais');
    try {
        const res = await fetch('/api/paises');
        const data = await res.json();
        if (data.success && Array.isArray(data.paises)) {
            data.paises.forEach(pais => {
                const opt = document.createElement('option');
                opt.value = pais.Nombre;
                opt.textContent = pais.Nombre;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Error al cargar países:', e);
    }
}

// 3. Alternar entre Login y Registro
function switchTab(tab) {
    const loginBtn = document.getElementById('tabLoginBtn');
    const regBtn = document.getElementById('tabRegisterBtn');
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registerForm');
    hideAlert();

    if (tab === 'login') {
        loginBtn.classList.add('active');
        regBtn.classList.remove('active');
        loginForm.classList.remove('hidden');
        regForm.classList.add('hidden');
    } else {
        regBtn.classList.add('active');
        loginBtn.classList.remove('active');
        regForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

// 4. Iniciar Sesión (Validación de conexión única IsConnected)
async function handleLogin(e) {
    e.preventDefault();
    hideAlert();

    const usuario = document.getElementById('loginUsuario').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginSubmitBtn');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'VERIFICANDO CREDENCIALES...';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        });
        const data = await res.json();

        if (data.success) {
            currentToken = data.token;
            currentUser = data.user;
            localStorage.setItem('ani_v2_token', data.token);
            localStorage.setItem('ani_v2_user', JSON.stringify(data.user));
            showDashboard(data.user);
        } else {
            showAlert(data.message || 'Error al iniciar sesión.', 'error');
        }
    } catch (err) {
        showAlert('Error de conexión con el servicio de autenticación.', 'error');
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'ENTRAR AL DUELO';
    }
}

// 5. Registro de Nuevo Usuario
async function handleRegister(e) {
    e.preventDefault();
    hideAlert();

    const usuario = document.getElementById('regUsuario').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const pais = document.getElementById('regPais').value;
    const btn = document.getElementById('registerSubmitBtn');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'REGISTRANDO CUENTA...';

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, email, password, pais })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('registerForm').reset();
            switchTab('login');
            showAlert(data.message + ' Ingresa tus datos para continuar.', 'success');
            document.getElementById('loginUsuario').value = usuario;
        } else {
            showAlert(data.message || 'Error al registrar usuario.', 'error');
        }
    } catch (err) {
        showAlert('No se pudo conectar con el servidor para registrar la cuenta.', 'error');
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'REGISTRAR CUENTA';
    }
}

// 6. Cerrar Sesión (Libera IsConnected = 0)
async function handleLogout() {
    if (currentToken) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + currentToken
                }
            });
        } catch (e) {
            console.warn('Logout server notify error:', e);
        }
    }

    currentToken = null;
    currentUser = null;
    localStorage.removeItem('ani_v2_token');
    localStorage.removeItem('ani_v2_user');

    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('loginForm').reset();
    showAlert('Sesión cerrada correctamente. Conexión liberada.', 'success');
}

// 7. Mostrar Vista de Dashboard (Post-Login)
function showDashboard(user) {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');

    document.getElementById('userNameLabel').textContent = user.usuario.toUpperCase();
    document.getElementById('userInitial').textContent = user.usuario.charAt(0).toUpperCase();
    document.getElementById('userLevel').textContent = 'LVL ' + (user.nivel || 1);
    document.getElementById('userGold').textContent = (user.oro || 1000).toLocaleString();
    document.getElementById('userGems').textContent = (user.gemas || 100).toLocaleString();
    document.getElementById('userCountry').textContent = '🏳️ ' + (user.pais || 'N/A');
}

// 8. Lanzar Juego (Project Ignis / EDOPro)
async function launchGame() {
    try {
        const res = await fetch('/api/launch-game', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + currentToken
            }
        });
        const data = await res.json();
        if (data.success) {
            showAlert('¡Iniciando Project Ignis en tu pantalla!', 'success');
        } else {
            showAlert(data.message || 'Error al lanzar el cliente.', 'error');
        }
    } catch (e) {
        showAlert('No se pudo contactar con el lanzador del juego.', 'error');
    }
}

// 9. Verificar Sesión Guardada
function checkExistingSession() {
    const savedUser = localStorage.getItem('ani_v2_user');
    if (savedUser && currentToken) {
        try {
            currentUser = JSON.parse(savedUser);
            showDashboard(currentUser);
        } catch (e) {
            localStorage.clear();
        }
    }
}

// Utilitarios de Alerta
function showAlert(msg, type = 'error') {
    const banner = document.getElementById('alertBanner');
    banner.className = 'alert-banner ' + type;
    banner.textContent = msg;
    banner.classList.remove('hidden');
}

function hideAlert() {
    const banner = document.getElementById('alertBanner');
    banner.classList.add('hidden');
    banner.textContent = '';
}
