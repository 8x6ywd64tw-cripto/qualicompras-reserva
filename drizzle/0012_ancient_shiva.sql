CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`normalizedName` varchar(200) NOT NULL,
	`brandStatus` enum('approved','unknown','rejected') NOT NULL DEFAULT 'unknown',
	`reason` text,
	`category` varchar(100),
	`addedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
