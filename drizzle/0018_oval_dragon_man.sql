CREATE TABLE `nf_validations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`aiExtractedData` json,
	`matchResult` json,
	`nfValidationStatus` enum('pending','validated','partial','rejected','emergency_generated') NOT NULL DEFAULT 'pending',
	`confidence` varchar(20) DEFAULT 'pending',
	`validatedBy` int,
	`validatedByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nf_validations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_product_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`supplierName` varchar(300),
	`nfProductName` varchar(500) NOT NULL,
	`nfProductNameNormalized` varchar(500) NOT NULL,
	`systemProductName` varchar(500) NOT NULL,
	`confidence` decimal(5,2) DEFAULT '1.00',
	`usageCount` int NOT NULL DEFAULT 1,
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_product_mappings_id` PRIMARY KEY(`id`)
);
