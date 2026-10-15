-- ==============================================================
-- Project Ani-Dimension: Inicialización de Base de Datos y SPs
-- ==============================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'Project AniDimension')
BEGIN
    CREATE DATABASE [Project AniDimension];
END
GO

USE [Project AniDimension];
GO

-- 1. Tabla de Catálogo de Países
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Paises')
BEGIN
    CREATE TABLE Paises (
        IdPais INT IDENTITY(1,1) PRIMARY KEY,
        CodigoISO VARCHAR(10) NOT NULL UNIQUE,
        Nombre VARCHAR(100) NOT NULL,
        IconoBandera NVARCHAR(50) NULL
    );
END
ELSE
BEGIN
    ALTER TABLE Paises ALTER COLUMN CodigoISO VARCHAR(10) NOT NULL;
    ALTER TABLE Paises ALTER COLUMN IconoBandera NVARCHAR(50) NULL;
END
GO

-- 2. Tabla de Usuarios
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuarios')
BEGIN
    CREATE TABLE Usuarios (
        IdUsuario INT IDENTITY(1,1) PRIMARY KEY,
        Usuario VARCHAR(50) NOT NULL UNIQUE,
        Email VARCHAR(100) NOT NULL UNIQUE,
        PasswordHash VARCHAR(256) NOT NULL,
        IdPais INT NOT NULL,
        FechaRegistro DATETIME DEFAULT GETDATE(),
        Activo BIT DEFAULT 1,
        EstaConectado BIT DEFAULT 0,
        TokenSesion VARCHAR(128) NULL,
        UltimaConexion DATETIME NULL,
        CONSTRAINT FK_Usuarios_Paises FOREIGN KEY (IdPais) REFERENCES Paises(IdPais)
    );
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Usuarios') AND name = 'EstaConectado')
        ALTER TABLE Usuarios ADD EstaConectado BIT DEFAULT 0;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Usuarios') AND name = 'TokenSesion')
        ALTER TABLE Usuarios ADD TokenSesion VARCHAR(128) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Usuarios') AND name = 'UltimaConexion')
        ALTER TABLE Usuarios ADD UltimaConexion DATETIME NULL;
END
GO

-- 3. Tabla de Roles
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles')
BEGIN
    CREATE TABLE Roles (
        IdRol INT IDENTITY(1,1) PRIMARY KEY,
        NombreRol VARCHAR(50) NOT NULL UNIQUE,
        Descripcion VARCHAR(255) NULL
    );
END
GO

-- 4. Tabla Relacional de Usuarios y Roles
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UsuariosRoles')
BEGIN
    CREATE TABLE UsuariosRoles (
        IdUsuario INT NOT NULL,
        IdRol INT NOT NULL,
        FechaAsignacion DATETIME DEFAULT GETDATE(),
        CONSTRAINT PK_UsuariosRoles PRIMARY KEY (IdUsuario, IdRol),
        CONSTRAINT FK_UsuariosRoles_Usuarios FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
        CONSTRAINT FK_UsuariosRoles_Roles FOREIGN KEY (IdRol) REFERENCES Roles(IdRol) ON DELETE CASCADE
    );
END
GO

-- 5. Tabla de Cartas Traducción (Para la siguiente fase)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CartasTraduccion')
BEGIN
    CREATE TABLE CartasTraduccion (
        Passcode INT PRIMARY KEY,
        Nombre_ES NVARCHAR(256) NOT NULL,
        Descripcion_ES NVARCHAR(MAX) NOT NULL,
        FechaActualizacion DATETIME DEFAULT GETDATE()
    );
END
GO

-- 4. Inserción de Catálogo Base de Países
IF NOT EXISTS (SELECT 1 FROM Paises)
BEGIN
    INSERT INTO Paises (CodigoISO, Nombre, IconoBandera) VALUES
    ('CO', 'Colombia', N'🇨🇴'),
    ('MX', 'México', N'🇲🇽'),
    ('AR', 'Argentina', N'🇦🇷'),
    ('CL', 'Chile', N'🇨🇱'),
    ('PE', 'Perú', N'🇵🇪'),
    ('ES', 'España', N'🇪🇸'),
    ('US', 'Estados Unidos', N'🇺🇸'),
    ('VE', 'Venezuela', N'🇻🇪'),
    ('EC', 'Ecuador', N'🇪🇨'),
    ('BO', 'Bolivia', N'🇧🇴'),
    ('UY', 'Uruguay', N'🇺🇾'),
    ('PY', 'Paraguay', N'🇵🇾'),
    ('CR', 'Costa Rica', N'🇨🇷'),
    ('PA', 'Panamá', N'🇵🇦'),
    ('GT', 'Guatemala', N'🇬🇹'),
    ('HN', 'Honduras', N'🇭🇳'),
    ('SV', 'El Salvador', N'🇸🇻'),
    ('NI', 'Nicaragua', N'🇳🇮'),
    ('DO', 'República Dominicana', N'🇩🇴'),
    ('BR', 'Brasil', N'🇧🇷'),
    ('CA', 'Canadá', N'🇨🇦'),
    ('JP', 'Japón', N'🇯🇵'),
    ('OTHER', 'Otro', N'🌐');
END
GO

-- 5. Inserción de Catálogo Base de Roles
IF NOT EXISTS (SELECT 1 FROM Roles)
BEGIN
    INSERT INTO Roles (NombreRol, Descripcion) VALUES
    ('Admin', 'Administrador general del juego y del servidor'),
    ('Moderador', 'Moderador de salas, torneos y chat'),
    ('Usuario', 'Jugador regular de Ani-Dimension');
END
GO

-- 6. Creación de Cuenta Administrador
DECLARE @IdPaisDefault INT;
SELECT TOP 1 @IdPaisDefault = IdPais FROM Paises WHERE CodigoISO = 'CO';
IF @IdPaisDefault IS NULL
    SELECT TOP 1 @IdPaisDefault = IdPais FROM Paises;

IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE Usuario = 'Admin')
BEGIN
    INSERT INTO Usuarios (Usuario, Email, PasswordHash, IdPais, FechaRegistro, Activo, EstaConectado)
    VALUES ('Admin', 'admin@anidimension.com', 'a44abf53877b806e09e57a0236aa5c30ee0fc6aeb0a140e9c32cd2e0eb4a5dbb', @IdPaisDefault, GETDATE(), 1, 0);

    DECLARE @AdminId INT = SCOPE_IDENTITY();
    DECLARE @AdminRoleId INT;
    SELECT @AdminRoleId = IdRol FROM Roles WHERE NombreRol = 'Admin';

    IF NOT EXISTS (SELECT 1 FROM UsuariosRoles WHERE IdUsuario = @AdminId AND IdRol = @AdminRoleId)
    BEGIN
        INSERT INTO UsuariosRoles (IdUsuario, IdRol) VALUES (@AdminId, @AdminRoleId);
    END
END
ELSE
BEGIN
    -- Asegurar que la cuenta Admin tenga el hash correcto de Oscar1982 y el rol Admin asignado
    UPDATE Usuarios 
    SET PasswordHash = 'a44abf53877b806e09e57a0236aa5c30ee0fc6aeb0a140e9c32cd2e0eb4a5dbb',
        Activo = 1
    WHERE Usuario = 'Admin';

    DECLARE @ExistingAdminId INT;
    SELECT @ExistingAdminId = IdUsuario FROM Usuarios WHERE Usuario = 'Admin';
    DECLARE @RolIdAdmin INT;
    SELECT @RolIdAdmin = IdRol FROM Roles WHERE NombreRol = 'Admin';

    IF NOT EXISTS (SELECT 1 FROM UsuariosRoles WHERE IdUsuario = @ExistingAdminId AND IdRol = @RolIdAdmin)
    BEGIN
        INSERT INTO UsuariosRoles (IdUsuario, IdRol) VALUES (@ExistingAdminId, @RolIdAdmin);
    END
END
GO

-- ==============================================================
-- Procedimientos Almacenados (Stored Procedures)
-- ==============================================================

-- SP: Obtener Catálogo de Roles
CREATE OR ALTER PROCEDURE sp_ObtenerRoles
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IdRol, NombreRol, Descripcion FROM Roles ORDER BY IdRol ASC;
END
GO

-- SP: Asignar Rol a un Usuario
CREATE OR ALTER PROCEDURE sp_AsignarRolUsuario
    @IdUsuario INT,
    @NombreRol VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IdRol INT;
    SELECT @IdRol = IdRol FROM Roles WHERE NombreRol = @NombreRol;

    IF @IdRol IS NULL
    BEGIN
        SELECT 0 AS Codigo, 'El rol especificado no existe' AS Mensaje;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM UsuariosRoles WHERE IdUsuario = @IdUsuario AND IdRol = @IdRol)
    BEGIN
        SELECT 1 AS Codigo, 'El usuario ya tiene asignado este rol' AS Mensaje;
        RETURN;
    END

    INSERT INTO UsuariosRoles (IdUsuario, IdRol) VALUES (@IdUsuario, @IdRol);
    SELECT 1 AS Codigo, 'Rol asignado con éxito' AS Mensaje;
END
GO

-- SP: Obtener Roles de un Usuario
CREATE OR ALTER PROCEDURE sp_ObtenerRolesUsuario
    @IdUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT R.IdRol, R.NombreRol, R.Descripcion
    FROM Roles R
    INNER JOIN UsuariosRoles UR ON R.IdRol = UR.IdRol
    WHERE UR.IdUsuario = @IdUsuario;
END
GO

-- SP 1: Obtener Catálogo de Países
CREATE OR ALTER PROCEDURE sp_ObtenerPaises
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IdPais, CodigoISO, Nombre, IconoBandera 
    FROM Paises 
    ORDER BY Nombre ASC;
END
GO

-- SP 2: Registrar Usuario
CREATE OR ALTER PROCEDURE sp_RegistrarUsuario
    @Usuario VARCHAR(50),
    @Email VARCHAR(100),
    @PasswordHash VARCHAR(256),
    @IdPais INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar que el usuario y el correo no sean idénticos
    IF LOWER(LTRIM(RTRIM(@Usuario))) = LOWER(LTRIM(RTRIM(@Email)))
    BEGIN
        SELECT 0 AS Codigo, 'El nombre de usuario y el correo no pueden ser iguales' AS Mensaje, 0 AS IdUsuario;
        RETURN;
    END

    -- Validar si el nombre de usuario ya existe
    IF EXISTS (SELECT 1 FROM Usuarios WHERE Usuario = @Usuario)
    BEGIN
        SELECT 0 AS Codigo, 'El nombre de usuario ya está registrado' AS Mensaje, 0 AS IdUsuario;
        RETURN;
    END

    -- Validar si el email ya existe
    IF EXISTS (SELECT 1 FROM Usuarios WHERE Email = @Email)
    BEGIN
        SELECT 0 AS Codigo, 'El correo electrónico ya está registrado' AS Mensaje, 0 AS IdUsuario;
        RETURN;
    END

    -- Validar si el país existe
    IF NOT EXISTS (SELECT 1 FROM Paises WHERE IdPais = @IdPais)
    BEGIN
        SELECT 0 AS Codigo, 'El país seleccionado no es válido' AS Mensaje, 0 AS IdUsuario;
        RETURN;
    END

    -- Inserción del nuevo usuario
    INSERT INTO Usuarios (Usuario, Email, PasswordHash, IdPais, FechaRegistro, Activo, EstaConectado)
    VALUES (@Usuario, @Email, @PasswordHash, @IdPais, GETDATE(), 1, 0);

    DECLARE @NuevoId INT = SCOPE_IDENTITY();

    -- Asignación automática del rol por defecto 'Usuario'
    DECLARE @RolUsuarioId INT;
    SELECT @RolUsuarioId = IdRol FROM Roles WHERE NombreRol = 'Usuario';
    IF @RolUsuarioId IS NOT NULL
    BEGIN
        INSERT INTO UsuariosRoles (IdUsuario, IdRol) VALUES (@NuevoId, @RolUsuarioId);
    END

    SELECT 1 AS Codigo, 'Usuario registrado con éxito' AS Mensaje, @NuevoId AS IdUsuario;
END
GO

-- SP 3: Validar Login de Usuario con Control de Sesión y Roles
CREATE OR ALTER PROCEDURE sp_ValidarLogin
    @Usuario VARCHAR(50),
    @PasswordHash VARCHAR(256),
    @TokenSesion VARCHAR(128) = NULL,
    @ForzarSesion BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    -- Limpiar sesiones inactivas de más de 10 minutos automáticamente
    UPDATE Usuarios 
    SET EstaConectado = 0, TokenSesion = NULL 
    WHERE EstaConectado = 1 
      AND DATEDIFF(MINUTE, ISNULL(UltimaConexion, '2000-01-01'), GETDATE()) > 10;

    DECLARE @IdUsuario INT;
    DECLARE @NombreUsuario VARCHAR(50);
    DECLARE @Email VARCHAR(100);
    DECLARE @IdPais INT;
    DECLARE @NombrePais VARCHAR(100);
    DECLARE @CodigoISO VARCHAR(10);
    DECLARE @IconoBandera NVARCHAR(50);
    DECLARE @Activo BIT;
    DECLARE @EstaConectado BIT;
    DECLARE @TokenActual VARCHAR(128);

    SELECT 
        @IdUsuario = U.IdUsuario,
        @NombreUsuario = U.Usuario,
        @Email = U.Email,
        @IdPais = U.IdPais,
        @NombrePais = P.Nombre,
        @CodigoISO = P.CodigoISO,
        @IconoBandera = P.IconoBandera,
        @Activo = U.Activo,
        @EstaConectado = ISNULL(U.EstaConectado, 0),
        @TokenActual = U.TokenSesion
    FROM Usuarios U
    INNER JOIN Paises P ON U.IdPais = P.IdPais
    WHERE (U.Usuario = @Usuario OR U.Email = @Usuario)
      AND U.PasswordHash = @PasswordHash;

    IF @IdUsuario IS NULL
    BEGIN
        SELECT 0 AS Codigo, 'Usuario o contraseña incorrectos' AS Mensaje, NULL AS IdUsuario, NULL AS Usuario, NULL AS Email, NULL AS CodigoISO, NULL AS NombrePais, NULL AS TokenSesion, NULL AS Roles;
        RETURN;
    END

    IF @Activo = 0
    BEGIN
        SELECT 0 AS Codigo, 'La cuenta de usuario se encuentra desactivada' AS Mensaje, NULL AS IdUsuario, NULL AS Usuario, NULL AS Email, NULL AS CodigoISO, NULL AS NombrePais, NULL AS TokenSesion, NULL AS Roles;
        RETURN;
    END

    -- Validar si ya está conectado en otro dispositivo
    IF @EstaConectado = 1 AND @ForzarSesion = 0
    BEGIN
        SELECT 2 AS Codigo, 'Esta cuenta ya tiene una sesión activa en otro dispositivo' AS Mensaje, @IdUsuario AS IdUsuario, @NombreUsuario AS Usuario, NULL AS Email, NULL AS CodigoISO, NULL AS NombrePais, NULL AS TokenSesion, NULL AS Roles;
        RETURN;
    END

    -- Obtener roles asociados al usuario
    DECLARE @RolesUsuario VARCHAR(255);
    SELECT @RolesUsuario = STRING_AGG(R.NombreRol, ',')
    FROM UsuariosRoles UR
    INNER JOIN Roles R ON UR.IdRol = R.IdRol
    WHERE UR.IdUsuario = @IdUsuario;

    IF @RolesUsuario IS NULL SET @RolesUsuario = 'Usuario';

    -- Generar token si no se pasó uno
    IF @TokenSesion IS NULL OR @TokenSesion = ''
    BEGIN
        SET @TokenSesion = REPLACE(NEWID(), '-', '') + REPLACE(NEWID(), '-', '');
    END

    -- Iniciar sesión y marcar conectado
    UPDATE Usuarios
    SET EstaConectado = 1,
        TokenSesion = @TokenSesion,
        UltimaConexion = GETDATE()
    WHERE IdUsuario = @IdUsuario;

    SELECT 
        1 AS Codigo, 
        'Inicio de sesión exitoso' AS Mensaje, 
        @IdUsuario AS IdUsuario, 
        @NombreUsuario AS Usuario, 
        @Email AS Email, 
        @CodigoISO AS CodigoISO, 
        @NombrePais AS NombrePais,
        @IconoBandera AS IconoBandera,
        @TokenSesion AS TokenSesion,
        @RolesUsuario AS Roles;
END
GO

-- SP 4: Cerrar Sesión
CREATE OR ALTER PROCEDURE sp_CerrarSesion
    @IdUsuario INT,
    @TokenSesion VARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Usuarios
    SET EstaConectado = 0,
        TokenSesion = NULL
    WHERE IdUsuario = @IdUsuario
      AND (@TokenSesion IS NULL OR TokenSesion = @TokenSesion);

    SELECT 1 AS Codigo, 'Sesión cerrada correctamente' AS Mensaje;
END
GO

-- SP 5: Heartbeat / Mantener Sesión Activa
CREATE OR ALTER PROCEDURE sp_HeartbeatSesion
    @IdUsuario INT,
    @TokenSesion VARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Usuarios
    SET UltimaConexion = GETDATE()
    WHERE IdUsuario = @IdUsuario
      AND TokenSesion = @TokenSesion
      AND EstaConectado = 1;

    -- Limpiar sesiones inactivas generales
    UPDATE Usuarios 
    SET EstaConectado = 0, TokenSesion = NULL 
    WHERE EstaConectado = 1 
      AND DATEDIFF(MINUTE, ISNULL(UltimaConexion, '2000-01-01'), GETDATE()) > 10;

    SELECT @@ROWCOUNT AS SesionValida;
END
GO

-- SP 6: Contador de Usuarios Online y Total de Cuentas
CREATE OR ALTER PROCEDURE sp_ObtenerContadorOnline
AS
BEGIN
    SET NOCOUNT ON;

    -- Limpiar sesiones huérfanas
    UPDATE Usuarios 
    SET EstaConectado = 0, TokenSesion = NULL 
    WHERE EstaConectado = 1 
      AND DATEDIFF(MINUTE, ISNULL(UltimaConexion, '2000-01-01'), GETDATE()) > 10;

    SELECT 
        (SELECT COUNT(1) FROM Usuarios WHERE EstaConectado = 1) AS TotalOnline,
        (SELECT COUNT(1) FROM Usuarios) AS TotalCuentas;
END
GO
