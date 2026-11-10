CREATE TYPE "public"."estado_turno" AS ENUM('confirmado', 'cancelado', 'completado');--> statement-breakpoint
CREATE TABLE "materia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materia_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "profesor_materia" (
	"profesor_id" uuid NOT NULL,
	"materia_id" uuid NOT NULL,
	"habilitado" boolean DEFAULT true NOT NULL,
	"activo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profesor_materia_profesor_id_materia_id_pk" PRIMARY KEY("profesor_id","materia_id")
);
--> statement-breakpoint
CREATE TABLE "regla_disponibilidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profesor_id" uuid NOT NULL,
	"dia_semana" smallint NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dia_semana_valido" CHECK ("regla_disponibilidad"."dia_semana" between 1 and 7),
	CONSTRAINT "rango_horario_valido" CHECK ("regla_disponibilidad"."hora_fin" > "regla_disponibilidad"."hora_inicio")
);
--> statement-breakpoint
CREATE TABLE "turno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profesor_id" uuid NOT NULL,
	"alumno_id" uuid NOT NULL,
	"materia_id" uuid NOT NULL,
	"inicia_en" timestamp with time zone NOT NULL,
	"termina_en" timestamp with time zone NOT NULL,
	"estado" "estado_turno" DEFAULT 'confirmado' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rango_turno_valido" CHECK ("turno"."termina_en" > "turno"."inicia_en"),
	CONSTRAINT "alumno_no_es_profesor" CHECK ("turno"."alumno_id" <> "turno"."profesor_id")
);
--> statement-breakpoint
ALTER TABLE "profesor_materia" ADD CONSTRAINT "profesor_materia_profesor_id_user_id_fk" FOREIGN KEY ("profesor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesor_materia" ADD CONSTRAINT "profesor_materia_materia_id_materia_id_fk" FOREIGN KEY ("materia_id") REFERENCES "public"."materia"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regla_disponibilidad" ADD CONSTRAINT "regla_disponibilidad_profesor_id_user_id_fk" FOREIGN KEY ("profesor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno" ADD CONSTRAINT "turno_profesor_id_user_id_fk" FOREIGN KEY ("profesor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno" ADD CONSTRAINT "turno_alumno_id_user_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno" ADD CONSTRAINT "turno_materia_id_materia_id_fk" FOREIGN KEY ("materia_id") REFERENCES "public"."materia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno" ADD CONSTRAINT "turno_profesor_materia_fk" FOREIGN KEY ("profesor_id","materia_id") REFERENCES "public"."profesor_materia"("profesor_id","materia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "regla_disponibilidad_profesor_idx" ON "regla_disponibilidad" USING btree ("profesor_id");--> statement-breakpoint
CREATE INDEX "turno_alumno_idx" ON "turno" USING btree ("alumno_id");