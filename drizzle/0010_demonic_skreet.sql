CREATE TABLE `fortes_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(500) NOT NULL,
	`itemGroup` varchar(100),
	`unit` varchar(20),
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `fortes_items_id` PRIMARY KEY(`id`)
);
