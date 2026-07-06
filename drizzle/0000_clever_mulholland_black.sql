CREATE TABLE `check_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`child_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by_id` text NOT NULL,
	`confirmed_by_id` text,
	`confirmed_at` integer,
	`auto_confirmed` integer DEFAULT false NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `check_ins_habit_date_unique` ON `check_ins` (`habit_id`,`date`);--> statement-breakpoint
CREATE INDEX `check_ins_child_date_idx` ON `check_ins` (`child_id`,`date`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `families_code_unique` ON `families` (`code`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`bonus_stars` integer DEFAULT 0 NOT NULL,
	`target_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_at` integer,
	`completed_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '⭐' NOT NULL,
	`description` text,
	`schedule_type` text DEFAULT 'daily' NOT NULL,
	`schedule_days` text,
	`times_per_week` integer,
	`reward_mode` text DEFAULT 'stars' NOT NULL,
	`stars_per_completion` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `penalty_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`max_stars` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`agreed_at` integer,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`name` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`stage_at_creation` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_one_active_per_child` ON `plans` (`child_id`) WHERE "plans"."status" = 'active';--> statement-breakpoint
CREATE TABLE `redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`reward_id` text NOT NULL,
	`cost_stars` integer NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	`decided_by_id` text,
	FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🎁' NOT NULL,
	`description` text,
	`cost_stars` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `star_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`check_in_id` text,
	`habit_id` text,
	`goal_id` text,
	`plan_id` text,
	`redemption_id` text,
	`rule_id` text,
	`reverses_id` text,
	`occurred_on` text NOT NULL,
	`note` text,
	`created_by_id` text,
	`confirmed_by_id` text,
	`confirmed_at` integer,
	`auto_confirmed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`check_in_id`) REFERENCES `check_ins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redemption_id`) REFERENCES `redemptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_id`) REFERENCES `penalty_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reverses_id`) REFERENCES `star_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "star_tx_positive_types" CHECK("star_transactions"."type" NOT IN ('earn', 'bonus') OR "star_transactions"."amount" > 0),
	CONSTRAINT "star_tx_negative_types" CHECK("star_transactions"."type" NOT IN ('penalty', 'redeem') OR "star_transactions"."amount" < 0),
	CONSTRAINT "star_tx_penalty_needs_rule" CHECK("star_transactions"."type" != 'penalty' OR ("star_transactions"."rule_id" IS NOT NULL AND "star_transactions"."note" IS NOT NULL)),
	CONSTRAINT "star_tx_reversal_needs_target" CHECK("star_transactions"."type" != 'reversal' OR "star_transactions"."reverses_id" IS NOT NULL),
	CONSTRAINT "star_tx_redeem_needs_redemption" CHECK("star_transactions"."type" != 'redeem' OR "star_transactions"."redemption_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `star_tx_check_in_unique` ON `star_transactions` (`check_in_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `star_tx_reverses_unique` ON `star_transactions` (`reverses_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `star_tx_earn_once_per_day` ON `star_transactions` (`child_id`,`habit_id`,`occurred_on`) WHERE "star_transactions"."type" = 'earn';--> statement-breakpoint
CREATE INDEX `star_tx_child_idx` ON `star_transactions` (`child_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text DEFAULT '⭐' NOT NULL,
	`locale` text DEFAULT 'zh' NOT NULL,
	`email` text,
	`password_hash` text,
	`pin_hash` text,
	`stage` text,
	`birthdate` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "users_guardian_has_email" CHECK("users"."role" != 'guardian' OR "users"."email" IS NOT NULL),
	CONSTRAINT "users_child_has_stage" CHECK("users"."role" != 'child' OR "users"."stage" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`) WHERE "users"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_family_name_unique` ON `users` (`family_id`,`name`);--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`week_start` text NOT NULL,
	`plan_id` text,
	`parent_note` text,
	`child_note` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_reviews_child_week` ON `weekly_reviews` (`child_id`,`week_start`);