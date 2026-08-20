CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(50) NOT NULL,
	`inAppEnabled` boolean NOT NULL DEFAULT true,
	`pushEnabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_delivery_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`itemId` int,
	`productName` varchar(500) NOT NULL,
	`adjustmentType` enum('removed','quantity_reduced') NOT NULL,
	`oldQuantity` decimal(12,3),
	`newQuantity` decimal(12,3),
	`oldUnitPrice` decimal(12,2),
	`justification` text NOT NULL,
	`invoicePhotoUrl` varchar(1000) NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(200) NOT NULL,
	`userEmail` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_delivery_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`userAgent` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('supplier_response','quotation_ready','order_generated','order_cancelled','quotation_reopened','price_alert','delivery_adjusted','no_response_48h','doc_expired','system') NOT NULL,
	`title` varchar(500) NOT NULL,
	`message` text,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`relatedEntityType` varchar(50),
	`relatedEntityId` int,
	`actionUrl` varchar(500),
	`readAt` timestamp,
	`dedupeKey` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `period` varchar(50);--> statement-breakpoint
ALTER TABLE `quotations` ADD `reopenCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quotations` ADD `lastReopenedAt` timestamp;--> statement-breakpoint
ALTER TABLE `quotations` ADD `lastReopenedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `quotations` ADD `lastReopenReason` text;--> statement-breakpoint
ALTER TABLE `quotations` ADD `coletaNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `supplierType` varchar(50) DEFAULT 'outro';--> statement-breakpoint
ALTER TABLE `units` ADD `fortesEmpresa` varchar(10);--> statement-breakpoint
ALTER TABLE `units` ADD `fortesEstabelecimento` varchar(10);