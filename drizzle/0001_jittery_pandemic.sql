PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
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
	CONSTRAINT "users_guardian_has_email" CHECK("__new_users"."role" != 'guardian' OR "__new_users"."email" IS NOT NULL),
	CONSTRAINT "users_guardian_has_password" CHECK("__new_users"."role" != 'guardian' OR "__new_users"."password_hash" IS NOT NULL),
	CONSTRAINT "users_child_has_stage" CHECK("__new_users"."role" != 'child' OR "__new_users"."stage" IS NOT NULL),
	CONSTRAINT "users_child_has_pin" CHECK("__new_users"."role" != 'child' OR "__new_users"."pin_hash" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "family_id", "role", "name", "avatar", "locale", "email", "password_hash", "pin_hash", "stage", "birthdate", "created_at") SELECT "id", "family_id", "role", "name", "avatar", "locale", "email", "password_hash", "pin_hash", "stage", "birthdate", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`) WHERE "users"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_family_name_unique` ON `users` (`family_id`,`name`);