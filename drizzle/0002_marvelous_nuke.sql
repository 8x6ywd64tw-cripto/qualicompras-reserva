CREATE TABLE `supplier_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`unitId` int NOT NULL,
	`responsavelNaUnidade` varchar(255),
	`escriturario` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplier_units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `suppliers` ADD `deliveryMode` varchar(255);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `paymentTerms` varchar(255);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `responsavelContato` varchar(255);