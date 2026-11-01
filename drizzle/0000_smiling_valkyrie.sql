CREATE TABLE "ping" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"n" bigint DEFAULT 0 NOT NULL,
	"last_ping_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ping_id_check" CHECK ("ping"."id" = 1)
);
