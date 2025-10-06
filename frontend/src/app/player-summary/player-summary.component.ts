import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { PlayersService } from '../_services/players.service';
import { PlayerSummaryModule as PSM } from './player-summary.module';
import { from, of } from 'rxjs';
import { concatMap, map, catchError, finalize, tap } from 'rxjs/operators';
type BucketKey = 'pickAndRoll' | 'isolation' | 'postUp' | 'offBallScreen';


function flattenBucketsToEvents(api: any, playerId: number): PSM.CourtEvent[] {
  const labelByKey: Record<BucketKey, PSM.HalfcourtAction> = {
    pickAndRoll: 'Pick & Roll',
    isolation: 'Isolation',
    postUp: 'Post-up',
    offBallScreen: 'Off-Ball Screen',
  };

  const events: PSM.CourtEvent[] = [];

  (Object.keys(labelByKey) as BucketKey[]).forEach((key) => {
    const bucket = api[key];
    if (!bucket) return;

    // shots: [{ loc: [x,y], points: 0|2|3, ... }]
    const shots = bucket.shots ?? [];
    for (const s of shots) {
      const [x, y] = (s.loc ?? [0, 0]).map(Number);
      events.push(new PSM.CourtEvent({
        playerId,
        x, y,
        actionType: 'shot',
        halfcourtAction: labelByKey[key],
        made: Number(s.points ?? 0) > 0,
        timestamp: s.timestamp ?? s.ts,
      }));
    }

    // passes: [{ startLoc:[x,y], endLoc:[x,y], isCompleted, isPotentialAssist, isTurnover }]
    const passes = bucket.passes ?? [];
    for (const p of passes) {
      // choose end location for where the ball went; fallback to start
      const [x, y] = (p.endLoc ?? p.startLoc ?? [0, 0]).map(Number);
      events.push(new PSM.CourtEvent({
        playerId,
        x, y,
        actionType: 'pass',
        halfcourtAction: labelByKey[key],
        made: false,
        timestamp: p.timestamp ?? p.ts,
      }));
      if (p.isTurnover) {
        const [tx, ty] = (p.endLoc ?? p.startLoc ?? [x, y]).map(Number);
        events.push(new PSM.CourtEvent({
          playerId,
          x: tx, y: ty,
          actionType: 'turnover',
          halfcourtAction: labelByKey[key],
          made: false,
          timestamp: p.timestamp ?? p.ts,
        }));
      }
    }

    // turnovers: [{ loc:[x,y], ... }]
    const tos = bucket.turnovers ?? [];
    for (const t of tos) {
      const [x, y] = (t.loc ?? [0, 0]).map(Number);
      events.push(new PSM.CourtEvent({
        playerId,
        x, y,
        actionType: 'turnover',
        halfcourtAction: labelByKey[key],
        made: false,
        timestamp: t.timestamp ?? t.ts,
      }));
    }
  });

  return events;
}

function buildCountsAndRanksFromFlat(api: any): {
  counts: Record<PSM.CountKeys, number>;
  ranks: Record<`${PSM.CountKeys}Rank`, number>;
} {
  const counts: Record<PSM.CountKeys, number> = {
    totalShotAttempts: Number(api.totalShotAttempts ?? 0),
    totalPoints: Number(api.totalPoints ?? 0),
    totalPasses: Number(api.totalPasses ?? 0),
    totalPotentialAssists: Number(api.totalPotentialAssists ?? 0),
    totalTurnovers: Number(api.totalTurnovers ?? 0),
    totalPassingTurnovers: Number(api.totalPassingTurnovers ?? 0),
    pickAndRollCount: Number(api.pickAndRollCount ?? 0),
    isolationCount: Number(api.isolationCount ?? 0),
    postUpCount: Number(api.postUpCount ?? 0),
    offBallScreenCount: Number(api.offBallScreenCount ?? 0),
  };

  const ranks = {
    totalShotAttemptsRank: Number(api.totalShotAttemptsRank ?? 0),
    totalPointsRank: Number(api.totalPointsRank ?? 0),
    totalPassesRank: Number(api.totalPassesRank ?? 0),
    totalPotentialAssistsRank: Number(api.totalPotentialAssistsRank ?? 0),
    totalTurnoversRank: Number(api.totalTurnoversRank ?? 0),
    totalPassingTurnoversRank: Number(api.totalPassingTurnoversRank ?? 0),
    pickAndRollCountRank: Number(api.pickAndRollCountRank ?? 0),
    isolationCountRank: Number(api.isolationCountRank ?? 0),
    postUpCountRank: Number(api.postUpCountRank ?? 0),
    offBallScreenCountRank: Number(api.offBallScreenCountRank ?? 0),
  } as Record<`${PSM.CountKeys}Rank`, number>;

  return { counts, ranks };
}

@UntilDestroy()
@Component({
  selector: 'player-summary-component',
  templateUrl: './player-summary.component.html',
  styleUrls: ['./player-summary.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PlayerSummaryComponent implements OnInit, OnDestroy {
  private getAllPlayerIds(): number[] {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // <-- put your real list here
  }

  PSM = PSM;

ftR = 6 * PSM.CourtGeometry.PX_PER_FT;
ftCx = PSM.CourtGeometry.toSvgX(0);
ftCy = PSM.CourtGeometry.toSvgY(15);
ftLeftX  = this.ftCx - this.ftR;
ftRightX = this.ftCx + this.ftR;



  players: PSM.Player[] = [];
  events: PSM.CourtEvent[] = [];
  summaries: PSM.PlayerSummary[] = [];

  selectedPlayerId: number | 'all' = 'all';
  showShots = true;
  showPasses = true;
  showTurnovers = true;

  readonly viewW = PSM.CourtGeometry.COURT_WIDTH_FT * PSM.CourtGeometry.PX_PER_FT;
  readonly viewH = PSM.CourtGeometry.COURT_LENGTH_FT * PSM.CourtGeometry.PX_PER_FT;

  constructor(
    protected activatedRoute: ActivatedRoute,
    protected cdr: ChangeDetectorRef,
    protected playersService: PlayersService,
  ) {}


  ngOnInit(): void {
    const ids = this.getAllPlayerIds();
  
    this.players = [];
    this.events = [];
    this.summaries = [];
    this.selectedPlayerId = 'all';
  
    from(ids).pipe(
      concatMap(id =>
        this.playersService.getPlayerSummary(id).pipe(
          map(resp => ({ id, api: (resp as any)?.apiResponse ?? null })),
          catchError(err => {
            console.warn('load failed for player', id, err);
            return of({ id, api: null });
          })
        )
      ),
      tap(({ id, api }) => {
        if (!api) return;
  
        const player = new PSM.Player({
          id: Number(api.playerID ?? id),
          name: String(api.name ?? `Player ${id}`),
        });
        this.players.push(player);
  
        const evts = flattenBucketsToEvents(api, player.id);
        this.events.push(...evts);
  
        const { counts, ranks } = buildCountsAndRanksFromFlat(api);
        this.summaries.push(new PSM.PlayerSummary(player, counts, ranks));
  
        this.cdr.detectChanges();
      }),
      finalize(() => {
        this.selectedPlayerId = 'all';
        console.log('Loaded players:', this.players.length, 'events:', this.events.length);
        this.cdr.detectChanges();
      })
    )
    .pipe(untilDestroyed(this))
    .subscribe();
  }
  get selectedPlayerLabel(): string {
    return this.selectedPlayerId === 'all'
      ? 'All players'
      : this.playerName(Number(this.selectedPlayerId));
  }

  get filteredEvents(): PSM.CourtEvent[] {
    return this.events.filter(e => {
      if (this.selectedPlayerId !== 'all' && e.playerId !== this.selectedPlayerId) return false;
      if (!this.showShots && e.actionType === 'shot') return false;
      if (!this.showPasses && e.actionType === 'pass') return false;
      if (!this.showTurnovers && e.actionType === 'turnover') return false;
      return true;
    });
  }

  get zoneCounts(): Array<{ zone: string; count: number }> {
    const m = new Map<string, number>();
    for (const e of this.filteredEvents) m.set(e.zone, (m.get(e.zone) || 0) + 1);
    return [...m.entries()].map(([zone, count]) => ({ zone, count })).sort((a, b) => b.count - a.count);
  }

  playerName(id: number): string {
    return this.players.find(p => p.id === id)?.name ?? `#${id}`;
  }

  colorForAction(a: PSM.ActionType): string {
    switch (a) {
      case 'shot': return '#1f77b4';
      case 'pass': return '#2ca02c';
      case 'turnover': return '#d62728';
    }
  }

  markerRadius(e: PSM.CourtEvent): number {
    return e.actionType === 'shot' ? 4 : 3;
  }

  ngOnDestroy() {}
}
