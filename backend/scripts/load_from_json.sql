BEGIN;

-- 1) Clear staging
TRUNCATE staging.players_raw;
TRUNCATE staging.games_raw;
TRUNCATE staging.teams_raw;

\set ON_ERROR_STOP on

-- sanity checks: show where psql thinks it is and that the file exists
\! pwd
\! ls -l raw_data/games.json

-- use the shell to feed the file (path resolution now matches your `cat`)
\copy staging.games_raw(doc) FROM PROGRAM 'cat raw_data/games.json'
\copy staging.players_raw(doc) FROM PROGRAM 'cat raw_data/players.json'
\copy staging.teams_raw(doc) FROM PROGRAM 'cat raw_data/teams.json'

-- 3) Upsert TEAMS
WITH t AS (
  SELECT jsonb_array_elements(doc) AS j FROM staging.teams_raw
)
INSERT INTO teams (team_id, name)
SELECT (j->>'team_id')::int, j->>'name'
FROM t
ON CONFLICT (team_id) DO UPDATE
  SET name = EXCLUDED.name;

-- 4) Upsert GAMES
WITH g AS (
  SELECT jsonb_array_elements(doc) AS j FROM staging.games_raw
)
INSERT INTO games (game_id, game_date)
SELECT (j->>'id')::int, (j->>'date')::date
FROM g
ON CONFLICT (game_id) DO UPDATE
  SET game_date = EXCLUDED.game_date;

-- 5) Upsert PLAYERS + PLAYER_TEAM links
WITH p AS (
  SELECT jsonb_array_elements(doc) AS j FROM staging.players_raw
)
, up_players AS (
  INSERT INTO players (player_id, name)
  SELECT (j->>'player_id')::int, j->>'name'
  FROM p
  ON CONFLICT (player_id) DO UPDATE
    SET name = EXCLUDED.name
  RETURNING player_id
)
INSERT INTO player_team (team_id, player_id)
SELECT DISTINCT
       (p.j->>'team_id')::int,
       (p.j->>'player_id')::int
FROM p
ON CONFLICT DO NOTHING;

-- 6) Upsert SHOTS
WITH p AS (
  SELECT jsonb_array_elements(doc) AS j FROM staging.players_raw
)
, s AS (
  SELECT
    (p.j->>'player_id')::int                                       AS player_id,
    x.id::bigint                                                   AS shot_id,
    x.game_id::int                                                 AS game_id,
    x.points::smallint                                             AS points,
    COALESCE(x.shooting_foul_drawn, false)                         AS shooting_foul_drawn,
    x.shot_loc_x::numeric                                          AS shot_loc_x,
    x.shot_loc_y::numeric                                          AS shot_loc_y,
    x.action_type::text                                            AS action_type
  FROM p
  CROSS JOIN LATERAL jsonb_to_recordset(p.j->'shots') AS x(
      id int,
      points int,
      shooting_foul_drawn boolean,
      shot_loc_x numeric,
      shot_loc_y numeric,
      game_id int,
      action_type text
  )
)
INSERT INTO shots (shot_id, game_id, player_id, points, shooting_foul_drawn, shot_loc_x, shot_loc_y, action_type)
SELECT shot_id, game_id, player_id, points, shooting_foul_drawn, shot_loc_x, shot_loc_y, action_type
FROM s
ON CONFLICT (shot_id) DO UPDATE
  SET game_id     = EXCLUDED.game_id,
      player_id   = EXCLUDED.player_id,
      points      = EXCLUDED.points,
      shooting_foul_drawn = EXCLUDED.shooting_foul_drawn,
      shot_loc_x  = EXCLUDED.shot_loc_x,
      shot_loc_y  = EXCLUDED.shot_loc_y,
      action_type = EXCLUDED.action_type;

-- 7) Upsert PASSES
WITH p AS (
  SELECT jsonb_array_elements(doc) AS j FROM staging.players_raw
)
, pa AS (
  SELECT
    (p.j->>'player_id')::int            AS player_id,
    x.id::bigint                        AS pass_id,
    x.game_id::int                      AS game_id,
    COALESCE(x.potential_assist,false)  AS potential_assist,
    COALESCE(x.completed_pass,false)    AS completed_pass,
    x.ball_start_loc_x::numeric         AS ball_start_loc_x,
    x.ball_start_loc_y::numeric         AS ball_start_loc_y,
    x.ball_end_loc_x::numeric           AS ball_end_loc_x,
    x.ball_end_loc_y::numeric           AS ball_end_loc_y,
    x.action_type::text                 AS action_type
    -- x.turnover exists in your JSON; we ignore it because real turnovers are their own rows
  FROM p
  CROSS JOIN LATERAL jsonb_to_recordset(p.j->'passes') AS x(
      id int,
      completed_pass boolean,
      potential_assist boolean,
      turnover boolean,
      ball_start_loc_x numeric,
      ball_start_loc_y numeric,
      ball_end_loc_x numeric,
      ball_end_loc_y numeric,
      game_id int,
      action_type text
  )
)
INSERT INTO passes (pass_id, game_id, player_id, potential_assist, completed_pass,
                    ball_start_loc_x, ball_start_loc_y, ball_end_loc_x, ball_end_loc_y, action_type)
SELECT pass_id, game_id, player_id, potential_assist, completed_pass,
       ball_start_loc_x, ball_start_loc_y, ball_end_loc_x, ball_end_loc_y, action_type
FROM pa
ON CONFLICT (pass_id) DO UPDATE
  SET game_id          = EXCLUDED.game_id,
      player_id        = EXCLUDED.player_id,
      potential_assist = EXCLUDED.potential_assist,
      completed_pass   = EXCLUDED.completed_pass,
      ball_start_loc_x = EXCLUDED.ball_start_loc_x,
      ball_start_loc_y = EXCLUDED.ball_start_loc_y,
      ball_end_loc_x   = EXCLUDED.ball_end_loc_x,
      ball_end_loc_y   = EXCLUDED.ball_end_loc_y,
      action_type      = EXCLUDED.action_type;

-- 8) Upsert TURNOVERS
-- Note: your turnover JSON has no pass_id; we leave pass_id NULL.
WITH p AS (
  SELECT jsonb_array_elements(doc) AS j FROM staging.players_raw
)
, t AS (
  SELECT
    (p.j->>'player_id')::int        AS player_id,
    x.id::bigint                    AS turnover_id,
    x.game_id::int                  AS game_id,
    x.tov_loc_x::numeric            AS tov_loc_x,
    x.tov_loc_y::numeric            AS tov_loc_y,
    x.action_type::text             AS action_type
  FROM p
  CROSS JOIN LATERAL jsonb_to_recordset(p.j->'turnovers') AS x(
      id int,
      tov_loc_x numeric,
      tov_loc_y numeric,
      game_id int,
      action_type text
  )
)
INSERT INTO turnovers (turnover_id, game_id, player_id, pass_id, tov_loc_x, tov_loc_y, action_type)
SELECT turnover_id, game_id, player_id, NULL, tov_loc_x, tov_loc_y, action_type
FROM t
ON CONFLICT (turnover_id) DO UPDATE
  SET game_id    = EXCLUDED.game_id,
      player_id  = EXCLUDED.player_id,
      pass_id    = EXCLUDED.pass_id,
      tov_loc_x  = EXCLUDED.tov_loc_x,
      tov_loc_y  = EXCLUDED.tov_loc_y,
      action_type= EXCLUDED.action_type;

-- 9) Clear staging (optional; safe to skip since we TRUNCATE at the start)
TRUNCATE staging.players_raw;
TRUNCATE staging.games_raw;
TRUNCATE staging.teams_raw;

COMMIT;