CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE IF NOT EXISTS staging.players_raw (doc jsonb);
CREATE TABLE IF NOT EXISTS staging.games_raw   (doc jsonb);
CREATE TABLE IF NOT EXISTS staging.teams_raw   (doc jsonb);