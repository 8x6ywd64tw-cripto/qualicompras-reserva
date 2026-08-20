CREATE TABLE `price_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(500) NOT NULL,
	`productCode` varchar(50),
	`supplierId` int NOT NULL,
	`supplierName` varchar(255),
	`unitId` int,
	`unitName` varchar(255),
	`unitPrice` decimal(12,2) NOT NULL,
	`quantity` decimal(12,3),
	`unit` varchar(20),
	`quotationId` int,
	`orderId` int,
	`source` varchar(50) DEFAULT 'proposal',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
ALTER TABLE `alerts` MODIFY COLUMN `type` enum('price_anomaly','doc_expired','no_response','curve_a_rupture','supplier_response','price_increase') NOT NULL;--> statement-breakpoint
ALTER TABLE `alerts` MODIFY COLUMN `severity` enum('low','medium','high','critical','info') NOT NULL DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `userEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `units` ADD `latitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `units` ADD `longitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `quotation_items` ADD CONSTRAINT `uq_quotation_product` UNIQUE(`quotationId`,`productName`);