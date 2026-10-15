const sql = require('mssql');
const bcrypt = require('bcryptjs');

async function setAdmin() {
    const pool = await sql.connect({
        user: 'sa',
        password: 'mscg2022*',
        server: '127.0.0.1',
        port: 1433,
        database: 'AniDimensionV2',
        options: { encrypt: false, trustServerCertificate: true }
    });

    // 1. Limpiar usuarios de prueba anteriores
    await pool.query("DELETE FROM dbo.Usuarios;");

    // 2. Hash de contraseña para Oscar1982
    const hash = await bcrypt.hash('Oscar1982', 10);

    // 3. Crear exclusivamente la cuenta Admin
    await pool.request()
        .input('u', sql.NVarChar(50), 'Admin')
        .input('e', sql.NVarChar(120), 'oscaracastillop@gmail.com')
        .input('p', sql.NVarChar(255), hash)
        .input('pais', sql.NVarChar(80), 'Colombia')
        .query(`
            INSERT INTO dbo.Usuarios (Usuario, Email, PasswordHash, Pais, IsConnected, Oro, Gemas, Nivel)
            VALUES (@u, @e, @p, @pais, 0, 999999, 99999, 99);
        `);

    const users = await pool.query('SELECT Id, Usuario, Email, Pais, IsConnected, Oro, Gemas, Nivel FROM dbo.Usuarios;');
    console.log('USUARIOS ACTIVOS EN AniDimensionV2:');
    console.log(JSON.stringify(users.recordset, null, 2));
    await pool.close();
}

setAdmin().catch(console.error);
