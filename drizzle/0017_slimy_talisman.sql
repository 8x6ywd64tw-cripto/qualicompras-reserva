CREATE TABLE `order_edit_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`itemId` int,
	`requestType` enum('change_quantity','add_item','remove_item') NOT NULL,
	`requestedBy` int NOT NULL,
	`requestedByName` varchar(255),
	`requestedByEmail` varchar(320),
	`currentValue` text,
	`newValue` text,
	`justification` text NOT NULL,
	`editRequestStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approvalToken` varchar(100),
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_edit_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_edit_requests_approvalToken_unique` UNIQUE(`approvalToken`)
);
