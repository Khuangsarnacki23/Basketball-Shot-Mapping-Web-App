import json
import os
import random
from django.http import JsonResponse, Http404
from django.db import connection
from app.dbmodels import models

ACTION_TYPES = ["pickAndRoll", "isolation", "postUp", "offBallScreen"]

def _fetchone(sql, params=()):
    with connection.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()

def _fetchall(sql, params=()):
    with connection.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()

def get_player_summary_stats(player_id: int):
    with open(os.path.dirname(os.path.abspath(__file__)) + '/sample_summary_data/sample_summary_data.json') as sample_summary:
        data = json.load(sample_summary)
    #return data
    # --- basic player info ---
    row = _fetchone("SELECT name FROM players WHERE player_id = %s", [player_id])
    if not row:
        raise Http404(f"Player {player_id} not found")
    player_name = row[0]

    # --- top-level totals (all actions combined) ---
    # totals from shots
    total_shots_row   = _fetchone("SELECT COUNT(*), COALESCE(SUM(points),0) FROM shots WHERE player_id = %s", [player_id])
    totalShotAttempts = int(total_shots_row[0])
    totalPoints       = int(total_shots_row[1])

        # totals from passes (no turnover column here)
    total_passes_row = _fetchone("""
        SELECT COUNT(*) AS total_passes,
            COALESCE(SUM((potential_assist)::int), 0) AS potential_assists
        FROM passes
        WHERE player_id = %s
    """, [player_id])
    totalPasses           = int(total_passes_row[0] or 0)
    totalPotentialAssists = int(total_passes_row[1] or 0)

    # passing turnovers come from turnovers table (turnovers caused by a pass)
    totalPassingTurnovers = int(_fetchone("""
        SELECT COUNT(*)
        FROM turnovers
        WHERE player_id = %s
        AND pass_id IS NOT NULL
    """, [player_id])[0])

    # total (all) turnovers remain from turnovers table
    totalTurnovers = int(_fetchone("""
        SELECT COUNT(*) FROM turnovers WHERE player_id = %s
    """, [player_id])[0])

    # --- per-action “counts” (shots + passes only) for the top-level pickAndRollCount, etc. ---
    # (Matches your example: e.g., pickAndRollCount = shot_count + pass_count)
    per_action_counts = dict((a, 0) for a in ACTION_TYPES)
    rows = _fetchall("""
        WITH s AS (
          SELECT action_type, COUNT(*) AS c FROM shots  WHERE player_id = %s GROUP BY action_type
        ),
        p AS (
          SELECT action_type, COUNT(*) AS c FROM passes WHERE player_id = %s GROUP BY action_type
        )
        SELECT coalesce(s.action_type, p.action_type) AS action_type,
               coalesce(s.c,0) + coalesce(p.c,0)      AS total
        FROM s FULL JOIN p ON s.action_type = p.action_type
    """, [player_id, player_id])
    for action_type, total in rows:
        if action_type in per_action_counts:
            per_action_counts[action_type] = int(total or 0)

    # --- helper to build each action section ---
    def build_action_section(action_type: str):
        # totals within this action
        s_counts = _fetchone("""
            SELECT COUNT(*) AS attempts, COALESCE(SUM(points),0) AS points
            FROM shots WHERE player_id = %s AND action_type = %s
        """, [player_id, action_type])
        attempts = int(s_counts[0] or 0)
        points   = int(s_counts[1] or 0)

            # totals from passes (no turnover column here)
        total_passes_row = _fetchone("""
            SELECT COUNT(*) AS total_passes,
                COALESCE(SUM((potential_assist)::int), 0) AS potential_assists
            FROM passes
            WHERE player_id = %s and action_type = %s
        """, [player_id,action_type])
        total_passes           = int(total_passes_row[0] or 0)
        potential_assists = int(total_passes_row[1] or 0)

        # passing turnovers come from turnovers table (turnovers caused by a pass)
        passing_turnovers_cnt = int(_fetchone("""
            SELECT COUNT(*)
            FROM turnovers
            WHERE player_id = %s and action_type = %s
            AND pass_id IS NOT NULL
        """, [player_id,action_type])[0])

        t_counts = _fetchone("""
            SELECT COUNT(*) FROM turnovers
            WHERE player_id = %s AND action_type = %s
        """, [player_id, action_type])
        total_turnovers = int(t_counts[0] or 0)

        # arrays
        shots = _fetchall("""
            SELECT shot_loc_x, shot_loc_y, points
            FROM shots
            WHERE player_id = %s AND action_type = %s
            ORDER BY shot_id
        """, [player_id, action_type])
        shots_arr = [{"loc": [float(x), float(y)], "points": int(pts)} for (x, y, pts) in shots]

        passes = _fetchall("""
            SELECT
            p.ball_start_loc_x, p.ball_start_loc_y,
            p.ball_end_loc_x,   p.ball_end_loc_y,
            p.completed_pass,   p.potential_assist,
            EXISTS (
                SELECT
                FROM turnovers t
                WHERE t.pass_id = p.pass_id
                AND t.player_id = p.player_id
            ) AS is_turnover
            FROM passes p
            WHERE p.player_id = %s
            AND p.action_type = %s
            ORDER BY p.pass_id
        """, [player_id, action_type])
        passes_arr = [{
            "startLoc": [float(sx), float(sy)],
            "endLoc":   [float(ex), float(ey)],
            "isCompleted": bool(comp),
            "isPotentialAssist": bool(past),
            "isTurnover": bool(tov)
        } for (sx, sy, ex, ey, comp, past, tov) in passes]

        tovs = _fetchall("""
            SELECT tov_loc_x, tov_loc_y
            FROM turnovers
            WHERE player_id = %s AND action_type = %s
            ORDER BY turnover_id
        """, [player_id, action_type])
        tovs_arr = [{"loc": [float(x), float(y)]} for (x, y) in tovs]

        return {
            "totalShotAttempts": attempts,
            "totalPoints": points,
            "totalPasses": total_passes,
            "totalPotentialAssists": potential_assists,
            "totalTurnovers": total_turnovers,
            "totalPassingTurnovers": passing_turnovers_cnt,
            "shots": shots_arr,
            "passes": passes_arr,
            "turnovers": tovs_arr
        }

    # build sections in requested order
    sections = {a: build_action_section(a) for a in ACTION_TYPES}

    # --- final payload in your requested shape ---
    payload = {
        "name": player_name,
        "playerID": int(player_id),
        "totalShotAttempts": totalShotAttempts,
        "totalPoints": totalPoints,
        "totalPasses": totalPasses,
        "totalPotentialAssists": totalPotentialAssists,
        "totalTurnovers": totalTurnovers,
        "totalPassingTurnovers": totalPassingTurnovers,
        "pickAndRollCount":  per_action_counts["pickAndRoll"],
        "isolationCount":    per_action_counts["isolation"],
        "postUpCount":       per_action_counts["postUp"],
        "offBallScreenCount": per_action_counts["offBallScreen"],
        "pickAndRoll":   sections["pickAndRoll"],
        "isolation":     sections["isolation"],
        "postUp":        sections["postUp"],
        "offBallScreen": sections["offBallScreen"],
    }
    return payload

def get_ranks(player_id: str, player_summary: dict):
    # TODO: replace with your implementation of get_ranks
    players_id = get_all_player_ids()
    all_player_summaries = []
    for individual_id in players_id:
        all_player_summaries.append(get_player_summary_stats(individual_id))

    totalShotAttemptsRank = 1
    totalPointsRank = 1
    totalPotentialAssistsRank = 1
    totalTurnoversRank = 1
    totalPassingTurnoversRank = 1
    pickAndRollCountRank = 1
    isolationCountRank = 1
    postUpCountRank = 1
    offBallScreenCountRank = 1
    totalPassesRank = 1
    for summary in all_player_summaries:
        if(summary['totalShotAttempts']>player_summary['totalShotAttempts']):
            totalShotAttemptsRank = totalShotAttemptsRank + 1
        if(summary['totalPoints']>player_summary['totalPoints']):
            totalPointsRank = totalPointsRank + 1
        if(summary['totalPasses']>player_summary['totalPasses']):
            totalPassesRank = totalPassesRank + 1
        if(summary['totalPotentialAssists']>player_summary['totalPotentialAssists']):
            totalPotentialAssistsRank = totalPotentialAssistsRank + 1
        if(summary['totalPassingTurnovers']>player_summary['totalPassingTurnovers']):
            totalPassingTurnoversRank = totalPassingTurnoversRank + 1
        if(summary['totalTurnovers'] < player_summary['totalTurnovers']):
            totalTurnoversRank = totalTurnoversRank + 1
        if(summary['pickAndRollCount'] > player_summary['pickAndRollCount']):
            pickAndRollCountRank = pickAndRollCountRank + 1
        if(summary['isolationCount'] > player_summary['isolationCount']):
            isolationCountRank = isolationCountRank + 1
        if(summary['offBallScreenCount'] > player_summary['offBallScreenCount']):
            offBallScreenCountRank = offBallScreenCountRank + 1
        if(summary['postUpCount'] > player_summary['postUpCount']):
            postUpCountRank = postUpCountRank + 1
        

    random.seed(player_id)
    return {
        "totalShotAttemptsRank": totalShotAttemptsRank,
        "totalPointsRank": totalPointsRank,
        "totalPassesRank": totalPassesRank,
        "totalPotentialAssistsRank": totalPotentialAssistsRank,
        "totalTurnoversRank": totalTurnoversRank,
        "totalPassingTurnoversRank": totalPassingTurnoversRank,
        'pickAndRollCountRank': pickAndRollCountRank,
        'isolationCountRank': isolationCountRank,
        'postUpCountRank': postUpCountRank,
        'offBallScreenCountRank': offBallScreenCountRank,
    }

def get_all_player_ids():
    sql = "SELECT player_id FROM players ORDER BY player_id"
    with connection.cursor() as cur:
        cur.execute(sql)
        return [row[0] for row in cur.fetchall()]