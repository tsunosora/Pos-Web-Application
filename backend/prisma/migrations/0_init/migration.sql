-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,
    `menu_access` TEXT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `address` TEXT NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `omset` DECIMAL(15, 2) NULL DEFAULT 0,
    `margin` DECIMAL(5, 2) NULL DEFAULT 0,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `competitors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `type` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `latitude` DECIMAL(9, 6) NOT NULL,
    `longitude` DECIMAL(9, 6) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NULL,
    `email` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `password_hash` VARCHAR(200) NOT NULL,
    `role_id` INTEGER NULL,
    `branch_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `resigned_at` DATETIME(3) NULL,
    `resign_note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `parent_id` INTEGER NULL,
    `counts_as_pcs` BOOLEAN NOT NULL DEFAULT true,
    `production_category_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `categories_updated_at_idx`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `units_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `image_url` TEXT NULL,
    `image_urls` TEXT NULL,
    `pricing_mode` ENUM('UNIT', 'AREA_BASED', 'COMPOSITE') NOT NULL DEFAULT 'UNIT',
    `area_unit` VARCHAR(10) NOT NULL DEFAULT 'M2',
    `product_type` ENUM('SELLABLE', 'RAW_MATERIAL', 'SERVICE') NOT NULL DEFAULT 'SELLABLE',
    `composite_config` JSON NULL,
    `price_per_unit` DECIMAL(15, 2) NULL,
    `requires_production` BOOLEAN NOT NULL DEFAULT false,
    `has_assembly_stage` BOOLEAN NOT NULL DEFAULT false,
    `track_stock` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `click_rate_id` INTEGER NULL,
    `clicks_per_unit` DOUBLE NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `products_updated_at_idx`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `sku` VARCHAR(100) NOT NULL,
    `variant_name` VARCHAR(100) NULL,
    `price` DECIMAL(15, 2) NOT NULL,
    `hpp` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `size` VARCHAR(50) NULL,
    `color` VARCHAR(50) NULL,
    `variant_image_url` TEXT NULL,
    `is_roll_material` BOOLEAN NOT NULL DEFAULT false,
    `roll_physical_width` DECIMAL(10, 2) NULL,
    `roll_effective_print_width` DECIMAL(10, 2) NULL,
    `click_rate_id` INTEGER NULL,
    `clicks_per_unit` DOUBLE NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `product_variants_sku_key`(`sku`),
    INDEX `product_variants_updated_at_idx`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_stocks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `branch_stocks_branch_id_idx`(`branch_id`),
    INDEX `branch_stocks_product_variant_id_idx`(`product_variant_id`),
    UNIQUE INDEX `branch_stocks_branch_id_product_variant_id_key`(`branch_id`, `product_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingredients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `price` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `raw_material_variant_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_variant_id` INTEGER NOT NULL,
    `batch_number` VARCHAR(100) NOT NULL,
    `expiration_date` DATE NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `batches_batch_number_key`(`batch_number`),
    INDEX `batches_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `source` ENUM('CETAK', 'PRODUKSI') NOT NULL DEFAULT 'PRODUKSI',
    `measure_by` ENUM('AREA', 'PCS') NOT NULL DEFAULT 'AREA',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `production_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_product_metrics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `label` VARCHAR(40) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `product_ids` JSON NULL,
    `product_variant_ids` JSON NULL,
    `category_ids` JSON NULL,
    `name_keywords` JSON NULL,
    `count_mode` VARCHAR(10) NOT NULL DEFAULT 'PCS',
    `roles` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_variant_id` INTEGER NOT NULL,
    `type` ENUM('IN', 'OUT', 'ADJUST') NOT NULL,
    `quantity` DECIMAL(10, 4) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `balance_after` DOUBLE NULL,
    `reference_id` VARCHAR(100) NULL,
    `branch_id` INTEGER NULL,
    `date` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_branch_id_idx`(`branch_id`),
    INDEX `stock_movements_reference_id_idx`(`reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_number` VARCHAR(100) NOT NULL,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `tax` DECIMAL(15, 2) NOT NULL,
    `discount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `shipping_cost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `marketplace_fee` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `marketplace_fee_items` JSON NULL,
    `grand_total` DECIMAL(15, 2) NOT NULL,
    `payment_method` ENUM('CASH', 'QRIS', 'BANK_TRANSFER') NOT NULL,
    `status` ENUM('PENDING', 'PARTIAL', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `customer_name` VARCHAR(200) NULL,
    `customer_phone` VARCHAR(50) NULL,
    `customer_address` TEXT NULL,
    `due_date` DATETIME(3) NULL,
    `down_payment` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `cashier_name` VARCHAR(100) NULL,
    `employee_name` VARCHAR(100) NULL,
    `bank_account_id` INTEGER NULL,
    `dp_payment_method` ENUM('CASH', 'QRIS', 'BANK_TRANSFER') NULL,
    `dp_bank_account_id` INTEGER NULL,
    `production_priority` VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    `production_deadline` DATETIME(3) NULL,
    `production_notes` TEXT NULL,
    `label` VARCHAR(120) NULL,
    `marketplace` VARCHAR(40) NULL,
    `marketplace_order_no` VARCHAR(60) NULL,
    `checkout_number` VARCHAR(100) NULL,
    `paid_at` DATETIME(3) NULL,
    `checkout_cashier_name` VARCHAR(100) NULL,
    `branch_name` VARCHAR(100) NULL,
    `branch_id` INTEGER NULL,
    `production_branch_id` INTEGER NULL,
    `handover_status` VARCHAR(20) NULL DEFAULT 'BARU',
    `handover_ack_at` DATETIME(3) NULL,
    `handover_ready_at` DATETIME(3) NULL,
    `handover_done_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `transactions_invoice_number_key`(`invoice_number`),
    UNIQUE INDEX `transactions_checkout_number_key`(`checkout_number`),
    INDEX `transactions_branch_id_idx`(`branch_id`),
    INDEX `transactions_production_branch_id_idx`(`production_branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NULL,
    `custom_name` VARCHAR(255) NULL,
    `quantity` INTEGER NOT NULL,
    `price_at_time` DECIMAL(15, 2) NOT NULL,
    `hpp_at_time` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `is_sub_order` BOOLEAN NOT NULL DEFAULT false,
    `sub_price` DECIMAL(15, 2) NULL,
    `sub_vendor` VARCHAR(200) NULL,
    `width_cm` DECIMAL(10, 2) NULL,
    `height_cm` DECIMAL(10, 2) NULL,
    `area_cm2` DECIMAL(15, 4) NULL,
    `pcs` INTEGER NULL DEFAULT 1,
    `unit_type` VARCHAR(10) NULL,
    `note` TEXT NULL,
    `click_type` VARCHAR(50) NULL,
    `original_price` DECIMAL(15, 2) NULL,
    `price_override_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashflows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `note` TEXT NULL,
    `user_id` INTEGER NULL,
    `bank_account_id` INTEGER NULL,
    `payment_method` ENUM('CASH', 'QRIS', 'BANK_TRANSFER') NULL,
    `platform_source` VARCHAR(100) NULL,
    `branch_name` VARCHAR(100) NULL,
    `branch_id` INTEGER NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `shift_report_id` INTEGER NULL,
    `exclude_from_shift` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cashflows_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashflow_change_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashflow_id` INTEGER NOT NULL,
    `requester_id` INTEGER NOT NULL,
    `type` ENUM('EDIT', 'DELETE') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `payload` JSON NULL,
    `requester_note` TEXT NULL,
    `reviewer_note` TEXT NULL,
    `reviewed_by` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction_edit_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_id` INTEGER NOT NULL,
    `requested_by_id` INTEGER NOT NULL,
    `reviewed_by_id` INTEGER NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NOT NULL,
    `edit_data` JSON NOT NULL,
    `review_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_number` VARCHAR(100) NOT NULL,
    `type` ENUM('INVOICE', 'QUOTATION') NOT NULL DEFAULT 'INVOICE',
    `client_name` VARCHAR(200) NOT NULL,
    `client_company` VARCHAR(200) NULL,
    `client_address` TEXT NULL,
    `client_phone` VARCHAR(50) NULL,
    `client_email` VARCHAR(150) NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `due_date` DATETIME(3) NULL,
    `valid_until` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SENT', 'PAID', 'CANCELLED', 'ACCEPTED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `letter_city` VARCHAR(120) NULL,
    `signatory_name` VARCHAR(120) NULL,
    `signatory_phone` VARCHAR(50) NULL,
    `branch_id` INTEGER NULL,
    `source_quotation_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invoices_invoice_number_key`(`invoice_number`),
    UNIQUE INDEX `invoices_source_quotation_id_key`(`source_quotation_id`),
    INDEX `invoices_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `unit` VARCHAR(50) NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `price` DECIMAL(15, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hpp_worksheets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_name` VARCHAR(200) NOT NULL,
    `target_volume` INTEGER NOT NULL DEFAULT 1,
    `target_margin` DECIMAL(10, 2) NOT NULL DEFAULT 50,
    `product_variant_id` INTEGER NULL,
    `product_id` INTEGER NULL,
    `applied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hpp_variable_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `worksheet_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NULL,
    `custom_material_name` VARCHAR(200) NULL,
    `custom_price` DECIMAL(15, 2) NULL,
    `usage_amount` DECIMAL(15, 4) NOT NULL,
    `usage_unit` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hpp_fixed_costs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `worksheet_id` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_name` VARCHAR(200) NOT NULL,
    `store_address` TEXT NULL,
    `store_phone` VARCHAR(50) NULL,
    `qris_image_url` TEXT NULL,
    `logo_image_url` TEXT NULL,
    `enable_advanced_pricing` BOOLEAN NOT NULL DEFAULT false,
    `enable_tax` BOOLEAN NOT NULL DEFAULT true,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 10,
    `receipt_default_format` VARCHAR(20) NOT NULL DEFAULT 'A5',
    `login_bg_images` TEXT NULL,
    `login_taglines` TEXT NULL,
    `login_logo_url` TEXT NULL,
    `theme_mode` VARCHAR(20) NULL DEFAULT 'SOLID',
    `theme_primary_color` VARCHAR(20) NULL DEFAULT '#4F46E5',
    `theme_secondary_color` VARCHAR(20) NULL DEFAULT '#7C3AED',
    `theme_gradient_direction` VARCHAR(20) NULL DEFAULT '135deg',
    `operator_pin` VARCHAR(10) NULL,
    `marketing_pin` VARCHAR(10) NULL,
    `notify_new_transaction` BOOLEAN NOT NULL DEFAULT true,
    `notify_low_stock` BOOLEAN NOT NULL DEFAULT true,
    `notify_offline_sync` BOOLEAN NOT NULL DEFAULT true,
    `notify_shift_reminder` BOOLEAN NOT NULL DEFAULT false,
    `low_stock_threshold` INTEGER NOT NULL DEFAULT 5,
    `shift_reminder_time` VARCHAR(5) NULL,
    `shift_reminder_time_2` VARCHAR(5) NULL,
    `piket_trial_until` VARCHAR(10) NULL,
    `piket_signatures` TEXT NULL,
    `notify_github_commit` BOOLEAN NOT NULL DEFAULT true,
    `discord_webhook_url` TEXT NULL,
    `github_webhook_secret` VARCHAR(200) NULL,
    `rclone_enabled` BOOLEAN NOT NULL DEFAULT false,
    `rclone_remote` VARCHAR(300) NULL,
    `rclone_schedule` VARCHAR(50) NULL DEFAULT '0 2 * * *',
    `rclone_keep_count` INTEGER NOT NULL DEFAULT 7,
    `rclone_last_backup_at` DATETIME(3) NULL,
    `rclone_last_status` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketing_spend` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL,
    `source` VARCHAR(40) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `note` VARCHAR(255) NULL,
    `branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `marketing_spend_date_idx`(`date`),
    INDEX `marketing_spend_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fixed_expenses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `category` VARCHAR(30) NOT NULL DEFAULT 'LAINNYA',
    `amount` DECIMAL(15, 2) NOT NULL,
    `branch_id` INTEGER NULL,
    `due_day` INTEGER NULL,
    `note` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fixed_expenses_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_monthly_closings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `branch_id` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
    `collected_bank` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `collected_cash` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `modal_total` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `snapshot` JSON NULL,
    `closed_by` VARCHAR(100) NULL,
    `closed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `funded_at` DATETIME(3) NULL,

    INDEX `branch_monthly_closings_branch_id_idx`(`branch_id`),
    UNIQUE INDEX `branch_monthly_closings_year_month_branch_id_key`(`year`, `month`, `branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `central_treasury_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `direction` VARCHAR(3) NOT NULL,
    `category` VARCHAR(30) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `branch_id` INTEGER NULL,
    `note` TEXT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `central_treasury_entries_direction_idx`(`direction`),
    INDEX `central_treasury_entries_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bonus_targets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_id` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `metric` VARCHAR(20) NOT NULL,
    `gaji_pokok` DECIMAL(15, 2) NOT NULL DEFAULT 1800000,
    `bonus_kualitas` DECIMAL(15, 2) NOT NULL DEFAULT 300000,
    `bonus_tim` DECIMAL(15, 2) NOT NULL DEFAULT 300000,
    `bonus_pribadi` DECIMAL(15, 2) NOT NULL DEFAULT 300000,
    `target_tim` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `target_pribadi` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `period_tim` VARCHAR(10) NOT NULL DEFAULT 'BULANAN',
    `period_pribadi` VARCHAR(10) NOT NULL DEFAULT 'HARIAN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bonus_targets_branch_id_role_key`(`branch_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bonus_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_id` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `employee_name` VARCHAR(120) NOT NULL,
    `period_month` VARCHAR(7) NOT NULL,
    `quality_eligible` BOOLEAN NOT NULL DEFAULT true,
    `forfeited` BOOLEAN NOT NULL DEFAULT false,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bonus_adjustments_branch_id_role_employee_name_period_month_key`(`branch_id`, `role`, `employee_name`, `period_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discord_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `webhooks` JSON NULL,
    `events` JSON NULL,
    `branch_configs` JSON NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `landing_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `data` JSON NULL,
    `draftData` JSON NULL,
    `previous_data` JSON NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `custom_domain` VARCHAR(255) NULL,
    `seo_title` VARCHAR(200) NULL,
    `seo_description` TEXT NULL,
    `favicon_url` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `articles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `excerpt` TEXT NULL,
    `content` LONGTEXT NULL,
    `cover_image` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `published_at` DATETIME(3) NULL,
    `author_name` VARCHAR(120) NULL,
    `seo_title` VARCHAR(200) NULL,
    `seo_description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `articles_slug_key`(`slug`),
    INDEX `articles_status_published_at_idx`(`status`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bank_name` VARCHAR(100) NOT NULL,
    `account_number` VARCHAR(100) NOT NULL,
    `account_owner` VARCHAR(100) NOT NULL,
    `current_balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bank_accounts_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `lead_source` ENUM('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'MARKETPLACE', 'REFERRAL', 'WEBSITE', 'WALK_IN', 'REPEAT_ORDER', 'OTHER', 'CUSTOM') NULL,
    `assigned_cs_id` INTEGER NULL,
    `referrer_customer_id` INTEGER NULL,
    `tags` JSON NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customers_assigned_cs_id_idx`(`assigned_cs_id`),
    INDEX `customers_updated_at_idx`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cs_rating_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_id` INTEGER NULL,
    `question` VARCHAR(300) NOT NULL DEFAULT 'Apakah Anda puas dengan pelayanan kami?',
    `thank_you_text` VARCHAR(300) NOT NULL DEFAULT 'Terima kasih atas penilaian Anda!',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cs_rating_configs_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cs_rating_responses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(32) NOT NULL,
    `branch_id` INTEGER NULL,
    `customer_id` INTEGER NULL,
    `sales_order_id` INTEGER NULL,
    `transaction_id` INTEGER NULL,
    `assigned_cs_id` INTEGER NULL,
    `assigned_cs_name` VARCHAR(100) NULL,
    `designer_name` VARCHAR(100) NULL,
    `question` VARCHAR(300) NOT NULL,
    `answer` BOOLEAN NULL,
    `stars` INTEGER NULL,
    `comment` TEXT NULL,
    `submitted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cs_rating_responses_token_key`(`token`),
    INDEX `cs_rating_responses_branch_id_idx`(`branch_id`),
    INDEX `cs_rating_responses_assigned_cs_id_idx`(`assigned_cs_id`),
    INDEX `cs_rating_responses_submitted_at_idx`(`submitted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_opname_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `category_id` INTEGER NULL,
    `branch_id` INTEGER NULL,
    `status` ENUM('ONGOING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ONGOING',
    `expires_at` DATETIME(3) NOT NULL,
    `start_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_opname_sessions_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_opname_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` VARCHAR(191) NOT NULL,
    `operator_name` VARCHAR(100) NOT NULL,
    `product_variant_id` INTEGER NOT NULL,
    `system_stock` INTEGER NOT NULL,
    `actual_stock` INTEGER NOT NULL,
    `variance` INTEGER NOT NULL,
    `is_estimated` BOOLEAN NOT NULL DEFAULT false,
    `estimation_notes` TEXT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_number` VARCHAR(50) NOT NULL,
    `transaction_id` INTEGER NOT NULL,
    `transaction_item_id` INTEGER NOT NULL,
    `branch_id` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ANTRIAN',
    `priority` VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    `deadline` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `operator_note` TEXT NULL,
    `used_waste` BOOLEAN NOT NULL DEFAULT false,
    `is_sub_order` BOOLEAN NOT NULL DEFAULT false,
    `roll_variant_id` INTEGER NULL,
    `roll_length_used` DECIMAL(10, 2) NULL,
    `batch_id` INTEGER NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `assembly_started_at` DATETIME(3) NULL,
    `assembly_completed_at` DATETIME(3) NULL,
    `assembly_note` TEXT NULL,
    `picked_up_at` DATETIME(3) NULL,
    `pipeline_stage` VARCHAR(30) NULL DEFAULT 'DESIGN',
    `proof_image_url` TEXT NULL,
    `last_updated_by` VARCHAR(120) NULL,
    `last_updated_at` DATETIME(3) NULL,
    `penjahit_name` VARCHAR(120) NULL,
    `jahit_in_date` DATETIME(3) NULL,
    `jahit_estimate` DATETIME(3) NULL,
    `designer_name` VARCHAR(120) NULL,
    `is_express` BOOLEAN NOT NULL DEFAULT false,
    `design_entered_at` DATETIME(3) NULL,
    `qc_note` TEXT NULL,
    `shipped_at` DATETIME(3) NULL,
    `returned_at` DATETIME(3) NULL,
    `return_reason` TEXT NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` TEXT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `production_jobs_job_number_key`(`job_number`),
    UNIQUE INDEX `production_jobs_transaction_item_id_key`(`transaction_item_id`),
    INDEX `production_jobs_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jersey_work_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `production_job_id` INTEGER NOT NULL,
    `wo_number` VARCHAR(60) NULL,
    `order_date` DATETIME(3) NULL,
    `source` VARCHAR(60) NULL,
    `designer_name` VARCHAR(120) NULL,
    `deadline` DATETIME(3) NULL,
    `customer_name` VARCHAR(200) NULL,
    `collar_type` VARCHAR(60) NULL,
    `fabric_type` VARCHAR(80) NULL,
    `mockup_image_url` TEXT NULL,
    `print_layout_image_url` TEXT NULL,
    `mockup_images` JSON NULL,
    `print_layout_images` JSON NULL,
    `short_sleeve_items` JSON NULL,
    `long_sleeve_items` JSON NULL,
    `pants_items` JSON NULL,
    `print_patterns` JSON NULL,
    `qc_checklist` JSON NULL,
    `tgl_print` DATETIME(3) NULL,
    `tgl_press` DATETIME(3) NULL,
    `tgl_jahit` DATETIME(3) NULL,
    `print_inspector` VARCHAR(120) NULL,
    `jahit_inspector` VARCHAR(120) NULL,
    `notes` TEXT NULL,
    `branch_id` INTEGER NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `jersey_work_orders_production_job_id_key`(`production_job_id`),
    UNIQUE INDEX `jersey_work_orders_wo_number_key`(`wo_number`),
    INDEX `jersey_work_orders_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_job_proofs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_id` INTEGER NOT NULL,
    `filename` TEXT NOT NULL,
    `caption` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `production_job_proofs_job_id_position_idx`(`job_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_job_activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_id` INTEGER NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `from_stage` VARCHAR(30) NULL,
    `to_stage` VARCHAR(30) NULL,
    `actor_name` VARCHAR(120) NULL,
    `actor_role` VARCHAR(20) NULL,
    `actor_weight` DOUBLE NOT NULL DEFAULT 1,
    `branch_id` INTEGER NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `production_job_activities_job_id_created_at_idx`(`job_id`, `created_at`),
    INDEX `production_job_activities_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batch_number` VARCHAR(50) NOT NULL,
    `roll_variant_id` INTEGER NULL,
    `used_waste` BOOLEAN NOT NULL DEFAULT false,
    `roll_length_used` DECIMAL(10, 2) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PROSES',
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `production_batches_batch_number_key`(`batch_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `contact_person` VARCHAR(200) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(200) NULL,
    `address` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NOT NULL,
    `purchase_price` DECIMAL(15, 2) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_purchases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_number` VARCHAR(100) NULL,
    `supplier_id` INTEGER NULL,
    `branch_id` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_purchases_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_purchase_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchase_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(15, 2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_price_tiers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variant_id` INTEGER NOT NULL,
    `tier_name` VARCHAR(100) NULL,
    `min_qty` INTEGER NOT NULL,
    `max_qty` INTEGER NULL,
    `price` DECIMAL(15, 2) NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_ingredients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variant_id` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `price` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `is_service_cost` BOOLEAN NOT NULL DEFAULT false,
    `is_shared` BOOLEAN NOT NULL DEFAULT false,
    `raw_material_variant_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_name` VARCHAR(100) NOT NULL,
    `shift_name` VARCHAR(50) NOT NULL,
    `opened_at` DATETIME(3) NOT NULL,
    `closed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expected_cash` DECIMAL(15, 2) NOT NULL,
    `actual_cash` DECIMAL(15, 2) NOT NULL,
    `cash_difference` DECIMAL(15, 2) NOT NULL,
    `expected_qris` DECIMAL(15, 2) NOT NULL,
    `actual_qris` DECIMAL(15, 2) NOT NULL,
    `qris_difference` DECIMAL(15, 2) NOT NULL,
    `expected_transfer` DECIMAL(15, 2) NOT NULL,
    `actual_transfer` DECIMAL(15, 2) NOT NULL,
    `transfer_difference` DECIMAL(15, 2) NOT NULL,
    `expected_bank_balances` JSON NULL,
    `actual_bank_balances` JSON NULL,
    `real_bank_balances` JSON NULL,
    `shift_expenses` JSON NULL,
    `structured_expenses` JSON NULL,
    `kasbon` JSON NULL,
    `setor_kas` JSON NULL,
    `tarik_tunai` JSON NULL,
    `tukar_transfer_ke_cash` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `additional_incomes` JSON NULL,
    `expenses_total` DECIMAL(15, 2) NOT NULL,
    `notes` TEXT NULL,
    `amended_at` DATETIME(3) NULL,
    `amend_note` TEXT NULL,
    `amend_history` JSON NULL,
    `proof_images` JSON NULL,
    `whatsapp_message` TEXT NULL,
    `payment_exchanges` JSON NULL,
    `branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shift_reports_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `print_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_number` VARCHAR(50) NOT NULL,
    `transaction_id` INTEGER NOT NULL,
    `transaction_item_id` INTEGER NOT NULL,
    `branch_id` INTEGER NULL,
    `status` ENUM('ANTRIAN', 'PROSES', 'SELESAI', 'DIAMBIL') NOT NULL DEFAULT 'ANTRIAN',
    `quantity` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `picked_up_at` DATETIME(3) NULL,
    `operator_name` VARCHAR(100) NULL,
    `co_operators` JSON NULL,
    `operator_branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `print_jobs_job_number_key`(`job_number`),
    UNIQUE INDEX `print_jobs_transaction_item_id_key`(`transaction_item_id`),
    INDEX `print_jobs_status_idx`(`status`),
    INDEX `print_jobs_transaction_id_idx`(`transaction_id`),
    INDEX `print_jobs_branch_id_idx`(`branch_id`),
    INDEX `print_jobs_operator_branch_id_idx`(`operator_branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `click_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `paper_size` ENUM('A3_PLUS', 'A4') NOT NULL,
    `color_mode` ENUM('COLOR', 'BW') NOT NULL,
    `side_mode` ENUM('SIMPLEX', 'DUPLEX') NOT NULL DEFAULT 'SIMPLEX',
    `price_per_click` DECIMAL(15, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `click_rates_paper_size_color_mode_side_mode_key`(`paper_size`, `color_mode`, `side_mode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `click_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `click_rate_id` INTEGER NOT NULL,
    `transaction_item_id` INTEGER NULL,
    `quantity` INTEGER NOT NULL,
    `price_per_click` DECIMAL(15, 2) NOT NULL,
    `total_cost` DECIMAL(15, 2) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voided_at` DATETIME(3) NULL,
    `voided_by_id` INTEGER NULL,
    `void_reason` VARCHAR(200) NULL,
    `branch_id` INTEGER NULL,

    INDEX `click_logs_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `machine_rejects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reject_type` ENUM('MACHINE_ERROR', 'TEST_PRINT', 'CALIBRATION', 'HUMAN_ERROR') NOT NULL,
    `cause` ENUM('MACHINE', 'HUMAN') NOT NULL DEFAULT 'MACHINE',
    `counter_type` ENUM('FULL_COLOR', 'BLACK', 'SINGLE_COLOR') NOT NULL DEFAULT 'FULL_COLOR',
    `quantity` INTEGER NOT NULL,
    `price_per_click` DECIMAL(15, 2) NOT NULL,
    `total_cost` DECIMAL(15, 2) NOT NULL,
    `photo_url` TEXT NULL,
    `notes` TEXT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `machine_rejects_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meter_readings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reading_date` DATE NOT NULL,
    `total_count` INTEGER NOT NULL,
    `full_color_count` INTEGER NOT NULL,
    `black_count` INTEGER NOT NULL,
    `single_color_count` INTEGER NOT NULL DEFAULT 0,
    `photo_url` TEXT NULL,
    `notes` TEXT NULL,
    `branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `meter_readings_branch_id_idx`(`branch_id`),
    UNIQUE INDEX `meter_readings_branch_id_reading_date_key`(`branch_id`, `reading_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `so_number` VARCHAR(50) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'INVOICED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `customer_id` INTEGER NULL,
    `customer_name` VARCHAR(200) NOT NULL,
    `customer_phone` VARCHAR(50) NULL,
    `customer_address` TEXT NULL,
    `designer_name` VARCHAR(100) NOT NULL,
    `branch_name` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `label` VARCHAR(120) NULL,
    `marketplace` VARCHAR(40) NULL,
    `marketplace_order_no` VARCHAR(60) NULL,
    `deadline` DATETIME(3) NULL,
    `sent_to_wa_at` DATETIME(3) NULL,
    `invoiced_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` TEXT NULL,
    `transaction_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_orders_so_number_key`(`so_number`),
    UNIQUE INDEX `sales_orders_transaction_id_key`(`transaction_id`),
    INDEX `sales_orders_status_idx`(`status`),
    INDEX `sales_orders_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `width_cm` DOUBLE NULL,
    `height_cm` DOUBLE NULL,
    `unit_type` VARCHAR(10) NULL,
    `pcs` INTEGER NULL,
    `custom_price` DOUBLE NULL,
    `note` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sales_order_items_sales_order_id_idx`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_proofs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_id` INTEGER NOT NULL,
    `filename` VARCHAR(500) NOT NULL,
    `caption` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sales_order_proofs_sales_order_id_idx`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `pin` VARCHAR(10) NOT NULL,
    `branch_name` VARCHAR(100) NULL,
    `branch_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `designers_branch_id_idx`(`branch_id`),
    INDEX `designers_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_branches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(50) NULL,
    `nota_header` TEXT NULL,
    `nota_footer` TEXT NULL,
    `logo_url` TEXT NULL,
    `daily_target_override` DECIMAL(15, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `company_branches_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_id` INTEGER NOT NULL,
    `operator_pin` VARCHAR(10) NULL,
    `wa_report_group_id` VARCHAR(200) NULL,
    `wa_broadcast_groups` JSON NULL,
    `wa_design_group_id` VARCHAR(200) NULL,
    `store_name` VARCHAR(200) NULL,
    `store_address` TEXT NULL,
    `store_phone` VARCHAR(50) NULL,
    `nota_header` TEXT NULL,
    `nota_footer` TEXT NULL,
    `logo_url` TEXT NULL,
    `titipan_fee_percent` DECIMAL(5, 2) NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `branch_settings_branch_id_key`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `printer_devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `token` VARCHAR(80) NOT NULL,
    `connection` VARCHAR(20) NOT NULL DEFAULT 'usb',
    `mode` VARCHAR(20) NOT NULL DEFAULT 'com',
    `target` VARCHAR(120) NULL,
    `last_seen_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `printer_devices_token_key`(`token`),
    INDEX `printer_devices_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transfer_number` VARCHAR(50) NOT NULL,
    `from_branch_id` INTEGER NOT NULL,
    `to_branch_id` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_transfers_transfer_number_key`(`transfer_number`),
    INDEX `stock_transfers_from_branch_id_idx`(`from_branch_id`),
    INDEX `stock_transfers_to_branch_id_idx`(`to_branch_id`),
    INDEX `stock_transfers_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfer_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transfer_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NOT NULL,
    `quantity` DECIMAL(15, 4) NOT NULL,
    `note` VARCHAR(255) NULL,

    INDEX `stock_transfer_items_transfer_id_idx`(`transfer_id`),
    INDEX `stock_transfer_items_product_variant_id_idx`(`product_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_work_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wo_number` VARCHAR(50) NOT NULL,
    `branch_id` INTEGER NOT NULL,
    `reference_number` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `proof_filename` VARCHAR(500) NULL,
    `status` ENUM('ANTRIAN', 'PROSES', 'SELESAI', 'DIBATALKAN') NOT NULL DEFAULT 'ANTRIAN',
    `received_by` VARCHAR(100) NULL,
    `cancel_reason` TEXT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `branch_work_orders_wo_number_key`(`wo_number`),
    INDEX `branch_work_orders_branch_id_idx`(`branch_id`),
    INDEX `branch_work_orders_status_idx`(`status`),
    INDEX `branch_work_orders_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_work_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `width_cm` DOUBLE NULL,
    `height_cm` DOUBLE NULL,
    `unit_type` VARCHAR(191) NULL,
    `pcs` INTEGER NULL,
    `note` TEXT NULL,
    `is_done` BOOLEAN NOT NULL DEFAULT false,

    INDEX `branch_work_order_items_work_order_id_idx`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inter_branch_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_id` INTEGER NOT NULL,
    `from_branch_id` INTEGER NOT NULL,
    `to_branch_id` INTEGER NOT NULL,
    `cost_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `service_fee` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `settled_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inter_branch_ledger_transaction_id_key`(`transaction_id`),
    INDEX `inter_branch_ledger_from_branch_id_status_idx`(`from_branch_id`, `status`),
    INDEX `inter_branch_ledger_to_branch_id_status_idx`(`to_branch_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_settlements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ledger_id` INTEGER NOT NULL,
    `settlement_type` VARCHAR(20) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `cashflow_payer_id` INTEGER NULL,
    `cashflow_payee_id` INTEGER NULL,
    `stock_movement_out_id` INTEGER NULL,
    `stock_movement_in_id` INTEGER NULL,
    `notes` TEXT NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ledger_settlements_ledger_id_idx`(`ledger_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `phone_normalized` VARCHAR(30) NULL,
    `source` ENUM('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'MARKETPLACE', 'REFERRAL', 'WEBSITE', 'WALK_IN', 'REPEAT_ORDER', 'OTHER', 'CUSTOM') NOT NULL,
    `source_detail` VARCHAR(150) NULL,
    `ctwa_clid` VARCHAR(512) NULL,
    `ad_id` VARCHAR(64) NULL,
    `ad_referral` JSON NULL,
    `ad_campaign_name` VARCHAR(200) NULL,
    `ad_label_id` INTEGER NULL,
    `status` ENUM('NEW', 'FOLLOW_UP', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'INVALID') NOT NULL DEFAULT 'NEW',
    `level` ENUM('HOT', 'WARM', 'COLD') NOT NULL DEFAULT 'WARM',
    `needs` TEXT NULL,
    `estimated_value` DECIMAL(14, 2) NULL,
    `city` VARCHAR(80) NULL,
    `assigned_to_id` INTEGER NULL,
    `follow_up_date` DATETIME(3) NULL,
    `delivery_deadline` DATETIME(3) NULL,
    `first_response_at` DATETIME(3) NULL,
    `converted_customer_id` INTEGER NULL,
    `converted_sales_order_id` INTEGER NULL,
    `converted_transaction_id` INTEGER NULL,
    `close_lost_reason` TEXT NULL,
    `designer_name` VARCHAR(100) NULL,
    `design_verdict` VARCHAR(20) NULL,
    `design_checked_at` DATETIME(3) NULL,
    `image_url` TEXT NULL,
    `branch_id` INTEGER NULL,
    `created_by_id` INTEGER NULL,
    `intake_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `closed_at` DATETIME(3) NULL,

    INDEX `leads_status_follow_up_date_idx`(`status`, `follow_up_date`),
    INDEX `leads_assigned_to_id_status_idx`(`assigned_to_id`, `status`),
    INDEX `leads_branch_id_status_idx`(`branch_id`, `status`),
    INDEX `leads_phone_normalized_idx`(`phone_normalized`),
    INDEX `leads_designer_name_status_idx`(`designer_name`, `status`),
    INDEX `leads_ad_id_idx`(`ad_id`),
    INDEX `leads_ad_label_id_idx`(`ad_label_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_source_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `normalized_name` VARCHAR(150) NOT NULL,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_source_options_normalized_name_key`(`normalized_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ad_labels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `normalized_name` VARCHAR(120) NOT NULL,
    `branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ad_labels_normalized_name_key`(`normalized_name`),
    INDEX `ad_labels_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_campaign_labels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaign_id` VARCHAR(64) NOT NULL,
    `ad_label_id` INTEGER NULL,
    `product_profit` DECIMAL(14, 2) NULL,
    `ad_account_id` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `meta_campaign_labels_campaign_id_key`(`campaign_id`),
    INDEX `meta_campaign_labels_ad_label_id_idx`(`ad_label_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_ad_maps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ad_id` VARCHAR(64) NOT NULL,
    `campaign_id` VARCHAR(64) NOT NULL,
    `campaign_name` VARCHAR(200) NULL,
    `ad_account_id` VARCHAR(64) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `meta_ad_maps_ad_id_key`(`ad_id`),
    INDEX `meta_ad_maps_campaign_id_idx`(`campaign_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NULL,
    `customer_id` INTEGER NULL,
    `kind` VARCHAR(40) NOT NULL,
    `text` TEXT NULL,
    `meta` JSON NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_activities_lead_id_created_at_idx`(`lead_id`, `created_at`),
    INDEX `lead_activities_customer_id_created_at_idx`(`customer_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `filename` VARCHAR(500) NOT NULL,
    `caption` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_images_lead_id_position_idx`(`lead_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `product_variant_id` INTEGER NULL,
    `description` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(15, 2) NOT NULL,
    `width_cm` DOUBLE NULL,
    `height_cm` DOUBLE NULL,
    `unit_type` VARCHAR(10) NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_items_lead_id_idx`(`lead_id`),
    INDEX `lead_items_product_variant_id_idx`(`product_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `body_template` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `message_templates_category_is_active_idx`(`category`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follow_ups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('LEAD_FU', 'AFTER_SALES', 'REPEAT_ORDER', 'PAYMENT_REMINDER') NOT NULL,
    `status` ENUM('PENDING', 'DONE', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `due_date` DATETIME(3) NOT NULL,
    `done_at` DATETIME(3) NULL,
    `lead_id` INTEGER NULL,
    `customer_id` INTEGER NULL,
    `assigned_to_id` INTEGER NULL,
    `branch_id` INTEGER NULL,
    `notes` TEXT NULL,
    `done_notes` TEXT NULL,
    `template_id` INTEGER NULL,
    `source_ref` VARCHAR(80) NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `follow_ups_status_due_date_idx`(`status`, `due_date`),
    INDEX `follow_ups_assigned_to_id_status_idx`(`assigned_to_id`, `status`),
    INDEX `follow_ups_branch_id_status_idx`(`branch_id`, `status`),
    INDEX `follow_ups_customer_id_type_idx`(`customer_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `synced_ops` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` VARCHAR(64) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `server_id` INTEGER NULL,
    `branch_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `synced_ops_client_id_key`(`client_id`),
    INDEX `synced_ops_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_id` INTEGER NULL,
    `name` VARCHAR(120) NOT NULL,
    `token` VARCHAR(80) NOT NULL,
    `last_sync_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `devices_token_key`(`token`),
    INDEX `devices_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_state` (
    `key` VARCHAR(60) NOT NULL,
    `value` TEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_push` (
    `client_id` VARCHAR(64) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `payload` JSON NOT NULL,
    `local_id` INTEGER NULL,
    `central_id` INTEGER NULL,
    `pushed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sync_push_pushed_at_idx`(`pushed_at`),
    PRIMARY KEY (`client_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_channels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(100) NOT NULL,
    `phone_number_id` VARCHAR(50) NOT NULL,
    `waba_id` VARCHAR(50) NOT NULL,
    `catalog_id` VARCHAR(50) NULL,
    `display_number` VARCHAR(30) NULL,
    `branch_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_channels_phone_number_id_key`(`phone_number_id`),
    INDEX `wa_channels_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wa_id` VARCHAR(30) NOT NULL,
    `phone_normalized` VARCHAR(30) NOT NULL,
    `profile_name` VARCHAR(200) NULL,
    `custom_name` VARCHAR(200) NULL,
    `lead_id` INTEGER NULL,
    `customer_id` INTEGER NULL,
    `opted_out` BOOLEAN NOT NULL DEFAULT false,
    `opted_out_at` DATETIME(3) NULL,
    `last_inbound_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_contacts_wa_id_key`(`wa_id`),
    INDEX `wa_contacts_phone_normalized_idx`(`phone_normalized`),
    INDEX `wa_contacts_lead_id_idx`(`lead_id`),
    INDEX `wa_contacts_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_conversations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NOT NULL,
    `contact_id` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'PENDING', 'SNOOZED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `assigned_to_id` INTEGER NULL,
    `last_message_at` DATETIME(3) NULL,
    `window_expires_at` DATETIME(3) NULL,
    `unread_count` INTEGER NOT NULL DEFAULT 0,
    `snoozed_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `wa_conversations_status_idx`(`status`),
    INDEX `wa_conversations_assigned_to_id_idx`(`assigned_to_id`),
    INDEX `wa_conversations_channel_id_last_message_at_idx`(`channel_id`, `last_message_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NOT NULL,
    `conversation_id` INTEGER NOT NULL,
    `contact_id` INTEGER NOT NULL,
    `wa_message_id` VARCHAR(128) NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `type` ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'STICKER', 'TEMPLATE', 'LOCATION', 'CONTACT', 'INTERACTIVE', 'UNKNOWN') NOT NULL DEFAULT 'TEXT',
    `status` ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `body` TEXT NULL,
    `template_name` VARCHAR(120) NULL,
    `media_url` TEXT NULL,
    `media_mime_type` VARCHAR(100) NULL,
    `payload_json` JSON NULL,
    `error_code` VARCHAR(40) NULL,
    `error_message` TEXT NULL,
    `sent_by_id` INTEGER NULL,
    `broadcast_id` INTEGER NULL,
    `reply_to_id` INTEGER NULL,
    `reactions_json` JSON NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_messages_wa_message_id_key`(`wa_message_id`),
    INDEX `wa_messages_conversation_id_created_at_idx`(`conversation_id`, `created_at`),
    INDEX `wa_messages_status_idx`(`status`),
    INDEX `wa_messages_broadcast_id_idx`(`broadcast_id`),
    INDEX `wa_messages_reply_to_id_idx`(`reply_to_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_webhook_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(30) NOT NULL,
    `wa_message_id` VARCHAR(128) NULL,
    `payload_json` JSON NOT NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wa_webhook_events_processed_idx`(`processed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `language` VARCHAR(10) NOT NULL DEFAULT 'id',
    `category` VARCHAR(20) NOT NULL DEFAULT 'UTILITY',
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED') NOT NULL DEFAULT 'DRAFT',
    `body_text` TEXT NOT NULL,
    `header_text` TEXT NULL,
    `footer_text` VARCHAR(120) NULL,
    `buttons_json` JSON NULL,
    `variable_sample` JSON NULL,
    `variable_labels` JSON NULL,
    `meta_template_id` VARCHAR(64) NULL,
    `submitted_waba_id` VARCHAR(50) NULL,
    `rejected_reason` TEXT NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_templates_name_language_key`(`name`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_broadcasts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `channel_id` INTEGER NOT NULL,
    `template_id` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `scheduled_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `segment_json` JSON NULL,
    `variable_map_json` JSON NULL,
    `total_count` INTEGER NOT NULL DEFAULT 0,
    `sent_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `wa_broadcasts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_broadcast_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `broadcast_id` INTEGER NOT NULL,
    `contact_id` INTEGER NOT NULL,
    `wa_id` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `wa_message_id` VARCHAR(128) NULL,
    `error_message` TEXT NULL,
    `vars_json` JSON NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wa_broadcast_recipients_status_idx`(`status`),
    UNIQUE INDEX `wa_broadcast_recipients_broadcast_id_contact_id_key`(`broadcast_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_channels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(100) NOT NULL,
    `platform` ENUM('MESSENGER', 'INSTAGRAM') NOT NULL,
    `page_id` VARCHAR(50) NOT NULL,
    `ig_id` VARCHAR(50) NULL,
    `access_token` TEXT NOT NULL,
    `branch_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_channels_platform_idx`(`platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NOT NULL,
    `platform` ENUM('MESSENGER', 'INSTAGRAM') NOT NULL,
    `external_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(200) NULL,
    `lead_id` INTEGER NULL,
    `customer_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_contacts_channel_id_external_id_key`(`channel_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_conversations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NOT NULL,
    `contact_id` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    `last_message_at` DATETIME(3) NULL,
    `unread_count` INTEGER NOT NULL DEFAULT 0,
    `assigned_to_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_conversations_channel_id_status_idx`(`channel_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NOT NULL,
    `conversation_id` INTEGER NOT NULL,
    `contact_id` INTEGER NOT NULL,
    `external_id` VARCHAR(255) NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    `body` TEXT NULL,
    `media_url` TEXT NULL,
    `sent_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_messages_conversation_id_id_idx`(`conversation_id`, `id`),
    UNIQUE INDEX `social_messages_external_id_key`(`external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NOT NULL,
    `external_id` VARCHAR(128) NOT NULL,
    `caption` TEXT NULL,
    `permalink` TEXT NULL,
    `media_url` TEXT NULL,
    `posted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_posts_channel_id_external_id_key`(`channel_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NOT NULL,
    `post_id` INTEGER NOT NULL,
    `root_id` INTEGER NULL,
    `external_id` VARCHAR(128) NOT NULL,
    `author_external_id` VARCHAR(64) NULL,
    `author_name` VARCHAR(200) NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `body` TEXT NULL,
    `is_hidden` BOOLEAN NOT NULL DEFAULT false,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `private_reply_at` DATETIME(3) NULL,
    `sent_by_id` INTEGER NULL,
    `commented_at` DATETIME(3) NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT true,
    `needs_reply` BOOLEAN NOT NULL DEFAULT false,
    `last_activity_at` DATETIME(3) NULL,
    `lead_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_comments_root_id_last_activity_at_idx`(`root_id`, `last_activity_at`),
    INDEX `social_comments_channel_id_root_id_is_read_idx`(`channel_id`, `root_id`, `is_read`),
    UNIQUE INDEX `social_comments_channel_id_external_id_key`(`channel_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_qr_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `channel_id` INTEGER NULL,
    `source` VARCHAR(30) NOT NULL,
    `source_detail` VARCHAR(150) NULL,
    `prefill_text` TEXT NOT NULL,
    `scan_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_qr_links_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_config` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `access_token` TEXT NULL,
    `ad_account_id` VARCHAR(64) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_quick_replies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shortcut` VARCHAR(60) NOT NULL,
    `title` VARCHAR(120) NULL,
    `body` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_quick_replies_shortcut_key`(`shortcut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_auto_reply_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NULL,
    `trigger` ENUM('KEYWORD', 'GREETING', 'AWAY', 'DEFAULT') NOT NULL,
    `keywords` JSON NULL,
    `reply_text` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `wa_auto_reply_rules_channel_id_is_active_idx`(`channel_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_reminder_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(30) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `channel_id` INTEGER NULL,
    `template_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_reminder_configs_event_type_key`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_reminder_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(30) NOT NULL,
    `ref_id` INTEGER NOT NULL,
    `contact_id` INTEGER NULL,
    `wa_message_id` VARCHAR(128) NULL,
    `status` VARCHAR(20) NOT NULL,
    `detail` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wa_reminder_logs_event_type_ref_id_key`(`event_type`, `ref_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `frequency` VARCHAR(20) NOT NULL,
    `days_of_week` VARCHAR(20) NULL,
    `day_of_month` INTEGER NULL,
    `skip_weekends` BOOLEAN NOT NULL DEFAULT false,
    `time_of_day` VARCHAR(5) NULL,
    `priority` VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `shift_slot` VARCHAR(10) NULL,
    `rotation_user_ids` VARCHAR(255) NULL,
    `assignee_id` INTEGER NULL,
    `group_id` INTEGER NULL,
    `target_role` VARCHAR(20) NULL,
    `target_all` BOOLEAN NOT NULL DEFAULT false,
    `branch_id` INTEGER NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_schedules_branch_id_idx`(`branch_id`),
    INDEX `task_schedules_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schedule_id` INTEGER NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `priority` VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    `status` VARCHAR(20) NOT NULL DEFAULT 'TODO',
    `index` INTEGER NOT NULL DEFAULT 0,
    `period_key` VARCHAR(20) NULL,
    `due_date` DATETIME(3) NULL,
    `note` TEXT NULL,
    `image_urls` TEXT NULL,
    `assignee_id` INTEGER NULL,
    `branch_id` INTEGER NULL,
    `completed_at` DATETIME(3) NULL,
    `completed_by` INTEGER NULL,
    `verified_by_owner_at` DATETIME(3) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_items_branch_id_status_idx`(`branch_id`, `status`),
    INDEX `task_items_assignee_id_status_idx`(`assignee_id`, `status`),
    UNIQUE INDEX `task_items_schedule_id_assignee_id_period_key_key`(`schedule_id`, `assignee_id`, `period_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `branch_id` INTEGER NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_groups_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_group_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,

    UNIQUE INDEX `task_group_members_group_id_user_id_key`(`group_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_shift_checkins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `branch_id` INTEGER NULL,
    `date_key` VARCHAR(10) NOT NULL,
    `shift` VARCHAR(10) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_shift_checkins_branch_id_date_key_idx`(`branch_id`, `date_key`),
    UNIQUE INDEX `task_shift_checkins_user_id_date_key_key`(`user_id`, `date_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_warnings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `branch_id` INTEGER NULL,
    `date_key` VARCHAR(10) NOT NULL,
    `kind` VARCHAR(10) NOT NULL,
    `task_item_id` INTEGER NULL,
    `message` TEXT NOT NULL,
    `created_by` INTEGER NULL,
    `created_by_name` VARCHAR(100) NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_warnings_user_id_acknowledged_at_idx`(`user_id`, `acknowledged_at`),
    INDEX `task_warnings_branch_id_date_key_idx`(`branch_id`, `date_key`),
    UNIQUE INDEX `task_warnings_kind_task_item_id_key`(`kind`, `task_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_production_category_id_fkey` FOREIGN KEY (`production_category_id`) REFERENCES `production_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_click_rate_id_fkey` FOREIGN KEY (`click_rate_id`) REFERENCES `click_rates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_click_rate_id_fkey` FOREIGN KEY (`click_rate_id`) REFERENCES `click_rates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_stocks` ADD CONSTRAINT `branch_stocks_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_stocks` ADD CONSTRAINT `branch_stocks_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingredients` ADD CONSTRAINT `ingredients_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingredients` ADD CONSTRAINT `ingredients_raw_material_variant_id_fkey` FOREIGN KEY (`raw_material_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batches` ADD CONSTRAINT `batches_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batches` ADD CONSTRAINT `batches_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_production_branch_id_fkey` FOREIGN KEY (`production_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_items` ADD CONSTRAINT `transaction_items_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_items` ADD CONSTRAINT `transaction_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashflows` ADD CONSTRAINT `cashflows_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashflows` ADD CONSTRAINT `cashflows_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashflows` ADD CONSTRAINT `cashflows_shift_report_id_fkey` FOREIGN KEY (`shift_report_id`) REFERENCES `shift_reports`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashflows` ADD CONSTRAINT `cashflows_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashflow_change_requests` ADD CONSTRAINT `cashflow_change_requests_cashflow_id_fkey` FOREIGN KEY (`cashflow_id`) REFERENCES `cashflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashflow_change_requests` ADD CONSTRAINT `cashflow_change_requests_requester_id_fkey` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashflow_change_requests` ADD CONSTRAINT `cashflow_change_requests_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_edit_requests` ADD CONSTRAINT `transaction_edit_requests_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_edit_requests` ADD CONSTRAINT `transaction_edit_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_edit_requests` ADD CONSTRAINT `transaction_edit_requests_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hpp_worksheets` ADD CONSTRAINT `hpp_worksheets_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hpp_worksheets` ADD CONSTRAINT `hpp_worksheets_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hpp_variable_costs` ADD CONSTRAINT `hpp_variable_costs_worksheet_id_fkey` FOREIGN KEY (`worksheet_id`) REFERENCES `hpp_worksheets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hpp_variable_costs` ADD CONSTRAINT `hpp_variable_costs_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hpp_fixed_costs` ADD CONSTRAINT `hpp_fixed_costs_worksheet_id_fkey` FOREIGN KEY (`worksheet_id`) REFERENCES `hpp_worksheets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_assigned_cs_id_fkey` FOREIGN KEY (`assigned_cs_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_referrer_customer_id_fkey` FOREIGN KEY (`referrer_customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cs_rating_configs` ADD CONSTRAINT `cs_rating_configs_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cs_rating_responses` ADD CONSTRAINT `cs_rating_responses_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cs_rating_responses` ADD CONSTRAINT `cs_rating_responses_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cs_rating_responses` ADD CONSTRAINT `cs_rating_responses_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cs_rating_responses` ADD CONSTRAINT `cs_rating_responses_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cs_rating_responses` ADD CONSTRAINT `cs_rating_responses_assigned_cs_id_fkey` FOREIGN KEY (`assigned_cs_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_opname_sessions` ADD CONSTRAINT `stock_opname_sessions_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_opname_sessions` ADD CONSTRAINT `stock_opname_sessions_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_opname_items` ADD CONSTRAINT `stock_opname_items_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `stock_opname_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_opname_items` ADD CONSTRAINT `stock_opname_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_jobs` ADD CONSTRAINT `production_jobs_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_jobs` ADD CONSTRAINT `production_jobs_transaction_item_id_fkey` FOREIGN KEY (`transaction_item_id`) REFERENCES `transaction_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_jobs` ADD CONSTRAINT `production_jobs_roll_variant_id_fkey` FOREIGN KEY (`roll_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_jobs` ADD CONSTRAINT `production_jobs_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `production_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_jobs` ADD CONSTRAINT `production_jobs_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jersey_work_orders` ADD CONSTRAINT `jersey_work_orders_production_job_id_fkey` FOREIGN KEY (`production_job_id`) REFERENCES `production_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_job_proofs` ADD CONSTRAINT `production_job_proofs_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `production_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_batches` ADD CONSTRAINT `production_batches_roll_variant_id_fkey` FOREIGN KEY (`roll_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_items` ADD CONSTRAINT `supplier_items_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_items` ADD CONSTRAINT `supplier_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_purchases` ADD CONSTRAINT `stock_purchases_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_purchases` ADD CONSTRAINT `stock_purchases_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_purchase_items` ADD CONSTRAINT `stock_purchase_items_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `stock_purchases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_purchase_items` ADD CONSTRAINT `stock_purchase_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_price_tiers` ADD CONSTRAINT `variant_price_tiers_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_ingredients` ADD CONSTRAINT `variant_ingredients_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_ingredients` ADD CONSTRAINT `variant_ingredients_raw_material_variant_id_fkey` FOREIGN KEY (`raw_material_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_reports` ADD CONSTRAINT `shift_reports_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_transaction_item_id_fkey` FOREIGN KEY (`transaction_item_id`) REFERENCES `transaction_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `click_logs` ADD CONSTRAINT `click_logs_click_rate_id_fkey` FOREIGN KEY (`click_rate_id`) REFERENCES `click_rates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `click_logs` ADD CONSTRAINT `click_logs_transaction_item_id_fkey` FOREIGN KEY (`transaction_item_id`) REFERENCES `transaction_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `click_logs` ADD CONSTRAINT `click_logs_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `machine_rejects` ADD CONSTRAINT `machine_rejects_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meter_readings` ADD CONSTRAINT `meter_readings_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_order_proofs` ADD CONSTRAINT `sales_order_proofs_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_settings` ADD CONSTRAINT `branch_settings_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `printer_devices` ADD CONSTRAINT `printer_devices_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_from_branch_id_fkey` FOREIGN KEY (`from_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_to_branch_id_fkey` FOREIGN KEY (`to_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_transfer_id_fkey` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_work_orders` ADD CONSTRAINT `branch_work_orders_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_work_order_items` ADD CONSTRAINT `branch_work_order_items_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `branch_work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_work_order_items` ADD CONSTRAINT `branch_work_order_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inter_branch_ledger` ADD CONSTRAINT `inter_branch_ledger_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inter_branch_ledger` ADD CONSTRAINT `inter_branch_ledger_from_branch_id_fkey` FOREIGN KEY (`from_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inter_branch_ledger` ADD CONSTRAINT `inter_branch_ledger_to_branch_id_fkey` FOREIGN KEY (`to_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_settlements` ADD CONSTRAINT `ledger_settlements_ledger_id_fkey` FOREIGN KEY (`ledger_id`) REFERENCES `inter_branch_ledger`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_converted_customer_id_fkey` FOREIGN KEY (`converted_customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_converted_sales_order_id_fkey` FOREIGN KEY (`converted_sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_ad_label_id_fkey` FOREIGN KEY (`ad_label_id`) REFERENCES `ad_labels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ad_labels` ADD CONSTRAINT `ad_labels_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_campaign_labels` ADD CONSTRAINT `meta_campaign_labels_ad_label_id_fkey` FOREIGN KEY (`ad_label_id`) REFERENCES `ad_labels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_images` ADD CONSTRAINT `lead_images_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_items` ADD CONSTRAINT `lead_items_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_items` ADD CONSTRAINT `lead_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `message_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_channels` ADD CONSTRAINT `wa_channels_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_contacts` ADD CONSTRAINT `wa_contacts_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_contacts` ADD CONSTRAINT `wa_contacts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_conversations` ADD CONSTRAINT `wa_conversations_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `wa_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_conversations` ADD CONSTRAINT `wa_conversations_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `wa_contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_conversations` ADD CONSTRAINT `wa_conversations_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_messages` ADD CONSTRAINT `wa_messages_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `wa_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_messages` ADD CONSTRAINT `wa_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `wa_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_messages` ADD CONSTRAINT `wa_messages_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `wa_contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_messages` ADD CONSTRAINT `wa_messages_sent_by_id_fkey` FOREIGN KEY (`sent_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_messages` ADD CONSTRAINT `wa_messages_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `wa_broadcasts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_messages` ADD CONSTRAINT `wa_messages_reply_to_id_fkey` FOREIGN KEY (`reply_to_id`) REFERENCES `wa_messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_broadcasts` ADD CONSTRAINT `wa_broadcasts_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `wa_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_broadcasts` ADD CONSTRAINT `wa_broadcasts_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `wa_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_broadcast_recipients` ADD CONSTRAINT `wa_broadcast_recipients_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `wa_broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_broadcast_recipients` ADD CONSTRAINT `wa_broadcast_recipients_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `wa_contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_channels` ADD CONSTRAINT `social_channels_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_contacts` ADD CONSTRAINT `social_contacts_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `social_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_contacts` ADD CONSTRAINT `social_contacts_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_contacts` ADD CONSTRAINT `social_contacts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_conversations` ADD CONSTRAINT `social_conversations_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `social_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_conversations` ADD CONSTRAINT `social_conversations_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `social_contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_conversations` ADD CONSTRAINT `social_conversations_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_messages` ADD CONSTRAINT `social_messages_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `social_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_messages` ADD CONSTRAINT `social_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `social_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_messages` ADD CONSTRAINT `social_messages_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `social_contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_messages` ADD CONSTRAINT `social_messages_sent_by_id_fkey` FOREIGN KEY (`sent_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `social_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_comments` ADD CONSTRAINT `social_comments_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `social_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_comments` ADD CONSTRAINT `social_comments_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_comments` ADD CONSTRAINT `social_comments_root_id_fkey` FOREIGN KEY (`root_id`) REFERENCES `social_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_comments` ADD CONSTRAINT `social_comments_sent_by_id_fkey` FOREIGN KEY (`sent_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_comments` ADD CONSTRAINT `social_comments_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_schedules` ADD CONSTRAINT `task_schedules_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_schedules` ADD CONSTRAINT `task_schedules_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `task_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_schedules` ADD CONSTRAINT `task_schedules_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_schedules` ADD CONSTRAINT `task_schedules_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_items` ADD CONSTRAINT `task_items_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `task_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_items` ADD CONSTRAINT `task_items_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_items` ADD CONSTRAINT `task_items_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_items` ADD CONSTRAINT `task_items_completed_by_fkey` FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_groups` ADD CONSTRAINT `task_groups_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_group_members` ADD CONSTRAINT `task_group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `task_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_group_members` ADD CONSTRAINT `task_group_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

