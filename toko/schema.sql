-- Skema database Toko (MySQL/MariaDB). Dijalankan otomatis oleh install.php.
-- Charset utf8mb4 untuk dukungan emoji & karakter lengkap.

CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'admin',  -- admin | editor
    avatar_url    VARCHAR(255) NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
    k          VARCHAR(64) PRIMARY KEY,
    v          TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS articles (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    title            VARCHAR(200) NOT NULL,
    slug             VARCHAR(220) NOT NULL UNIQUE,
    excerpt          VARCHAR(300) NULL,
    content          MEDIUMTEXT NULL,
    cover_url        VARCHAR(255) NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',   -- DRAFT | PUBLISHED | SCHEDULED
    author_id        INT NULL,
    views            INT NOT NULL DEFAULT 0,
    seo_keyword      VARCHAR(120) NULL,
    meta_title       VARCHAR(200) NULL,
    meta_description VARCHAR(300) NULL,
    seo_score        TINYINT NOT NULL DEFAULT 0,
    scheduled_at     DATETIME NULL,
    published_at     TIMESTAMP NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_articles_status (status),
    INDEX idx_articles_published (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Satu baris per kunjungan artikel (untuk grafik tren & jumlah pengunjung unik)
CREATE TABLE IF NOT EXISTS article_views (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id INT NOT NULL,
    viewed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_hash    CHAR(64) NULL,
    referrer   VARCHAR(255) NULL,
    user_agent VARCHAR(255) NULL,
    INDEX idx_views_article (article_id),
    INDEX idx_views_date (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
