CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('price_anomaly','doc_expired','no_response','curve_a_rupture') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`relatedEntityType` varchar(50),
	`relatedEntityId` int,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`details` json,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`supplierId` int NOT NULL,
	`ratedBy` int NOT NULL,
	`punctuality` int NOT NULL,
	`quality` int NOT NULL,
	`quantity` int NOT NULL,
	`service` int NOT NULL,
	`overallScore` decimal(3,2) NOT NULL,
	`comments` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_references` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(500) NOT NULL,
	`region` varchar(100),
	`minPrice` decimal(12,2) NOT NULL,
	`maxPrice` decimal(12,2) NOT NULL,
	`avgPrice` decimal(12,2) NOT NULL,
	`source` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_references_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposal_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`quotationItemId` int NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`totalPrice` decimal(14,2) NOT NULL,
	`brand` varchar(255),
	`notes` text,
	CONSTRAINT `proposal_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`supplierId` int NOT NULL,
	`totalValue` decimal(14,2),
	`deliveryDays` int,
	`paymentTerms` varchar(255),
	`notes` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productName` varchar(500) NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`unit` varchar(20) NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`totalPrice` decimal(14,2) NOT NULL,
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`quotationId` int,
	`proposalId` int,
	`supplierId` int NOT NULL,
	`unitId` int,
	`createdBy` int NOT NULL,
	`approvedBy` int,
	`totalValue` decimal(14,2) NOT NULL,
	`status` enum('pending_approval','approved','sent','delivered','cancelled') NOT NULL DEFAULT 'pending_approval',
	`approvedAt` timestamp,
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_orders_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `quotation_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`productName` varchar(500) NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`unit` varchar(20) NOT NULL,
	`category` varchar(100),
	`curveClass` enum('A','B','C'),
	`referencePrice` decimal(12,2),
	CONSTRAINT `quotation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotation_suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`supplierId` int NOT NULL,
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	`status` enum('pending','responded','declined') NOT NULL DEFAULT 'pending',
	CONSTRAINT `quotation_suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`title` varchar(500) NOT NULL,
	`unitId` int,
	`createdBy` int NOT NULL,
	`status` enum('draft','open','closed','cancelled') NOT NULL DEFAULT 'draft',
	`deadline` timestamp,
	`notes` text,
	`publicToken` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `quotations_code_unique` UNIQUE(`code`),
	CONSTRAINT `quotations_publicToken_unique` UNIQUE(`publicToken`)
);
--> statement-breakpoint
CREATE TABLE `supplier_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`docType` varchar(100) NOT NULL,
	`docName` varchar(255) NOT NULL,
	`fileUrl` text,
	`expiresAt` timestamp,
	`status` enum('valid','expiring','expired') NOT NULL DEFAULT 'valid',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplier_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cnpj` varchar(18),
	`companyName` varchar(500) NOT NULL,
	`tradeName` varchar(500),
	`contactName` varchar(255),
	`phone` varchar(20),
	`email` varchar(320),
	`whatsapp` varchar(20),
	`state` varchar(2),
	`city` varchar(255),
	`address` text,
	`categories` json,
	`reliabilityScore` enum('green','yellow','red') NOT NULL DEFAULT 'yellow',
	`avgRating` decimal(3,2) DEFAULT '0',
	`totalDeliveries` int DEFAULT 0,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`state` varchar(2) NOT NULL,
	`city` varchar(255) NOT NULL,
	`address` text,
	`costCenter` varchar(100),
	`contactName` varchar(255),
	`contactPhone` varchar(20),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','comprador','aprovador') NOT NULL DEFAULT 'comprador';