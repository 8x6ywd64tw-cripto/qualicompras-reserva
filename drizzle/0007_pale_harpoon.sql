CREATE TABLE `price_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productUnit` varchar(50) NOT NULL,
	`maxPrice` decimal(10,2) NOT NULL,
	`category` varchar(100),
	`unitId` int,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `proposal_items` ADD `packagingType` enum('unidade','caixa','fardo','pacote') DEFAULT 'unidade';--> statement-breakpoint
ALTER TABLE `proposal_items` ADD `unitsPerPackage` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `proposal_items` ADD `unitPriceNormalized` decimal(12,4);--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `packagingType` varchar(20);--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `unitsPerPackage` int;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `purchaseGroupId` varchar(50);