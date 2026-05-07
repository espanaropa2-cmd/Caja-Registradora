-- SCRIPT DE CONFIGURACIÓN ACTUALIZADO PARA SUPABASE
-- Copia y pega este código en el SQL Editor de tu proyecto de Supabase y presiona "Run"

-- 1. Añadir columna 'archived' a la tabla de perfiles (si no existe)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- 2. Limpiar tabla previa si existía con nombres de columna incorrectos
DROP TABLE IF EXISTS subscription_requests;

-- 3. Crear la tabla de solicitudes de suscripción con nombres estándar (snake_case)
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

-- 4. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;

-- 5. Crear Políticas de Acceso (Sin depender de nombres previos)

CREATE POLICY "Usuarios pueden reportar pagos" ON subscription_requests 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden ver sus reportes" ON subscription_requests 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins pueden gestionar reportes" ON subscription_requests 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 6. Otorgar permisos
GRANT ALL ON subscription_requests TO authenticated;
GRANT ALL ON subscription_requests TO service_role;
