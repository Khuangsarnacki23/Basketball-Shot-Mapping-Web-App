# -*- coding: utf-8 -*-
import logging

from rest_framework.response import Response
from rest_framework.views import APIView
from app.helpers.players import get_player_summary_stats, get_ranks

LOGGER = logging.getLogger('django')


class PlayerSummary(APIView):
    logger = LOGGER

    def get(self, request, playerID):
        """Return player data"""
        print(playerID)

        player_summary = get_player_summary_stats(player_id=playerID)
        player_summary = player_summary | get_ranks(player_id=playerID, player_summary=player_summary)

        return Response(player_summary)
