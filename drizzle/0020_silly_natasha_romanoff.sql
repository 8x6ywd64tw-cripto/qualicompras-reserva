ALTER TABLE `suppliers` ADD `quotationBlocked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `quotationBlockedReason` varchar(500);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `quotationBlockedAt` timestamp;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `quotationBlockedBy` varchar(200);