CREATE TABLE `fortes_requisitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`unitName` varchar(255),
	`unitId` int,
	`requestedBy` varchar(255) NOT NULL,
	`notes` text,
	`urgency` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`items` json NOT NULL,
	`status` enum('pending','processing','converted','cancelled') NOT NULL DEFAULT 'pending',
	`quotationId` int,
	`processedBy` int,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fortes_requisitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `fortes_requisitions_code_unique` UNIQUE(`code`)
);
