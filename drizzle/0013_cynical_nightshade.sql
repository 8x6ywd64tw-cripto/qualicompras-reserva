CREATE TABLE `brand_registry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(500) NOT NULL,
	`brand` varchar(200) NOT NULL,
	`brandNormalized` varchar(200) NOT NULL,
	`supplierId` int,
	`supplierName` varchar(300),
	`sector` varchar(100),
	`unitId` int,
	`unitName` varchar(200),
	`lastUsedAt` bigint NOT NULL,
	`usageCount` int NOT NULL DEFAULT 1,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `brand_registry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_rejections_global` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`brandNormalized` varchar(255) NOT NULL,
	`productCategory` varchar(255),
	`reason` text,
	`createdBy` int,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_rejections_global_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_rejections_unit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`brandNormalized` varchar(255) NOT NULL,
	`unitId` int NOT NULL,
	`unitName` varchar(255),
	`productCategory` varchar(255),
	`reason` text,
	`createdBy` int,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_rejections_unit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historical_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierName` varchar(500) NOT NULL,
	`tradeName` varchar(500),
	`unitName` varchar(255) NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`entryDate` varchar(10) NOT NULL,
	`category` enum('alimentos','combustivel','energia','transporte','servicos','pessoa_fisica','outros') NOT NULL DEFAULT 'outros',
	`source` varchar(100) DEFAULT 'fortes_cap',
	`importBatch` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historical_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`userEmail` varchar(320),
	`ipAddress` varchar(45) NOT NULL,
	`userAgent` text,
	`loginAt` timestamp NOT NULL DEFAULT (now()),
	`suspicious` boolean NOT NULL DEFAULT false,
	`suspiciousReason` text,
	CONSTRAINT `login_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `preferred_suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`unitId` int,
	`tolerancePct` decimal(4,2) NOT NULL DEFAULT '3.00',
	`reason` varchar(255),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `preferred_suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`userId` int,
	`userName` varchar(255),
	`description` text NOT NULL,
	`details` text,
	`ipAddress` varchar(45),
	`userAgent` text,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedBy` varchar(255),
	`resolvedAt` timestamp,
	`notifiedOwner` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` MODIFY COLUMN `userId` int;--> statement-breakpoint
ALTER TABLE `audit_logs` MODIFY COLUMN `details` text;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','comprador','aprovador','buyer_senior','cotador') NOT NULL DEFAULT 'comprador';--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `userRole` varchar(64);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `resource` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `resourceId` varchar(100);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `userAgent` text;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `sessionFingerprint` varchar(64);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `severity` enum('info','warning','critical') DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE `price_history` ADD `brand` varchar(255);--> statement-breakpoint
ALTER TABLE `price_history` ADD `sector` varchar(100);--> statement-breakpoint
ALTER TABLE `price_history` ADD `weekNumber` int;--> statement-breakpoint
ALTER TABLE `price_history` ADD `weekLabel` varchar(30);--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `brand` varchar(200);--> statement-breakpoint
ALTER TABLE `audit_logs` DROP COLUMN `userEmail`;--> statement-breakpoint
ALTER TABLE `audit_logs` DROP COLUMN `entityType`;--> statement-breakpoint
ALTER TABLE `audit_logs` DROP COLUMN `entityId`;