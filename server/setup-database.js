const sql = require("mssql");

const dbConfig = {
    user: "sa",
    password: "mscg2022*",
    server: "127.0.0.1",
    port: 1433,
    database: "master",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function setup() {
    console.log("[DB SETUP] Conectando a SQL Server...");
    let pool = await sql.connect(dbConfig);

    // 1. Crear Base de Datos si no existe
    await pool.query(`
        IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'AniDimensionV2')
        BEGIN
            CREATE DATABASE AniDimensionV2;
            PRINT 'Base de datos AniDimensionV2 creada.';
        END
    `);
    await pool.close();

    // 2. Conectar a AniDimensionV2
    dbConfig.database = "AniDimensionV2";
    pool = await sql.connect(dbConfig);
    console.log("[DB SETUP] Conectado a AniDimensionV2.");

    // 3. Crear Tablas de Usuarios, Sesiones y Catálogo de Países
    await pool.query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuarios')
        BEGIN
            CREATE TABLE Usuarios (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                Usuario NVARCHAR(50) NOT NULL UNIQUE,
                Email NVARCHAR(120) NOT NULL UNIQUE,
                PasswordHash NVARCHAR(255) NOT NULL,
                Pais NVARCHAR(80) NOT NULL,
                IsConnected BIT NOT NULL DEFAULT 0,
                SessionToken NVARCHAR(255) NULL,
                LastLogin DATETIME NULL,
                FechaRegistro DATETIME NOT NULL DEFAULT GETDATE(),
                Oro INT NOT NULL DEFAULT 1000,
                Gemas INT NOT NULL DEFAULT 100,
                Nivel INT NOT NULL DEFAULT 1
            );
            PRINT 'Tabla Usuarios creada.';
        END;

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Paises')
        BEGIN
            CREATE TABLE Paises (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                Codigo NVARCHAR(5) NOT NULL,
                Nombre NVARCHAR(80) NOT NULL
            );

            INSERT INTO Paises (Codigo, Nombre) VALUES
            ('CO', 'Colombia'),
            ('MX', 'México'),
            ('AR', 'Argentina'),
            ('CL', 'Chile'),
            ('PE', 'Perú'),
            ('ES', 'España'),
            ('VE', 'Venezuela'),
            ('EC', 'Ecuador'),
            ('US', 'Estados Unidos'),
            ('BR', 'Brasil'),
            ('UY', 'Uruguay'),
            ('BO', 'Bolivia'),
            ('PY', 'Paraguay'),
            ('PA', 'Panamá'),
            ('CR', 'Costa Rica'),
            ('GT', 'Guatemala'),
            ('DO', 'República Dominicana'),
            ('HN', 'Honduras'),
            ('SV', 'El Salvador'),
            ('NI', 'Nicaragua');
            PRINT 'Tabla Paises creada y catálogo poblado.';
        END;
    `);

    console.log("[DB SETUP] Base de datos y tablas creadas exitosamente!");
    await pool.close();
}

setup().catch(err => {
    console.error("[DB SETUP ERROR]", err);
    process.exit(1);
});
