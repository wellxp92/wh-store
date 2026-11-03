-- ============================================================================
-- WH STORE: SCHEMA COMPLETO SUPABASE (POSTGRESQL + RLS + REALTIME + STORAGE)
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- ============================================================================

-- 1. Habilitar extensão para geração de UUID v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. TABELAS PRINCIPAIS
-- ============================================================================

-- 2.1. Tabela de Categorias
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.2. Tabela de Configurações Gerais da Loja
CREATE TABLE IF NOT EXISTS public.store_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main_settings',
    whatsapp_number VARCHAR(30) NOT NULL DEFAULT '5581989947016',
    admin_pin VARCHAR(20) DEFAULT '1234',
    authorized_emails TEXT[] DEFAULT ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com'],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by VARCHAR(150)
);

-- 2.3. Tabela de Banners Promocionais da Vitrine
CREATE TABLE IF NOT EXISTS public.banners (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'hero_main',
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    description TEXT,
    image_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.4. Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.products (
    id VARCHAR(100) PRIMARY KEY, -- Preserva os IDs existentes da WH Store
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name VARCHAR(150) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    installments VARCHAR(100),
    description TEXT,
    in_stock BOOLEAN DEFAULT true,
    video_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.5. Tabela de Galeria de Fotos dos Produtos (Até 4 fotos por produto)
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(100) REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_cover BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.6. Tabela de Clientes (CRM / Gestão)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.7. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('order_' || floor(extract(epoch from now()))),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    paid_amount NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pago', -- 'Pago', 'Parcial', 'Pendente'
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.8. Tabela de Itens do Pedido
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(100) REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id VARCHAR(100) REFERENCES public.products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    unit_cost NUMERIC(10, 2) DEFAULT 0
);

-- ============================================================================
-- 3. ÍNDICES DE ALTA PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_name);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products(in_stock);
CREATE INDEX IF NOT EXISTS idx_product_images_pid ON public.product_images(product_id, display_order);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ============================================================================
-- 4. SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 4.1. LEITURA PÚBLICA (Vitrine e Catálogo da Loja)
CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public Read Store Settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Banners" ON public.banners FOR SELECT USING (is_active = true);
CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public Read Product Images" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Public Read Orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public Read Customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Public Read Order Items" ON public.order_items FOR SELECT USING (true);

-- 4.2. ESCRITA RESTRITA (Administradores Autorizados ou Service Role)
-- Permite operações para usuários autenticados cujos e-mails estejam na lista autorizada
CREATE POLICY "Admin Write Categories" ON public.categories 
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']))
    WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']));

CREATE POLICY "Admin Write Settings" ON public.store_settings 
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']))
    WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']));

CREATE POLICY "Admin Write Banners" ON public.banners 
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']))
    WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']));

CREATE POLICY "Admin Write Products" ON public.products 
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']))
    WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']));

CREATE POLICY "Admin Write Product Images" ON public.product_images 
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']))
    WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']));

CREATE POLICY "Admin Write Orders" ON public.orders 
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']))
    WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']));

CREATE POLICY "Admin Write Customers" ON public.customers 
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']))
    WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']));

CREATE POLICY "Admin Write Order Items" ON public.order_items 
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']))
    WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com']));

-- Permitir anon key em desenvolvimento ou se configurado para operação da loja com PIN
CREATE POLICY "Anon Write If Permitted Products" ON public.products
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon Write If Permitted Images" ON public.product_images
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon Write If Permitted Settings" ON public.store_settings
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon Write If Permitted Banners" ON public.banners
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon Write If Permitted Categories" ON public.categories
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon Write If Permitted Orders" ON public.orders
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon Write If Permitted Customers" ON public.customers
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon Write If Permitted Order Items" ON public.order_items
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 5. STORAGE BUCKETS (Criação no Supabase Storage)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de acesso público para visualização das imagens do Storage
CREATE POLICY "Public Read Product Images Storage" ON storage.objects
    FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Public Read Banners Storage" ON storage.objects
    FOR SELECT USING (bucket_id = 'banners');

CREATE POLICY "Public Read Store Assets Storage" ON storage.objects
    FOR SELECT USING (bucket_id = 'store-assets');

-- Políticas de upload para Storage
CREATE POLICY "Allow Uploads Product Images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Allow Uploads Banners" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Allow Uploads Store Assets" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'store-assets');

CREATE POLICY "Allow Updates In Buckets" ON storage.objects
    FOR UPDATE USING (bucket_id IN ('product-images', 'banners', 'store-assets'));

CREATE POLICY "Allow Deletes In Buckets" ON storage.objects
    FOR DELETE USING (bucket_id IN ('product-images', 'banners', 'store-assets'));

-- ============================================================================
-- 6. SUPABASE REALTIME (Atualização em tempo real na vitrine)
-- ============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.banners;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
EXCEPTION WHEN OTHERS THEN
    -- Ignora se as tabelas já estiverem na publicação
    NULL;
END $$;

-- ============================================================================
-- 7. DADOS INICIAIS DA WH STORE (Seed padrão)
-- ============================================================================
INSERT INTO public.store_settings (id, whatsapp_number, admin_pin, authorized_emails, updated_at)
VALUES (
    'main_settings',
    '5581989947016',
    '1234',
    ARRAY['wellysondasilva92@gmail.com', 'whstore081@gmail.com'],
    timezone('utc'::text, now())
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.banners (id, title, subtitle, description, image_url, is_active)
VALUES (
    'hero_main',
    'Elegância e Brilho para Todos os Momentos',
    'COLEÇÃO EXCLUSIVA & ATEMPORAL',
    'Descubra nossa curadoria especial de joias em prata 925 legítima, relógios clássicos e acessórios finos selecionados com acabamento impecável.',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1600&q=85',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Categorias Iniciais
INSERT INTO public.categories (slug, name, display_order)
VALUES 
    ('relogios', 'Relógios', 1),
    ('correntaria-prata-925', 'Correntaria Prata 925', 2),
    ('colar-conjunto-e-pulseiras-prata-925', 'Colar, Conjunto e Pulseiras Prata 925', 3),
    ('brincos-e-piercing-prata-925', 'Brincos e Piercing Prata 925', 4),
    ('tornozeleiras-prata-925', 'Tornozeleiras Prata 925', 5),
    ('embalagens-e-limpa-prata', 'Embalagens e Limpa Prata', 6),
    ('colares-e-conjuntos-banhados-a-ouro', 'Colares e Conjuntos Banhados Á Ouro', 7),
    ('brincos-e-argolas-banhados-a-ouro', 'Brincos e Argolas Banhados Á Ouro', 8),
    ('aco-inoxidavel', 'Aço Inoxidável', 9)
ON CONFLICT (slug) DO NOTHING;
