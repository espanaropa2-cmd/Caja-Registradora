-- SCRIPT DE CONFIGURACIÓN COMPLETO PARA SUPABASE
-- Copia y pega este código en el SQL Editor de tu proyecto de Supabase y presiona "Run"

-- 1. Asegurar todas las columnas necesarias en la tabla de perfiles
-- Ejecuta esto una por una si prefieres, o todo el bloque
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alias TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_payment_ref TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sheets_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS use_parallel_rate BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_triple_price BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_dark_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_pin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_question TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_answer TEXT;

-- 2. Asignar rol de administrador al superusuario
UPDATE profiles SET role = 'admin' WHERE email = 'azliersylver@gmail.com';
UPDATE profiles SET role = 'admin' WHERE email = 'freddreds96@gmail.com'; -- También para el usuario actual si aplica

-- 3. Crear la tabla de configuración global (Datos de Pago)
CREATE TABLE IF NOT EXISTS app_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  bank_name TEXT,
  account_number TEXT,
  phone TEXT,
  id_number TEXT,
  binance_user TEXT
);

-- Insertar fila inicial si no existe
INSERT INTO app_config (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- 4. Crear la tabla de solicitudes de suscripción
DROP TABLE IF EXISTS subscription_requests;
CREATE TABLE subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  months INTEGER NOT NULL,
  amount_usd NUMERIC(10, 2) NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  date TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT status_check CHECK (status IN ('PENDING', 'CONFIRMED', 'DECLINED'))
);

-- 5. Habilitar RLS en las tablas
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;

-- 6. Políticas para APP_CONFIG (Datos de Pago)

-- Todos los usuarios autenticados pueden VER la configuración
DROP POLICY IF EXISTS "Todos pueden ver config" ON app_config;
CREATE POLICY "Todos pueden ver config" ON app_config 
FOR SELECT USING (auth.role() = 'authenticated');

-- Solo los administradores pueden ACTUALIZAR la configuración
DROP POLICY IF EXISTS "Admins gestionan config" ON app_config;
CREATE POLICY "Admins gestionan config" ON app_config 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 7. Políticas para SUBSCRIPTION_REQUESTS (Reportes de Pago)

DROP POLICY IF EXISTS "Usuarios pueden reportar pagos" ON subscription_requests;
CREATE POLICY "Usuarios pueden reportar pagos" ON subscription_requests 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios pueden ver sus reportes" ON subscription_requests;
CREATE POLICY "Usuarios pueden ver sus reportes" ON subscription_requests 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins pueden gestionar reportes" ON subscription_requests;
CREATE POLICY "Admins pueden gestionar reportes" ON subscription_requests 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 8. Otorgar permisos
GRANT ALL ON app_config TO authenticated;
GRANT ALL ON subscription_requests TO authenticated;
GRANT ALL ON app_config TO service_role;
GRANT ALL ON subscription_requests TO service_role;
