-- ==============================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR REACT NATIVE CUSTOM OTA SERVER
-- Chạy toàn bộ file này trong: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- Bật extension UUID nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BẢNG ỨNG DỤNG (APPS)
CREATE TABLE IF NOT EXISTS public.apps (
    id VARCHAR(100) PRIMARY KEY, -- vd: "com.otademoapp"
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BẢNG PHÂN QUYỀN THÀNH VIÊN TRONG APP (APP_MEMBERS)
CREATE TABLE IF NOT EXISTS public.app_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(100) REFERENCES public.apps(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'developer', -- 'owner' | 'admin' | 'developer' | 'viewer'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, user_id)
);

-- 3. BẢNG QUẢN LÝ API KEYS (CHO MOBILE APP & CI/CD)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(100) REFERENCES public.apps(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,            -- vd: "Mobile App Production", "GitHub Actions CI"
    key_prefix VARCHAR(30) NOT NULL,       -- vd: "ota_pull_live_" hoặc "ota_push_live_"
    key_hash VARCHAR(64) NOT NULL,         -- SHA-256 hash của full API key
    key_type VARCHAR(20) NOT NULL,         -- 'pull' | 'push' | 'full'
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,                -- NULL nếu không bao giờ hết hạn
    is_active BOOLEAN DEFAULT TRUE
);

-- Index tra cứu API Key cực nhanh khi client gửi request
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_app_id ON public.api_keys(app_id);

-- 4. BẢNG QUẢN LÝ RELEASES (BẢN PHÁT HÀNH OTA)
CREATE TABLE IF NOT EXISTS public.releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(100) REFERENCES public.apps(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,         -- 'ios' | 'android'
    ota_version VARCHAR(50) NOT NULL,      -- vd: "1.0.6"
    target_binary_version VARCHAR(100) DEFAULT '*', -- vd: "3.9.x", "~3.9.0", "3.9.0 - 3.9.99"
    min_native_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    max_native_version VARCHAR(50) DEFAULT NULL,    -- vd: "3.9.99"
    channel VARCHAR(50) DEFAULT 'production',
    mandatory BOOLEAN DEFAULT FALSE,
    bundle_name VARCHAR(100) DEFAULT 'main.jsbundle',
    file_hash VARCHAR(64) NOT NULL,        -- SHA-256 hash của update.zip
    file_size BIGINT NOT NULL,             -- Bytes
    r2_storage_key TEXT NOT NULL,          -- Path trên Cloudflare R2
    download_url TEXT NOT NULL,            -- URL tải trực tiếp qua CDN Cloudflare
    release_notes TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT FALSE,       -- Bản đang được phục vụ (Latest)
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, platform, ota_version)
);

CREATE INDEX IF NOT EXISTS idx_releases_app_platform ON public.releases(app_id, platform);
CREATE INDEX IF NOT EXISTS idx_releases_active ON public.releases(app_id, platform, is_active);

-- 5. BẬT ROW LEVEL SECURITY (RLS) ĐỂ BẢO VỆ DỮ LIỆU
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

-- Policy cho bảng apps: Người dùng chỉ thấy app họ sở hữu hoặc là thành viên
CREATE POLICY "Users can view their apps" ON public.apps
    FOR SELECT USING (
        auth.uid() = owner_id OR
        EXISTS (SELECT 1 FROM public.app_members WHERE app_members.app_id = apps.id AND app_members.user_id = auth.uid())
    );

CREATE POLICY "Users can insert their apps" ON public.apps
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their apps" ON public.apps
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their apps" ON public.apps
    FOR DELETE USING (auth.uid() = owner_id);

-- Policy cho releases: Xem releases của app mà user có quyền truy cập
CREATE POLICY "Users can view releases of their apps" ON public.releases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.apps 
            WHERE apps.id = releases.app_id AND (
                apps.owner_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.app_members WHERE app_members.app_id = apps.id AND app_members.user_id = auth.uid())
            )
        )
    );

-- Policy cho API Keys: Xem API Keys của app thuộc quyền quản lý
CREATE POLICY "Users can view api keys of their apps" ON public.api_keys
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.apps 
            WHERE apps.id = api_keys.app_id AND (
                apps.owner_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.app_members WHERE app_members.app_id = apps.id AND app_members.user_id = auth.uid() AND app_members.role IN ('owner', 'admin'))
            )
        )
    );
