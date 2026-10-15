const http = require('http');
const crypto = require('crypto');
const sql = require('mssql');

// Configuración de conexión a SQL Server
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'mscg2022*',
    server: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Project AniDimension',
    options: {
        encrypt: false, // Desactivado para conexiones locales
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(dbConfig)
            .connect()
            .then(pool => {
                console.log('[Ani-Dimension DB] Conectado exitosamente a SQL Server (Project AniDimension).');
                return pool;
            })
            .catch(err => {
                console.error('[Ani-Dimension DB] Error conectando a SQL Server:', err.message);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password || '').digest('hex');
}

function sendJson(res, statusCode, data) {
    const json = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(json);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 1e6) {
                req.destroy();
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    // Manejo de CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    try {
        // 1. Estado del Servidor
        if (req.method === 'GET' && pathname === '/api/status') {
            try {
                const pool = await getPool();
                const result = await pool.request().execute('sp_ObtenerContadorOnline');
                const row = result.recordset && result.recordset[0] ? result.recordset[0] : {};
                const totalOnline = row.TotalOnline !== undefined ? row.TotalOnline : 0;
                let totalAccounts = row.TotalCuentas !== undefined ? row.TotalCuentas : 0;
                if (!totalAccounts) {
                    const accRes = await pool.request().query('SELECT COUNT(1) AS c FROM Usuarios');
                    totalAccounts = accRes.recordset && accRes.recordset[0] ? accRes.recordset[0].c : 0;
                }
                return sendJson(res, 200, {
                    online: true,
                    server: 'Ani-Dimension Master Server',
                    totalOnline,
                    totalAccounts,
                    timestamp: Date.now()
                });
            } catch (err) {
                return sendJson(res, 200, {
                    online: true,
                    dbConnected: false,
                    server: 'Ani-Dimension Master Server (Offline DB)',
                    totalOnline: 0,
                    totalAccounts: 0,
                    timestamp: Date.now()
                });
            }
        }

        // 2. Catálogo de Países
        if (req.method === 'GET' && pathname === '/api/countries') {
            const pool = await getPool();
            const result = await pool.request().execute('sp_ObtenerPaises');
            return sendJson(res, 200, {
                success: true,
                countries: result.recordset || []
            });
        }

        // 3. Registro de Usuario
        if (req.method === 'POST' && pathname === '/api/register') {
            const body = await parseBody(req);
            const { username, email, password, countryId } = body;

            if (!username || !email || !password || !countryId) {
                return sendJson(res, 400, {
                    success: false,
                    code: 0,
                    message: 'Todos los campos son obligatorios (Usuario, Email, Contraseña, País).'
                });
            }

            const pwdHash = hashPassword(password);
            const pool = await getPool();
            const result = await pool.request()
                .input('Usuario', sql.VarChar(50), username.trim())
                .input('Email', sql.VarChar(100), email.trim().toLowerCase())
                .input('PasswordHash', sql.VarChar(256), pwdHash)
                .input('IdPais', sql.Int, parseInt(countryId, 10))
                .execute('sp_RegistrarUsuario');

            const row = result.recordset && result.recordset[0] ? result.recordset[0] : { Codigo: 0, Mensaje: 'Error desconocido' };
            return sendJson(res, 200, {
                success: row.Codigo === 1,
                code: row.Codigo,
                message: row.Mensaje,
                userId: row.IdUsuario
            });
        }

        // 4. Login de Usuario (con control de concurrencia y sesión)
        if (req.method === 'POST' && pathname === '/api/login') {
            const body = await parseBody(req);
            const { username, password, forceSession } = body;

            if (!username || !password) {
                return sendJson(res, 400, {
                    success: false,
                    code: 0,
                    message: 'Debes ingresar usuario/correo y contraseña.'
                });
            }

            const pwdHash = hashPassword(password);
            const pool = await getPool();
            const result = await pool.request()
                .input('Usuario', sql.VarChar(50), username.trim())
                .input('PasswordHash', sql.VarChar(256), pwdHash)
                .input('TokenSesion', sql.VarChar(128), null)
                .input('ForzarSesion', sql.Bit, forceSession ? 1 : 0)
                .execute('sp_ValidarLogin');

            const row = result.recordset && result.recordset[0] ? result.recordset[0] : { Codigo: 0, Mensaje: 'Error en autenticación' };
            
            if (row.Codigo === 1) {
                return sendJson(res, 200, {
                    success: true,
                    code: 1,
                    message: row.Mensaje,
                    user: {
                        id: row.IdUsuario,
                        username: row.Usuario,
                        email: row.Email,
                        countryCode: row.CodigoISO,
                        countryName: row.NombrePais,
                        flag: row.IconoBandera,
                        sessionToken: row.TokenSesion,
                        roles: (row.Roles || 'Usuario').split(',').map(r => r.trim()),
                        isAdmin: (row.Roles || '').includes('Admin')
                    }
                });
            } else if (row.Codigo === 2) {
                // Sesión activa en otro dispositivo
                return sendJson(res, 200, {
                    success: false,
                    code: 2,
                    message: row.Mensaje,
                    userId: row.IdUsuario,
                    username: row.Usuario
                });
            } else {
                return sendJson(res, 200, {
                    success: false,
                    code: row.Codigo,
                    message: row.Mensaje
                });
            }
        }

        // 5. Cierre de Sesión (Logout)
        if (req.method === 'POST' && pathname === '/api/logout') {
            const body = await parseBody(req);
            const { userId, sessionToken } = body;

            if (userId) {
                const pool = await getPool();
                await pool.request()
                    .input('IdUsuario', sql.Int, parseInt(userId, 10))
                    .input('TokenSesion', sql.VarChar(128), sessionToken || null)
                    .execute('sp_CerrarSesion');
            }

            return sendJson(res, 200, { success: true, message: 'Sesión cerrada' });
        }

        // 6. Heartbeat para mantener sesión viva
        if (req.method === 'POST' && pathname === '/api/heartbeat') {
            const body = await parseBody(req);
            const { userId, sessionToken } = body;

            if (!userId || !sessionToken) {
                return sendJson(res, 400, { success: false, message: 'Faltan parámetros' });
            }

            const pool = await getPool();
            const result = await pool.request()
                .input('IdUsuario', sql.Int, parseInt(userId, 10))
                .input('TokenSesion', sql.VarChar(128), sessionToken)
                .execute('sp_HeartbeatSesion');

            const valid = result.recordset && result.recordset[0] && result.recordset[0].SesionValida > 0;
            return sendJson(res, 200, { success: true, validSession: valid });
        }

        // Ruta no encontrada
        return sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
        console.error('[Ani-Dimension API Error]:', err);
        return sendJson(res, 500, { success: false, error: err.message });
    }
});

const PORT = process.env.AUTH_PORT || 7920;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ani-Dimension Server] API de Autenticación y Usuarios escuchando en puerto ${PORT}`);
});

module.exports = server;
