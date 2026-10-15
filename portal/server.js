const express = require('express');
const path = require('path');
const net = require('net');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 7900;

// Configuración de SQL Server
const dbConfig = {
    user: 'sa',
    password: 'mscg2022*',
    server: '127.0.0.1',
    port: 1433,
    database: 'AniDimensionV2',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 10000
    },
    pool: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000
    }
};

let poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(p => {
        console.log('[PORTAL V2] Conectado a SQL Server (AniDimensionV2)');
        return p;
    })
    .catch(err => {
        console.error('[PORTAL V2 DB ERROR]', err.message);
    });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Estado del Servidor V2 (Solo responde CONECTADO / DESCONECTADO - CERO IPs expuestas)
app.get('/api/server-status', (req, res) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(1500);

    socket.on('connect', () => {
        isConnected = true;
        socket.destroy();
        return res.json({ status: 'CONECTADO', online: true });
    });

    socket.on('timeout', () => {
        socket.destroy();
        if (!res.headersSent) {
            return res.json({ status: 'DESCONECTADO', online: false });
        }
    });

    socket.on('error', () => {
        socket.destroy();
        if (!res.headersSent) {
            return res.json({ status: 'DESCONECTADO', online: false });
        }
    });

    socket.connect(7911, '127.0.0.1');
});

// 2. Catálogo de Países
app.get('/api/paises', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT Codigo, Nombre FROM dbo.Paises ORDER BY Nombre ASC');
        return res.json({ success: true, paises: result.recordset });
    } catch (err) {
        console.error('[ERROR PAISES]', err.message);
        return res.status(500).json({ success: false, message: 'Error al consultar catálogo de países.' });
    }
});

// 3. Registro de Nuevo Usuario
app.post('/api/register', async (req, res) => {
    try {
        const { usuario, email, password, pais } = req.body;

        if (!usuario || !email || !password || !pais) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
        }

        const usernameTrim = usuario.trim();
        const emailTrim = email.trim().toLowerCase();

        if (usernameTrim.length < 3 || usernameTrim.length > 20) {
            return res.status(400).json({ success: false, message: 'El usuario debe tener entre 3 y 20 caracteres.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener mínimo 6 caracteres.' });
        }

        const pool = await poolPromise;

        // Validar si ya existe
        const check = await pool.request()
            .input('u', sql.NVarChar(50), usernameTrim)
            .input('e', sql.NVarChar(120), emailTrim)
            .query('SELECT Usuario, Email FROM dbo.Usuarios WHERE Usuario = @u OR Email = @e');

        if (check.recordset.length > 0) {
            const existing = check.recordset[0];
            if (existing.Usuario.toLowerCase() === usernameTrim.toLowerCase()) {
                return res.status(409).json({ success: false, message: 'El nombre de usuario ya está registrado.' });
            }
            return res.status(409).json({ success: false, message: 'El correo electrónico ya está registrado.' });
        }

        // Hash de contraseña seguro
        const passwordHash = await bcrypt.hash(password, 10);

        await pool.request()
            .input('u', sql.NVarChar(50), usernameTrim)
            .input('e', sql.NVarChar(120), emailTrim)
            .input('p', sql.NVarChar(255), passwordHash)
            .input('pais', sql.NVarChar(80), pais.trim())
            .query(`
                INSERT INTO dbo.Usuarios (Usuario, Email, PasswordHash, Pais, IsConnected, Oro, Gemas, Nivel)
                VALUES (@u, @e, @p, @pais, 0, 1000, 100, 1)
            `);

        console.log(`[AUTH V2] Nuevo duelista registrado: ${usernameTrim} (${pais})`);
        return res.json({ success: true, message: '¡Registro exitoso! Ya puedes iniciar sesión.' });
    } catch (err) {
        console.error('[ERROR REGISTER]', err.message);
        return res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
    }
});

// 4. Inicio de Sesión (Con bloqueo de conexión única IsConnected)
app.post('/api/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({ success: false, message: 'Por favor ingresa usuario y contraseña.' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('u', sql.NVarChar(50), usuario.trim())
            .query('SELECT Id, Usuario, Email, PasswordHash, Pais, IsConnected, Oro, Gemas, Nivel FROM dbo.Usuarios WHERE Usuario = @u');

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }

        const user = result.recordset[0];

        // Validar contraseña
        const match = await bcrypt.compare(password, user.PasswordHash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }

        // REGLA: Bloqueo de múltiples dispositivos (Solo 1 conexión permitida)
        if (user.IsConnected === true || user.IsConnected === 1) {
            return res.status(403).json({
                success: false,
                code: 'ALREADY_CONNECTED',
                message: 'Este usuario ya tiene una sesión abierta en otro dispositivo. Cierra la sesión activa para entrar.'
            });
        }

        // Generar token criptográfico de sesión
        const sessionToken = crypto.randomBytes(32).toString('hex');

        // Marcar IsConnected = 1 en base de datos
        await pool.request()
            .input('id', sql.Int, user.Id)
            .input('token', sql.NVarChar(255), sessionToken)
            .query(`
                UPDATE dbo.Usuarios 
                SET IsConnected = 1, SessionToken = @token, LastLogin = GETDATE()
                WHERE Id = @id
            `);

        console.log(`[AUTH V2] Sesión iniciada: ${user.Usuario} (Conexión activa: 1)`);

        return res.json({
            success: true,
            token: sessionToken,
            user: {
                id: user.Id,
                usuario: user.Usuario,
                email: user.Email,
                pais: user.Pais,
                oro: user.Oro,
                gemas: user.Gemas,
                nivel: user.Nivel
            }
        });
    } catch (err) {
        console.error('[ERROR LOGIN]', err.message);
        return res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
    }
});

// 5. Cierre de Sesión (Libera IsConnected = 0)
app.post('/api/logout', async (req, res) => {
    try {
        const token = req.headers['authorization']?.replace('Bearer ', '') || req.body.token;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token no proporcionado.' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('token', sql.NVarChar(255), token)
            .query(`
                UPDATE dbo.Usuarios 
                SET IsConnected = 0, SessionToken = NULL 
                OUTPUT inserted.Usuario
                WHERE SessionToken = @token
            `);

        if (result.recordset.length > 0) {
            console.log(`[AUTH V2] Sesión cerrada para: ${result.recordset[0].Usuario} (Conexión activa: 0)`);
        }

        return res.json({ success: true, message: 'Sesión finalizada exitosamente.' });
    } catch (err) {
        console.error('[ERROR LOGOUT]', err.message);
        return res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
    }
});

// 6. Lanzar Cliente Gráfico EDOPro / Project Ignis
app.post('/api/launch-game', async (req, res) => {
    try {
        const gamePath = path.resolve(__dirname, '../client-pc/edopro/ProjectIgnis/EDOPro.exe');
        const gameCwd = path.resolve(__dirname, '../client-pc/edopro/ProjectIgnis');

        // Lanzar proceso desacoplado
        const child = spawn(gamePath, [], {
            cwd: gameCwd,
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        return res.json({ success: true, message: 'Ejecutando cliente gráfico de Project Ignis...' });
    } catch (err) {
        console.error('[LAUNCH ERROR]', err.message);
        return res.status(500).json({ success: false, message: 'No se pudo iniciar el juego.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 [PORTAL V2] Servidor Web de Login y Gestión activo en: http://localhost:${PORT}`);
});
