CREATE DATABASE IF NOT EXISTS costpilot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE costpilot;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    notif_email BOOLEAN DEFAULT TRUE,
    notif_sms BOOLEAN DEFAULT TRUE,
    notif_in_app BOOLEAN DEFAULT TRUE,
    alert_threshold_percent INT DEFAULT 25,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cloud_accounts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    provider ENUM('aws','azure','gcp') NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_id_simulated VARCHAR(100),
    region VARCHAR(100) DEFAULT 'us-east-1',
    is_active BOOLEAN DEFAULT TRUE,
    is_real BOOLEAN DEFAULT FALSE,
    data_source ENUM('simulation','real') DEFAULT 'simulation',
    sync_status ENUM('idle','syncing','synced','error') DEFAULT 'idle',
    last_synced_at DATETIME,
    monthly_budget DECIMAL(12,2) DEFAULT 5000.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_provider_account (user_id, provider, account_id_simulated),
    INDEX idx_user_id (user_id),
    INDEX idx_user_active (user_id, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cost_data (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    account_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    cost_date DATE NOT NULL,
    service VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    cost_usd DECIMAL(12,6) NOT NULL DEFAULT 0,
    usage_quantity DECIMAL(14,4),
    usage_unit VARCHAR(50),
    is_anomaly BOOLEAN DEFAULT FALSE,
    is_real BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES cloud_accounts(id) ON DELETE CASCADE,
    INDEX idx_account_date (account_id, cost_date),
    INDEX idx_account_service (account_id, service),
    INDEX idx_user_id (user_id),
    UNIQUE KEY uq_account_service_date (account_id, service, cost_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS anomaly_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    account_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    service VARCHAR(100) NOT NULL,
    anomaly_date DATE NOT NULL,
    expected_cost DECIMAL(12,6),
    actual_cost DECIMAL(12,6),
    deviation_percent DECIMAL(8,2),
    severity ENUM('low','medium','high','critical') DEFAULT 'medium',
    detection_method ENUM('isolation_forest','zscore','combined') DEFAULT 'combined',
    anomaly_score DECIMAL(8,4),
    status ENUM('open','acknowledged','resolved') DEFAULT 'open',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES cloud_accounts(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_account_id (account_id),
    INDEX idx_severity (severity)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    anomaly_id VARCHAR(36),
    account_id VARCHAR(36),
    channel ENUM('email','sms','in_app') NOT NULL,
    status ENUM('sent','failed','pending') DEFAULT 'pending',
    message TEXT NOT NULL,
    error_detail TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    meta_data JSON,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_entity_type (entity_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS simulation_state (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL UNIQUE,
    is_running BOOLEAN DEFAULT FALSE,
    started_at DATETIME,
    last_tick_at DATETIME,
    tick_count INT DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS insights (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    insight_type VARCHAR(50) NOT NULL,
    headline VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    account_id VARCHAR(36),
    related_anomaly_id VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB;