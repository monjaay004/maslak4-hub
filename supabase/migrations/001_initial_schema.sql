-- ============================================================
-- MASLAK 4 DIGITAL HUB — Schéma complet
-- Multi-tenant ready, Row-Level Security activé
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TENANT (Communauté / Maslak)
-- ============================================================
CREATE TABLE tenant (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50) UNIQUE NOT NULL,
    city        VARCHAR(100),
    country     VARCHAR(3) DEFAULT 'SN',
    logo_url    TEXT,
    settings    JSONB DEFAULT '{
        "currency": "XOF",
        "timezone": "Africa/Dakar",
        "cotisation_amount": 1000,
        "eligibility_months": 6,
        "cycle_start_day": 5,
        "cycle_end_day": 4
    }'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    is_active   BOOLEAN DEFAULT TRUE
);

INSERT INTO tenant (name, slug, city) VALUES
('Maslak Assidqi Wa Sadiqina 4', 'maslak-4', 'Dakar');

-- ============================================================
-- 2. PROFILS (liés à auth.users de Supabase)
-- ============================================================
CREATE TABLE member (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    auth_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    first_name      VARCHAR(80) NOT NULL,
    last_name       VARCHAR(80) NOT NULL,
    gender          VARCHAR(1) CHECK (gender IN ('M','F')),
    date_of_birth   DATE,
    address         TEXT,
    phone           VARCHAR(20),
    whatsapp        VARCHAR(20),
    email           VARCHAR(150),
    profession      VARCHAR(150),
    photo_url       TEXT,

    membership_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status          VARCHAR(5) NOT NULL DEFAULT 'AC'
                    CHECK (status IN ('AC','HC','I','HNC','ANC','EX')),
    role            VARCHAR(15) DEFAULT 'member'
                    CHECK (role IN ('member','treasurer','corrector','imam','admin','super_admin')),

    is_eligible_quran BOOLEAN GENERATED ALWAYS AS (
        membership_date <= CURRENT_DATE - INTERVAL '6 months'
    ) STORED,

    anciennete_mois INT GENERATED ALWAYS AS (
        EXTRACT(YEAR FROM age(CURRENT_DATE, membership_date)) * 12 +
        EXTRACT(MONTH FROM age(CURRENT_DATE, membership_date))
    ) STORED,

    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, phone),
    UNIQUE(tenant_id, auth_user_id)
);

CREATE INDEX idx_member_tenant ON member(tenant_id);
CREATE INDEX idx_member_eligible ON member(tenant_id, is_eligible_quran) WHERE is_eligible_quran = TRUE;
CREATE INDEX idx_member_status ON member(tenant_id, status);
CREATE INDEX idx_member_whatsapp ON member(whatsapp) WHERE whatsapp IS NOT NULL;

-- ============================================================
-- 3. COTISATIONS MENSUELLES
-- ============================================================
CREATE TABLE contribution (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    member_id   UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    year        SMALLINT NOT NULL,
    month       SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
    status      VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PAID','PENDING','LATE','EXEMPT')),
    paid_at     TIMESTAMPTZ,
    recorded_by UUID REFERENCES member(id),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, member_id, year, month)
);

CREATE INDEX idx_contrib_period ON contribution(tenant_id, year, month, status);

-- ============================================================
-- 4. DONS (Hadya)
-- ============================================================
CREATE TABLE donation (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    member_id   UUID REFERENCES member(id),
    amount      DECIMAL(10,2) NOT NULL,
    category    VARCHAR(15) DEFAULT 'HADYA'
                CHECK (category IN ('HADYA','SADAQA','ZAKAT','OTHER')),
    description TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_by UUID REFERENCES member(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. FONDS SOCIAL
-- ============================================================
CREATE TABLE social_fund (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id),
    type            VARCHAR(3) NOT NULL CHECK (type IN ('IN','OUT')),
    amount          DECIMAL(10,2) NOT NULL,
    beneficiary_id  UUID REFERENCES member(id),
    reason          TEXT NOT NULL,
    receipt_url     TEXT,
    approved_by     UUID REFERENCES member(id),
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. CYCLES DE LECTURE (Cœur métier)
-- ============================================================
CREATE TABLE reading_cycle (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id),
    cycle_number    INT NOT NULL,
    week_label      VARCHAR(40),
    distribution_mode VARCHAR(20) NOT NULL DEFAULT 'SEQUENTIAL'
                    CHECK (distribution_mode IN ('FIXED_GROUPS','SEQUENTIAL','RANDOM_BALANCED','MANUAL')),
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    status          VARCHAR(10) DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT','ACTIVE','CLOSING','CLOSED')),
    total_hizbs     SMALLINT DEFAULT 60,
    validated_count SMALLINT DEFAULT 0,
    created_by      UUID REFERENCES member(id),
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, cycle_number)
);

CREATE INDEX idx_cycle_active ON reading_cycle(tenant_id, status) WHERE status = 'ACTIVE';

-- ============================================================
-- 7. ATTRIBUTIONS DE HIZBS
-- ============================================================
CREATE TABLE hizb_assignment (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id),
    cycle_id        UUID NOT NULL REFERENCES reading_cycle(id) ON DELETE CASCADE,
    member_id       UUID NOT NULL REFERENCES member(id),
    hizb_number     SMALLINT NOT NULL CHECK (hizb_number BETWEEN 1 AND 60),
    is_carryover    BOOLEAN DEFAULT FALSE,
    source_cycle_id UUID REFERENCES reading_cycle(id),
    status          VARCHAR(12) DEFAULT 'ASSIGNED'
                    CHECK (status IN ('ASSIGNED','VALIDATED','EXPIRED','REASSIGNED')),
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    validated_at    TIMESTAMPTZ,
    validated_via   VARCHAR(10) CHECK (validated_via IN ('WEB','WHATSAPP')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, cycle_id, hizb_number)
);

CREATE INDEX idx_hizb_member ON hizb_assignment(member_id, status);
CREATE INDEX idx_hizb_cycle ON hizb_assignment(cycle_id, status);

-- ============================================================
-- 8. GROUPES DE LECTURE (mode FIXED_GROUPS)
-- ============================================================
CREATE TABLE reading_group (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    name        VARCHAR(50) NOT NULL,
    hizb_start  SMALLINT NOT NULL,
    hizb_end    SMALLINT NOT NULL,
    sort_order  SMALLINT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE reading_group_member (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id    UUID NOT NULL REFERENCES reading_group(id) ON DELETE CASCADE,
    member_id   UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    UNIQUE(group_id, member_id)
);

-- ============================================================
-- 9. HISTORIQUE DISTRIBUTION (algo Random Balanced)
-- ============================================================
CREATE TABLE distribution_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    member_id   UUID NOT NULL REFERENCES member(id),
    hizb_number SMALLINT NOT NULL,
    cycle_id    UUID NOT NULL REFERENCES reading_cycle(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_distrib_hist ON distribution_history(tenant_id, member_id, hizb_number);

-- ============================================================
-- 10. PARCOURS 70 HADITHS
-- ============================================================
CREATE TABLE hadith (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    number      SMALLINT NOT NULL,
    title_ar    TEXT NOT NULL,
    title_fr    TEXT,
    text_ar     TEXT NOT NULL,
    text_fr     TEXT,
    audio_url   TEXT,
    sort_order  SMALLINT,
    UNIQUE(tenant_id, number)
);

CREATE TABLE hadith_submission (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id),
    member_id       UUID NOT NULL REFERENCES member(id),
    hadith_id       UUID NOT NULL REFERENCES hadith(id),
    submission_type VARCHAR(10) NOT NULL CHECK (submission_type IN ('AUDIO','TEXT')),
    audio_url       TEXT,
    text_content    TEXT,
    status          VARCHAR(10) DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    corrector_id    UUID REFERENCES member(id),
    corrector_note  TEXT,
    reviewed_at     TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, member_id, hadith_id)
);

-- ============================================================
-- 11. LMS (Cours)
-- ============================================================
CREATE TABLE course (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    category    VARCHAR(50),
    is_published BOOLEAN DEFAULT FALSE,
    sort_order  SMALLINT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_module (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id   UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('VIDEO','AUDIO','TEXT','PDF')),
    content_url TEXT,
    content_text TEXT,
    duration_min SMALLINT,
    sort_order  SMALLINT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_progress (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    member_id   UUID NOT NULL REFERENCES member(id),
    module_id   UUID NOT NULL REFERENCES course_module(id),
    completed   BOOLEAN DEFAULT FALSE,
    progress_pct SMALLINT DEFAULT 0,
    last_position INT DEFAULT 0,
    completed_at TIMESTAMPTZ,
    UNIQUE(tenant_id, member_id, module_id)
);

CREATE TABLE quiz (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id   UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    title       VARCHAR(200),
    pass_score  SMALLINT DEFAULT 70,
    questions   JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE quiz_attempt (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    member_id   UUID NOT NULL REFERENCES member(id),
    quiz_id     UUID NOT NULL REFERENCES quiz(id),
    score       SMALLINT NOT NULL,
    passed      BOOLEAN NOT NULL,
    answers     JSONB,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE certificate (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    member_id   UUID NOT NULL REFERENCES member(id),
    course_id   UUID NOT NULL REFERENCES course(id),
    code        VARCHAR(20) UNIQUE NOT NULL,
    issued_at   TIMESTAMPTZ DEFAULT NOW(),
    pdf_url     TEXT
);

-- ============================================================
-- 12. MÉDIATHÈQUE
-- ============================================================
CREATE TABLE media_item (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    title       VARCHAR(300) NOT NULL,
    description TEXT,
    media_type  VARCHAR(10) NOT NULL CHECK (media_type IN ('AUDIO','VIDEO','PHOTO','DOCUMENT')),
    file_url    TEXT NOT NULL,
    thumbnail_url TEXT,
    file_size   BIGINT,
    duration_sec INT,
    tags        TEXT[] DEFAULT '{}',
    metadata    JSONB DEFAULT '{}',
    is_published BOOLEAN DEFAULT TRUE,
    uploaded_by UUID REFERENCES member(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_tags ON media_item USING GIN(tags);
CREATE INDEX idx_media_search ON media_item USING GIN(
    to_tsvector('french', title || ' ' || COALESCE(description, ''))
);

-- ============================================================
-- 13. GOUDY AJUMA
-- ============================================================
CREATE TABLE goudy_content (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    title       VARCHAR(200) NOT NULL,
    content_ar  TEXT NOT NULL,
    content_fr  TEXT,
    audio_url   TEXT,
    sort_order  SMALLINT NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. BIBLIOTHÈQUE
-- ============================================================
CREATE TABLE library_item (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    title       VARCHAR(300) NOT NULL,
    author      VARCHAR(200),
    description TEXT,
    format      VARCHAR(5) NOT NULL CHECK (format IN ('PDF','EPUB')),
    file_url    TEXT NOT NULL,
    cover_url   TEXT,
    page_count  INT,
    language    VARCHAR(5) DEFAULT 'ar',
    category    VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE library_bookmark (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id   UUID NOT NULL REFERENCES member(id),
    item_id     UUID NOT NULL REFERENCES library_item(id),
    page_number INT,
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. NOTIFICATIONS
-- ============================================================
CREATE TABLE notification (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    member_id   UUID NOT NULL REFERENCES member(id),
    channel     VARCHAR(10) NOT NULL CHECK (channel IN ('WHATSAPP','WEB','PUSH')),
    type        VARCHAR(25) NOT NULL,
    title       VARCHAR(200),
    body        TEXT NOT NULL,
    status      VARCHAR(10) DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','SENT','DELIVERED','READ','FAILED')),
    wa_message_id VARCHAR(100),
    sent_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_member ON notification(member_id, created_at DESC);

-- ============================================================
-- 16. LOG WHATSAPP
-- ============================================================
CREATE TABLE wa_message_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    phone       VARCHAR(20) NOT NULL,
    direction   VARCHAR(3) NOT NULL CHECK (direction IN ('IN','OUT')),
    content     TEXT,
    parsed_command VARCHAR(20),
    processed   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FONCTIONS UTILITAIRES
-- ============================================================

-- Fonction : obtenir le tenant_id du membre connecté
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM member WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fonction : obtenir le member record du connecté
CREATE OR REPLACE FUNCTION get_my_member()
RETURNS SETOF member AS $$
    SELECT * FROM member WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fonction : vérifier si admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS(
        SELECT 1 FROM member
        WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Trigger : updated_at automatique
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_member_updated
    BEFORE UPDATE ON member
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE member ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_cycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE hizb_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE hadith_submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_item ENABLE ROW LEVEL SECURITY;

-- Membres : visible par tous les membres du même tenant
CREATE POLICY member_select ON member FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY member_insert ON member FOR INSERT
    WITH CHECK (is_admin());
CREATE POLICY member_update ON member FOR UPDATE
    USING (auth_user_id = auth.uid() OR is_admin());

-- Cotisations : visible par le membre concerné ou admin
CREATE POLICY contrib_select ON contribution FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY contrib_insert ON contribution FOR INSERT
    WITH CHECK (is_admin());
CREATE POLICY contrib_update ON contribution FOR UPDATE
    USING (is_admin());

-- Cycles : visible par tous les membres du tenant
CREATE POLICY cycle_select ON reading_cycle FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY cycle_manage ON reading_cycle FOR ALL
    USING (is_admin());

-- Hizb assignments : visible par tous, modifiable par le membre ou admin
CREATE POLICY hizb_select ON hizb_assignment FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY hizb_validate ON hizb_assignment FOR UPDATE
    USING (member_id IN (SELECT id FROM member WHERE auth_user_id = auth.uid()) OR is_admin());

-- Hadiths : soumission par le membre, review par correcteur
CREATE POLICY hadith_sub_select ON hadith_submission FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY hadith_sub_insert ON hadith_submission FOR INSERT
    WITH CHECK (member_id IN (SELECT id FROM member WHERE auth_user_id = auth.uid()));
CREATE POLICY hadith_sub_review ON hadith_submission FOR UPDATE
    USING (is_admin() OR member_id IN (
        SELECT id FROM member WHERE auth_user_id = auth.uid() AND role = 'corrector'
    ));

-- Notifications : le membre ne voit que les siennes
CREATE POLICY notif_select ON notification FOR SELECT
    USING (member_id IN (SELECT id FROM member WHERE auth_user_id = auth.uid()));

-- Médias : tous les membres du tenant
CREATE POLICY media_select ON media_item FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY media_manage ON media_item FOR ALL
    USING (is_admin());

-- Donations, social_fund, course_progress : tenant-scoped
CREATE POLICY donation_select ON donation FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY social_select ON social_fund FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY progress_select ON course_progress FOR SELECT
    USING (tenant_id = get_my_tenant_id());
CREATE POLICY progress_upsert ON course_progress FOR ALL
    USING (member_id IN (SELECT id FROM member WHERE auth_user_id = auth.uid()));

-- Tables publiques (lecture seule pour membres du tenant)
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON tenant FOR SELECT USING (TRUE);

ALTER TABLE hadith ENABLE ROW LEVEL SECURITY;
CREATE POLICY hadith_select ON hadith FOR SELECT
    USING (tenant_id = get_my_tenant_id());

ALTER TABLE course ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_select ON course FOR SELECT
    USING (tenant_id = get_my_tenant_id());

ALTER TABLE course_module ENABLE ROW LEVEL SECURITY;
CREATE POLICY module_select ON course_module FOR SELECT USING (TRUE);

ALTER TABLE goudy_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY goudy_select ON goudy_content FOR SELECT
    USING (tenant_id = get_my_tenant_id());

ALTER TABLE library_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY library_select ON library_item FOR SELECT
    USING (tenant_id = get_my_tenant_id());

ALTER TABLE reading_group ENABLE ROW LEVEL SECURITY;
CREATE POLICY rg_select ON reading_group FOR SELECT
    USING (tenant_id = get_my_tenant_id());

ALTER TABLE quiz ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_select ON quiz FOR SELECT USING (TRUE);

-- ============================================================
-- VUES DASHBOARD
-- ============================================================

-- Vue : solde trésorerie
CREATE OR REPLACE VIEW v_treasury_summary AS
SELECT
    t.tenant_id,
    COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'PAID'), 0) AS total_cotisations,
    COALESCE(SUM(d.amount), 0) AS total_donations,
    COALESCE(SUM(sf.amount) FILTER (WHERE sf.type = 'IN'), 0) AS fonds_social_entrees,
    COALESCE(SUM(sf.amount) FILTER (WHERE sf.type = 'OUT'), 0) AS fonds_social_sorties
FROM tenant t
LEFT JOIN contribution c ON c.tenant_id = t.id
LEFT JOIN donation d ON d.tenant_id = t.id
LEFT JOIN social_fund sf ON sf.tenant_id = t.id
GROUP BY t.tenant_id;

-- Vue : progression cycle actif
CREATE OR REPLACE VIEW v_active_cycle_progress AS
SELECT
    rc.id AS cycle_id,
    rc.tenant_id,
    rc.cycle_number,
    rc.week_label,
    rc.distribution_mode,
    rc.starts_at,
    rc.ends_at,
    rc.total_hizbs,
    COUNT(ha.id) AS total_assigned,
    COUNT(ha.id) FILTER (WHERE ha.status = 'VALIDATED') AS total_validated,
    COUNT(ha.id) FILTER (WHERE ha.status = 'ASSIGNED') AS total_pending,
    COUNT(ha.id) FILTER (WHERE ha.is_carryover = TRUE) AS total_carryovers,
    ROUND(
        COUNT(ha.id) FILTER (WHERE ha.status = 'VALIDATED')::DECIMAL /
        NULLIF(COUNT(ha.id), 0) * 100
    ) AS progress_pct
FROM reading_cycle rc
LEFT JOIN hizb_assignment ha ON ha.cycle_id = rc.id
WHERE rc.status = 'ACTIVE'
GROUP BY rc.id;
